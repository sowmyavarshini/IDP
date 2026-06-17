import { useState, useEffect } from 'react';
import { FileText, Trash2, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import type { DocumentResult } from '../../types';
import { Badge, statusVariant, feedbackVariant } from '../ui/Badge';
import { ConfidenceBar } from '../ui/ConfidenceBar';
import { Spinner } from '../ui/Spinner';

interface Props {
  onViewDocument: (id: string) => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Invoice', contract: 'Contract', resume: 'Resume',
  report: 'Report', letter: 'Letter', form: 'Form', receipt: 'Receipt', other: 'Other',
};

function formatDate(s?: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function HistoryPage({ onViewDocument }: Props) {
  const [docs, setDocs] = useState<DocumentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.listDocuments(50).then(setDocs).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    setDeleting(id);
    await api.deleteDocument(id).catch(() => {});
    setDocs(d => d.filter(x => x.id !== id));
    setDeleting(null);
  };

  const stats = {
    total: docs.length,
    completed: docs.filter(d => d.status === 'completed').length,
    approved: docs.filter(d => d.user_feedback === 'approved').length,
    avgConfidence: docs.filter(d => d.confidence_score).reduce((a, d) => a + (d.confidence_score ?? 0), 0) / Math.max(docs.filter(d => d.confidence_score).length, 1),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Document History</h1>
          <p className="text-slate-500 text-sm mt-1">All processed documents</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
          { label: 'Approved', value: stats.approved, color: 'text-sky-400' },
          { label: 'Avg. Confidence', value: `${Math.round(stats.avgConfidence * 100)}%`, color: 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-10 h-10 text-slate-700" />
          <p className="text-slate-500">No documents yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              onClick={() => doc.status === 'completed' && onViewDocument(doc.id)}
              className={`bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 transition-all
                ${doc.status === 'completed' ? 'hover:border-slate-600 cursor-pointer hover:bg-slate-800/60' : 'opacity-70'}`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-slate-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-200 truncate">{doc.file_name}</p>
                  <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                  {doc.document_type && (
                    <Badge variant="info">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</Badge>
                  )}
                  {doc.user_feedback && (
                    <Badge variant={feedbackVariant(doc.user_feedback)}>{doc.user_feedback}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-xs text-slate-600">{formatDate(doc.created_at)}</p>
                  {doc.confidence_score !== undefined && (
                    <div className="w-24">
                      <ConfidenceBar value={doc.confidence_score} showPercent />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {doc.status === 'completed' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewDocument(doc.id); }}
                    className="p-2 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(doc.id, e)}
                  disabled={deleting === doc.id}
                  className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === doc.id ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
