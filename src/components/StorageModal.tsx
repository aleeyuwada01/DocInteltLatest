import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { toast } from 'sonner';

export function StorageModal({ isOpen, onClose, token }: { isOpen: boolean, onClose: () => void, token: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async (plan: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });
      
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to initiate checkout');
      }
    } catch (e) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-800/50">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">Upgrade Storage</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1 bg-[#f8fafd] dark:bg-[#131314]">
          <div className="text-center mb-10">
            <h3 className="text-3xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-4">Choose the right plan for you</h3>
            <p className="text-gray-500 dark:text-gray-400">Get more storage and advanced features.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter Plan */}
            <div className="bg-white dark:bg-[#1e1f20] rounded-2xl p-6 border border-gray-200 dark:border-gray-700 flex flex-col">
              <h4 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-2">Starter</h4>
              <div className="text-3xl font-bold text-[#1f1f1f] dark:text-[#e3e3e3] mb-6">Free</div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500" /> 1 GB Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500" /> Basic AI Search
                </li>
              </ul>
              <button disabled className="w-full py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full font-medium">
                Current Plan
              </button>
            </div>

            {/* Pro Plan */}
            <div className="bg-white dark:bg-[#1e1f20] rounded-2xl p-6 border-2 border-blue-500 shadow-lg relative flex flex-col">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                Most Popular
              </div>
              <h4 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-2">Pro</h4>
              <div className="text-3xl font-bold text-[#1f1f1f] dark:text-[#e3e3e3] mb-6">$9.99<span className="text-sm font-normal text-gray-500">/mo</span></div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-blue-500" /> 50 GB Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-blue-500" /> Advanced AI Search
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-blue-500" /> Priority Support
                </li>
              </ul>
              <button 
                onClick={() => handleUpgrade('pro')}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Upgrade to Pro'}
              </button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-white dark:bg-[#1e1f20] rounded-2xl p-6 border border-gray-200 dark:border-gray-700 flex flex-col">
              <h4 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-2">Enterprise</h4>
              <div className="text-3xl font-bold text-[#1f1f1f] dark:text-[#e3e3e3] mb-6">$49.99<span className="text-sm font-normal text-gray-500">/mo</span></div>
              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500" /> 1 TB Storage
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500" /> Unlimited Departments
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Check className="w-4 h-4 text-green-500" /> Dedicated Account Manager
                </li>
              </ul>
              <button 
                onClick={() => handleUpgrade('enterprise')}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded-full font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Upgrade to Enterprise'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
