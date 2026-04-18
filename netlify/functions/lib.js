// Shared utilities for all Netlify Functions

export async function getQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
    const prev = meta.previousClose ?? meta.chartPreviousClose;
    return {
      symbol,
      price,
      change: price - prev,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      currency: meta.currency,
      name: meta.shortName || symbol,
    };
  } catch { return null; }
}

export async function getMultipleQuotes(symbols) {
  const results = await Promise.all(symbols.map(getQuote));
  return results.filter(Boolean);
}

export async function getHistoricalPrices(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const highs  = result.indicators?.quote?.[0]?.high  || [];
    const lows   = result.indicators?.quote?.[0]?.low   || [];
    const timestamps = result.timestamp || [];
    return closes.map((c, i) => ({ c, h: highs[i], l: lows[i], t: timestamps[i] })).filter(x => x.c != null);
  } catch { return null; }
}

export function calcMA(closes, period) {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const recent = closes.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff; else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

export function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

export function findSupportResistance(candles) {
  const recent = candles.slice(-50);
  const highs = recent.map(c => c.h).filter(Boolean).sort((a, b) => b - a);
  const lows  = recent.map(c => c.l).filter(Boolean).sort((a, b) => a - b);
  const cluster = (levels) => {
    const out = [];
    for (const lvl of levels) {
      if (!out.find(c => Math.abs(c - lvl) / lvl < 0.01)) out.push(lvl);
    }
    return out.slice(0, 3);
  };
  return { resistance: cluster(highs), support: cluster(lows) };
}

export function generateSignal(price, ma20, ma50, ma200, rsi, ema9, support, resistance) {
  let score = 0;
  const signals = [];
  if (ma20 && ma50) {
    if (price > ma20 && ma20 > ma50) { signals.push({ type: 'bullish', text: 'Precio sobre MA20 y MA50' }); score += 2; }
    else if (price < ma20 && ma20 < ma50) { signals.push({ type: 'bearish', text: 'Precio bajo MA20 y MA50' }); score -= 2; }
  }
  if (ma200) {
    if (price > ma200) { signals.push({ type: 'bullish', text: 'Precio sobre MA200' }); score += 1; }
    else { signals.push({ type: 'bearish', text: 'Precio bajo MA200' }); score -= 1; }
  }
  if (ma50 && ma200) {
    if (ma50 > ma200) { signals.push({ type: 'bullish', text: 'Golden Cross activo' }); score += 2; }
    else { signals.push({ type: 'bearish', text: 'Death Cross activo' }); score -= 2; }
  }
  if (rsi !== null) {
    if (rsi < 30) { signals.push({ type: 'bullish', text: `RSI ${rsi.toFixed(0)} — sobreventa` }); score += 2; }
    else if (rsi > 70) { signals.push({ type: 'bearish', text: `RSI ${rsi.toFixed(0)} — sobrecompra` }); score -= 2; }
    else { score += rsi > 50 ? 0.5 : -0.5; }
  }
  if (ema9) {
    if (price > ema9) { score += 1; } else { score -= 1; }
  }
  let entryZone = null, stopLoss = null, target1 = null, target2 = null;
  if (support.length > 0 && resistance.length > 0) {
    const nearSupport = support[0];
    const nearResistance = resistance[0];
    const maLevels = [ma20, ma50, ma200].filter(Boolean);
    const nearestMA = maLevels.length ? maLevels.reduce((p, c) => Math.abs(c - price) < Math.abs(p - price) ? c : p) : null;
    if (score > 0) {
      const base = Math.max(nearSupport, nearestMA || 0);
      entryZone = { low: base * 0.99, high: base * 1.01 };
      stopLoss = nearSupport * 0.97;
      target1 = nearResistance;
      target2 = nearResistance * 1.05;
    } else {
      entryZone = { low: nearResistance * 0.99, high: nearResistance * 1.01 };
      stopLoss = nearResistance * 1.03;
      target1 = nearSupport;
      target2 = nearSupport * 0.95;
    }
  }
  const overallSignal = score >= 3 ? 'COMPRAR' : score <= -3 ? 'VENDER' : score > 0 ? 'ACUMULAR' : 'ESPERAR';
  return { overallSignal, signalStrength: Math.min(Math.abs(score) / 6, 1), score, signals, entryZone, stopLoss, target1, target2 };
}

export async function getFullAnalysis(symbol) {
  const candles = await getHistoricalPrices(symbol);
  if (!candles || candles.length < 20) return null;
  const closes = candles.map(c => c.c);
  const price = closes[closes.length - 1];
  const ma20 = calcMA(closes, 20);
  const ma50 = calcMA(closes, 50);
  const ma200 = calcMA(closes, 200);
  const ema9 = calcEMA(closes, 9);
  const rsi = calcRSI(closes, 14);
  const { support, resistance } = findSupportResistance(candles);
  const signal = generateSignal(price, ma20, ma50, ma200, rsi, ema9, support, resistance);
  return { symbol, price, ma20, ma50, ma200, ema9, rsi, support, resistance, ...signal };
}

export async function translateToSpanish(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    return translated && translated !== text ? translated : text;
  } catch { return text; }
}

