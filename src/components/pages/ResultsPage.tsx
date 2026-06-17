import { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp, Edit3,
  Loader2, ArrowLeft, FileText, Plus, Trash2, Wand2
} from 'lucide-react';
import { api } from '../../api/client';
import type { DocumentResult, FieldStatus } from '../../types';
import { JsonViewer } from '../ui/JsonViewer';
import { ConfidenceBar } from '../ui/ConfidenceBar';
import { Badge, statusVariant } from '../ui/Badge';
import { PipelineStatus } from '../ui/PipelineStatus';
import { Spinner } from '../ui/Spinner';

interface Props {
  documentId: string;
  onBack: () => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Invoice', contract: 'Contract', resume: 'Resume / CV',
  report: 'Report', letter: 'Letter', form: 'Form', receipt: 'Receipt',
  claims_document: 'Claims Document', medical_bill: 'Medical Bill',
  medical_report: 'Medical Report', other: 'Other',
};

const STATUS_CONFIG: Record<FieldStatus, { label: string; dot: string; text: string }> = {
  required_extracted: { label: 'REQUIRED', dot: 'bg-emerald-500', text: 'text-emerald-400' },
  required_missing:   { label: 'REQUIRED', dot: 'bg-red-500',     text: 'text-red-400'     },
  optional_extracted: { label: 'optional',  dot: 'bg-slate-500',   text: 'text-slate-500'   },
  optional_missing:   { label: 'optional',  dot: 'bg-slate-700',   text: 'text-slate-600'   },
};

