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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.20),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(37,99,235,0.12),transparent),#050811] text-white">
      <div className="w-full max-w-sm bg-[#0b1329] border border-slate-800 p-6 rounded-2xl shadow-xl shadow-black/30 animate-fade-in-up">
        <h1 className="font-display text-2xl font-semibold text-white mb-1 flex items-center gap-2">
          🎙 Simulador de Entrevistas
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          {modo === 'login' ? 'Iniciá sesión para practicar.' : 'Creá tu cuenta gratis en segundos.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="vos@email.com"
              className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
              className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {error && <p className="text-red-400 text-xs animate-fade-in">{error}</p>}
          {mensaje && <p className="text-emerald-400 text-xs animate-fade-in">{mensaje}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
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
          className="mt-4 text-xs text-slate-400 hover:text-blue-400 transition-colors"
        >
          {modo === 'login' ? '¿No tenés cuenta? Creá una gratis' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </div>
    </div>
  );
}
