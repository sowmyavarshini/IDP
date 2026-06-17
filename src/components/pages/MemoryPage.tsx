import { useState, useEffect } from 'react';
import { Brain, RefreshCw, Database, BookOpen, TrendingUp, List, Zap } from 'lucide-react';
import { api } from '../../api/client';
import type { MemoryStore } from '../../types';
import { Spinner } from '../ui/Spinner';
import { ConfidenceBar } from '../ui/ConfidenceBar';

type Tab = 'corrections' | 'templates' | 'patterns' | 'knowledge_base' | 'confidence_history';

const TABS: { id: Tab; label: string; icon: typeof Brain }[] = [
  { id: 'corrections', label: 'Corrections', icon: Zap },
  { id: 'templates', label: 'Templates', icon: List },
  { id: 'patterns', label: 'Patterns', icon: TrendingUp },
  { id: 'knowledge_base', label: 'Knowledge Base', icon: BookOpen },
  { id: 'confidence_history', label: 'Confidence History', icon: Database },
];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TYPE_COLOR: Record<string, string> = {
  invoice: 'text-emerald-400 bg-emerald-500/10',
  contract: 'text-sky-400 bg-sky-500/10',
  resume: 'text-violet-400 bg-violet-500/10',
  report: 'text-amber-400 bg-amber-500/10',
  letter: 'text-rose-400 bg-rose-500/10',
  other: 'text-slate-400 bg-slate-500/10',
};

function TypeTag({ type }: { type: string }) {
  const cls = TYPE_COLOR[type] || TYPE_COLOR.other;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${cls}`}>{type}</span>
  );
}

export function MemoryPage() {
  const [memory, setMemory] = useState<MemoryStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('corrections');

  const load = () => {
    setLoading(true);
    api.getMemory().then(setMemory).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Memory Store</h1>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-12">Long-term knowledge accumulated from document processing and user feedback</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {memory && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {TABS.map(({ id, label, icon: Icon }) => {
            const count = (memory[id as keyof MemoryStore] as unknown[])?.length ?? 0;
            return (
              <div key={id} className={`bg-slate-900 border rounded-xl p-3 cursor-pointer transition-all
                ${tab === id ? 'border-sky-500/50 bg-sky-500/5' : 'border-slate-800 hover:border-slate-700'}`}
                onClick={() => setTab(id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
                <p className="text-xl font-bold text-white">{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
              ${tab === id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !memory ? null : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {tab === 'corrections' && (
            <>
              <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
                <p className="text-xs text-slate-400">
                  Stored when you use <strong className="text-slate-300">Edit fields</strong> to correct extracted values, or <strong className="text-slate-300">Customize extraction</strong> to add missing fields. Used in future prompts to guide the AI.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-xs text-slate-500 uppercase">
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Field</th>
                  <th className="text-left px-5 py-3">Corrected Value / Hint</th>
                  <th className="text-left px-5 py-3">Date</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/50">
                  {memory.corrections.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-10 text-slate-600">No corrections yet — approve a document with edits or use Customize extraction</td></tr>
                  ) : memory.corrections.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3"><TypeTag type={c.document_type} /></td>
                      <td className="px-5 py-3 text-slate-300 font-medium">{c.field_name.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs max-w-[240px] truncate">{c.corrected_value}</td>
                      <td className="px-5 py-3 text-slate-600 text-xs">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === 'templates' && (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Fields</th>
                <th className="text-left px-5 py-3">Uses</th>
                <th className="text-left px-5 py-3">Updated</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {memory.templates.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-600">No templates yet</td></tr>
                ) : memory.templates.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3"><TypeTag type={t.document_type} /></td>
                    <td className="px-5 py-3 text-slate-400 text-xs font-mono">{Object.keys(t.template_fields).join(', ')}</td>
                    <td className="px-5 py-3 text-white font-semibold">{t.usage_count}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs">{formatDate(t.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'patterns' && (
            <>
              <div className="px-5 py-3 border-b border-slate-800 bg-slate-800/30">
                <p className="text-xs text-slate-400">
                  Patterns are learned when you submit field corrections. Each corrected field becomes a pattern that helps future extractions for the same document type.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-xs text-slate-500 uppercase">
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Pattern</th>
                  <th className="text-left px-5 py-3">Value</th>
                  <th className="text-left px-5 py-3">Confidence</th>
                  <th className="text-left px-5 py-3">Seen</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800/50">
                  {memory.patterns.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-slate-600">No patterns yet — submit field corrections to generate patterns</td></tr>
                  ) : memory.patterns.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3"><TypeTag type={p.document_type} /></td>
                      <td className="px-5 py-3 text-slate-300">{p.pattern_name.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs font-mono truncate max-w-[150px]">{p.pattern_value}</td>
                      <td className="px-5 py-3 w-32"><ConfidenceBar value={p.confidence} /></td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{p.occurrence_count}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tab === 'knowledge_base' && (
            <div className="divide-y divide-slate-800/50">
              {memory.knowledge_base.length === 0 ? (
                <div className="text-center py-10 text-slate-600">No knowledge entries</div>
              ) : memory.knowledge_base.map(k => (
                <div key={k.id} className="px-5 py-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3 mb-1.5">
                    <TypeTag type={k.document_type} />
                    <span className="text-slate-200 font-medium text-sm">{k.field_name.replace(/_/g, ' ')}</span>
                    {k.is_required ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                        <span className="w-1 h-1 rounded-full bg-red-500 shrink-0" />
                        REQUIRED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                        optional
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs">{k.description}</p>
                  {k.examples?.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(k.examples as string[]).map((ex, i) => (
                        <span key={i} className="text-xs font-mono bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-emerald-300">{ex}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'confidence_history' && (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-800 text-xs text-slate-500 uppercase">
                <th className="text-left px-5 py-3">Type</th>
                <th className="text-left px-5 py-3">Confidence</th>
                <th className="text-left px-5 py-3">Approved</th>
                <th className="text-left px-5 py-3">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-800/50">
                {memory.confidence_history.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-10 text-slate-600">No history yet</td></tr>
                ) : memory.confidence_history.map(c => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3"><TypeTag type={c.document_type} /></td>
                    <td className="px-5 py-3 w-40"><ConfidenceBar value={c.confidence_score} /></td>
                    <td className="px-5 py-3">
                      {c.was_approved === null || c.was_approved === undefined ? (
                        <span className="text-slate-600 text-xs">—</span>
                      ) : c.was_approved ? (
                        <span className="text-emerald-400 text-xs">Yes</span>
                      ) : (
                        <span className="text-red-400 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 text-xs">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
