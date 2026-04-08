/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MainContent } from './components/MainContent';
import { ChatPanel } from './components/ChatPanel';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { SettingsModal } from './components/SettingsModal';
import { StorageModal } from './components/StorageModal';
import { ParsedContentModal } from './components/ParsedContentModal';
import { UploadProgress, type UploadItem } from './components/UploadProgress';
import { Toaster, toast } from 'sonner';
import { supabase, mapFile, mapFolder } from './lib/supabaseClient';
import * as tus from 'tus-js-client';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  (window as any).__FILES = files;
  (window as any).__FOLDERS = folders;
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('drive');
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
  const [unauthView, setUnauthView] = useState<'landing' | 'auth'>('landing');

  // Upload queue
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const uploadProcessing = useRef(false);

  // Pagination
  const PAGE_SIZE = 50;
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [hasMoreFolders, setHasMoreFolders] = useState(false);
  const [totalFileCount, setTotalFileCount] = useState(0);

  // Dark mode persistence
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // ── Clear old auth storage key (one-time migration) ─────────────────────
  // Previous config used a custom storageKey 'docintel-auth-v2' which is now
  // replaced by the default Supabase key. Clean up to avoid orphaned sessions.
  useEffect(() => {
    localStorage.removeItem('docintel-auth-v2');
  }, []);

  // ── Auth State Listener (follows Supabase recommended pattern) ──────────
  // ORDER MATTERS: 1) Register listener FIRST, 2) THEN check getSession()
  useEffect(() => {
    // STEP 1: Set up the listener FIRST (catches SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        console.log('[Auth] onAuthStateChange:', event, s ? 'session present' : 'no session');

        // Update session state for every event that carries a session
        setSession(s);

        if (s?.user) {
          // Defer DB queries to avoid Supabase client deadlocks
          // (making another Supabase call inside onAuthStateChange can deadlock)
          setTimeout(() => {
            loadProfile(s);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Only wipe app state on explicit sign out — never on TOKEN_REFRESHED or transient nulls
          setUser(null);
          setFiles([]);
          setFolders([]);
          setIsLoading(false);
        }
      }
    );

    // STEP 2: THEN check for existing session in localStorage
    // This reads stored tokens, validates/refreshes them, and restores the session
    supabase.auth.getSession().then(
      ({ data: { session } }) => {
        console.log('[Auth] getSession():', session ? 'restored' : 'none');
        setSession(session);
        if (session?.user) {
          loadProfile(session);
        } else {
          setIsLoading(false);
        }
      }
    );

    // STEP 3: Cleanup on unmount
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (s: any) => {
    try {
      if (!s?.user?.id) {
        console.warn('[Auth] loadProfile called without user ID — skipping');
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', s?.user?.id || '')
        .single();

      console.log('[Auth] Profile load:', profile ? 'found' : 'not found', profileError?.message || '');
        
      if (profile) {
        setUser({ ...profile, email: s?.user?.email });
      } else {
        setUser({ id: s?.user?.id, email: s?.user?.email, username: s?.user?.email?.split('@')[0], role: 'admin' });
      }
    } catch (e: any) {
      console.error('Error loading profile:', e);
      setUser({ id: s?.user?.id, email: s?.user?.email, username: s?.user?.email?.split('@')[0], role: 'admin' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (_token: string, userData: any) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  // ── Fetch Drive (with pagination) ──────────────────────────────────────────
  const [isDriveLoading, setIsDriveLoading] = useState(false);

  const fetchDrive = useCallback(async (loadMore = false) => {
    if (!session || !user) return;

    if (!loadMore) setIsDriveLoading(true);
    try {
      const offset = loadMore ? files.length : 0;
      const folderOffset = loadMore ? folders.length : 0;

      let filesQuery = supabase.from('files').select('*', { count: 'exact' });
      let foldersQuery = supabase.from('folders').select('*', { count: 'exact' });

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
        filesQuery.order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1),
        foldersQuery.order('created_at', { ascending: false }).range(folderOffset, folderOffset + PAGE_SIZE - 1)
      ]);

      const mappedFiles = (filesRes.data || []).map(mapFile);
      const mappedFolders = (foldersRes.data || []).map(mapFolder);

      if (loadMore) {
        setFiles(prev => [...prev, ...mappedFiles]);
        setFolders(prev => [...prev, ...mappedFolders]);
      } else {
        setFiles(mappedFiles);
        setFolders(mappedFolders);
      }

      setTotalFileCount(filesRes.count || mappedFiles.length);
      setHasMoreFiles((offset + mappedFiles.length) < (filesRes.count || 0));
      setHasMoreFolders((folderOffset + mappedFolders.length) < (foldersRes.count || 0));

      // Storage
      if (!loadMore) {
        try {
          const { data: allFiles } = await supabase.from('files').select('size').is('trashed_at', null);
          const usedStorage = (allFiles || []).reduce((acc: number, f: any) => acc + (f.size || 0), 0);
          setStorage({ used: usedStorage, limit: user.storage_limit || (1 * 1024 * 1024 * 1024) });
        } catch { /* ignore */ }
      }
    } catch (error: any) {
      toast.error(`Fetch error: ${error.message}`);
    } finally {
      setIsDriveLoading(false);
    }
  }, [session, user, currentView, currentFolderId, files.length, folders.length]);

  useEffect(() => {
    if (session && user) fetchDrive();
  }, [currentView, currentFolderId, session, user]);

  // ── Upload System (tus resumable + queue) ──────────────────────────────────
  const uploadFileWithTus = (item: UploadItem): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileName = `${user.id}/${Date.now()}-${item.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
      const projectRef = (import.meta.env.VITE_SUPABASE_URL || '').replace('https://', '').split('.')[0];

      const upload = new tus.Upload(item.file, {
        endpoint: `https://${projectRef}.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: 'uploads',
          objectName: fileName,
          contentType: item.file.type,
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks
        onError: (error) => {
          console.error('[TUS] Upload error:', error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadQueue(prev => prev.map(u =>
            u.id === item.id ? { ...u, progress: pct } : u
          ));
        },
        onSuccess: () => {
          resolve(fileName);
        },
      });

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  };

  const processUploadQueue = useCallback(async () => {
    if (uploadProcessing.current) return;
    uploadProcessing.current = true;

    while (true) {
      const nextItem = uploadQueue.find(u => u.status === 'queued');
      // Re-read from state (need latest)
      let current: UploadItem | undefined;
      setUploadQueue(prev => {
        current = prev.find(u => u.status === 'queued');
        return prev;
      });
      // Small delay to let state settle
      await new Promise(r => setTimeout(r, 50));
      setUploadQueue(prev => {
        current = prev.find(u => u.status === 'queued');
        return prev;
      });
      if (!current) break;

      const itemId = current.id;

      // Mark uploading
      setUploadQueue(prev => prev.map(u =>
        u.id === itemId ? { ...u, status: 'uploading' as const, progress: 0 } : u
      ));

      try {
        // Upload via tus
        const storagePath = await uploadFileWithTus(current);

        // Mark processing
        setUploadQueue(prev => prev.map(u =>
          u.id === itemId ? { ...u, status: 'processing' as const, progress: 100 } : u
        ));

        // Trigger webhook
        const res = await fetch('/api/upload-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            originalName: current.file.name,
            mimeType: current.file.type,
            size: current.file.size,
            storagePath,
            folderId: current.folderId || currentFolderId || null,
          }),
        });

        if (!res.ok) throw new Error('Webhook failed');

        setUploadQueue(prev => prev.map(u =>
          u.id === itemId ? { ...u, status: 'done' as const } : u
        ));
      } catch (err: any) {
        setUploadQueue(prev => prev.map(u =>
          u.id === itemId ? { ...u, status: 'error' as const, error: err.message || 'Upload failed', retries: u.retries + 1 } : u
        ));
      }
    }

    uploadProcessing.current = false;
    fetchDrive(); // Refresh after queue completes
  }, [uploadQueue, session, user, currentFolderId]);

  // Process queue when new items are added
  useEffect(() => {
    const hasQueued = uploadQueue.some(u => u.status === 'queued');
    if (hasQueued && !uploadProcessing.current) {
      processUploadQueue();
    }
  }, [uploadQueue]);

  const handleUpload = (fileOrFiles: File | File[]) => {
    if (!session || !user) return;
    const fileArray = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (fileArray.length === 0) return;

    const newItems: UploadItem[] = fileArray.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'queued' as const,
      progress: 0,
      retries: 0,
      folderId: currentFolderId,
    }));

    setUploadQueue(prev => [...prev, ...newItems]);
  };

  const handleFolderUpload = async (fileList: FileList) => {
    if (!session || !user || fileList.length === 0) return;

    // Extract folder name from first file's webkitRelativePath
    const firstPath = (fileList[0] as any).webkitRelativePath || '';
    const folderName = firstPath.split('/')[0] || 'Uploaded Folder';

    // Create the folder in DB
    try {
      const { data: folder, error } = await supabase
        .from('folders')
        .insert({
          name: folderName,
          parent_id: currentFolderId || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Queue all files with the new folder ID
      const newItems: UploadItem[] = Array.from(fileList).map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: 'queued' as const,
        progress: 0,
        retries: 0,
        folderId: folder.id,
      }));

      setUploadQueue(prev => [...prev, ...newItems]);
      toast.success(`Folder "${folderName}" created — uploading ${fileList.length} files…`);
    } catch (err: any) {
      toast.error(`Failed to create folder: ${err.message}`);
    }
  };

  const handleRetryUpload = (id: string) => {
    setUploadQueue(prev => prev.map(u =>
      u.id === id ? { ...u, status: 'queued' as const, error: undefined, progress: 0 } : u
    ));
  };

  const handleCancelUpload = (id: string) => {
    setUploadQueue(prev => prev.filter(u => u.id !== id));
  };

  const handleDismissUploads = () => {
    setUploadQueue([]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const token = session?.access_token || null;

  if (!session) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafd] dark:bg-[#131314]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }
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
        onFolderUpload={handleFolderUpload}
        onFolderCreate={fetchDrive}
        currentFolderId={currentFolderId}
        token={token}
        user={user}
        onUpgrade={() => setIsStorageOpen(true)}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onSettings={() => setIsSettingsOpen(true)}
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
          onPreviewFile={setPreviewFileId}
        />
        
        <div className="flex-1 overflow-hidden p-2 md:p-4 pt-0 flex flex-row gap-4 min-h-0 relative">
          <div className="flex-1 h-full bg-white dark:bg-[#1e1f20] rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-800/50 min-h-0">
            {isDriveLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <MainContent 
                files={files} 
                folders={folders} 
                onUpload={handleUpload} 
                currentView={currentView} 
                refresh={() => fetchDrive()}
                currentFolderId={currentFolderId}
                setCurrentFolderId={setCurrentFolderId}
                token={token}
                user={user}
                onPreviewFile={setPreviewFileId}
                hasMore={hasMoreFiles || hasMoreFolders}
                totalFileCount={totalFileCount}
                onLoadMore={() => fetchDrive(true)}
              />
            )}
          </div>
          <ChatPanel token={token} user={user} onPreviewFile={setPreviewFileId} />
        </div>
      </div>

      {/* Upload Progress Panel */}
      <UploadProgress
        uploads={uploadQueue}
        onRetry={handleRetryUpload}
        onCancel={handleCancelUpload}
        onDismiss={handleDismissUploads}
      />

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
