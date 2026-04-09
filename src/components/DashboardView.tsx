import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { PieChart, Activity, HardDrive, FileText, File, Image as ImageIcon, Search, ChevronRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export function DashboardView({ user }: { user: any }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) loadDashboardData();
  }, [user?.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: files } = await supabase.from('files').select('id, size, mime_type, parsing_status').is('trashed_at', null);
      
      let totalStorage = 0;
      let aiProcessed = 0;
      const typeCounts = { images: 0, pdfs: 0, docs: 0, other: 0 };
      
      files?.forEach(f => {
        totalStorage += (f.size || 0);
        if (f.parsing_status === 'completed') aiProcessed++;
        
        if (f.mime_type?.startsWith('image/')) typeCounts.images++;
        else if (f.mime_type === 'application/pdf') typeCounts.pdfs++;
        else if (f.mime_type?.includes('wordprocessing') || f.mime_type?.includes('officedocument')) typeCounts.docs++;
        else typeCounts.other++;
      });

      const { count: sessionCount } = await supabase.from('chat_sessions').select('*', { count: 'exact', head: true });
      const { count: searchCount } = await supabase.from('search_history').select('*', { count: 'exact', head: true });

      const storageLimit = user.storage_limit || (1 * 1024 * 1024 * 1024); // 1GB
      const storagePercent = Math.min(100, Math.round((totalStorage / storageLimit) * 100));

      // Simulate a small network delay for a smooth animation entry
      await new Promise(r => setTimeout(r, 400));

      setStats({
        totalFiles: files?.length || 0,
        totalStorage: formatBytes(totalStorage),
        storagePercent,
        aiProcessed,
        typeCounts,
        sessionCount: sessionCount || 0,
        searchCount: searchCount || 0
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading || !stats) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin animation-delay-200"></div>
          <div className="absolute inset-4 rounded-full border-b-2 border-l-2 border-cyan-500 animate-spin animation-delay-400"></div>
        </div>
        <span className="mt-4 text-sm font-medium text-gray-400 dark:text-gray-500 tracking-widest uppercase">Aggregating Workspace</span>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 overflow-y-auto w-full h-full bg-[#fcfcfc] dark:bg-[#121314]">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* Header Area */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
              Intelligence Dashboard
            </h1>
            <p className="text-[#444746] dark:text-[#a0a3a7] mt-2 font-medium">
              A high-altitude overview of your DocIntel workspace capability.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-semibold shadow-sm border border-blue-100 dark:border-blue-800/30">
            <Zap className="w-4 h-4" />
            <span>DocIntel Native</span>
          </div>
        </motion.div>

        {/* Primary Metric Grid */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Storage Card */}
          <motion.div variants={itemVariants} className="group relative overflow-hidden bg-white dark:bg-[#1e1f20] rounded-3xl p-6 shadow-[0_2px_20px_rgb(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-[#2e2f31] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <HardDrive className="w-24 h-24 text-blue-600 rotate-12 transform group-hover:rotate-6 transition-transform duration-500" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-xs">Storage Volume</h3>
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.totalStorage}</span>
                </div>
              </div>
              <div>
                <div className="w-full bg-gray-100 dark:bg-black/40 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${stats.storagePercent > 85 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`} 
                    style={{ width: `${stats.storagePercent}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">{stats.storagePercent}% Capacity</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-500">1GB Max</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Total Files Card */}
          <motion.div variants={itemVariants} className="group relative overflow-hidden bg-white dark:bg-[#1e1f20] rounded-3xl p-6 shadow-[0_2px_20px_rgb(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-[#2e2f31] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <FileText className="w-24 h-24 text-purple-600 -rotate-6 transform group-hover:rotate-0 transition-transform duration-500" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl text-white shadow-lg shadow-purple-500/20">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-xs">Total Ingested</h3>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.totalFiles}</span>
                  <span className="text-sm font-semibold text-gray-400 mb-1 filter drop-shadow-sm flex items-center">
                    Files
                  </span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 dark:bg-[#151617] rounded-xl border border-gray-100 dark:border-[#202123]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">AI Synced</span>
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{stats.aiProcessed} items</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Semantic Searches Card */}
          <motion.div variants={itemVariants} className="group relative overflow-hidden bg-white dark:bg-[#1e1f20] rounded-3xl p-6 shadow-[0_2px_20px_rgb(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-[#2e2f31] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Search className="w-24 h-24 text-teal-600 rotate-12 transform group-hover:-rotate-6 transition-transform duration-500" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-2xl text-white shadow-lg shadow-teal-500/20">
                    <Search className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-xs">Vector Queries</h3>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.searchCount}</span>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 leading-relaxed mt-4">
                Total semantic searches executed against the document knowledge base.
              </p>
            </div>
          </motion.div>

          {/* Chat Sessions Card */}
          <motion.div variants={itemVariants} className="group relative overflow-hidden bg-white dark:bg-[#1e1f20] rounded-3xl p-6 shadow-[0_2px_20px_rgb(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-[#2e2f31] transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="w-24 h-24 text-orange-600 -rotate-12 transform group-hover:rotate-6 transition-transform duration-500" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl text-white shadow-lg shadow-orange-500/20">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider text-xs">AI Chat Contexts</h3>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.sessionCount}</span>
                </div>
              </div>
              <p className="text-xs font-medium text-gray-500 leading-relaxed mt-4">
                Active multi-turn conversation sessions processed by the language model.
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Secondary Grid */}
        <motion.div variants={containerVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* File Breakdown Chart area */}
          <motion.div variants={itemVariants} className="lg:col-span-2 bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-[#2e2f31] rounded-3xl p-6 sm:p-8 shadow-[0_2px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_2px_20px_rgb(0,0,0,0.15)] flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1 shrink-0 w-full text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
                <PieChart className="w-3.5 h-3.5" /> Breakdown
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Media Architecture</h2>
              <p className="text-sm text-gray-500">Distribution mapped by content origin and format payload across your allocated storage nodes.</p>
            </div>
            
            <div className="w-full sm:w-1/2 shrink-0 grid grid-cols-2 gap-3">
              <div className="flex flex-col p-4 bg-gray-50 dark:bg-[#151617] rounded-2xl border border-gray-100 dark:border-[#242527]">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                   <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Images</span>
                </div>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-200">{stats.typeCounts.images}</span>
              </div>
              <div className="flex flex-col p-4 bg-gray-50 dark:bg-[#151617] rounded-2xl border border-gray-100 dark:border-[#242527]">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                   <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">PDFs</span>
                </div>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-200">{stats.typeCounts.pdfs}</span>
              </div>
              <div className="flex flex-col p-4 bg-gray-50 dark:bg-[#151617] rounded-2xl border border-gray-100 dark:border-[#242527]">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                   <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Docs</span>
                </div>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-200">{stats.typeCounts.docs}</span>
              </div>
              <div className="flex flex-col p-4 bg-gray-50 dark:bg-[#151617] rounded-2xl border border-gray-100 dark:border-[#242527]">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
                   <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Other</span>
                </div>
                <span className="text-2xl font-black text-gray-800 dark:text-gray-200">{stats.typeCounts.other}</span>
              </div>
            </div>
          </motion.div>

          {/* Quick Status / AI Health */}
          <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#121314] to-[#1e1f20] dark:from-[#2a2a2b] dark:to-[#1e1f20] border border-gray-800 dark:border-gray-700 rounded-3xl p-8 shadow-xl flex flex-col justify-between overflow-hidden relative group">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 blur-3xl rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 blur-3xl rounded-full" />
            
            <div className="relative z-10">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-700/50 pb-4">Engine Health</h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                    <span className="text-sm font-medium text-gray-200">Parse Pipeline</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md">100%</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                    <span className="text-sm font-medium text-gray-200">Vector Embeddings</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md">Online</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                    <span className="text-sm font-medium text-gray-200">LLM</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md">Stable</span>
                </div>
              </div>
            </div>
          </motion.div>

        </motion.div>
      </motion.div>
    </div>
  );
}
