import { TrendingUp, LogOut, User } from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
  userName: string;
}

export function Header({ onLogout, userName }: HeaderProps) {
  return (
    <header className="w-full px-4 py-4 flex items-center justify-between relative">
      {/* User info + logout */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:block">
          {userName.split(' ')[0]}
        </span>
      </div>

      {/* Logo centered */}
      <div className="absolute left-1/2 transform -translate-x-1/2">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-200 bg-white/80 backdrop-blur-sm hover:bg-red-50 hover:border-red-200 transition-colors group"
      >
        <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
        <span className="text-sm font-medium text-gray-500 group-hover:text-red-500 transition-colors hidden sm:block">
          Salir
        </span>
      </button>
    </header>
  );
}
