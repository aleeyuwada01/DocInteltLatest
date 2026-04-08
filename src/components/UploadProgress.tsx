import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, RotateCcw, XCircle, Upload, FolderUp, ChevronDown, ChevronUp } from 'lucide-react';

export interface UploadItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number; // 0-100
  error?: string;
  retries: number;
  folderId?: string | null;
}

interface UploadProgressProps {
  uploads: UploadItem[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onDismiss: () => void;
}

export function UploadProgress({ uploads, onRetry, onCancel, onDismiss }: UploadProgressProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (uploads.length === 0) return null;

  const total = uploads.length;
  const done = uploads.filter(u => u.status === 'done').length;
  const errors = uploads.filter(u => u.status === 'error').length;
  const inProgress = uploads.filter(u => u.status === 'uploading' || u.status === 'processing').length;
  const allDone = done + errors === total;
  const overallProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
  };

  const statusIcon = (item: UploadItem) => {
    switch (item.status) {
      case 'queued': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'uploading': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />;
      case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const statusText = (item: UploadItem) => {
    switch (item.status) {
      case 'queued': return 'Queued';
      case 'uploading': return `Uploading ${item.progress}%`;
      case 'processing': return 'Processing…';
      case 'done': return 'Complete';
      case 'error': return item.error || 'Failed';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-[90] w-80 max-w-[calc(100vw-32px)] bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/50 overflow-hidden animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#f8fafd] dark:bg-[#131314] border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <Upload className="w-4 h-4 text-[#0b57d0] dark:text-[#a8c7fa] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] truncate">
              {allDone
                ? errors > 0
                  ? `${done} uploaded, ${errors} failed`
                  : `${done} file${done !== 1 ? 's' : ''} uploaded`
                : `Uploading ${done}/${total}…`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setCollapsed(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282a2c] text-gray-400 transition-colors"
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {allDone && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#282a2c] text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      {!allDone && (
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-1 bg-[#0b57d0] dark:bg-[#a8c7fa] transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      )}

      {/* File list */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/50">
          {uploads.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#282a2c]/50 transition-colors">
              {statusIcon(item)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{item.file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] ${item.status === 'error' ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                    {statusText(item)}
                  </span>
                  <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatSize(item.file.size)}</span>
                </div>
                {/* Per-file progress bar */}
                {item.status === 'uploading' && (
                  <div className="mt-1.5 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-1 bg-[#0b57d0] dark:bg-[#a8c7fa] rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {/* Actions */}
              {item.status === 'error' && (
                <button
                  onClick={() => onRetry(item.id)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#37393b] text-amber-500 transition-colors shrink-0"
                  title="Retry"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {(item.status === 'queued') && (
                <button
                  onClick={() => onCancel(item.id)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#37393b] text-gray-400 transition-colors shrink-0"
                  title="Cancel"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Clock icon (not exported from lucide in this file)
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  );
}
