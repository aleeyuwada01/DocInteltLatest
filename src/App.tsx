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
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const fetchDrive = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const url = new URL('/api/drive', window.location.origin);
      url.searchParams.append('trash', (currentView === 'trash').toString());
      if (currentFolderId && currentView !== 'trash') {
        url.searchParams.append('folderId', currentFolderId);
      }

      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setFiles(data.files || []);
      setFolders(data.folders || []);
      
      const storageRes = await fetch('/api/storage', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const storageData = await storageRes.json();
      setStorage(storageData);
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
    if (!file || !token) return;

    toast.loading(`Uploading ${file.name}...`, { id: 'upload' });

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolderId) {
      formData.append('folderId', currentFolderId);
    }

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        fetchDrive();
        toast.success(`${file.name} uploaded — parsing in background…`, { id: 'upload' });
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to upload ${file.name}`, { id: 'upload' });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(`Failed to upload ${file.name}`, { id: 'upload' });
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
