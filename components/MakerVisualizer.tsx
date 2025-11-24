import React, { useEffect, useRef, useState } from 'react';
import { MakerSessionData } from '../types';
import { Check, Loader2, AlertTriangle, Play, ChevronDown, ChevronRight, Scale, XOctagon } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';

interface MakerVisualizerProps {
  data: MakerSessionData;
}

const MakerVisualizer: React.FC<MakerVisualizerProps> = ({ data }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    // Auto-scroll to bottom on new updates
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Auto-expand the current running step
    if (!data.isComplete && !data.isStopped) {
      setExpandedStep(data.currentStepIndex);
    }
  }, [data.completedSteps.length, data.status, data.currentStepIndex]);

  const toggleStep = (idx: number) => {
    setExpandedStep(expandedStep === idx ? null : idx);
  };

  return (
    <div className="w-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col my-6 font-sans">
      
      {/* Header */}
      <div className="bg-zinc-900/50 p-4 border-b border-zinc-800 flex justify-between items-center backdrop-blur-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            MAKER PROTOCOL
          </div>
          <span className="text-[10px] text-zinc-500 font-mono mt-1">
             {data.completedSteps.length} / {data.plan.length || '?'} STEPS COMPLETED
          </span>
        </div>
        
        <div className="flex items-center gap-4">
           {data.totalUsage && (
             <div className="flex flex-col items-end">
               <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Session Cost</span>
               <span className="text-xs font-mono text-yellow-500">${data.totalUsage.estimatedCost.toFixed(4)}</span>
             </div>
           )}
           <div className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest border ${
             data.isStopped ? 'bg-red-950/30 border-red-900 text-red-500' :
             data.isComplete ? 'bg-emerald-950/30 border-emerald-900 text-emerald-500' :
             'bg-blue-950/30 border-blue-900 text-blue-400'
           }`}>
              {data.isStopped ? 'TERMINATED' : data.status.toUpperCase()}
           </div>
        </div>
      </div>

      <div ref={scrollRef} className="p-4 max-h-[600px] overflow-y-auto space-y-3 custom-scrollbar">
        
        {/* Planning Phase Card */}
        <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
          <h4 className="text-[10px] uppercase text-zinc-500 font-bold mb-2 flex items-center gap-2">
            <Play size={10} /> Decomposition Plan
          </h4>
          <div className="flex flex-wrap gap-1.5">
             {data.plan.length > 0 ? data.plan.map((step, idx) => {
               const status = idx < data.currentStepIndex ? 'done' : idx === data.currentStepIndex ? 'active' : 'pending';
               return (
                 <div key={idx} className={`
                   text-[10px] px-2 py-1 rounded border font-mono flex items-center gap-1.5 transition-all
                   ${status === 'done' ? 'bg-emerald-900/20 border-emerald-900/50 text-emerald-400' : ''}
                   ${status === 'active' ? 'bg-blue-900/20 border-blue-800 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : ''}
                   ${status === 'pending' ? 'bg-zinc-900 border-zinc-800 text-zinc-600' : ''}
                 `}>
                   <span className="opacity-50">{idx+1}.</span>
                   {step.length > 25 ? step.substring(0, 25) + '...' : step}
                   {status === 'active' && !data.isStopped && !data.isComplete && <Loader2 size={8} className="animate-spin" />}
                 </div>
               );
             }) : (
               <div className="text-zinc-600 text-xs italic flex items-center gap-2">
                 <Loader2 size={12} className="animate-spin" /> Analyzing task structure...
               </div>
             )}
          </div>
        </div>

        {/* Steps List */}
        {data.completedSteps.map((stepData, idx) => (
           <div key={idx} className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/20">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => toggleStep(idx)}
              >
                 <div className="flex items-center gap-3">
                   <div className="w-5 h-5 rounded-full bg-emerald-900/50 border border-emerald-800 flex items-center justify-center text-emerald-400 text-[10px] font-mono">
                     {idx + 1}
                   </div>
                   <span className="text-xs text-zinc-300 font-mono truncate max-w-[200px] sm:max-w-md">
                     {stepData.step}
                   </span>
                 </div>
                 <div className="flex items-center gap-3">
                   {stepData.redFlags > 0 && (
                     <div className="flex items-center gap-1 text-[10px] text-red-400 bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30">
                       <AlertTriangle size={10} /> {stepData.redFlags}
                     </div>
                   )}
                   <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                      <Scale size={10} /> {stepData.candidates.length} votes
                   </div>
                   {expandedStep === idx ? <ChevronDown size={14} className="text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-600" />}
                 </div>
              </div>

              {/* Expanded Details */}
              {expandedStep === idx && (
                <div className="border-t border-zinc-800 p-4 bg-zinc-950/50 animate-in slide-in-from-top-2">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: Result */}
                      <div>
                        <h5 className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Winning Execution</h5>
                        <div className="p-3 bg-zinc-900 rounded border border-zinc-800 text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {stepData.result}
                        </div>
                      </div>

                      {/* Right: Voting Data */}
                      <div>
                        <h5 className="text-[10px] uppercase text-zinc-500 font-bold mb-2 flex justify-between">
                          <span>Candidate Consensus</span>
                          {stepData.usage && <span className="text-zinc-600">${stepData.usage.estimatedCost.toFixed(4)}</span>}
                        </h5>
                        <div className="h-32 w-full bg-zinc-900/50 rounded border border-zinc-800/50 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stepData.candidates.map((c, i) => ({ 
                              name: `C${i}`, 
                              value: i === stepData.winnerIndex ? 100 : 20 + Math.random() * 20, 
                              label: c.substring(0, 50)
                            }))}>
                               <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                  {stepData.candidates.map((entry, index) => (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={index === stepData.winnerIndex ? '#10b981' : '#3f3f46'} 
                                      opacity={index === stepData.winnerIndex ? 1 : 0.3}
                                    />
                                  ))}
                               </Bar>
                               <Tooltip 
                                  cursor={{fill: 'transparent'}}
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const dataIdx = parseInt(payload[0].payload.name.substring(1));
                                      return (
                                        <div className="bg-black border border-zinc-700 p-2 rounded shadow-xl max-w-[200px] z-50">
                                          <p className="text-[10px] text-zinc-400 mb-1 font-bold">Candidate {dataIdx}</p>
                                          <p className="text-[10px] text-zinc-300 line-clamp-4 font-mono">
                                            {stepData.candidates[dataIdx]}
                                          </p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                               />
                               <XAxis dataKey="name" tick={{fontSize: 8, fill: '#52525b'}} axisLine={false} tickLine={false} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                   </div>
                </div>
              )}
           </div>
        ))}

        {/* Current Active Step Loading State */}
        {!data.isComplete && !data.isStopped && data.plan[data.currentStepIndex] && (
           <div className="border border-blue-900/30 rounded-lg p-4 bg-blue-950/10 animate-pulse">
              <div className="flex items-center gap-3">
                 <Loader2 size={16} className="animate-spin text-blue-400" />
                 <div>
                    <div className="text-xs text-blue-200 font-mono mb-1">
                       Executing Step {data.currentStepIndex + 1}: "{data.plan[data.currentStepIndex]}"
                    </div>
                    <div className="text-[10px] text-blue-400/70 font-mono uppercase tracking-widest">
                       {data.status === 'generating_candidates' && 'Simulating futures...'}
                       {data.status === 'voting' && 'Running consensus protocol...'}
                       {data.status === 'executing' && 'Finalizing state...'}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {data.isStopped && (
          <div className="flex items-center justify-center gap-2 p-4 text-red-500 text-xs font-mono border border-red-900/30 bg-red-950/10 rounded-lg">
             <XOctagon size={14} /> EXECUTION INTERRUPTED BY USER
          </div>
        )}
      </div>
    </div>
  );
};

export default MakerVisualizer;