import { useState, useEffect } from 'react';
import { Share2, Link, Copy, X, Lock, Check, Globe } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

interface ShareModalProps {
  file: any;
  user: any;
  onClose: () => void;
}

export function ShareModal({ file, user, onClose }: ShareModalProps) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, [file.id]);

  const loadLinks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('share_links')
      .select('*')
      .eq('file_id', file.id)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setLinks(data || []);
    setLoading(false);
  };

  const createLink = async () => {
    const { data, error } = await supabase
      .from('share_links')
      .insert({
        file_id: file.id,
        owner_id: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create share link');
      return;
    }

    setLinks(prev => [data, ...prev]);
    toast.success('Share link generated');
  };

  const deleteLink = async (id: string) => {
    await supabase.from('share_links').delete().eq('id', id);
    setLinks(prev => prev.filter(l => l.id !== id));
    toast.success('Link revoked');
  };

  const copyToClipboard = async (token: string, id: string) => {
    const url = `${window.location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1e1f20] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-500" />
            Share "{file.name}"
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-[#282a2c] rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <button
            onClick={createLink}
            className="w-full py-3 bg-[#f8fafd] hover:bg-[#e8f0fe] dark:bg-[#282a2c] dark:hover:bg-[#37393b] text-[#0b57d0] dark:text-[#a8c7fa] rounded-xl font-medium flex items-center justify-center gap-2 transition-colors mb-6 border border-blue-100 dark:border-blue-900/30"
          >
            <Link className="w-4 h-4" />
            Generate New Share Link
          </button>

          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <Globe className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active share links.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Active Links</h3>
              {links.map((link) => (
                <div key={link.id} className="bg-gray-50 dark:bg-[#131314] rounded-xl p-3 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">
                      {window.location.origin}/share/{link.token.substring(0, 8)}...
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Views: {link.access_count || 0} • Created {new Date(link.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyToClipboard(link.token, link.id)}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-[#282a2c] rounded-lg transition-colors text-gray-600 dark:text-gray-400"
                      title="Copy Link"
                    >
                      {copiedId === link.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
                      title="Revoke Link"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
