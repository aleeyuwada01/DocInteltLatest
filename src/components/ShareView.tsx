import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FileText, Download, AlertTriangle, Image as ImageIcon, File, Loader2 } from 'lucide-react';

export function ShareView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [file, setFile] = useState<any>(null);
  
  useEffect(() => {
    // Extract token from URL path: /share/:token
    const path = window.location.pathname;
    const token = path.split('/share/')[1];
    
    if (token) {
      loadSharedFile(token);
    } else {
      setError('Invalid share link');
      setLoading(false);
    }
  }, []);

  const loadSharedFile = async (token: string) => {
    try {
      // 1. Validate token and get file_id
      const { data: link, error: linkError } = await supabase
        .from('share_links')
        .select('file_id, is_active')
        .eq('token', token)
        .single();

      if (linkError || !link || !link.is_active) {
        setError('This share link has expired or is invalid.');
        return;
      }

      // 2. Fetch file metadata (temporarily bypassing RLS to just read the shared document metadata)
      // Since this is a public share link, we use a public RPC or a secure backend call ideally. 
      // For this app, we will rely on a supabase RPC that permits reading files linked to an active share token.
      const { data: fileData, error: fileError } = await supabase.rpc('get_shared_file', { share_token: token });
      
      if (fileError || !fileData) {
        setError('Could not access the shared file.');
      } else {
        setFile(fileData);
        // Increment access count
        supabase.rpc('increment_share_access', { share_token: token }).then();
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafd] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8fafd] flex flex-col items-center justify-center p-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 text-center max-w-md">{error}</p>
      </div>
    );
  }

  const [publicUrl, setPublicUrl] = useState<string>('');

  useEffect(() => {
    if (file?.storage_path) {
      // Since the bucket is private, we need a signed URL even for the share page.
      // We grant a 2-hour window for viewing.
      supabase.storage.from('uploads')
        .createSignedUrl(file.storage_path, 7200)
        .then(({ data }) => {
          if (data?.signedUrl) setPublicUrl(data.signedUrl);
        });
    }
  }, [file]);

  const isImage = file?.mime_type?.startsWith('image/');

  return (
    <div className="min-h-screen bg-[#f8fafd] dark:bg-[#131314] flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl bg-white dark:bg-[#1e1f20] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden mt-10">
        
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#1b1b1b]">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              {isImage ? <ImageIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" /> : <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1f1f1f] dark:text-[#e3e3e3]">{file.original_name}</h1>
              <p className="text-sm text-gray-500 mt-1">Shared via DocIntel • {Math.round(file.size / 1024)} KB</p>
            </div>
          </div>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex items-center gap-2 px-4 py-2 bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-xl font-medium transition-colors"
          >
            <Download className="w-4 h-4" /> Download
          </a>
        </div>

        <div className="p-6 bg-gray-100 dark:bg-[#131314] min-h-[400px] flex items-center justify-center">
          {isImage && publicUrl ? (
            <img src={publicUrl} alt={file.original_name} className="max-w-full max-h-[600px] object-contain rounded-lg shadow-sm" />
          ) : file.mime_type === 'application/pdf' && publicUrl ? (
            <iframe src={`${publicUrl}#toolbar=0`} className="w-full h-[600px] rounded-lg border border-gray-200" title={file.original_name} />
          ) : (
            <div className="text-center text-gray-500">
              <File className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Preview not available for this file type.</p>
              <p className="text-sm mt-2">Please download the file to view it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
