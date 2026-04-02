import { useEffect, useRef, useState } from 'react';
import { FileText, Search, Sparkles, Users, Zap, Shield, ChevronRight, ArrowRight, Brain } from 'lucide-react';

/* ── Brand logo (non-triangle) ───────────────────────────────── */
export function DocIntelLogo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-blue-600 ${className}`}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" fill="currentColor" fillOpacity="0.15"/>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

/* ── AI Processing Animation ─────────────────────────────────── */
function AIProcessingAnimation() {
  return (
    <div className="relative w-full max-w-5xl mx-auto h-[400px] flex items-center justify-center mt-10">
      {/* Background soft glow */}
      <div className="absolute inset-0 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      <svg viewBox="0 0 800 400" className="w-full h-full pointer-events-none drop-shadow-sm">
        <defs>
          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="node-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* Connecting Data Lines */}
        <path d="M 150 200 C 250 200 300 200 400 200" stroke="url(#line-grad)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-[dash_3s_linear_infinite]" />
        <path d="M 150 100 C 250 100 300 200 400 200" stroke="url(#line-grad)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-[dash_3s_linear_infinite]" />
        <path d="M 150 300 C 250 300 300 200 400 200" stroke="url(#line-grad)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-[dash_3s_linear_infinite]" />
        
        <path d="M 400 200 C 500 200 550 100 650 100" stroke="url(#line-grad)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-[dash_3s_linear_infinite]" />
        <path d="M 400 200 C 500 200 550 200 650 200" stroke="url(#line-grad)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-[dash_3s_linear_infinite]" />
        <path d="M 400 200 C 500 200 550 300 650 300" stroke="url(#line-grad)" strokeWidth="2" fill="none" strokeDasharray="6 6" className="animate-[dash_3s_linear_infinite]" />

        {/* Central AI Engine Node */}
        <g transform="translate(400, 200)">
          <circle cx="0" cy="0" r="55" fill="url(#node-grad)" fillOpacity="0.1" stroke="url(#node-grad)" strokeWidth="3" className="animate-pulse" />
          <circle cx="0" cy="0" r="50" fill="white" stroke="url(#node-grad)" strokeWidth="4" />
          <text x="0" y="5" fontSize="16" fill="#8b5cf6" textAnchor="middle" fontWeight="900" letterSpacing="0.5">DocIntel</text>
        </g>

        {/* Incoming Files (Left) Sliding Into Center */}
        <g style={{ animation: 'slideIn1 4s linear infinite', transformOrigin: 'center' }}>
          <rect x="0" y="0" width="40" height="50" rx="6" fill="white" stroke="#ea4335" strokeWidth="2" />
          <path d="M 10 15 h 20 M 10 25 h 20 M 10 35 h 12" stroke="#ea4335" strokeWidth="2" strokeLinecap="round" />
          <text x="20" y="-12" fontSize="12" fill="#ea4335" textAnchor="middle" fontWeight="bold">PDF</text>
        </g>
        <g style={{ animation: 'slideIn2 5s linear infinite 1s', transformOrigin: 'center', opacity: 0 }}>
          <rect x="0" y="0" width="40" height="50" rx="6" fill="white" stroke="#34a853" strokeWidth="2" />
          <circle cx="20" cy="22" r="10" stroke="#34a853" strokeWidth="2" fill="none" />
          <path d="M 12 30 L 28 30" stroke="#34a853" strokeWidth="2" strokeLinecap="round" />
          <text x="20" y="-12" fontSize="12" fill="#34a853" textAnchor="middle" fontWeight="bold">IMG</text>
        </g>
        <g style={{ animation: 'slideIn3 4.5s linear infinite 2.5s', transformOrigin: 'center', opacity: 0 }}>
          <rect x="0" y="0" width="40" height="50" rx="6" fill="white" stroke="#fbbc04" strokeWidth="2" />
          <path d="M 10 15 h 20 M 10 25 h 20 M 10 35 h 20" stroke="#fbbc04" strokeWidth="2" strokeLinecap="round" />
          <text x="20" y="-12" fontSize="12" fill="#fbbc04" textAnchor="middle" fontWeight="bold">DOC</text>
        </g>

        {/* Outgoing Insights (Right) */}
        <g transform="translate(600, 80)">
          <rect x="0" y="0" width="110" height="40" rx="8" fill="#eff6ff" stroke="#3b82f6" strokeWidth="2" />
          <circle cx="20" cy="20" r="4" fill="#3b82f6" className="animate-pulse" />
          <text x="65" y="24" fontSize="11" fill="#3b82f6" textAnchor="middle" fontWeight="bold" letterSpacing="1">VECTORS</text>
        </g>
        <g transform="translate(600, 180)">
          <rect x="0" y="0" width="110" height="40" rx="8" fill="#f5f3ff" stroke="#8b5cf6" strokeWidth="2" />
          <path d="M 12 21 L 18 13 L 26 24 L 32 17" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="65" y="24" fontSize="11" fill="#8b5cf6" textAnchor="middle" fontWeight="bold" letterSpacing="1">INSIGHT</text>
        </g>
        <g transform="translate(600, 280)">
          <rect x="0" y="0" width="110" height="40" rx="8" fill="#ecfdf5" stroke="#10b981" strokeWidth="2" />
          <rect x="14" y="14" width="8" height="12" rx="1" fill="#10b981" />
          <rect x="24" y="18" width="8" height="8" rx="1" fill="#10b981" />
          <text x="65" y="24" fontSize="11" fill="#10b981" textAnchor="middle" fontWeight="bold" letterSpacing="1">DATA</text>
        </g>

        <style>
          {`
            @keyframes dash {
               to { stroke-dashoffset: -24; }
            }
            @keyframes slideIn1 {
               0%   { transform: translate(40px, 175px) scale(1); opacity: 0; }
               10%  { opacity: 1; }
               60%  { transform: translate(360px, 175px) scale(0.3); opacity: 0; }
               100% { transform: translate(360px, 175px) scale(0.3); opacity: 0; }
            }
            @keyframes slideIn2 {
               0%   { transform: translate(20px, 75px) scale(1); opacity: 0; }
               10%  { opacity: 1; }
               60%  { transform: translate(360px, 180px) scale(0.3); opacity: 0; }
               100% { transform: translate(360px, 180px) scale(0.3); opacity: 0; }
            }
            @keyframes slideIn3 {
               0%   { transform: translate(40px, 275px) scale(1); opacity: 0; }
               10%  { opacity: 1; }
               60%  { transform: translate(360px, 190px) scale(0.3); opacity: 0; }
               100% { transform: translate(360px, 190px) scale(0.3); opacity: 0; }
            }
          `}
        </style>
      </svg>
    </div>
  );
}

/* ── Feature card ─────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className="group p-6 rounded-2xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-default">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>{icon}</div>
      <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Stat ────────────────────────────────────────────────────── */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

/* ── Landing Page ─────────────────────────────────────────────── */
export function LandingPage({ onGetStarted, onSignIn }: { onGetStarted: () => void; onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden">

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <DocIntelLogo size={32} />
            <span className="text-[17px] font-bold text-gray-900 tracking-tight">DocIntel</span>
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onSignIn}
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors px-3 py-2 rounded-xl hover:bg-gray-100">
              Sign In
            </button>
            <button onClick={onGetStarted}
              className="text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-full px-5 py-2.5 transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-5 pt-24 pb-12 overflow-hidden">


        {/* Soft glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] h-[300px] bg-gradient-radial from-blue-50/70 via-transparent to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-3xl mx-auto">
          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-gray-900 mb-5">
            Your documents,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1a56e8] via-[#a142f4] to-[#ea4335]">
              intelligently
            </span>{' '}organized.
          </h1>

          <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed mb-8 sm:mb-10">
            Upload any document — PDFs, images, spreadsheets — and instantly search,
            summarize, and chat with your files using state-of-the-art AI.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={onGetStarted}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-base font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-full px-8 py-3.5 transition-all shadow-lg hover:shadow-xl active:scale-[0.97]">
              Get started free
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={onSignIn}
              className="w-full sm:w-auto flex items-center justify-center gap-2 text-base font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-full px-8 py-3.5 transition-all shadow-sm hover:shadow-md">
              Sign in
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">No credit card required · Free to start</p>
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto hidden sm:block">
          <AIProcessingAnimation />
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <section className="bg-[#f8fafd] border-y border-gray-100 py-12 sm:py-14">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <Stat value="10x" label="Faster document search" />
          <Stat value="99.9%" label="Parsing accuracy" />
          <Stat value="1536-D" label="Vector search index" />
          <Stat value="< 2s" label="Average response time" />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
              Everything your docs need
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-xl mx-auto">
              A complete document intelligence platform — from upload to insight.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <FeatureCard icon={<FileText className="w-5 h-5 text-red-500" />} color="bg-red-50" title="AI-Powered Parsing"
              desc="Extract rich content from PDFs, scanned images, spreadsheets, and more — with industry-leading AI accuracy." />
            <FeatureCard icon={<Search className="w-5 h-5 text-blue-500" />} color="bg-blue-50" title="Semantic Vector Search"
              desc="Every document is chunked and embedded. Ask anything — find it instantly with semantic similarity." />
            <FeatureCard icon={<Sparkles className="w-5 h-5 text-purple-500" />} color="bg-purple-50" title="AI Chat Assistant"
              desc="Chat with your entire document library. Get streaming, cited, accurate answers in real time." />
            <FeatureCard icon={<Brain className="w-5 h-5 text-amber-500" />} color="bg-amber-50" title="Vision OCR"
              desc="Scanned documents? No problem. Our vision model extracts every character from images and handwritten notes." />
            <FeatureCard icon={<Users className="w-5 h-5 text-green-500" />} color="bg-green-50" title="Team Departments"
              desc="Create sub-accounts for departments. Share specific files and folders with fine-grained access control." />
            <FeatureCard icon={<Shield className="w-5 h-5 text-indigo-500" />} color="bg-indigo-50" title="Secure by Default"
              desc="JWT authentication, per-user storage isolation, and file deduplication keep your documents safe." />
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="bg-[#f8fafd] border-y border-gray-100 py-16 sm:py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Three steps to insight</h2>
            <p className="text-gray-500 text-base sm:text-lg">From upload to answer in seconds.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { n: '01', icon: <Zap className="w-5 h-5 text-blue-500" />, title: 'Upload', desc: 'Drop any file — PDF, image, Word doc. Our AI pipeline immediately starts parsing and indexing it.' },
              { n: '02', icon: <Brain className="w-5 h-5 text-purple-500" />, title: 'AI Processes', desc: 'Our engine extracts structure and embeds every chunk into a searchable vector database automatically.' },
              { n: '03', icon: <Sparkles className="w-5 h-5 text-green-500" />, title: 'Ask Anything', desc: 'Chat naturally. Ask questions across all your documents. Get cited, accurate answers in real time.' },
            ].map(s => (
              <div key={s.n} className="text-center">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">{s.n}</div>
                <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm">{s.icon}</div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-5 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            Start turning documents into intelligence
          </h2>
          <p className="text-gray-500 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Join teams who use DocIntel to understand their documents faster and smarter.
          </p>
          <button onClick={onGetStarted}
            className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-full px-8 sm:px-10 py-3.5 sm:py-4 transition-all shadow-xl hover:shadow-2xl active:scale-[0.97]">
            Create free account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 px-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DocIntelLogo size={22} />
            <span className="text-sm font-bold text-gray-700">DocIntel</span>
            <span className="text-xs text-gray-400">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Privacy</a>
            <a href="#" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
