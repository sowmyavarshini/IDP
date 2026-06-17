import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';

const ACCEPTED = '.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.tiff,.bmp';
const MAX_SIZE_MB = 20;

interface Props {
  onDocumentUploaded: (id: string) => void;
}

export function UploadPage({ onDocumentUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    setError('');
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return;
    }
    setSelectedFile(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const upload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    try {
      const { document_id } = await api.uploadDocument(selectedFile);
      onDocumentUploaded(document_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const fileTypes = [
    { ext: 'PDF', color: 'text-red-400' },
    { ext: 'DOCX', color: 'text-sky-400' },
    { ext: 'TXT', color: 'text-slate-400' },
    { ext: 'PNG/JPG', color: 'text-emerald-400' },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10 max-w-xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 mb-6">
          <FileText className="w-8 h-8 text-sky-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">Intelligent Document Classifier</h1>
        <p className="text-slate-400 leading-relaxed">
          Upload any document and our LangGraph-powered AI pipeline will automatically classify, parse, and extract structured data with confidence scoring.
        </p>
      </div>

      {/* Drop zone */}
      <div className="w-full max-w-lg">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !selectedFile && inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer
            ${dragging ? 'border-sky-400 bg-sky-500/5 scale-[1.01]' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/40'}
            ${selectedFile ? 'cursor-default' : ''}`}
        >
          <input ref={inputRef} type="file" accept={ACCEPTED} onChange={onInputChange} className="hidden" />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <FileText className="w-7 h-7 text-sky-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">{selectedFile.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setError(''); }}
                className="text-xs text-slate-500 hover:text-slate-300 underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className={`w-10 h-10 transition-colors ${dragging ? 'text-sky-400' : 'text-slate-600'}`} />
              <div>
                <p className="text-slate-300 font-medium">Drop your document here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse files</p>
              </div>
              <div className="flex gap-2 mt-2">
                {fileTypes.map(({ ext, color }) => (
                  <span key={ext} className={`text-xs font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700 ${color}`}>{ext}</span>
                ))}
              </div>
              <p className="text-slate-600 text-xs">Max file size: {MAX_SIZE_MB}MB</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={upload}
          disabled={!selectedFile || uploading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-3 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              Classify Document
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Pipeline preview */}
      <div className="mt-14 w-full max-w-2xl">
        <p className="text-xs text-slate-600 text-center uppercase tracking-wider mb-6">Processing Pipeline</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {['Preprocessing', 'Classification', 'Memory Retrieval', 'RAG Context', 'Field Extraction', 'Validation', 'JSON Output'].map((step, i, arr) => (
            <div key={step} className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-400">{step}</div>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
