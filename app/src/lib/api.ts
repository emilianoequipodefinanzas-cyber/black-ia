// En producción (Netlify) usa /api, en desarrollo usa localhost:3001/api
const BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
}

export interface ChatResponse {
  response: string;
  model: string;
  marketData: Quote[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  news?: any[];
}

export async function fetchMarket(symbols?: string[]): Promise<Quote[]> {
  const q = symbols ? `?symbols=${symbols.join(',')}` : '';
  const res = await fetch(`${BASE}/market${q}`);
  const data = await res.json();
  return data.quotes as Quote[];
}

export async function sendChat(
  message: string,
  riskLevel: string | null,
  history: { content: string; isUser: boolean }[]
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, riskLevel, history }),
  });
  return res.json();
}

export async function buildPortfolio(riskLevel: string, capital: number) {
  const res = await fetch(`${BASE}/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ riskLevel, capital }),
  });
  return res.json();
}
