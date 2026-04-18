import { getNews, CORS_HEADERS } from './lib.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const symbol = event.path.split('/').pop().toUpperCase();
  const news = await getNews(symbol);
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ news }) };
};
