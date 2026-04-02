import { useState, useEffect } from 'react';
import {
  X, Plus, Users, Trash2, Shield, Bell, Palette, Database,
  Copy, Check, Eye, EyeOff, Loader2,
  Info, AlertTriangle, User, Lock, Globe, Zap, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'account' | 'departments' | 'security' | 'notifications' | 'appearance';

const TABS: { id: Tab; icon: React.ReactNode; label: string; adminOnly?: boolean }[] = [
  { id: 'account',       icon: <User className="w-4 h-4" />,        label: 'Account' },
  { id: 'security',      icon: <Shield className="w-4 h-4" />,       label: 'Security' },
  { id: 'departments',   icon: <Users className="w-4 h-4" />,        label: 'Departments', adminOnly: true },
  { id: 'notifications', icon: <Bell className="w-4 h-4" />,         label: 'Notifications' },
  { id: 'appearance',    icon: <Palette className="w-4 h-4" />,      label: 'Appearance' },
];

export function SettingsModal({
  isOpen, onClose, token, user
}: {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  user: any;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [departments, setDepartments] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [deptLoading, setDeptLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Notification toggles
  const [notifs, setNotifs] = useState({
    parseComplete: true,
    shareReceived: true,
    storageWarning: true,
    aiInsights: false,
  });

  useEffect(() => {
    if (isOpen && user?.role === 'admin') fetchDepartments();
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDepartments(await res.json());
    } catch {}
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptLoading(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      if (res.ok) {
        toast.success('Department created successfully');
        setNewUsername(''); setNewPassword('');
        fetchDepartments();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to create department');
      }
    } catch { toast.error('An error occurred'); }
    finally { setDeptLoading(false); }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success('Token copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const availTabs = TABS.filter(t => !t.adminOnly || user?.role === 'admin');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1e1f20] w-full max-w-3xl max-h-[88vh] rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/50 flex overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Left sidebar ──────────────────────────────────────── */}
        <aside className="w-56 shrink-0 bg-[#f8fafd] dark:bg-[#131314] border-r border-gray-200/50 dark:border-gray-800/50 flex flex-col p-3">
          {/* Header */}
          <div className="flex items-center gap-2.5 px-2 pb-5 pt-2 border-b border-gray-200/50 dark:border-gray-800/50 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0b57d0] to-[#1565c0] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm uppercase">{user?.username?.[0] || 'U'}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1a1a2e] dark:text-white truncate">{user?.username}</p>
              <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] capitalize">{user?.role || 'user'}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5">
            {availTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </button>
            ))}
          </nav>

          {/* Version */}
          <p className="text-[10px] text-[#9aa0a6] px-2 mt-4">DocIntel v1.0.0</p>
        </aside>

        {/* ── Right content ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-7 py-4 border-b border-gray-100 dark:border-gray-800/50 shrink-0">
            <h2 className="text-base font-semibold text-[#1a1a2e] dark:text-white">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a1a2e] dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-7 py-6">
            {activeTab === 'account' && <AccountTab user={user} />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'departments' && user?.role === 'admin' && (
              <DepartmentsTab
                departments={departments}
                newUsername={newUsername} setNewUsername={setNewUsername}
                newPassword={newPassword} setNewPassword={setNewPassword}
                showNewPw={showNewPw} setShowNewPw={setShowNewPw}
                isLoading={deptLoading}
                onSubmit={handleCreateDept}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsTab notifs={notifs} setNotifs={setNotifs} />
            )}
            {activeTab === 'appearance' && <AppearanceTab />}
            {activeTab === 'api' && (
              <ApiTab token={token} copied={copied} onCopy={copyToken} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Tab: Account                                                    */
/* ──────────────────────────────────────────────────────────────── */
function AccountTab({ user }: { user: any }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Profile" icon={<User className="w-4 h-4" />}>
        <div className="flex items-center gap-5 p-5 bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0b57d0] to-[#4285f4] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
            <span className="text-white text-2xl font-bold uppercase">{user?.username?.[0] || 'U'}</span>
          </div>
          <div>
            <p className="text-lg font-semibold text-[#1a1a2e] dark:text-white">{user?.username}</p>
            <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${
              user?.role === 'admin'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {user?.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {user?.role}
            </span>
          </div>
        </div>
      </Section>

      <Section title="Plan & Storage" icon={<CreditCard className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Current Plan" value="Starter" sub="Free tier" color="gray" />
          <StatCard label="Storage Used" value="0 GB" sub="of 1 GB" color="blue" />
        </div>
      </Section>

      <InfoBox type="info" message="Account management features like email, password change, and 2FA will be available soon." />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Tab: Security                                                   */
/* ──────────────────────────────────────────────────────────────── */
function SecurityTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Session" icon={<Lock className="w-4 h-4" />}>
        <SettingRow
          label="Active Session"
          sub="You are signed in via JWT. Sessions persist until you log out."
          right={<span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Active</span>}
        />
      </Section>

      <Section title="Access Control" icon={<Shield className="w-4 h-4" />}>
        <SettingRow
          label="Login History"
          sub="Track sign-in events and suspicious activity"
          right={<ComingSoon />}
        />
        <SettingRow
          label="Two-Factor Authentication"
          sub="Add an extra layer of security to your account"
          right={<ComingSoon />}
        />
        <SettingRow
          label="Trusted Devices"
          sub="Manage devices that have access to your account"
          right={<ComingSoon />}
        />
      </Section>

      <InfoBox type="warning" message="Passwords are stored in plaintext. Production deployments should use bcrypt or Argon2." />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Tab: Departments (admin only)                                   */
/* ──────────────────────────────────────────────────────────────── */
function DepartmentsTab({
  departments, newUsername, setNewUsername, newPassword, setNewPassword,
  showNewPw, setShowNewPw, isLoading, onSubmit
}: any) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Create Department" icon={<Plus className="w-4 h-4" />}>
        <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mb-4">
          Department accounts let teams access files you share with them — without touching your primary account.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5 uppercase tracking-wider">Username</label>
              <input
                type="text" required value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="e.g. marketing-team"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'} required value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Set a strong password"
                  className="input-field pr-10"
                />
                <button type="button" onClick={() => setShowNewPw((v: boolean) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-[#5f6368] transition-colors">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <button type="submit" disabled={isLoading || !newUsername.trim() || !newPassword.trim()} className="btn-primary">
            {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4" /> Create Department</>}
          </button>
        </form>
      </Section>

      <Section title={`Existing Departments (${departments.length})`} icon={<Users className="w-4 h-4" />}>
        {departments.length === 0 ? (
          <div className="text-center py-10 text-[#9aa0a6]">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No departments yet. Create one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {departments.map((dept: any) => (
              <div key={dept.id}
                className="flex items-center justify-between p-3.5 bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl border border-gray-200/50 dark:border-gray-700/50 group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold uppercase">{dept.username?.[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1a1a2e] dark:text-white">{dept.username}</p>
                    <p className="text-xs text-[#9aa0a6]">Department</p>
                  </div>
                </div>
                <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Tab: Notifications                                              */
/* ──────────────────────────────────────────────────────────────── */
function NotificationsTab({ notifs, setNotifs }: any) {
  const toggle = (key: string) => setNotifs((prev: any) => ({ ...prev, [key]: !prev[key] }));

  const rows = [
    { key: 'parseComplete', label: 'Document parsed', sub: 'Notify me when AI finishes processing a file' },
    { key: 'shareReceived', label: 'File shared with me', sub: 'Notify when a department shares a document' },
    { key: 'storageWarning', label: 'Storage warnings', sub: 'Alert when storage is above 80% capacity' },
    { key: 'aiInsights', label: 'AI insights digest', sub: 'Weekly summary of document insights (coming soon)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="In-App Notifications" icon={<Bell className="w-4 h-4" />}>
        <div className="space-y-1">
          {rows.map(row => (
            <SettingRow key={row.key} label={row.label} sub={row.sub}
              right={<Toggle on={notifs[row.key]} onToggle={() => toggle(row.key)} />}
            />
          ))}
        </div>
      </Section>

      <Section title="Email Notifications" icon={<Globe className="w-4 h-4" />}>
        <SettingRow label="Email Alerts" sub="Send notifications to your registered email address"
          right={<ComingSoon />}
        />
      </Section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Tab: Appearance                                                 */
/* ──────────────────────────────────────────────────────────────── */
function AppearanceTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Display" icon={<Palette className="w-4 h-4" />}>
        <SettingRow
          label="Dark Mode"
          sub="Controlled by the moon icon in the top bar — persisted to local storage"
          right={<span className="text-xs text-[#9aa0a6]">Topbar ↗</span>}
        />
        <SettingRow
          label="Default View"
          sub="Choose between grid or list view for your Drive"
          right={<ComingSoon />}
        />
        <SettingRow
          label="Accent Color"
          sub="Customize the interface highlight color"
          right={<ComingSoon />}
        />
      </Section>

      <Section title="Language & Region" icon={<Globe className="w-4 h-4" />}>
        <SettingRow
          label="Language"
          sub="Interface language — currently English only"
          right={<span className="text-xs font-medium text-[#1a1a2e] dark:text-white bg-[#f0f4f9] dark:bg-[#282a2c] px-2.5 py-1 rounded-lg">English (US)</span>}
        />
        <SettingRow
          label="Date Format"
          sub="How dates are displayed across the app"
          right={<ComingSoon />}
        />
      </Section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Tab: API & Integrations                                          */
/* ──────────────────────────────────────────────────────────────── */
function ApiTab({ token, copied, onCopy }: { token: string; copied: boolean; onCopy: () => void }) {
  const [show, setShow] = useState(false);
  const masked = '••••••••••••••••' + token.slice(-8);

  return (
    <div className="space-y-6 animate-fade-in">
      <Section title="Auth Token" icon={<Key className="w-4 h-4" />}>
        <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] mb-4">
          Your session JWT token for API access. Use it in the <code className="bg-[#f0f4f9] dark:bg-[#282a2c] px-1.5 py-0.5 rounded text-xs font-mono">Authorization: Bearer</code> header.
        </p>
        <div className="flex items-center gap-2 bg-[#f8fafd] dark:bg-[#282a2c] border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-3">
          <code className="flex-1 text-xs font-mono text-[#5f6368] dark:text-[#9aa0a6] truncate">
            {show ? token : masked}
          </code>
          <button onClick={() => setShow(v => !v)}
            className="p-1.5 rounded-lg hover:bg-[#e9eef6] dark:hover:bg-[#37393b] text-[#9aa0a6] transition-colors shrink-0">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={onCopy}
            className="p-1.5 rounded-lg hover:bg-[#e9eef6] dark:hover:bg-[#37393b] text-[#9aa0a6] transition-colors shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </Section>

      <Section title="AI Services" icon={<Zap className="w-4 h-4" />}>
        <div className="space-y-2">
          {[
            { name: 'Gemini 2.5 Flash', desc: 'Chat & OCR generation', status: 'Active' },
            { name: 'Gemini Embedding', desc: 'Vector search (1536-dim)', status: 'Active' },
            { name: 'LlamaParse v2', desc: 'Agentic document parsing', status: 'Active' },
          ].map(svc => (
            <div key={svc.name}
              className="flex items-center justify-between p-3.5 bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl border border-gray-200/50 dark:border-gray-700/50">
              <div>
                <p className="text-sm font-medium text-[#1a1a2e] dark:text-white">{svc.name}</p>
                <p className="text-xs text-[#9aa0a6]">{svc.desc}</p>
              </div>
              <span className="text-[11px] font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {svc.status}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Webhooks & Integrations" icon={<Database className="w-4 h-4" />}>
        <SettingRow label="Zapier Integration" sub="Connect DocIntel to 5,000+ apps" right={<ComingSoon />} />
        <SettingRow label="Webhook Endpoints" sub="Receive events when documents are parsed" right={<ComingSoon />} />
        <SettingRow label="Slack Notifications" sub="Get alerts in your Slack workspace" right={<ComingSoon />} />
      </Section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/*  Shared primitives                                               */
/* ──────────────────────────────────────────────────────────────── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[#5f6368] dark:text-[#9aa0a6]">{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#5f6368] dark:text-[#9aa0a6]">{title}</h3>
      </div>
      <div className="bg-white dark:bg-[#282a2c]/60 rounded-xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, sub, right }: { label: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 border-b last:border-0 border-gray-100 dark:border-gray-700/40">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1a1a2e] dark:text-white leading-snug">{label}</p>
        <p className="text-xs text-[#9aa0a6] mt-0.5 leading-snug">{sub}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'blue' | 'gray' }) {
  const c = color === 'blue' ? 'from-[#0b57d0] to-[#1565c0]' : 'from-gray-600 to-gray-700';
  return (
    <div className="p-4 bg-[#f8fafd] dark:bg-[#282a2c] rounded-xl border border-gray-200/50 dark:border-gray-700/50">
      <p className="text-xs text-[#9aa0a6] mb-1">{label}</p>
      <p className={`text-2xl font-bold bg-gradient-to-r ${c} bg-clip-text text-transparent`}>{value}</p>
      <p className="text-xs text-[#9aa0a6] mt-0.5">{sub}</p>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch" aria-checked={on}
      className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 ${
        on ? 'bg-[#0b57d0] dark:bg-[#a8c7fa]' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      style={{ minWidth: '40px', height: '22px' }}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-[18px]' : 'translate-x-0'}`}
      />
    </button>
  );
}

function ComingSoon() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9aa0a6] bg-[#f0f4f9] dark:bg-[#37393b] px-2.5 py-1 rounded-full border border-gray-200/50 dark:border-gray-700/50">
      Coming Soon
    </span>
  );
}

function InfoBox({ type, message }: { type: 'info' | 'warning'; message: string }) {
  const isWarning = type === 'warning';
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl text-sm border ${
      isWarning
        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30 text-amber-800 dark:text-amber-300'
        : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30 text-blue-800 dark:text-blue-300'
    }`}>
      {isWarning
        ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        : <Info className="w-4 h-4 mt-0.5 shrink-0" />
      }
      <p>{message}</p>
    </div>
  );
}
