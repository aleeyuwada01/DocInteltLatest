import { Search, Settings, Moon, Sun, LogOut, Activity, Menu, X, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

function StatusDot({ status }: { status: 'ok' | 'error' | 'loading' }) {
  return (
    <span className={`status-dot ${status}`} />
  );
}

export function Topbar({
  darkMode, setDarkMode, user, onLogout, onSettings, token, onMenuClick
}: any) {
  const [health, setHealth] = useState<any>(null);
  const [showHealth, setShowHealth] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const healthRef = useRef<HTMLDivElement>(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health');
      setHealth(await res.json());
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => { if (token) fetchHealth(); }, [token]);

  // Close health panel on outside click
  useEffect(() => {
    if (!showHealth) return;
    const handler = (e: MouseEvent) => {
      if (healthRef.current && !healthRef.current.contains(e.target as Node)) {
        setShowHealth(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHealth]);

  const overallStatus: 'ok' | 'error' | 'loading' = !health ? 'loading'
    : health.llamaparse?.status === 'ok' && health.gemini?.status === 'ok' ? 'ok'
    : 'error';

  return (
    <header className="h-[60px] bg-[#f8fafd] dark:bg-[#131314] flex items-center gap-3 px-4 border-b border-gray-200/40 dark:border-gray-800/40 transition-colors duration-200 shrink-0">

      {/* Mobile menu trigger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-1 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] rounded-xl transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search bar */}
      <div className={`relative flex-1 max-w-2xl transition-all duration-300 ${searchFocused ? 'max-w-3xl' : ''}`}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className={`h-4 w-4 transition-colors duration-150 ${searchFocused ? 'text-[#0b57d0] dark:text-[#a8c7fa]' : 'text-[#5f6368] dark:text-[#9aa0a6]'}`} />
        </div>
        <input
          type="text"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={`block w-full pl-11 pr-4 py-2.5 rounded-2xl text-sm text-[#1a1a2e] dark:text-gray-100 placeholder-[#9aa0a6] dark:placeholder-[#5f6368] transition-all duration-200 border ${
            searchFocused
              ? 'bg-white dark:bg-[#282a2c] shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] border-[#0b57d0]/30 dark:border-[#a8c7fa]/30'
              : 'bg-[#e9eef6] dark:bg-[#282a2c] border-transparent hover:bg-[#f0f4f9] dark:hover:bg-[#37393b]'
          } focus:outline-none`}
          placeholder="Search in Drive…"
        />
        {searchFocused && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1e1f20] rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-xl p-3 z-30 animate-slide-up">
            <p className="text-xs text-[#9aa0a6] px-2 pt-1 pb-2 font-medium">AI-powered search coming soon — use the chat panel to search your documents.</p>
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1 ml-auto">

        {/* Health indicator */}
        <div className="relative" ref={healthRef}>
          <button
            onClick={() => { setShowHealth(v => !v); if (!showHealth) fetchHealth(); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
              showHealth
                ? 'bg-[#e9eef6] dark:bg-[#282a2c] text-[#1a1a2e] dark:text-white'
                : 'text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e9eef6] dark:hover:bg-[#282a2c]'
            }`}
            title="AI Services Health"
          >
            <Activity className="h-4 w-4" />
            <StatusDot status={healthLoading ? 'loading' : overallStatus} />
          </button>

          {showHealth && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-80 bg-white dark:bg-[#1e1f20] rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/50 z-50 overflow-hidden animate-slide-up">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#0b57d0] dark:text-[#a8c7fa]" />
                  <span className="text-sm font-semibold text-[#1a1a2e] dark:text-white">AI Services</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={fetchHealth} disabled={healthLoading}
                    className="text-xs text-[#0b57d0] dark:text-[#a8c7fa] hover:underline disabled:opacity-50 font-medium">
                    {healthLoading ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button onClick={() => setShowHealth(false)}
                    className="p-1 rounded-full hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] text-[#9aa0a6]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {!health ? (
                  <div className="text-center py-4">
                    <div className="w-5 h-5 border-2 border-[#0b57d0]/20 border-t-[#0b57d0] rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-[#9aa0a6]">Checking services…</p>
                  </div>
                ) : (
                  <>
                    {/* Service rows */}
                    {[
                      { key: 'llamaparse', name: 'Parse' },
                      { key: 'gemini',     name: 'AI' },
                    ].map(svc => {
                      const ok = health[svc.key]?.status === 'ok';
                      return (
                        <div key={svc.key} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.2)]' : 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.2)]'}`} />
                          <span className="text-sm font-semibold text-[#1a1a2e] dark:text-white">{svc.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ml-auto ${
                            ok ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                               : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {ok ? 'Online' : 'Error'}
                          </span>
                        </div>
                      );
                    })}


                    {/* Queue stats */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#9aa0a6] mb-3">Parse Queue</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Done', value: health.queue?.completed ?? 0, color: 'text-green-600 dark:text-green-400' },
                          { label: 'Active', value: health.queue?.parsing ?? 0, color: 'text-blue-600 dark:text-blue-400' },
                          { label: 'Errors', value: health.queue?.errored ?? 0, color: 'text-red-500 dark:text-red-400' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl py-2.5 px-2">
                            <div className={`text-xl font-extrabold ${color}`}>{value}</div>
                            <div className="text-[9px] text-[#9aa0a6] uppercase tracking-widest mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-[10px] text-[#9aa0a6] text-right -mb-1">
                      Last checked {new Date(health.timestamp).toLocaleTimeString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] rounded-xl transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Settings */}
        <button
          onClick={onSettings}
          className="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] rounded-xl transition-colors"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

        {/* Avatar + logout */}
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0b57d0] to-[#4285f4] text-white flex items-center justify-center font-bold text-sm uppercase shadow-md shadow-blue-500/20 cursor-pointer" title={user?.username}>
            {user?.username?.[0] || 'U'}
          </div>
          <button
            onClick={onLogout}
            className="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-500 dark:hover:text-red-400 rounded-xl transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4.5 w-4.5" style={{ width: '18px', height: '18px' }} />
          </button>
        </div>
      </div>
    </header>
  );
}
