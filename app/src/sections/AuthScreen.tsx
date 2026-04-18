import { useState } from 'react';
import { TrendingUp, Eye, EyeOff, User, Mail, Lock, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onAuth: (user: { name: string; email: string }) => void;
}

export function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const set = (k: string, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!form.name.trim()) return setError('Ingresa tu nombre.');
      if (!form.email.includes('@')) return setError('Email inválido.');
      if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.');

      // Check if already exists
      const users = JSON.parse(localStorage.getItem('capitalIA_users') || '[]');
      if (users.find((u: { email: string }) => u.email === form.email)) {
        return setError('Este email ya está registrado.');
      }
      users.push({ name: form.name, email: form.email, password: form.password });
      localStorage.setItem('capitalIA_users', JSON.stringify(users));
      localStorage.setItem('capitalIA_session', JSON.stringify({ name: form.name, email: form.email }));
      onAuth({ name: form.name, email: form.email });

    } else {
      if (!form.email || !form.password) return setError('Completa todos los campos.');
      const users = JSON.parse(localStorage.getItem('capitalIA_users') || '[]');
      const user = users.find((u: { email: string; password: string }) => u.email === form.email && u.password === form.password);
      if (!user) return setError('Email o contraseña incorrectos.');
      localStorage.setItem('capitalIA_session', JSON.stringify({ name: user.name, email: user.email }));
      onAuth({ name: user.name, email: user.email });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-72 bg-gradient-to-b from-blue-100/60 to-transparent pointer-events-none" />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30 mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            BLACK<span className="text-blue-600">.IA</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">Inversiones inteligentes para todos</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 border border-gray-100 p-6">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
            >
              Registrarse
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name — only on register */}
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Correo electrónico"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]"
            >
              {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 BLACK.IA. Inversiones inteligentes para todos.
        </p>
        <p className="text-center text-xs text-gray-400 mt-1">
          Black Capital Advisors
        </p>
      </div>
    </div>
  );
}
