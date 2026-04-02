import { useState, useEffect } from 'react';
import { X, FileText, Image as ImageIcon, Video, File as FileIcon, Download, Clock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

export function ParsedContentModal({ fileId, files, token, onClose }: { fileId: string; files: any[]; token: string; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const file = files.find(f => f.id === fileId);

  useEffect(() => {
    if (!file) return;
    const fetchParsed = async () => {
      try {
        const res = await fetch(`/api/files/${file.id}/parsed`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchParsed();
  }, [file, token]);

  if (!file) return null;

  const isImage = file.mimeType?.startsWith('image/');
  const isVideo = file.mimeType?.startsWith('video/');
  const isPdf = file.mimeType === 'application/pdf';

  let Icon = FileIcon;
  let iconColor = 'text-gray-500 dark:text-gray-400';
  if (isImage) { Icon = ImageIcon; iconColor = 'text-red-500 dark:text-red-400'; }
  else if (isVideo) { Icon = Video; iconColor = 'text-red-500 dark:text-red-400'; }
  else if (isPdf) { Icon = FileText; iconColor = 'text-red-500 dark:text-red-400'; }
  else { Icon = FileText; iconColor = 'text-blue-500 dark:text-blue-400'; }

  const date = new Date(file.createdAt);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy h:mm a');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = () => {
    window.open(`/api/files/${file.id}/download`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="md:hidden absolute top-4 right-4 z-50 p-2 rounded-full bg-white/50 backdrop-blur shadow-sm text-gray-500 hover:text-gray-900 border border-gray-100">
             <X className="w-5 h-5" />
        </button>

        {/* Left Side: Document Content */}
        <div className="flex-1 flex flex-col min-h-[50vh] bg-white dark:bg-[#1e1f20] md:border-r border-gray-100 dark:border-gray-800">
          <div className="hidden md:flex items-center px-8 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <h2 className="text-xl font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] flex items-center gap-2">
              <span className="bg-[#f0f4f9] dark:bg-[#282a2c] p-2 rounded-lg"><Icon className={`w-5 h-5 ${iconColor}`} /></span>
              Document Preview
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm font-medium">Loading document...</p>
              </div>
            ) : !data || data.parsing_status === 'parsing' || data.parsing_status === 'embedding' || data.parsing_status === 'idle' ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Clock className="w-12 h-12 mb-4 opacity-50 text-blue-500" />
                <p className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">Processing Document</p>
                <p className="text-sm mt-2 max-w-sm text-center">AI is currently extracting text, doing OCR and analyzing this file. Please check back in a moment.</p>
              </div>
            ) : data.parsing_status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                <p className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">Parsing failed</p>
                <p className="text-sm mt-2 text-center max-w-sm text-red-500 bg-red-50 dark:bg-red-900/10 p-4 rounded-xl">{data.parse_error || "An unknown error occurred while parsing."}</p>
              </div>
            ) : (
              <div className="prose prose-blue max-w-3xl !mx-auto dark:prose-invert prose-headings:font-semibold prose-a:text-blue-500 prose-pre:bg-gray-50 dark:prose-pre:bg-[#282a2c] prose-img:rounded-xl">
                <ReactMarkdown>{data.parsed_markdown || data.parsed_text || '_No content extracted._'}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Metadata / Info panel */}
        <div className="w-full md:w-80 lg:w-96 bg-[#f8fafd] dark:bg-[#131314] flex flex-col shrink-0">
          <div className="hidden md:flex items-center justify-end p-4 shrink-0 h-[73px] border-b border-transparent">
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white dark:hover:bg-[#282a2c] text-gray-500 hover:text-gray-900 transition-colors shadow-sm bg-transparent border border-transparent hover:border-gray-200 dark:border-transparent dark:hover:border-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6 md:pt-0">
            <div className="bg-white dark:bg-[#1e1f20] rounded-xl border border-gray-200/50 dark:border-gray-800 flex items-center justify-center overflow-hidden mb-6 aspect-video md:aspect-square shadow-sm relative group">
              {isImage ? (
                <>
                  <img src={`/api/files/${file.id}/download`} alt={file.originalName} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#f0f4f9] to-[#e1e5ea] dark:from-[#282a2c] dark:to-[#1e1f20]">
                  <Icon className={`w-16 h-16 ${iconColor} opacity-50`} />
                  <span className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{file.originalName.split('.').pop() || 'FILE'}</span>
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-[#1f1f1f] dark:text-[#e3e3e3] break-words mb-8 px-1">{file.originalName}</h3>

            <div className="space-y-6 px-1">
              <div>
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <span className="w-4 h-px bg-gray-200 dark:bg-gray-700 inline-block"></span>
                  Document Details
                </div>
                <div className="bg-white dark:bg-[#1e1f20] rounded-xl border border-gray-100 dark:border-gray-800/80 overflow-hidden text-sm">
                  <div className="flex items-center justify-between p-3 border-b border-gray-50 dark:border-gray-800/50">
                    <span className="text-gray-500 dark:text-gray-400">File Type</span>
                    <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">{file.mimeType || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 border-b border-gray-50 dark:border-gray-800/50">
                    <span className="text-gray-500 dark:text-gray-400">File Size</span>
                    <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">{formatBytes(file.size)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="text-gray-500 dark:text-gray-400">Created</span>
                    <span className="font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">{formattedDate.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <span className="w-4 h-px bg-gray-200 dark:bg-gray-700 inline-block"></span>
                  AI Analysis
                </div>
                <div className="bg-white dark:bg-[#1e1f20] p-3 rounded-xl border border-gray-100 dark:border-gray-800/80 text-sm">
                  {file?.parsing_status === 'completed' ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> 
                      Vectorized & Searchable
                    </div>
                  ) : file?.parsing_status === 'parsing' ? (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                      <Loader2 className="w-4 h-4 animate-spin" /> 
                      Extracting Knowledge...
                    </div>
                  ) : (
                    <div className="text-gray-500">Offline</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-gray-200/50 dark:border-gray-800 shrink-0 bg-[#f8fafd] dark:bg-[#131314]">
            <button 
              onClick={handleDownload}
              className="w-full h-12 flex items-center justify-center gap-2 bg-[#0b57d0] hover:bg-[#0842a0] dark:bg-[#a8c7fa] dark:hover:bg-[#d3e3fd] text-white dark:text-[#041e49] font-medium rounded-xl transition-all shadow-sm active:scale-[0.98]"
            >
              <Download className="w-5 h-5" />
              Download Original
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
