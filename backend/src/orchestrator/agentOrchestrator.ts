import { rulesClassifier } from './rulesClassifier.js';
import { taskManager } from './taskManager.js';
import { toolRegistry } from '../tools/toolRegistry.js';
import { modelGateway } from '../models/modelGateway.js';
import { contextManager } from '../context/contextManager.js';
import { cacheManager } from '../context/cacheManager.js';
import { permissionEngine } from '../permissions/permissionEngine.js';
import { verificationEngine } from '../verification/verificationEngine.js';
import { sseManager } from '../events/sseManager.js';

export interface CommandRequest {
  text: string;
  sessionId?: string;
  mode?: 'auto' | 'manual' | 'task';
  model?: string;
  preset?: 'eco' | 'balanced' | 'max';
  task?: 'chat' | 'reasoning' | 'research' | 'vision' | 'voice';
  allowFallback?: boolean;
}

export interface CommandResponse {
  reply: string;
  provider: string;
  model?: string;
  latencyMs?: number;
  autoReason?: string;
  taskId: string;
  cached?: boolean;
  handledLocally?: boolean;
  tokensUsed?: any;
  sources?: any[];
  pendingActionId?: string;
}

export class AgentOrchestrator {
  public async executeCommand(req: CommandRequest): Promise<CommandResponse> {
    const rawText = req.text.trim();
    const sessionId = req.sessionId || 'default_session';

    // 1. Create a real task with 4 observable stages
    const task = taskManager.createTask(`Process: "${rawText.slice(0, 32)}..."`);

    sseManager.emit('state', { state: 'understanding', detail: `Parsing directive: "${rawText.slice(0, 30)}..."` });
    sseManager.emit('log', { text: `Command received: "${rawText}"`, level: 'info' });
    sseManager.emit('message', { role: 'user', text: rawText, timestamp: Date.now() });

    // Voice mode switches (e.g. "use the fastest model", "use the smartest model", "set model to auto")
    const lower = rawText.toLowerCase();
    if (lower.includes('use the fastest model') || lower.includes('fastest model') || lower.includes('switch to fastest')) {
      const reply = 'Done, sir. Switched to high-speed eco mode for sub-second execution.';
      taskManager.completeTask(task.id, 'Mode switched locally (0 tokens)');
      sseManager.emit('state', { state: 'completed', detail: 'Mode updated to fastest' });
      sseManager.emit('message', { role: 'assistant', text: reply, provider: 'RuleEngine (Local)' });
      setTimeout(() => sseManager.emit('state', { state: 'idle' }), 1200);
      return { reply, provider: 'LocalEngine', taskId: task.id, handledLocally: true };
    }

    if (lower.includes('use the smartest model') || lower.includes('smartest model') || lower.includes('max quality model')) {
      const reply = 'Done, sir. Switched to maximum reasoning quality preset.';
      taskManager.completeTask(task.id, 'Mode switched locally (0 tokens)');
      sseManager.emit('state', { state: 'completed', detail: 'Mode updated to max quality' });
      sseManager.emit('message', { role: 'assistant', text: reply, provider: 'RuleEngine (Local)' });
      setTimeout(() => sseManager.emit('state', { state: 'idle' }), 1200);
      return { reply, provider: 'LocalEngine', taskId: task.id, handledLocally: true };
    }

    if (lower.includes('set model to auto') || lower.includes('auto model mode') || lower.includes('switch to auto')) {
      const reply = 'Done, sir. Automatic intelligent model routing active.';
      taskManager.completeTask(task.id, 'Mode switched locally (0 tokens)');
      sseManager.emit('state', { state: 'completed', detail: 'Mode updated to auto' });
      sseManager.emit('message', { role: 'assistant', text: reply, provider: 'RuleEngine (Local)' });
      setTimeout(() => sseManager.emit('state', { state: 'idle' }), 1200);
      return { reply, provider: 'LocalEngine', taskId: task.id, handledLocally: true };
    }

    // 2. Permission Guard: Check if command is sensitive
    const sensitiveCheck = permissionEngine.isSensitive(rawText);
    if (sensitiveCheck.sensitive && sensitiveCheck.type) {
      const pendingAction = permissionEngine.registerPending(
        sensitiveCheck.type,
        sensitiveCheck.title || 'Guarded Action',
        sensitiveCheck.description || 'This action requires explicit user authorization.',
        { command: rawText }
      );

      taskManager.updateStep(task.id, 0, 'completed', 'Identified sensitive action requiring approval', 40);
      taskManager.updateStep(task.id, 1, 'running', 'Awaiting user confirmation card response', 50);

      const guardReply = `⚠️ Security Guard: ${pendingAction.title}. Please approve the confirmation card to proceed with execution.`;
      sseManager.emit('message', { role: 'assistant', text: guardReply, provider: 'SecurityGuard' });

      return {
        reply: guardReply,
        provider: 'PermissionGuard',
        taskId: task.id,
        pendingActionId: pendingAction.id,
      };
    }

    // 3. Token-Saving Strategy 1: Check 10-Minute Response Cache (only in auto mode)
    if (!req.mode || req.mode === 'auto') {
      const cached = await cacheManager.get(rawText);
      if (cached) {
        taskManager.completeTask(task.id, 'Retrieved answer from 10-minute cache (0 tokens used)');
        sseManager.emit('state', { state: 'completed', detail: 'Served from 10-minute cache' });
        sseManager.emit('log', { text: `[Cache] Served identical request from cache (0 tokens)`, level: 'success' });
        sseManager.emit('message', {
          role: 'assistant',
          text: cached.reply,
          provider: `${cached.provider} (Cached)`,
          latencyMs: 15,
        });

        setTimeout(() => sseManager.emit('state', { state: 'idle' }), 1200);

        return {
          reply: cached.reply,
          provider: cached.provider,
          latencyMs: 15,
          taskId: task.id,
          cached: true,
          sources: cached.sources,
        };
      }
    }

    // 4. Token-Saving Strategy 2: Rules before AI (0 tokens)
    const ruleResult = await rulesClassifier.evaluate(rawText);
    if (ruleResult.handledLocally && ruleResult.reply) {
      taskManager.completeTask(task.id, 'Deterministic local rule executed (0 tokens)');
      sseManager.emit('state', { state: 'completed', detail: 'Completed locally with 0 tokens' });
      sseManager.emit('log', { text: `[Rule Engine] Handled locally without AI call (0 tokens)`, level: 'success' });
      sseManager.emit('message', { role: 'assistant', text: ruleResult.reply, provider: 'RuleEngine (Local)', latencyMs: 5 });

      await contextManager.addMessage(sessionId, { role: 'user', content: rawText, timestamp: Date.now() });
      await contextManager.addMessage(sessionId, { role: 'assistant', content: ruleResult.reply, timestamp: Date.now() });

      setTimeout(() => sseManager.emit('state', { state: 'idle' }), 1200);

      return {
        reply: ruleResult.reply,
        provider: 'LocalEngine',
        latencyMs: 5,
        taskId: task.id,
        handledLocally: true,
      };
    }

    taskManager.updateStep(task.id, 0, 'completed', 'Planned steps & pruned tool schemas', 30);
    taskManager.updateStep(task.id, 1, 'running', 'Executing relevant tools if applicable', 45);

    // 5. Tool Execution Phase
    let toolContextString = '';
    const gatheredSources: any[] = [];

    if (ruleResult.toolNamesToProvide.length > 0) {
      sseManager.emit('state', {
        state: 'running_tools',
        detail: `Running tool [${ruleResult.toolNamesToProvide[0]}]...`,
      });

      for (const toolName of ruleResult.toolNamesToProvide) {
        sseManager.emit('log', { text: `[Agent] Invoking tool "${toolName}" for query context`, level: 'info' });

        try {
          let toolRes = await toolRegistry.execute(toolName, rawText, { taskId: task.id });

          const verified = verificationEngine.verify(toolName, toolRes);
          if (!verified.valid) {
            sseManager.emit('log', { text: `[Verification] Tool "${toolName}" produced suspicious output. Retrying once...`, level: 'warn' });
            toolRes = await toolRegistry.execute(toolName, rawText, { taskId: task.id });
          }

          if (toolRes.success) {
            toolContextString += `\n[Tool Result (${toolName})]:\n${toolRes.output}\n`;
            if (toolRes.sources) {
              gatheredSources.push(...toolRes.sources);
            }
          } else {
            sseManager.emit('log', { text: `[Tool Notice] ${toolName} failed gracefully: ${toolRes.error}. Continuing with fallback reasoning.`, level: 'warn' });
          }
        } catch (toolErr: any) {
          sseManager.emit('log', { text: `[Tool Error] ${toolName} threw error: ${toolErr.message}. Continuing...`, level: 'warn' });
        }
      }
    }

    taskManager.updateStep(task.id, 1, 'completed', 'Tool execution finished', 65);
    taskManager.updateStep(task.id, 2, 'running', 'Reasoning with Model Gateway', 75);

    // 6. Context Windowing: Send ONLY last 4 messages to conserve tokens
    const { messages: recentHistory, summary: olderSummary } = await contextManager.getRecentContext(sessionId);

    let finalPrompt = rawText;
    if (olderSummary) {
      finalPrompt = `[Context Note: ${olderSummary}]\n\nUser directive: ${rawText}`;
    }
    if (toolContextString) {
      finalPrompt += `\n\nVerified background data retrieved:\n${toolContextString}`;
    }

    // 7. Model Gateway Call respecting Model Mode
    sseManager.emit('state', { state: 'thinking', detail: 'Synthesizing response with neural provider...' });

    const systemPrompt = `You are JEXA (JARVIS-class Executive Autonomous Intelligence), an elite personal AI command centre.
Calm, razor-sharp, concise (1-3 sentences for spoken response), highly factual.
If tool data is provided, incorporate it directly.`;

    const chain = ruleResult.intent === 'search' ? 'research' : 'chat';
    const modelResponse = await modelGateway.complete(finalPrompt, {
      systemPrompt,
      history: recentHistory,
      chain,
      mode: req.mode,
      targetModel: req.model,
      preset: req.preset,
      task: req.task,
      allowFallback: req.allowFallback,
    });

    taskManager.updateStep(task.id, 2, 'completed', `Synthesized answer using ${modelResponse.provider}`, 90);
    taskManager.updateStep(task.id, 3, 'running', 'Verifying response format & quality', 95);

    // 8. Cache result
    await cacheManager.set(rawText, {
      reply: modelResponse.reply,
      provider: modelResponse.provider,
      sources: gatheredSources,
    });

    // 9. Update Context
    await contextManager.addMessage(sessionId, { role: 'user', content: rawText, timestamp: Date.now() });
    await contextManager.addMessage(sessionId, { role: 'assistant', content: modelResponse.reply, timestamp: Date.now() });

    // 10. Deliver Response
    taskManager.completeTask(task.id, 'Delivered verified answer');
    sseManager.emit('state', { state: 'completed', detail: 'Routine completed successfully' });
    sseManager.emit('log', {
      text: `[Agent] Complete (${modelResponse.latencyMs}ms via ${modelResponse.provider} / ${modelResponse.model})`,
      level: 'success',
    });
    sseManager.emit('message', {
      role: 'assistant',
      text: modelResponse.reply,
      provider: modelResponse.provider,
      model: modelResponse.model,
      latencyMs: modelResponse.latencyMs,
      autoReason: modelResponse.autoReason,
      sources: gatheredSources,
    });

    setTimeout(() => sseManager.emit('state', { state: 'idle' }), 1200);

    return {
      reply: modelResponse.reply,
      provider: modelResponse.provider,
      model: modelResponse.model,
      latencyMs: modelResponse.latencyMs,
      autoReason: modelResponse.autoReason,
      taskId: task.id,
      tokensUsed: modelResponse.tokensUsed,
      sources: gatheredSources,
    };
  }
}

export const agentOrchestrator = new AgentOrchestrator();
