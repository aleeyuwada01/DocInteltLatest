import { useState } from 'react';
import { toast } from 'sonner';

export function Login({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.token, data.user);
        toast.success(isLogin ? 'Logged in successfully' : 'Registered successfully');
      } else {
        toast.error(data.error || 'Authentication failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafd] dark:bg-[#131314] transition-colors duration-200">
      <div className="bg-white dark:bg-[#1e1f20] p-8 rounded-2xl shadow-lg w-full max-w-md border border-gray-200/50 dark:border-gray-800/50">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 87.3 78" className="w-8 h-8">
              <path d="m6.6 66.85 22.35-38.7 22.35 38.7H6.6z" fill="#1ea362"/>
              <path d="m41.4 6.45 22.35 38.7h-44.7L41.4 6.45z" fill="#4285f4"/>
              <path d="M76.2 66.85 53.85 28.15 31.5 66.85h44.7z" fill="#fbbc04"/>
            </svg>
            <span className="text-[24px] font-normal text-[#444746] dark:text-gray-200">DocIntel</span>
          </div>
        </div>
        
        <h2 className="text-2xl font-medium text-center mb-6 text-[#1f1f1f] dark:text-[#e3e3e3]">
          {isLogin ? 'Sign in' : 'Create account'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#444746] dark:text-[#c4c7c5] mb-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-[#f8fafd] dark:bg-[#282a2c] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#1f1f1f] dark:text-[#e3e3e3]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#444746] dark:text-[#c4c7c5] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-[#f8fafd] dark:bg-[#282a2c] border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#1f1f1f] dark:text-[#e3e3e3]"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-[#0b57d0] hover:bg-[#0842a0] text-white rounded-full font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Sign up')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#0b57d0] dark:text-[#a8c7fa] hover:underline"
          >
            {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
