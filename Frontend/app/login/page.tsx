'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/Spinner';

export default function LoginPage() {
  const router = useRouter();
  const [modo, setModo] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    setMensaje('');
    const supabase = createClient();

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMensaje('¡Cuenta creada! Ya podés iniciar sesión.');
        setModo('login');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error. Intentá de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-app text-white">
      <div className="relative overflow-hidden w-full max-w-sm bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-6 rounded-2xl shadow-xl shadow-purple-950/30 animate-fade-in-up">
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 bg-purple-200/40 rounded-full blur-3xl" />
        <div className="relative">
          <h1 className="font-display text-2xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
            🎙 Simulador de Entrevistas
          </h1>
          <p className="text-slate-600 text-sm mb-6">
            {modo === 'login' ? 'Iniciá sesión para practicar.' : 'Creá tu cuenta gratis en segundos.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vos@email.com"
                className="w-full bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300/40"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-300/40"
              />
            </div>

            {error && <p className="text-red-500 text-xs animate-fade-in">{error}</p>}
            {mensaje && <p className="text-emerald-600 text-xs animate-fade-in">{mensaje}</p>}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white font-semibold py-2.5 rounded-full transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {cargando && <Spinner />}
              {modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>

          <button
            onClick={() => {
              setModo(modo === 'login' ? 'signup' : 'login');
              setError('');
              setMensaje('');
            }}
            className="mt-4 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
          >
            {modo === 'login' ? '¿No tenés cuenta? Creá una gratis' : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
