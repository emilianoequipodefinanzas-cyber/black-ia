import { getMacroData, CORS_HEADERS } from './lib.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  const data = await getMacroData();
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
};
