import { useEffect, useRef } from 'react';

export function MarketTicker() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'BINANCE:BTCUSDT',  title: 'Bitcoin' },
        { proName: 'BINANCE:ETHUSDT',  title: 'Ethereum' },
        { proName: 'BINANCE:SOLUSDT',  title: 'Solana' },
        { proName: 'AMEX:SPY',         title: 'S&P 500' },
        { proName: 'NASDAQ:QQQ',       title: 'Nasdaq' },
        { proName: 'NASDAQ:NVDA',      title: 'NVIDIA' },
        { proName: 'NASDAQ:AAPL',      title: 'Apple' },
        { proName: 'NASDAQ:MSFT',      title: 'Microsoft' },
        { proName: 'NASDAQ:TSLA',      title: 'Tesla' },
        { proName: 'NASDAQ:AMZN',      title: 'Amazon' },
        { proName: 'NASDAQ:META',      title: 'Meta' },
        { proName: 'AMEX:GLD',         title: 'Oro' },
        { proName: 'NASDAQ:BND',       title: 'Bonos' },
        { proName: 'BINANCE:XRPUSDT',  title: 'XRP' },
        { proName: 'BINANCE:BNBUSDT',  title: 'BNB' },
      ],
      showSymbolLogo: true,
      isTransparent: false,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'es',
    });

    container.appendChild(script);

    return () => {
      if (container) container.innerHTML = '';
    };
  }, []);

  return (
    <div className="w-full px-4 py-2">
      <div
        ref={containerRef}
        className="tradingview-widget-container rounded-2xl overflow-hidden"
      />
    </div>
  );
}
