import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, FileText, Loader2, ChevronDown, ChevronUp, Plus, MessageSquare, Trash2, Clock, Search, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabaseClient';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

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
      
      // Determine primary source by checking which file the AI actually referenced
      // rather than relying solely on embedding similarity score
      const responseLower = fullResponse.toLowerCase();
      let primarySource = sourceFiles[0] || null;
      
      // Check which source file names appear in the AI's response
      for (const src of sourceFiles) {
        const srcName = (src.name || '').toLowerCase();
        if (srcName && responseLower.includes(srcName)) {
          primarySource = src;
          break; // First match in the AI response = most relevant
        }
        // Also check partial name match (without extension)
        const baseName = srcName.replace(/\.[^.]+$/, '');
        if (baseName.length > 5 && responseLower.includes(baseName)) {
          primarySource = src;
          break;
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
      setMessages(prev => [...prev, { role: 'ai', content: 'An error occurred processing your request. ' + (error.message || '') }]);
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
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 p-4 bg-white dark:bg-[#37393b] text-[#444746] dark:text-gray-200 rounded-full shadow-lg hover:shadow-xl hover:bg-[#f8fafd] dark:hover:bg-[#4a4c4f] hover:-translate-y-1 transition-all duration-300 z-50 group flex items-center justify-center border border-gray-200/50 dark:border-gray-700"
      >
        <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300" />
      </button>
    );
  }

  // ── History Panel ─────────────────────────────────────────────────────────
  if (showHistory) {
    const sessionGroups = groupByDate(sessions, 'updated_at');
    const searchGroups = groupByDate(searchHistory, 'created_at');

    return (
      <aside className="fixed bottom-4 right-4 z-50 w-[calc(100vw-32px)] h-[85vh] md:relative md:inset-auto md:z-auto md:w-80 bg-white/95 dark:bg-[#1e1f20]/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 flex flex-col shadow-2xl md:shadow-sm md:h-full transition-all duration-300 rounded-2xl overflow-hidden shrink-0 min-h-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 flex justify-between items-center bg-white dark:bg-[#1e1f20]">
          <div className="flex items-center gap-2 text-[#1f1f1f] dark:text-[#e3e3e3]">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">History</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={startNewChat} className="p-1.5 rounded-lg hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] text-[#444746] dark:text-[#c4c7c5] transition-colors" title="New chat">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => setShowHistory(false)} className="p-1.5 rounded-lg hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] text-[#444746] dark:text-[#c4c7c5] transition-colors">
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
      </aside>
    );
  }

  // ── Main Chat Panel ───────────────────────────────────────────────────────
  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[calc(100vw-32px)] h-[85vh] md:relative md:inset-auto md:z-auto md:w-80 bg-white/95 dark:bg-[#1e1f20]/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 flex flex-col shadow-2xl md:shadow-sm md:h-full transition-all duration-300 rounded-2xl overflow-hidden shrink-0 min-h-0">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 flex justify-between items-center bg-white dark:bg-[#1e1f20]">
        <div className="flex items-center gap-2 text-[#1f1f1f] dark:text-[#e3e3e3]">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium">DocIntel AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowHistory(true); loadSessions(); loadSearchHistory(); }} className="p-1.5 rounded-lg hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] text-[#444746] dark:text-[#c4c7c5] transition-colors" title="Chat history">
            <History className="w-4 h-4" />
          </button>
          <button onClick={startNewChat} className="p-1.5 rounded-lg hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] text-[#444746] dark:text-[#c4c7c5] transition-colors" title="New chat">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] text-[#444746] dark:text-[#c4c7c5] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#1e1f20]">
        {messages.length === 0 ? (
          <div className="text-center text-[#444746] dark:text-[#c4c7c5] mt-6 px-2">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-blue-600/20 dark:text-blue-400/20" />
            <h3 className="text-base font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-4">How can I help you today?</h3>
            <div className="grid grid-cols-1 gap-2 text-left">
              {[
                { icon: '🔍', title: 'Find specific files', desc: 'Search by topic, keyword, or description', prompt: 'Find documents containing keywords about...' },
                { icon: '📊', title: 'Analyze my documents', desc: 'Get summaries and key insights', prompt: 'Summarize the key insights from my uploaded reports' },
                { icon: '🖼️', title: 'Locate images', desc: 'Find images matching a description', prompt: 'Find images or screenshots that show...' },
                { icon: '📁', title: 'Compare documents', desc: 'Cross-reference content across files', prompt: 'Compare the content across my recent documents' },
              ].map((card) => (
                <button
                  key={card.title}
                  onClick={() => setInput(card.prompt)}
                  className="flex items-start gap-3 p-3 rounded-xl text-left hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] transition-colors border border-transparent hover:border-gray-200/60 dark:hover:border-gray-700/50 group"
                >
                  <span className="text-lg mt-0.5">{card.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3] group-hover:text-[#0b57d0] dark:group-hover:text-[#a8c7fa] transition-colors">{card.title}</p>
                    <p className="text-xs text-[#9aa0a6] mt-0.5">{card.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${msg.role === 'user' ? 'bg-[#c2e7ff] dark:bg-[#004a77] text-[#001d35] dark:text-[#c2e7ff] rounded-tr-sm' : 'bg-[#f0f4f9] dark:bg-[#282a2c] text-[#1f1f1f] dark:text-[#e3e3e3] rounded-tl-sm'}`}>
                {msg.role === 'ai' ? (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-white dark:prose-pre:bg-[#1e1f20] prose-pre:text-[#1f1f1f] dark:prose-pre:text-[#e3e3e3] dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              
              {/* Primary source */}
              {msg.primarySource && (
                <div className="mt-2 w-full max-w-[85%]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#444746] dark:text-[#c4c7c5] mb-1.5 ml-0.5">Source</p>
                  <button
                    onClick={() => onPreviewFile(msg.primarySource.id)}
                    className="flex items-center gap-2 text-xs bg-[#e8f0fe] dark:bg-[#0b3d91]/30 text-[#0b57d0] dark:text-[#a8c7fa] px-3 py-2 rounded-xl hover:bg-[#d2e3fc] dark:hover:bg-[#0b3d91]/50 active:scale-[0.98] transition-all border border-[#0b57d0]/15 dark:border-[#a8c7fa]/20 w-full"
                  >
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate font-semibold flex-1 text-left">{msg.primarySource.name}</span>
                    <span className="text-[10px] opacity-60 shrink-0">Best match</span>
                  </button>
                </div>
              )}

              {/* Related sources */}
              {msg.relatedSources && msg.relatedSources.length > 0 && (
                <RelatedSources sources={msg.relatedSources} onPreviewFile={onPreviewFile} />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-[#f0f4f9] dark:bg-[#282a2c] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-[#444746] dark:text-[#c4c7c5]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-[#1e1f20] border-t border-gray-100 dark:border-gray-800/50">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask DocIntel AI..."
            className="w-full pl-4 pr-12 py-3 bg-[#f0f4f9] dark:bg-[#282a2c] border-transparent rounded-full focus:bg-white dark:focus:bg-[#37393b] focus:shadow-[0_1px_1px_rgba(0,0,0,0.1)] transition-all text-sm text-[#1f1f1f] dark:text-[#e3e3e3] placeholder-[#444746] dark:placeholder-[#c4c7c5] focus:outline-none"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 text-[#0b57d0] dark:text-[#a8c7fa] rounded-full hover:bg-[#e9eef6] dark:hover:bg-[#37393b] disabled:opacity-50 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="text-center mt-2">
          <span className="text-[10px] text-[#444746] dark:text-[#c4c7c5]">DocIntel AI can make mistakes. Check important info.</span>
        </div>
      </div>
    </aside>
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
              className="flex items-center gap-2 text-xs bg-[#f0f4f9] dark:bg-[#282a2c] text-[#444746] dark:text-[#c4c7c5] px-3 py-1.5 rounded-lg hover:bg-[#e9eef6] dark:hover:bg-[#37393b] active:scale-[0.98] transition-all border border-gray-200/50 dark:border-gray-700/50 text-left w-full"
            >
              <FileText className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="truncate flex-1">{src.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
