import { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Check, ArrowLeft, FileText, Search, Users, Shield, Sparkles, Zap } from 'lucide-react';
import { DocIntelLogo } from './LandingPage';
import { supabase } from '../lib/supabaseClient';

/* ── Feature list shown on register side ─────────────────────── */
const REGISTER_FEATURES = [
  { icon: <FileText className="w-4 h-4 text-red-400" />,      text: 'Parse PDFs, images, Word docs with AI' },
  { icon: <Search className="w-4 h-4 text-blue-400" />,       text: '1536-dim semantic vector search' },
  { icon: <Sparkles className="w-4 h-4 text-purple-400" />,   text: 'Gemini 2.5 Flash AI chat assistant' },
  { icon: <Users className="w-4 h-4 text-green-400" />,       text: 'Department sub-accounts & file sharing' },
  { icon: <Zap className="w-4 h-4 text-amber-400" />,         text: 'Auto-parsing queue — hands free' },
  { icon: <Shield className="w-4 h-4 text-indigo-400" />,     text: 'Secure JWT auth · 1 GB free storage' },
];

export function Login({
  onLogin, onBack
}: { onLogin: (token: string, user: any) => void; onBack?: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && password !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Load profile from Supabase
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        const user = {
          id: data.user.id,
          username: profile?.username || email.split('@')[0],
          role: profile?.role || 'admin',
          email: data.user.email,
          storage_limit: profile?.storage_limit || 1073741824
        };
        onLogin(data.session.access_token, user);
        toast.success('Welcome back!');
      } else {
        const { data, error } = await supabase.auth.signUp({ 
          email, password,
          options: { data: { username: email.split('@')[0] } }
        });
        if (error) throw error;
        if (data.session) {
          // Profile is created by trigger, give it a moment
          await new Promise(r => setTimeout(r, 500));
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user!.id).single();
          const user = {
            id: data.user!.id,
            username: profile?.username || email.split('@')[0],
            role: profile?.role || 'admin',
            email: data.user!.email,
            storage_limit: profile?.storage_limit || 1073741824
          };
          onLogin(data.session.access_token, user);
          toast.success('Account created — welcome to DocIntel!');
        } else {
          toast.success('Account created! Please check your email.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const pwStrength = (() => {
    if (!password || isLogin) return null;
    if (password.length < 6) return { label: 'Weak', color: 'bg-red-400', w: 'w-1/4' };
    if (password.length < 10) return { label: 'Fair', color: 'bg-amber-400', w: 'w-1/2' };
    if (!/[0-9!@#$%^&*]/.test(password)) return { label: 'Good', color: 'bg-blue-400', w: 'w-3/4' };
    return { label: 'Strong', color: 'bg-green-500', w: 'w-full' };
  })();

  return (
    <div className="min-h-screen flex bg-[#f8fafd] dark:bg-[#0f1011]">

      {/* ── Left: Context panel (sign-in = blue brand, register = feature list) ── */}
      <div className={`hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-14 transition-colors duration-500 ${
        isLogin
          ? 'bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]'
          : 'bg-gradient-to-br from-[#0b57d0] via-[#1565c0] to-[#0d47a1]'
      }`}>
        {/* Decorative bg circles */}
        <div className="absolute top-[-80px] right-[-80px] w-[360px] h-[360px] rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-50px] w-[400px] h-[400px] rounded-full bg-white/5 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          {onBack && (
            <button onClick={onBack} className="mr-2 flex items-center gap-1 text-white/50 hover:text-white/80 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <DocIntelLogo size={36} />
          <span className="text-white text-xl font-semibold tracking-tight">DocIntel</span>
        </div>

        {/* Body */}
        <div className="relative z-10 max-w-md">
          {isLogin ? (
            // Sign-in panel — testimonial / brand copy
            <>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/80 text-xs font-medium">AI-Powered Document Intelligence</span>
              </div>
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
                Welcome back.<br />
                <span className="text-blue-200">Your docs await.</span>
              </h2>
              <p className="text-white/60 text-lg leading-relaxed mb-10">
                All your documents, AI-parsed and instantly searchable — exactly where you left them.
              </p>
              {/* Fake testimonial */}
              <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl p-5">
                <p className="text-white/80 text-sm leading-relaxed italic mb-4">
                  "DocIntel replaced our entire research workflow. I can find anything in our 2,000-doc library in seconds."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">S</div>
                  <div>
                    <p className="text-white text-xs font-semibold">Sarah K.</p>
                    <p className="text-white/50 text-[10px]">Research Lead · TechCorp</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Register panel — feature checklist
            <>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-8">
                <Zap className="w-3 h-3 text-yellow-300" />
                <span className="text-white/80 text-xs font-medium">Full access · Free to start</span>
              </div>
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
                Everything you need,<br />
                <span className="text-blue-200">day one.</span>
              </h2>
              <p className="text-white/60 text-base leading-relaxed mb-8">
                Create your free account and get instant access to all DocIntel features — no credit card, no limits.
              </p>
              <ul className="space-y-3.5">
                {REGISTER_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80 text-sm">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                      {f.icon}
                    </div>
                    {f.text}
                  </li>
                ))}
              </ul>
              {/* Plan callout */}
              <div className="mt-8 bg-white/10 border border-white/15 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-400/20 border border-green-400/30 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-green-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Starter plan included</p>
                  <p className="text-white/55 text-xs mt-0.5">1 GB storage · unlimited AI queries · upgrade anytime</p>
                </div>
              </div>
            </>
          )}
        </div>

          <p className="text-white/30 text-xs relative z-10">© {new Date().getFullYear()} DocIntel</p>
      </div>

      {/* ── Right: Auth form ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px] animate-slide-up">

          {/* Mobile: back + logo */}
          <div className="lg:hidden mb-8 flex items-center justify-between">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-1 text-[#5f6368] hover:text-[#1a1a2e] text-sm font-medium transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            <div className="flex items-center gap-2">
              <DocIntelLogo size={20} />
              <span className="text-base font-semibold text-[#1a1a2e] dark:text-white">DocIntel</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-[28px] font-bold text-[#1a1a2e] dark:text-white mb-1.5">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-[#5f6368] dark:text-[#9aa0a6] text-sm">
              {isLogin
                ? 'Sign in to access your document workspace.'
                : 'Start for free — no credit card required.'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex bg-[#f0f4f9] dark:bg-[#282a2c] rounded-xl p-1 mb-8 gap-1">
            {(['Sign In', 'Register'] as const).map((label, i) => (
              <button
                key={label}
                onClick={() => { setIsLogin(i === 0); setConfirmPw(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  (i === 0) === isLogin
                    ? 'bg-white dark:bg-[#37393b] text-[#1a1a2e] dark:text-white shadow-sm'
                    : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a1a2e] dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={isLogin ? 'Enter your password' : 'Create a strong password'}
                  className="input-field pr-12"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#5f6368] transition-colors p-1">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength bar (register only) */}
              {pwStrength && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[#9aa0a6]">Password strength</span>
                    <span className={`text-[10px] font-semibold ${
                      pwStrength.label === 'Strong' ? 'text-green-500' :
                      pwStrength.label === 'Good'   ? 'text-blue-500' :
                      pwStrength.label === 'Fair'   ? 'text-amber-500' : 'text-red-500'
                    }`}>{pwStrength.label}</span>
                  </div>
                  <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-1 rounded-full transition-all duration-300 ${pwStrength.color} ${pwStrength.w}`} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password — register only */}
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'} required
                    autoComplete="new-password"
                    value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Repeat your password"
                    className={`input-field pr-12 ${confirmPw && confirmPw !== password ? 'border-red-400 dark:border-red-500' : confirmPw && confirmPw === password ? 'border-green-400 dark:border-green-500' : ''}`}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#5f6368] transition-colors p-1">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  {confirmPw === password && confirmPw && (
                    <Check className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>
            )}

            {/* Terms checkbox — register only */}
            {!isLogin && (
              <label className="flex items-start gap-3 mt-1 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input type="checkbox" required className="sr-only peer" />
                  <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded peer-checked:bg-[#0b57d0] peer-checked:border-[#0b57d0] dark:peer-checked:bg-[#a8c7fa] dark:peer-checked:border-[#a8c7fa] transition-colors" />
                </div>
                <span className="text-xs text-[#9aa0a6] leading-relaxed">
                  I agree to the{' '}
                  <span className="text-[#0b57d0] dark:text-[#a8c7fa] hover:underline cursor-pointer">Terms of Service</span>
                  {' '}and{' '}
                  <span className="text-[#0b57d0] dark:text-[#a8c7fa] hover:underline cursor-pointer">Privacy Policy</span>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim() || (!isLogin && password !== confirmPw)}
              className="btn-primary w-full h-11 mt-2"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {isLogin ? 'Signing in…' : 'Creating account…'}</>
                : isLogin ? 'Sign In' : 'Create Free Account'
              }
            </button>
          </form>

          {!isLogin && (
            <div className="mt-6 grid grid-cols-3 gap-2.5">
              {[
                { icon: <Check className="w-3 h-3 text-green-500" />, text: 'Free forever' },
                { icon: <Check className="w-3 h-3 text-green-500" />, text: 'No credit card' },
                { icon: <Check className="w-3 h-3 text-green-500" />, text: 'Cancel anytime' },
              ].map(b => (
                <div key={b.text} className="flex items-center gap-1.5 text-[11px] text-[#9aa0a6]">
                  {b.icon} {b.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
