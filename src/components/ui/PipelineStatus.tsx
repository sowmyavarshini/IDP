import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import type { PipelineStep } from '../../types';

const ORDERED_STEPS = [
  'Preprocessing',
  'Classification',
  'Memory Retrieval',
  'Domain Knowledge (RAG)',
  'Field Extraction',
  'Validation & Confidence Scoring',
  'Final Output',
];

interface Props {
  steps: PipelineStep[];
  isProcessing?: boolean;
}

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-400 shrink-0" />;
    case 'running':
      return <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />;
    default:
      return <Circle className="w-5 h-5 text-slate-700 shrink-0" />;
  }
}

export function PipelineStatus({ steps, isProcessing }: Props) {
  const stepMap: Record<string, PipelineStep> = {};
  for (const s of steps) stepMap[s.name] = s;

  return (
    <div className="space-y-1">
      {ORDERED_STEPS.map((name, idx) => {
        const step = stepMap[name];
        const status: PipelineStep['status'] = step?.status ?? (isProcessing && idx === steps.length ? 'running' : 'pending');
        return (
          <div key={name} className="flex items-start gap-3 group">
            {/* Connector line */}
            <div className="flex flex-col items-center">
              <StepIcon status={status} />
              {idx < ORDERED_STEPS.length - 1 && (
                <div className={`w-px flex-1 mt-1 mb-1 min-h-[16px] ${status === 'completed' ? 'bg-emerald-500/30' : 'bg-slate-700/50'}`} />
              )}
            </div>
            <div className="pb-3 min-w-0 flex-1">
              <p className={`text-sm font-medium leading-none ${
                status === 'completed' ? 'text-slate-200' :
                status === 'failed' ? 'text-red-400' :
                status === 'running' ? 'text-sky-300' : 'text-slate-600'
              }`}>{name}</p>
              {step?.output && (
                <p className="text-xs text-slate-500 mt-1 truncate">{step.output}</p>
              )}
              {step?.error && (
                <p className="text-xs text-red-400 mt-1 truncate">{step.error}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
