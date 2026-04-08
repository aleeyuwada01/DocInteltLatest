import { Folder, FileText, Image as ImageIcon, Video, File as FileIcon, MoreVertical, Trash2, RotateCcw, Trash, ArrowLeft, LayoutGrid, List, X, Loader2, CheckCircle2, AlertCircle, Clock, Download, Star, Pencil, FolderInput, GitCompareArrows } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabaseClient';

// ─── Parsing Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (!status || status === 'idle') return null;

  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    parsing: {
      label: 'Parsing…',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    embedding: {
      label: 'Embedding…',
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    completed: {
      label: 'Parsed',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    error: {
      label: 'Parse Error',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}


// ─── Main Content ────────────────────────────────────────────────────────────
export function MainContent({ files, folders, onUpload, currentView, refresh, currentFolderId, setCurrentFolderId, token, user, onPreviewFile, hasMore, totalFileCount, onLoadMore, onToggleStar, onRenameFile, onMoveFile, allFolders, onCompare }: any) {
  const isTrash = currentView === 'trash';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Poll parsing status for files that are not yet complete
  useEffect(() => {
    const pending = files.filter((f: any) => f.parsing_status === 'parsing' || f.parsing_status === 'embedding' || f.parsing_status === 'idle');
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      for (const f of pending) {
        try {
          const { data, error } = await supabase.from('files').select('parsing_status').eq('id', f.id).single();
          if (!error && data && data.parsing_status !== f.parsing_status) {
            updated = true;
          }
        } catch { /* ignore */ }
      }
      if (updated) refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [files, token, refresh]);

  return (
    <main className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1f20] p-6 transition-colors duration-200">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {currentFolderId && !isTrash && (
            <button
              onClick={() => setCurrentFolderId(null)}
              className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}
          <h1 className="text-base sm:text-lg md:text-[22px] font-normal text-[#1f1f1f] dark:text-[#e3e3e3] truncate">
            {isTrash ? 'Trash' : currentView === 'starred' ? '⭐ Starred Files' : currentView === 'recent' ? '🕐 Recent Files' : currentFolderId ? 'Folder Contents' : 'Welcome to DocIntel'}
          </h1>
        </div>

        <div className="flex gap-2 sm:gap-3 items-center shrink-0">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 sm:p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 sm:p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 sm:p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {!isTrash && (
            <button
              onClick={async () => {
                toast.loading('Summarizing drive...', { id: 'summarize' });
                try {
                  const res = await fetch('/api/summarize-drive', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const data = await res.json();
                  toast.success('Summary complete', { id: 'summarize' });
                  toast(data.summary, { duration: 10000 });
                } catch (e) {
                  toast.error('Failed to summarize drive', { id: 'summarize' });
                }
              }}
              className="bg-white dark:bg-[#1e1f20] text-[#0b57d0] dark:text-[#a8c7fa] border border-[#747775] dark:border-[#8e918f] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium hover:bg-[#f4f7fc] dark:hover:bg-[#282a2c] transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">Summarize Drive</span>
              <span className="sm:hidden">Summarize</span>
            </button>
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
          <h2 className="text-sm font-medium text-[#444746] dark:text-[#c4c7c5] mb-4">Folders</h2>
          {viewMode === 'list' && (
            <div className="flex text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 px-3">
              <div className="flex-1">Name</div>
              <div className="w-32 hidden sm:block">Owner</div>
              <div className="w-32 hidden md:block">Last modified</div>
              <div className="w-24 hidden lg:block">File size</div>
              <div className="w-8"></div>
            </div>
          )}
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex flex-col gap-1'}>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-[#444746] dark:text-[#c4c7c5]">Files</h2>
          {totalFileCount > 0 && (
            <span className="text-xs text-[#9aa0a6]">
              Showing {files.length} of {totalFileCount}
            </span>
          )}
        </div>
        {viewMode === 'list' && files.length > 0 && (
          <div className="flex text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2 mb-2 px-3">
            <div className="flex-1">Name</div>
            <div className="w-28 hidden sm:block">Status</div>
            <div className="w-32 hidden md:block">Last modified</div>
            <div className="w-24 hidden lg:block">File size</div>
            <div className="w-8"></div>
          </div>
        )}
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex flex-col gap-1'}>
          {files.map((file: any) => (
            <FileCard key={file.id} file={file} isTrash={isTrash} refresh={refresh} token={token} viewMode={viewMode} user={user} onPreviewFile={onPreviewFile} onToggleStar={onToggleStar} onRenameFile={onRenameFile} onMoveFile={onMoveFile} allFolders={allFolders} onCompare={onCompare} />
          ))}
          {files.length === 0 && (
            <div className="col-span-full text-center py-12 text-[#444746] dark:text-[#c4c7c5]">
              {isTrash ? 'Trash is empty.' : currentView === 'starred' ? 'No starred files yet. Star files to see them here.' : currentView === 'recent' ? 'No recently opened files.' : 'No files yet. Upload a document to get started.'}
            </div>
          )}
        </div>

        {/* Load More button */}
        {hasMore && (
          <div className="flex justify-center mt-8 mb-4">
            <button
              onClick={onLoadMore}
              className="px-6 py-2.5 bg-[#f0f4f9] dark:bg-[#282a2c] text-[#0b57d0] dark:text-[#a8c7fa] rounded-full text-sm font-medium hover:bg-[#e8f0fe] dark:hover:bg-[#37393b] hover:shadow-md transition-all duration-200 border border-[#0b57d0]/10 dark:border-[#a8c7fa]/10"
            >
              Load More
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

// ─── Folder Card ─────────────────────────────────────────────────────────────
function FolderCard({ folder, isTrash, refresh, onClick, token, viewMode, user }: any) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleAction = async (action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    try {
      let error = null;
      if (action === 'trash') {
        const { error: err } = await supabase.from('folders').update({ trashed_at: new Date().toISOString() }).eq('id', folder.id);
        error = err;
      } else if (action === 'restore') {
        const { error: err } = await supabase.from('folders').update({ trashed_at: null }).eq('id', folder.id);
        error = err;
      } else if (action === 'delete') {
        const { error: err } = await supabase.from('folders').delete().eq('id', folder.id);
        error = err;
      }

      if (!error) { toast.success(`Folder ${action}ed`); refresh(); }
      else toast.error(`Failed to ${action} folder`);
    } catch {
      toast.error(`Failed to ${action} folder`);
    }
  };

  // Use camelCase field names (mapped in App.tsx)
  const date = new Date(folder.createdAt || folder.created_at);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');
  const isOwner = (folder.ownerId || folder.owner_id) === user?.id;

  const menuItems = isTrash ? (
    <>
      <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]"><RotateCcw className="w-4 h-4" /> Restore</button>
      <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash className="w-4 h-4" /> Delete forever</button>
    </>
  ) : (
    <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]"><Trash2 className="w-4 h-4" /> Move to trash</button>
  );

  if (viewMode === 'list') {
    return (
      <div onClick={onClick} className="relative flex items-center px-3 py-2 bg-white dark:bg-[#1e1f20] hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] border-b border-gray-100 dark:border-gray-800/50 cursor-pointer transition-colors group">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <Folder className="text-[#444746] dark:text-[#c4c7c5] w-5 h-5 fill-current opacity-70 shrink-0" />
          <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{folder.name}</span>
        </div>
        <div className="w-28 text-sm text-gray-500 dark:text-gray-400 hidden sm:block">—</div>
        <div className="w-32 text-sm text-gray-500 dark:text-gray-400 hidden md:block truncate">{formattedDate}</div>
        <div className="w-24 text-sm text-gray-500 dark:text-gray-400 hidden lg:block">—</div>
        <div className="w-8 flex justify-end shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-[#444746] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        {menuOpen && <div className="absolute top-full right-8 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">{menuItems}</div>}
      </div>
    );
  }

  return (
    <div onClick={onClick} className="relative flex items-center gap-3 p-4 bg-[#f8fafd] dark:bg-[#282a2c] border border-gray-200/50 dark:border-gray-800/50 rounded-2xl hover:bg-white dark:hover:bg-[#37393b] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] cursor-pointer transition-all duration-300 group">
      <Folder className="text-[#444746] dark:text-[#c4c7c5] w-6 h-6 fill-current opacity-70" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{folder.name}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-[#444746] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <MoreVertical className="w-4 h-4" />
      </button>
      {menuOpen && <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">{menuItems}</div>}
    </div>
  );
}

// ─── File Card ───────────────────────────────────────────────────────────────
function FileCard({ file, isTrash, refresh, token, viewMode, user, onPreviewFile, onToggleStar, onRenameFile, onMoveFile, allFolders, onCompare }: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const mimeType = file.mimeType || file.mime_type || '';
  const originalName = file.originalName || file.original_name || 'Unknown';
  const storagePath = file.storagePath || file.storage_path || '';

  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');
  const isPdf = mimeType === 'application/pdf';

  let Icon = FileIcon;
  let iconColor = 'text-gray-500 dark:text-gray-400';
  if (isImage) { Icon = ImageIcon; iconColor = 'text-red-500 dark:text-red-400'; }
  else if (isVideo) { Icon = Video; iconColor = 'text-red-500 dark:text-red-400'; }
  else if (isPdf) { Icon = FileText; iconColor = 'text-red-500 dark:text-red-400'; }
  else { Icon = FileText; iconColor = 'text-blue-500 dark:text-blue-400'; }

  const date = new Date(file.createdAt || file.created_at);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');

  // Load thumbnail for images
  useEffect(() => {
    if (isImage && storagePath) {
      supabase.storage.from('uploads').createSignedUrl(storagePath, 300).then(({ data }) => {
        if (data?.signedUrl) setThumbnailUrl(data.signedUrl);
      });
    }
  }, [isImage, storagePath]);

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
    if (action === 'download') {
      const { data, error } = await supabase.storage.from('uploads').createSignedUrl(storagePath, 60);
      if (data?.signedUrl) {
         window.open(data.signedUrl, '_blank');
      } else {
         toast.error('Failed to generate download link');
      }
      return;
    }
    
    try {
      let error = null;
      if (action === 'trash') {
        const { error: err } = await supabase.from('files').update({ trashed_at: new Date().toISOString() }).eq('id', file.id);
        error = err;
      } else if (action === 'restore') {
        const { error: err } = await supabase.from('files').update({ trashed_at: null }).eq('id', file.id);
        error = err;
      } else if (action === 'delete') {
        // Also delete from storage
        if (storagePath) {
          await supabase.storage.from('uploads').remove([storagePath]);
        }
        const { error: err } = await supabase.from('files').delete().eq('id', file.id);
        error = err;
      }

      if (!error) { toast.success(`File ${action}ed`); refresh(); }
      else toast.error(`Failed to ${action} file`);
    } catch {
      toast.error(`Failed to ${action} file`);
    }
  };

  const handleCardClick = () => {
    onPreviewFile(file.id);
  };

  const menuItems = isTrash ? (
    <>
      <button onClick={(e) => handleAction('download', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]"><Download className="w-4 h-4" /> Download</button>
      <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]"><RotateCcw className="w-4 h-4" /> Restore</button>
      <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash className="w-4 h-4" /> Delete forever</button>
    </>
  ) : (
    <>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStar?.(file.id); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
        <Star className={`w-4 h-4 ${file.starred_at ? 'fill-amber-400 text-amber-400' : ''}`} /> {file.starred_at ? 'Unstar' : 'Star'}
      </button>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setRenameValue(originalName); setRenaming(true); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
        <Pencil className="w-4 h-4" /> Rename
      </button>
      <div className="relative">
        <button onClick={(e) => { e.stopPropagation(); setMoveMenuOpen(!moveMenuOpen); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
          <FolderInput className="w-4 h-4" /> Move to…
        </button>
        {moveMenuOpen && (
          <div className="absolute left-full top-0 ml-1 w-48 max-h-60 overflow-y-auto bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setMoveMenuOpen(false); onMoveFile?.(file.id, null); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]">
              <Folder className="w-4 h-4" /> Root (My Drive)
            </button>
            {(allFolders || []).map((fld: any) => (
              <button key={fld.id} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setMoveMenuOpen(false); onMoveFile?.(file.id, fld.id); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] truncate">
                <Folder className="w-4 h-4 shrink-0" /> {fld.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={(e) => handleAction('download', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]"><Download className="w-4 h-4" /> Download</button>
      <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
      <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /> Move to trash</button>
    </>
  );

  if (viewMode === 'list') {
    return (
      <>
        <div onClick={handleCardClick} className="relative flex items-center px-3 py-2 bg-white dark:bg-[#1e1f20] hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] border-b border-gray-100 dark:border-gray-800/50 cursor-pointer transition-colors group">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {file.starred_at && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
            <Icon className={`w-5 h-5 ${iconColor} opacity-70 shrink-0`} />
            <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{originalName}</span>
          </div>
          <div className="w-28 hidden sm:block"><StatusBadge status={file.parsing_status} /></div>
          <div className="w-32 text-sm text-gray-500 dark:text-gray-400 hidden md:block truncate">{formattedDate}</div>
          <div className="w-24 text-sm text-gray-500 dark:text-gray-400 hidden lg:block truncate">{formatBytes(file.size)}</div>
          <div className="w-8 flex justify-end shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-[#444746] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          {menuOpen && <div className="absolute top-full right-8 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">{menuItems}</div>}
        </div>
      </>
    );
  }

  // Rename inline modal
  if (renaming) {
    return (
      <div className="relative flex flex-col bg-[#f8fafd] dark:bg-[#282a2c] border-2 border-[#0b57d0] dark:border-[#a8c7fa] rounded-2xl p-3">
        <form onSubmit={(e) => { e.preventDefault(); onRenameFile?.(file.id, renameValue); setRenaming(false); }} className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-[#9aa0a6] uppercase tracking-wider">Rename File</label>
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            className="w-full bg-white dark:bg-[#1e1f20] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-[#1f1f1f] dark:text-[#e3e3e3] focus:outline-none focus:ring-2 focus:ring-[#0b57d0]/30"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-1.5 text-xs font-semibold bg-[#0b57d0] text-white rounded-lg hover:bg-[#0842a0]">Save</button>
            <button type="button" onClick={() => setRenaming(false)} className="flex-1 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <div onClick={handleCardClick} className="relative flex flex-col bg-[#f8fafd] dark:bg-[#282a2c] border border-gray-200/50 dark:border-gray-800/50 rounded-2xl p-1.5 hover:bg-white dark:hover:bg-[#37393b] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-0.5 dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] cursor-pointer transition-all duration-300 group">
        <div className="flex items-center gap-2 p-2 flex-1 min-w-0">
          {file.starred_at && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
          <Icon className={`w-5 h-5 ${iconColor} opacity-70 shrink-0`} />
          <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] truncate flex-1">{originalName}</span>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-[#444746] p-1 rounded-full hover:bg-[#e1e5ea] dark:hover:bg-[#4a4c4f] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Status badge */}
        {file.parsing_status && file.parsing_status !== 'idle' && (
          <div className="px-2 pb-2">
            <StatusBadge status={file.parsing_status} />
          </div>
        )}

        {menuOpen && (
          <div className="absolute top-12 right-2 w-48 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
            {menuItems}
          </div>
        )}

        <div className="h-36 mx-1.5 mb-1.5 bg-white dark:bg-[#1e1f20] rounded-xl border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center relative overflow-hidden shrink-0 group-hover:border-blue-200 dark:group-hover:border-blue-900/50 transition-colors">
          {isImage && thumbnailUrl ? (
            <img src={thumbnailUrl} alt={originalName} className="object-cover w-full h-full" />
          ) : (
            <Icon className={`w-12 h-12 ${iconColor} opacity-20`} />
          )}
        </div>
      </div>
    </>
  );
}
