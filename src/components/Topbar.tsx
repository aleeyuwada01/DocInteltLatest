import { Search, Settings, Moon, Sun, LogOut } from 'lucide-react';

export function Topbar({ darkMode, setDarkMode, user, onLogout, onSettings }: any) {
  return (
    <header className="h-20 pt-4 bg-[#f8fafd] dark:bg-[#131314] flex items-center justify-between px-4 transition-colors duration-200">
      <div className="flex-1 max-w-[720px] ml-2">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#444746] dark:text-gray-400 group-focus-within:text-[#1f1f1f] dark:group-focus-within:text-gray-200" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-3 border-transparent rounded-full leading-5 bg-[#e9eef6] dark:bg-[#282a2c] text-[#1f1f1f] dark:text-gray-100 placeholder-[#444746] dark:placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-[#37393b] focus:shadow-[0_1px_1px_rgba(0,0,0,0.1)] sm:text-base transition-all"
            placeholder="Search in Drive"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-1 ml-6">
        <button 
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 text-[#444746] dark:text-gray-300 hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] rounded-full transition-colors"
        >
          {darkMode ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
        </button>
        <button onClick={onSettings} className="p-2 text-[#444746] dark:text-gray-300 hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] rounded-full transition-colors">
          <Settings className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <button className="p-1 rounded-full hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] transition-colors" title={user?.username}>
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium uppercase">
              {user?.username?.[0] || 'U'}
            </div>
          </button>
          <button onClick={onLogout} className="p-2 text-[#444746] dark:text-gray-300 hover:bg-[#e9eef6] dark:hover:bg-[#282a2c] rounded-full transition-colors" title="Logout">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