export function ResultsPage({ documentId, onBack }: Props) {
  const [doc, setDoc] = useState<DocumentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [showPipeline, setShowPipeline] = useState(true);

  // Feedback state
  const [editMode, setEditMode] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  // Customize (missing fields) state
  const [customizing, setCustomizing] = useState(false);
  const [customFields, setCustomFields] = useState<Array<{ id: number; name: string; hint: string }>>([
    { id: Date.now(), name: '', hint: '' },
  ]);

  useEffect(() => {
    api.getDocument(documentId)
      .then(setDoc)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [documentId]);

  const submitFeedback = async (type: 'approved' | 'rejected' | 'edited') => {
    if (!doc) return;
    setSubmitting(true);
    try {
      await api.submitFeedback(doc.id, type, type === 'edited' ? corrections : {});
      setDoc(prev => prev ? { ...prev, user_feedback: type } : prev);
      setFeedbackDone(true);
      setEditMode(false);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const submitCustomFields = async () => {
    if (!doc) return;
    const valid = customFields.filter(r => r.name.trim());
    if (!valid.length) return;
    const built: Record<string, string> = {};
    valid.forEach(r => {
      built[r.name.trim()] = r.hint.trim() ? `REQUIRED: ${r.hint.trim()}` : 'REQUIRED';
    });
    setSubmitting(true);
    try {
      await api.submitFeedback(doc.id, 'edited', built);
      setDoc(prev => prev ? { ...prev, user_feedback: 'edited' } : prev);
      setFeedbackDone(true);
      setCustomizing(false);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const addCustomField = () =>
    setCustomFields(prev => [...prev, { id: Date.now(), name: '', hint: '' }]);

  const removeCustomField = (id: number) =>
    setCustomFields(prev => prev.filter(r => r.id !== id));

  const updateCustomField = (id: number, key: 'name' | 'hint', val: string) =>
    setCustomFields(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="lg" />
    </div>
  );

  if (error || !doc) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-red-400">{error || 'Document not found'}</p>
      <button onClick={onBack} className="text-sky-400 text-sm hover:underline">Go back</button>
    </div>
  );

  const fields = doc.extracted_fields || {};
  const validation = doc.validation_results || { field_scores: {}, missing_required: [], warnings: [] };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-slate-400 text-sm truncate">{doc.file_name}</span>
      </div>

      {/* Header card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-lg leading-tight">{doc.file_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                {doc.document_type && (
                  <Badge variant="info">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</Badge>
                )}
                {doc.user_feedback && (
                  <Badge variant={doc.user_feedback === 'approved' ? 'success' : doc.user_feedback === 'rejected' ? 'error' : 'warning'}>
                    {doc.user_feedback}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {doc.confidence_score !== undefined && (
            <div className="shrink-0">
              {/* Overall score badge */}
              <div className="flex items-center gap-3 mb-3">
                <div className="text-center">
                  <div className={`text-3xl font-bold tabular-nums ${
                    doc.confidence_score >= 0.75 ? 'text-emerald-400' :
                    doc.confidence_score >= 0.50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {Math.round(doc.confidence_score * 100)}%
                  </div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Final Score</p>
                </div>
              </div>
              {/* 4-component breakdown */}
              {(() => {
                const sb = (doc.validation_results as Record<string, unknown>)?.score_breakdown as Record<string, number> | undefined;
                if (!sb) return (
                  <div className="w-40">
                    <ConfidenceBar value={doc.confidence_score} />
                  </div>
                );
                const rows: Array<{ key: string; label: string; weight: string; color: string }> = [
                  { key: 'ocr',        label: 'OCR',        weight: '25%', color: 'bg-sky-500' },
                  { key: 'retrieval',  label: 'Retrieval',  weight: '25%', color: 'bg-violet-500' },
                  { key: 'grounding',  label: 'Grounding',  weight: '30%', color: 'bg-amber-500' },
                  { key: 'validation', label: 'Validation', weight: '20%', color: 'bg-emerald-500' },
                ];
                return (
                  <div className="space-y-1.5 min-w-[160px]">
                    {rows.map(r => {
                      const val = sb[r.key] ?? 0;
                      return (
                        <div key={r.key} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 w-16 shrink-0">{r.label} <span className="text-slate-700">×{r.weight}</span></span>
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${r.color} rounded-full transition-all`} style={{ width: `${val * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-400 w-7 text-right tabular-nums">{Math.round(val * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Validation warnings */}
        {validation.warnings?.length > 0 && (
          <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-300">{validation.warnings.join(' — ')}</div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Extracted fields */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Extracted Fields</h2>
              {!doc.user_feedback && !feedbackDone && (
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {editMode ? 'Cancel editing' : 'Edit fields'}
                </button>
              )}
            </div>

            {/* Status summary pills */}
            {(() => {
              const fs = validation.field_status || {};
              const counts = {
                req_ok:  Object.values(fs).filter(s => s === 'required_extracted').length,
                req_miss: Object.values(fs).filter(s => s === 'required_missing').length,
                opt_ok:  Object.values(fs).filter(s => s === 'optional_extracted').length,
                opt_miss: Object.values(fs).filter(s => s === 'optional_missing').length,
              };
              const any = Object.values(counts).some(v => v > 0);
              if (!any) return null;
              return (
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-800">
                  {counts.req_ok > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {counts.req_ok} required extracted
                    </span>
                  )}
                  {counts.req_miss > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                      {counts.req_miss} required missing
                    </span>
                  )}
                  {counts.opt_ok > 0 && (
                    <span className="flex items-center gap-1.5 text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-1 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                      {counts.opt_ok} optional extracted
                    </span>
                  )}
                  {counts.opt_miss > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-600 px-1 py-1 rounded-lg">
                      {counts.opt_miss} optional missing
                    </span>
                  )}
                </div>
              );
            })()}

            {Object.keys(fields).length === 0 ? (
              <p className="text-slate-600 text-sm">No fields extracted.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(fields).map(([key, value]) => {
                  const status: FieldStatus = (validation.field_status?.[key] as FieldStatus) ?? (
                    (value !== null && value !== '') ? 'optional_extracted' : 'optional_missing'
                  );
                  const cfg = STATUS_CONFIG[status];
                  const isMissing = value === null || value === '' || value === undefined;
                  const isRequiredMissing = status === 'required_missing';

                  return (
                    <div key={key} className={`grid grid-cols-[200px_1fr] gap-3 items-start py-1.5 px-2 rounded-lg transition-colors
                      ${isRequiredMissing ? 'bg-red-500/5 border border-red-500/10' : ''}`}>
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-300 capitalize leading-tight">{key.replace(/_/g, ' ')}</p>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                        </div>
                      </div>
                      {editMode && !Array.isArray(value) && typeof value !== 'object' ? (
                        <input
                          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white w-full focus:outline-none focus:border-sky-500"
                          defaultValue={String(value ?? '')}
                          onChange={(e) => setCorrections(c => ({ ...c, [key]: e.target.value }))}
                        />
                      ) : (
                        <div className={`text-sm pt-0.5 ${isMissing ? 'text-slate-600 italic' : 'text-slate-200'}`}>
                          {isMissing ? (
                            <span className={isRequiredMissing ? 'text-red-400 not-italic font-medium' : ''}>
                              {isRequiredMissing ? 'Not found (required)' : 'Not found'}
                            </span>
                          ) : Array.isArray(value) ? (
                            <div className="space-y-1">
                              {(value as unknown[]).map((item, i) => (
                                <div key={i} className="bg-slate-800/60 rounded px-2 py-1 text-xs font-mono">
                                  {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                                </div>
                              ))}
                            </div>
                          ) : typeof value === 'object' ? (
                            <span className="font-mono text-xs">{JSON.stringify(value)}</span>
                          ) : String(value)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* JSON output */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Structured JSON Output</h2>
            <JsonViewer data={doc.final_output} maxHeight="350px" />
          </div>

          {/* Raw text toggle */}
          {doc.raw_text && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span>Raw extracted text</span>
                {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRaw && (
                <div className="px-6 pb-6">
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap max-h-60 overflow-auto font-mono leading-relaxed">
                    {doc.raw_text}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Pipeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowPipeline(!showPipeline)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Pipeline Steps</span>
              {showPipeline ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showPipeline && (
              <div className="px-5 pb-5">
                <PipelineStatus steps={doc.pipeline_steps || []} />
              </div>
            )}
            {!showPipeline && (
              <div className="px-5 pb-4">
                <p className="text-xs text-slate-600">{(doc.pipeline_steps || []).length} steps completed</p>
              </div>
            )}
          </div>

          {/* Feedback panel */}
          {!feedbackDone && !doc.user_feedback ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
              <h3 className="text-white font-semibold text-sm mb-1">Review Results</h3>
              <p className="text-slate-500 text-xs mb-3">Your feedback trains the system to improve future extractions.</p>

              {editMode && Object.keys(corrections).length > 0 && (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {Object.keys(corrections).length} field(s) edited
                </div>
              )}

              {/* Approve */}
              <button
                onClick={() => submitFeedback('approved')}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve
              </button>

              {/* Save corrections (only when editing) */}
              {editMode && (
                <button
                  onClick={() => submitFeedback('edited')}
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                  Save corrections
                </button>
              )}

              {/* Customize extraction */}
              <button
                onClick={() => setCustomizing(c => !c)}
                disabled={submitting}
                className={`w-full flex items-center justify-center gap-2 border text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-50
                  ${customizing
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/20 text-sky-400'}`}
              >
                <Wand2 className="w-4 h-4" />
                {customizing ? 'Hide customization' : 'Customize extraction'}
              </button>

              {/* Customize panel */}
              {customizing && (
                <div className="border border-sky-500/20 rounded-xl bg-sky-500/5 p-4 space-y-3">
                  <div>
                    <p className="text-sky-300 text-xs font-semibold mb-0.5">Add missing fields</p>
                    <p className="text-slate-500 text-xs">
                      Tell the AI what fields it should extract from <strong className="text-slate-400">{doc.document_type}</strong> documents.
                      Saved as corrections and injected into future prompts.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {customFields.map((row) => (
                      <div key={row.id} className="flex gap-2 items-start">
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            placeholder="Field name (e.g. claim_number)"
                            value={row.name}
                            onChange={(e) => updateCustomField(row.id, 'name', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                          />
                          <input
                            placeholder="Where to find it (e.g. top-right corner)"
                            value={row.hint}
                            onChange={(e) => updateCustomField(row.id, 'hint', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <button
                          onClick={() => removeCustomField(row.id)}
                          className="mt-1 p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addCustomField}
                    className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add another field
                  </button>

                  <button
                    disabled={submitting || customFields.every(r => !r.name.trim())}
                    onClick={submitCustomFields}
                    className="w-full flex items-center justify-center gap-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-semibold py-2 rounded-lg transition-all disabled:opacity-40"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save custom fields
                  </button>
                </div>
              )}

              {/* Reject */}
              <button
                onClick={() => submitFeedback('rejected')}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">Feedback recorded</span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Result marked as <strong className="text-slate-300">{doc.user_feedback || 'reviewed'}</strong>. The system will learn from this.
              </p>
            </div>
          )}

          {/* Field status breakdown */}
          {Object.keys(validation.field_status || {}).length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4">Field Status</h3>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {Object.entries(validation.field_status).map(([field, status]) => {
                  const cfg = STATUS_CONFIG[status as FieldStatus] ?? STATUS_CONFIG.optional_missing;
                  return (
                    <div key={field} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs text-slate-400 truncate capitalize">{field.replace(/_/g, ' ')}</span>
                      </div>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.text}`}>
                        {status === 'required_extracted' ? 'req ✓' :
                         status === 'required_missing'   ? 'req ✗' :
                         status === 'optional_extracted' ? 'opt ✓' : 'opt —'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
