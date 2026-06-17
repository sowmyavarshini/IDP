import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  data: unknown;
  maxHeight?: string;
}

function highlight(json: string): string {
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'text-cyan-300';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'text-sky-400 font-medium' : 'text-emerald-300';
      } else if (/true|false/.test(match)) {
        cls = 'text-violet-400';
      } else if (/null/.test(match)) {
        cls = 'text-slate-500';
      } else {
        cls = 'text-amber-300';
      }
      return `<span class="${cls}">${match}</span>`;
    });
}

export function JsonViewer({ data, maxHeight = '400px' }: Props) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const copy = () => {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <span className="text-xs text-slate-500 font-mono">JSON</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div
        className="overflow-auto p-4 font-mono text-xs leading-relaxed"
        style={{ maxHeight }}
      >
        <pre
          className="whitespace-pre-wrap break-words"
          dangerouslySetInnerHTML={{ __html: highlight(json) }}
        />
      </div>
    </div>
  );
}
