import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, FileText, Loader2, ChevronDown, ChevronUp, Plus, MessageSquare, Trash2, Clock, Search, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabaseClient';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id?: string;
  role: 'user' | 'ai';
  content: string;
  primarySource?: any;
  relatedSources?: any[];
  sources?: any;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SearchEntry {
  id: string;
  query: string;
  result_count: number;
  created_at: string;
}

export function ChatPanel({ token, user, onPreviewFile }: { token: string; user: any; onPreviewFile: (fileId: string) => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'searches'>('chats');
  
  // Chat state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  
  // Search history
  const [searchHistory, setSearchHistory] = useState<SearchEntry[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load sessions on mount ────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      loadSessions();
      loadSearchHistory();
    }
  }, [user?.id]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (!error && data) setSessions(data);
    } catch (e) { console.error('Error loading sessions:', e); }
    finally { setSessionsLoading(false); }
  };

  const loadSearchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setSearchHistory(data);
    } catch (e) { console.error('Error loading search history:', e); }
  };

  const loadMessages = async (sessionId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setMessages(data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        ...(m.sources ? parseSources(m.sources) : {}),
      })));
    }
  };

  const parseSources = (sources: any) => {
    if (!sources || !Array.isArray(sources) || sources.length === 0) return {};
    const sorted = [...sources].sort((a, b) => (b.score || 0) - (a.score || 0));
    const seen = new Set<string>();
    const deduped = sorted.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    const [primary, ...related] = deduped;
    return { primarySource: primary || null, relatedSources: related };
  };

  // ── Create new session ────────────────────────────────────────────────────
  const createSession = async (title: string = 'New Chat'): Promise<string | null> => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, title })
      .select()
      .single();
    
    if (!error && data) {
      setSessions(prev => [data, ...prev]);
      return data.id;
    }
    return null;
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const selectSession = async (session: ChatSession) => {
    setActiveSessionId(session.id);
    setShowHistory(false);
    await loadMessages(session.id);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
    if (!error) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
      }
    }
  };

  const deleteSearchEntry = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('search_history').delete().eq('id', id);
    if (!error) setSearchHistory(prev => prev.filter(s => s.id !== id));
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !user) return;
    
    const query = input;
    const userMessage: ChatMessage = { role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Ensure we have a session
      let sessionId = activeSessionId;
      if (!sessionId) {
        const title = query.length > 50 ? query.substring(0, 47) + '…' : query;
        sessionId = await createSession(title);
        if (!sessionId) throw new Error('Failed to create chat session');
        setActiveSessionId(sessionId);
      }

      // Save user message to DB
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: query,
      });

      // Update session timestamp & title if first message
      await supabase.from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
      
      // 1. Embed query via backend
      let queryEmbedding: number[] = [];
      let sourceFiles: any[] = [];
      let context = '';

      try {
        const embedRes = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ text: query }),
        });
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          queryEmbedding = embedData.embedding || [];
        }
      } catch (e) {
        console.error('Error embedding query:', e);
      }
      
      // 2. Search vector DB
      if (queryEmbedding.length > 0) {
        const searchRes = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ embedding: queryEmbedding, topK: 10 }),
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const results = searchData.results || [];
          
          // Deduplicate by file_id and keep highest score per file
          const fileMap = new Map<string, any>();
          for (const r of results) {
            const fid = r.fileId || r.file_id;
            if (!fid) continue;
            const existing = fileMap.get(fid);
            if (!existing || (r.score || 0) > (existing.score || 0)) {
              fileMap.set(fid, { id: fid, name: r.fileName || r.original_name, score: r.score || 0, text: r.text });
            }
          }
          
          // Sort by score and filter out low-relevance results
          sourceFiles = Array.from(fileMap.values())
            .sort((a, b) => b.score - a.score)
            .filter(f => f.score > 0.15);
          
          // Fetch AI descriptions for all matched source files to enrich context
          if (sourceFiles.length > 0) {
            const fileIds = sourceFiles.map((f: any) => f.id);
            const { data: fileDetails } = await supabase
              .from('files')
              .select('id, original_name, ai_description, mime_type')
              .in('id', fileIds);
            
            if (fileDetails) {
              const detailMap = new Map(fileDetails.map((f: any) => [f.id, f]));
              // Build rich context with AI descriptions
              context = sourceFiles.map((src: any) => {
                const detail = detailMap.get(src.id);
                const aiDesc = detail?.ai_description || '';
                const mimeType = detail?.mime_type || '';
                const fileName = detail?.original_name || src.name;
                const fileType = mimeType.startsWith('image/') ? 'Image' : mimeType === 'application/pdf' ? 'PDF Document' : 'Document';
                
                let entry = `[File: ${fileName}] (${fileType})`;
                if (aiDesc) {
                  entry += `\nAI Analysis: ${aiDesc}`;
                }
                if (src.text && src.text !== aiDesc) {
                  entry += `\nExtracted Content: ${src.text}`;
                }
                return entry;
              }).join('\n\n---\n\n');
            }
          }
          
          // Fallback: if no AI descriptions were fetched, use raw search text
          if (!context) {
            context = results
              .filter((r: any) => (r.score || 0) > 0.15)
              .map((r: any) => `[File: ${r.fileName || r.original_name}]\n${r.text}`)
              .join('\n\n---\n\n');
          }
        }
      }

      // Save search to history
      if (queryEmbedding.length > 0) {
        await supabase.from('search_history').insert({
          user_id: user.id,
          query: query,
          results: sourceFiles,
          result_count: sourceFiles.length,
        });
        loadSearchHistory();
      }
      
      // 3. Send to Gemini with a document-search-aware prompt
      const prompt = `You are DocIntel AI — an intelligent assistant that helps users find and understand files stored in their personal document drive.

CRITICAL CONTEXT: The user is ALWAYS asking about their uploaded files, documents, images, or PDFs. They are NOT asking for general knowledge or real-world services. When a user says "find me a doctor", they mean "find a file or image in my drive that relates to a doctor." When they say "looking for a politician", they mean "find an image or document about a politician in my files."

INTELLIGENT BEHAVIOR:
- If the user makes a typo or unclear request, interpret their most likely intent and state what you searched for. Example: "I interpreted your request as looking for files about [topic]."
- If results seem ambiguous, ask a clarifying follow-up question.
- Suggest what the user could do next (e.g., "Would you like me to find similar documents?" or "Try searching for [alternative term].")
- Always be helpful and proactive, never dismissive.

Your job:
1. Search the provided file context to find which files match the user's request.
2. When you find matching files, describe what the file contains and state its exact filename clearly.
3. If multiple files match, list them all with brief descriptions.
4. Be confident in your matches — if an AI analysis mentions the topic the user is looking for, that IS a match.
5. Never say "I cannot help" if there are files in the context. Always describe what files are available and suggest which one might be what the user is looking for.
6. Keep responses concise and focused. Use bullet points for multiple results.

Here are the files found in the user's drive:
${context || '(No files matched the search query)'}

User's request: ${query}`;


      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setMessages(prev => [...prev, { role: 'ai', content: '' }]);

      let fullResponse = '';
      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        fullResponse += text;
        // Use fullResponse as the single source of truth to prevent duplication
        const snapshot = fullResponse;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'ai') {
            lastMessage.content = snapshot;
          }
          return newMessages;
        });
      }
      
      // Determine primary source by finding which file the AI FIRST mentions
      // in its response — not just the first match from the embedding-sorted list
      const responseLower = fullResponse.toLowerCase();
      let primarySource = sourceFiles[0] || null;
      let earliestPosition = Infinity;
      
      for (const src of sourceFiles) {
        const srcName = (src.name || '').toLowerCase();
        if (!srcName) continue;
        
        // Check exact filename match position in AI response
        let pos = responseLower.indexOf(srcName);
        
        // Also check partial name match (without extension)
        if (pos === -1) {
          const baseName = srcName.replace(/\.[^.]+$/, '');
          if (baseName.length > 3) {
            pos = responseLower.indexOf(baseName);
          }
        }
        
        // The file mentioned earliest in the response is the true best match
        if (pos !== -1 && pos < earliestPosition) {
          earliestPosition = pos;
          primarySource = src;
        }
      }
      
      // Fetch truly related files from the server using the primary file's AI description
      let relatedSources: any[] = [];
      if (primarySource?.id) {
        try {
          const relatedRes = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mode: 'related', fileId: primarySource.id, topK: 5 }),
          });
          if (relatedRes.ok) {
            const relatedData = await relatedRes.json();
            relatedSources = (relatedData.results || []).map((r: any) => ({
              id: r.file_id,
              name: r.fileName || r.original_name,
              score: r.score,
            }));
          }
        } catch { /* ignore related files errors */ }
      }

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'ai') {
          lastMessage.primarySource = primarySource;
          lastMessage.relatedSources = relatedSources;
        }
        return newMessages;
      });

      // Save AI message to DB
      await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'ai',
        content: fullResponse,
        sources: sourceFiles,
      });
      
    } catch (error: any) {
      console.error('Chat error:', error);
      let errMsg = error.message || '';
      
      // Look for Gemini Rate Limits or ugly JSON dumps
      if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        errMsg = "AI usage quota temporarily exceeded. Please wait a moment and try again.";
      } else if (errMsg.startsWith('{') && errMsg.includes('error')) {
        try {
          const parsed = JSON.parse(errMsg);
          if (parsed.error?.message) {
            errMsg = parsed.error.message;
            if (errMsg.includes('429') || errMsg.includes('quota')) {
              errMsg = "AI usage quota temporarily exceeded. Please wait a moment and try again.";
            }
          } else {
             errMsg = "An unexpected error occurred while processing your request.";
          }
        } catch { /* if it fails to parse, leave as is, but maybe trim if too long */ }
      }
      
      if (errMsg.length > 200) {
         errMsg = errMsg.substring(0, 150) + "... (An unexpected system error occurred).";
      }

      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: `**System Notice:** ${errMsg || 'An error occurred processing your request.'}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Group sessions by date ────────────────────────────────────────────────
  const groupByDate = <T extends { created_at?: string; updated_at?: string }>(items: T[], dateField: 'created_at' | 'updated_at' = 'updated_at') => {
    const groups: { label: string; items: T[] }[] = [];
    const buckets: Record<string, T[]> = {};
    
    items.forEach(item => {
      const d = new Date((item as any)[dateField]);
      let label = '';
      if (isToday(d)) label = 'Today';
      else if (isYesterday(d)) label = 'Yesterday';
      else if (isThisWeek(d)) label = 'This Week';
      else if (isThisMonth(d)) label = 'This Month';
      else label = format(d, 'MMMM yyyy');
      
      if (!buckets[label]) buckets[label] = [];
      buckets[label].push(item);
    });
    
    Object.entries(buckets).forEach(([label, items]) => {
      groups.push({ label, items });
    });
    
    return groups;
  };

  // ── Collapsed FAB ─────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <AnimatePresence>
        <motion.button 
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 px-6 py-4 bg-white/90 dark:bg-[#1e1f20]/90 backdrop-blur-2xl text-blue-600 dark:text-blue-400 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/40 dark:border-gray-800/60 z-50 group flex items-center justify-center gap-3 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <MessageSquare className="w-5 h-5 relative z-10" />
          <span className="font-bold relative z-10 tracking-wide text-gray-900 dark:text-white">Ask DocIntel AI</span>
        </motion.button>
      </AnimatePresence>
    );
  }

  // ── History Panel ─────────────────────────────────────────────────────────
  if (showHistory) {
    const sessionGroups = groupByDate(sessions, 'updated_at');
    const searchGroups = groupByDate(searchHistory, 'created_at');

    return (
      <motion.aside 
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        className="fixed bottom-4 right-4 z-50 w-[calc(100vw-32px)] h-[85vh] md:relative md:inset-auto md:z-auto md:w-[340px] bg-white/80 dark:bg-[#121314]/80 backdrop-blur-2xl border border-white/40 dark:border-gray-800/60 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.12)] lg:h-full rounded-3xl overflow-hidden shrink-0 min-h-0"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/30 flex justify-between items-center bg-transparent">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <span className="font-bold tracking-tight">Timeline</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startNewChat} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 text-gray-500 transition-colors" title="New thread">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setShowHistory(false)} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 text-gray-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#f0f4f9] dark:bg-[#282a2c] m-3 rounded-xl p-1 gap-1">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'chats' ? 'bg-white dark:bg-[#37393b] text-[#1a1a2e] dark:text-white shadow-sm' : 'text-[#5f6368] dark:text-[#9aa0a6]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chats ({sessions.length})
          </button>
          <button 
            onClick={() => setActiveTab('searches')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'searches' ? 'bg-white dark:bg-[#37393b] text-[#1a1a2e] dark:text-white shadow-sm' : 'text-[#5f6368] dark:text-[#9aa0a6]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Searches ({searchHistory.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {activeTab === 'chats' ? (
            sessionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-[#9aa0a6]">No chat history yet</p>
                <p className="text-xs text-[#c4c7c5] mt-1">Start a conversation to see it here</p>
              </div>
            ) : (
              sessionGroups.map(group => (
                <div key={group.label} className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-2 px-1">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(session => (
                      <div
                        key={session.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectSession(session)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') selectSession(session);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group cursor-pointer ${
                          activeSessionId === session.id
                            ? 'bg-[#e8f0fe] dark:bg-[#0b3d91]/30 text-[#0b57d0] dark:text-[#a8c7fa]'
                            : 'hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] text-[#444746] dark:text-[#c4c7c5]'
                        }`}
                      >
                        <MessageSquare className="w-4 h-4 shrink-0 opacity-60" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{session.title}</p>
                          <p className="text-[10px] opacity-50 mt-0.5">{format(new Date(session.updated_at), 'h:mm a')}</p>
                        </div>
                        <button
                          title="Delete session"
                          onClick={(e) => deleteSession(session.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all shrink-0 focus:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            searchHistory.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-[#9aa0a6]">No search history yet</p>
                <p className="text-xs text-[#c4c7c5] mt-1">Your AI searches will appear here</p>
              </div>
            ) : (
              searchGroups.map(group => (
                <div key={group.label} className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-2 px-1">{group.label}</p>
                  <div className="space-y-1">
                    {group.items.map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] transition-all group"
                      >
                        <Search className="w-4 h-4 shrink-0 opacity-40 text-[#444746] dark:text-[#c4c7c5]" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#444746] dark:text-[#c4c7c5] truncate">{entry.query}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-[#9aa0a6]">{format(new Date(entry.created_at), 'h:mm a')}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 font-medium">
                              {entry.result_count} results
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => deleteSearchEntry(entry.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-all shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </motion.aside>
    );
  }

  // ── Main Chat Panel ───────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.aside 
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        className="fixed bottom-4 right-4 z-50 w-[calc(100vw-32px)] h-[85vh] md:relative md:inset-auto md:z-auto md:w-[340px] bg-white/80 dark:bg-[#121314]/80 backdrop-blur-2xl border border-white/40 dark:border-gray-800/60 flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.12)] lg:h-full rounded-3xl overflow-hidden shrink-0 min-h-0"
      >
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/30 flex justify-between items-center bg-transparent">
          <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            <span className="font-bold tracking-tight">DocIntel Core</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setShowHistory(true); loadSessions(); loadSearchHistory(); }} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 text-gray-500 transition-colors" title="History">
              <History className="w-4 h-4" />
            </button>
            <button onClick={startNewChat} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 text-gray-500 transition-colors" title="New thread">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 text-gray-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-transparent">
        {messages.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center text-gray-500 mt-6 px-2">
            <div className="w-16 h-16 mx-auto mb-4 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
              <Sparkles className="w-8 h-8 text-blue-500 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 tracking-tight">How can I assist?</h3>
            <div className="grid grid-cols-1 gap-2.5 text-left">
              {[
                { icon: '🔍', title: 'Find specific records', desc: 'Search by topic or entities', prompt: 'Find documents containing keywords about...' },
                { icon: '📊', title: 'Synthesize data', desc: 'Get summaries across files', prompt: 'Summarize the key insights from my uploaded reports' },
                { icon: '🖼️', title: 'Locate images', desc: 'Find images matching a description', prompt: 'Find images or screenshots that show...' },
                { icon: '📁', title: 'Cross-reference', desc: 'Correlate content domains', prompt: 'Compare the content across my recent documents' },
              ].map((card, i) => (
                <motion.button
                  key={card.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => setInput(card.prompt)}
                  className="flex items-start gap-3 p-3.5 rounded-2xl text-left bg-white/50 dark:bg-[#1e1f20]/50 hover:bg-white dark:hover:bg-[#282a2c] shadow-sm hover:shadow-md transition-all border border-white/40 dark:border-gray-700/50 group"
                >
                  <span className="text-lg bg-gray-50 dark:bg-black/20 p-2 rounded-xl group-hover:scale-110 transition-transform">{card.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{card.title}</p>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{card.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={i} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[88%] rounded-3xl px-5 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'}`}>
                {msg.role === 'ai' ? (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 dark:prose-pre:bg-black/30 text-[13px] dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-[13px] font-medium leading-relaxed">{msg.content}</p>
                )}
              </div>
              
              {/* Primary source with confidence score */}
              {msg.primarySource && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 w-full max-w-[85%]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Verified Source</p>
                  <button
                    onClick={() => onPreviewFile(msg.primarySource.id)}
                    className="relative flex items-center gap-2.5 text-xs text-blue-600 dark:text-blue-400 px-3 py-2.5 rounded-xl bg-white/60 dark:bg-[#1e1f20]/60 hover:bg-white dark:hover:bg-[#282a2c] shadow-sm active:scale-[0.98] transition-all border border-blue-100/50 dark:border-blue-900/30 w-full overflow-hidden"
                    style={{
                      background: msg.primarySource.score
                        ? `linear-gradient(90deg, rgba(59,130,246,${Math.min(msg.primarySource.score * 0.1, 0.15)}) 0%, transparent 100%)`
                        : undefined,
                    }}
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate font-semibold flex-1 text-left">{msg.primarySource.name}</span>
                    {msg.primarySource.score ? (
                      <span className={`text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full ${
                        msg.primarySource.score >= 0.7
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : msg.primarySource.score >= 0.4
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {Math.round(msg.primarySource.score * 100)}%
                      </span>
                    ) : (
                      <span className="text-[10px] opacity-60 shrink-0">Best match</span>
                    )}
                  </button>
                </motion.div>
              )}

              {/* Related sources */}
              {msg.relatedSources && msg.relatedSources.length > 0 && (
                <RelatedSources sources={msg.relatedSources} onPreviewFile={onPreviewFile} />
              )}
            </motion.div>
          ))
        )}
        {isLoading && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-start">
            <div className="bg-white/60 dark:bg-[#1e1f20]/60 backdrop-blur rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3 text-gray-500 shadow-sm border border-gray-100 dark:border-gray-800">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Processing...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 bg-[#f8fafd]/80 dark:bg-[#121314]/80 backdrop-blur-xl border-t border-gray-200/50 dark:border-gray-800/80">
        <div className="relative flex items-center bg-white dark:bg-[#1e1f20] border border-gray-200 dark:border-gray-700 shadow-sm rounded-full overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask DocIntel Core..."
            className="w-full pl-5 pr-12 py-3.5 bg-transparent border-none text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-0 disabled:scale-75 transition-all"
          >
            <Send className="w-4 h-4 translate-x-[1px] translate-y-[-1px]" />
          </button>
        </div>
      </div>
    </motion.aside>
    </AnimatePresence>
  );
}

// ─── RelatedSources subcomponent ─────────────────────────────────────────────
function RelatedSources({ sources, onPreviewFile }: { sources: any[]; onPreviewFile: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5 w-full max-w-[85%]">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#444746] dark:text-[#c4c7c5] hover:text-[#1f1f1f] dark:hover:text-[#e3e3e3] transition-colors mb-1 ml-0.5"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Related files ({sources.length})
      </button>

      {expanded && (
        <div className="flex flex-col gap-1">
          {sources.map((src, idx) => (
            <button
              key={idx}
              onClick={() => onPreviewFile(src.id)}
              className="flex items-center gap-2 text-xs text-[#444746] dark:text-[#c4c7c5] px-3 py-1.5 rounded-lg hover:bg-[#e9eef6] dark:hover:bg-[#37393b] active:scale-[0.98] transition-all border border-gray-200/50 dark:border-gray-700/50 text-left w-full"
              style={{
                background: src.score
                  ? `linear-gradient(90deg, rgba(34,197,94,${Math.min(src.score * 0.2, 0.15)}) 0%, transparent 60%)`
                  : undefined,
              }}
            >
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="truncate flex-1">{src.name}</span>
              {src.score && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                  src.score >= 0.6
                    ? 'bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : src.score >= 0.35
                    ? 'bg-amber-100/80 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                }`}>
                  {Math.round(src.score * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
