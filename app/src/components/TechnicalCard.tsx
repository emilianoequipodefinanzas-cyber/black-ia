import { TrendingUp, TrendingDown, Target, ShieldAlert, Trophy, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TradingViewChart } from './TradingViewChart';

interface Analysis {
  symbol: string;
  price: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  ema9?: number;
  rsi?: number;
  support: number[];
  resistance: number[];
  overallSignal: string;
  signalStrength: number;
  entryZone?: { low: number; high: number };
  stopLoss?: number;
  target1?: number;
  target2?: number;
  signals: { type: string; text: string }[];
}

interface TechnicalCardProps {
  analysis: Analysis;
}

const signalConfig = {
  COMPRAR:  { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: TrendingUp },
  ACUMULAR: { color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200',    icon: TrendingUp },
  ESPERAR:  { color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200',   icon: Activity },
  VENDER:   { color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-200',     icon: TrendingDown },
};

function MARow({ label, value, price }: { label: string; value?: number; price: number }) {
  if (!value) return null;
  const above = price > value;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-500 font-semibold w-14">{label}</span>
      <span className="text-sm font-mono text-gray-700">${value.toFixed(2)}</span>
      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', above ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
        {above ? '▲ arriba' : '▼ abajo'}
      </span>
    </div>
  );
}

export function TechnicalCard({ analysis: a }: TechnicalCardProps) {
  const cfg = signalConfig[a.overallSignal as keyof typeof signalConfig] || signalConfig.ESPERAR;
  const SignalIcon = cfg.icon;

  const rsiColor = !a.rsi ? 'text-gray-400' : a.rsi < 30 ? 'text-emerald-600' : a.rsi > 70 ? 'text-red-600' : 'text-blue-600';
  const rsiLabel = !a.rsi ? '' : a.rsi < 30 ? 'Sobreventa' : a.rsi > 70 ? 'Sobrecompra' : 'Normal';

  return (
    <div className={cn('rounded-2xl border overflow-hidden mt-4', cfg.border)}>
      {/* Header */}
      <div className={cn('px-5 py-4 flex items-center justify-between', cfg.bg)}>
        <div>
          <span className="text-xs text-gray-500 font-medium">Análisis técnico</span>
          <div className="flex items-center gap-2.5 mt-1">
            <span className="font-bold text-lg text-gray-800">{a.symbol}</span>
            <span className="text-base font-mono text-gray-700">${a.price?.toFixed(2)}</span>
          </div>
        </div>
        <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full border', cfg.bg, cfg.border)}>
          <SignalIcon className={cn('w-5 h-5', cfg.color)} />
          <span className={cn('text-base font-bold', cfg.color)}>{a.overallSignal}</span>
        </div>
      </div>

      <div className="bg-white px-5 py-4 space-y-4">
        {/* Moving Averages */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Medias Móviles</p>
          <div className="divide-y divide-gray-100">
            <MARow label="EMA9"  value={a.ema9}  price={a.price} />
            <MARow label="MA20"  value={a.ma20}  price={a.price} />
            <MARow label="MA50"  value={a.ma50}  price={a.price} />
            <MARow label="MA200" value={a.ma200} price={a.price} />
          </div>
        </div>

        {/* RSI */}
        {a.rsi && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">RSI (14)</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', a.rsi < 30 ? 'bg-emerald-400' : a.rsi > 70 ? 'bg-red-400' : 'bg-blue-400')}
                  style={{ width: `${a.rsi}%` }}
                />
              </div>
              <span className={cn('text-base font-bold tabular-nums w-12 text-right', rsiColor)}>{a.rsi.toFixed(1)}</span>
              <span className={cn('text-xs font-semibold w-20', rsiColor)}>{rsiLabel}</span>
            </div>
          </div>
        )}

        {/* Entry Zone */}
        {a.entryZone && (
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Zona de entrada
            </p>
            <p className="text-xl font-bold text-emerald-700 font-mono">
              ${a.entryZone.low.toFixed(2)} – ${a.entryZone.high.toFixed(2)}
            </p>
          </div>
        )}

        {/* Stop & Targets */}
        {(a.stopLoss || a.target1) && (
          <div className="grid grid-cols-3 gap-3">
            {a.stopLoss && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200 text-center">
                <ShieldAlert className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
                <p className="text-[11px] text-red-500 font-semibold uppercase tracking-wide">Stop Loss</p>
                <p className="text-sm font-bold text-red-700 font-mono mt-1">${a.stopLoss.toFixed(2)}</p>
              </div>
            )}
            {a.target1 && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-200 text-center">
                <Trophy className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
                <p className="text-[11px] text-blue-500 font-semibold uppercase tracking-wide">Target 1</p>
                <p className="text-sm font-bold text-blue-700 font-mono mt-1">${a.target1.toFixed(2)}</p>
              </div>
            )}
            {a.target2 && (
              <div className="bg-violet-50 rounded-xl p-3 border border-violet-200 text-center">
                <Trophy className="w-5 h-5 text-violet-500 mx-auto mb-1.5" />
                <p className="text-[11px] text-violet-500 font-semibold uppercase tracking-wide">Target 2</p>
                <p className="text-sm font-bold text-violet-700 font-mono mt-1">${a.target2.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}

        {/* Support / Resistance */}
        {(a.support.length > 0 || a.resistance.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {a.support.length > 0 && (
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Soporte</p>
                {a.support.slice(0, 2).map((s, i) => (
                  <p key={i} className="text-sm font-mono text-emerald-700 font-bold">${s.toFixed(2)}</p>
                ))}
              </div>
            )}
            {a.resistance.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Resistencia</p>
                {a.resistance.slice(0, 2).map((r, i) => (
                  <p key={i} className="text-sm font-mono text-red-600 font-bold">${r.toFixed(2)}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TradingView live chart */}
        <TradingViewChart
          symbol={a.symbol}
          signal={a.overallSignal as 'COMPRAR' | 'ACUMULAR' | 'ESPERAR' | 'VENDER'}
        />
      </div>
    </div>
  );
}
