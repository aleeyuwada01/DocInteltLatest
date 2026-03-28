import { useState, useEffect } from 'react';
import { X, Plus, Users, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsModal({ isOpen, onClose, token, user }: { isOpen: boolean, onClose: () => void, token: string, user: any }) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user?.role === 'admin') {
      fetchDepartments();
    }
  }, [isOpen]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      
      if (res.ok) {
        toast.success('Department created');
        setNewUsername('');
        setNewPassword('');
        fetchDepartments();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create department');
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
      <div className="bg-white dark:bg-[#1e1f20] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200/50 dark:border-gray-800/50">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h2 className="text-xl font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">Settings</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {user?.role === 'admin' ? (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3] mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  Manage Departments
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Create sub-accounts for departments. You can share specific files and folders with them.
                </p>
                
                <form onSubmit={handleCreate} className="bg-[#f8fafd] dark:bg-[#282a2c] p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
                  <h4 className="text-sm font-medium mb-3 text-[#1f1f1f] dark:text-[#e3e3e3]">Create New Department</h4>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Username</label>
                      <input 
                        type="text" 
                        required
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Password</label>
                      <input 
                        type="password" 
                        required
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#1e1f20] border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </form>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">Existing Departments</h4>
                  {departments.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No departments created yet.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      {departments.map(dept => (
                        <li key={dept.id} className="p-3 flex justify-between items-center bg-white dark:bg-[#1e1f20]">
                          <span className="text-sm font-medium text-[#1f1f1f] dark:text-[#e3e3e3]">{dept.username}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              Settings are only available for admin accounts.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
