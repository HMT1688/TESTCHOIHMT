
import React from 'react';
import { GenerationStage } from '../types';

interface Props { stage: GenerationStage; }

const StageProgress: React.FC<Props> = ({ stage }) => {
  const stages = [
    { key: GenerationStage.THINKING, label: '전략 수립' },
    { key: GenerationStage.VERIFYING, label: '자가 검증' },
    { key: GenerationStage.PLANNING, label: '최종 기획' },
    { key: GenerationStage.GENERATING, label: '비주얼 생성' },
  ];

  const getStageStatus = (current: GenerationStage) => {
    const currentIndex = stages.findIndex(s => s.key === stage);
    const targetIndex = stages.findIndex(s => s.key === current);
    if (currentIndex > targetIndex) return 'completed';
    if (currentIndex === targetIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="w-full mt-6 px-1">
      <div className="flex items-center justify-between">
        {stages.map((s, idx) => {
          const status = getStageStatus(s.key);
          return (
            <div key={idx} className="flex flex-col items-center relative flex-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${
                status === 'completed' ? 'bg-indigo-600 text-white' : 
                status === 'active' ? 'bg-indigo-600 ring-2 ring-indigo-500/30 text-white animate-pulse' : 
                'bg-slate-700 text-slate-500'
              }`}>
                {status === 'completed' ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                ) : (
                  <span className="text-[9px] font-black">{idx + 1}</span>
                )}
              </div>
              <span className={`mt-2 text-[9px] font-bold text-center break-keep tracking-tighter ${status === 'active' ? 'text-indigo-400' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {idx < stages.length - 1 && (
                <div className={`absolute top-2.5 left-1/2 w-full h-[1px] -z-0 ${
                  status === 'completed' ? 'bg-indigo-600' : 'bg-slate-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StageProgress;
