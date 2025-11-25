import React from 'react';
import { MessageSquare, Plus, Trash2, Github, PanelLeftClose, PanelLeftOpen, Settings2 } from 'lucide-react';

interface SidebarProps {
  sessions: { id: string, title: string, timestamp: number }[];
  currentId: string;
  isCollapsed: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onToggleCollapse: () => void;
  onOpenConfig: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentId, 
  isCollapsed, 
  onSelect, 
  onNew, 
  onDelete,
  onToggleCollapse,
  onOpenConfig
}) => {
  return (
    <div className={`flex flex-col h-full bg-zinc-950 transition-all duration-300 ${isCollapsed ? 'items-center py-4' : 'p-4'}`}>
      
      {/* Header / New Chat */}
      <div className={`flex shrink-0 mb-6 ${isCollapsed ? 'flex-col gap-4 items-center' : 'flex-row items-center justify-between'}`}>
        
        {/* Toggle Button (Hidden on Mobile, as Mobile uses Overlay) */}
        <button 
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        {!isCollapsed && <span className="font-mono text-xs font-bold text-zinc-500 tracking-wider">HISTORY</span>}
        
        <button 
          onClick={onNew}
          className={`
            flex items-center justify-center
            ${isCollapsed 
              ? 'w-10 h-10 rounded-xl bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 hover:scale-105' 
              : 'p-1.5 rounded-lg bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40'
            } transition-all
          `}
          title="New Chat"
        >
          <Plus size={isCollapsed ? 20 : 16} />
        </button>
      </div>

      {/* Session List */}
      <div className={`flex-1 overflow-y-auto space-y-1 custom-scrollbar ${isCollapsed ? 'w-full px-2 items-center flex flex-col' : '-mr-2 pr-2'}`}>
        {sessions.map(session => (
          <div 
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`
              group relative flex items-center rounded-lg cursor-pointer transition-all border
              ${isCollapsed ? 'justify-center w-10 h-10' : 'justify-between p-2.5 w-full'}
              ${session.id === currentId 
                ? 'bg-zinc-900 border-zinc-700 text-zinc-100 shadow-lg' 
                : 'bg-transparent border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
              }
            `}
            title={isCollapsed ? session.title : undefined}
          >
            <div className={`flex items-center ${!isCollapsed && 'gap-3 overflow-hidden'}`}>
              <MessageSquare size={16} className={`shrink-0 ${session.id === currentId ? 'text-emerald-500' : ''}`} />
              {!isCollapsed && <span className="text-xs font-mono truncate">{session.title || 'New Chat'}</span>}
            </div>
            
            {!isCollapsed && (
              <button
                onClick={(e) => onDelete(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/30 text-red-500/70 hover:text-red-500 rounded transition-all"
              >
                <Trash2 size={12} />
              </button>
            )}

            {/* Selection Indicator for Collapsed Mode */}
            {isCollapsed && session.id === currentId && (
               <div className="absolute -left-3 w-1 h-5 bg-emerald-500 rounded-r-full"></div>
            )}
          </div>
        ))}

        {sessions.length === 0 && !isCollapsed && (
          <div className="text-center py-8 text-zinc-700 text-xs font-mono italic">
            No history.
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className={`mt-4 pt-4 border-t border-zinc-900 flex flex-col ${isCollapsed ? 'items-center gap-4' : 'gap-2'}`}>
        
        {/* Config Button */}
        <button 
          onClick={onOpenConfig}
          className={`flex items-center ${isCollapsed ? 'justify-center w-10 h-10' : 'gap-3 px-3 py-2'} text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 rounded-lg transition-all group`}
          title="Configuration"
        >
          <Settings2 size={18} className="group-hover:rotate-45 transition-transform duration-500" />
          {!isCollapsed && <span className="text-xs font-medium">Configuration</span>}
        </button>

        <a 
          href="https://github.com/cognizant-ai-lab/neuro-san-benchmarking" 
          target="_blank" 
          rel="noreferrer"
          className={`flex items-center ${isCollapsed ? 'justify-center w-10 h-10' : 'gap-3 px-3 py-2'} text-zinc-600 hover:text-zinc-400 transition-colors rounded hover:bg-zinc-900`}
          title="Paper Reference"
        >
          <Github size={18} />
          {!isCollapsed && <span className="text-xs font-medium">Reference</span>}
        </a>
      </div>
    </div>
  );
};

export default Sidebar;