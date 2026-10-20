import Link from 'next/link';

// Landing pública de marketing — la ve cualquiera que entre al dominio sin
// estar logueado (el middleware deja pasar "/" sin pedir sesión, ver
// lib/supabase/middleware.ts). Si ya está logueado, el middleware lo manda
// derecho a /inicio en vez de mostrarle esto de nuevo.
//
// El selector de herramientas para gente ya logueada vive en /inicio.
export const metadata = {
  title: 'Asistente de Empleabilidad — Herramientas gratis con IA para buscar trabajo',
  description:
    'Practicá entrevistas, optimizá tu CV y tu LinkedIn, armá tu plan de carrera y preparate para negociar tu oferta. 5 herramientas con IA, 100% gratis con tu propia API Key de Gemini.',
};

const HERRAMIENTAS = [
  {
    href: '/guia-carrera',
    emoji: '🧭',
    titulo: 'Guía de Salida Laboral',
    texto: 'Explorá áreas y roles, y armá tu plan de carrera con IA para entrar al que te interesa.',
  },
  {
    href: '/cv',
    emoji: '📄',
    titulo: 'Optimizá tu CV para cada búsqueda',
    texto: 'Comparación contra el puesto: chequeo ATS y logros reescritos, listos para pegar.',
  },
  {
    href: '/linkedin',
    emoji: '💼',
    titulo: 'Mejorá tu perfil de LinkedIn',
    texto: 'Optimizá tu perfil para que los reclutadores te encuentren primero.',
  },
];

const HERRAMIENTAS_FILA_2 = [
  {
    href: '/simulador',
    emoji: '🎙️',
    titulo: 'Practicá tu entrevista',
    texto: 'Simulá una entrevista real y recibí feedback con IA.',
  },
  {
    href: '/negociacion',
    emoji: '💬',
    titulo: 'Negociá tu oferta',
    texto: 'Plan concreto para negociar sueldo y condiciones.',
  },
];

function TarjetaHerramienta({ href, emoji, titulo, texto }: { href: string; emoji: string; titulo: string; texto: string }) {
  return (
    <Link
      href={href}
      className="text-left p-6 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
    >
      <p className="text-3xl">{emoji}</p>
      <p className="font-semibold text-slate-800 mt-2">{titulo}</p>
      <p className="text-xs text-slate-500 mt-1">{texto}</p>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-landing text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🚀 Asistente de Empleabilidad
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              Iniciar sesión
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <div className="text-center pt-6 pb-2 animate-fade-in-up">
          <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
            Herramientas gratis con IA
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
            Preparate mejor para tu próxima búsqueda laboral
          </h2>
          <p className="text-slate-300 text-base mt-4 max-w-xl mx-auto">
            Practicá entrevistas, optimizá tu CV y tu LinkedIn, armá tu plan de carrera y preparate
            para negociar tu oferta — con feedback de IA, paso a paso.
          </p>
          <p className="text-slate-400 text-sm mt-3 max-w-xl mx-auto">
            Gratis para siempre: usás tu propia API Key de Gemini, la que te conecta con el modelo de IA —
            nunca la guardamos.
          </p>
          <Link
            href="/login"
            className="inline-block mt-7 px-8 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 font-semibold shadow-lg shadow-purple-950/40 transition-all hover:-translate-y-0.5"
          >
            Empezá gratis
          </Link>
        </div>

        {/* Las 5 herramientas, mismo layout "pirámide invertida" que el selector interno */}
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {HERRAMIENTAS.map((h) => (
              <TarjetaHerramienta key={h.href} href={h.href} emoji={h.emoji} titulo={h.titulo} texto={h.texto} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:max-w-[67%] sm:mx-auto">
            {HERRAMIENTAS_FILA_2.map((h) => (
              <TarjetaHerramienta key={h.href} href={h.href} emoji={h.emoji} titulo={h.titulo} texto={h.texto} />
            ))}
          </div>
        </div>

        <footer className="text-center pb-6">
          <Link
            href="/nosotros"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-0.5 transition-all text-xs text-slate-400"
          >
            Powered by{' '}
            <span className="font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              FreeloHR
            </span>
          </Link>
        </footer>
      </div>
    </div>
  );
}
