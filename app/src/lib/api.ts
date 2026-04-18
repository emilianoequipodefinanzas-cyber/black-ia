// BLACK.IA - API client
// Always uses the Python server via Vite proxy (/api -> localhost:3001)

const SERVER = '/api';

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
  const res = await fetch(`${SERVER}/market${q}`);
  const data = await res.json();
  return data.quotes as Quote[];
}

export async function sendChat(
  message: string,
  riskLevel: string | null,
  history: { content: string; isUser: boolean }[]
): Promise<ChatResponse> {
  const res = await fetch(`${SERVER}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, riskLevel, history }),
  });
  return res.json();
}

export async function buildPortfolio(riskLevel: string, capital: number) {
  const res = await fetch(`${SERVER}/invest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ riskLevel, capital }),
  });
  return res.json();
}

export async function getMacroDirect() {
  const res = await fetch(`${SERVER}/macro`);
  return res.json();
}

// Keep these exports for backward compatibility with hooks
export async function getMultipleQuotesDirect(symbols: string[]): Promise<Quote[]> {
  return fetchMarket(symbols);
}
