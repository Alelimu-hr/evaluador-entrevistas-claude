'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Poppins } from 'next/font/google';
import { createClient } from '@/lib/supabase/client';
import { Spinner } from '@/components/Spinner';

// Mismo tratamiento visual que la landing pública ("/"): fondo claro con los
// "blobs" de marca y tipografía Poppins (ver .cl-landing / .cl-bg / .cl-blob-*
// en globals.css). La lógica de login/signup con Supabase queda intacta,
// solo cambió el look para que no se sienta un salto al formato viejo
// después de venir de la landing nueva.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

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
    <div className={`${poppins.className} cl-landing flex items-center justify-center p-6`}>
      <div className="cl-bg" />
      <div className="cl-blob cl-blob-1" />
      <div className="cl-blob cl-blob-2" />

      <div className="relative z-[2] overflow-hidden w-full max-w-sm bg-white border border-[rgba(11,32,95,0.1)] p-7 rounded-[22px] shadow-xl shadow-[rgba(11,32,95,0.12)] animate-fade-in-up">
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 bg-gradient-to-br from-[#08B9ED]/25 to-[#A52BFF]/25 rounded-full blur-3xl" />
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/chelaburo-logo.png" alt="Chelaburo" className="h-9 w-auto mb-5" />

          <h1 className="text-xl font-bold text-[#0B205F] mb-1">
            {modo === 'login' ? 'Bienvenido de nuevo' : 'Creá tu cuenta gratis'}
          </h1>
          <p className="text-[#475569] text-sm mb-6">
            {modo === 'login' ? 'Iniciá sesión para seguir practicando.' : 'Empezá a usar las 5 herramientas en segundos.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vos@email.com"
                className="w-full bg-white border border-[rgba(11,32,95,0.14)] text-[#0B205F] placeholder:text-slate-400 px-3 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:border-[#08B9ED] focus:ring-2 focus:ring-[#08B9ED]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full bg-white border border-[rgba(11,32,95,0.14)] text-[#0B205F] placeholder:text-slate-400 px-3 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:border-[#08B9ED] focus:ring-2 focus:ring-[#08B9ED]/20"
              />
            </div>

            {error && <p className="text-red-500 text-xs animate-fade-in">{error}</p>}
            {mensaje && <p className="text-emerald-600 text-xs animate-fade-in">{mensaje}</p>}

            <button
              type="submit"
              disabled={cargando}
              className="cl-btn-solido w-full flex items-center justify-center gap-2 disabled:opacity-50"
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
            className="mt-4 text-xs text-[#475569] hover:text-[#0757E8] transition-colors"
          >
            {modo === 'login' ? '¿No tenés cuenta? Creá una gratis' : '¿Ya tenés cuenta? Iniciá sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}
