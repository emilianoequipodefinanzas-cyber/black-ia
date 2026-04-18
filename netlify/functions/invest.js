import { getMultipleQuotes, PORTFOLIOS, CORS_HEADERS } from './lib.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const { riskLevel, capital } = JSON.parse(event.body || '{}');
  const cap = parseFloat(capital) || 1000;
  const profile = PORTFOLIOS[riskLevel] || PORTFOLIOS.moderate;
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
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ assets, capital: cap, riskLevel }) };
};
