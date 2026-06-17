import { type ReactNode } from 'react';

type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'processing';

const variantStyles: Record<Variant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  error: 'bg-red-500/15 text-red-400 border border-red-500/30',
  info: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  neutral: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  processing: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
};

interface Props {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function statusVariant(status: string): Variant {
  switch (status) {
    case 'completed': return 'success';
    case 'processing': return 'processing';
    case 'failed': return 'error';
    case 'pending': return 'warning';
    default: return 'neutral';
  }
}

export function feedbackVariant(feedback: string): Variant {
  switch (feedback) {
    case 'approved': return 'success';
    case 'edited': return 'warning';
    case 'rejected': return 'error';
    default: return 'neutral';
  }
}
