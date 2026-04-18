import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MacroQuote {
  price: number;
  changePct: number;
  name?: string;
}

interface MacroData {
  quotes: {
    dxy?: MacroQuote;
    wti?: MacroQuote;
    usBond?: MacroQuote;
    tbill?: MacroQuote;
    mxnusd?: MacroQuote;
    gold?: MacroQuote;
    bmv?: MacroQuote;
  };
  centralBanks: {
    fed: { rate: number; label: string };
    banxico: { rate: number; label: string };
  };
  timestamp: string;
}

interface IndicatorRow {
  icon: string;
  label: string;
  value: string;
  change: string;
  positive: boolean | null;
  note: string;
}

export function MacroCard() {
  const [data, setData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';
        const res = await fetch(`${BASE}/macro`);
        const json: MacroData = await res.json();
        setData(json);
        setUpdated(new Date(json.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      } catch { /* silently fail */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const fmt = (q?: MacroQuote, prefix = '') =>
    q?.price ? `${prefix}${q.price.toFixed(2)}` : '—';

  const fmtChange = (q?: MacroQuote) =>
    q?.changePct != null ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : '—';

  const rows: IndicatorRow[] = data ? [
    {
      icon: '💵', label: 'Dólar (DXY)',
      value: fmt(data.quotes.dxy),
      change: fmtChange(data.quotes.dxy),
      positive: data.quotes.dxy?.changePct != null ? data.quotes.dxy.changePct >= 0 : null,
      note: 'Índice del dólar vs canasta de divisas',
    },
    {
      icon: '🛢️', label: 'Petróleo WTI',
      value: fmt(data.quotes.wti, '$'),
      change: fmtChange(data.quotes.wti),
      positive: data.quotes.wti?.changePct != null ? data.quotes.wti.changePct >= 0 : null,
      note: 'Barril en USD · NYMEX',
    },
    {
      icon: '🇺🇸', label: 'Bono USA 10Y',
      value: data.quotes.usBond?.price ? `${data.quotes.usBond.price.toFixed(3)}%` : '—',
      change: fmtChange(data.quotes.usBond),
      positive: data.quotes.usBond?.changePct != null ? data.quotes.usBond.changePct >= 0 : null,
      note: 'Yield del Tesoro · referencia global',
    },
    {
      icon: '🇲🇽', label: 'USD/MXN',
      value: data.quotes.mxnusd?.price ? data.quotes.mxnusd.price.toFixed(4) : '—',
      change: fmtChange(data.quotes.mxnusd),
      positive: data.quotes.mxnusd?.changePct != null ? data.quotes.mxnusd.changePct <= 0 : null, // peso fuerte = changePct negativo
      note: 'Tipo de cambio peso mexicano',
    },
    {
      icon: '🥇', label: 'Oro',
      value: fmt(data.quotes.gold, '$'),
      change: fmtChange(data.quotes.gold),
      positive: data.quotes.gold?.changePct != null ? data.quotes.gold.changePct >= 0 : null,
      note: 'Activo refugio · COMEX',
    },
    {
      icon: '🏦', label: 'Tasa Fed (EE.UU.)',
      value: `${data.centralBanks.fed.rate}%`,
      change: 'anual',
      positive: null,
      note: 'Política monetaria restrictiva',
    },
    {
      icon: '🏛️', label: 'Tasa Banxico (MX)',
      value: `${data.centralBanks.banxico.rate}%`,
      change: 'anual',
      positive: null,
      note: 'Una de las más altas de LatAm',
    },
  ] : [];

  // Dynamic impact notes based on real data
  const impacts: string[] = [];
  if (data?.quotes.dxy?.changePct != null) {
    impacts.push(data.quotes.dxy.changePct > 0.3
      ? '💱 Dólar fuerte → presión en emergentes y commodities'
      : data.quotes.dxy.changePct < -0.3
      ? '💱 Dólar débil → impulso en emergentes y oro'
      : '💱 Dólar estable hoy');
  }
  if (data?.quotes.wti?.changePct != null) {
    impacts.push(data.quotes.wti.changePct > 1
      ? '⛽ Petróleo al alza → presión inflacionaria'
      : data.quotes.wti.changePct < -1
      ? '⛽ Petróleo a la baja → alivio inflacionario'
      : '⛽ Petróleo estable hoy');
  }
  if (data?.quotes.usBond?.price != null) {
    impacts.push(data.quotes.usBond.price > 4.5
      ? '📈 Yields altos → presión en tech y cripto'
      : '📈 Yields moderados → menor presión en renta variable');
  }
  if (data?.quotes.gold?.changePct != null && data.quotes.gold.changePct > 0.5) {
    impacts.push('🥇 Oro al alza → señal de incertidumbre global');
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Contexto Macroeconómico Global</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />}
          {updated && <span className="text-[10px] text-gray-500">{updated}</span>}
        </div>
      </div>

      {/* Indicators */}
      <div className="divide-y divide-gray-100 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
            <span className="text-sm text-gray-400">Cargando datos en tiempo real...</span>
          </div>
        ) : rows.map((row, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl flex-shrink-0">{row.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{row.label}</p>
              <p className="text-[11px] text-gray-400 truncate">{row.note}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">{row.value}</p>
              {row.positive !== null ? (
                <span className={cn('text-xs font-semibold flex items-center justify-end gap-0.5',
                  row.positive ? 'text-emerald-600' : 'text-red-500')}>
                  {row.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {row.change}
                </span>
              ) : (
                <span className="text-[11px] text-gray-400">{row.change}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic impact notes */}
      {impacts.length > 0 && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Impacto en activos hoy</p>
          <div className="space-y-1">
            {impacts.map((note, i) => (
              <p key={i} className="text-[11px] text-gray-600">{note}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
