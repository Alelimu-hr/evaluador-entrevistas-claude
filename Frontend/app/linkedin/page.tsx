'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { registrarEventoFunnel } from '@/lib/analytics';
import { Spinner } from '@/components/Spinner';
import { FeedbackInforme } from '@/components/FeedbackInforme';
import { PasosApiKey } from '@/components/PasosApiKey';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type EstadoKey = 'vacio' | 'verificando' | 'valida' | 'invalida';
type ModoAnalisis = 'dirigido' | 'objetivo';
type Vista = 'perfil' | 'contenido';

type Puntajes = {
  global: number;
  headline: number;
  acerca_de: number;
  experiencia: number;
  palabras_clave: number;
};

type IdeaPost = {
  titulo: string;
  angulo: string;
};

type Pilar = {
  nombre: string;
  descripcion: string;
  ideas: IdeaPost[];
  ejemplo_post?: string;
};

type ObjetivoLinkedin = '' | 'vender' | 'interacciones' | 'reclutadores';

function colorDeNota(nota: number) {
  if (nota >= 7) return { texto: 'text-emerald-600', anillo: 'ring-emerald-300', borde: 'border-emerald-200' };
  if (nota >= 4) return { texto: 'text-amber-600', anillo: 'ring-amber-300', borde: 'border-amber-200' };
  return { texto: 'text-red-600', anillo: 'ring-red-300', borde: 'border-red-200' };
}

// Contenido fijo (sin IA) sobre cómo funciona LinkedIn en la práctica — no
// hace falta gastar una llamada a Gemini para explicar esto, y así la
// pestaña de "Estrategia de contenido" da valor inmediato aunque la persona
// todavía no subió su perfil. Basado en cómo buscadores de empleo describen
// que funciona el algoritmo hoy (hora dorada, formato, cadencia).
const TIPS_LINKEDIN: { emoji: string; texto: string }[] = [
  {
    emoji: '⏱️',
    texto:
      'La primera hora después de publicar importa mucho: LinkedIn le muestra tu posteo a una porción chica de tu red primero, y si ahí genera comentarios y guardados, lo empieza a mostrar más ampliamente.',
  },
  {
    emoji: '🖼️',
    texto:
      'Los carruseles/documentos PDF suelen funcionar mejor que el texto plano, y el texto plano mejor que un link suelto — si podés, armá tu idea como un documento de pocas slides en vez de solo texto.',
  },
  {
    emoji: '💬',
    texto:
      'Un comentario largo y genuino en el posteo de otra persona (sobre todo alguien de una empresa que te interesa) suele valer más que 10 "me gusta" — es gratis y no necesita que publiques nada propio.',
  },
  {
    emoji: '📅',
    texto:
      'Mejor 2-3 posteos por semana de forma sostenida que uno genial y después silencio por un mes — la consistencia importa más que la perfección de cada posteo individual.',
  },
  {
    emoji: '🚫',
    texto:
      'Evitá los "pods" de engagement (grupos que se comentan entre sí de forma artificial) — hoy se detectan y penalizan el alcance en vez de ayudarlo.',
  },
];

// Reemplaza al toggle "dirigido/objetivo" del análisis de perfil en esta
// pestaña — ahí no tenía sentido ("¿qué tipo de análisis querés?" no es una
// pregunta real para una estrategia de contenido). Esto sí lo es: define
// para qué quiere usar LinkedIn esta persona, y el prompt del backend ajusta
// los pilares e ideas en función de la respuesta. "textoBackend" es la frase
// completa que se le manda a Gemini (más clara para el prompt que mandar
// solo la key).
const OBJETIVOS_LINKEDIN: {
  value: ObjetivoLinkedin;
  emoji: string;
  label: string;
  descripcion: string;
  textoBackend: string;
}[] = [
  {
    value: 'vender',
    emoji: '💰',
    label: 'Vender tu expertise',
    descripcion: 'Posicionarte como especialista para conseguir clientes, proyectos o consultoría.',
    textoBackend: 'Vender su expertise: posicionarse como especialista para conseguir clientes, proyectos o consultoría.',
  },
  {
    value: 'interacciones',
    emoji: '🔥',
    label: 'Generar más interacciones',
    descripcion: 'Crecer tu visibilidad y tu red en general — que te vea más gente.',
    textoBackend: 'Generar más interacciones y visibilidad en general: hacer crecer su red y su alcance.',
  },
  {
    value: 'reclutadores',
    emoji: '🎯',
    label: 'Que te encuentren reclutadores',
    descripcion: 'Que te tengan en el radar para procesos de selección concretos.',
    textoBackend:
      'Que la encuentren reclutadores, gente de Talent Acquisition y selectores/as de personal, para procesos de selección concretos.',
  },
];

