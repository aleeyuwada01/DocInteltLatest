import {
  HardDrive, Trash2, Cloud, Plus, FolderPlus, FileUp, X,
  ChevronRight, UploadCloud
} from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { DocIntelLogo } from './LandingPage';
import { supabase } from '../lib/supabaseClient';

export function Sidebar({
  currentView, setCurrentView, storage, onUpload,
  onFolderCreate, currentFolderId, token, user, onUpgrade, isOpen, onClose
}: any) {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderLoading, setFolderLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);

  const used = storage.used || 0;
  const limit = storage.limit || 1;
  const pct = Math.min(100, (used / limit) * 100);
  const isWarning = pct > 80;
  const isDanger = pct > 95;

  const fmt = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setFolderLoading(true);
    try {
      const { error } = await supabase.from('folders').insert({
        name: newFolderName,
        parent_id: currentFolderId || null,
        owner_id: user.id
      });
      if (!error) {
        toast.success('Folder created');
        setNewFolderName(''); setIsCreateFolderOpen(false);
        onFolderCreate();
      } else {
        toast.error('Failed to create folder');
      }
    } catch { toast.error('Failed to create folder'); }
    finally { setFolderLoading(false); }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-60 flex flex-col h-full transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        bg-[#f8fafd] dark:bg-[#131314] border-r border-gray-200/50 dark:border-gray-800/50
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}
      >
        {/* ── Logo ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 h-[60px] border-b border-gray-200/40 dark:border-gray-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center shrink-0">
              <DocIntelLogo size={24} />
            </div>
            <span className="text-[18px] font-semibold text-[#444746] dark:text-gray-100 tracking-tight">DocIntel</span>
          </div>
          <button className="md:hidden p-1.5 text-[#9aa0a6] rounded-xl hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] transition-colors" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Nav content ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto py-4 px-3 min-h-0">

          {/* New button */}
          <div className="relative mb-4" ref={newMenuRef}>
            <button
              onClick={() => setIsNewOpen(v => !v)}
              className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-[#282a2c] rounded-2xl shadow-sm hover:shadow-md dark:shadow-none border border-gray-200/50 dark:border-gray-700/50 hover:bg-[#f8fafd] dark:hover:bg-[#37393b] transition-all duration-200 w-fit group"
            >
              <Plus className="w-5 h-5 text-[#444746] dark:text-gray-200 group-hover:text-[#0b57d0] transition-colors" />
              <span className="text-sm font-semibold text-[#444746] dark:text-gray-200">New</span>
            </button>

            {isNewOpen && (
              <div className="absolute top-[calc(100%+6px)] left-0 w-52 bg-white dark:bg-[#1e1f20] border border-gray-200/60 dark:border-gray-700/50 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-slide-up">
                <button
                  onClick={() => { setIsNewOpen(false); setIsCreateFolderOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] transition-colors"
                >
                  <FolderPlus className="w-4 h-4 text-[#0b57d0] dark:text-[#a8c7fa]" />
                  <span className="font-medium">New Folder</span>
                </button>
                <div className="my-1 h-px bg-gray-100 dark:bg-gray-800 mx-2" />
                <label className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] transition-colors cursor-pointer">
                  <FileUp className="w-4 h-4 text-[#0b57d0] dark:text-[#a8c7fa]" />
                  <span className="font-medium">File Upload</span>
                  <input
                    type="file"
                    className="hidden"
                    ref={fileRef}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) onUpload(file);
                      setIsNewOpen(false);
                    }}
                  />
                </label>
              </div>
            )}
          </div>

          {/* Nav items */}
          <nav className="space-y-0.5">
            <NavItem
              icon={<HardDrive size={16} />}
              label="My Drive"
              active={currentView === 'drive'}
              onClick={() => setCurrentView('drive')}
            />
            <NavItem
              icon={<Trash2 size={16} />}
              label="Trash"
              active={currentView === 'trash'}
              onClick={() => setCurrentView('trash')}
            />
          </nav>
        </div>

        {/* ── Storage meter ─────────────────────────────────── */}
        <div className="p-4 mx-3 mb-4 rounded-2xl bg-white dark:bg-[#1e1f20] border border-gray-200/50 dark:border-gray-800/50 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#5f6368] dark:text-[#9aa0a6]" />
              <span className="text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">Storage</span>
            </div>
            <span className="text-[11px] text-[#9aa0a6] font-medium">{Math.round(pct)}%</span>
          </div>

          {/* Bar */}
          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ${
                isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[#0b57d0]'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-[#9aa0a6]">{fmt(used)} <span className="text-[#c4c7c5]">/ {fmt(limit)}</span></p>
            {isDanger && <span className="text-[10px] text-red-500 font-semibold">Almost full!</span>}
          </div>

          <button
            onClick={onUpgrade}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-[#0b57d0] dark:text-[#a8c7fa] border border-[#0b57d0]/20 dark:border-[#a8c7fa]/20 rounded-xl hover:bg-[#e8f0fe] dark:hover:bg-[#a8c7fa]/10 transition-colors"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Get more storage
          </button>
        </div>
      </aside>

      {/* ── Create Folder Modal ──────────────────────────── */}
      {isCreateFolderOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateFolderOpen(false)}>
          <div
            className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200/50 dark:border-gray-800/50 overflow-hidden animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-semibold text-[#1a1a2e] dark:text-white">New Folder</h3>
              <button onClick={() => setIsCreateFolderOpen(false)} className="p-2 rounded-xl hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] text-[#9aa0a6]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9aa0a6] mb-2">Folder Name</label>
              <input
                type="text"
                required autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Untitled folder"
                className="input-field mb-5"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreateFolderOpen(false)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={!newFolderName.trim() || folderLoading} className="btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        active
          ? 'nav-active'
          : 'text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] hover:text-[#1a1a2e] dark:hover:text-white'
      }`}
    >
      <span className="flex items-center gap-3">
        {icon}
        {label}
      </span>
      {active && <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
    </button>
  );
}
