import { useState, useEffect } from 'react';
import { FileText, Download, AlertTriangle, Image as ImageIcon, File, Loader2 } from 'lucide-react';

export function ShareView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<any>(null);
  const [signedUrl, setSignedUrl] = useState('');

  useEffect(() => {
    // Robust token extraction from /share/<token>
    const match = window.location.pathname.match(/\/share\/([a-zA-Z0-9_-]+)/);
    const token = match ? match[1] : null;

    if (!token) {
      setError('Invalid share link: No token found in URL.');
      setLoading(false);
      return;
    }

    loadSharedFile(token);
  }, []);

  const loadSharedFile = async (token: string) => {
    try {
      // Call our backend — uses service_role key server-side, so no user session needed
      const res = await fetch(`/api/search?mode=share&token=${token}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'This share link is invalid or has expired.');
        return;
      }

      setFile(data.file);
      setSignedUrl(data.signedUrl);
    } catch (e: any) {
      setError(e.message || 'An error occurred loading this file.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafd] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading shared file…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafd] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 text-center max-w-md">{error}</p>
        <a
          href="/"
          className="mt-6 text-sm font-semibold text-blue-600 hover:underline"
        >
          Go to DocIntel →
        </a>
      </div>
    );
  }

  const isImage = file?.mime_type?.startsWith('image/');
  const isPdf = file?.mime_type === 'application/pdf';

  return (
    <div className="min-h-screen bg-[#f8fafd] flex flex-col items-center p-4 sm:p-8">
      {/* Brand header */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-6 mt-4">
        <a href="/" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors">
          <span className="text-blue-600">DocIntel</span>
          <span className="text-gray-300">•</span>
          <span>Shared File</span>
        </a>
        <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded-full px-3 py-1">
          Public link
        </span>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* File header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-blue-100 rounded-xl shrink-0">
              {isImage ? (
                <ImageIcon className="w-6 h-6 text-blue-600" />
              ) : (
                <FileText className="w-6 h-6 text-blue-600" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{file.original_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Shared via DocIntel • {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={file.original_name}
              className="shrink-0 ml-4 flex items-center gap-2 px-4 py-2 bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-xl font-medium transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          )}
        </div>

        {/* Preview area */}
        <div className="p-6 bg-gray-100 min-h-[400px] flex items-center justify-center">
          {isImage && signedUrl ? (
            <img
              src={signedUrl}
              alt={file.original_name}
              className="max-w-full max-h-[600px] object-contain rounded-lg shadow-sm"
            />
          ) : isPdf && signedUrl ? (
            <iframe
              src={`${signedUrl}#toolbar=0`}
              className="w-full h-[600px] rounded-lg border border-gray-200 bg-white"
              title={file.original_name}
            />
          ) : (
            <div className="text-center text-gray-400">
              <File className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="font-medium">Preview not available for this file type.</p>
              <p className="text-sm mt-1">Use the Download button above to access this file.</p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center">
        This link was generated by DocIntel AI • <a href="/" className="hover:underline">Visit DocIntel</a>
      </p>
    </div>
  );
}
