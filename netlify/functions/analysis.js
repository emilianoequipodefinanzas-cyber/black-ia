import { getFullAnalysis, CORS_HEADERS } from './lib.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const symbol = event.path.split('/').pop().toUpperCase();
  const analysis = await getFullAnalysis(symbol);
  if (!analysis) return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No se pudo analizar' }) };
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(analysis) };
};
