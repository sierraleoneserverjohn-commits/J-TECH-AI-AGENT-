import { sseManager } from '../events/sseManager.js';

export interface PendingAction {
  id: string;
  type: 'github_write' | 'send_message' | 'change_settings' | 'delete_memory' | 'system_action';
  title: string;
  description: string;
  payload: Record<string, any>;
  createdAt: number;
  status: 'pending' | 'approved' | 'denied';
  callback?: (approved: boolean) => Promise<any>;
}

export class PermissionEngine {
  private pendingActions = new Map<string, PendingAction>();

  public isSensitive(command: string): { sensitive: boolean; type?: PendingAction['type']; title?: string; description?: string } {
    const lower = command.toLowerCase();

    if (lower.includes('write to github') || lower.includes('commit') || lower.includes('create pull request') || lower.includes('push to repo')) {
      return {
        sensitive: true,
        type: 'github_write',
        title: 'Guarded GitHub Action',
        description: 'Command intends to write code or commit changes to a GitHub repository.',
      };
    }

    if (lower.includes('send message') || lower.includes('send email') || lower.includes('broadcast alert')) {
      return {
        sensitive: true,
        type: 'send_message',
        title: 'Outbound Communication',
        description: 'Command attempts to send an outbound message or alert.',
      };
    }

    if (lower.includes('delete all memory') || lower.includes('wipe storage') || lower.includes('reset system')) {
      return {
        sensitive: true,
        type: 'delete_memory',
        title: 'Destructive Memory Operation',
        description: 'Command attempts to purge memory records or system settings.',
      };
    }

    return { sensitive: false };
  }

  public registerPending(
    type: PendingAction['type'],
    title: string,
    description: string,
    payload: Record<string, any>
  ): PendingAction {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const action: PendingAction = {
      id,
      type,
      title,
      description,
      payload,
      createdAt: Date.now(),
      status: 'pending',
    };

    this.pendingActions.set(id, action);

    // Notify clients on SSE
    sseManager.emit('state', {
      state: 'verifying',
      detail: `Confirmation required: ${title}`,
      actionId: id,
    });

    sseManager.emit('log', {
      text: `[Permission Guard] Action paused pending confirmation (${id}): ${title}`,
      level: 'warn',
    });

    return action;
  }

  public get(id: string): PendingAction | undefined {
    return this.pendingActions.get(id);
  }

  public confirm(id: string, approved: boolean): { success: boolean; message: string; action?: PendingAction } {
    const action = this.pendingActions.get(id);
    if (!action) {
      return { success: false, message: `Pending action "${id}" not found or expired.` };
    }

    action.status = approved ? 'approved' : 'denied';
    this.pendingActions.delete(id);

    sseManager.emit('log', {
      text: `[Permission Guard] Action ${id} was ${approved ? 'APPROVED' : 'DENIED'} by user`,
      level: approved ? 'success' : 'warn',
    });

    return {
      success: true,
      message: approved ? `Action "${action.title}" confirmed and executing.` : `Action "${action.title}" cancelled by user.`,
      action,
    };
  }

  public getPendingList(): PendingAction[] {
    return Array.from(this.pendingActions.values());
  }
}

export const permissionEngine = new PermissionEngine();
