'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Página de inicio real una vez logueado — antes esta ruta ERA directamente
// el simulador de entrevistas (con su propio "Estás acá" en el selector), lo
// cual no tenía sentido ahora que son 4 herramientas igual de importantes.
// El simulador se mudó entero a /simulador; acá solo queda el selector
// neutral, sin ninguna herramienta pre-elegida.
export default function InicioPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  const handleCerrarSesion = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🚀 Asistente de Empleabilidad
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/progreso" className="text-slate-400 hover:text-white transition-colors">
              📈 Mi Progreso
            </Link>
            {userEmail && <span className="text-slate-600 hidden sm:inline">{userEmail}</span>}
            <button
              onClick={handleCerrarSesion}
              className="text-slate-400 hover:text-red-400 transition-colors"
            >
              Salir
            </button>
          </nav>
        </header>

        <div className="text-center pt-6 pb-2 animate-fade-in-up">
          <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
            Herramientas gratis con IA
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
            ¿Con qué querés avanzar hoy?
          </h2>
          <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
            Elegí una herramienta para empezar. Todas son gratis y usan tu propia API Key de Gemini.
          </p>
        </div>

        {/* Los 4 cuadrantes — ninguno pre-seleccionado, esta es la elección real */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up">
          <Link
            href="/simulador"
            className="text-left p-6 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
          >
            <p className="text-3xl">🎙️</p>
            <p className="font-semibold text-slate-800 mt-2">Practicá tu entrevista</p>
            <p className="text-xs text-slate-500 mt-1">Simulá una entrevista real y recibí feedback con IA.</p>
          </Link>
          <Link
            href="/linkedin"
            className="text-left p-6 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
          >
            <p className="text-3xl">💼</p>
            <p className="font-semibold text-slate-800 mt-2">Mejorá tu perfil de LinkedIn</p>
            <p className="text-xs text-slate-500 mt-1">
              Optimizá tu perfil para que los reclutadores te encuentren primero.
            </p>
          </Link>
          <Link
            href="/cv"
            className="text-left p-6 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
          >
            <p className="text-3xl">📄</p>
            <p className="font-semibold text-slate-800 mt-2">Optimizá tu CV</p>
            <p className="text-xs text-slate-500 mt-1">Chequeo ATS y reescritura de logros, lista para pegar.</p>
          </Link>
          <Link
            href="/guia-carrera"
            className="text-left p-6 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
          >
            <p className="text-3xl">🧭</p>
            <p className="font-semibold text-slate-800 mt-2">Guía de Salida Laboral</p>
            <p className="text-xs text-slate-500 mt-1">Explorá áreas y roles para saber hacia dónde apuntar.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
