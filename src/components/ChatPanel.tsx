import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';

export function ChatPanel({ token, onPreviewFile }: { token: string; onPreviewFile: (fileId: string) => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, primarySource?: any, relatedSources?: any[] }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const query = input;
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setInput('');
    setIsLoading(true);
    
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });
      
      // 1. Embed query via backend (uses v1 REST API, bypasses SDK v1beta bug)
      let queryEmbedding: number[] = [];
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
      
      // 2. Search vector DB via backend
      let context = '';
      let sourceFiles: any[] = [];
      
      if (queryEmbedding.length > 0) {
        const searchRes = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ embedding: queryEmbedding, topK: 5 }),
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          // Build context from search results (already sorted by score desc)
          const results = searchData.results || [];
          sourceFiles = results.map((r: any) => ({ id: r.fileId, name: r.fileName, score: r.score }));
          context = results.map((r: any) => `[Source: ${r.fileName}]\n${r.text}`).join('\n\n---\n\n');
        }
      }
      
      // 3. Send to Gemini for chat response (SDK works fine for generateContent)
      const prompt = `You are DocIntel, an intelligent document assistant.
Answer the user's query based on the provided document context.
If the context doesn't contain the answer, say so, but try to be helpful.
Always reference which source document the information comes from.

Context:
${context || '(No documents found matching the query)'}

User Query: ${query}`;

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setMessages(prev => [...prev, { role: 'ai', content: '' }]);

      for await (const chunk of responseStream) {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'ai') {
            lastMessage.content += chunk.text;
          }
          return newMessages;
        });
      }
      
      // Split sources: best score = primary, rest = related
      const sortedSources = [...sourceFiles].sort((a, b) => (b.score || 0) - (a.score || 0));
      // Deduplicate by fileId (multiple chunks from same file)
      const seen = new Set<string>();
      const dedupedSources = sortedSources.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      const [primarySource, ...relatedSources] = dedupedSources;

      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'ai') {
          lastMessage.primarySource = primarySource || null;
          lastMessage.relatedSources = relatedSources;
        }
        return newMessages;
      });
      
    } catch (error: any) {

      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'ai', content: 'An error occurred processing your request. ' + (error.message || '') }]);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[calc(100vw-32px)] h-[85vh] md:relative md:inset-auto md:z-auto md:w-80 bg-white/95 dark:bg-[#1e1f20]/95 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 flex flex-col shadow-2xl md:shadow-sm md:h-full transition-all duration-300 rounded-2xl overflow-hidden shrink-0 min-h-0">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 flex justify-between items-center bg-white dark:bg-[#1e1f20]">
        <div className="flex items-center gap-2 text-[#1f1f1f] dark:text-[#e3e3e3]">
          <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium">DocIntel AI</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-[#444746] hover:text-[#1f1f1f] dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3] p-1 rounded-full hover:bg-[#f0f4f9] dark:hover:bg-[#37393b] transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#1e1f20]">
        {messages.length === 0 ? (
          <div className="text-center text-[#444746] dark:text-[#c4c7c5] mt-10">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-blue-600/20 dark:text-blue-400/20" />
            <h3 className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-2">Ask about your files</h3>
            <p className="text-sm">Try asking:</p>
            <ul className="text-sm mt-2 space-y-2 text-[#0b57d0] dark:text-[#a8c7fa]">
              <li className="cursor-pointer hover:underline" onClick={() => setInput("Summarize my recent documents")}>"Summarize my recent documents"</li>
              <li className="cursor-pointer hover:underline" onClick={() => setInput("Find files related to budget")}>"Find files related to budget"</li>
            </ul>
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
              
              {/* Primary source — best match */}
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

              {/* Related sources — lower relevance */}
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
