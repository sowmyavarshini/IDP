import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { PipelineStatus } from '../ui/PipelineStatus';
import type { PipelineStep } from '../../types';

interface Props {
  documentId: string;
  onComplete: () => void;
  onError: (msg: string) => void;
}

export function ProcessingPage({ documentId, onComplete, onError }: Props) {
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [status, setStatus] = useState('processing');
  const [fileName, setFileName] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const poll = useCallback(async () => {
    try {
      const s = await api.getDocumentStatus(documentId);
      setStatus(s.status);
      setFileName(s.file_name);
      setSteps((s.pipeline_steps as PipelineStep[]) || []);
      if (s.status === 'completed') {
        onComplete();
        return true;
      }
      if (s.status === 'failed') {
        onError('Processing failed. Please try again.');
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }, [documentId, onComplete, onError]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let elapsed = 0;

    const run = async () => {
      const done = await poll();
      if (!done) {
        timer = setInterval(async () => {
          elapsed += 2;
          setElapsed(elapsed);
          const done = await poll();
          if (done) clearInterval(timer);
        }, 2000);
      }
    };
    run();
    return () => clearInterval(timer);
  }, [poll]);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 mb-4">
            <Loader2 className="w-7 h-7 text-sky-400 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-1">Processing Document</h2>
          {fileName && <p className="text-slate-500 text-sm truncate">{fileName}</p>}
          <p className="text-slate-600 text-xs mt-2 flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3" />
            Elapsed: {formatElapsed(elapsed)}
          </p>
        </div>

        {/* Pipeline steps */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <PipelineStatus steps={steps} isProcessing={status === 'processing'} />
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          This page auto-refreshes every 2 seconds
        </p>
      </div>
    </div>
  );
}
