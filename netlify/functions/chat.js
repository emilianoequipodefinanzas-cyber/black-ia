import { getMultipleQuotes, getFullAnalysis, getNews, getMacroData, detectSymbol, CORS_HEADERS } from './lib.js';

const RISK_MAP = {
  conservative: 'Conservador - preservacion de capital, bonos, renta fija',
  moderate: 'Moderado - equilibrio crecimiento/seguridad, 60/40',
  aggressive: 'Agresivo - maximo crecimiento, cripto, alta volatilidad',
};

const ESG_BY_RISK = {
  conservative: '🌱 Para perfil Conservador:\n• ESGV — diversificado y estable\n• ESGU — grandes empresas sostenibles\n• CRBN — baja huella de carbono\n\nPide "analiza ESGV" para señales de entrada.',
  moderate: '🌱 Para perfil Moderado:\n• ESGU — núcleo sostenible USA\n• ICLN — energía limpia con crecimiento\n• PHO — sector agua, defensivo\n\nPide "analiza ICLN" para señales técnicas.',
  aggressive: '🌱 Para perfil Agresivo:\n• ICLN — alto potencial de crecimiento\n• TAN — energía solar\n• FAN — energía eólica global\n\nPide "analiza TAN" para señales de entrada.',
};

function fmt(q) {
  return q ? `$${q.price?.toFixed(2)} (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}% hoy)` : 'N/D';
}

