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
import { CompareModal } from './components/CompareModal';
import { DashboardView } from './components/DashboardView';
import { ActivityFeed } from './components/ActivityFeed';
import { TagsManager } from './components/TagsManager';
import { ShareModal } from './components/ShareModal';
import { ShareView } from './components/ShareView';
import { Toaster, toast } from 'sonner';
import { supabase, mapFile, mapFolder } from './lib/supabaseClient';
import { logActivity } from './lib/activity';
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
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [activeFileForAction, setActiveFileForAction] = useState<any>(null);

  // Upload queue
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const uploadProcessing = useRef(false);

  // Pagination
  const PAGE_SIZE = 50;
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [hasMoreFolders, setHasMoreFolders] = useState(false);
  const [totalFileCount, setTotalFileCount] = useState(0);

  // Check for public share link route
  if (window.location.pathname.startsWith('/share/')) {
    return <ShareView />;
  }

  // Event listeners for Share/Tags
  useEffect(() => {
    const handleShare = (e: any) => {
      setActiveFileForAction(e.detail);
      setIsShareOpen(true);
    };
    const handleTags = (e: any) => {
      setActiveFileForAction(e.detail);
      setIsTagsOpen(true);
    };

    window.addEventListener('docintel:share', handleShare);
    window.addEventListener('docintel:tags', handleTags);
    
    return () => {
      window.removeEventListener('docintel:share', handleShare);
      window.removeEventListener('docintel:tags', handleTags);
    }
  }, []);

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
      } else if (currentView === 'starred') {
        filesQuery = filesQuery.is('trashed_at', null).not('starred_at', 'is', null);
        // Folders don't support starring in the schema currently, so return an empty query
        foldersQuery = foldersQuery.eq('id', '00000000-0000-0000-0000-000000000000');
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

        // Add a delay to ensure Supabase fully commits the multipart resumable 
        // upload before the webhook attempts to download the file.
        // Without this, .docx (ZIP archives) may be downloaded incomplete and fail LlamaParse.
        await new Promise(r => setTimeout(r, 1500));

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
        
        try {
          const resData = await res.json();
          if (resData.file?.id) {
            logActivity(user.id, resData.file.id, 'upload_file', { originalName: current.file.name });
          }
        } catch (e) {
          // ignore json parse err
        }

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

  // ── Starred toggle ────────────────────────────────────────────────────────
  const handleToggleStar = async (fileId: string) => {
    const file = files.find((f: any) => f.id === fileId);
    if (!file) return;
    const isStarred = !!file.starred_at;
    const { error } = await supabase.from('files').update({ starred_at: isStarred ? null : new Date().toISOString() }).eq('id', fileId);
    if (!error) {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, starred_at: isStarred ? null : new Date().toISOString() } : f));
      logActivity(user.id, fileId, isStarred ? 'unstar_file' : 'star_file', { originalName: file.original_name || file.originalName || file.name });
    } else {
      toast.error(`Failed to update star: ${error.message}`);
    }
  };

  // ── Rename file ───────────────────────────────────────────────────────────
  const handleRenameFile = async (fileId: string, newName: string) => {
    const { error } = await supabase.from('files').update({ original_name: newName, name: newName }).eq('id', fileId);
    if (!error) {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, originalName: newName, original_name: newName, name: newName } : f));
      toast.success('File renamed');
      logActivity(user.id, fileId, 'rename_file', { newName });
    } else {
      toast.error('Failed to rename');
    }
  };

  // ── Move file to folder ───────────────────────────────────────────────────
  const handleMoveFile = async (fileId: string, folderId: string | null) => {
    const { error } = await supabase.from('files').update({ folder_id: folderId }).eq('id', fileId);
    if (!error) {
      toast.success(folderId ? 'File moved to folder' : 'File moved to root');
      fetchDrive();
      const targetFolderName = folderId ? folders.find(f => f.id === folderId)?.name : 'Root';
      logActivity(user.id, fileId, 'move_file', { targetFolderName });
    } else {
      toast.error('Failed to move file');
    }
  };

  // ── Track last opened for recent files ─────────────────────────────────────
  const handlePreviewFile = async (fileId: string) => {
    setPreviewFileId(fileId);
    // Update last_opened_at in background
    supabase.from('files').update({ last_opened_at: new Date().toISOString() }).eq('id', fileId).then();
  };

  // ── Drag and Drop ─────────────────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only close if leaving the container entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleUpload(droppedFiles);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const token = session?.access_token || null;
  // Expose compare opener for sidebar
  (window as any).__OPEN_COMPARE = () => setIsCompareOpen(true);

  if (!session) {
    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafd] dark:bg-[#131314]">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-r-2 border-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-4 rounded-full bg-blue-500/20 blur animate-pulse"></div>
          </div>
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
        
        <div
          className={`flex-1 overflow-hidden p-2 md:p-4 pt-0 flex flex-row gap-4 min-h-0 relative transition-all duration-200 ${isDragging ? 'ring-2 ring-[#0b57d0] ring-inset rounded-2xl' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/5 backdrop-blur-[1px] rounded-2xl pointer-events-none">
              <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white/90 dark:bg-[#1e1f20]/90 shadow-xl border-2 border-dashed border-[#0b57d0] dark:border-[#a8c7fa]">
                <div className="w-14 h-14 rounded-2xl bg-[#0b57d0]/10 dark:bg-[#a8c7fa]/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-[#0b57d0] dark:text-[#a8c7fa]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" /></svg>
                </div>
                <p className="text-sm font-semibold text-[#0b57d0] dark:text-[#a8c7fa]">Drop files to upload</p>
                <p className="text-xs text-[#9aa0a6]">Files will be uploaded to the current folder</p>
              </div>
            </div>
          )}

          <div className="flex-1 h-full bg-white dark:bg-[#1e1f20] rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-800/50 min-h-0">
            {isDriveLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-500 animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-b-2 border-r-2 border-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                  <div className="absolute inset-4 rounded-full bg-blue-500/20 blur animate-pulse"></div>
                </div>
              </div>
            ) : currentView === 'dashboard' ? (
              <DashboardView user={user} />
            ) : currentView === 'activity' ? (
              <ActivityFeed user={user} />
            ) : currentView === 'tags' ? (
              <div className="p-4 sm:p-8 flex items-start">
                <TagsManager user={user} />
              </div>
            ) : (
              <MainContent 
                files={currentView === 'starred' ? files.filter((f: any) => !!f.starred_at) : currentView === 'recent' ? [...files].sort((a: any, b: any) => new Date(b.last_opened_at || 0).getTime() - new Date(a.last_opened_at || 0).getTime()).slice(0, 30) : files} 
                folders={currentView === 'starred' || currentView === 'recent' ? [] : folders} 
                onUpload={handleUpload} 
                currentView={currentView} 
                refresh={() => fetchDrive()}
                currentFolderId={currentFolderId}
                setCurrentFolderId={setCurrentFolderId}
                token={token}
                user={user}
                onPreviewFile={handlePreviewFile}
                hasMore={currentView === 'starred' || currentView === 'recent' ? false : (hasMoreFiles || hasMoreFolders)}
                totalFileCount={totalFileCount}
                onLoadMore={() => fetchDrive(true)}
                onToggleStar={handleToggleStar}
                onRenameFile={handleRenameFile}
                onMoveFile={handleMoveFile}
                allFolders={folders}
                onCompare={() => setIsCompareOpen(true)}
              />
            )}
          </div>
          <ChatPanel token={token} user={user} onPreviewFile={handlePreviewFile} />
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
      <CompareModal isOpen={isCompareOpen} onClose={() => setIsCompareOpen(false)} files={files} token={token} />
      {previewFileId && (
        <ParsedContentModal 
          fileId={previewFileId} 
          files={files} 
          token={token} 
          onClose={() => setPreviewFileId(null)} 
        />
      )}
      {isShareOpen && activeFileForAction && (
        <ShareModal 
          file={activeFileForAction} 
          user={user} 
          onClose={() => { setIsShareOpen(false); setActiveFileForAction(null); }} 
        />
      )}

      {isTagsOpen && activeFileForAction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setIsTagsOpen(false);
            setActiveFileForAction(null);
          }
        }}>
          <TagsManager 
            user={user} 
            fileId={activeFileForAction.id} 
            onClose={() => { setIsTagsOpen(false); setActiveFileForAction(null); }} 
          />
        </div>
      )}

      <Toaster position="top-center" theme={darkMode ? 'dark' : 'light'} />
    </div>
  );
}
