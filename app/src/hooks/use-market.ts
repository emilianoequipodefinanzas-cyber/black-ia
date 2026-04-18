import { useState, useEffect, useCallback } from 'react';
import { fetchMarket, type Quote } from '@/lib/api';

const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'BTC-USD', 'ETH-USD', 'GLD', 'BND', 'AAPL', 'MSFT', 'NVDA'];
const REFRESH_INTERVAL = 30_000; // 30 seconds

export function useMarket() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchMarket(DEFAULT_SYMBOLS);
      setQuotes(data);
      setLastUpdated(new Date());
    } catch {
      // server not ready yet, silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return { quotes, loading, lastUpdated, refresh };
}