async function buildResponse(message, riskLevel, quotes, analysisData, newsData) {
  const lower = message.toLowerCase();
  const priceMap = Object.fromEntries(quotes.map(q => [q.symbol, q]));

  const isESG = /esg|sostenible|sustentable|verde|limpia|renovable|carbono|solar|viento|agua|green|clean/.test(lower);
  if (isESG && !analysisData) return ESG_BY_RISK[riskLevel] || ESG_BY_RISK.moderate;

  const isMacro = /mercado|hoy|situacion|mundial|macro|dolar|petroleo|fed|banxico|inflaci/.test(lower);
  if (isMacro && !analysisData) {
    const macro = await getMacroData();
    const mq = macro.quotes;
    const cb = macro.centralBanks;
    const trend = (q) => !q ? '' : q.changePct >= 0 ? '📈' : '📉';
    const fmtQ = (q, pre) => q?.price ? (pre || '') + q.price.toFixed(2) + ' (' + (q.changePct >= 0 ? '+' : '') + q.changePct.toFixed(2) + '% hoy)' : 'N/D';
    return [
      '🌍 Situación del mercado global — datos en tiempo real:',
      '',
      '💵 Dólar (DXY): ' + fmtQ(mq.dxy),
      '🛢️ Petróleo WTI: ' + fmtQ(mq.wti, '$'),
      '🇺🇸 Bono USA 10Y: ' + (mq.usBond?.price ? mq.usBond.price.toFixed(3) + '% yield ' + trend(mq.usBond) : 'N/D'),
      '🇲🇽 USD/MXN: ' + fmtQ(mq.mxnusd),
      '🥇 Oro: ' + fmtQ(mq.gold, '$'),
      '📊 Bolsa México (IPC): ' + (mq.bmv?.price ? mq.bmv.price.toFixed(0) + ' pts ' + trend(mq.bmv) : 'N/D'),
      '🏦 Tasa Fed: ' + cb.fed.rate + '%',
      '🏛️ Tasa Banxico: ' + cb.banxico.rate + '%',
      '',
      '📈 Mercados principales:',
      '• S&P 500 (SPY): ' + fmt(priceMap['SPY']),
      '• Nasdaq (QQQ): ' + fmt(priceMap['QQQ']),
      '• Bitcoin: ' + fmt(priceMap['BTC-USD']),
      '',
      '🔗 Impacto en activos hoy:',
      mq.dxy?.changePct > 0.3 ? '• Dólar fuerte → presión en emergentes' : mq.dxy?.changePct < -0.3 ? '• Dólar débil → impulso en emergentes' : '• Dólar estable hoy',
      mq.wti?.changePct > 1 ? '• Petróleo al alza → presión inflacionaria' : mq.wti?.changePct < -1 ? '• Petróleo a la baja → alivio inflacionario' : '• Petróleo estable hoy',
      mq.usBond?.price > 4.5 ? '• Yields altos → presión en tech y cripto' : '• Yields moderados → menor presión en renta variable',
      '',
      'Pide "analiza SPY", "analiza BTC" o cualquier activo para señales técnicas.',
    ].filter(Boolean).join('\n');
  }

  if (analysisData) {
    const a = analysisData;
    const emoji = a.overallSignal === 'COMPRAR' ? '🟢' : a.overallSignal === 'VENDER' ? '🔴' : a.overallSignal === 'ACUMULAR' ? '🔵' : '⚪';
    const q = priceMap[a.symbol];
    let r = `📊 Análisis técnico de ${a.symbol}\n`;
    r += `Precio: $${a.price?.toFixed(2)}${q ? ` (${q.changePct >= 0 ? '+' : ''}${q.changePct?.toFixed(2)}% hoy)` : ''}\n\n`;
    r += `📈 Medias Móviles:\n`;
    if (a.ma20)  r += `• MA20:  $${a.ma20.toFixed(2)}  ${a.price > a.ma20  ? '✅' : '❌'}\n`;
    if (a.ma50)  r += `• MA50:  $${a.ma50.toFixed(2)}  ${a.price > a.ma50  ? '✅' : '❌'}\n`;
    if (a.ma200) r += `• MA200: $${a.ma200.toFixed(2)} ${a.price > a.ma200 ? '✅' : '❌'}\n`;
    if (a.rsi)   r += `• RSI(14): ${a.rsi.toFixed(1)} ${a.rsi < 30 ? '⚡ Sobreventa' : a.rsi > 70 ? '⚠️ Sobrecompra' : '✅ Normal'}\n`;
    r += `\n${emoji} Señal: ${a.overallSignal}\n`;
    if (a.entryZone) r += `\n🎯 Entrada: $${a.entryZone.low.toFixed(2)} – $${a.entryZone.high.toFixed(2)}\n`;
    if (a.stopLoss)  r += `🛑 Stop Loss: $${a.stopLoss.toFixed(2)}\n`;
    if (a.target1)   r += `🏆 Target 1: $${a.target1.toFixed(2)}\n`;
    if (a.target2)   r += `🏆 Target 2: $${a.target2.toFixed(2)}\n`;
    if (a.support?.length)    r += `\n📉 Soporte: ${a.support.slice(0,2).map(s => '$'+s.toFixed(2)).join(' | ')}\n`;
    if (a.resistance?.length) r += `📈 Resistencia: ${a.resistance.slice(0,2).map(s => '$'+s.toFixed(2)).join(' | ')}\n`;
    const riskNote = riskLevel === 'conservative' ? '\n⚠️ Perfil conservador: usa stop loss ajustado.' : riskLevel === 'aggressive' ? '\n💪 Perfil agresivo: puedes aprovechar la señal.' : '\n📌 Perfil moderado: gestiona bien el riesgo.';
    r += riskNote;
    return r;
  }

  const defaults = {
    conservative: `Perfil Conservador: SPY ${fmt(priceMap['SPY'])}, BND ${fmt(priceMap['BND'])}. Pide "analiza SPY" para señales de entrada.`,
    moderate: `Perfil Moderado: SPY ${fmt(priceMap['SPY'])}, QQQ ${fmt(priceMap['QQQ'])}. Pide "analiza QQQ" para señales técnicas.`,
    aggressive: `Perfil Agresivo: QQQ ${fmt(priceMap['QQQ'])}, BTC ${fmt(priceMap['BTC-USD'])}, NVDA ${fmt(priceMap['NVDA'])}. Pide "analiza NVDA" para señales.`,
  };
  return defaults[riskLevel] || 'Puedo analizar cualquier activo con MA20/50/200, RSI y zonas de entrada. Prueba: "analiza BTC"';
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };

  const { message, riskLevel, history = [] } = JSON.parse(event.body || '{}');

  const marketSymbols = ['SPY', 'QQQ', 'BTC-USD', 'ETH-USD', 'GLD', 'BND', 'AAPL', 'MSFT', 'NVDA'];
  const quotes = await getMultipleQuotes(marketSymbols);

  const analysisSymbol = detectSymbol(message);
  let analysisData = null;
  let newsData = [];

  if (analysisSymbol) {
    [analysisData, newsData] = await Promise.all([
      getFullAnalysis(analysisSymbol),
      getNews(analysisSymbol),
    ]);
  }

  const response = await buildResponse(message, riskLevel, quotes, analysisData, newsData);

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ response, model: 'built-in', marketData: quotes, analysis: analysisData, news: newsData }),
  };
};
