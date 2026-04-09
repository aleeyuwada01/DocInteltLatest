import { useState, useEffect } from 'react';
import { FileText, Upload, Star, Pencil, FolderInput, Trash2, Share2, Tag, Clock, RefreshCw, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { format, isToday, isYesterday } from 'date-fns';
import { motion } from 'framer-motion';

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
    <div className="p-4 sm:p-6 overflow-y-auto max-h-full flex flex-col h-full bg-transparent">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600 dark:text-blue-500" />
          Activity Log
        </h1>
        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search files..."
              className="pl-9 pr-3 py-2 bg-white/50 dark:bg-[#1e1f20]/50 border border-gray-200 dark:border-gray-800 shadow-sm outline-none text-sm font-medium text-gray-900 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-full sm:max-w-[200px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Dropdown */}
          <div className="relative flex items-center bg-white/50 dark:bg-[#1e1f20]/50 border border-gray-200 dark:border-gray-800 shadow-sm rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
            <Filter className="w-4 h-4 text-gray-400 mr-2" />
            <select
              className="bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer appearance-none pr-4"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All Activity</option>
              {activeFilters.map(action => (
                <option key={action} value={action}>{ACTION_CONFIG[action].label}</option>
              ))}
            </select>
          </div>

          <button onClick={() => loadActivities(1, false)} className="p-2 rounded-xl bg-white/50 dark:bg-[#1e1f20]/50 border border-gray-200 dark:border-gray-800 shadow-sm hover:bg-white dark:hover:bg-[#282a2c] hover:shadow-md transition-all shrink-0 group">
            <RefreshCw className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-500 group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-b-2 border-r-2 border-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <div className="absolute inset-4 rounded-full bg-blue-500/20 blur animate-pulse"></div>
          </div>
        </div>
      ) : activities.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 mb-6 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl"></div>
            <Clock className="w-12 h-12 text-blue-500 opacity-50 relative z-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-tight">Timeline is clear</h3>
          <p className="text-sm font-medium text-gray-400 max-w-sm">No activity records found matching the current filters. Adjust your search or perform an action to populate the log.</p>
        </motion.div>
      ) : (
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.05 } } }}
          className="space-y-8 pb-8 relative"
        >
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-4 bottom-8 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent dark:from-gray-800 dark:via-gray-800 dark:to-transparent z-0"></div>

          {Object.entries(groups).map(([label, items]) => (
            <div key={label} className="relative z-10">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 ml-6 sticky top-0 bg-[#f8fafd]/80 dark:bg-[#131314]/80 backdrop-blur py-2 w-max rounded-md px-2 -left-2 z-20">
                {label}
              </h3>
              <div className="space-y-4 ml-6">
                {items.map((a) => {
                  const config = ACTION_CONFIG[a.action] || ACTION_CONFIG['view'];
                  const Icon = config.icon;
                  const dotColor = a.action === 'upload' ? 'bg-emerald-500 shadow-emerald-500/50' : a.action.includes('trash') || a.action === 'delete' ? 'bg-rose-500 shadow-rose-500/50' : 'bg-blue-500 shadow-blue-500/50';
                  
                  return (
                    <motion.div 
                      key={a.id} 
                      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                      className="relative flex items-center gap-4 group"
                    >
                      {/* Node indicator */}
                      <div className="absolute -left-[27px] w-3 h-3 rounded-full bg-white dark:bg-[#1e1f20] border-2 border-gray-100 dark:border-gray-800 flex items-center justify-center shadow-sm">
                        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} group-hover:scale-150 transition-transform duration-300 shadow-lg`} />
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 bg-white/60 dark:bg-[#1e1f20]/60 backdrop-blur-xl border border-gray-100/50 dark:border-gray-800/80 rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:shadow-xl hover:bg-white dark:hover:bg-[#282a2c] transition-all cursor-default">
                        <div className="flex items-center gap-3 mb-1.5">
                          <div className={`p-1.5 rounded-lg bg-gray-50 dark:bg-black/20 ${config.color.replace('text-', 'text-').replace('500', '600 dark:text-').replace('400', '500')}`}>
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">{config.label}</span>
                          <span className="text-[10px] font-medium text-gray-400 ml-auto bg-gray-50 dark:bg-black/20 px-2 py-1 rounded-md">{formatTime(a.created_at).split('at ')[1] || formatTime(a.created_at)}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate w-[90%] block">
                          {a.entity_name || 'System Object'}
                        </p>
                        
                        {/* Meta differences */}
                        {a.metadata?.originalName && a.metadata?.originalName !== a.entity_name && (
                           <div className="mt-2 flex items-center gap-2">
                             <span className="text-[10px] font-bold uppercase text-gray-400">Previous</span>
                             <span className="text-xs text-gray-500 line-through truncate">{a.metadata.originalName}</span>
                           </div>
                        )}
                        {a.metadata?.targetFolderName && (
                           <div className="mt-2 flex items-center gap-2">
                             <FolderInput className="w-3 h-3 text-gray-400" />
                             <span className="text-xs text-gray-500">Node shifted to <span className="font-bold text-gray-700 dark:text-gray-300">{a.metadata.targetFolderName}</span></span>
                           </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
          
          {hasMore && (
            <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="pt-8 flex justify-center pb-4">
              <button 
                onClick={handleLoadMore}
                className="px-6 py-2.5 bg-white/50 dark:bg-[#1e1f20]/50 backdrop-blur border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:bg-white dark:hover:bg-[#282a2c] text-sm font-bold text-gray-900 dark:text-gray-100 rounded-xl transition-all"
              >
                Load Archival Data
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
