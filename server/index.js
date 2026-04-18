import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const OLLAMA_URL = 'http://localhost:11434';

// ─── Yahoo Finance helpers ────────────────────────────────────────────────────

async function getQuote(symbol) {
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

async function getMultipleQuotes(symbols) {
  const results = await Promise.all(symbols.map(getQuote));
  return results.filter(Boolean);
}

// ─── Technical Analysis ───────────────────────────────────────────────────────

async function getHistoricalPrices(symbol) {
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
    return closes
      .map((c, i) => ({ c, h: highs[i], l: lows[i], t: timestamps[i] }))
      .filter(x => x.c != null);
  } catch { return null; }
}

function calcMA(closes, period) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
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

function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function findSupportResistance(candles) {
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

function generateSignal(price, ma20, ma50, ma200, rsi, ema9, support, resistance) {
  let score = 0;
  const signals = [];

  if (ma20 && ma50) {
    if (price > ma20 && ma20 > ma50) { signals.push({ type: 'bullish', text: 'Precio sobre MA20 y MA50 — tendencia alcista' }); score += 2; }
    else if (price < ma20 && ma20 < ma50) { signals.push({ type: 'bearish', text: 'Precio bajo MA20 y MA50 — tendencia bajista' }); score -= 2; }
  }
  if (ma200) {
    if (price > ma200) { signals.push({ type: 'bullish', text: 'Precio sobre MA200 — largo plazo alcista' }); score += 1; }
    else { signals.push({ type: 'bearish', text: 'Precio bajo MA200 — precaución largo plazo' }); score -= 1; }
  }
  if (ma50 && ma200) {
    if (ma50 > ma200) { signals.push({ type: 'bullish', text: 'Golden Cross activo (MA50 > MA200)' }); score += 2; }
    else { signals.push({ type: 'bearish', text: 'Death Cross activo (MA50 < MA200)' }); score -= 2; }
  }
  if (rsi !== null) {
    if (rsi < 30) { signals.push({ type: 'bullish', text: `RSI ${rsi.toFixed(0)} — sobreventa, posible rebote` }); score += 2; }
    else if (rsi > 70) { signals.push({ type: 'bearish', text: `RSI ${rsi.toFixed(0)} — sobrecompra, posible corrección` }); score -= 2; }
    else { signals.push({ type: 'neutral', text: `RSI ${rsi.toFixed(0)} — zona neutral` }); score += rsi > 50 ? 0.5 : -0.5; }
  }
  if (ema9) {
    if (price > ema9) { signals.push({ type: 'bullish', text: 'Precio sobre EMA9 — momentum corto plazo positivo' }); score += 1; }
    else { signals.push({ type: 'bearish', text: 'Precio bajo EMA9 — momentum corto plazo negativo' }); score -= 1; }
  }

  let entryZone = null, stopLoss = null, target1 = null, target2 = null;
  if (support.length > 0 && resistance.length > 0) {
    const nearSupport = support[0];
    const nearResistance = resistance[0];
    const maLevels = [ma20, ma50, ma200].filter(Boolean);
    const nearestMA = maLevels.length
      ? maLevels.reduce((p, c) => Math.abs(c - price) < Math.abs(p - price) ? c : p)
      : null;
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

async function getFullAnalysis(symbol) {
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

// ─── News ─────────────────────────────────────────────────────────────────────

async function translateToSpanish(text) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    // MyMemory returns the original if it can't translate
    return translated && translated !== text ? translated : text;
  } catch {
    return text;
  }
}

async function getNews(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=6&quotesCount=0&enableFuzzyQuery=false`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } });
    const data = await res.json();
    const items = (data?.news || []).slice(0, 5);

    // Translate all titles in parallel
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

// ─── Endpoints ────────────────────────────────────────────────────────────────

app.get('/api/market', async (req, res) => {
  const symbols = (req.query.symbols || 'SPY,QQQ,BTC-USD,ETH-USD,GLD,BND,AAPL,MSFT,NVDA,AMZN').split(',');
  const quotes = await getMultipleQuotes(symbols);
  res.json({ quotes, timestamp: new Date().toISOString() });
});

app.get('/api/quote/:symbol', async (req, res) => {
  const quote = await getQuote(req.params.symbol.toUpperCase());
  if (!quote) return res.status(404).json({ error: 'Symbol not found' });
  res.json(quote);
});

app.get('/api/analysis/:symbol', async (req, res) => {
  const analysis = await getFullAnalysis(req.params.symbol.toUpperCase());
  if (!analysis) return res.status(404).json({ error: 'No se pudo analizar' });
  res.json(analysis);
});

app.get('/api/news/:symbol', async (req, res) => {
  const news = await getNews(req.params.symbol.toUpperCase());
  res.json({ news });
});

// ─── Ollama ───────────────────────────────────────────────────────────────────

async function isOllamaRunning() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch { return false; }
}

async function getAvailableModel() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    const models = data?.models || [];
    const preferred = ['llama3', 'llama3.2', 'mistral', 'llama2', 'gemma'];
    for (const p of preferred) {
      const found = models.find(m => m.name.startsWith(p));
      if (found) return found.name;
    }
    return models[0]?.name || null;
  } catch { return null; }
}

// ─── Symbol detector ──────────────────────────────────────────────────────────

function detectSymbol(msg) {
  const lower = msg.toLowerCase();
  const map = {
    // Crypto
    'bitcoin': 'BTC-USD', 'btc': 'BTC-USD',
    'ethereum': 'ETH-USD', 'eth': 'ETH-USD',
    'solana': 'SOL-USD', 'sol': 'SOL-USD',
    // Indices / ETFs
    'spy': 'SPY', 's&p': 'SPY', 'sp500': 'SPY',
    'qqq': 'QQQ', 'nasdaq': 'QQQ',
    // Stocks
    'nvidia': 'NVDA', 'nvda': 'NVDA',
    'apple': 'AAPL', 'aapl': 'AAPL',
    'microsoft': 'MSFT', 'msft': 'MSFT',
    'amazon': 'AMZN', 'amzn': 'AMZN',
    'tesla': 'TSLA', 'tsla': 'TSLA',
    'meta': 'META', 'google': 'GOOGL', 'googl': 'GOOGL',
    // Commodities
    'oro': 'GLD', 'gold': 'GLD', 'gld': 'GLD',
    'bnd': 'BND', 'bonos': 'BND',
    // ESG ETFs
    'esg': 'ESGU',
    'esgu': 'ESGU',
    'esgv': 'ESGV',
    'esge': 'ESGE',
    'susa': 'SUSA',
    'dssi': 'DSSI',
    'susl': 'SUSL',
    'crbn': 'CRBN',
    'icln': 'ICLN',
    'clean energy': 'ICLN', 'energia limpia': 'ICLN', 'energía limpia': 'ICLN',
    'solar': 'TAN', 'tan': 'TAN',
    'viento': 'FAN', 'fan': 'FAN',
    'agua': 'PHO', 'pho': 'PHO',
    'sostenible': 'ESGU', 'sustentable': 'ESGU',
    'verde': 'ICLN', 'green': 'ICLN',
    'carbono': 'CRBN', 'carbon': 'CRBN',
    'renovable': 'ICLN', 'renewable': 'ICLN',
  };
  for (const [key, sym] of Object.entries(map)) {
    if (lower.includes(key)) return sym;
  }
  const tickerMatch = msg.match(/\b([A-Z]{2,5})\b/);
  if (tickerMatch) return tickerMatch[1];
  return null;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { message, riskLevel, history = [] } = req.body;

  const marketSymbols = ['SPY', 'QQQ', 'BTC-USD', 'ETH-USD', 'GLD', 'BND', 'AAPL', 'MSFT', 'NVDA'];
  const quotes = await getMultipleQuotes(marketSymbols);
  const marketContext = quotes
    .map(q => `${q.name} (${q.symbol}): $${q.price?.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}%)`)
    .join('\n');

  const analysisSymbol = detectSymbol(message);
  let analysisData = null;
  let newsData = [];
  let analysisContext = '';

  if (analysisSymbol) {
    [analysisData, newsData] = await Promise.all([
      getFullAnalysis(analysisSymbol),
      getNews(analysisSymbol),
    ]);
    if (analysisData) {
      const a = analysisData;
      const lines = [
        `\nANALISIS TECNICO DE ${analysisSymbol}:`,
        `Precio: $${a.price?.toFixed(2)}`,
        `MA20: $${a.ma20?.toFixed(2) || 'N/D'} | MA50: $${a.ma50?.toFixed(2) || 'N/D'} | MA200: $${a.ma200?.toFixed(2) || 'N/D'}`,
        `EMA9: $${a.ema9?.toFixed(2) || 'N/D'} | RSI(14): ${a.rsi?.toFixed(1) || 'N/D'}`,
        `Soporte: ${a.support.map(s => '$' + s.toFixed(2)).join(', ')}`,
        `Resistencia: ${a.resistance.map(r => '$' + r.toFixed(2)).join(', ')}`,
        `Senal: ${a.overallSignal}`,
        a.entryZone ? `Zona entrada: $${a.entryZone.low.toFixed(2)} - $${a.entryZone.high.toFixed(2)}` : '',
        a.stopLoss  ? `Stop Loss: $${a.stopLoss.toFixed(2)}` : '',
        a.target1   ? `Target 1: $${a.target1.toFixed(2)} | Target 2: $${a.target2?.toFixed(2)}` : '',
      ];
      analysisContext = lines.filter(Boolean).join('\n');
    }
  }

  const newsContext = newsData.length > 0
    ? '\nULTIMAS NOTICIAS DE ' + analysisSymbol + ':\n' +
      newsData.map((n, i) => (i + 1) + '. ' + n.title + ' (' + n.source + ', ' + n.time + ')').join('\n')
    : '';

  const riskMap = {
    conservative: 'Conservador - preservacion de capital, bonos, renta fija',
    moderate: 'Moderado - equilibrio crecimiento/seguridad, 60/40',
    aggressive: 'Agresivo - maximo crecimiento, cripto, alta volatilidad',
  };

  const systemPrompt = 'Eres un asesor financiero y analista tecnico experto llamado BLACK.IA. Respondes en espanol.\n' +
    'Perfil de riesgo: ' + (riskMap[riskLevel] || 'No definido') + '.\n\n' +
    'MERCADO EN TIEMPO REAL (' + new Date().toLocaleString('es-ES') + '):\n' +
    marketContext + '\n' +
    analysisContext + '\n' +
    newsContext + '\n\n' +
    'ACTIVOS ESG DISPONIBLES (inversion sostenible/responsable):\n' +
    '• ESGU - iShares MSCI USA ESG Optimized ETF (acciones USA sostenibles)\n' +
    '• ESGV - Vanguard ESG US Stock ETF (amplio mercado ESG)\n' +
    '• ESGE - iShares MSCI EM ESG Optimized (mercados emergentes ESG)\n' +
    '• SUSA - iShares MSCI USA ESG Select ETF\n' +
    '• ICLN - iShares Global Clean Energy ETF (energia limpia global)\n' +
    '• TAN  - Invesco Solar ETF (energia solar)\n' +
    '• FAN  - First Trust Global Wind Energy ETF (energia eolica)\n' +
    '• PHO  - Invesco Water Resources ETF (recursos hidricos)\n' +
    '• CRBN - iShares MSCI ACWI Low Carbon Target ETF (baja huella de carbono)\n' +
    '• SUSL - iShares ESG MSCI USA Leaders ETF\n\n' +
    'Si el usuario pregunta por ESG, sostenibilidad, energia limpia o inversion verde, recomienda estos ETFs segun su perfil de riesgo.\n' +
    'Usa los datos tecnicos para dar zona de entrada, stop loss y targets. Si hay noticias relevantes mencionalas brevemente. Se conciso.';

  const ollamaOk = await isOllamaRunning();
  if (ollamaOk) {
    const model = await getAvailableModel();
    if (model) {
      try {
        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.slice(-6).map(h => ({ role: h.isUser ? 'user' : 'assistant', content: h.content })),
          { role: 'user', content: message },
        ];
        const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, stream: false }),
        });
        const data = await ollamaRes.json();
        return res.json({ response: data.message?.content || 'Sin respuesta.', model, marketData: quotes, analysis: analysisData, news: newsData });
      } catch (err) { console.error('Ollama error:', err.message); }
    }
  }

  const response = await generateSmartResponse(message, riskLevel, quotes, analysisData);
  res.json({ response, model: 'built-in', marketData: quotes, analysis: analysisData, news: newsData });
});

// ─── Smart fallback ───────────────────────────────────────────────────────────

async function generateSmartResponse(msg, risk, quotes, analysis) {
  const lower = msg.toLowerCase();
  const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q]));
  const fmt = (q) => q ? `$${q.price?.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}% hoy)` : 'N/D';

  // ESG / sostenibilidad
  const isESG = lower.includes('esg') || lower.includes('sostenible') || lower.includes('sustentable') ||
    lower.includes('verde') || lower.includes('limpia') || lower.includes('renovable') ||
    lower.includes('carbono') || lower.includes('solar') || lower.includes('viento') ||
    lower.includes('agua') || lower.includes('green') || lower.includes('clean');

  if (isESG && !analysis) {
    const esgByRisk = {
      conservative: [
        '🌱 Para perfil Conservador, los mejores ETFs ESG son:',
        '• ESGV (Vanguard ESG US Stock) — diversificado y estable',
        '• ESGU (iShares MSCI USA ESG) — grandes empresas sostenibles',
        '• CRBN (Low Carbon Target) — baja volatilidad, huella de carbono reducida',
        '',
        'Pide "analiza ESGV" o "analiza ESGU" para ver señales de entrada con medias móviles.',
      ],
      moderate: [
        '🌱 Para perfil Moderado, los mejores ETFs ESG son:',
        '• ESGU (iShares MSCI USA ESG) — núcleo sostenible USA',
        '• ICLN (Clean Energy Global) — energía limpia con crecimiento',
        '• ESGE (Mercados Emergentes ESG) — diversificación global',
        '• PHO (Water Resources) — sector agua, defensivo y sostenible',
        '',
        'Pide "analiza ICLN" o "analiza ESGU" para ver señales técnicas.',
      ],
      aggressive: [
        '🌱 Para perfil Agresivo, los mejores ETFs ESG son:',
        '• ICLN (Clean Energy Global) — alto potencial de crecimiento',
        '• TAN (Solar ETF) — energía solar, sector de alto crecimiento',
        '• FAN (Wind Energy) — energía eólica global',
        '• ESGE (Emergentes ESG) — mayor riesgo/retorno',
        '',
        'Pide "analiza TAN" o "analiza ICLN" para ver señales de entrada.',
      ],
    };
    return (esgByRisk[risk] || esgByRisk.moderate).join('\n');
  }

  if (analysis) {
    const a = analysis;
    const signalEmoji = a.overallSignal === 'COMPRAR' ? '🟢' : a.overallSignal === 'VENDER' ? '🔴' : a.overallSignal === 'ACUMULAR' ? '🔵' : '⚪';
    const q = priceMap[a.symbol];
    let r = `📊 Análisis técnico de ${a.symbol}\n`;
    r += `Precio: $${a.price?.toFixed(2)}${q ? ` (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}% hoy)` : ''}\n\n`;
    r += `📈 Medias Móviles:\n`;
    if (a.ma20)  r += `• MA20:  $${a.ma20.toFixed(2)}  ${a.price > a.ma20  ? '✅' : '❌'}\n`;
    if (a.ma50)  r += `• MA50:  $${a.ma50.toFixed(2)}  ${a.price > a.ma50  ? '✅' : '❌'}\n`;
    if (a.ma200) r += `• MA200: $${a.ma200.toFixed(2)} ${a.price > a.ma200 ? '✅' : '❌'}\n`;
    if (a.rsi)   r += `• RSI(14): ${a.rsi.toFixed(1)} ${a.rsi < 30 ? '⚡ Sobreventa' : a.rsi > 70 ? '⚠️ Sobrecompra' : '✅ Normal'}\n`;
    r += `\n${signalEmoji} Señal: ${a.overallSignal}\n`;
    if (a.entryZone) r += `\n🎯 Entrada: $${a.entryZone.low.toFixed(2)} – $${a.entryZone.high.toFixed(2)}\n`;
    if (a.stopLoss)  r += `🛑 Stop Loss: $${a.stopLoss.toFixed(2)}\n`;
    if (a.target1)   r += `🏆 Target 1: $${a.target1.toFixed(2)}\n`;
    if (a.target2)   r += `🏆 Target 2: $${a.target2.toFixed(2)}\n`;
    if (a.support.length)    r += `\n📉 Soporte: ${a.support.slice(0,2).map(s => '$'+s.toFixed(2)).join(' | ')}\n`;
    if (a.resistance.length) r += `📈 Resistencia: ${a.resistance.slice(0,2).map(s => '$'+s.toFixed(2)).join(' | ')}\n`;
    const riskNote = risk === 'conservative' ? '\n⚠️ Perfil conservador: usa stop loss ajustado.' : risk === 'aggressive' ? '\n💪 Perfil agresivo: puedes aprovechar la señal.' : '\n📌 Perfil moderado: gestiona bien el riesgo.';
    r += riskNote;
    return r;
  }

  if (lower.includes('mercado') || lower.includes('hoy') || lower.includes('situacion') || lower.includes('mundial') || lower.includes('macro') || lower.includes('dolar') || lower.includes('petroleo') || lower.includes('fed') || lower.includes('banxico') || lower.includes('inflaci')) {
    const macro = await getMacroData();
    const mq = macro.quotes;
    const cb = macro.centralBanks;
    const spy = priceMap['SPY'];
    const qqq = priceMap['QQQ'];
    const btc = priceMap['BTC-USD'];
    const trend = (q) => !q ? '' : q.changePct >= 0 ? '📈' : '📉';
    const fmtQ = (q, pre) => q && q.price ? (pre||'') + q.price.toFixed(2) + ' (' + (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '% hoy)' : 'N/D';
    const lines = [
      '🌍 Situación del mercado global — datos en tiempo real:',
      '',
      '💵 Dólar (DXY): ' + fmtQ(mq.dxy),
      '🛢️ Petróleo WTI: ' + fmtQ(mq.wti, '$'),
      '🇺🇸 Bono USA 10Y: ' + (mq.usBond && mq.usBond.price ? mq.usBond.price.toFixed(3) + '% yield ' + trend(mq.usBond) : 'N/D'),
      '🇲🇽 USD/MXN: ' + fmtQ(mq.mxnusd),
      '🥇 Oro: ' + fmtQ(mq.gold, '$'),
      '📊 Bolsa México (IPC): ' + (mq.bmv && mq.bmv.price ? mq.bmv.price.toFixed(0) + ' pts ' + trend(mq.bmv) : 'N/D'),
      '🏦 Tasa Fed: ' + cb.fed.rate + '%',
      '🏛️ Tasa Banxico: ' + cb.banxico.rate + '%',
      '',
      '📈 Mercados principales:',
      '• S&P 500 (SPY): ' + fmt(spy),
      '• Nasdaq (QQQ): ' + fmt(qqq),
      '• Bitcoin: ' + fmt(btc),
      '',
      '🔗 Impacto en activos hoy:',
      mq.dxy && mq.dxy.changePct > 0.3 ? '• Dólar fuerte → presión en emergentes y commodities' : mq.dxy && mq.dxy.changePct < -0.3 ? '• Dólar débil → impulso en emergentes y oro' : '• Dólar estable hoy',
      mq.wti && mq.wti.changePct > 1 ? '• Petróleo al alza → presión inflacionaria' : mq.wti && mq.wti.changePct < -1 ? '• Petróleo a la baja → alivio inflacionario' : '• Petróleo estable hoy',
      mq.usBond && mq.usBond.price > 4.5 ? '• Yields altos → presión en acciones de crecimiento y cripto' : '• Yields moderados → menor presión en renta variable',
      mq.gold && mq.gold.changePct > 0.5 ? '• Oro al alza → señal de incertidumbre y búsqueda de refugio' : '',
      '',
      'Pide "analiza SPY", "analiza BTC" o cualquier activo para señales técnicas.',
    ];
    return lines.filter(l => l !== '').join('\n');
  }

  const defaults = {
    conservative: `Perfil Conservador: SPY ${fmt(priceMap['SPY'])}, BND ${fmt(priceMap['BND'])}. Pide "analiza SPY" para señales de entrada.`,
    moderate: `Perfil Moderado: SPY ${fmt(priceMap['SPY'])}, QQQ ${fmt(priceMap['QQQ'])}. Pide "analiza QQQ" para señales técnicas.`,
    aggressive: `Perfil Agresivo: QQQ ${fmt(priceMap['QQQ'])}, BTC ${fmt(priceMap['BTC-USD'])}, NVDA ${fmt(priceMap['NVDA'])}. Pide "analiza NVDA" para señales.`,
  };
  return defaults[risk] || `Puedo analizar cualquier activo con MA20/50/200, RSI y zonas de entrada. Prueba: "analiza BTC"`;
}

// ─── Macro Market Context ─────────────────────────────────────────────────────

const MACRO_SYMBOLS = {
  dxy:    'DX-Y.NYB',   // Índice del dólar
  wti:    'CL=F',       // Petróleo WTI
  usBond: '^TNX',       // Bono USA 10Y yield
  tbill:  '^IRX',       // T-Bill 13 semanas (proxy Fed rate)
  mxnusd: 'MXN=X',      // Peso mexicano vs dólar
  gold:   'GC=F',       // Oro
  bmv:    '^MXX',       // Bolsa México (IPC)
};

// Banxico y Fed rates son datos estáticos actualizados manualmente
// (no hay feed gratuito en tiempo real para tasas de banco central)
const CENTRAL_BANK_RATES = {
  fed:     { rate: 5.25, label: 'Fed Funds Rate', updated: '2024-09' },
  banxico: { rate: 11.00, label: 'Tasa Banxico',  updated: '2024-09' },
};

async function getMacroData() {
  const symbols = Object.values(MACRO_SYMBOLS);
  const quotes = await getMultipleQuotes(symbols);
  const q = Object.fromEntries(quotes.map(r => [r.symbol, r]));

  const dxy    = q['DX-Y.NYB'];
  const wti    = q['CL=F'];
  const usBond = q['^TNX'];
  const tbill  = q['^IRX'];
  const mxnusd = q['MXN=X'];
  const gold   = q['GC=F'];
  const bmv    = q['^MXX'];

  // Build narrative context for AI
  const lines = [];
  if (dxy)    lines.push(`Dólar (DXY): ${dxy.price?.toFixed(2)} (${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct?.toFixed(2)}% hoy)`);
  if (wti)    lines.push(`Petróleo WTI: $${wti.price?.toFixed(2)} (${wti.changePct >= 0 ? '+' : ''}${wti.changePct?.toFixed(2)}% hoy)`);
  if (usBond) lines.push(`Bono USA 10Y: ${usBond.price?.toFixed(2)}% yield (${usBond.changePct >= 0 ? '+' : ''}${usBond.changePct?.toFixed(2)}% hoy)`);
  if (tbill)  lines.push(`T-Bill 13W (proxy Fed): ${tbill.price?.toFixed(2)}%`);
  if (mxnusd) lines.push(`USD/MXN: ${mxnusd.price?.toFixed(4)} (${mxnusd.changePct >= 0 ? '+' : ''}${mxnusd.changePct?.toFixed(2)}% hoy)`);
  if (gold)   lines.push(`Oro: $${gold.price?.toFixed(2)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct?.toFixed(2)}% hoy)`);
  if (bmv)    lines.push(`Bolsa México (IPC): ${bmv.price?.toFixed(0)} pts (${bmv.changePct >= 0 ? '+' : ''}${bmv.changePct?.toFixed(2)}% hoy)`);
  lines.push(`Tasa Fed: ${CENTRAL_BANK_RATES.fed.rate}% (última actualización: ${CENTRAL_BANK_RATES.fed.updated})`);
  lines.push(`Tasa Banxico: ${CENTRAL_BANK_RATES.banxico.rate}% (última actualización: ${CENTRAL_BANK_RATES.banxico.updated})`);

  return {
    quotes: { dxy, wti, usBond, tbill, mxnusd, gold, bmv },
    centralBanks: CENTRAL_BANK_RATES,
    context: lines.join('\n'),
    timestamp: new Date().toISOString(),
  };
}

app.get('/api/macro', async (req, res) => {
  const data = await getMacroData();
  res.json(data);
});

const PORTFOLIOS = {
  conservative: [
    { symbol: 'BND',  name: 'Vanguard Total Bond Market ETF',     pct: 25, type: 'Renta Fija' },
    { symbol: 'SCHZ', name: 'Schwab US Aggregate Bond ETF',        pct: 15, type: 'Renta Fija' },
    { symbol: 'GLD',  name: 'SPDR Gold Shares',                    pct: 10, type: 'Commodities' },
    { symbol: 'SPY',  name: 'S&P 500 ETF (SPDR)',                  pct: 10, type: 'Acciones USA' },
    { symbol: 'VIG',  name: 'Vanguard Dividend Appreciation ETF',  pct: 8,  type: 'Dividendos' },
    { symbol: 'VYM',  name: 'Vanguard High Dividend Yield ETF',    pct: 7,  type: 'Dividendos' },
    { symbol: 'VTIP', name: 'Vanguard Short-Term Inflation ETF',   pct: 6,  type: 'Renta Fija' },
    { symbol: 'JNJ',  name: 'Johnson & Johnson',                   pct: 4,  type: 'Salud' },
    { symbol: 'PG',   name: 'Procter & Gamble',                    pct: 4,  type: 'Consumo' },
    { symbol: 'KO',   name: 'Coca-Cola',                           pct: 3,  type: 'Consumo' },
    { symbol: 'VNQ',  name: 'Vanguard Real Estate ETF',            pct: 3,  type: 'REIT' },
    { symbol: 'ESGU', name: 'iShares MSCI USA ESG ETF',            pct: 2,  type: 'ESG' },
    { symbol: 'CRBN', name: 'iShares Low Carbon Target ETF',       pct: 1,  type: 'ESG' },
    { symbol: 'SHY',  name: 'iShares 1-3 Year Treasury Bond ETF',  pct: 1,  type: 'Renta Fija' },
    { symbol: 'CASH', name: 'Reserva de liquidez (efectivo)',       pct: 1,  type: 'Liquidez' },
  ],
  moderate: [
    { symbol: 'SPY',  name: 'S&P 500 ETF (SPDR)',                  pct: 20, type: 'Acciones USA' },
    { symbol: 'QQQ',  name: 'Nasdaq-100 ETF (Invesco)',            pct: 12, type: 'Tecnología' },
    { symbol: 'BND',  name: 'Vanguard Total Bond Market ETF',      pct: 12, type: 'Renta Fija' },
    { symbol: 'VXUS', name: 'Vanguard Total International Stock',  pct: 8,  type: 'Internacional' },
    { symbol: 'GLD',  name: 'SPDR Gold Shares',                    pct: 7,  type: 'Commodities' },
    { symbol: 'AAPL', name: 'Apple Inc.',                          pct: 6,  type: 'Tecnología' },
    { symbol: 'MSFT', name: 'Microsoft Corp.',                     pct: 6,  type: 'Tecnología' },
    { symbol: 'VNQ',  name: 'Vanguard Real Estate ETF',            pct: 5,  type: 'REIT' },
    { symbol: 'VIG',  name: 'Vanguard Dividend Appreciation ETF',  pct: 5,  type: 'Dividendos' },
    { symbol: 'ICLN', name: 'iShares Global Clean Energy ETF',     pct: 4,  type: 'ESG' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.',                        pct: 4,  type: 'Tecnología' },
    { symbol: 'BTC-USD', name: 'Bitcoin',                          pct: 4,  type: 'Cripto' },
    { symbol: 'ESGU', name: 'iShares MSCI USA ESG ETF',            pct: 3,  type: 'ESG' },
    { symbol: 'VWO',  name: 'Vanguard Emerging Markets ETF',       pct: 3,  type: 'Emergentes' },
    { symbol: 'CASH', name: 'Reserva de liquidez (efectivo)',       pct: 1,  type: 'Liquidez' },
  ],
  aggressive: [
    { symbol: 'QQQ',  name: 'Nasdaq-100 ETF (Invesco)',            pct: 18, type: 'Tecnología' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.',                        pct: 10, type: 'Tecnología' },
    { symbol: 'BTC-USD', name: 'Bitcoin',                          pct: 10, type: 'Cripto' },
    { symbol: 'TSLA', name: 'Tesla Inc.',                          pct: 8,  type: 'Tecnología' },
    { symbol: 'ETH-USD', name: 'Ethereum',                         pct: 7,  type: 'Cripto' },
    { symbol: 'SPY',  name: 'S&P 500 ETF (SPDR)',                  pct: 7,  type: 'Acciones USA' },
    { symbol: 'META', name: 'Meta Platforms',                      pct: 6,  type: 'Tecnología' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.',                     pct: 6,  type: 'Tecnología' },
    { symbol: 'GOOGL',name: 'Alphabet (Google)',                   pct: 5,  type: 'Tecnología' },
    { symbol: 'ARKK', name: 'ARK Innovation ETF',                  pct: 5,  type: 'Innovación' },
    { symbol: 'SOL-USD', name: 'Solana',                           pct: 5,  type: 'Cripto' },
    { symbol: 'ICLN', name: 'iShares Global Clean Energy ETF',     pct: 4,  type: 'ESG' },
    { symbol: 'VWO',  name: 'Vanguard Emerging Markets ETF',       pct: 4,  type: 'Emergentes' },
    { symbol: 'TAN',  name: 'Invesco Solar ETF',                   pct: 3,  type: 'ESG' },
    { symbol: 'CASH', name: 'Reserva de liquidez (efectivo)',       pct: 2,  type: 'Liquidez' },
  ],
};

app.post('/api/invest', async (req, res) => {
  const { riskLevel, capital } = req.body;
  const cap = parseFloat(capital) || 1000;
  const profile = PORTFOLIOS[riskLevel] || PORTFOLIOS.moderate;

  // Fetch real prices for all non-cash symbols
  const symbols = profile.filter(a => a.symbol !== 'CASH').map(a => a.symbol);
  const quotes = await getMultipleQuotes(symbols);
  const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q]));

  const assets = profile.map(asset => {
    const amount = (cap * asset.pct) / 100;
    const q = priceMap[asset.symbol];
    const price = q?.price || null;
    const shares = price ? amount / price : null;
    return {
      ...asset,
      amount: parseFloat(amount.toFixed(2)),
      price: price ? parseFloat(price.toFixed(2)) : null,
      shares: shares ? parseFloat(shares.toFixed(4)) : null,
      changePct: q?.changePct ? parseFloat(q.changePct.toFixed(2)) : null,
    };
  });

  res.json({ assets, capital: cap, riskLevel });
});

app.get('/api/status', async (req, res) => {
  const ollamaOk = await isOllamaRunning();
  const model = ollamaOk ? await getAvailableModel() : null;
  res.json({ ollama: ollamaOk, model, timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BLACK.IA server running on http://localhost:${PORT}`);
  console.log(`Technical analysis: MA9/20/50/200, RSI, Support/Resistance, News`);
});
