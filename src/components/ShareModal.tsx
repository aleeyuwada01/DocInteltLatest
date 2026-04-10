import { useState, useEffect } from 'react';
import { Share2, Link as LinkIcon, Copy, X, Lock, Check, Globe, Users, UserPlus, Mail } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

interface ShareModalProps {
  file: any;
  user: any;
  token: string;
  onClose: () => void;
}

export function ShareModal({ file, user, token, onClose }: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<'internal' | 'public'>('internal');
  
  // Public links state
  const [links, setLinks] = useState<any[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Internal users state
  const [sharedUsers, setSharedUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadLinks();
    loadSharedUsers();
  }, [file.id]);

  const loadLinks = async () => {
    setLoadingLinks(true);
    const { data } = await supabase
      .from('share_links')
      .select('*')
      .eq('file_id', file.id)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setLinks(data || []);
    setLoadingLinks(false);
  };

  const loadSharedUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/share/user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ fileId: file.id, action: 'list' })
      });
      if (res.ok) {
        const data = await res.json();
        setSharedUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingUsers(false);
  };

  const createLink = async () => {
    const { data, error } = await supabase
      .from('share_links')
      .insert({ file_id: file.id, owner_id: user.id })
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

  const handleShareInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch('/api/share/user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ fileId: file.id, targetEmail: inviteEmail.trim(), action: 'add' })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share file');
      
      toast.success(data.message);
      setInviteEmail('');
      setSharedUsers(prev => [...prev, data.addedUser]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInternal = async (targetEmail: string, userId: string) => {
    try {
      const res = await fetch('/api/share/user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ fileId: file.id, targetEmail, action: 'remove' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke access');
      
      toast.success(data.message);
      setSharedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      toast.error(err.message);
    }
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setActiveTab('internal')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'internal' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <div className="flex items-center justify-center gap-2"><Users className="w-4 h-4" /> Share With Users</div>
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'public' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <div className="flex items-center justify-center gap-2"><Globe className="w-4 h-4" /> Public Links</div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'internal' ? (
            <div className="animate-fade-in">
              <form onSubmit={handleShareInternal} className="mb-6 relative">
                <div className="flex bg-gray-50 dark:bg-[#131314] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all">
                  <div className="pl-3 py-3 flex items-center text-gray-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    placeholder="Enter teammate's email..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 bg-transparent border-0 focus:ring-0 text-sm px-3 py-3 text-gray-900 dark:text-gray-100"
                    disabled={inviting}
                  />
                  <button 
                    type="submit" 
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-4 py-2 my-1 mr-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite
                  </button>
                </div>
              </form>

              {loadingUsers ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                </div>
              ) : sharedUsers.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <Lock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Only you have access to this file.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">People with Access</h3>
                  {sharedUsers.map((u) => (
                    <div key={u.id} className="bg-gray-50 dark:bg-[#131314] rounded-xl p-3 border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{u.email}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">Viewer</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeInternal(u.email, u.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors text-xs font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in">
              <button
                onClick={createLink}
                className="w-full py-3 bg-[#f8fafd] hover:bg-[#e8f0fe] dark:bg-[#282a2c] dark:hover:bg-[#37393b] text-[#0b57d0] dark:text-[#a8c7fa] rounded-xl font-medium flex items-center justify-center gap-2 transition-colors mb-6 border border-blue-100 dark:border-blue-900/30"
              >
                <LinkIcon className="w-4 h-4" />
                Generate New Share Link
              </button>

              {loadingLinks ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                </div>
              ) : links.length === 0 ? (
                <div className="text-center py-6 text-gray-400 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No active public share links.</p>
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
          )}
        </div>
      </div>
    </div>
  );
}
