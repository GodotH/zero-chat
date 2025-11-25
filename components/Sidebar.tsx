import React from 'react';
import { MessageSquare, Plus, Trash2, Github } from 'lucide-react';

interface SidebarProps {
  sessions: { id: string, title: string, timestamp: number }[];
  currentId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sessions, currentId, onSelect, onNew, onDelete }) => {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-zinc-400">HISTORY</span>
        <button 
          onClick={onNew}
          className="p-1.5 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 rounded border border-emerald-900/50 transition-colors"
          title="New Chat"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 -mr-2 pr-2 custom-scrollbar">
        {sessions.map(session => (
          <div 
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`
              group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border
              ${session.id === currentId 
                ? 'bg-zinc-800 border-zinc-700 text-zinc-100' 
                : 'bg-transparent border-transparent text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
              }
            `}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={14} className="shrink-0" />
              <span className="text-xs font-mono truncate">{session.title || 'New Chat'}</span>
            </div>
            
            <button
              onClick={(e) => onDelete(session.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 text-red-500/70 hover:text-red-500 rounded transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="text-center py-8 text-zinc-700 text-xs font-mono italic">
            No history yet.
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-900">
        <a 
          href="https://github.com/cognizant-ai-lab/neuro-san-benchmarking" 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center gap-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors p-2"
        >
          <Github size={14} />
          <span>Paper Reference</span>
        </a>
      </div>
    </div>
  );
};

export default Sidebar;