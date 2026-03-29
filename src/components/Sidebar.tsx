import { Home, HardDrive, Monitor, Users, Clock, Star, AlertCircle, Trash2, Cloud, Plus, FolderPlus, FileUp, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function Sidebar({ currentView, setCurrentView, storage, onUpload, onFolderCreate, currentFolderId, token, onUpgrade }: any) {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const storagePercentage = Math.min(100, (storage.used / storage.limit) * 100);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName, parentId: currentFolderId })
      });
      if (res.ok) {
        toast.success('Folder created');
        setNewFolderName('');
        setIsCreateFolderModalOpen(false);
        onFolderCreate();
      } else {
        toast.error('Failed to create folder');
      }
    } catch (e) {
      toast.error('Failed to create folder');
    }
  };

  return (
    <aside className="w-64 bg-[#f8fafd] dark:bg-[#131314] flex flex-col h-full transition-colors duration-200">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 87.3 78" className="w-6 h-6">
              <path d="m6.6 66.85 22.35-38.7 22.35 38.7H6.6z" fill="#1ea362"/>
              <path d="m41.4 6.45 22.35 38.7h-44.7L41.4 6.45z" fill="#4285f4"/>
              <path d="M76.2 66.85 53.85 28.15 31.5 66.85h44.7z" fill="#fbbc04"/>
            </svg>
          </div>
          <span className="text-[22px] font-normal text-[#444746] dark:text-gray-200">DocIntel AI</span>
        </div>
        
        <div className="relative mb-4">
          <button 
            onClick={() => setIsNewOpen(!isNewOpen)}
            className="flex items-center gap-3 px-5 py-4 bg-white dark:bg-[#37393b] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.24)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)] hover:bg-[#f8fafd] dark:hover:bg-[#4a4c4f] transition-all w-fit group"
          >
            <Plus className="w-6 h-6 text-[#444746] dark:text-gray-200 group-hover:text-blue-600 transition-colors" />
            <span className="text-sm font-medium text-[#444746] dark:text-gray-200">New</span>
          </button>
          
          {isNewOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-2">
              <button 
                onClick={() => {
                  setIsNewOpen(false);
                  setIsCreateFolderModalOpen(true);
                }} 
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <FolderPlus className="w-4 h-4" /> New folder
              </button>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>
              <label className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <FileUp className="w-4 h-4" /> File upload
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => { 
                    const file = e.target.files?.[0];
                    if (file) {
                      onUpload(file);
                    }
                    setIsNewOpen(false); 
                  }} 
                />
              </label>
            </div>
          )}
        </div>

        <nav className="space-y-1">
          <NavItem icon={<HardDrive size={18} />} label="My Drive" active={currentView === 'drive'} onClick={() => setCurrentView('drive')} />
          <NavItem icon={<Trash2 size={18} />} label="Trash" active={currentView === 'trash'} onClick={() => setCurrentView('trash')} />
        </nav>
      </div>
      
      <div className="mt-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Storage</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-2">
          <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${storagePercentage}%` }}></div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {formatBytes(storage.used)} of {formatBytes(storage.limit)} used
        </div>
        <button 
          onClick={onUpgrade}
          className="text-sm text-blue-600 dark:text-blue-400 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-full"
        >
          Get more storage
        </button>
      </div>

      {/* Create Folder Modal */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-800/50">
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">New folder</h2>
              <button onClick={() => setIsCreateFolderModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateFolder} className="p-6">
              <input 
                type="text" 
                required
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Untitled folder"
                className="w-full px-3 py-2 bg-white dark:bg-[#1e1f20] border border-blue-500 rounded-lg text-sm text-[#1f1f1f] dark:text-[#e3e3e3] focus:outline-none focus:ring-1 focus:ring-blue-500 mb-6"
              />
              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreateFolderModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-full transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-4 py-2 rounded-r-full transition-colors ${
        active 
          ? 'bg-[#c2e7ff] dark:bg-[#004a77] text-[#001d35] dark:text-[#c2e7ff]' 
          : 'text-[#444746] dark:text-gray-300 hover:bg-[#e9eef6] dark:hover:bg-[#282a2c]'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
