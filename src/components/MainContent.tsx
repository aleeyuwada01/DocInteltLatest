import { Folder, FileText, Image as ImageIcon, Video, File as FileIcon, MoreVertical, Trash2, RotateCcw, Trash, ArrowLeft, LayoutGrid, List, X, Loader2, CheckCircle2, AlertCircle, Clock, Download, Star, Pencil, FolderInput, GitCompareArrows, Share2, Tag, CloudOff, FolderOpen, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabaseClient';
import { logActivity } from '../lib/activity';
import { TagBadges } from './TagsManager';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Shared Motion Variants ────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.15 } }
};

// ─── Parsing Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (!status || status === 'idle' || status === 'completed') return null;

  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    parsing: {
      label: 'Parsing…',
      className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50',
      icon: <Loader2 className="w-3 h-3 animate-spin text-blue-500" />,
    },
    embedding: {
      label: 'Embedding…',
      className: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50',
      icon: (
        <div className="relative w-3 h-3">
          <div className="absolute inset-0 rounded-full border-t border-l border-purple-500 animate-spin"></div>
        </div>
      ),
    },
    completed: {
      label: 'Ready',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,
    },
    error: {
      label: 'Parse Error',
      className: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800/50',
      icon: <AlertCircle className="w-3 h-3 text-red-500" />,
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ─── Empty States ────────────────────────────────────────────────────────────
function EmptyState({ isTrash, currentView }: { isTrash: boolean, currentView: string }) {
  const isStarred = currentView === 'starred';
  const isRecent = currentView === 'recent';
  
  return (
    <motion.div 
      variants={itemVariants}
      className="col-span-full flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="w-24 h-24 mb-6 relative">
        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-xl animate-pulse"></div>
        <div className="relative z-10 w-full h-full bg-white dark:bg-[#1e1f20] rounded-full border border-gray-100 dark:border-gray-800 shadow-xl flex items-center justify-center">
          {isTrash ? <Trash className="w-10 h-10 text-gray-400" /> :
           isStarred ? <Star className="w-10 h-10 text-amber-400" /> :
           isRecent ? <Clock className="w-10 h-10 text-blue-400" /> :
           <CloudOff className="w-10 h-10 text-gray-400 dark:text-gray-500" />}
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">
        {isTrash ? 'Trash is clear' : 
         isStarred ? 'No stars yet' : 
         isRecent ? 'No recent activity' : 
         'Your drive is empty'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[260px] mx-auto leading-relaxed">
        {isTrash ? 'Items moved to the trash will permanently delete after 30 days.' : 
         isStarred ? 'Star important files to keep them easily accessible right here.' : 
         isRecent ? 'Files you interact with will appear here for quick access.' : 
         'Upload documents, images, and PDFs to start building your knowledge base.'}
      </p>
    </motion.div>
  );
}

// ─── Main Content ────────────────────────────────────────────────────────────
export function MainContent({ files, folders, onUpload, currentView, refresh, currentFolderId, setCurrentFolderId, token, user, onPreviewFile, hasMore, totalFileCount, onLoadMore, onToggleStar, onRenameFile, onMoveFile, allFolders, onCompare }: any) {
  const isTrash = currentView === 'trash';
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
    <main className="flex-1 overflow-y-auto bg-[#fcfcfc] dark:bg-[#121314] p-4 md:p-8 lg:p-10 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap justify-between items-center gap-3 mb-8"
        >
          <div className="flex items-center gap-3 min-w-0">
            {currentFolderId && !isTrash && (
              <motion.button
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(0,0,0,0.05)' }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentFolderId(null)}
                className="p-2 rounded-full transition-colors shrink-0 backdrop-blur-sm"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </motion.button>
            )}
            <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight truncate">
              {isTrash ? 'Trash' : currentView === 'starred' ? 'Starred' : currentView === 'recent' ? 'Recent' : currentFolderId ? 'Folder Overview' : 'Main Drive'}
            </h1>
          </div>

          <div className="flex gap-2 sm:gap-3 items-center shrink-0">
            <div className="flex bg-white dark:bg-[#1e1f20] rounded-xl p-1 border border-gray-200/50 dark:border-gray-800 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-[#282a2c] shadow-inner text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all duration-200 ${viewMode === 'list' ? 'bg-gray-100 dark:bg-[#282a2c] shadow-inner text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            {/* Summarize button disabled for now per user request
            {!isTrash && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
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
                className="bg-white dark:bg-[#1e1f20] text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-gray-800 shadow-[0_2px_10px_rgba(0,0,0,0.02)] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 dark:hover:bg-[#282a2c] transition-colors whitespace-nowrap"
              >
                <span className="hidden sm:inline">Summarize Node</span>
                <span className="sm:hidden">Summarize</span>
              </motion.button>
            )}
            */}
          </div>
        </motion.div>

        {isTrash && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl flex items-center gap-3 text-sm text-red-600 dark:text-red-400 font-medium">
            <AlertCircle className="w-5 h-5" />
            Items in trash are purged systematically after 30 days.
          </motion.div>
        )}

        {folders.length > 0 && (
          <section className="mb-10">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4 px-1">Folders</h2>
            {viewMode === 'list' && (
              <div className="flex text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pb-3 mb-2 px-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex-1">Name</div>
                <div className="w-32 hidden sm:block">Owner</div>
                <div className="w-32 hidden md:block">Last modified</div>
                <div className="w-24 hidden lg:block">Modified</div>
                <div className="w-8"></div>
              </div>
            )}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 xl:gap-5' : 'flex flex-col gap-2'}
            >
              <AnimatePresence>
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
              </AnimatePresence>
            </motion.div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Files</h2>
            {totalFileCount > 0 && (
              <span className="text-xs font-semibold bg-gray-100 dark:bg-[#1e1f20] px-2.5 py-1 rounded-full text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800">
                Holding {files.length} of {totalFileCount}
              </span>
            )}
          </div>
          {viewMode === 'list' && files.length > 0 && (
            <div className="flex text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pb-3 mb-2 px-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex-1">Name</div>
              <div className="w-28 hidden sm:block">Status</div>
              <div className="w-32 hidden md:block">Last modified</div>
              <div className="w-24 hidden lg:block">Size</div>
              <div className="w-8"></div>
            </div>
          )}
          
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 xl:gap-5' : 'flex flex-col gap-2'}
          >
            <AnimatePresence>
              {files.map((file: any) => (
                <FileCard key={file.id} file={file} isTrash={isTrash} refresh={refresh} token={token} viewMode={viewMode} user={user} onPreviewFile={onPreviewFile} onToggleStar={onToggleStar} onRenameFile={onRenameFile} onMoveFile={onMoveFile} allFolders={allFolders} onCompare={onCompare} />
              ))}
              {files.length === 0 && <EmptyState isTrash={isTrash} currentView={currentView} />}
            </AnimatePresence>
          </motion.div>

          {/* Load More button */}
          {hasMore && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center mt-10 mb-8">
              <button
                onClick={onLoadMore}
                className="px-8 py-3 bg-white dark:bg-[#1e1f20] text-blue-600 dark:text-blue-400 shadow-[0_2px_15px_rgba(0,0,0,0.03)] border border-gray-100 dark:border-gray-800 rounded-full text-sm font-bold tracking-wide uppercase hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300"
              >
                Access More Memory
              </button>
            </motion.div>
          )}
        </section>
      </div>
    </main>
  );
}

