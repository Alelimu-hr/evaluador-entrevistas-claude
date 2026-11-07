'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Poppins } from 'next/font/google';
import { createClient } from '@/lib/supabase/client';
import { BuscadorHerramienta } from '@/components/BuscadorHerramienta';

// Selector de herramientas para gente YA logueada — antes vivía en "/", pero
// esa ruta ahora es la landing pública de marketing (ver app/page.tsx), así
// que esto se mudó acá. El middleware redirige automáticamente a esta ruta
// a cualquiera que esté logueado y entre a "/" o a "/login".
//
// Mismo tratamiento visual que la landing pública y /login (fondo claro,
// blobs de marca, Poppins, tarjetas ".cl-tool-*"), para que no se sienta un
// salto al formato viejo apenas te logueás.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const HERRAMIENTAS_FILA_1 = [
  {
    href: '/cv',
    emoji: '📄',
    titulo: 'Armado y optimización de CV',
    texto: 'Armá tu currículum de cero o potenciá el que ya tenés.',
    clase: 'cl-tool-cv',
    ir: 'Probar ahora →',
  },
  {
    href: '/linkedin',
    emoji: '💼',
    titulo: 'LinkedIn y marca personal',
    texto: 'Mejorá tu perfil y desarrollá tu marca personal.',
    clase: 'cl-tool-li',
    ir: 'Optimizar →',
  },
  {
    href: '/simulador',
    emoji: '🎙️',
    titulo: 'Practicá tu entrevista',
    texto: 'Simulá una entrevista real y recibí feedback con IA.',
    clase: 'cl-tool-ent',
    ir: 'Practicar →',
  },
];

const HERRAMIENTAS_FILA_2 = [
  {
    href: '/guia-carrera',
    emoji: '🧭',
    titulo: 'Guía de Salida Laboral',
    texto: 'Explorá áreas y roles, y armá tu plan de carrera.',
    clase: 'cl-tool-car',
    ir: 'Explorar →',
  },
  {
    href: '/negociacion',
    emoji: '💬',
    titulo: 'Negociá tu oferta',
    texto: 'Plan concreto para negociar sueldo y condiciones.',
    clase: 'cl-tool-neg',
    ir: 'Preparar →',
  },
];

function TarjetaHerramienta({
  href,
  emoji,
  titulo,
  texto,
  clase,
  ir,
}: {
  href: string;
  emoji: string;
  titulo: string;
  texto: string;
  clase: string;
  ir: string;
}) {
  return (
    <Link href={href} className={`cl-tool-card ${clase}`}>
      <span className="cl-emoji">{emoji}</span>
      <div className="cl-titulo">{titulo}</div>
      <div className="cl-texto">{texto}</div>
      <div className="cl-ir">{ir}</div>
    </Link>
  );
}

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
    <div className={`${poppins.className} cl-landing`}>
      <div className="cl-bg" />
      <div className="cl-blob cl-blob-1" />
      <div className="cl-blob cl-blob-2" />

      <div className="cl-wrap" style={{ paddingBottom: 60 }}>
        <header className="cl-header">
          <div className="cl-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chelaburo-logo.png" alt="Chelaburo" />
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/progreso" className="font-semibold text-[#0B205F] opacity-75 hover:opacity-100 transition-opacity">
              📈 Mi Progreso
            </Link>
            <Link href="/nosotros" className="font-semibold text-[#0B205F] opacity-75 hover:opacity-100 transition-opacity">
              🙋 Nosotros
            </Link>
            {userEmail && <span className="text-[#64748b] text-xs hidden sm:inline">{userEmail}</span>}
            <button
              onClick={handleCerrarSesion}
              className="cl-btn-ghost"
            >
              Salir
            </button>
          </nav>
        </header>

        <div className="cl-seccion-tit" style={{ marginTop: 50, maxWidth: 640 }}>
          <span className="cl-pill-chica">Herramientas gratis con IA</span>
          <h2>¿Con qué querés avanzar hoy?</h2>
          <p>Elegí una herramienta para empezar. Son gratis: usás tu propia API Key de Gemini.</p>
        </div>

        {/* El "buscador": para quien no tiene idea de cuál de las 5 usar.
            Colapsado por default (ver BuscadorHerramienta) — no le resta
            lugar a la elección directa de abajo para quien ya sabe qué
            quiere. */}
        <div style={{ marginTop: 28, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          <BuscadorHerramienta />
        </div>

        {/* Las 5 herramientas — ninguna pre-seleccionada, esta es la elección real. */}
        <div className="cl-grid-tools" style={{ marginTop: 36 }}>
          {HERRAMIENTAS_FILA_1.map((h) => (
            <TarjetaHerramienta key={h.href} {...h} />
          ))}
        </div>
        <div className="cl-grid-tools cl-fila2">
          {HERRAMIENTAS_FILA_2.map((h) => (
            <TarjetaHerramienta key={h.href} {...h} />
          ))}
        </div>
      </div>
    </div>
  );
}
