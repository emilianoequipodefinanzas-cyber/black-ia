import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, PieChart, RefreshCw, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { buildPortfolio } from '@/lib/api';
import type { RiskLevel } from '@/types';
import { cn } from '@/lib/utils';

interface Asset {
  symbol: string;
  name: string;
  pct: number;
  type: string;
  amount: number;
  price: number | null;
  shares: number | null;
  changePct: number | null;
}

interface InvestIAProps {
  selectedRisk: RiskLevel | null;
}

const TYPE_COLORS: Record<string, string> = {
  'Tecnología':    'bg-blue-100 text-blue-700',
  'Cripto':        'bg-violet-100 text-violet-700',
  'Renta Fija':    'bg-emerald-100 text-emerald-700',
  'Acciones USA':  'bg-indigo-100 text-indigo-700',
  'Dividendos':    'bg-teal-100 text-teal-700',
  'Commodities':   'bg-amber-100 text-amber-700',
  'REIT':          'bg-orange-100 text-orange-700',
  'ESG':           'bg-green-100 text-green-700',
  'Internacional': 'bg-cyan-100 text-cyan-700',
  'Emergentes':    'bg-pink-100 text-pink-700',
  'Innovación':    'bg-purple-100 text-purple-700',
  'Salud':         'bg-red-100 text-red-700',
  'Consumo':       'bg-yellow-100 text-yellow-700',
  'Liquidez':      'bg-gray-100 text-gray-600',
};

const RISK_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  conservative: { label: 'Conservador', color: 'text-emerald-600', desc: 'Preservación de capital · Baja volatilidad' },
  moderate:     { label: 'Moderado',    color: 'text-blue-600',    desc: 'Equilibrio crecimiento/seguridad' },
  aggressive:   { label: 'Agresivo',    color: 'text-violet-600',  desc: 'Máximo crecimiento · Alta volatilidad' },
};

export function InvestIA({ selectedRisk }: InvestIAProps) {
  const [capital, setCapital] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCapital, setTotalCapital] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleBuild = async () => {
    const cap = parseFloat(capital.replace(/,/g, ''));
    if (!cap || cap <= 0 || !selectedRisk) return;
    setLoading(true);
    try {
      const result = await buildPortfolio(selectedRisk, cap);
      setAssets(result.assets);
      setTotalCapital(result.capital);
    } catch {
      // server not available
    } finally {
      setLoading(false);
    }
  };

  const riskInfo = selectedRisk ? RISK_LABELS[selectedRisk] : null;

  // Group by type for summary
  const typeGroups = assets.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + a.pct;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">

      {/* Header info */}
      {riskInfo && (
        <div className="mb-4 p-3 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
          <div>
            <p className={`text-sm font-bold ${riskInfo.color}`}>{riskInfo.label}</p>
            <p className="text-xs text-gray-400">{riskInfo.desc}</p>
          </div>
          <PieChart className={`w-5 h-5 ${riskInfo.color}`} />
        </div>
      )}

      {/* Capital input */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 font-medium mb-2">¿Cuánto capital quieres invertir?</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="number"
              min="1"
              placeholder="Ej: 5000"
              value={capital}
              onChange={e => setCapital(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBuild()}
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
            />
          </div>
          <button
            onClick={handleBuild}
            disabled={!capital || !selectedRisk || loading}
            className="px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Armando...' : 'Armar'}
          </button>
        </div>
        {!selectedRisk && (
          <p className="text-xs text-amber-500 mt-2">⚠️ Selecciona primero tu perfil de riesgo en la pantalla principal.</p>
        )}
      </div>

      {/* Quick amounts */}
      {!assets.length && (
        <div className="flex gap-2 flex-wrap mb-4">
          {['500', '1000', '5000', '10000', '50000'].map(v => (
            <button key={v} onClick={() => setCapital(v)}
              className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
              ${parseInt(v).toLocaleString()}
            </button>
          ))}
        </div>
      )}

      {/* Portfolio result */}
      {assets.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">

          {/* Summary header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-4 text-white">
            <p className="text-xs font-medium text-white/70 mb-1">Portafolio armado · {riskInfo?.label}</p>
            <p className="text-2xl font-bold">${totalCapital.toLocaleString('es-MX')}</p>
            <p className="text-xs text-white/70 mt-1">15 activos diversificados</p>
          </div>

          {/* Type breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Distribución por categoría</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeGroups).map(([type, pct]) => (
                <div key={type} className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', TYPE_COLORS[type] || 'bg-gray-100 text-gray-600')}>
                  <span>{type}</span>
                  <span className="opacity-70">{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Asset list */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-4 pb-2">Activos del portafolio</p>
            <div className="divide-y divide-gray-50">
              {assets.map((asset, i) => (
                <div key={asset.symbol}>
                  <button
                    onClick={() => setExpanded(expanded === asset.symbol ? null : asset.symbol)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    {/* Rank */}
                    <span className="text-xs text-gray-400 w-5 text-center font-mono">{i + 1}</span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">{asset.symbol === 'CASH' ? '💵' : asset.symbol}</span>
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', TYPE_COLORS[asset.type] || 'bg-gray-100 text-gray-600')}>
                          {asset.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{asset.name}</p>
                    </div>

                    {/* Pct + amount */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gray-800">{asset.pct}%</p>
                      <p className="text-xs text-gray-500">${asset.amount.toLocaleString('es-MX')}</p>
                    </div>

                    {/* Change */}
                    {asset.changePct !== null && (
                      <span className={cn('text-xs font-semibold flex items-center gap-0.5 w-14 justify-end', asset.changePct >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {asset.changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {asset.changePct >= 0 ? '+' : ''}{asset.changePct}%
                      </span>
                    )}

                    {expanded === asset.symbol ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {expanded === asset.symbol && (
                    <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <div className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                          <p className="text-[10px] text-gray-400 mb-1">Precio actual</p>
                          <p className="text-sm font-bold text-gray-800">{asset.price ? `$${asset.price.toLocaleString()}` : 'N/D'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                          <p className="text-[10px] text-gray-400 mb-1">Unidades</p>
                          <p className="text-sm font-bold text-gray-800">{asset.shares ?? '—'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-2.5 border border-gray-100 text-center">
                          <p className="text-[10px] text-gray-400 mb-1">Asignado</p>
                          <p className="text-sm font-bold text-gray-800">${asset.amount.toLocaleString('es-MX')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-2">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Los mercados financieros son cambiantes e impredecibles. Los resultados reales pueden diferir significativamente de los estimados. Este portafolio es solo informativo , Invierte siempre con capital que puedas permitirte perder.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
