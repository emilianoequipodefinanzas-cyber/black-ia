import { TrendingUp, LogOut, User, BarChart2, Wallet } from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
  userName: string;
  onOpenPortfolio: () => void;
  onOpenInvest: () => void;
}

export function Header({ onLogout, userName, onOpenPortfolio, onOpenInvest }: HeaderProps) {
  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Logo + name */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base tracking-tight">
            BLACK<span className="text-blue-600">.IA</span>
          </span>
        </div>

        {/* Nav buttons — center on desktop, hidden on mobile */}
        <nav className="hidden md:flex items-center gap-2">
          <button
            onClick={onOpenInvest}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-violet-600 hover:bg-violet-50 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Portafolio IA
          </button>
          <button
            onClick={onOpenPortfolio}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Wallet className="w-4 h-4" />
            Invest IA
          </button>
        </nav>

        {/* User + logout */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <User className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-medium text-gray-600 hidden sm:block">
              {userName.split(' ')[0]}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-red-50 hover:border-red-200 transition-colors group"
          >
            <LogOut className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors" />
            <span className="text-xs font-medium text-gray-500 group-hover:text-red-500 transition-colors hidden sm:block">
              Salir
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
