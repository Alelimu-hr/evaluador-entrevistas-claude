import Link from 'next/link';
import { Poppins } from 'next/font/google';

// Página pública ("Nosotros") — habilitada en lib/supabase/middleware.ts junto
// con "/" para que la pueda ver cualquiera, esté o no logueado. Da contexto y
// confianza (quién está detrás de la herramienta) sin mezclar el pitch B2B de
// Freelo HR (consultora, le habla a empresas) con este producto B2C gratuito.
//
// Mismo tratamiento visual que la landing pública (fondo claro, blobs de
// marca, logo real de Chelaburo en el header).
export const metadata = {
  title: 'Nosotros — Chelaburo',
  description:
    'Quién está detrás de esta herramienta gratis con IA para buscar trabajo: Alexis Sarmiento, Founder de Freelo HR.',
};

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export default function NosotrosPage() {
  return (
    <div className={`${poppins.className} cl-landing`}>
      <div className="cl-bg" />
      <div className="cl-blob cl-blob-1" />
      <div className="cl-blob cl-blob-2" />

      <div className="cl-wrap" style={{ maxWidth: 720, paddingBottom: 60 }}>
        <header className="cl-header">
          <Link href="/" className="cl-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chelaburo-logo.png" alt="Chelaburo" />
          </Link>
          <nav className="text-sm">
            <Link href="/login" className="cl-btn-ghost">
              Iniciar sesión
            </Link>
          </nav>
        </header>

        <div
          className="animate-fade-in-up"
          style={{
            marginTop: 40,
            background: '#fff',
            borderRadius: 28,
            padding: 40,
            boxShadow: '0 14px 34px rgba(11,32,95,0.08)',
            border: '1.5px solid rgba(11,32,95,0.1)',
          }}
        >
          <div className="flex flex-col items-center text-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/alexis-avatar.jpg"
              alt="Alexis Sarmiento"
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
            />
            <div>
              <p className="font-semibold text-lg text-[#0B205F]">Alexis Sarmiento</p>
              <p className="text-sm text-[#64748b]">Lic. en Relaciones del Trabajo · Founder de Freelo HR</p>
            </div>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-[#475569] mt-6">
            <p>
              Armé esta herramienta como mi granito de arena para la comunidad. Quise hacer algo distinto:
              útil de verdad, gratis, sin letra chica.
            </p>
            <p>
              Sé lo difícil que está el mercado laboral últimamente, en áreas Tech y Non-Tech por igual. Y
              sé lo frustrante que es fracasar en una entrevista, lo viví mil veces, y lo voy a seguir
              viviendo. Por eso arranqué armando un simulador de entrevistas conectado a IA, 100%
              gratuito, con feedback real sobre oratoria, gap técnico, tono y ritmo de respuesta, y
              respuestas modelo para que tengas con qué compararte. El prompt detrás me llevó mucho
              tiempo armarlo: metí ahí toda la materia técnica de RRHH que vengo trabajando hace más de
              una década.
            </p>
            <p>
              De ahí sumé el resto: optimizar tu CV y tu LinkedIn contra una búsqueda puntual, y un
              simulador de negociación para cuando te llega una oferta. También un plan de carrera con IA
              que te puede ayudar si no sabés bien para dónde apuntar o si querés dar un cambio de rumbo a
              tu rol profesional. Te da asesoramiento como un coach de empleabilidad, mostrándote
              opciones y herramientas para empezar con ese rol que tanto soñás. Todo con la misma idea:
              democratizar el acceso a herramientas que hoy usan las empresas para reclutar, para que vos
              también sepas cómo funcionan y le puedas sacar ventaja en tu próxima entrevista.
            </p>
            <p>Es un regalo a la comunidad, ojalá te sirva.</p>
            <p>
              Un par de cosas a tener en cuenta: la herramienta se conecta con modelos de Gemini 100%
              gratuitos (necesitás tu propia API Key, también gratis), así que a veces puede tardar un
              poco más o tirar algún error puntual. Simplemente esperá un momento y volvé a intentar. Y
              te va a pedir crear un usuario, pero es solo para que la app guarde tus resultados. Si
              preferís no usar tu mail real, podés inventar uno.
            </p>
          </div>

          <div className="pt-4 mt-6" style={{ borderTop: '1px solid rgba(11,32,95,0.1)' }}>
            <p className="font-semibold text-[#0B205F] mb-2">Contacto</p>
            <p className="text-sm text-[#475569]">
              ¿Preguntas, sugerencias, o algo que no te funcionó bien? Escribime:
            </p>
            <div className="flex flex-col gap-1 mt-2 text-sm">
              <a href="mailto:alexis.sarmiento94@gmail.com" className="text-[#0757E8] hover:underline">
                📧 alexis.sarmiento94@gmail.com
              </a>
              <a
                href="https://www.linkedin.com/in/alexis-sarmiento-0b69379b/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0757E8] hover:underline"
              >
                💼 LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
