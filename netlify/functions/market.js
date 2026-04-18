import { getMultipleQuotes, CORS_HEADERS } from './lib.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const symbols = (event.queryStringParameters?.symbols || 'SPY,QQQ,BTC-USD,ETH-USD,GLD,BND,AAPL,MSFT,NVDA,AMZN').split(',');
  const quotes = await getMultipleQuotes(symbols);
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ quotes, timestamp: new Date().toISOString() }) };
};
