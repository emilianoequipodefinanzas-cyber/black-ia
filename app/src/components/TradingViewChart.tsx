import { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol: string;
  signal: 'COMPRAR' | 'ACUMULAR' | 'ESPERAR' | 'VENDER';
}

// Map our symbols to TradingView format
function toTVSymbol(symbol: string): string {
  const map: Record<string, string> = {
    'BTC-USD':  'BINANCE:BTCUSDT',
    'ETH-USD':  'BINANCE:ETHUSDT',
    'SOL-USD':  'BINANCE:SOLUSDT',
    'BNB-USD':  'BINANCE:BNBUSDT',
    'XRP-USD':  'BINANCE:XRPUSDT',
    'DOGE-USD': 'BINANCE:DOGEUSDT',
    'ADA-USD':  'BINANCE:ADAUSDT',
    'SPY':      'AMEX:SPY',
    'QQQ':      'NASDAQ:QQQ',
    'GLD':      'AMEX:GLD',
    'BND':      'NASDAQ:BND',
    'AAPL':     'NASDAQ:AAPL',
    'MSFT':     'NASDAQ:MSFT',
    'NVDA':     'NASDAQ:NVDA',
    'AMZN':     'NASDAQ:AMZN',
    'GOOGL':    'NASDAQ:GOOGL',
    'META':     'NASDAQ:META',
    'TSLA':     'NASDAQ:TSLA',
  };
  return map[symbol] ?? `NASDAQ:${symbol}`;
}

const signalColor: Record<string, string> = {
  COMPRAR:  '#10b981',
  ACUMULAR: '#3b82f6',
  ESPERAR:  '#f59e0b',
  VENDER:   '#ef4444',
};

const signalLabel: Record<string, string> = {
  COMPRAR:  '🟢 COMPRAR',
  ACUMULAR: '🔵 ACUMULAR',
  ESPERAR:  '🟡 ESPERAR',
  VENDER:   '🔴 VENDER',
};

export const TradingViewChart = memo(({ symbol, signal }: TradingViewChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const color = signalColor[signal] ?? signalColor.ESPERAR;
  const tvSymbol = toTVSymbol(symbol);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'light',
      style: '1',
      locale: 'es',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        'MASimple@tv-scriptstd',   // MA20
        'MASimple@tv-scriptstd',   // MA50
        'MASimple@tv-scriptstd',   // MA200
        'RSI@tv-scriptstd',
      ],
      studies_overrides: {
        'moving average.length': 20,
      },
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, [symbol, tvSymbol]);

  return (
    <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {/* Banner */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: color + '15', borderBottom: `2px solid ${color}` }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-gray-600">
            Gráfico en vivo · {symbol}
          </span>
        </div>
        <span
          className="text-sm font-bold px-3 py-1 rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {signalLabel[signal] ?? signal}
        </span>
      </div>

      {/* Chart */}
      <div
        ref={containerRef}
        className="tradingview-widget-container w-full"
        style={{ height: 'clamp(280px, 40vw, 480px)' }}
      />

      <p className="text-[10px] text-gray-400 text-center py-1.5 bg-gray-50 border-t border-gray-100">
        Powered by TradingView · MA20 · MA50 · MA200 · RSI · Tiempo real
      </p>
    </div>
  );
});

TradingViewChart.displayName = 'TradingViewChart';
