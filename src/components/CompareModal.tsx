import { useState, useEffect } from 'react';
import { X, FileText, Loader2, ArrowRight, Sparkles, GitCompareArrows, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabaseClient';

export function CompareModal({
  isOpen, onClose, files, token
}: {
  isOpen: boolean;
  onClose: () => void;
  files: any[];
  token: string;
}) {
  const [fileA, setFileA] = useState<string>('');
  const [fileB, setFileB] = useState<string>('');
  const [comparison, setComparison] = useState<string>('');
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string>('');
  const [fileAMeta, setFileAMeta] = useState<any>(null);
  const [fileBMeta, setFileBMeta] = useState<any>(null);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setFileA('');
      setFileB('');
      setComparison('');
      setError('');
      setFileAMeta(null);
      setFileBMeta(null);
    }
  }, [isOpen]);

  const availableFiles = files.filter((f: any) => f.parsing_status === 'completed');

  const handleCompare = async () => {
    if (!fileA || !fileB) return;
    if (fileA === fileB) {
      setError('Please select two different files.');
      return;
    }

    setComparing(true);
    setError('');
    setComparison('');

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileIdA: fileA, fileIdB: fileB }),
      });

      const data = await res.json();
      if (res.ok) {
        setComparison(data.comparison);
        setFileAMeta(data.fileA);
        setFileBMeta(data.fileB);
      } else {
        setError(data.error || 'Comparison failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setComparing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10">
              <GitCompareArrows className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">Compare Documents</h2>
              <p className="text-xs text-[#9aa0a6]">AI-powered side-by-side comparison</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#282a2c] text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File Selection */}
        {!comparison && (
          <div className="px-6 py-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              {/* File A */}
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-2">Document A</label>
                <div className="relative">
                  <select
                    value={fileA}
                    onChange={e => setFileA(e.target.value)}
                    className="w-full appearance-none bg-[#f0f4f9] dark:bg-[#282a2c] border border-gray-200/60 dark:border-gray-700/50 rounded-xl px-4 py-2.5 pr-10 text-sm text-[#1f1f1f] dark:text-[#e3e3e3] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/30 dark:focus:ring-[#a8c7fa]/30 cursor-pointer"
                  >
                    <option value="">Select a file...</option>
                    {availableFiles.map((f: any) => (
                      <option key={f.id} value={f.id} disabled={f.id === fileB}>
                        {f.originalName || f.original_name || f.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6] pointer-events-none" />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center justify-center py-1 sm:pb-2">
                <ArrowRight className="w-5 h-5 text-[#9aa0a6] rotate-90 sm:rotate-0" />
              </div>

              {/* File B */}
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider mb-2">Document B</label>
                <div className="relative">
                  <select
                    value={fileB}
                    onChange={e => setFileB(e.target.value)}
                    className="w-full appearance-none bg-[#f0f4f9] dark:bg-[#282a2c] border border-gray-200/60 dark:border-gray-700/50 rounded-xl px-4 py-2.5 pr-10 text-sm text-[#1f1f1f] dark:text-[#e3e3e3] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/30 dark:focus:ring-[#a8c7fa]/30 cursor-pointer"
                  >
                    <option value="">Select a file...</option>
                    {availableFiles.map((f: any) => (
                      <option key={f.id} value={f.id} disabled={f.id === fileA}>
                        {f.originalName || f.original_name || f.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6] pointer-events-none" />
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              onClick={handleCompare}
              disabled={!fileA || !fileB || comparing}
              className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#0b57d0] hover:bg-[#0842a0] dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] text-white dark:text-[#041e49] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {comparing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Compare with AI
                </>
              )}
            </button>
          </div>
        )}

        {/* Comparison Results */}
        <div className="flex-1 overflow-y-auto">
          {comparing && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-blue-500/15 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">AI is comparing your documents...</p>
              <p className="text-xs text-[#9aa0a6] mt-1">This usually takes 10–30 seconds</p>
            </div>
          )}

          {comparison && (
            <div className="p-6">
              {/* File badges */}
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <span className="flex items-center gap-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/15 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
                  <FileText className="w-3.5 h-3.5" />
                  {fileAMeta?.name || 'Document A'}
                </span>
                <span className="text-xs text-[#9aa0a6]">vs</span>
                <span className="flex items-center gap-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-900/15 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
                  <FileText className="w-3.5 h-3.5" />
                  {fileBMeta?.name || 'Document B'}
                </span>
              </div>

              {/* Rendered comparison */}
              <div className="prose prose-blue max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-li:leading-relaxed text-sm">
                <ReactMarkdown>{comparison}</ReactMarkdown>
              </div>

              {/* Compare again */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => { setComparison(''); setFileAMeta(null); setFileBMeta(null); }}
                  className="flex items-center gap-2 text-sm text-[#0b57d0] dark:text-[#a8c7fa] hover:underline font-medium"
                >
                  <GitCompareArrows className="w-4 h-4" />
                  Compare different documents
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
