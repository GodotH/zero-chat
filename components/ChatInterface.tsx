import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import MakerVisualizer from './MakerVisualizer';
import { User, Bot, Terminal, Globe, Cpu } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  isMakerMode: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isMakerMode }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
           <Cpu size={64} className="mb-4 text-zinc-700" />
           <p className="font-mono text-sm">INITIALIZED: ZERO-CHAT [MAKER-COMPATIBLE]</p>
           <p className="font-mono text-xs mt-2">READY FOR DECOMPOSITION</p>
        </div>
      )}
      
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          
          {/* Avatar */}
          <div className={`
            w-8 h-8 rounded-none flex items-center justify-center shrink-0 border
            ${msg.role === 'user' 
              ? 'bg-zinc-800 border-zinc-600 text-zinc-300' 
              : 'bg-emerald-950 border-emerald-700/50 text-emerald-400'
            }
          `}>
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>

          {/* Bubble */}
          <div className={`
            max-w-[85%] rounded px-4 py-3 text-sm leading-relaxed
            ${msg.role === 'user' 
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' 
              : 'bg-transparent text-zinc-300'
            }
          `}>
             <div className="prose prose-invert prose-sm max-w-none">
                {msg.type === 'maker-process' && msg.makerData ? (
                  <MakerVisualizer data={msg.makerData} />
                ) : (
                  <>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {/* Render grounding metadata links if available */}
                    {msg.content.includes("http") && (
                       // Simple heuristic if links aren't formatted by markdown
                       <div className="mt-2 flex gap-2 flex-wrap">
                          {/* Grounding chunks would be processed here in a real grounding implementation */}
                       </div>
                    )}
                  </>
                )}
             </div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default ChatInterface;