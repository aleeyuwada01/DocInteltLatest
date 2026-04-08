import { useState, useEffect, useRef } from 'react';
import { X, FileText, Image as ImageIcon, Video, File as FileIcon, Download, Clock, AlertCircle, Loader2, CheckCircle2, Copy, Check, Sparkles, Eye, Code2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabaseClient';

export function ParsedContentModal({ fileId, files, token, onClose }: { fileId: string; files: any[]; token: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [reanalyzing, setReanalyzing] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [fileRecord, setFileRecord] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Find file in local array or fetch from DB
  const localFile = files.find((f: any) => f.id === fileId);

  // If file isn't in the local array (e.g., from a chat source in different folder), 
  // fetch it directly from DB
  useEffect(() => {
    if (localFile) {
      setFileRecord(localFile);
      return;
    }
    
    // File not in current view — fetch from DB
    let cancelled = false;
    const fetchFile = async () => {
      const { data: dbFile, error } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();
      
      if (!cancelled && !error && dbFile) {
        setFileRecord({
          id: dbFile.id,
          name: dbFile.name,
          originalName: dbFile.original_name,
          original_name: dbFile.original_name,
          mimeType: dbFile.mime_type,
          mime_type: dbFile.mime_type,
          size: dbFile.size,
          storagePath: dbFile.storage_path,
          storage_path: dbFile.storage_path,
          folderId: dbFile.folder_id,
          folder_id: dbFile.folder_id,
          parsing_status: dbFile.parsing_status,
          createdAt: dbFile.created_at,
          created_at: dbFile.created_at,
        });
      } else if (!cancelled) {
        console.error('[ParsedContentModal] File not found in DB:', fileId, error);
      }
    };
    fetchFile();
    return () => { cancelled = true; };
  }, [fileId, localFile]);

  // Fetch parsed content
  useEffect(() => {
    if (!fileRecord) return;
    let cancelled = false;

    const fetchParsed = async (attempt = 1) => {
      try {
        const { data: fileData, error } = await supabase
          .from('files')
          .select('id, original_name, parsing_status, parsed_markdown, parsed_text, parse_error, ai_description')
          .eq('id', fileRecord.id)
          .single();
        
        if (!cancelled && !error && fileData) {
          setData(fileData);
        } else if (!cancelled && !fileData && attempt === 1) {
          console.warn('[ParsedContent] First fetch returned null, retrying in 1.5s...');
          await new Promise(r => setTimeout(r, 1500));
          if (!cancelled) return fetchParsed(2);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchParsed();
    return () => { cancelled = true; };
  }, [fileRecord, token]);

  // Fetch thumbnail for images
  useEffect(() => {
    const storagePath = fileRecord?.storagePath || fileRecord?.storage_path || '';
    const mimeType = fileRecord?.mimeType || fileRecord?.mime_type || '';
    const isImg = mimeType.startsWith('image/');
    
    if (isImg && storagePath) {
      supabase.storage.from('uploads').createSignedUrl(storagePath, 300).then(({ data }) => {
        if (data?.signedUrl) setThumbnailUrl(data.signedUrl);
      });
    } else {
      setThumbnailUrl(null);
    }
  }, [fileRecord]);

  // Show loading while we wait for file record
  if (!fileRecord) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
        <div
          className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl w-full max-w-md p-12 flex flex-col items-center border border-gray-200/50 dark:border-gray-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading file...</p>
        </div>
      </div>
    );
  }

  const mimeType = fileRecord.mimeType || fileRecord.mime_type || '';
  const originalName = fileRecord.originalName || fileRecord.original_name || 'Unknown';
  const storagePath = fileRecord.storagePath || fileRecord.storage_path || '';

  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isPdf = mimeType === 'application/pdf';

  let Icon = FileIcon;
  let iconColor = 'text-gray-500 dark:text-gray-400';
  let accentGradient = 'from-blue-500/10 to-indigo-500/10 dark:from-blue-500/5 dark:to-indigo-500/5';
  if (isImage) { Icon = ImageIcon; iconColor = 'text-rose-500 dark:text-rose-400'; accentGradient = 'from-rose-500/10 to-pink-500/10 dark:from-rose-500/5 dark:to-pink-500/5'; }
  else if (isVideo) { Icon = Video; iconColor = 'text-purple-500 dark:text-purple-400'; accentGradient = 'from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5'; }
  else if (isPdf) { Icon = FileText; iconColor = 'text-red-500 dark:text-red-400'; accentGradient = 'from-red-500/10 to-orange-500/10 dark:from-red-500/5 dark:to-orange-500/5'; }
  else { Icon = FileText; iconColor = 'text-blue-500 dark:text-blue-400'; }

  const date = new Date(fileRecord.createdAt || fileRecord.created_at);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown' : format(date, 'MMM d, yyyy • h:mm a');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const extractedContent = data?.parsed_markdown || data?.parsed_text || '';
  const hasContent = extractedContent && !extractedContent.includes('Could not extract text');
  const wordCount = hasContent ? extractedContent.split(/\s+/).filter(Boolean).length : 0;
  const charCount = hasContent ? extractedContent.length : 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractedContent);
      setCopied(true);
      toast.success('Content copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = async () => {
    if (!storagePath) {
      toast.error('No storage path for this file');
      return;
    }
    const { data: signedData } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 60);
    if (signedData?.signedUrl) {
      window.open(signedData.signedUrl, '_blank');
    }
  };

  const handleReanalyze = async () => {
    if (!token || !fileRecord) return;
    setReanalyzing(true);
    try {
      const res = await fetch('/api/upload-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          originalName: originalName,
          mimeType: mimeType,
          size: fileRecord.size,
          storagePath: storagePath,
          folderId: fileRecord.folderId || fileRecord.folder_id || null,
          fileId: fileRecord.id
        }),
      });
      if (res.ok) {
        toast.success('Re-analysis started! Refresh in a moment.');
      } else {
        toast.error('Failed to start re-analysis');
      }
    } catch (err: any) {
      toast.error(`Re-analysis failed: ${err.message}`);
    } finally {
      setReanalyzing(false);
    }
  };

  const statusConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    completed: { icon: CheckCircle2, label: 'Vectorized & Searchable', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/15' },
    parsing: { icon: Loader2, label: 'Extracting...', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/15' },
    analyzing: { icon: Sparkles, label: 'AI Analyzing...', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/15' },
    embedding: { icon: Sparkles, label: 'Embedding...', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-900/15' },
    error: { icon: AlertCircle, label: 'Failed', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/15' },
    idle: { icon: Clock, label: 'Queued', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/15' },
  };
  const status = statusConfig[fileRecord?.parsing_status] || statusConfig.idle;
  const StatusIcon = status.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm md:p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1e1f20] rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] md:max-h-[90vh] flex flex-col border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Mobile Header (sticky top bar) ── */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e1f20] shrink-0 z-10" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${accentGradient} shrink-0`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <h2 className="text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{originalName}</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-1 rounded-xl bg-gray-100 dark:bg-[#282a2c] hover:bg-gray-200 dark:hover:bg-[#37393b] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-all shrink-0 ml-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Mobile scrollable content area ── */}
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">

        {/* ── Left: Document Content ── */}
        <div className="flex-1 flex flex-col md:min-h-0 bg-white dark:bg-[#1e1f20] md:border-r border-gray-100 dark:border-gray-800">
          {/* Header bar with view toggle & copy */}
          <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl bg-gradient-to-br ${accentGradient}`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] leading-tight">Document Preview</h2>
                {hasContent && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{wordCount.toLocaleString()} words • {charCount.toLocaleString()} characters</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {hasContent && (
                <>
                  {/* View mode toggle */}
                  <div className="flex bg-gray-100 dark:bg-[#282a2c] rounded-lg p-0.5 mr-1">
                    <button
                      onClick={() => setViewMode('rendered')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'rendered' ? 'bg-white dark:bg-[#37393b] text-[#1f1f1f] dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Rendered
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                        viewMode === 'raw' ? 'bg-white dark:bg-[#37393b] text-[#1f1f1f] dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      Raw
                    </button>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      copied
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-gray-50 dark:bg-[#282a2c] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#37393b]'
                    }`}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto" ref={contentRef}>
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 py-20">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading document...</p>
              </div>
            ) : !data || data.parsing_status === 'parsing' || data.parsing_status === 'analyzing' || data.parsing_status === 'embedding' || data.parsing_status === 'idle' ? (
              <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-blue-500 animate-pulse" />
                </div>
                <p className="text-lg font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">AI is analyzing your document</p>
                <p className="text-sm mt-2 max-w-md text-center text-gray-400 leading-relaxed">
                  Extracting text, performing OCR, and building searchable embeddings. 
                  This usually takes 15–60 seconds.
                </p>
                <div className="mt-6 flex items-center gap-2 text-xs text-blue-500 font-medium bg-blue-50 dark:bg-blue-900/15 px-4 py-2 rounded-full">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {data?.parsing_status === 'embedding' ? 'Building search index...' : 'Extracting content...'}
                </div>
              </div>
            ) : data.parsing_status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/15 to-orange-500/15 flex items-center justify-center mb-6">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-lg font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">Analysis failed</p>
                <p className="text-sm mt-3 text-center max-w-md text-red-500/80 bg-red-50 dark:bg-red-900/10 px-5 py-3 rounded-xl border border-red-100 dark:border-red-900/30">
                  {data.parse_error || 'An unknown error occurred while parsing.'}
                </p>
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Re-analyze
                </button>
              </div>
            ) : !hasContent ? (
              <div className="flex flex-col items-center justify-center h-full py-20 px-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center mb-6">
                  <FileText className="w-10 h-10 text-amber-400" />
                </div>
                <p className="text-lg font-semibold text-[#1f1f1f] dark:text-[#e3e3e3]">No text could be extracted</p>
                <p className="text-sm mt-2 max-w-md text-center text-gray-400 leading-relaxed">
                  This file type may not contain extractable text, or the AI parser could not process it.
                </p>
                <button
                  onClick={handleReanalyze}
                  disabled={reanalyzing}
                  className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {reanalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Re-analyze with AI
                </button>
              </div>
            ) : viewMode === 'rendered' ? (
              <div className="p-6 md:p-8">
                <div className="prose prose-blue max-w-3xl !mx-auto dark:prose-invert prose-headings:font-semibold prose-a:text-blue-500 prose-pre:bg-[#f8fafd] dark:prose-pre:bg-[#282a2c] prose-pre:rounded-xl prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700 prose-img:rounded-xl prose-p:leading-relaxed prose-li:leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/30">
                  <ReactMarkdown>{extractedContent}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="p-6 md:p-8">
                <div className="relative">
                  <button
                    onClick={handleCopy}
                    className="md:hidden absolute top-3 right-3 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <pre className="bg-[#f8fafd] dark:bg-[#131314] rounded-xl border border-gray-200 dark:border-gray-700 p-5 text-sm text-[#1f1f1f] dark:text-[#e3e3e3] overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/30 max-h-[65vh]">
                    {extractedContent}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Mobile copy bar */}
          {hasContent && (
            <div className="md:hidden flex items-center gap-2 p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1e1f20]">
              <div className="flex bg-gray-100 dark:bg-[#282a2c] rounded-lg p-0.5 flex-1">
                <button
                  onClick={() => setViewMode('rendered')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'rendered' ? 'bg-white dark:bg-[#37393b] text-[#1f1f1f] dark:text-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Rendered
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'raw' ? 'bg-white dark:bg-[#37393b] text-[#1f1f1f] dark:text-white shadow-sm' : 'text-gray-500'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Raw
                </button>
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  copied
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                    : 'bg-white dark:bg-[#282a2c] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Metadata Panel ── */}
        <div className="w-full md:w-80 lg:w-96 bg-[#f8fafd] dark:bg-[#131314] flex flex-col shrink-0 md:overflow-hidden">
          <div className="hidden md:flex items-center justify-end p-4 shrink-0 h-[65px] border-b border-transparent">
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white dark:hover:bg-[#282a2c] text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 md:pt-0 space-y-5">
            {/* Thumbnail */}
            <div className="bg-white dark:bg-[#1e1f20] rounded-xl border border-gray-200/50 dark:border-gray-800 flex items-center justify-center overflow-hidden aspect-video md:aspect-[4/3] shadow-sm relative group">
              {isImage && thumbnailUrl ? (
                <>
                  <img src={thumbnailUrl} alt={originalName} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                </>
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${accentGradient}`}>
                  <Icon className={`w-14 h-14 ${iconColor} opacity-40`} />
                  <span className="mt-3 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{(originalName.split('.').pop() || 'FILE').toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* File name */}
            <h3 className="text-base font-bold text-[#1f1f1f] dark:text-[#e3e3e3] break-words leading-snug">{originalName}</h3>

            {/* AI Status badge */}
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${status.bg} ${status.color}`}>
              <StatusIcon className={`w-4 h-4 ${fileRecord?.parsing_status === 'parsing' || fileRecord?.parsing_status === 'embedding' ? 'animate-spin' : ''}`} />
              {status.label}
            </div>

            {/* Details */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">Details</p>
              <div className="bg-white dark:bg-[#1e1f20] rounded-xl border border-gray-100 dark:border-gray-800/80 overflow-hidden text-sm divide-y divide-gray-50 dark:divide-gray-800/50">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-gray-400 dark:text-gray-500 text-xs">Type</span>
                  <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3] text-xs">{mimeType || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-gray-400 dark:text-gray-500 text-xs">Size</span>
                  <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3] text-xs">{formatBytes(fileRecord.size)}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-gray-400 dark:text-gray-500 text-xs">Created</span>
                  <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3] text-xs">{formattedDate}</span>
                </div>
                {hasContent && (
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-gray-400 dark:text-gray-500 text-xs">Words</span>
                    <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3] text-xs">{wordCount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Description */}
            {data?.ai_description && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.15em] mb-2">AI Description</p>
                <div className="bg-white dark:bg-[#1e1f20] rounded-xl border border-gray-100 dark:border-gray-800/80 p-3.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {data.ai_description.substring(0, 400)}{data.ai_description.length > 400 ? '...' : ''}
                </div>
              </div>
            )}
          </div>

          {/* Download button */}
          <div className="p-4 border-t border-gray-200/50 dark:border-gray-800 shrink-0 bg-[#f8fafd] dark:bg-[#131314]">
            <button 
              onClick={handleDownload}
              className="w-full h-11 flex items-center justify-center gap-2 bg-[#0b57d0] hover:bg-[#0842a0] dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] text-white dark:text-[#041e49] font-medium text-sm rounded-xl transition-all shadow-sm active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Download Original
            </button>
          </div>
        </div>

        </div>{/* end mobile scrollable wrapper */}
      </div>
    </div>
  );
}
