import React, { useState } from 'react';
import { MemoryItem } from '../../events/eventBus';
import { eventBus } from '../../events/eventBus';
import { Database, Plus, Trash2, Cpu, HardDrive } from 'lucide-react';

interface MemoryPanelProps {
  workingMemory: MemoryItem[];
  longTermMemory: MemoryItem[];
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  workingMemory,
  longTermMemory,
}) => {
  const [activeTab, setActiveTab] = useState<'working' | 'long-term'>('working');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    eventBus.emit('memory', {
      layer: activeTab,
      delta: 1,
      item: {
        id: `mem-${Date.now()}`,
        key: newKey.trim(),
        value: newValue.trim(),
        timestamp: Date.now(),
      },
    });

    eventBus.emit('log', {
      text: `Saved entry to ${activeTab} memory: [${newKey.trim()}]`,
      level: 'success',
    });

    setNewKey('');
    setNewValue('');
    setShowAddForm(false);
  };

  const handleClearWorkingMemory = () => {
    eventBus.emit('action', {
      id: `act-clear-mem-${Date.now()}`,
      title: 'Clear Working Memory',
      description: 'Purge all short-term session memory items?',
      requiresConfirmation: true,
      status: 'pending',
      payload: { action: 'clear_working_memory' },
    });
  };

  const activeItems = activeTab === 'working' ? workingMemory : longTermMemory;

  return (
    <div className="space-y-2.5 font-mono text-xs">
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-[#09111c] rounded-lg border border-slate-800">
        <button
          onClick={() => setActiveTab('working')}
          className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'working'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          Working ({workingMemory.length})
        </button>
        <button
          onClick={() => setActiveTab('long-term')}
          className={`py-1 px-2 rounded text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'long-term'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Long-term ({longTermMemory.length})
        </button>
      </div>

      {/* Memory items list */}
      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
        {activeItems.length === 0 ? (
          <p className="text-center text-slate-500 py-3 italic">
            No memories stored in {activeTab} layer.
          </p>
        ) : (
          activeItems.map((item) => (
            <div
              key={item.id}
              className="p-1.5 rounded bg-[#0b1422]/80 border border-slate-800/80 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex justify-between items-center text-[10px] text-cyan-400 font-semibold mb-0.5">
                <span className="truncate">{item.key}</span>
                <span className="text-slate-500 text-[9px]">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 break-words">{item.value}</p>
            </div>
          ))
        )}
      </div>

      {/* Add Item form */}
      {showAddForm ? (
        <form onSubmit={handleAddMemory} className="p-2 rounded bg-slate-900 border border-cyan-500/30 space-y-2">
          <input
            type="text"
            placeholder="Key / Topic (e.g. user_goal)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="w-full py-1 px-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
          />
          <input
            type="text"
            placeholder="Value / Detail"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="w-full py-1 px-2 rounded bg-slate-950 border border-slate-700 text-xs text-white"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px]"
            >
              Store Memory
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-1.5 pt-1 border-t border-slate-800">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex-1 py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors text-[11px]"
          >
            <Plus className="w-3 h-3 text-cyan-400" />
            Add Entry
          </button>
          {activeTab === 'working' && workingMemory.length > 0 && (
            <button
              onClick={handleClearWorkingMemory}
              title="Purge working memory"
              className="py-1.5 px-2.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 flex items-center justify-center transition-colors text-[11px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
