import { useState, useEffect } from 'react';
import { Upload, Clock, Brain, Settings, Menu, X, Cpu, AlertCircle } from 'lucide-react';
import { UploadPage } from './components/pages/UploadPage';
import { ProcessingPage } from './components/pages/ProcessingPage';
import { ResultsPage } from './components/pages/ResultsPage';
import { HistoryPage } from './components/pages/HistoryPage';
import { MemoryPage } from './components/pages/MemoryPage';

type Page = 'upload' | 'processing' | 'results' | 'history' | 'memory';

const NAV_ITEMS = [
  { id: 'upload' as Page, label: 'Upload', icon: Upload },
  { id: 'history' as Page, label: 'History', icon: Clock },
  { id: 'memory' as Page, label: 'Memory Store', icon: Brain },
];

export default function App() {
  const [page, setPage] = useState<Page>('upload');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${url}/api/health`)
      .then(r => r.ok ? setApiStatus('ok') : setApiStatus('error'))
      .catch(() => setApiStatus('error'));
  }, []);

  const handleDocumentUploaded = (id: string) => {
    setActiveDocId(id);
    setPage('processing');
    setSidebarOpen(false);
  };

  const handleProcessingComplete = () => {
    setPage('results');
  };

  const handleProcessingError = (msg: string) => {
    console.error(msg);
    setPage('upload');
  };

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
    if (p !== 'results') setActiveDocId(null);
  };

  const viewDocument = (id: string) => {
    setActiveDocId(id);
    setPage('results');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">AccuParse</p>
            <p className="text-xs text-slate-500 mt-0.5">LangGraph AI</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-500 hover:text-slate-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${(page === id || (id === 'upload' && page === 'processing') || (id === 'upload' && page === 'results'))
                  ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* API status */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${apiStatus === 'ok' ? 'bg-emerald-400' : apiStatus === 'error' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <span className="text-xs text-slate-500">
              {apiStatus === 'ok' ? 'API connected' : apiStatus === 'error' ? 'API offline' : 'Connecting...'}
            </span>
          </div>
          {apiStatus === 'error' && (
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Start the FastAPI backend on port 8000
            </p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-slate-200">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold text-white">AccuParse</span>
          </div>
          {apiStatus === 'error' && (
            <div className="ml-auto flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="w-3.5 h-3.5" />
              API offline
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {page === 'upload' && (
            <UploadPage onDocumentUploaded={handleDocumentUploaded} />
          )}
          {page === 'processing' && activeDocId && (
            <ProcessingPage
              documentId={activeDocId}
              onComplete={handleProcessingComplete}
              onError={handleProcessingError}
            />
          )}
          {page === 'results' && activeDocId && (
            <ResultsPage
              documentId={activeDocId}
              onBack={() => navigate('history')}
            />
          )}
          {page === 'history' && (
            <HistoryPage onViewDocument={viewDocument} />
          )}
          {page === 'memory' && (
            <MemoryPage />
          )}
        </main>
      </div>
    </div>
  );
}
