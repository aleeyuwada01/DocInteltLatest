import { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, X, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, sources?: any[] }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = protocol + '//' + window.location.host;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chunk') {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'ai') {
            lastMessage.content += data.text;
          } else {
            newMessages.push({ role: 'ai', content: data.text });
          }
          return newMessages;
        });
      } else if (data.type === 'done') {
        setIsLoading(false);
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'ai') {
            lastMessage.sources = data.sources;
          }
          return newMessages;
        });
      } else if (data.type === 'error') {
        setIsLoading(false);
        setMessages(prev => [...prev, { role: 'ai', content: data.message }]);
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !wsRef.current) return;
    
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setIsLoading(true);
    
    wsRef.current.send(JSON.stringify({ type: 'chat', query: input }));
    setInput('');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-white dark:bg-[#37393b] text-[#444746] dark:text-gray-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.24)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.1)] hover:bg-[#f8fafd] dark:hover:bg-[#4a4c4f] transition-all z-50 group"
      >
        <Sparkles className="w-6 h-6 group-hover:text-blue-600 transition-colors" />
      </button>
    );
  }

  return (
    <aside className="w-80 bg-white dark:bg-[#1e1f20] border-l border-gray-200/50 dark:border-gray-800/50 flex flex-col h-full shadow-sm z-40 transition-colors duration-200 m-4 ml-0 rounded-2xl overflow-hidden">
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
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.sources.map((src, idx) => (
                    <a 
                      key={idx} 
                      href={`/api/files/${src.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs bg-[#f0f4f9] dark:bg-[#282a2c] text-[#0b57d0] dark:text-[#a8c7fa] px-2 py-1 rounded-lg hover:bg-[#e9eef6] dark:hover:bg-[#37393b] transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      <span className="truncate max-w-[100px]">{src.originalName}</span>
                    </a>
                  ))}
                </div>
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
