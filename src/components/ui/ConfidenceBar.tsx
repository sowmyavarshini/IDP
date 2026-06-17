interface Props {
  value: number;  // 0–1
  label?: string;
  showPercent?: boolean;
}

function colorClass(v: number) {
  if (v >= 0.8) return 'bg-emerald-500';
  if (v >= 0.6) return 'bg-amber-500';
  return 'bg-red-500';
}

export function ConfidenceBar({ value, label, showPercent = true }: Props) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      {(label || showPercent) && (
        <div className="flex justify-between text-xs text-slate-400">
          {label && <span>{label}</span>}
          {showPercent && <span className="font-mono">{pct}%</span>}
        </div>
      )}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
