// Shared utilities for Netlify Functions

export async function getQuote(symbol) {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?interval=1d&range=1d';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
    const prev = meta.previousClose ?? meta.chartPreviousClose;
    return {
      symbol,
      name: meta.shortName || symbol,
      price,
      change: price - prev,
      changePct: prev ? ((price - prev) / prev) * 100 : 0,
      currency: meta.currency,
    };
  } catch { return null; }
}

export async function getMultipleQuotes(symbols) {
  const results = await Promise.all(symbols.map(getQuote));
  return results.filter(Boolean);
}

export async function getHistoricalPrices(symbol) {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + symbol + '?interval=1d&range=1y';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const highs  = result.indicators?.quote?.[0]?.high  || [];
    const lows   = result.indicators?.quote?.[0]?.low   || [];
    return closes.map((c, i) => ({ c, h: highs[i], l: lows[i] })).filter(x => x.c != null);
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
    const d = recent[i] - recent[i - 1];
    if (d > 0) gains += d; else losses += Math.abs(d);
  }
  const ag = gains / period, al = losses / period;
  if (al === 0) return 100;
  return 100 - (100 / (1 + ag / al));
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
  let score = 0;
  if (ma20 && ma50) { if (price > ma20 && ma20 > ma50) score += 2; else if (price < ma20 && ma20 < ma50) score -= 2; }
  if (ma200) { score += price > ma200 ? 1 : -1; }
  if (ma50 && ma200) { score += ma50 > ma200 ? 2 : -2; }
  if (rsi !== null) { if (rsi < 30) score += 2; else if (rsi > 70) score -= 2; else score += rsi > 50 ? 0.5 : -0.5; }
  if (ema9) { score += price > ema9 ? 1 : -1; }
  let entryZone = null, stopLoss = null, target1 = null, target2 = null;
  if (support.length > 0 && resistance.length > 0) {
    const ns = support[0], nr = resistance[0];
    const maLevels = [ma20, ma50, ma200].filter(Boolean);
    const nma = maLevels.length ? maLevels.reduce((p, c) => Math.abs(c - price) < Math.abs(p - price) ? c : p) : null;
    if (score > 0) {
      const base = Math.max(ns, nma || 0);
      entryZone = { low: parseFloat((base * 0.99).toFixed(2)), high: parseFloat((base * 1.01).toFixed(2)) };
      stopLoss = parseFloat((ns * 0.97).toFixed(2));
      target1 = parseFloat(nr.toFixed(2));
      target2 = parseFloat((nr * 1.05).toFixed(2));
    } else {
      entryZone = { low: parseFloat((nr * 0.99).toFixed(2)), high: parseFloat((nr * 1.01).toFixed(2)) };
      stopLoss = parseFloat((nr * 1.03).toFixed(2));
      target1 = parseFloat(ns.toFixed(2));
      target2 = parseFloat((ns * 0.95).toFixed(2));
    }
  }
  const overallSignal = score >= 3 ? 'COMPRAR' : score <= -3 ? 'VENDER' : score > 0 ? 'ACUMULAR' : 'ESPERAR';
  return {
    symbol, price: parseFloat(price.toFixed(2)),
    ma20: ma20 ? parseFloat(ma20.toFixed(2)) : null,
    ma50: ma50 ? parseFloat(ma50.toFixed(2)) : null,
    ma200: ma200 ? parseFloat(ma200.toFixed(2)) : null,
    ema9: ema9 ? parseFloat(ema9.toFixed(2)) : null,
    rsi: rsi ? parseFloat(rsi.toFixed(2)) : null,
    support: support.map(s => parseFloat(s.toFixed(2))),
    resistance: resistance.map(r => parseFloat(r.toFixed(2))),
    overallSignal, score, entryZone, stopLoss, target1, target2, signals: [],
  };
}

export async function getNews(symbol) {
  try {
    const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=' + symbol + '&newsCount=6&quotesCount=0&enableFuzzyQuery=false';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
    const data = await res.json();
    return (data?.news || []).slice(0, 5).map(n => ({
      title: n.title,
      url: n.link,
      source: n.publisher,
      time: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '',
      thumbnail: n.thumbnail?.resolutions?.[0]?.url || null,
    }));
  } catch { return []; }
}

export async function getMacroData() {
  const symbols = ['DX-Y.NYB', 'CL=F', '^TNX', '^IRX', 'MXN=X', 'GC=F', '^MXX'];
  const quotes = await getMultipleQuotes(symbols);
  const q = Object.fromEntries(quotes.map(r => [r.symbol, r]));
  return {
    quotes: { dxy: q['DX-Y.NYB'], wti: q['CL=F'], usBond: q['^TNX'], tbill: q['^IRX'], mxnusd: q['MXN=X'], gold: q['GC=F'], bmv: q['^MXX'] },
    centralBanks: { fed: { rate: 5.25 }, banxico: { rate: 11.00 } },
    timestamp: new Date().toISOString(),
  };
}

export function detectSymbol(msg) {
  const lower = msg.toLowerCase();
  const map = {
    'bitcoin': 'BTC-USD', 'btc': 'BTC-USD', 'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
    'solana': 'SOL-USD', 'sol': 'SOL-USD', 'spy': 'SPY', 'sp500': 'SPY',
    'qqq': 'QQQ', 'nasdaq': 'QQQ', 'nvidia': 'NVDA', 'nvda': 'NVDA',
    'apple': 'AAPL', 'aapl': 'AAPL', 'microsoft': 'MSFT', 'msft': 'MSFT',
    'amazon': 'AMZN', 'amzn': 'AMZN', 'tesla': 'TSLA', 'tsla': 'TSLA',
    'oro': 'GLD', 'gold': 'GLD', 'gld': 'GLD', 'bonos': 'BND', 'bnd': 'BND',
    'meta': 'META', 'google': 'GOOGL', 'googl': 'GOOGL',
    'esg': 'ESGU', 'icln': 'ICLN', 'solar': 'TAN', 'tan': 'TAN',
  };
  for (const [key, sym] of Object.entries(map)) { if (lower.includes(key)) return sym; }
  const m = msg.match(/\b([A-Z]{2,5})\b/);
  return m ? m[1] : null;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};
