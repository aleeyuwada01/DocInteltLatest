import { Folder, FileText, Image as ImageIcon, Video, File as FileIcon, MoreVertical, Trash2, RotateCcw, Trash, ArrowLeft, LayoutGrid, List } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState } from 'react';

export function MainContent({ files, folders, onUpload, currentView, refresh, currentFolderId, setCurrentFolderId, token, user }: any) {
  const isTrash = currentView === 'trash';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <main className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1f20] p-6 transition-colors duration-200">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {currentFolderId && !isTrash && (
            <button 
              onClick={() => setCurrentFolderId(null)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}
          <h1 className="text-[22px] font-normal text-[#1f1f1f] dark:text-[#e3e3e3]">
            {isTrash ? 'Trash' : currentFolderId ? 'Folder Contents' : 'Welcome to DocIntel'}
          </h1>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {!isTrash && (
            <>
              <button 
                onClick={async () => {
                  toast.loading('Summarizing drive...', { id: 'summarize' });
                  try {
                    const res = await fetch('/api/summarize-drive', { 
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await res.json();
                    toast.success('Summary complete', { id: 'summarize' });
                    toast(data.summary, { duration: 10000 });
                  } catch (e) {
                    toast.error('Failed to summarize drive', { id: 'summarize' });
                  }
                }}
                className="bg-white dark:bg-[#1e1f20] text-[#0b57d0] dark:text-[#a8c7fa] border border-[#747775] dark:border-[#8e918f] px-4 py-2 rounded-full text-sm font-medium hover:bg-[#f4f7fc] dark:hover:bg-[#282a2c] transition-colors"
              >
                Summarize Drive
              </button>
            </>
          )}
        </div>
      </div>

      {isTrash && (
        <div className="mb-6 p-4 bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl text-sm text-[#444746] dark:text-[#c4c7c5] italic">
          Items in trash are deleted forever after 30 days.
        </div>
      )}

      {folders.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-[#444746] dark:text-[#c4c7c5] mb-4 flex items-center gap-2">
            Folders
          </h2>
          {viewMode === 'list' && (
            <div className="flex text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 px-3">
              <div className="flex-1">Name</div>
              <div className="w-32 hidden sm:block">Owner</div>
              <div className="w-32 hidden md:block">Last modified</div>
              <div className="w-24 hidden lg:block">File size</div>
              <div className="w-8"></div>
            </div>
          )}
          <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "flex flex-col gap-1"}>
            {folders.map((folder: any) => (
              <FolderCard 
                key={folder.id} 
                folder={folder} 
                isTrash={isTrash} 
                refresh={refresh} 
                onClick={() => !isTrash && setCurrentFolderId(folder.id)}
                token={token}
                viewMode={viewMode}
                user={user}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-[#444746] dark:text-[#c4c7c5] mb-4 flex items-center gap-2">
          Files
        </h2>
        {viewMode === 'list' && files.length > 0 && (
          <div className="flex text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 px-3">
            <div className="flex-1">Name</div>
            <div className="w-32 hidden sm:block">Owner</div>
            <div className="w-32 hidden md:block">Last modified</div>
            <div className="w-24 hidden lg:block">File size</div>
            <div className="w-8"></div>
          </div>
        )}
        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" : "flex flex-col gap-1"}>
          {files.map((file: any) => (
            <FileCard key={file.id} file={file} isTrash={isTrash} refresh={refresh} token={token} viewMode={viewMode} user={user} />
          ))}
          {files.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#444746] dark:text-[#c4c7c5]">
              {isTrash ? 'Trash is empty.' : 'No files yet. Upload a document to get started.'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function FolderCard({ folder, isTrash, refresh, onClick, token, viewMode, user }: any) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = async (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      let url = '';
      let method = 'PUT';
      
      if (action === 'trash') url = `/api/folders/${folder.id}/trash`;
      if (action === 'restore') url = `/api/folders/${folder.id}/restore`;
      if (action === 'delete') { url = `/api/folders/${folder.id}`; method = 'DELETE'; }

      const res = await fetch(url, { 
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(`Folder ${action}ed`);
        refresh();
      } else {
        toast.error(`Failed to ${action} folder`);
      }
    } catch (e) {
      toast.error(`Failed to ${action} folder`);
    }
  };

  const date = new Date(folder.createdAt);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');
  const isOwner = folder.ownerId === user?.id;

  if (viewMode === 'list') {
    return (
      <div 
        onClick={onClick}
        className="relative flex items-center px-3 py-2 bg-white dark:bg-[#1e1f20] hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] border-b border-gray-100 dark:border-gray-800/50 cursor-pointer transition-colors group"
      >
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Folder className="text-[#444746] dark:text-[#c4c7c5] w-5 h-5 fill-current opacity-70 shrink-0" />
          <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{folder.name}</span>
        </div>
        <div className="w-32 text-sm text-gray-500 dark:text-gray-400 hidden sm:block truncate">{isOwner ? 'me' : 'shared'}</div>
        <div className="w-32 text-sm text-gray-500 dark:text-gray-400 hidden md:block truncate">{formattedDate}</div>
        <div className="w-24 text-sm text-gray-500 dark:text-gray-400 hidden lg:block truncate">-</div>
        <div className="w-8 flex justify-end shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
            className="text-[#444746] hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        
        {menuOpen && (
          <div className="absolute top-full right-8 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
            {isTrash ? (
              <>
                <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
                  <RotateCcw className="w-4 h-4" /> Restore
                </button>
                <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash className="w-4 h-4" /> Delete forever
                </button>
              </>
            ) : (
              <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
                <Trash2 className="w-4 h-4" /> Move to trash
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`relative flex items-center gap-3 p-3 bg-[#f0f4f9] dark:bg-[#282a2c] rounded-xl hover:bg-[#e9eef6] dark:hover:bg-[#37393b] cursor-pointer transition-colors group`}
    >
      <Folder className="text-[#444746] dark:text-[#c4c7c5] w-6 h-6 fill-current opacity-70" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{folder.name}</div>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
        className="text-[#444746] hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      
      {menuOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
          {isTrash ? (
            <>
              <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
                <RotateCcw className="w-4 h-4" /> Restore
              </button>
              <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash className="w-4 h-4" /> Delete forever
              </button>
            </>
          ) : (
            <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
              <Trash2 className="w-4 h-4" /> Move to trash
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FileCard({ file, isTrash, refresh, token, viewMode, user }: any) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isPdf = file.mimeType === 'application/pdf';
  
  let Icon = FileIcon;
  let iconColor = "text-gray-500 dark:text-gray-400";
  
  if (isImage) { Icon = ImageIcon; iconColor = "text-red-500 dark:text-red-400"; }
  else if (isVideo) { Icon = Video; iconColor = "text-red-500 dark:text-red-400"; }
  else if (isPdf) { Icon = FileText; iconColor = "text-red-500 dark:text-red-400"; }
  else { Icon = FileText; iconColor = "text-blue-500 dark:text-blue-400"; }

  const date = new Date(file.createdAt);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');
  const isOwner = file.ownerId === user?.id;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAction = async (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      let url = '';
      let method = 'PUT';
      
      if (action === 'trash') url = `/api/files/${file.id}/trash`;
      if (action === 'restore') url = `/api/files/${file.id}/restore`;
      if (action === 'delete') { url = `/api/files/${file.id}`; method = 'DELETE'; }

      const res = await fetch(url, { 
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success(`File ${action}ed`);
        refresh();
      } else {
        toast.error(`Failed to ${action} file`);
      }
    } catch (e) {
      toast.error(`Failed to ${action} file`);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/download/${file.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.originalName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error('Failed to download file');
      }
    } catch (e) {
      toast.error('Failed to download file');
    }
  };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={handleDownload}
        className="relative flex items-center px-3 py-2 bg-white dark:bg-[#1e1f20] hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] border-b border-gray-100 dark:border-gray-800/50 cursor-pointer transition-colors group"
      >
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Icon className={`w-5 h-5 ${iconColor} opacity-70 shrink-0`} />
          <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{file.originalName}</span>
        </div>
        <div className="w-32 text-sm text-gray-500 dark:text-gray-400 hidden sm:block truncate">{isOwner ? 'me' : 'shared'}</div>
        <div className="w-32 text-sm text-gray-500 dark:text-gray-400 hidden md:block truncate">{formattedDate}</div>
        <div className="w-24 text-sm text-gray-500 dark:text-gray-400 hidden lg:block truncate">{formatBytes(file.size)}</div>
        <div className="w-8 flex justify-end shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
            className="text-[#444746] hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        
        {menuOpen && (
          <div className="absolute top-full right-8 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
            {isTrash ? (
              <>
                <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
                  <RotateCcw className="w-4 h-4" /> Restore
                </button>
                <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash className="w-4 h-4" /> Delete forever
                </button>
              </>
            ) : (
              <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
                <Trash2 className="w-4 h-4" /> Move to trash
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={handleDownload}
      className={`relative flex flex-col bg-[#f0f4f9] dark:bg-[#282a2c] rounded-xl overflow-hidden hover:bg-[#e9eef6] dark:hover:bg-[#37393b] cursor-pointer transition-all group`}
    >
      <div className={`flex items-center gap-3 p-3 pb-2 flex-1 min-w-0`}>
        <Icon className={`w-5 h-5 ${iconColor} opacity-70 shrink-0`} />
        <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate flex-1">{file.originalName}</span>
        
        <button 
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
          className="text-[#444746] hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      
      {menuOpen && (
        <div className="absolute top-12 right-2 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
          {isTrash ? (
            <>
              <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
                <RotateCcw className="w-4 h-4" /> Restore
              </button>
              <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash className="w-4 h-4" /> Delete forever
              </button>
            </>
          ) : (
            <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
              <Trash2 className="w-4 h-4" /> Move to trash
            </button>
          )}
        </div>
      )}
      
      <div className="h-36 mx-3 mb-3 bg-white dark:bg-[#1e1f20] rounded-lg border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center relative overflow-hidden shrink-0">
        {isImage ? (
          <img src={`/api/files/${file.id}/download`} alt={file.originalName} className="object-cover w-full h-full" />
        ) : (
          <Icon className={`w-12 h-12 ${iconColor} opacity-20`} />
        )}
      </div>
    </div>
  );
}
