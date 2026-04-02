import { useState } from 'react';
import { X, Check, Zap, Shield, Headphones, Building2, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: null,
    storage: '1 GB',
    color: 'gray',
    icon: <Shield className="w-5 h-5" />,
    features: [
      '1 GB secure storage',
      'AI document parsing',
      'Basic vector search',
      'Up to 3 departments',
      'Community support',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/mo',
    storage: '50 GB',
    color: 'blue',
    icon: <Zap className="w-5 h-5" />,
    badge: 'Most Popular',
    features: [
      '50 GB secure storage',
      'Priority AI parsing queue',
      'Advanced semantic search',
      'Unlimited departments',
      'File version history',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    disabled: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$49.99',
    period: '/mo',
    storage: '1 TB',
    color: 'dark',
    icon: <Building2 className="w-5 h-5" />,
    features: [
      '1 TB secure storage',
      'Dedicated parse cluster',
      'Custom AI model tuning',
      'SSO & SAML support',
      'Audit logs & compliance',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Upgrade to Enterprise',
    disabled: false,
  },
];

export function StorageModal({
  isOpen, onClose, token
}: { isOpen: boolean; onClose: () => void; token: string }) {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: string) => {
    setIsLoading(plan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to initiate checkout');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1e1f20] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/50 flex flex-col overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center border-b border-gray-100 dark:border-gray-800/50">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 p-2 rounded-full hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a1a2e] dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-full px-4 py-1.5 mb-4">
            <Star className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Upgrade Your Plan</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a2e] dark:text-white mb-2">
            Unlock full document intelligence
          </h2>
          <p className="text-sm text-[#5f6368] dark:text-[#9aa0a6] max-w-md mx-auto">
            More storage, faster AI processing, and team collaboration tools — choose the plan that fits your workflow.
          </p>
        </div>

        {/* Plans grid */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#f8fafd] dark:bg-[#131314]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PLANS.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                loading={isLoading === plan.id}
                onUpgrade={() => handleUpgrade(plan.id)}
              />
            ))}
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
            {[
              { icon: <Shield className="w-4 h-4" />, text: 'AES-256 Encrypted' },
              { icon: <Zap className="w-4 h-4" />, text: 'Instant AI Processing' },
              { icon: <Headphones className="w-4 h-4" />, text: 'Cancel Anytime' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-2 text-xs text-[#9aa0a6]">
                <span className="text-[#5f6368] dark:text-[#9aa0a6]">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, loading, onUpgrade }: { plan: typeof PLANS[0]; loading: boolean; onUpgrade: () => void }) {
  const isFeatured = plan.id === 'pro';
  const isDark = plan.id === 'enterprise';

  return (
    <div className={`plan-card ${isFeatured ? 'featured' : 'bg-white dark:bg-[#1e1f20] border border-gray-200/60 dark:border-gray-700/50'}`}>
      {/* Badge */}
      {plan.badge && (
        <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          isFeatured ? 'bg-white text-[#0b57d0]' : 'bg-[#0b57d0] text-white'
        } shadow-md`}>
          {plan.badge}
        </div>
      )}

      {/* Plan icon & name */}
      <div className={`flex items-center gap-2.5 mb-4 ${isFeatured ? 'text-white' : 'text-[#1a1a2e] dark:text-white'}`}>
        <div className={`p-2 rounded-xl ${isFeatured ? 'bg-white/20' : 'bg-[#f0f4f9] dark:bg-[#282a2c]'}`}>
          <span className={isFeatured ? 'text-white' : 'text-[#0b57d0] dark:text-[#a8c7fa]'}>{plan.icon}</span>
        </div>
        <span className="text-base font-bold">{plan.name}</span>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className={`flex items-end gap-1 ${isFeatured ? 'text-white' : 'text-[#1a1a2e] dark:text-white'}`}>
          <span className="text-3xl font-extrabold leading-none">{plan.price}</span>
          {plan.period && <span className={`text-sm mb-0.5 ${isFeatured ? 'text-white/65' : 'text-[#9aa0a6]'}`}>{plan.period}</span>}
        </div>
        <p className={`text-xs mt-1.5 font-medium ${isFeatured ? 'text-white/65' : 'text-[#9aa0a6]'}`}>
          {plan.storage} storage included
        </p>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 mb-8 flex-1">
        {plan.features.map(f => (
          <li key={f} className={`flex items-start gap-2.5 text-sm ${isFeatured ? 'text-white/85' : 'text-[#5f6368] dark:text-[#9aa0a6]'}`}>
            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${isFeatured ? 'text-white' : 'text-green-500'}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={plan.disabled ? undefined : onUpgrade}
        disabled={plan.disabled || loading}
        className={`w-full h-11 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 ${
          plan.disabled
            ? 'bg-black/5 dark:bg-white/5 text-[#9aa0a6] cursor-not-allowed'
            : isFeatured
              ? 'bg-white text-[#0b57d0] hover:bg-blue-50 shadow-lg shadow-black/10'
              : isDark
                ? 'bg-[#1a1a2e] dark:bg-[#37393b] text-white hover:bg-[#2d2f31] dark:hover:bg-[#4a4c4f]'
                : 'bg-[#0b57d0] text-white hover:bg-[#0842a0] shadow-md shadow-blue-500/20'
        }`}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          : plan.cta
        }
      </button>
    </div>
  );
}
