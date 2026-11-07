import Link from 'next/link';
import { Poppins } from 'next/font/google';

// Landing pública de marketing — la ve cualquiera que entre al dominio sin
// estar logueado (el middleware deja pasar "/" sin pedir sesión, ver
// lib/supabase/middleware.ts). Si ya está logueado, el middleware lo manda
// derecho a /inicio en vez de mostrarle esto de nuevo.
//
// El selector de herramientas para gente ya logueada vive en /inicio.
//
// Rediseño con la identidad real de Chelaburo (logo, paleta cian/azul/violeta
// con acento dorado, tipografía Poppins). Los estilos viven en globals.css
// bajo clases "cl-" y variables de color scoped a .cl-landing, para no tocar
// nada de las pantallas internas del producto (que siguen con .bg-app).
export const metadata = {
  title: 'Chelaburo — Herramientas gratis con IA para buscar trabajo',
  description:
    'Practicá entrevistas, optimizá tu CV y tu LinkedIn, armá tu plan de carrera y preparate para negociar tu oferta. 5 herramientas con IA, 100% gratis con tu propia API Key de Gemini.',
};

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

export default function LandingPage() {
  return (
    <div className={`${poppins.className} cl-landing`}>
      <div className="cl-bg" />
      <div className="cl-blob cl-blob-1" />
      <div className="cl-blob cl-blob-2" />
      <div className="cl-blob cl-blob-medio" />

      <div className="cl-wrap" id="inicio">
        <header className="cl-header">
          <div className="cl-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chelaburo-logo.png" alt="Chelaburo" />
          </div>
          <nav className="cl-navlinks">
            <a href="#inicio" className="cl-activo">Inicio</a>
            <a href="#herramientas">Herramientas</a>
            <a href="#institucional">Nosotros</a>
          </nav>
          <div className="cl-navcta">
            <Link href="/login" className="cl-btn-ghost">Ingresar</Link>
            <Link href="/login" className="cl-btn-solido">Empezá gratis</Link>
          </div>
        </header>

        <section className="cl-hero">
          <div>
            <div className="cl-eyebrow">✨ Herramientas gratis con IA</div>
            <h1 className="cl-h1">
              Tu próximo <span className="cl-resalte">trabajo está más cerca</span>
            </h1>
            <p className="cl-sub">
              Potenciá tu búsqueda con 5 herramientas de IA: armá un CV ganador, mejorá tu LinkedIn,
              practicá entrevistas, planificá tu salida laboral y preparate para negociar tu oferta.
            </p>
            <Link href="/login" className="cl-cta">Empezá gratis →</Link>
            <div className="cl-confianza">
              <span><span className="cl-punto" />100% gratis, <b>para siempre</b></span>
              <span><span className="cl-punto" />Usás <b>tu propia API Key</b> de Gemini</span>
              <span><span className="cl-punto" />Nunca <b>guardamos tu clave</b></span>
            </div>
          </div>

          <div className="cl-hero-visual">
            <div className="cl-halo" />
            <div className="cl-telefono">
              <div className="cl-pantalla">
                <div className="cl-pantalla-header">
                  <div className="cl-eyebrow-app">🎙️ Simulador de entrevista</div>
                  <div className="cl-tit-app">Entrevista para Analista de RRHH</div>
                  <div className="cl-progreso">
                    <span className="cl-on" />
                    <span className="cl-on" />
                    <span className="cl-on" />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="cl-pantalla-body">
                  <div className="cl-burbuja">
                    Contame sobre una vez que tuviste que resolver un conflicto entre dos compañeros de
                    equipo.
                  </div>
                  <div className="cl-burbuja-yo">
                    En mi anterior trabajo, dos personas del equipo no se ponían de acuerdo sobre...
                  </div>
                  <div className="cl-burbuja">Buena respuesta. Ahora contame: ¿qué resultado tuvo esa decisión?</div>
                </div>
                <div className="cl-pantalla-footer">
                  <div className="cl-mic-pill">
                    <span className="cl-dot-rec" /> Grabando tu respuesta...
                  </div>
                </div>
              </div>
            </div>
            <div className="cl-tab-chip cl-tab-1 cl-activo">🎙️ Entrevistas</div>
            <div className="cl-tab-chip cl-tab-2">📄 Armado de CV</div>
            <div className="cl-tab-chip cl-tab-3">💼 LinkedIn</div>
            <div className="cl-tab-chip cl-tab-4">🧭 Plan de carrera</div>
            <div className="cl-tab-chip cl-tab-5">💬 Negociación</div>
          </div>
        </section>

        <div className="cl-seccion-tit" id="herramientas" style={{ marginTop: 70 }}>
          <span className="cl-pill-chica">Nuestras herramientas</span>
          <h2>Todo lo que necesitás para avanzar</h2>
          <p>5 herramientas con IA pensadas para cada etapa de tu búsqueda laboral — gratis, con tu propia API Key.</p>
        </div>
        <div className="cl-grid-tools">
          {HERRAMIENTAS_FILA_1.map((h) => (
            <TarjetaHerramienta key={h.href} {...h} />
          ))}
        </div>
        <div className="cl-grid-tools cl-fila2">
          {HERRAMIENTAS_FILA_2.map((h) => (
            <TarjetaHerramienta key={h.href} {...h} />
          ))}
        </div>

        <div className="cl-institucional" id="institucional">
          <div className="cl-izq">
            <span className="cl-pill-chica">Quién está detrás</span>
            <h2>Creado por una consultora de RRHH, no por una startup de software</h2>
            <p>
              Chelaburo nace de la experiencia real ayudando a personas a conseguir trabajo — por eso cada
              herramienta está pensada desde lo que de verdad hace falta en un proceso de selección, no
              desde una idea genérica de producto.
            </p>
            <div className="cl-firma">
              <div className="cl-av">A</div>
              <div>
                <p className="cl-nombre">Alexis Sarmiento</p>
                <p>Consultora de RRHH · Freelo HR</p>
              </div>
            </div>
          </div>
          <div className="cl-der">
            <span className="cl-pill-chica" style={{ background: '#fef3c7', color: '#92400e' }}>
              Cómo funciona
            </span>
            <div className="cl-pasos">
              <div className="cl-paso">
                <div className="cl-num">1</div>
                <div className="cl-tit">Conseguís tu API Key</div>
                <div className="cl-txt">Te mostramos cómo sacar una API Key gratuita de Gemini en 2 minutos.</div>
              </div>
              <div className="cl-paso">
                <div className="cl-num">2</div>
                <div className="cl-tit">La pegás acá</div>
                <div className="cl-txt">Se usa solo en tu sesión para hablar con la IA. Nunca la guardamos.</div>
              </div>
              <div className="cl-paso">
                <div className="cl-num">3</div>
                <div className="cl-tit">Usás las 5 herramientas</div>
                <div className="cl-txt">Sin límites, sin suscripción, sin tarjeta de crédito.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="cl-cta-final">
          <div>
            <h3>Tu próxima oportunidad empieza hoy</h3>
            <p>Creá tu cuenta gratis y empezá a usar las 5 herramientas de Chelaburo.</p>
          </div>
          <Link href="/login">Empezá gratis →</Link>
        </div>

        <footer className="cl-footer">
          <div className="cl-footer-grid">
            <div className="cl-marca">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/chelaburo-logo.png" alt="Chelaburo" />
              <p>Herramientas gratis con IA para potenciar tu búsqueda laboral.</p>
            </div>
            <div className="cl-footer-col">
              <h4>Producto</h4>
              <Link href="/cv">Armado de CV</Link>
              <Link href="/linkedin">LinkedIn</Link>
              <Link href="/simulador">Simulador de entrevistas</Link>
              <Link href="/guia-carrera">Guía de carrera</Link>
              <Link href="/negociacion">Negociación salarial</Link>
            </div>
            <div className="cl-footer-col">
              <h4>Empresa</h4>
              <Link href="/nosotros">Nosotros</Link>
              <a href="#institucional">Cómo funciona</a>
              <a href="mailto:alexis.sarmiento94@gmail.com">Contacto</a>
            </div>
            <div className="cl-footer-col">
              <h4>Legal</h4>
              {/* TODO: wire these once las páginas de Privacidad / Términos de uso
                  estén publicadas (quedó pendiente a propósito, ver conversación). */}
              <a href="#">Privacidad</a>
              <a href="#">Términos de uso</a>
            </div>
          </div>
          <div className="cl-footer-bottom">
            <span>© {new Date().getFullYear()} Chelaburo. Todos los derechos reservados.</span>
            <span>Powered by Freelo HR</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