// Aviso fijo (sin IA) que se muestra junto a los ejemplos de posteo — no
// hace falta que Gemini lo redacte cada vez, y así queda siempre igual y
// bien visible.
const AVISO_IA_LINKEDIN =
  '⚠️ Estos ejemplos son para inspirarte, no para pegarlos tal cual: LinkedIn detecta texto que suena 100% generado por IA y le baja el alcance. Usalos como punto de partida y reescribilos con tu propia voz antes de publicar.';

export default function LinkedinPage() {
  const [vista, setVista] = useState<Vista>('perfil');

  const [apiKey, setApiKey] = useState('');
  const [estadoKey, setEstadoKey] = useState<EstadoKey>('vacio');
  const [modo, setModo] = useState<ModoAnalisis>('dirigido');
  const [rolObjetivo, setRolObjetivo] = useState('');
  const [objetivoLibre, setObjetivoLibre] = useState('');
  const [idioma, setIdioma] = useState('Español');
  const [perfilFile, setPerfilFile] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const [puntajes, setPuntajes] = useState<Puntajes | null>(null);
  // El backend devuelve el informe ya partido en estos 6 campos de markdown
  // (uno por bloque de secciones), en vez de un solo bloque gigante — esto es
  // lo que evita el bug de andar buscando texto para cortar el markdown (ver
  // Backend/main.py). Las sugerencias (titular, acerca de, experiencia,
  // palabras clave) van adentro de este mismo texto, en prosa — la persona
  // las selecciona y copia directo de ahí, sin cajitas de copiar aparte.
  const [informeMarkdown, setInformeMarkdown] = useState(''); // versión completa, solo para el PDF
  const [introMarkdown, setIntroMarkdown] = useState('');
  const [titularMarkdown, setTitularMarkdown] = useState('');
  const [acercaDeMarkdown, setAcercaDeMarkdown] = useState('');
  const [experienciaMarkdown, setExperienciaMarkdown] = useState('');
  const [palabrasClaveMarkdown, setPalabrasClaveMarkdown] = useState('');
  const [cierreMarkdown, setCierreMarkdown] = useState('');

  // --- Pestaña "Estrategia de contenido" ---
  // Reutiliza el mismo PDF de perfil / rol objetivo / idioma de arriba (no
  // tiene sentido pedírselo de nuevo): solo cambia el endpoint y cómo se
  // muestra el resultado (pilares + ideas, no un informe de puntajes).
  // "objetivoLinkedin" es propio de esta pestaña (no existe en la de
  // análisis de perfil) — reemplaza al toggle "modo" que no tenía sentido
  // acá, ver OBJETIVOS_LINKEDIN arriba.
  const [objetivoLinkedin, setObjetivoLinkedin] = useState<ObjetivoLinkedin>('');
  const [cargandoContenido, setCargandoContenido] = useState(false);
  const [errorContenido, setErrorContenido] = useState('');
  const [introContenidoMarkdown, setIntroContenidoMarkdown] = useState('');
  const [cierreContenidoMarkdown, setCierreContenidoMarkdown] = useState('');
  const [pilares, setPilares] = useState<Pilar[]>([]);

  // Primer escalón del embudo: entró logueado a la pantalla. Una vez por
  // carga de página (si recarga o vuelve a entrar, cuenta de nuevo — se
  // dedupea con COUNT DISTINCT al analizar, ver lib/analytics.ts).
  useEffect(() => {
    registrarEventoFunnel('linkedin', 'formulario_visto');
  }, []);

  // Misma validación de API Key que el simulador de entrevistas: se chequea
  // contra el backend medio segundo después de dejar de tipear, sin gastar
  // cuota de generación de Gemini.
  useEffect(() => {
    if (!apiKey.trim()) {
      setEstadoKey('vacio');
      return;
    }
    setEstadoKey('verificando');
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/validar-key`, {
          headers: { 'x-gemini-api-key': apiKey.trim() },
        });
        const data = await res.json();
        const valido = !!data.valido;
        setEstadoKey(valido ? 'valida' : 'invalida');
        if (valido) {
          registrarEventoFunnel('linkedin', 'api_key_valida'); // 2do escalón
        } else {
          registrarEventoFunnel('linkedin', 'api_key_invalida'); // intentó, pero no pasó
        }
      } catch {
        setEstadoKey('invalida');
        registrarEventoFunnel('linkedin', 'api_key_invalida');
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  const reiniciarTodo = () => {
    setPerfilFile(null);
    setPuntajes(null);
    setInformeMarkdown('');
    setIntroMarkdown('');
    setTitularMarkdown('');
    setAcercaDeMarkdown('');
    setExperienciaMarkdown('');
    setPalabrasClaveMarkdown('');
    setCierreMarkdown('');
    setError('');
  };

  const reiniciarContenido = () => {
    setIntroContenidoMarkdown('');
    setCierreContenidoMarkdown('');
    setPilares([]);
    setErrorContenido('');
    // OJO: "objetivoLinkedin" NO se resetea a propósito — si vuelve a
    // generar otra estrategia es más probable que sea con el mismo
    // objetivo que recién eligió, no tiene sentido hacerla elegir de nuevo.
  };

  // Registra el análisis para poder ver uso/adopción de esta herramienta,
  // igual que guardarEnProgreso() hace para el simulador de entrevistas con
  // la tabla "simulaciones". Nunca bloquea ni rompe la UI si falla (ej: la
  // tabla todavía no existe en Supabase, o el usuario no está logueado) —
  // solo lo logueamos en consola para poder diagnosticarlo si hace falta.
  const guardarAnalisisEnSupabase = async (puntajesResultado: Puntajes | null) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('analisis_linkedin').insert({
        user_id: user.id,
        modo,
        rol_objetivo: modo === 'dirigido' ? rolObjetivo : null,
        puntaje_global: puntajesResultado?.global ?? null,
      });
    } catch (err) {
      console.error('No se pudo guardar el análisis de LinkedIn en el historial:', err);
    }
  };

  const handleAnalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return alert('Pegá tu clave de Google AI Studio para probar.');
    if (!perfilFile) return alert('Subí el PDF de tu perfil de LinkedIn.');
    if (modo === 'dirigido' && !rolObjetivo.trim()) {
      return alert('Poné el puesto al que apuntás, o elegí "Analizar tal cual está" si preferís un análisis objetivo.');
    }

    setCargando(true);
    setError('');
    registrarEventoFunnel('linkedin', 'envio_formulario'); // 3er escalón

    const formData = new FormData();
    // En modo "objetivo" no mandamos rol/párrafo aunque hayan quedado
    // tipeados de un cambio de modo anterior — el backend decide qué tipo de
    // análisis hacer según si recibe o no un rol_objetivo.
    if (modo === 'dirigido') {
      formData.append('rol_objetivo', rolObjetivo);
      formData.append('objetivo_libre', objetivoLibre);
    }
    formData.append('idioma', idioma);
    formData.append('perfil', perfilFile);

    try {
      const res = await fetch(`${API_URL}/api/analizar-perfil-linkedin`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo analizar el perfil.');
      }
      setPuntajes(data.puntajes || null);
      setInformeMarkdown(data.informe_markdown || '');
      setIntroMarkdown(data.intro_markdown || '');
      setTitularMarkdown(data.titular_markdown || '');
      setAcercaDeMarkdown(data.acerca_de_markdown || '');
      setExperienciaMarkdown(data.experiencia_markdown || '');
      setPalabrasClaveMarkdown(data.palabras_clave_markdown || '');
      setCierreMarkdown(data.cierre_markdown || '');
      guardarAnalisisEnSupabase(data.puntajes);
      registrarEventoFunnel('linkedin', 'completado_exito'); // 4to escalón
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  const handleGenerarEstrategia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return alert('Pegá tu clave de Google AI Studio para probar.');
    if (!perfilFile) return alert('Subí el PDF de tu perfil de LinkedIn.');
    if (!objetivoLinkedin) {
      return alert('Contanos qué estás buscando lograr con tu LinkedIn — elegí una opción arriba.');
    }

    setCargandoContenido(true);
    setErrorContenido('');

    const objetivoElegido = OBJETIVOS_LINKEDIN.find((o) => o.value === objetivoLinkedin);

    const formData = new FormData();
    formData.append('objetivo_linkedin', objetivoElegido?.textoBackend || '');
    // A diferencia de la pestaña de análisis de perfil, acá el rol objetivo
    // es siempre opcional (no depende de ningún toggle de "modo") — es
    // contexto extra que suma si está, pero el objetivo elegido arriba ya
    // alcanza para armar la estrategia.
    if (rolObjetivo.trim()) formData.append('rol_objetivo', rolObjetivo);
    if (objetivoLibre.trim()) formData.append('objetivo_libre', objetivoLibre);
    formData.append('idioma', idioma);
    formData.append('perfil', perfilFile);

    try {
      const res = await fetch(`${API_URL}/api/linkedin-estrategia-contenido`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo generar la estrategia de contenido.');
      }
      setIntroContenidoMarkdown(data.intro_markdown || '');
      setCierreContenidoMarkdown(data.cierre_markdown || '');
      setPilares(data.pilares || []);
      registrarEventoFunnel('linkedin', 'completado_exito');
    } catch (err: any) {
      setErrorContenido(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargandoContenido(false);
    }
  };

  const handleDescargarPdf = async () => {
    setDescargandoPdf(true);
    // En modo "objetivo" no hay rolObjetivo — si lo metiéramos igual acá,
    // el título y el nombre de archivo quedarían con un "—" o un "_" colgando
    // sin nada después.
    const tieneRol = modo === 'dirigido' && rolObjetivo.trim();
    const formData = new FormData();
    formData.append('informe_markdown', informeMarkdown);
    formData.append('rol', rolObjetivo);
    formData.append('titulo', tieneRol ? `Informe de Perfil de LinkedIn — ${rolObjetivo}` : 'Informe de Perfil de LinkedIn');
    formData.append('nombre_archivo', tieneRol ? `Perfil_LinkedIn_${rolObjetivo}` : 'Perfil_LinkedIn');

    try {
      const res = await fetch(`${API_URL}/api/descargar-pdf`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'No se pudo generar el PDF.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Informe_Perfil_LinkedIn.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error al descargar el PDF.');
    } finally {
      setDescargandoPdf(false);
    }
  };

  const hayResultadoPerfil = !!informeMarkdown;
  const hayResultadoContenido = pilares.length > 0;

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            💼 Mejorá tu Perfil de LinkedIn
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/inicio" className="text-slate-400 hover:text-white transition-colors">
              🏠 Inicio
            </Link>
            <Link href="/simulador" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador de Entrevistas
            </Link>
          </nav>
        </header>

        {/* Pestañas */}
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-full p-1 w-fit animate-fade-in-up">
          <button
            type="button"
            onClick={() => setVista('perfil')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              vista === 'perfil' ? 'bg-white text-slate-800 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            🔍 Optimizar mi perfil
          </button>
          <button
            type="button"
            onClick={() => setVista('contenido')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              vista === 'contenido' ? 'bg-white text-slate-800 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            📣 Estrategia de contenido
          </button>
        </div>

        {vista === 'perfil' && (
          <>
            {!hayResultadoPerfil && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up">
                <Link
                  href="/guia-carrera"
                  className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-2xl">🧭</p>
                  <p className="font-semibold text-slate-800 text-sm mt-1.5">Guía de Salida Laboral</p>
                  <p className="text-xs text-slate-500 mt-0.5">Explorá áreas y roles, y armá tu plan de carrera con IA para entrar al que te interesa.</p>
                </Link>
                <Link
                  href="/cv"
                  className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-2xl">📄</p>
                  <p className="font-semibold text-slate-800 text-sm mt-1.5">Optimizá tu CV para cada búsqueda</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Comparación contra el puesto: chequeo ATS y logros reescritos, listos para pegar.
                  </p>
                </Link>
                <div className="relative overflow-hidden text-left p-4 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                    Estás acá
                  </span>
                  <p className="text-2xl">💼</p>
                  <p className="font-semibold text-white text-sm mt-1.5">Mejorá tu perfil de LinkedIn</p>
                  <p className="text-xs text-white/80 mt-0.5">
                    Optimizá tu perfil para que los reclutadores te encuentren primero.
                  </p>
                </div>
                <Link
                  href="/simulador"
                  className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-2xl">🎙️</p>
                  <p className="font-semibold text-slate-800 text-sm mt-1.5">Practicá tu entrevista</p>
                  <p className="text-xs text-slate-500 mt-0.5">Simulá una entrevista real y recibí feedback con IA.</p>
                </Link>
                <Link
                  href="/negociacion"
                  className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
                >
                  <p className="text-2xl">💬</p>
                  <p className="font-semibold text-slate-800 text-sm mt-1.5">Negociá tu oferta</p>
                  <p className="text-xs text-slate-500 mt-0.5">Plan concreto para negociar sueldo y condiciones.</p>
                </Link>
              </div>
            )}

            {!hayResultadoPerfil && (
              <div className="text-center pt-2 pb-2 animate-fade-in-up">
                <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
                  Optimización de perfil con IA
                </p>
                <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
                  ¿Tu perfil de LinkedIn te está jugando en contra?
                </h2>
                <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
                  Subí el PDF de tu perfil y te decimos, sección por sección, qué cambiar para que reclutadores
                  y el buscador de LinkedIn te encuentren mejor.
                </p>
                <p className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full mt-4">
                  🌎 Gratis y para cualquier rol o industria.
                </p>
              </div>
            )}

            {!hayResultadoPerfil && (
              <form onSubmit={handleAnalizar} className="space-y-4 animate-fade-in-up">
                <CamposComunes
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  estadoKey={estadoKey}
                  modo={modo}
                  setModo={setModo}
                  rolObjetivo={rolObjetivo}
                  setRolObjetivo={setRolObjetivo}
                  objetivoLibre={objetivoLibre}
                  setObjetivoLibre={setObjetivoLibre}
                  idioma={idioma}
                  setIdioma={setIdioma}
                  perfilFile={perfilFile}
                  setPerfilFile={setPerfilFile}
                />

                {error && <p className="text-xs text-red-400 px-1 animate-fade-in">{error}</p>}

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {cargando && <Spinner />}
                  {cargando ? 'Analizando tu perfil...' : '🔍 Analizar mi perfil'}
                </button>
              </form>
            )}

            {/* Resultado */}
            {hayResultadoPerfil && (
              <div className="space-y-4 animate-fade-in-up">
                {puntajes && (
                  <div className="space-y-3">
                    <div
                      className={`bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border ${
                        colorDeNota(puntajes.global).borde
                      } p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-purple-950/30 animate-scale-in`}
                    >
                      <div>
                        <span className="text-slate-800 font-semibold block">Puntaje Global</span>
                        <span className="text-slate-500 text-xs">Qué tan listo está tu perfil</span>
                      </div>
                      <span
                        className={`text-4xl font-extrabold ${colorDeNota(puntajes.global).texto} ring-4 ${
                          colorDeNota(puntajes.global).anillo
                        } bg-white rounded-full w-24 h-24 flex items-center justify-center`}
                      >
                        {puntajes.global}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { label: 'Titular', valor: puntajes.headline },
                        { label: 'Acerca de', valor: puntajes.acerca_de },
                        { label: 'Experiencia', valor: puntajes.experiencia },
                        { label: 'Palabras clave', valor: puntajes.palabras_clave },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border ${
                            colorDeNota(item.valor).borde
                          } rounded-xl p-3 text-center shadow-md shadow-purple-950/10`}
                        >
                          <p className={`text-xl font-bold ${colorDeNota(item.valor).texto}`}>{item.valor}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5">
                  <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                    <ReactMarkdown>{introMarkdown}</ReactMarkdown>
                    <ReactMarkdown>{titularMarkdown}</ReactMarkdown>
                    <ReactMarkdown>{acercaDeMarkdown}</ReactMarkdown>
                    <ReactMarkdown>{experienciaMarkdown}</ReactMarkdown>
                    <ReactMarkdown>{palabrasClaveMarkdown}</ReactMarkdown>
                    <ReactMarkdown>{cierreMarkdown}</ReactMarkdown>
                  </div>
                </div>

                <FeedbackInforme herramienta="linkedin" />

                <div className="flex gap-3">
                  <button
                    onClick={handleDescargarPdf}
                    disabled={descargandoPdf}
                    className="flex-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {descargandoPdf && <Spinner />}
                    {descargandoPdf ? 'Generando PDF...' : '📥 Descargar Informe en PDF'}
                  </button>
                  <button
                    onClick={reiniciarTodo}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2.5 rounded-full font-medium text-sm transition-all active:scale-[0.99]"
                  >
                    🔄 Analizar otro perfil
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {vista === 'contenido' && (
          <>
            {!hayResultadoContenido && (
              <div className="text-center pt-2 pb-2 animate-fade-in-up">
                <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
                  Marca personal para buscadores de empleo
                </p>
                <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
                  Que te vean antes de aplicar
                </h2>
                <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
                  Esto no es para "hacerte influencer": es una estrategia de contenido pensada para alguien en
                  búsqueda laboral — de qué hablar y con qué frecuencia, anclado en tu propia experiencia real.
                </p>
              </div>
            )}

            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5 animate-fade-in-up">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">📚 Cómo funciona LinkedIn (resumen rápido)</h3>
              <ul className="space-y-2">
                {TIPS_LINKEDIN.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="shrink-0">{tip.emoji}</span>
                    <span>{tip.texto}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!hayResultadoContenido && (
              <form onSubmit={handleGenerarEstrategia} className="space-y-4 animate-fade-in-up">
                <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl shadow-xl shadow-purple-950/30">
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    ¿Qué estás buscando lograr con tu LinkedIn?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {OBJETIVOS_LINKEDIN.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setObjetivoLinkedin(o.value)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          objetivoLinkedin === o.value
                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                            : 'border-slate-200 bg-white hover:border-purple-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {o.emoji} {o.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{o.descripcion}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <CamposComunes
                  apiKey={apiKey}
                  setApiKey={setApiKey}
                  estadoKey={estadoKey}
                  modo={modo}
                  setModo={setModo}
                  rolObjetivo={rolObjetivo}
                  setRolObjetivo={setRolObjetivo}
                  objetivoLibre={objetivoLibre}
                  setObjetivoLibre={setObjetivoLibre}
                  idioma={idioma}
                  setIdioma={setIdioma}
                  perfilFile={perfilFile}
                  setPerfilFile={setPerfilFile}
                  mostrarSelectorModo={false}
                />

                {errorContenido && <p className="text-xs text-red-400 px-1 animate-fade-in">{errorContenido}</p>}

                <button
                  type="submit"
                  disabled={cargandoContenido}
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {cargandoContenido && <Spinner />}
                  {cargandoContenido ? 'Armando tu estrategia...' : '📣 Generar mi estrategia de contenido'}
                </button>
              </form>
            )}

            {hayResultadoContenido && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5">
                  <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                    <ReactMarkdown>{introContenidoMarkdown}</ReactMarkdown>
                  </div>
                </div>

                <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2 animate-fade-in">
                  {AVISO_IA_LINKEDIN}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pilares.map((pilar, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5"
                    >
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                        Pilar {i + 1}
                      </p>
                      <h3 className="text-base font-bold text-slate-800">{pilar.nombre}</h3>
                      <p className="text-sm text-slate-500 mt-1 mb-3">{pilar.descripcion}</p>
                      <ul className="space-y-2">
                        {pilar.ideas.map((idea, j) => (
                          <li key={j} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                            <p className="text-sm font-semibold text-slate-800">💡 {idea.titulo}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{idea.angulo}</p>
                          </li>
                        ))}
                      </ul>
                      {pilar.ejemplo_post && (
                        <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                          <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide mb-1.5">
                            📝 Ejemplo de posteo
                          </p>
                          <p className="text-xs text-slate-600 whitespace-pre-line">{pilar.ejemplo_post}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5">
                  <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                    <ReactMarkdown>{cierreContenidoMarkdown}</ReactMarkdown>
                  </div>
                </div>

                <FeedbackInforme herramienta="linkedin" />

                <button
                  onClick={reiniciarContenido}
                  className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2.5 rounded-full font-medium text-sm transition-all active:scale-[0.99]"
                >
                  🔄 Generar otra estrategia
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Bloque de inputs compartido entre las dos pestañas (API key, modo de
// análisis, rol objetivo, idioma, y el PDF del perfil) — ambas pestañas
// analizan el MISMO perfil, así que no tiene sentido pedírselo dos veces ni
// duplicar este formulario entero en el archivo.
function CamposComunes({
  apiKey,
  setApiKey,
  estadoKey,
  modo,
  setModo,
  rolObjetivo,
  setRolObjetivo,
  objetivoLibre,
  setObjetivoLibre,
  idioma,
  setIdioma,
  perfilFile,
  setPerfilFile,
  mostrarSelectorModo = true,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  estadoKey: EstadoKey;
  modo: ModoAnalisis;
  setModo: (v: ModoAnalisis) => void;
  rolObjetivo: string;
  setRolObjetivo: (v: string) => void;
  objetivoLibre: string;
  setObjetivoLibre: (v: string) => void;
  idioma: string;
  setIdioma: (v: string) => void;
  perfilFile: File | null;
  setPerfilFile: (f: File | null) => void;
  // false en la pestaña de "Estrategia de contenido": ahí no tiene sentido
  // preguntar "¿qué tipo de análisis querés?" (no es un análisis), así que
  // esa pestaña trae su propio selector de objetivo (ver OBJETIVOS_LINKEDIN)
  // y acá el puesto objetivo queda siempre como campo opcional, sin el
  // toggle dirigido/objetivo.
  mostrarSelectorModo?: boolean;
}) {
  // En la pestaña de perfil, el puesto objetivo solo se pide/exige en modo
  // "dirigido". En la de contenido (mostrarSelectorModo=false) se muestra
  // siempre, pero nunca es obligatorio — el objetivo de LinkedIn ya alcanza.
  const mostrarRolObjetivo = mostrarSelectorModo ? modo === 'dirigido' : true;

  return (
    <>
      {/* API Key */}
      <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl shadow-xl shadow-purple-950/30 transition-colors">
        <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 bg-purple-200/40 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 w-48 h-48 bg-blue-200/40 rounded-full blur-3xl" />

        <div className="relative">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            🔑 API Key de Gemini:{' '}
            <span className="text-xs font-normal text-slate-400">— así conectás con la IA que hace el análisis</span>
          </label>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              required
              className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 pl-3 pr-9 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
              {estadoKey === 'verificando' && <Spinner className="text-slate-400" />}
              {estadoKey === 'valida' && (
                <span className="text-emerald-500 animate-scale-in" title="API Key válida">
                  🟢
                </span>
              )}
              {estadoKey === 'invalida' && (
                <span className="text-red-500 animate-scale-in" title="API Key inválida">
                  🔴
                </span>
              )}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-700 transition-colors font-medium"
              >
                👉 Conseguí tu API Key gratuita acá
              </a>
              <span className="text-slate-600">· Es 100% gratis y te lleva menos de 1 minuto.</span>
            </div>

            <PasosApiKey />
          </div>
        </div>
      </div>
      {estadoKey === 'invalida' && (
        <p className="text-xs text-red-400 -mt-2 px-1 animate-fade-in">
          No pudimos validar esa API Key. Revisá que esté completa y sin espacios de más.
        </p>
      )}
      {estadoKey === 'valida' && (
        <p className="text-xs text-emerald-400 -mt-2 px-1 animate-fade-in">✓ API Key reconocida correctamente.</p>
      )}

      {/* Modo de análisis + rol objetivo + idioma */}
      <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
        {mostrarSelectorModo && (
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">¿Qué tipo de análisis querés?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setModo('dirigido')}
                className={`text-left p-3 rounded-xl border transition-all ${
                  modo === 'dirigido'
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-purple-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">🎯 En función de una posición</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pensado en el rol al que te gustaría adaptarlo.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setModo('objetivo')}
                className={`text-left p-3 rounded-xl border transition-all ${
                  modo === 'objetivo'
                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                    : 'border-slate-200 bg-white hover:border-purple-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">📄 Tu LinkedIn tal cual está</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  A partir de tu experiencia actual, sin apuntar a una vacante puntual.
                </p>
              </button>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${mostrarRolObjetivo ? 'md:grid-cols-2' : ''} gap-4`}>
          {mostrarRolObjetivo && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Puesto al que apuntás {!mostrarSelectorModo && <span className="text-slate-400 font-normal">(opcional)</span>}
              </label>
              <input
                type="text"
                value={rolObjetivo}
                onChange={(e) => setRolObjetivo(e.target.value)}
                placeholder="Ej: Analista Contable, Líder de Ventas, Desarrollador Backend..."
                className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                required={mostrarSelectorModo}
              />
              <p className="text-xs text-slate-500 mt-1">
                Así te sugerimos palabras clave y pilares de contenido pensados para ESE rol puntual.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-1">Idioma del informe</label>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value)}
              className="w-full bg-white border border-purple-200 text-slate-800 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
            >
              <option value="Español">Español</option>
              <option value="Inglés">Inglés</option>
            </select>
          </div>
          {mostrarRolObjetivo && (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Contanos más sobre lo que buscás (opcional)
              </label>
              <textarea
                rows={3}
                value={objetivoLibre}
                onChange={(e) => setObjetivoLibre(e.target.value)}
                placeholder='Ej: "Quiero pasar a un rol de gestión de personas, pero todavía no tengo tanto seniority — busco algo intermedio entre People Manager y HRBP Sr."'
                className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Útil si tu objetivo no es un puesto único y cerrado — un mix de roles, una transición, una
                ambición por encima de tu nivel actual, etc. Cuanto más contexto real, mejores las sugerencias.
              </p>
            </div>
          )}
        </div>

        {/* Cómo conseguir el PDF de LinkedIn */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">
            📄 Necesitás el PDF de tu propio perfil de LinkedIn (no una captura de pantalla)
          </p>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
            {[
              'Entrá a tu perfil de LinkedIn ("Yo" → "Ver perfil").',
              'Debajo de tu foto, tocá el botón "Más".',
              'Elegí "Guardar en PDF" y descargalo.',
            ].map((paso, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">Tu perfil en PDF</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPerfilFile(e.target.files?.[0] || null)}
            required
            className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
          />
        </div>
      </div>
    </>
  );
}
