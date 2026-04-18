import { useState } from 'react';
import { Header } from './sections/Header';
import { RiskSelector } from './sections/RiskSelector';
import { ChatInterface } from './sections/ChatInterface';
import { InvestIA } from './sections/InvestIA';
import { AuthScreen } from './sections/AuthScreen';
import { MarketTicker } from './components/MarketTicker';
import type { RiskLevel } from './types';
import { Wallet, ChevronRight, X, Bot, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import './App.css';

interface SessionUser { name: string; email: string; }

// ─── Drawer component (mobile) / Panel (desktop) ─────────────────────────────
function Panel({
  open, onClose, title, subtitle, icon, iconBg, children,
}: {
  open: boolean; onClose: () => void; title: string; subtitle: string;
  icon: React.ReactNode; iconBg: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — drawer on mobile, side panel on desktop */}
      <div className="
        relative mt-auto w-full bg-white shadow-2xl flex flex-col
        rounded-t-3xl
        md:mt-0 md:ml-auto md:rounded-none md:rounded-l-3xl md:w-[480px] md:h-full
        animate-in slide-in-from-bottom-4 md:slide-in-from-right-4 duration-300
      " style={{ maxHeight: '92dvh' }}>

        {/* Handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${iconBg}`}>
              {icon}
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">{title}</p>
              <p className="text-xs text-gray-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState<SessionUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('capitalIA_session') || 'null'); }
    catch { return null; }
  });
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | null>(null);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showInvest, setShowInvest] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('capitalIA_session');
    setUser(null);
    setShowPortfolio(false);
    setShowInvest(false);
  };

  if (!user) return <AuthScreen onAuth={setUser} />;

  const getRiskName = (risk: RiskLevel | null) => {
    if (!risk) return '';
    return risk === 'conservative' ? 'Conservador' : risk === 'moderate' ? 'Moderado' : 'Agresivo';
  };
  const getRiskColor = (risk: RiskLevel | null) => {
    if (!risk) return '';
    return risk === 'conservative' ? 'text-emerald-600' : risk === 'moderate' ? 'text-blue-600' : 'text-violet-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">

      {/* Sticky header */}
      <Header
        onLogout={handleLogout}
        userName={user.name}
        onOpenPortfolio={() => setShowPortfolio(true)}
        onOpenInvest={() => setShowInvest(true)}
      />

      {/* Market Ticker */}
      <MarketTicker />

      {/* ── Desktop layout: 2 columns ── Mobile: single column ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* LEFT column — branding + risk selector */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">

            {/* Hero */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                BLACK<span className="text-blue-600">.IA</span>
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Inversiones inteligentes con IA y datos en tiempo real.
              </p>
            </div>

            {/* Action buttons — visible on mobile, hidden on desktop (moved to header) */}
            <div className="flex flex-col gap-3 mb-6 md:hidden">
              <Button variant="outline" onClick={() => setShowInvest(true)}
                className="w-full py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition-all group">
                <BarChart2 className="w-5 h-5 text-violet-500 mr-2 group-hover:scale-110 transition-transform" />
                <span className="text-violet-600 font-semibold">Portafolio IA</span>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" onClick={() => setShowPortfolio(true)}
                className="w-full py-4 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group">
                <Wallet className="w-5 h-5 text-blue-500 mr-2 group-hover:scale-110 transition-transform" />
                <span className="text-blue-600 font-semibold">Invest IA</span>
                <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>

            {/* Risk Selector */}
            <RiskSelector selectedRisk={selectedRisk} onSelectRisk={setSelectedRisk} />

            {/* Selected risk badge */}
            {selectedRisk && (
              <div className="mt-3 mx-4 bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Perfil seleccionado:</span>
                <span className={`text-sm font-semibold ${getRiskColor(selectedRisk)}`}>
                  {getRiskName(selectedRisk)}
                </span>
              </div>
            )}

            {/* Footer — desktop only */}
            <div className="hidden lg:block mt-8 px-4">
              <p className="text-xs text-gray-400">© 2025 BLACK.IA. Inversiones inteligentes para todos.</p>
              <p className="text-xs text-gray-400 mt-0.5">Black Capital Advisors</p>
            </div>
          </div>

          {/* RIGHT column — chat always visible on desktop */}
          <div className="flex-1 min-w-0 hidden lg:flex flex-col">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
              <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Invest IA</p>
                  <p className="text-xs text-gray-400">Asesor IA · Datos en tiempo real</p>
                </div>
              </div>
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <ChatInterface selectedRisk={selectedRisk} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Mobile footer */}
      <footer className="lg:hidden w-full px-4 py-4 text-center">
        <p className="text-xs text-gray-400">© 2025 BLACK.IA. Inversiones inteligentes para todos.</p>
        <p className="text-xs text-gray-400 mt-1">Black Capital Advisors</p>
      </footer>

      {/* Invest IA Panel (Portafolio IA) */}
      <Panel
        open={showInvest}
        onClose={() => setShowInvest(false)}
        title="Portafolio IA"
        subtitle="Portafolio personalizado · Datos reales"
        icon={<BarChart2 className="w-5 h-5 text-white" />}
        iconBg="bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/25"
      >
        <InvestIA selectedRisk={selectedRisk} />
      </Panel>

      {/* Chat Panel (Invest IA) — mobile only, desktop shows inline */}
      <Panel
        open={showPortfolio}
        onClose={() => setShowPortfolio(false)}
        title="Invest IA"
        subtitle="Asesor IA · Datos en tiempo real"
        icon={<Bot className="w-5 h-5 text-white" />}
        iconBg="bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/25"
      >
        <ChatInterface selectedRisk={selectedRisk} />
      </Panel>

    </div>
  );
}

export default App;
