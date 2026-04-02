/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MainContent } from './components/MainContent';
import { ChatPanel } from './components/ChatPanel';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { StorageModal } from './components/StorageModal';
import { ParsedContentModal } from './components/ParsedContentModal';
import { Toaster, toast } from 'sonner';
import { supabase } from './lib/supabaseClient';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('drive'); // 'drive' or 'trash'
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [storage, setStorage] = useState({ used: 0, limit: 15 * 1024 * 1024 * 1024 });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  // 'landing' | 'auth' — only relevant when not logged in
  const [unauthView, setUnauthView] = useState<'landing' | 'auth'>(() =>
    localStorage.getItem('token') ? 'auth' : 'landing'
  );

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (token) {
      fetchMe();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchMe = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser(token!);
      if (error || !authUser) throw error;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
      if (profile) {
        setUser({ ...profile, email: authUser.email });
        fetchDrive();
      } else {
        handleLogout();
      }
    } catch (e) {
      handleLogout();
    }
  };

  const handleLogin = (newToken: string, userData: any) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const fetchDrive = async () => {
    if (!token || !user) return;
    setIsLoading(true);
    try {
      // Build queries based on view state
      let filesQuery = supabase.from('files').select('*');
      let foldersQuery = supabase.from('folders').select('*');

      if (currentView === 'trash') {
        filesQuery = filesQuery.not('trashed_at', 'is', null);
        foldersQuery = foldersQuery.not('trashed_at', 'is', null);
      } else {
        filesQuery = filesQuery.is('trashed_at', null);
        foldersQuery = foldersQuery.is('trashed_at', null);
        
        if (currentFolderId) {
          filesQuery = filesQuery.eq('folder_id', currentFolderId);
          foldersQuery = foldersQuery.eq('parent_id', currentFolderId);
        } else {
          filesQuery = filesQuery.is('folder_id', null);
          foldersQuery = foldersQuery.is('parent_id', null);
        }
      }

      const [filesRes, foldersRes] = await Promise.all([
        filesQuery.order('created_at', { ascending: false }),
        foldersQuery.order('created_at', { ascending: false })
      ]);

      setFiles(filesRes.data || []);
      setFolders(foldersRes.data || []);
      
      // Calculate active storage manually from all active files for user
      const { data: allFiles } = await supabase.from('files').select('size').is('trashed_at', null);
      const usedStorage = (allFiles || []).reduce((acc: number, f: any) => acc + (f.size || 0), 0);
      setStorage({ used: usedStorage, limit: user.storage_limit || (1 * 1024 * 1024 * 1024) });
    } catch (error) {
      console.error('Error fetching drive:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDrive();
  }, [currentView, currentFolderId, token]);

  const handleUpload = async (file: File) => {
    if (!file || !token || !user) return;
    toast.loading(`Uploading ${file.name}...`, { id: 'upload' });
    try {
      // 1. Direct upload to Supabase to bypass Vercel 4.5MB payload limit
      const filePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Notify backend to track in DB and begin parsing queue
      const res = await fetch('/api/upload-webhook', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          storagePath: uploadData.path,
          folderId: currentFolderId || null
        }),
      });

      if (res.ok) {
        fetchDrive();
        toast.success(`${file.name} uploaded — parsing in background…`, { id: 'upload' });
      } else {
        const err = await res.json();
        toast.error(`Upload failed: ${err.error}`, { id: 'upload' });
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`, { id: 'upload' });
    }
  };



  if (!token) {
    if (unauthView === 'landing') {
      return (
        <>
          <LandingPage
            onGetStarted={() => setUnauthView('auth')}
            onSignIn={() => setUnauthView('auth')}
          />
          <Toaster position="top-center" theme={darkMode ? 'dark' : 'light'} />
        </>
      );
    }
    return (
      <>
        <Login onLogin={handleLogin} onBack={() => setUnauthView('landing')} />
        <Toaster position="top-center" theme={darkMode ? 'dark' : 'light'} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8fafd] dark:bg-[#131314] text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={(view: string) => { setCurrentView(view); setCurrentFolderId(null); }} 
        storage={storage} 
        onUpload={handleUpload} 
        onFolderCreate={fetchDrive}
        currentFolderId={currentFolderId}
        token={token}
        onUpgrade={() => setIsStorageOpen(true)}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-[#f8fafd] dark:bg-[#131314] transition-colors duration-200">
        <Topbar 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          user={user} 
          onLogout={handleLogout}
          onSettings={() => setIsSettingsOpen(true)}
          token={token}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />
        
        <div className="flex-1 overflow-hidden p-2 md:p-4 pt-0 flex flex-row gap-4 min-h-0 relative">
          <div className="flex-1 h-full bg-white dark:bg-[#1e1f20] rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-800/50 min-h-0">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <MainContent 
                files={files} 
                folders={folders} 
                onUpload={handleUpload} 
                currentView={currentView} 
                refresh={fetchDrive}
                currentFolderId={currentFolderId}
                setCurrentFolderId={setCurrentFolderId}
                token={token}
                user={user}
                onPreviewFile={setPreviewFileId}
              />
            )}
          </div>
          <ChatPanel token={token} onPreviewFile={setPreviewFileId} />
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} token={token} user={user} />
      <StorageModal isOpen={isStorageOpen} onClose={() => setIsStorageOpen(false)} token={token} />
      {previewFileId && (
        <ParsedContentModal 
          fileId={previewFileId} 
          files={files} 
          token={token} 
          onClose={() => setPreviewFileId(null)} 
        />
      )}
      <Toaster position="top-center" theme={darkMode ? 'dark' : 'light'} />
    </div>
  );
}