export async function getNews(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=6&quotesCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
    const data = await res.json();
    const items = (data?.news || []).slice(0, 5);
    const titles = await Promise.all(items.map(n => translateToSpanish(n.title)));
    return items.map((n, i) => ({
      title: titles[i],
      url: n.link,
      source: n.publisher,
      time: n.providerPublishTime
        ? new Date(n.providerPublishTime * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '',
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
    }));
  } catch { return []; }
}

export const CENTRAL_BANK_RATES = {
  fed:     { rate: 5.25, label: 'Fed Funds Rate' },
  banxico: { rate: 11.00, label: 'Tasa Banxico' },
};

export async function getMacroData() {
  const symbols = ['DX-Y.NYB', 'CL=F', '^TNX', '^IRX', 'MXN=X', 'GC=F', '^MXX'];
  const quotes = await getMultipleQuotes(symbols);
  const q = Object.fromEntries(quotes.map(r => [r.symbol, r]));
  return {
    quotes: {
      dxy:    q['DX-Y.NYB'],
      wti:    q['CL=F'],
      usBond: q['^TNX'],
      tbill:  q['^IRX'],
      mxnusd: q['MXN=X'],
      gold:   q['GC=F'],
      bmv:    q['^MXX'],
    },
    centralBanks: CENTRAL_BANK_RATES,
    timestamp: new Date().toISOString(),
  };
}

export function detectSymbol(msg) {
  const lower = msg.toLowerCase();
  const map = {
    'bitcoin': 'BTC-USD', 'btc': 'BTC-USD',
    'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
    'solana': 'SOL-USD', 'sol': 'SOL-USD',
    'spy': 'SPY', 's&p': 'SPY', 'sp500': 'SPY',
    'qqq': 'QQQ', 'nasdaq': 'QQQ',
    'nvidia': 'NVDA', 'nvda': 'NVDA',
    'apple': 'AAPL', 'aapl': 'AAPL',
    'microsoft': 'MSFT', 'msft': 'MSFT',
    'amazon': 'AMZN', 'amzn': 'AMZN',
    'tesla': 'TSLA', 'tsla': 'TSLA',
    'oro': 'GLD', 'gold': 'GLD', 'gld': 'GLD',
    'bnd': 'BND', 'bonos': 'BND',
    'meta': 'META', 'google': 'GOOGL', 'googl': 'GOOGL',
    'esg': 'ESGU', 'esgu': 'ESGU', 'esgv': 'ESGV',
    'icln': 'ICLN', 'clean energy': 'ICLN', 'energia limpia': 'ICLN',
    'solar': 'TAN', 'tan': 'TAN',
    'sostenible': 'ESGU', 'verde': 'ICLN',
  };
  for (const [key, sym] of Object.entries(map)) {
    if (lower.includes(key)) return sym;
  }
  const tickerMatch = msg.match(/\b([A-Z]{2,5})\b/);
  if (tickerMatch) return tickerMatch[1];
  return null;
}

