export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  news?: any[];
  showMacro?: boolean;
}

export interface RiskOption {
  id: RiskLevel;
  name: string;
  description: string;
  color: string;
  gradient: string;
  icon: string;
}

export interface PortfolioSuggestion {
  assets: string[];
  allocation: Record<string, number>;
  expectedReturn: string;
  riskLevel: string;
  description: string;
}
