import { useState, useEffect } from 'react';
import { FileText, Upload, Star, Pencil, FolderInput, Trash2, Share2, Tag, Clock, RefreshCw, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { format, isToday, isYesterday } from 'date-fns';

const ACTION_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  upload: { icon: Upload, color: 'text-green-500', label: 'Uploaded' },
  star: { icon: Star, color: 'text-amber-500', label: 'Starred' },
  unstar: { icon: Star, color: 'text-gray-400', label: 'Unstarred' },
  rename: { icon: Pencil, color: 'text-blue-500', label: 'Renamed' },
  move: { icon: FolderInput, color: 'text-purple-500', label: 'Moved' },
  trash: { icon: Trash2, color: 'text-red-500', label: 'Trashed' },
  restore: { icon: RefreshCw, color: 'text-green-500', label: 'Restored' },
  delete: { icon: Trash2, color: 'text-red-700', label: 'Deleted' },
  share: { icon: Share2, color: 'text-indigo-500', label: 'Shared' },
  tag: { icon: Tag, color: 'text-teal-500', label: 'Tagged' },
  view: { icon: FileText, color: 'text-gray-500', label: 'Viewed' },
};

interface ActivityEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_name: string;
  metadata: any;
  created_at: string;
}

export function ActivityFeed({ user }: { user: any }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search, Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!user?.id) return;
    loadActivities(1, false);
  }, [user?.id, actionFilter, searchQuery]);

  const loadActivities = async (pageNum = 1, append = false) => {
    if (!append) setLoading(true);
    
    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }
    
    if (searchQuery.trim()) {
      query = query.ilike('entity_name', `%${searchQuery.trim()}%`);
    }

    const from = (pageNum - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, count } = await query;
    
    if (append) {
      setActivities(prev => [...prev, ...(data || [])]);
    } else {
      setActivities(data || []);
    }
    
    setHasMore(count ? (from + (data?.length || 0)) < count : false);
    setPage(pageNum);
    if (!append) setLoading(false);
  };

  const handleLoadMore = () => {
    loadActivities(page + 1, true);
  };

  const activeFilters = Object.keys(ACTION_CONFIG);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
    if (isYesterday(d)) return `Yesterday at ${format(d, 'h:mm a')}`;
    return format(d, 'MMM d, yyyy h:mm a');
  };

  // Group by date
  const groups = activities.reduce((acc, a) => {
    const d = new Date(a.created_at);
    let label = '';
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else label = format(d, 'MMMM d, yyyy');
    if (!acc[label]) acc[label] = [];
    acc[label].push(a);
    return acc;
  }, {} as Record<string, ActivityEntry[]>);

  return (
    <div className="p-4 sm:p-6 overflow-y-auto max-h-full flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-lg sm:text-xl font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] flex items-center gap-2">
          📋 Activity Log
        </h1>
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              className="pl-9 pr-3 py-1.5 bg-gray-100 dark:bg-[#1e1f20] border-none outline-none text-sm text-[#1f1f1f] dark:text-[#e3e3e3] rounded-lg focus:ring-2 focus:ring-blue-500 max-w-[150px] sm:max-w-[200px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Dropdown */}
          <div className="relative flex items-center bg-gray-100 dark:bg-[#1e1f20] rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
            <Filter className="w-4 h-4 text-gray-400 mr-2" />
            <select
              className="bg-transparent border-none outline-none text-sm text-[#1f1f1f] dark:text-[#e3e3e3] cursor-pointer appearance-none pr-4"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Activity</option>
              {activeFilters.map(action => (
                <option key={action} value={action}>{ACTION_CONFIG[action].label}</option>
              ))}
            </select>
          </div>

          <button onClick={() => loadActivities(1, false)} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0">
            <RefreshCw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-600">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No activity found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-8 pb-8">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label}>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9aa0a6] mb-3">{label}</h3>
              <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-700 space-y-4">
                {items.map((a) => {
                  const config = ACTION_CONFIG[a.action] || ACTION_CONFIG['view'];
                  const Icon = config.icon;
                  // Dynamic coloring for dot
                  const dotColor = a.action === 'upload' ? 'bg-green-500' : a.action.includes('trash') || a.action === 'delete' ? 'bg-red-500' : 'bg-blue-500';
                  
                  return (
                    <div key={a.id} className="relative flex items-start gap-3 group">
                      <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-white dark:bg-[#1e1f20] border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center mt-1">
                        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                      </div>
                      <div className="flex-1 bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl p-3 hover:bg-white dark:hover:bg-[#37393b] transition-colors border border-transparent dark:border-[#37393b]">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          <span className="text-xs font-semibold text-[#444746] dark:text-[#c4c7c5]">{config.label}</span>
                          <span className="text-[10px] text-[#9aa0a6] ml-auto">{formatTime(a.created_at)}</span>
                        </div>
                        <p className="text-sm text-[#1f1f1f] dark:text-[#e3e3e3] font-medium truncate">
                          {a.entity_name || 'Unknown file'}
                        </p>
                        {a.metadata?.originalName && a.metadata?.originalName !== a.entity_name && (
                           <p className="text-xs text-[#9aa0a6] mt-1 space-x-1">
                             <span>from:</span>
                             <span className="line-through">{a.metadata.originalName}</span>
                           </p>
                        )}
                         {a.metadata?.targetFolderName && (
                           <p className="text-xs text-[#9aa0a6] mt-1">
                             moved to {a.metadata.targetFolderName}
                           </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {hasMore && (
            <div className="pt-4 flex justify-center">
              <button 
                onClick={handleLoadMore}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Load Older Activity
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
