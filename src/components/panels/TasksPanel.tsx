import React from 'react';
import { ActiveTask } from '../../events/useJexaStore';
import { eventBus } from '../../events/eventBus';
import { getActiveBrain } from '../../brains';
import { CheckCircle2, Circle, Clock, PlayCircle, Loader2 } from 'lucide-react';

interface TasksPanelProps {
  task: ActiveTask | null;
}

export const TasksPanel: React.FC<TasksPanelProps> = ({ task }) => {
  const runPresetTask = (taskName: string) => {
    getActiveBrain().send(`Execute task: ${taskName}`);
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'active':
        return <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />;
      case 'failed':
        return <Circle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-slate-600 shrink-0" />;
    }
  };

  return (
    <div className="space-y-2.5 font-mono text-xs">
      {task ? (
        <div className="p-2.5 rounded-lg bg-[#0a1424]/80 border border-cyan-500/30">
          <div className="flex items-center justify-between mb-1.5">
            <h4 className="font-semibold text-slate-100 truncate">{task.title}</h4>
            <span className="text-cyan-400 font-bold">{task.progress}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${task.progress}%` }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            {task.steps.map((step, idx) => (
              <div
                key={step.id || idx}
                className={`flex items-center justify-between p-1.5 rounded text-[11px] ${
                  step.status === 'active'
                    ? 'bg-amber-950/30 text-amber-200 border border-amber-500/30'
                    : step.status === 'completed'
                    ? 'bg-slate-900/40 text-slate-300'
                    : 'text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  {getStepIcon(step.status)}
                  <span>{step.name}</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider">{step.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-3 text-center text-slate-500 text-xs italic">
          No task actively queued.
        </div>
      )}

      {/* Triggerable presets */}
      <div className="pt-2 border-t border-slate-800/80">
        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1.5">
          Execute Autonomous Routines
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => runPresetTask('System Security Audit')}
            className="py-1.5 px-2 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-cyan-300 text-[10px] text-left transition-colors truncate"
          >
            Audit System Security
          </button>
          <button
            onClick={() => runPresetTask('Re-index Vector Memory')}
            className="py-1.5 px-2 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 text-slate-300 hover:text-cyan-300 text-[10px] text-left transition-colors truncate"
          >
            Re-index Memory
          </button>
        </div>
      </div>
    </div>
  );
};
