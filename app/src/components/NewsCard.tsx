import { useEffect, useRef, memo } from 'react';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';

// Map our symbols to TradingView format
const TV_SYMBOL_MAP: Record<string, string> = {
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
  'NFLX':     'NASDAQ:NFLX',
  'AMD':      'NASDAQ:AMD',
  'INTC':     'NASDAQ:INTC',
  // ESG
  'ESGU':     'NASDAQ:ESGU',
  'ESGV':     'NASDAQ:ESGV',
  'ESGE':     'NASDAQ:ESGE',
  'SUSA':     'NASDAQ:SUSA',
  'SUSL':     'NASDAQ:SUSL',
  'ICLN':     'NASDAQ:ICLN',
  'TAN':      'NASDAQ:TAN',
  'FAN':      'NASDAQ:FAN',
  'PHO':      'NASDAQ:PHO',
  'CRBN':     'NASDAQ:CRBN',
};

// Symbols that TradingView timeline widget supports well
// Only crypto — stocks/ETFs use Yahoo Finance (more reliable news)
const TV_SUPPORTED = new Set([
  'BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD',
  'XRP-USD', 'DOGE-USD', 'ADA-USD',
]);

interface NewsItem {
  title: string;
  url: string;
  source: string;
  time: string;
  thumbnail: string | null;
}

interface NewsCardProps {
  news: NewsItem[];
  symbol: string;
}

// ─── TradingView Timeline Widget ─────────────────────────────────────────────

const TradingViewNews = memo(({ symbol }: { symbol: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = TV_SYMBOL_MAP[symbol] ?? `NASDAQ:${symbol}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-timeline.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      feedMode: 'symbol',
      symbol: tvSymbol,
      isTransparent: false,
      displayMode: 'regular',
      width: '100%',
      height: 400,
      colorTheme: 'light',
      locale: 'es',
    });
    container.appendChild(script);

    return () => { if (container) container.innerHTML = ''; };
  }, [symbol, tvSymbol]);

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <Newspaper className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-gray-700">Noticias en vivo · {symbol}</span>
        <span className="ml-auto text-[10px] text-gray-400">TradingView</span>
      </div>
      <div ref={containerRef} className="tradingview-widget-container w-full" />
    </div>
  );
});
TradingViewNews.displayName = 'TradingViewNews';

// ─── Fallback: Yahoo Finance news list ───────────────────────────────────────

function YahooNews({ news, symbol }: NewsCardProps) {
  if (!news || news.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <Newspaper className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-semibold text-gray-700">Noticias · {symbol}</span>
      </div>
      <div className="divide-y divide-gray-100 bg-white">
        {news.map((item, i) => (
          <a
            key={i}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors group"
          >
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                <Newspaper className="w-5 h-5 text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] font-semibold text-blue-500">{item.source}</span>
                {item.time && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {item.time}
                    </span>
                  </>
                )}
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main export: TradingView if supported, Yahoo fallback otherwise ──────────

export function NewsCard({ news, symbol }: NewsCardProps) {
  if (!symbol) return null;

  // Use TradingView widget for known symbols
  if (TV_SUPPORTED.has(symbol)) {
    return <TradingViewNews symbol={symbol} />;
  }

  // Fallback to Yahoo Finance news list
  return <YahooNews news={news} symbol={symbol} />;
}
