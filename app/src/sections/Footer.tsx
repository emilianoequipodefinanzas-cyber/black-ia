import { Play, Crown, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <div className="w-full px-4 py-6 mt-auto">
      {/* Promo Banner */}
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-3xl p-5 text-white mb-4 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Gift className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full">
                BONO DIARIO
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0 text-xs"
            >
              <Crown className="w-3 h-3 mr-1" />
              Hazte Pro
            </Button>
          </div>
          
          <h3 className="text-lg font-bold mb-1">
            ¡Reclama tus 10 tokens gratis ahora!
          </h3>
          <p className="text-xs text-white/80">
            5 of 5 rewards left today
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group">
          <Play className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600">
            Ver Tutorial
          </span>
        </button>
        
        <button className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 group">
          <Crown className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          <span className="text-sm font-semibold text-white">
            Portafolio Pro
          </span>
        </button>
      </div>

      {/* Copyright */}
      <p className="text-center text-xs text-gray-400 mt-6">
        © 2025 InverSmart. Inversiones inteligentes para todos.
      </p>
    </div>
  );
}
