import { useState, useEffect, useRef } from 'react';
import { Tag, X, Plus, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

interface TagData {
  id: string;
  name: string;
  color: string;
}

export function TagsManager({ user, fileId, onClose }: { user: any; fileId?: string; onClose?: () => void }) {
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [fileTags, setFileTags] = useState<string[]>([]); // tag IDs on this file
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    loadTags();
    if (fileId) loadFileTags();
  }, [user?.id, fileId]);

  const loadTags = async () => {
    const { data } = await supabase.from('tags').select('*').order('name');
    setAllTags(data || []);
  };

  const loadFileTags = async () => {
    if (!fileId) return;
    const { data } = await supabase.from('file_tags').select('tag_id').eq('file_id', fileId);
    setFileTags((data || []).map((d: any) => d.tag_id));
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    const { data, error } = await supabase.from('tags').insert({
      user_id: user.id,
      name: newTagName.trim(),
      color: newTagColor,
    }).select().single();
    if (error) {
      if (error.code === '23505') toast.error('Tag already exists');
      else toast.error('Failed to create tag');
      return;
    }
    setAllTags(prev => [...prev, data]);
    setNewTagName('');
    setIsCreating(false);
    toast.success(`Tag "${data.name}" created`);
  };

  const toggleFileTag = async (tagId: string) => {
    if (!fileId) return;
    const isActive = fileTags.includes(tagId);
    if (isActive) {
      await supabase.from('file_tags').delete().eq('file_id', fileId).eq('tag_id', tagId);
      setFileTags(prev => prev.filter(id => id !== tagId));
    } else {
      await supabase.from('file_tags').insert({ file_id: fileId, tag_id: tagId });
      setFileTags(prev => [...prev, tagId]);
    }
  };

  const deleteTag = async (tagId: string) => {
    await supabase.from('tags').delete().eq('id', tagId);
    setAllTags(prev => prev.filter(t => t.id !== tagId));
    setFileTags(prev => prev.filter(id => id !== tagId));
    toast.success('Tag deleted');
  };

  return (
    <div className="w-64 bg-white dark:bg-[#282a2c] border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 z-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#9aa0a6]">
          {fileId ? 'File Tags' : 'Manage Tags'}
        </span>
        {onClose && (
          <button onClick={onClose} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
        {allTags.map(tag => (
          <div key={tag.id} className="flex items-center gap-2 group">
            {fileId ? (
              <button
                onClick={() => toggleFileTag(tag.id)}
                className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${fileTags.includes(tag.id) ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{tag.name}</span>
                {fileTags.includes(tag.id) && <Check className="w-3.5 h-3.5 text-blue-500 ml-auto shrink-0" />}
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-sm text-[#1f1f1f] dark:text-[#e3e3e3] truncate">{tag.name}</span>
              </div>
            )}
            <button
              onClick={() => deleteTag(tag.id)}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 transition-opacity"
            >
              <X className="w-3 h-3 text-red-500" />
            </button>
          </div>
        ))}
        {allTags.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">No tags yet</p>
        )}
      </div>

      {isCreating ? (
        <div className="space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
          <input
            ref={inputRef}
            autoFocus
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createTag()}
            placeholder="Tag name..."
            className="w-full bg-gray-50 dark:bg-[#1e1f20] border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-[#1f1f1f] dark:text-[#e3e3e3]"
          />
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewTagColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${newTagColor === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-110' : 'hover:scale-110'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={createTag} className="flex-1 py-1.5 text-xs font-semibold bg-[#0b57d0] text-white rounded-lg hover:bg-[#0842a0]">Create</button>
            <button onClick={() => setIsCreating(false)} className="flex-1 py-1.5 text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-[#0b57d0] dark:text-[#a8c7fa] hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Tag
        </button>
      )}
    </div>
  );
}

// Small inline tag badges for file cards
export function TagBadges({ fileId }: { fileId: string }) {
  const [tags, setTags] = useState<TagData[]>([]);

  useEffect(() => {
    loadFileTags();
  }, [fileId]);

  const loadFileTags = async () => {
    const { data } = await supabase
      .from('file_tags')
      .select('tag_id, tags(id, name, color)')
      .eq('file_id', fileId);
    if (data) {
      setTags(data.map((d: any) => d.tags).filter(Boolean));
    }
  };

  if (tags.length === 0) return null;

  return (
    <div className="flex gap-1 flex-wrap px-2 pb-1.5">
      {tags.slice(0, 3).map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[10px] text-gray-400">+{tags.length - 3}</span>
      )}
    </div>
  );
}
