import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, TrendingUp, PieChart, DollarSign, Cpu, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RiskLevel, Message } from '@/types';
import { cn } from '@/lib/utils';
import { sendChat } from '@/lib/api';
import { TechnicalCard } from '@/components/TechnicalCard';
import { NewsCard } from '@/components/NewsCard';
import { MacroCard } from '@/components/MacroCard';

interface ChatInterfaceProps {
  selectedRisk: RiskLevel | null;
}

const quickQuestions = [
  '¿Cómo está el mercado?',
  'Analiza BTC',
  'Señal de entrada SPY',
  'Analiza NVDA',
  'Analiza QQQ',
  'Analiza AAPL',
  'Señal de entrada ETH',
  'ETFs ESG sostenibles',
  'Analiza ICLN',
];

const WELCOME: Message = {
  id: 'welcome',
  content: '¡Hola! Soy BLACK.IA, tu asesor de inversiones con IA real y datos de mercado en tiempo real. Puedo decirte precios actuales de acciones, ETFs y cripto. Selecciona tu perfil de riesgo y pregúntame lo que quieras.',
  isUser: false,
  timestamp: new Date(),
};

export function ChatInterface({ selectedRisk }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiModel, setAiModel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearChat = () => {
    setMessages([{ ...WELCOME, timestamp: new Date() }]);
    setAiModel('');
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const recentHistory = messages.slice(-8).map(m => ({ content: m.content, isUser: m.isUser }));
      const result = await sendChat(inputValue, selectedRisk, recentHistory);
      setAiModel(result.model);
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: result.response,
        isUser: false,
        timestamp: new Date(),
        analysis: result.analysis || null,
        news: result.news?.length ? result.news : undefined,
        showMacro: /mercado|hoy|situaci[oó]n|mundial|macro|dólar|dolar|petróleo|petroleo|fed|banxico|inflaci[oó]n|bonos/i.test(inputValue) && !result.analysis,
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'No puedo conectar con el servidor. Asegúrate de que el servidor backend esté corriendo en el puerto 3001.',
        isUser: false,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    // flex-1 + min-h-0 permite que el chat ocupe todo el espacio disponible del drawer
    <div className="flex flex-col flex-1 min-h-0 px-4 pb-4">

      {/* Toolbar: modelo IA + borrar */}
      <div className="flex items-center justify-end gap-2 mb-3">
        {aiModel && (
          <div className="flex items-center gap-1 px-2 py-1 bg-violet-50 rounded-full border border-violet-100">
            <Cpu className="w-3 h-3 text-violet-500" />
            <span className="text-[10px] text-violet-600 font-medium">
              {aiModel === 'built-in' ? 'Smart AI' : aiModel}
            </span>
          </div>
        )}
        {messages.length > 1 && (
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-200 bg-red-50 hover:bg-red-100 transition-colors group"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 group-hover:text-red-600 transition-colors" />
            <span className="text-xs text-red-400 group-hover:text-red-600 font-medium transition-colors">Borrar</span>
          </button>
        )}
      </div>

      {/* Chat box — flex-1 + min-h-0 para que se estire y no desborde */}
      <div className="flex flex-col flex-1 min-h-0 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">

        {/* Messages — ocupa todo el espacio sobrante */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex gap-3', message.isUser ? 'flex-row-reverse' : 'flex-row')}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
                message.isUser
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-br from-violet-500 to-purple-600'
              )}>
                {message.isUser
                  ? <User className="w-4 h-4 text-white" />
                  : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={cn(
                'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line',
                message.isUser
                  ? 'max-w-[75%] bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-md'
                  : message.analysis
                  ? 'flex-1 min-w-0 bg-gray-50 text-gray-700 rounded-bl-md'
                  : 'max-w-[80%] bg-gray-100 text-gray-700 rounded-bl-md'
              )}>
                {message.content}
                {!message.isUser && message.analysis && (
                  <TechnicalCard analysis={message.analysis} />
                )}
                {!message.isUser && message.news && (
                  <NewsCard news={message.news} symbol={message.analysis?.symbol || ''} />
                )}
                {!message.isUser && message.showMacro && (
                  <MacroCard />
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Questions */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setInputValue(question)}
                className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Pregunta sobre precios, portafolios, estrategias..."
              className="min-h-[72px] pr-14 resize-none rounded-2xl border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 text-sm"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 p-0 flex items-center justify-center disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Portfolio Preview Cards */}
      {selectedRisk && (
        <div className="mt-4 grid grid-cols-3 gap-3 flex-shrink-0">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
            <TrendingUp className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-xs text-gray-500">Rendimiento anual</p>
            <p className="text-lg font-bold text-emerald-600">
              {selectedRisk === 'conservative' ? '4-6%' : selectedRisk === 'moderate' ? '7-10%' : '12-18%'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
            <PieChart className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-xs text-gray-500">Diversificación</p>
            <p className="text-lg font-bold text-blue-600">
              {selectedRisk === 'conservative' ? '5-8' : selectedRisk === 'moderate' ? '8-12' : '12-20'}
            </p>
          </div>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border border-violet-100">
            <DollarSign className="w-5 h-5 text-violet-500 mb-2" />
            <p className="text-xs text-gray-500">Inversión mín.</p>
            <p className="text-lg font-bold text-violet-600">$100</p>
          </div>
        </div>
      )}
    </div>
  );
}
