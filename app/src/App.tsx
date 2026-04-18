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
  };

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  const getRiskName = (risk: RiskLevel | null) => {
    if (!risk) return '';
    return risk === 'conservative' ? 'Conservador' : risk === 'moderate' ? 'Moderado' : 'Agresivo';
  };

  const getRiskColor = (risk: RiskLevel | null) => {
    if (!risk) return '';
    return risk === 'conservative'
      ? 'text-emerald-600'
      : risk === 'moderate'
      ? 'text-blue-600'
      : 'text-violet-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto min-h-screen flex flex-col relative">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none" />

        {/* Header */}
        <Header onLogout={handleLogout} userName={user.name} />

        {/* Market Ticker */}
        <MarketTicker />

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative z-10">
          {/* Hero Section */}
          <div className="text-center px-4 pt-4 pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
              BLACK<span className="text-blue-600">.IA</span>
            </h1>
            <p className="text-gray-500 text-sm">
              Crea tu portafolio de inversión perfecto con IA.
            </p>
          </div>

          {/* Buttons row */}
          <div className="px-4 mb-6 flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => setShowInvest(true)}
              className="w-full py-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50 transition-all group"
            >
              <BarChart2 className="w-5 h-5 text-violet-500 mr-2 group-hover:scale-110 transition-transform" />
              <span className="text-violet-600 font-semibold">Portafolio IA</span>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPortfolio(true)}
              className="w-full py-5 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group"
            >
              <Wallet className="w-5 h-5 text-blue-500 mr-2 group-hover:scale-110 transition-transform" />
              <span className="text-blue-600 font-semibold">Invest IA</span>
              <ChevronRight className="w-4 h-4 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Risk Selector */}
          <RiskSelector selectedRisk={selectedRisk} onSelectRisk={setSelectedRisk} />

          {/* Selected Risk Indicator */}
          <div className="px-4 py-3" style={{ minHeight: '64px' }}>
            {selectedRisk && (
              <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-3 border border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">Perfil seleccionado:</span>
                <span className={`text-sm font-semibold ${getRiskColor(selectedRisk)}`}>
                  {getRiskName(selectedRisk)}
                </span>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full px-4 py-4 text-center">
          <p className="text-xs text-gray-400">© 2025 BLACK.IA. Inversiones inteligentes para todos.</p>
          <p className="text-xs text-gray-400 mt-1">Black Capital Advisors</p>
        </footer>
      </div>

      {/* Portfolio Drawer Overlay */}
      {showPortfolio && (
        <div className="fixed inset-0 z-50 flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPortfolio(false)}
          />

          {/* Drawer — slides up from bottom, same max-width as app */}
          <div className="relative mt-auto w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300"
            style={{ maxHeight: '92dvh' }}
          >
            {/* Drawer handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Invest IA</p>
                  <p className="text-xs text-gray-400">Asesor IA · Datos en tiempo real</p>
                </div>
              </div>
              <button
                onClick={() => setShowPortfolio(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Chat inside drawer */}
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <ChatInterface selectedRisk={selectedRisk} />
            </div>
          </div>
        </div>
      )}
      {/* Invest IA Drawer */}
      {showInvest && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvest(false)} />
          <div className="relative mt-auto w-full max-w-md sm:max-w-lg md:max-w-xl mx-auto bg-white rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300"
            style={{ maxHeight: '92dvh' }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-500/25">
                  <BarChart2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Portafolio IA</p>
                  <p className="text-xs text-gray-400">Portafolio personalizado · Datos reales</p>
                </div>
              </div>
              <button onClick={() => setShowInvest(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-3">
              <InvestIA selectedRisk={selectedRisk} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
