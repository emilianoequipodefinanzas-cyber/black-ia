import { getMultipleQuotes, getFullAnalysis, getNews, getMacroData, detectSymbol, CORS_HEADERS } from './lib.js';

function fmt(q) {
  if (!q) return 'N/D';
  const sign = q.changePct >= 0 ? '+' : '';
  return '$' + q.price.toFixed(2) + ' (' + sign + q.changePct.toFixed(2) + '% hoy)';
}

function buildAnalysisText(a, riskLevel, priceMap) {
  const q = priceMap[a.symbol];
  const emoji = a.overallSignal === 'COMPRAR' ? '🟢' : a.overallSignal === 'VENDER' ? '🔴' : a.overallSignal === 'ACUMULAR' ? '🔵' : '⚪';
  let r = '📊 Análisis técnico de ' + a.symbol + '\n';
  r += 'Precio: $' + a.price.toFixed(2);
  if (q) r += ' (' + (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '% hoy)';
  r += '\n\n📈 Medias Móviles:\n';
  if (a.ma20)  r += '• MA20:  $' + a.ma20.toFixed(2)  + '  ' + (a.price > a.ma20  ? '✅' : '❌') + '\n';
  if (a.ma50)  r += '• MA50:  $' + a.ma50.toFixed(2)  + '  ' + (a.price > a.ma50  ? '✅' : '❌') + '\n';
  if (a.ma200) r += '• MA200: $' + a.ma200.toFixed(2) + ' '  + (a.price > a.ma200 ? '✅' : '❌') + '\n';
  if (a.rsi)   r += '• RSI(14): ' + a.rsi.toFixed(1) + ' ' + (a.rsi < 30 ? '⚡ Sobreventa' : a.rsi > 70 ? '⚠️ Sobrecompra' : '✅ Normal') + '\n';
  r += '\n' + emoji + ' Señal: ' + a.overallSignal + '\n';
  if (a.entryZone) r += '\n🎯 Entrada: $' + a.entryZone.low.toFixed(2) + ' – $' + a.entryZone.high.toFixed(2) + '\n';
  if (a.stopLoss)  r += '🛑 Stop Loss: $' + a.stopLoss.toFixed(2) + '\n';
  if (a.target1)   r += '🏆 Target 1: $' + a.target1.toFixed(2) + '\n';
  if (a.target2)   r += '🏆 Target 2: $' + a.target2.toFixed(2) + '\n';
  if (a.support && a.support.length)    r += '\n📉 Soporte: ' + a.support.slice(0,2).map(s => '$' + s.toFixed(2)).join(' | ') + '\n';
  if (a.resistance && a.resistance.length) r += '📈 Resistencia: ' + a.resistance.slice(0,2).map(s => '$' + s.toFixed(2)).join(' | ') + '\n';
  const riskNote = riskLevel === 'conservative' ? '\n⚠️ Perfil conservador: usa stop loss ajustado.' : riskLevel === 'aggressive' ? '\n💪 Perfil agresivo: puedes aprovechar la señal.' : '\n📌 Perfil moderado: gestiona bien el riesgo.';
  r += riskNote;
  return r;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  try {
    const { message, riskLevel } = JSON.parse(event.body || '{}');
    const lower = message.toLowerCase();

    const marketSymbols = ['SPY', 'QQQ', 'BTC-USD', 'ETH-USD', 'GLD', 'BND', 'AAPL', 'MSFT', 'NVDA'];
    const quotes = await getMultipleQuotes(marketSymbols);
    const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q]));

    const sym = detectSymbol(message);
    let analysisData = null;
    let newsData = [];

    if (sym) {
      [analysisData, newsData] = await Promise.all([
        getFullAnalysis(sym),
        getNews(sym),
      ]);
    }

    // ESG
    const isESG = /esg|sostenible|sustentable|verde|limpia|renovable|carbono|solar|viento|agua|green|clean/.test(lower);
    if (isESG && !analysisData) {
      const esg = {
        conservative: '🌱 Perfil Conservador:\n• ESGV — diversificado y estable\n• ESGU — grandes empresas sostenibles\n• CRBN — baja huella de carbono\n\nPide "analiza ESGV" para señales.',
        moderate: '🌱 Perfil Moderado:\n• ESGU — núcleo sostenible USA\n• ICLN — energía limpia\n• PHO — sector agua\n\nPide "analiza ICLN" para señales.',
        aggressive: '🌱 Perfil Agresivo:\n• ICLN — alto potencial\n• TAN — energía solar\n• FAN — energía eólica\n\nPide "analiza TAN" para señales.',
      };
      const response = esg[riskLevel] || esg.moderate;
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ response, model: 'netlify', marketData: quotes, analysis: null, news: [] }) };
    }

    // Macro
    const isMacro = /mercado|hoy|situacion|mundial|macro|dolar|petroleo|fed|banxico|inflaci/.test(lower);
    if (isMacro && !analysisData) {
      const macro = await getMacroData();
      const mq = macro.quotes;
      const cb = macro.centralBanks;
      const fq = (q, pre) => q && q.price ? (pre || '') + q.price.toFixed(2) + ' (' + (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '% hoy)' : 'N/D';
      const trend = (q) => q && q.changePct >= 0 ? '📈' : '📉';
      const lines = [
        '🌍 Situación del mercado global — datos en tiempo real:', '',
        '💵 Dólar (DXY): ' + fq(mq.dxy),
        '🛢️ Petróleo WTI: ' + fq(mq.wti, '$'),
        '🇺🇸 Bono USA 10Y: ' + (mq.usBond && mq.usBond.price ? mq.usBond.price.toFixed(3) + '% yield ' + trend(mq.usBond) : 'N/D'),
        '🇲🇽 USD/MXN: ' + fq(mq.mxnusd),
        '🥇 Oro: ' + fq(mq.gold, '$'),
        '📊 Bolsa México (IPC): ' + (mq.bmv && mq.bmv.price ? mq.bmv.price.toFixed(0) + ' pts ' + trend(mq.bmv) : 'N/D'),
        '🏦 Tasa Fed: ' + cb.fed.rate + '%',
        '🏛️ Tasa Banxico: ' + cb.banxico.rate + '%', '',
        '📈 S&P 500 (SPY): ' + fmt(priceMap['SPY']),
        '📈 Nasdaq (QQQ): ' + fmt(priceMap['QQQ']),
        '₿ Bitcoin: ' + fmt(priceMap['BTC-USD']), '',
        'Pide "analiza BTC" o cualquier activo para señales técnicas.',
      ];
      const response = lines.join('\n');
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ response, model: 'netlify', marketData: quotes, analysis: null, news: [], showMacro: true }) };
    }

    // Analysis
    if (analysisData) {
      const response = buildAnalysisText(analysisData, riskLevel, priceMap);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ response, model: 'netlify', marketData: quotes, analysis: analysisData, news: newsData }) };
    }

    // Default
    const defaults = {
      conservative: 'Perfil Conservador: SPY ' + fmt(priceMap['SPY']) + ', BND ' + fmt(priceMap['BND']) + '. Pide "analiza SPY" para señales.',
      moderate: 'Perfil Moderado: SPY ' + fmt(priceMap['SPY']) + ', QQQ ' + fmt(priceMap['QQQ']) + '. Pide "analiza QQQ" para señales.',
      aggressive: 'Perfil Agresivo: QQQ ' + fmt(priceMap['QQQ']) + ', BTC ' + fmt(priceMap['BTC-USD']) + ', NVDA ' + fmt(priceMap['NVDA']) + '. Pide "analiza NVDA".',
    };
    const response = defaults[riskLevel] || 'Puedo analizar cualquier activo. Prueba: "analiza BTC" o "como esta el mercado"';
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ response, model: 'netlify', marketData: quotes, analysis: null, news: [] }) };

  } catch (err) {
    console.error('Chat error:', err);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};
