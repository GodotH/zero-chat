import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, X } from 'lucide-react';
import { AppConfig } from '../types';
import { parseConfig } from '../services/configParser';

interface ConfigEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: (config: AppConfig) => void;
  initialContent: string;
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({ isOpen, onClose, onConfigChange, initialContent }) => {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);

  // Sync internal state if prop changes (reset)
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const handleSave = () => {
    try {
      const newConfig = parseConfig(content);
      onConfigChange(newConfig);
      setError(null);
      // Optional: Visual feedback could go here
    } catch (e) {
      setError("Failed to parse configuration.");
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <div className={`
        fixed right-0 top-0 h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col w-full md:w-96
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
             <h2 className="font-mono font-bold text-sm text-zinc-100">Configuration</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col p-4 overflow-hidden">
           {error && (
             <div className="mb-4 p-2 bg-red-900/30 border border-red-800 rounded flex items-center gap-2 text-xs text-red-300 animate-in slide-in-from-top-2">
               <AlertCircle size={14} />
               {error}
             </div>
           )}

           <div className="flex-1 relative flex flex-col">
             <label className="text-[10px] uppercase font-bold text-zinc-500 mb-2">config.md</label>
             <textarea
               className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-3 font-mono text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-900/20 resize-none leading-relaxed custom-scrollbar"
               value={content}
               onChange={(e) => setContent(e.target.value)}
               spellCheck={false}
             />
           </div>
           
           <div className="mt-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <h3 className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Active Protocols</h3>
              <div className="flex flex-wrap gap-2">
                 <span className="px-2 py-1 rounded bg-black/50 text-[10px] text-zinc-400 border border-zinc-800">Gemini 3 Pro</span>
                 <span className="px-2 py-1 rounded bg-black/50 text-[10px] text-zinc-400 border border-zinc-800">MAKER Framework</span>
                 <span className="px-2 py-1 rounded bg-black/50 text-[10px] text-zinc-400 border border-zinc-800">Browsing Enabled</span>
              </div>
           </div>
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
           <button 
             onClick={handleSave}
             className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg shadow-emerald-900/20"
           >
             <Save size={16} /> Apply Configuration
           </button>
        </div>
      </div>
    </>
  );
};

export default ConfigEditor;