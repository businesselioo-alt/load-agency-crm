'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const DEMO_ACCOUNTS = [
  { email: 'admin@loadagency.com',     password: 'admin123',   role: 'Admin',     name: 'Admin' },
  { email: 'sadie@loadagency.com',     password: 'sadie123',   role: 'Manager',   name: 'Sadie' },
  { email: 'kate@loadagency.com',      password: 'kate123',    role: 'Manager',   name: 'Kate' },
  { email: 'charlotte@loadagency.com', password: 'model123',   role: 'Model',     name: 'Charlotte' },
  { email: 'compta@loadagency.com',    password: 'compta123',  role: 'Comptable', name: 'Comptable' },
  { email: 'marketing@loadagency.com', password: 'mkt123',     role: 'Marketing', name: 'Marketing' },
  { email: 'chatter@loadagency.com',   password: 'chatter123', role: 'Chatter',   name: 'Chatter' },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    const ok = await login(email, password);
    if (ok) {
      router.replace('/dashboard');
    } else {
      setError('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      setIsSubmitting(false);
    }
  };

  const quickLogin = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left: branding + demo accounts */}
      <div className="hidden lg:flex flex-col justify-between w-96 flex-shrink-0 bg-[#0d0d0d] border-r border-[#1a1a1a] p-10">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C] flex items-center justify-center">
              <Zap size={20} className="text-black" />
            </div>
            <div>
              <p className="font-bold text-white text-lg">Load Agency</p>
              <p className="text-white/30 text-xs">CRM Platform</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Gérez vos talents<br />
            <span className="text-[#C9A84C]">efficacement</span>
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Plateforme de gestion complète pour agences de créatrices de contenu.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-4">
            Comptes de démonstration
          </p>
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              onClick={() => quickLogin(acc.email, acc.password)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white/5 hover:bg-white/[0.08] rounded-xl transition text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#C9A84C] text-xs font-bold uppercase">
                    {acc.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-white/70 text-xs font-medium">{acc.name}</p>
                  <p className="text-white/30 text-[10px]">{acc.email}</p>
                </div>
              </div>
              <span className="text-white/30 text-xs flex-shrink-0">{acc.role}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-[#C9A84C] flex items-center justify-center">
              <Zap size={18} className="text-black" />
            </div>
            <p className="font-bold text-white text-lg">Load Agency CRM</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Connexion</h2>
            <p className="text-white/40 text-sm">Accédez à votre espace de gestion</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@loadagency.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#C9A84C] text-black rounded-xl font-semibold text-sm hover:bg-[#E2C06A] disabled:opacity-60 disabled:cursor-not-allowed transition mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Mobile demo accounts */}
          <div className="mt-8 lg:hidden">
            <p className="text-white/30 text-xs font-medium uppercase tracking-wider mb-3 text-center">Comptes démo</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.slice(0, 4).map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => quickLogin(acc.email, acc.password)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/[0.08] rounded-xl transition text-left"
                >
                  <p className="text-white/70 text-xs font-medium">{acc.name}</p>
                  <p className="text-white/30 text-xs">{acc.role}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
