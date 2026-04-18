import { Shield, Scale, Rocket } from 'lucide-react';
import type { RiskLevel } from '@/types';
import { cn } from '@/lib/utils';

interface RiskSelectorProps {
  selectedRisk: RiskLevel | null;
  onSelectRisk: (risk: RiskLevel) => void;
}

const riskOptions = [
  {
    id: 'conservative' as RiskLevel,
    name: 'Conservador',
    description: 'Protege tu capital con mínima volatilidad',
    icon: Shield,
    gradient: 'from-emerald-400 to-teal-500',
    bgGradient: 'from-emerald-50 to-teal-50',
    borderColor: 'border-emerald-200',
    shadowColor: 'shadow-emerald-500/20',
    textColor: 'text-emerald-600',
  },
  {
    id: 'moderate' as RiskLevel,
    name: 'Moderado',
    description: 'Balance entre crecimiento y seguridad',
    icon: Scale,
    gradient: 'from-blue-400 to-indigo-500',
    bgGradient: 'from-blue-50 to-indigo-50',
    borderColor: 'border-blue-200',
    shadowColor: 'shadow-blue-500/20',
    textColor: 'text-blue-600',
  },
  {
    id: 'aggressive' as RiskLevel,
    name: 'Agresivo',
    description: 'Máximo crecimiento con alta volatilidad',
    icon: Rocket,
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 to-purple-50',
    borderColor: 'border-violet-200',
    shadowColor: 'shadow-violet-500/20',
    textColor: 'text-violet-600',
  },
];

export function RiskSelector({ selectedRisk, onSelectRisk }: RiskSelectorProps) {
  return (
    <div className="w-full px-4 py-6">
      <div className="text-center mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Selecciona tu perfil de riesgo
        </h2>
        <p className="text-sm text-gray-500">
          Elige cómo quieres que trabaje tu dinero
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {riskOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedRisk === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelectRisk(option.id)}
              className={cn(
                'relative w-full p-4 rounded-2xl border-2 transition-all duration-300 ease-out',
                'flex items-center gap-4 text-left',
                'hover:scale-[1.02] hover:shadow-lg',
                isSelected
                  ? `${option.borderColor} ${option.shadowColor} shadow-lg scale-[1.02] bg-gradient-to-r ${option.bgGradient}`
                  : 'border-gray-100 bg-white hover:border-gray-200'
              )}
            >
              {/* Icon Container */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                  'bg-gradient-to-br',
                  option.gradient,
                  'shadow-lg',
                  isSelected ? 'scale-110' : 'scale-100',
                  'transition-transform duration-300'
                )}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3
                  className={cn(
                    'font-semibold text-base mb-0.5',
                    isSelected ? option.textColor : 'text-gray-800'
                  )}
                >
                  {option.name}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* Selection Indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  'transition-all duration-300',
                  isSelected
                    ? `border-transparent bg-gradient-to-r ${option.gradient}`
                    : 'border-gray-300'
                )}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
