import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';
import { AppConfig, DEFAULT_CONFIG_MD } from '../types';
import { parseConfig } from '../services/configParser';

interface ConfigEditorProps {
  onConfigChange: (config: AppConfig) => void;
  initialContent: string;
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({ onConfigChange, initialContent }) => {
  const [content, setContent] = useState(initialContent);
  const [isOpen, setIsOpen] = useState(false);
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
      // Optional: Visual feedback
    } catch (e) {
      setError("Failed to parse configuration.");
    }
  };

  return (
    <div className={`
      fixed right-0 top-0 h-full bg-zinc-950 border-l border-zinc-800 transition-all duration-300 z-50 flex flex-col
      ${isOpen ? 'w-96 shadow-2xl' : 'w-12'}
    `}>
      <div 
        className="h-12 border-b border-zinc-800 flex items-center justify-center cursor-pointer hover:bg-zinc-900 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Config.md"
      >
        <Settings size={20} className={isOpen ? 'text-emerald-500' : 'text-zinc-500'} />
      </div>

      {isOpen && (
        <div className="flex-1 flex flex-col p-4 overflow-hidden animate-in slide-in-from-right duration-200">
           <div className="flex justify-between items-center mb-4">
              <h2 className="font-mono font-bold text-sm text-zinc-100">config.md</h2>
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-mono transition-colors"
              >
                <Save size={14} /> Apply
              </button>
           </div>

           {error && (
             <div className="mb-4 p-2 bg-red-900/30 border border-red-800 rounded flex items-center gap-2 text-xs text-red-300">
               <AlertCircle size={14} />
               {error}
             </div>
           )}

           <textarea
             className="flex-1 bg-zinc-900 border border-zinc-700 rounded p-3 font-mono text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
             value={content}
             onChange={(e) => setContent(e.target.value)}
             spellCheck={false}
           />
           
           <div className="mt-4 p-3 bg-zinc-900/50 rounded border border-zinc-800">
              <h3 className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Capabilities Active</h3>
              <div className="flex flex-wrap gap-2">
                 <span className="px-2 py-1 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">Gemini 3 Pro</span>
                 <span className="px-2 py-1 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">MAKER</span>
                 <span className="px-2 py-1 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">Browsing</span>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ConfigEditor;