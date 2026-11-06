import { sseManager } from '../events/sseManager.js';

export interface TaskStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  detail?: string;
  timestamp?: number;
}

export interface AgentTask {
  id: string;
  title: string;
  steps: TaskStep[];
  progress: number; // 0 to 100
  status: 'planning' | 'running' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export class TaskManager {
  private tasks = new Map<string, AgentTask>();

  public createTask(title: string): AgentTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const task: AgentTask = {
      id,
      title,
      steps: [
        { name: 'Planning & Routing', status: 'running', detail: 'Evaluating rules and tool requirements' },
        { name: 'Knowledge & Tool Execution', status: 'pending' },
        { name: 'Reasoning & Synthesis', status: 'pending' },
        { name: 'Verification & Delivery', status: 'pending' },
      ],
      progress: 15,
      status: 'planning',
      createdAt: Date.now(),
    };

    this.tasks.set(id, task);
    this.broadcast(task);
    return task;
  }

  public updateStep(
    taskId: string,
    stepIndex: number,
    status: TaskStep['status'],
    detail?: string,
    progress?: number
  ): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    if (task.steps[stepIndex]) {
      task.steps[stepIndex].status = status;
      if (detail) task.steps[stepIndex].detail = detail;
      task.steps[stepIndex].timestamp = Date.now();
    }

    if (progress !== undefined) {
      task.progress = Math.min(100, Math.max(0, progress));
    }

    this.broadcast(task);
  }

  public completeTask(taskId: string, finalDetail?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.steps.forEach((s) => {
      if (s.status === 'pending' || s.status === 'running') {
        s.status = 'completed';
      }
    });
    if (finalDetail && task.steps[task.steps.length - 1]) {
      task.steps[task.steps.length - 1].detail = finalDetail;
    }

    task.progress = 100;
    task.status = 'completed';
    task.completedAt = Date.now();

    this.broadcast(task);
  }

  public failTask(taskId: string, errorMsg: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    const runningStep = task.steps.find((s) => s.status === 'running');
    if (runningStep) {
      runningStep.status = 'failed';
      runningStep.detail = errorMsg;
    }

    this.broadcast(task);
  }

  private broadcast(task: AgentTask): void {
    sseManager.emit('task', {
      id: task.id,
      title: task.title,
      steps: task.steps,
      progress: task.progress,
      status: task.status,
    });
  }

  public get(id: string): AgentTask | undefined {
    return this.tasks.get(id);
  }
}

export const taskManager = new TaskManager();
