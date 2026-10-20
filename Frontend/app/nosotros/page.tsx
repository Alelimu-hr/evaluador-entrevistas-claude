import Link from 'next/link';

// Página pública ("Nosotros") — habilitada en lib/supabase/middleware.ts junto
// con "/" para que la pueda ver cualquiera, esté o no logueado. Da contexto y
// confianza (quién está detrás de la herramienta) sin mezclar el pitch B2B de
// Freelo HR (consultora, le habla a empresas) con este producto B2C gratuito.
export const metadata = {
  title: 'Nosotros — Asistente de Empleabilidad',
  description:
    'Quién está detrás de esta herramienta gratis con IA para buscar trabajo: Alexis Sarmiento, Founder de Freelo HR.',
};

export default function NosotrosPage() {
  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <Link
            href="/"
            className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            🚀 Asistente de Empleabilidad
          </Link>
          <nav className="text-sm">
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-colors"
            >
              Iniciar sesión
            </Link>
          </nav>
        </header>

        <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] text-slate-800 rounded-2xl p-8 shadow-xl shadow-purple-950/30 animate-fade-in-up space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/alexis-avatar.jpg"
              alt="Alexis Sarmiento"
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
            />
            <div>
              <p className="font-semibold text-lg">Alexis Sarmiento</p>
              <p className="text-sm text-slate-500">Lic. en Relaciones del Trabajo · Founder de Freelo HR</p>
            </div>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-slate-700">
            <p>
              Armé esta herramienta como mi granito de arena para la comunidad. Me frustra bastante cómo
              se usa LinkedIn hoy: fotos sin sentido, mensajes armados con IA solo para juntar likes y
              contactos. Quise hacer algo distinto: útil de verdad, gratis, sin letra chica.
            </p>
            <p>
              Sé lo difícil que está el mercado laboral últimamente, en áreas Tech y Non-Tech por igual. Y
              sé lo frustrante que es fracasar en una entrevista — lo viví mil veces, y lo voy a seguir
              viviendo. Por eso arranqué armando un simulador de entrevistas conectado a IA, 100%
              gratuito, con feedback real sobre oratoria, gap técnico, tono y ritmo de respuesta — y
              respuestas modelo para que tengas con qué compararte. El prompt detrás me llevó mucho
              tiempo armarlo: metí ahí toda la materia técnica de RRHH que vengo trabajando hace más de
              una década.
            </p>
            <p>
              De ahí sumé el resto: optimizar tu CV y tu LinkedIn contra una búsqueda puntual, un plan de
              carrera con IA para quien quiere dar un salto a otro rol, y un simulador de negociación para
              cuando te llega una oferta. Todo con la misma idea: democratizar el acceso a herramientas
              que hoy usan las empresas para reclutar, para que vos también sepas cómo funcionan y le
              puedas sacar ventaja en tu próxima entrevista.
            </p>
            <p>Es un regalo a la comunidad, ojalá te sirva.</p>
            <p>
              Un par de cosas a tener en cuenta: la herramienta se conecta con modelos de Gemini 100%
              gratuitos (necesitás tu propia API Key, también gratis), así que a veces puede tardar un
              poco más o tirar algún error puntual — simplemente esperá un momento y volvé a intentar. Y
              te va a pedir crear un usuario, pero es solo para que la app guarde tus resultados — si
              preferís no usar tu mail real, podés inventar uno.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="font-semibold text-slate-800 mb-2">Contacto</p>
            <p className="text-sm text-slate-600">
              ¿Preguntas, sugerencias, o algo que no te funcionó bien? Escribime:
            </p>
            <div className="flex flex-col gap-1 mt-2 text-sm">
              <a href="mailto:alexis.sarmiento94@gmail.com" className="text-purple-600 hover:underline">
                📧 alexis.sarmiento94@gmail.com
              </a>
              <a
                href="https://www.linkedin.com/in/alexis-sarmiento-0b69379b/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
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