// ─── Folder Card ─────────────────────────────────────────────────────────────
function FolderCard({ folder, isTrash, refresh, onClick, viewMode, user }: any) {
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

  const date = new Date(folder.createdAt || folder.created_at);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');

  const menuItems = isTrash ? (
    <>
      <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]"><RotateCcw className="w-4 h-4 text-blue-500" /> Restore</button>
      <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash className="w-4 h-4" /> Delete Permanently</button>
    </>
  ) : (
    <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]"><Trash2 className="w-4 h-4 text-red-500" /> Move to trash</button>
  );

  if (viewMode === 'list') {
    return (
      <motion.div variants={itemVariants} exit="exit" onClick={onClick} className="relative flex items-center px-4 py-3 bg-white dark:bg-[#1e1f20] hover:bg-blue-50/50 dark:hover:bg-[#282a2c] rounded-xl border border-gray-100 dark:border-gray-800/80 cursor-pointer transition-all duration-200 group">
        <div className="flex-1 flex items-center gap-4 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
            <FolderOpen className="text-indigo-500 dark:text-indigo-400 w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">{folder.name}</span>
        </div>
        <div className="w-32 text-sm font-medium text-gray-400 hidden sm:block">—</div>
        <div className="w-32 text-sm font-medium text-gray-400 hidden md:block truncate">{formattedDate}</div>
        <div className="w-24 text-sm font-medium text-gray-400 hidden lg:block">—</div>
        <div className="w-8 flex justify-end shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-gray-400 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 opacity-100 transition-opacity">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        {menuOpen && <div className="absolute top-full right-8 mt-2 w-48 bg-white dark:bg-[#282a2c] border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-20 py-1">{menuItems}</div>}
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} exit="exit" whileHover={{ y: -4, scale: 1.01 }} onClick={onClick} className="relative flex flex-col justify-end p-5 bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)] hover:shadow-xl dark:hover:shadow-black/50 cursor-pointer transition-all duration-300 group overflow-hidden">
      <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500">
        <Folder className="w-32 h-32 text-indigo-500 -rotate-12" />
      </div>
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 flex items-center justify-center">
          <FolderOpen className="text-indigo-600 dark:text-indigo-400 w-5 h-5" />
        </div>
        <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-gray-400 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 opacity-100 transition-all">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="relative z-10 min-w-0">
        <div className="text-sm font-bold text-gray-900 dark:text-white truncate tracking-tight">{folder.name}</div>
        <div className="text-[11px] font-medium text-gray-400 mt-0.5">{formattedDate}</div>
      </div>
      {menuOpen && <div className="absolute top-12 right-4 mt-1 w-48 bg-white dark:bg-[#282a2c] border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-20 py-1">{menuItems}</div>}
    </motion.div>
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
  let iconColor = 'text-gray-500';
  let bgColor = 'bg-gray-50';
  if (isImage) { Icon = ImageIcon; iconColor = 'text-pink-500'; bgColor = 'bg-pink-50 dark:bg-pink-900/10'; }
  else if (isVideo) { Icon = Video; iconColor = 'text-rose-500'; bgColor = 'bg-rose-50 dark:bg-rose-900/10'; }
  else if (isPdf) { Icon = FileText; iconColor = 'text-red-500'; bgColor = 'bg-red-50 dark:bg-red-900/10'; }
  else { Icon = FileText; iconColor = 'text-blue-500'; bgColor = 'bg-blue-50 dark:bg-blue-900/10'; }

  const date = new Date(file.createdAt || file.created_at);
  const formattedDate = isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM d, yyyy');

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
        if (storagePath) {
          await supabase.storage.from('uploads').remove([storagePath]);
        }
        const { error: err } = await supabase.from('files').delete().eq('id', file.id);
        error = err;
      }

      if (!error) { 
        toast.success(`File ${action}ed`); 
        refresh(); 
        if (action === 'trash') logActivity(user.id, file.id, 'trash_file', { originalName });
        if (action === 'restore') logActivity(user.id, file.id, 'restore_file', { originalName });
        if (action === 'delete') logActivity(user.id, file.id, 'delete_file', { originalName });
      } else {
        toast.error(`Failed to ${action} file`);
      }
    } catch {
      toast.error(`Failed to ${action} file`);
    }
  };

  const handleCardClick = () => {
    onPreviewFile(file.id);
  };

  const menuItems = isTrash ? (
    <>
      <button onClick={(e) => handleAction('download', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]"><Download className="w-4 h-4" /> Download</button>
      <button onClick={(e) => handleAction('restore', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]"><RotateCcw className="w-4 h-4 text-blue-500" /> Restore</button>
      <button onClick={(e) => handleAction('delete', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash className="w-4 h-4" /> Delete Permanently</button>
    </>
  ) : (
    <>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); window.dispatchEvent(new CustomEvent('docintel:chat-file', { detail: file })); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]">
        <Sparkles className="w-4 h-4 text-purple-500" /> Ask DocIntel AI
      </button>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onToggleStar?.(file.id); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]">
        <Star className={`w-4 h-4 ${file.starred_at ? 'fill-amber-400 text-amber-400' : 'text-gray-400'}`} /> {file.starred_at ? 'Unstar File' : 'Star File'}
      </button>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); window.dispatchEvent(new CustomEvent('docintel:tags', { detail: file })); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]">
        <Tag className="w-4 h-4 text-teal-500" /> Manage Tags
      </button>
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); window.dispatchEvent(new CustomEvent('docintel:share', { detail: file })); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]">
        <Share2 className="w-4 h-4 text-indigo-500" /> Share Link
      </button>
      <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
      <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setRenameValue(originalName); setRenaming(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]">
        <Pencil className="w-4 h-4 text-gray-400" /> Rename File
      </button>
      <div className="relative">
        <button onClick={(e) => { e.stopPropagation(); setMoveMenuOpen(!moveMenuOpen); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]">
          <FolderInput className="w-4 h-4 text-gray-400" /> Move to Folder
        </button>
        {moveMenuOpen && (
          <div className="absolute left-full top-0 ml-2 w-56 max-h-60 overflow-y-auto bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl z-20 py-2">
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setMoveMenuOpen(false); onMoveFile?.(file.id, null); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#37393b]">
              <HardDrive className="w-4 h-4 text-blue-500" /> Root Folder
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
            {(allFolders || []).map((fld: any) => (
              <button key={fld.id} onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setMoveMenuOpen(false); onMoveFile?.(file.id, fld.id); }} className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#37393b] truncate">
                <Folder className="w-4 h-4 shrink-0 opacity-50" /> {fld.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={(e) => handleAction('download', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#37393b]"><Download className="w-4 h-4 text-gray-400" /> Download</button>
      <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
      <button onClick={(e) => handleAction('trash', e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /> Move to Trash</button>
    </>
  );

  if (viewMode === 'list') {
    return (
      <motion.div variants={itemVariants} exit="exit" onClick={() => onPreviewFile(file.id)} className="relative flex items-center px-4 py-3 bg-white dark:bg-[#1e1f20] hover:bg-blue-50/50 dark:hover:bg-[#282a2c] rounded-xl border border-gray-100 dark:border-gray-800/80 cursor-pointer transition-all duration-200 group mb-1">
        <div className="flex-1 flex items-center gap-4 min-w-0">
          <div className="relative shrink-0 flex items-center justify-center">
            {file.starred_at && <Star className="absolute -top-1 -right-1 w-3 h-3 fill-amber-400 text-amber-400 z-10" />}
            <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">{originalName}</span>
        </div>
        <div className="w-28 hidden sm:block"><StatusBadge status={file.parsing_status} /></div>
        <div className="w-32 text-sm font-medium text-gray-400 hidden md:block truncate">{formattedDate}</div>
        <div className="w-24 text-sm font-medium text-gray-400 hidden lg:block truncate">{formatBytes(file.size)}</div>
        <div className="w-8 flex justify-end shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="text-gray-400 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 opacity-100 transition-opacity">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        {menuOpen && <div className="absolute top-full right-8 mt-2 w-56 bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl z-20 py-1">{menuItems}</div>}
      </motion.div>
    );
  }

  if (renaming) {
    return (
      <motion.div variants={itemVariants} className="relative flex flex-col bg-white dark:bg-[#1e1f20] border-2 border-blue-500 shadow-lg rounded-3xl p-4 z-10">
        <form onSubmit={(e) => { e.preventDefault(); onRenameFile?.(file.id, renameValue); setRenaming(false); }} className="flex flex-col gap-3">
          <label className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Rename File</label>
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            className="w-full bg-gray-50 dark:bg-[#151617] border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">Save</button>
            <button type="button" onClick={() => setRenaming(false)} className="flex-1 py-2 text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
          </div>
        </form>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} exit="exit" whileHover={{ y: -4, scale: 1.01 }} onClick={handleCardClick} className={`relative flex flex-col bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.2)] hover:shadow-xl dark:hover:shadow-black/50 cursor-pointer transition-all duration-300 group ${menuOpen ? 'z-50' : 'z-10'}`}>
      
      {/* File Preview Thumbnail Hub */}
      <div className="h-40 m-2 rounded-2xl bg-gray-50 dark:bg-[#131415] border border-gray-100 dark:border-[#2a2b2c] flex items-center justify-center relative overflow-hidden shrink-0 group-hover:border-blue-200 dark:group-hover:border-blue-900/50 transition-colors">
        {file.starred_at && (
          <div className="absolute top-3 left-3 z-10 p-1.5 bg-white/80 dark:bg-black/50 backdrop-blur border border-white/50 dark:border-black/50 rounded-full shadow-sm">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          </div>
        )}
        <div className="absolute top-3 right-3 z-10 opacity-100 transition-opacity">
           <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="p-1.5 bg-white/90 dark:bg-[#1e1f20]/90 backdrop-blur rounded-full text-gray-600 dark:text-gray-300 hover:bg-white border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {isImage && thumbnailUrl ? (
          <img src={thumbnailUrl} alt={originalName} className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-700" />
        ) : (
          <div className={`p-4 rounded-2xl ${bgColor} transform group-hover:scale-110 transition-transform duration-500`}>
            <Icon className={`w-12 h-12 ${iconColor} opacity-50`} />
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-2 flex flex-col flex-1">
        <div className="min-w-0 mb-3">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate block tracking-tight">{originalName}</span>
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{formatBytes(file.size)}</span>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {(file.parsing_status && file.parsing_status !== 'idle') && (
            <div className="inline-block self-start">
               <StatusBadge status={file.parsing_status} />
            </div>
          )}
          <TagBadges fileId={file.id} />
        </div>
      </div>

      {menuOpen && (
        <div className="absolute top-12 right-4 w-56 bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl z-20 py-1" onClick={e => e.stopPropagation()}>
          {menuItems}
        </div>
      )}
    </motion.div>
  );
}