export const PORTFOLIOS = {
  conservative: [
    { symbol: 'BND',  name: 'Vanguard Total Bond Market ETF',    pct: 25, type: 'Renta Fija' },
    { symbol: 'SCHZ', name: 'Schwab US Aggregate Bond ETF',       pct: 15, type: 'Renta Fija' },
    { symbol: 'GLD',  name: 'SPDR Gold Shares',                   pct: 10, type: 'Commodities' },
    { symbol: 'SPY',  name: 'S&P 500 ETF',                        pct: 10, type: 'Acciones USA' },
    { symbol: 'VIG',  name: 'Vanguard Dividend Appreciation ETF', pct: 8,  type: 'Dividendos' },
    { symbol: 'VYM',  name: 'Vanguard High Dividend Yield ETF',   pct: 7,  type: 'Dividendos' },
    { symbol: 'VTIP', name: 'Vanguard Short-Term Inflation ETF',  pct: 6,  type: 'Renta Fija' },
    { symbol: 'JNJ',  name: 'Johnson & Johnson',                  pct: 4,  type: 'Salud' },
    { symbol: 'PG',   name: 'Procter & Gamble',                   pct: 4,  type: 'Consumo' },
    { symbol: 'KO',   name: 'Coca-Cola',                          pct: 3,  type: 'Consumo' },
    { symbol: 'VNQ',  name: 'Vanguard Real Estate ETF',           pct: 3,  type: 'REIT' },
    { symbol: 'ESGU', name: 'iShares MSCI USA ESG ETF',           pct: 2,  type: 'ESG' },
    { symbol: 'CRBN', name: 'iShares Low Carbon Target ETF',      pct: 1,  type: 'ESG' },
    { symbol: 'SHY',  name: 'iShares 1-3 Year Treasury Bond ETF', pct: 1,  type: 'Renta Fija' },
    { symbol: 'CASH', name: 'Reserva de liquidez',                pct: 1,  type: 'Liquidez' },
  ],
  moderate: [
    { symbol: 'SPY',     name: 'S&P 500 ETF',                    pct: 20, type: 'Acciones USA' },
    { symbol: 'QQQ',     name: 'Nasdaq-100 ETF',                 pct: 12, type: 'Tecnología' },
    { symbol: 'BND',     name: 'Vanguard Total Bond Market ETF', pct: 12, type: 'Renta Fija' },
    { symbol: 'VXUS',    name: 'Vanguard Total International',   pct: 8,  type: 'Internacional' },
    { symbol: 'GLD',     name: 'SPDR Gold Shares',               pct: 7,  type: 'Commodities' },
    { symbol: 'AAPL',    name: 'Apple Inc.',                     pct: 6,  type: 'Tecnología' },
    { symbol: 'MSFT',    name: 'Microsoft Corp.',                pct: 6,  type: 'Tecnología' },
    { symbol: 'VNQ',     name: 'Vanguard Real Estate ETF',       pct: 5,  type: 'REIT' },
    { symbol: 'VIG',     name: 'Vanguard Dividend Appreciation', pct: 5,  type: 'Dividendos' },
    { symbol: 'ICLN',    name: 'iShares Global Clean Energy ETF',pct: 4,  type: 'ESG' },
    { symbol: 'NVDA',    name: 'NVIDIA Corp.',                   pct: 4,  type: 'Tecnología' },
    { symbol: 'BTC-USD', name: 'Bitcoin',                        pct: 4,  type: 'Cripto' },
    { symbol: 'ESGU',    name: 'iShares MSCI USA ESG ETF',       pct: 3,  type: 'ESG' },
    { symbol: 'VWO',     name: 'Vanguard Emerging Markets ETF',  pct: 3,  type: 'Emergentes' },
    { symbol: 'CASH',    name: 'Reserva de liquidez',            pct: 1,  type: 'Liquidez' },
  ],
  aggressive: [
    { symbol: 'QQQ',     name: 'Nasdaq-100 ETF',                 pct: 18, type: 'Tecnología' },
    { symbol: 'NVDA',    name: 'NVIDIA Corp.',                   pct: 10, type: 'Tecnología' },
    { symbol: 'BTC-USD', name: 'Bitcoin',                        pct: 10, type: 'Cripto' },
    { symbol: 'TSLA',    name: 'Tesla Inc.',                     pct: 8,  type: 'Tecnología' },
    { symbol: 'ETH-USD', name: 'Ethereum',                       pct: 7,  type: 'Cripto' },
    { symbol: 'SPY',     name: 'S&P 500 ETF',                    pct: 7,  type: 'Acciones USA' },
    { symbol: 'META',    name: 'Meta Platforms',                 pct: 6,  type: 'Tecnología' },
    { symbol: 'AMZN',    name: 'Amazon.com Inc.',                pct: 6,  type: 'Tecnología' },
    { symbol: 'GOOGL',   name: 'Alphabet (Google)',              pct: 5,  type: 'Tecnología' },
    { symbol: 'ARKK',    name: 'ARK Innovation ETF',             pct: 5,  type: 'Innovación' },
    { symbol: 'SOL-USD', name: 'Solana',                         pct: 5,  type: 'Cripto' },
    { symbol: 'ICLN',    name: 'iShares Global Clean Energy ETF',pct: 4,  type: 'ESG' },
    { symbol: 'VWO',     name: 'Vanguard Emerging Markets ETF',  pct: 4,  type: 'Emergentes' },
    { symbol: 'TAN',     name: 'Invesco Solar ETF',              pct: 3,  type: 'ESG' },
    { symbol: 'CASH',    name: 'Reserva de liquidez',            pct: 2,  type: 'Liquidez' },
  ],
};

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};
