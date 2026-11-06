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

// Dos modos dentro de la misma herramienta: "optimizar" (el flujo original,
// comparar un CV ya armado contra un puesto) y "desde_cero" (pedido
// explícito de Ale: gente que todavía no tiene CV armado, ej. alguien
// buscando su primer empleo). Comparten API Key/idioma y la pantalla de
// resultado; se diferencian en el formulario de entrada y en el prompt que
// usa cada uno en el backend.
type ModoCv = 'optimizar' | 'desde_cero';

type Puntajes = {
  global: number;
  formato_ats: number;
  logros: number;
  palabras_clave: number;
  proyectado?: number;
};

type ExperienciaForm = {
  empresa: string;
  puesto: string;
  periodo: string;
  tareas: string;
};

type EducacionForm = {
  institucion: string;
  titulo: string;
  estado: string;
};

const EXPERIENCIA_VACIA: ExperienciaForm = { empresa: '', puesto: '', periodo: '', tareas: '' };
const EDUCACION_VACIA: EducacionForm = { institucion: '', titulo: '', estado: '' };

// Puntajes en %  (0 a 100), no notas sobre 10.
function colorDeNota(nota: number) {
  if (nota >= 70) return { texto: 'text-emerald-600', anillo: 'ring-emerald-300', borde: 'border-emerald-200' };
  if (nota >= 40) return { texto: 'text-amber-600', anillo: 'ring-amber-300', borde: 'border-amber-200' };
  return { texto: 'text-red-600', anillo: 'ring-red-300', borde: 'border-red-200' };
}

// Bloque de API Key, compartido entre los dos modos (antes vivía solo
// dentro del form de "optimizar").
function CampoApiKey({
  apiKey,
  setApiKey,
  estadoKey,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  estadoKey: EstadoKey;
}) {
  return (
    <>
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
        <p className="text-xs text-emerald-400 -mt-2 px-1 animate-fade-in">
          ✓ API Key reconocida correctamente.
        </p>
      )}
    </>
  );
}

export default function CvPage() {
  const [apiKey, setApiKey] = useState('');
  const [estadoKey, setEstadoKey] = useState<EstadoKey>('vacio');
  const [idioma, setIdioma] = useState('Español');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const [modoCv, setModoCv] = useState<ModoCv>('optimizar');
  // Con qué modo se generó el resultado que se está mostrando — puede
  // diferir de "modoCv" si la persona ya tiene un resultado en pantalla
  // (el toggle de arriba queda oculto mientras hayResultado, pero igual
  // necesitamos saber qué labels/textos usar).
  const [modoResultado, setModoResultado] = useState<ModoCv>('optimizar');

  // --- Modo "optimizar" (flujo original: comparar un CV ya armado) ---
  const [puestoObjetivo, setPuestoObjetivo] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);

  // --- Modo "desde_cero" (formulario guiado para armar el CV) ---
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [ubicacionContacto, setUbicacionContacto] = useState('');
  const [linkedinContacto, setLinkedinContacto] = useState('');
  const [rolObjetivoDesdeCero, setRolObjetivoDesdeCero] = useState('');
  const [puestoDescripcionDesdeCero, setPuestoDescripcionDesdeCero] = useState('');
  const [sinExperiencia, setSinExperiencia] = useState(false);
  const [experiencias, setExperiencias] = useState<ExperienciaForm[]>([{ ...EXPERIENCIA_VACIA }]);
  const [educaciones, setEducaciones] = useState<EducacionForm[]>([{ ...EDUCACION_VACIA }]);
  const [habilidadesDesdeCero, setHabilidadesDesdeCero] = useState('');
  const [idiomasHabladosDesdeCero, setIdiomasHabladosDesdeCero] = useState('');
  const [certificacionesDesdeCero, setCertificacionesDesdeCero] = useState('');
  const [resumenLibreDesdeCero, setResumenLibreDesdeCero] = useState('');

  const [puntajes, setPuntajes] = useState<Puntajes | null>(null);
  // Mismo patrón que la herramienta de LinkedIn: el backend devuelve el
  // informe ya partido en estos campos de markdown independientes, en vez
  // de un solo bloque gigante — así el frontend no tiene que adivinar dónde
  // cortar el texto (ver Backend/main.py, analizar_cv y
  // armar_cv_desde_cero). El modo "desde_cero" solo usa intro/cierre (ahí
  // van sus 2 campos: intro_markdown y consejos_markdown) y deja
  // formato/logros/palabras_clave vacíos.
  const [informeMarkdown, setInformeMarkdown] = useState(''); // versión completa, solo para el PDF
  const [introMarkdown, setIntroMarkdown] = useState('');
  const [formatoMarkdown, setFormatoMarkdown] = useState('');
  const [logrosMarkdown, setLogrosMarkdown] = useState('');
  const [palabrasClaveMarkdown, setPalabrasClaveMarkdown] = useState('');
  const [cierreMarkdown, setCierreMarkdown] = useState('');
  // CV completo (reescrito, o armado de cero) — es un documento aparte del
  // informe, por eso tiene su propio estado y su propio botón de descarga
  // (ver handleDescargarCvReescrito).
  const [cvReescritoMarkdown, setCvReescritoMarkdown] = useState('');
  const [descargandoCv, setDescargandoCv] = useState(false);

  // Primer escalón del embudo: entró logueado a la pantalla. Una vez por
  // carga de página (se dedupea con COUNT DISTINCT al analizar).
  useEffect(() => {
    registrarEventoFunnel('cv', 'formulario_visto');
  }, []);

  // Misma validación de API Key que las otras dos herramientas: se chequea
  // contra el backend medio segundo después de dejar de tipear.
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
          registrarEventoFunnel('cv', 'api_key_valida'); // 2do escalón
        } else {
          registrarEventoFunnel('cv', 'api_key_invalida'); // intentó, pero no pasó
        }
      } catch {
        setEstadoKey('invalida');
        registrarEventoFunnel('cv', 'api_key_invalida');
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  const reiniciarTodo = () => {
    setCvFile(null);
    setPuntajes(null);
    setInformeMarkdown('');
    setIntroMarkdown('');
    setFormatoMarkdown('');
    setLogrosMarkdown('');
    setPalabrasClaveMarkdown('');
    setCierreMarkdown('');
    setCvReescritoMarkdown('');
    setError('');
  };

  // Registra el análisis para poder ver uso/adopción de esta herramienta,
  // igual que guardarAnalisisEnSupabase() en la de LinkedIn. Nunca bloquea ni
  // rompe la UI si falla (ej: la tabla todavía no existe en Supabase).
  // "modo" queda fijo en 'dirigido' porque la tabla analisis_cv tiene un
  // check constraint que todavía espera ese valor — ver sql_herramienta_cv.sql.
  // Solo se llama para el modo "optimizar": el modo "desde_cero" no compara
  // contra nada (no hay puntaje), así que no tiene sentido forzarlo en esta
  // tabla todavía.
  const guardarAnalisisEnSupabase = async (puntajesResultado: Puntajes | null) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('analisis_cv').insert({
        user_id: user.id,
        modo: 'dirigido',
        puntaje_global: puntajesResultado?.global ?? null,
      });
    } catch (err) {
      console.error('No se pudo guardar el análisis de CV en el historial:', err);
    }
  };

  const handleAnalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return alert('Pegá tu clave de Google AI Studio para probar.');
    if (!cvFile) return alert('Subí tu CV en PDF.');
    if (!puestoObjetivo.trim()) {
      return alert('Pegá la descripción del puesto al que querés aplicar.');
    }

    setCargando(true);
    setError('');
    setModoResultado('optimizar');
    registrarEventoFunnel('cv', 'envio_formulario'); // 3er escalón

    const formData = new FormData();
    formData.append('puesto_objetivo', puestoObjetivo);
    formData.append('idioma', idioma);
    formData.append('cv', cvFile);

    try {
      const res = await fetch(`${API_URL}/api/analizar-cv`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo analizar el CV.');
      }
      setPuntajes(data.puntajes || null);
      setInformeMarkdown(data.informe_markdown || '');
      setIntroMarkdown(data.intro_markdown || '');
      setFormatoMarkdown(data.formato_markdown || '');
      setLogrosMarkdown(data.logros_markdown || '');
      setPalabrasClaveMarkdown(data.palabras_clave_markdown || '');
      setCierreMarkdown(data.cierre_markdown || '');
      setCvReescritoMarkdown(data.cv_reescrito_markdown || '');
      guardarAnalisisEnSupabase(data.puntajes);
      registrarEventoFunnel('cv', 'completado_exito'); // 4to escalón
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  // --- Helpers del formulario guiado (modo "desde_cero") ---
  const actualizarExperiencia = (idx: number, campo: keyof ExperienciaForm, valor: string) => {
    setExperiencias((prev) => prev.map((exp, i) => (i === idx ? { ...exp, [campo]: valor } : exp)));
  };
  const agregarExperiencia = () => setExperiencias((prev) => [...prev, { ...EXPERIENCIA_VACIA }]);
  const quitarExperiencia = (idx: number) => setExperiencias((prev) => prev.filter((_, i) => i !== idx));

  const actualizarEducacion = (idx: number, campo: keyof EducacionForm, valor: string) => {
    setEducaciones((prev) => prev.map((edu, i) => (i === idx ? { ...edu, [campo]: valor } : edu)));
  };
  const agregarEducacion = () => setEducaciones((prev) => [...prev, { ...EDUCACION_VACIA }]);
  const quitarEducacion = (idx: number) => setEducaciones((prev) => prev.filter((_, i) => i !== idx));

  const handleArmarDesdeCero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return alert('Pegá tu clave de Google AI Studio para probar.');
    if (!nombreCompleto.trim()) return alert('Contanos tu nombre completo.');
    if (!rolObjetivoDesdeCero.trim()) {
      return alert('Contanos a qué tipo de puesto te gustaría postularte.');
    }

    const experienciasValidas = sinExperiencia
      ? []
      : experiencias.filter((exp) => exp.empresa.trim() || exp.puesto.trim() || exp.tareas.trim());
    const educacionesValidas = educaciones.filter((edu) => edu.institucion.trim() || edu.titulo.trim());

    if (experienciasValidas.length === 0 && educacionesValidas.length === 0) {
      return alert(
        'Contanos al menos una experiencia (formal, informal, pasantía o voluntariado) o un dato de educación.'
      );
    }

    setCargando(true);
    setError('');
    setModoResultado('desde_cero');
    registrarEventoFunnel('cv', 'envio_formulario');

    const formData = new FormData();
    formData.append('idioma', idioma);
    formData.append('rol_objetivo', rolObjetivoDesdeCero);
    formData.append('puesto_descripcion', puestoDescripcionDesdeCero);
    formData.append(
      'datos_personales',
      JSON.stringify({
        nombre: nombreCompleto,
        email: emailContacto,
        telefono: telefonoContacto,
        ubicacion: ubicacionContacto,
        linkedin: linkedinContacto,
      })
    );
    formData.append('experiencia', JSON.stringify(experienciasValidas));
    formData.append('educacion', JSON.stringify(educacionesValidas));
    formData.append('habilidades', habilidadesDesdeCero);
    formData.append('idiomas_hablados', idiomasHabladosDesdeCero);
    formData.append('certificaciones', certificacionesDesdeCero);
    formData.append('resumen_libre', resumenLibreDesdeCero);

    try {
      const res = await fetch(`${API_URL}/api/armar-cv-desde-cero`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo armar el CV.');
      }
      setPuntajes(null);
      setInformeMarkdown(data.informe_markdown || '');
      setIntroMarkdown(data.intro_markdown || '');
      setFormatoMarkdown('');
      setLogrosMarkdown('');
      setPalabrasClaveMarkdown('');
      setCierreMarkdown(data.consejos_markdown || '');
      setCvReescritoMarkdown(data.cv_armado_markdown || '');
      registrarEventoFunnel('cv', 'completado_exito');
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  const handleDescargarPdf = async () => {
    setDescargandoPdf(true);
    // A diferencia de LinkedIn, acá no armamos un título/nombre de archivo
    // con el puesto objetivo: en modo "optimizar" ese campo puede ser una
    // descripción de puesto entera pegada por la persona, no un rol cortito
    // — meterla en el título/nombre de archivo sería ilegible. Título fijo.
    const titulo = modoResultado === 'desde_cero' ? 'Consejos para tu CV' : 'Informe de tu CV';
    const nombreArchivo = modoResultado === 'desde_cero' ? 'Consejos_CV' : 'Informe_CV';
    const formData = new FormData();
    formData.append('informe_markdown', informeMarkdown);
    formData.append('titulo', titulo);
    formData.append('nombre_archivo', nombreArchivo);

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
      a.download = `${nombreArchivo}.pdf`;
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

  const handleDescargarCvReescrito = async () => {
    setDescargandoCv(true);
    const titulo = modoResultado === 'desde_cero' ? 'Mi CV' : 'Tu CV Optimizado';
    const nombreArchivo = modoResultado === 'desde_cero' ? 'Mi_CV' : 'CV_Optimizado';
    const formData = new FormData();
    formData.append('informe_markdown', cvReescritoMarkdown);
    formData.append('titulo', titulo);
    formData.append('nombre_archivo', nombreArchivo);

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
      a.download = `${nombreArchivo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error al descargar el PDF.');
    } finally {
      setDescargandoCv(false);
    }
  };

  const hayResultado = !!informeMarkdown;

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            📄 Optimizá tu CV para cada búsqueda
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/inicio" className="text-slate-400 hover:text-white transition-colors">
              🏠 Inicio
            </Link>
            <Link href="/simulador" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador de Entrevistas
            </Link>
            <Link href="/linkedin" className="text-slate-400 hover:text-white transition-colors">
              💼 LinkedIn
            </Link>
          </nav>
        </header>

        {!hayResultado && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up">
            <Link
              href="/guia-carrera"
              className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl">🧭</p>
              <p className="font-semibold text-slate-800 text-sm mt-1.5">Guía de Salida Laboral</p>
              <p className="text-xs text-slate-500 mt-0.5">Explorá áreas y roles, y armá tu plan de carrera con IA para entrar al que te interesa.</p>
            </Link>
            <div className="relative overflow-hidden text-left p-4 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Estás acá
              </span>
              <p className="text-2xl">📄</p>
              <p className="font-semibold text-white text-sm mt-1.5">Armado y optimización de CV</p>
              <p className="text-xs text-white/80 mt-0.5">
                Armá tu currículum de cero o potenciá el que ya tenés, para que tus postulaciones sean mucho más efectivas.
              </p>
            </div>
            <Link
              href="/linkedin"
              className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl">💼</p>
              <p className="font-semibold text-slate-800 text-sm mt-1.5">LinkedIn y marca personal</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Mejorá tu perfil de LinkedIn y aprendé a desarrollar tu marca personal.
              </p>
            </Link>
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

        {!hayResultado && (
          <div className="flex justify-center animate-fade-in-up">
            <div className="inline-flex gap-1 bg-white/5 border border-white/10 rounded-full p-1">
              <button
                type="button"
                onClick={() => setModoCv('optimizar')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  modoCv === 'optimizar' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                📄 Ya tengo un CV
              </button>
              <button
                type="button"
                onClick={() => setModoCv('desde_cero')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  modoCv === 'desde_cero' ? 'bg-white text-slate-800 shadow-md' : 'text-slate-300 hover:text-white'
                }`}
              >
                ✨ No tengo CV, armalo de cero
              </button>
            </div>
          </div>
        )}

        {!hayResultado && modoCv === 'optimizar' && (
          <div className="text-center pt-2 pb-2 animate-fade-in-up">
            <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
              Chequeo ATS con IA
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
              ¿Tu CV está armado para ESTE puesto?
            </h2>
            <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
              Pegá el aviso del puesto al que querés aplicar y subí tu CV en PDF: te decimos qué vería un
              sistema ATS al leerlo, qué palabras clave te faltan frente a esa búsqueda puntual, y te
              reescribimos cada logro, listo para pegar.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full mt-4">
              🌎 Gratis y para cualquier rol o industria.
            </p>
          </div>
        )}

        {!hayResultado && modoCv === 'desde_cero' && (
          <div className="text-center pt-2 pb-2 animate-fade-in-up">
            <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
              Armalo con IA, paso a paso
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
              ¿Todavía no tenés un CV armado?
            </h2>
            <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
              No hace falta que sepas de formato ni de ATS. Contestá estas preguntas simples sobre vos —
              estudios, experiencia (aunque sea informal o un primer trabajo) y habilidades — y te armamos
              un CV completo, prolijo y listo para mandar.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full mt-4">
              🌱 Ideal si es tu primer CV o nunca tuviste uno armado.
            </p>
          </div>
        )}

        {!hayResultado && modoCv === 'optimizar' && (
          <form onSubmit={handleAnalizar} className="space-y-4 animate-fade-in-up">
            <CampoApiKey apiKey={apiKey} setApiKey={setApiKey} estadoKey={estadoKey} />

            {/* Puesto objetivo + idioma */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Pegá la descripción del puesto
                  </label>
                  <textarea
                    rows={5}
                    value={puestoObjetivo}
                    onChange={(e) => setPuestoObjetivo(e.target.value)}
                    placeholder="Pegá acá el texto del aviso (requisitos, responsabilidades, etc.) — cuanto más completo, mejor el análisis de match."
                    className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    No hace falta el link, solo pegá el texto del aviso — así no dependemos de scrapear ningún sitio.
                  </p>
                </div>
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
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Tu CV en PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  required
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Tiene que ser un PDF con texto real (no una imagen escaneada ni una captura de pantalla).
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 px-1 animate-fade-in">{error}</p>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {cargando && <Spinner />}
              {cargando ? 'Analizando tu CV...' : '🔍 Analizar mi CV'}
            </button>
          </form>
        )}

        {!hayResultado && modoCv === 'desde_cero' && (
          <form onSubmit={handleArmarDesdeCero} className="space-y-4 animate-fade-in-up">
            <CampoApiKey apiKey={apiKey} setApiKey={setApiKey} estadoKey={estadoKey} />

            {/* Datos personales */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <p className="text-sm font-semibold text-slate-800">👤 Tus datos</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={nombreCompleto}
                  onChange={(e) => setNombreCompleto(e.target.value)}
                  placeholder="Nombre y apellido"
                  required
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                />
                <input
                  type="email"
                  value={emailContacto}
                  onChange={(e) => setEmailContacto(e.target.value)}
                  placeholder="Email de contacto"
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                />
                <input
                  type="text"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                />
                <input
                  type="text"
                  value={ubicacionContacto}
                  onChange={(e) => setUbicacionContacto(e.target.value)}
                  placeholder="Ciudad, país"
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                />
                <input
                  type="text"
                  value={linkedinContacto}
                  onChange={(e) => setLinkedinContacto(e.target.value)}
                  placeholder="Link de tu LinkedIn (opcional)"
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 md:col-span-2"
                />
              </div>
            </div>

            {/* Rol objetivo + idioma */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    ¿A qué tipo de puesto te gustaría postularte?
                  </label>
                  <input
                    type="text"
                    value={rolObjetivoDesdeCero}
                    onChange={(e) => setRolObjetivoDesdeCero(e.target.value)}
                    placeholder="Ej: Vendedor/a, Analista de datos jr., Recepcionista..."
                    required
                    className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Idioma del CV</label>
                  <select
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value)}
                    className="w-full bg-white border border-purple-200 text-slate-800 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                  >
                    <option value="Español">Español</option>
                    <option value="Inglés">Inglés</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  ¿Tenés un aviso puntual en mente? (opcional)
                </label>
                <textarea
                  rows={3}
                  value={puestoDescripcionDesdeCero}
                  onChange={(e) => setPuestoDescripcionDesdeCero(e.target.value)}
                  placeholder="Si ya viste un aviso que te interesa, pegalo acá para orientar mejor el CV. Si no, dejalo en blanco."
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                />
              </div>
            </div>

            {/* Experiencia */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">💼 Experiencia</p>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={sinExperiencia}
                    onChange={(e) => setSinExperiencia(e.target.checked)}
                  />
                  Todavía no tengo experiencia laboral
                </label>
              </div>

              {!sinExperiencia && (
                <div className="space-y-3">
                  {experiencias.map((exp, idx) => (
                    <div key={idx} className="bg-white/60 border border-purple-100 rounded-xl p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={exp.puesto}
                          onChange={(e) => actualizarExperiencia(idx, 'puesto', e.target.value)}
                          placeholder="Puesto o tarea (ej: Cajero, Niñera, Ayudante de obra...)"
                          className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                        />
                        <input
                          type="text"
                          value={exp.empresa}
                          onChange={(e) => actualizarExperiencia(idx, 'empresa', e.target.value)}
                          placeholder="Empresa, negocio o para quién trabajaste"
                          className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                        />
                      </div>
                      <input
                        type="text"
                        value={exp.periodo}
                        onChange={(e) => actualizarExperiencia(idx, 'periodo', e.target.value)}
                        placeholder="Período (ej: Enero 2023 - Actualidad)"
                        className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                      />
                      <textarea
                        rows={2}
                        value={exp.tareas}
                        onChange={(e) => actualizarExperiencia(idx, 'tareas', e.target.value)}
                        placeholder="Contanos qué hacías ahí, como si le explicaras a un amigo"
                        className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                      />
                      {experiencias.length > 1 && (
                        <button
                          type="button"
                          onClick={() => quitarExperiencia(idx)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          🗑️ Quitar esta experiencia
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={agregarExperiencia}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    + Agregar otra experiencia
                  </button>
                  <p className="text-xs text-slate-500">
                    Vale cualquier tipo de experiencia: trabajos informales, pasantías, voluntariado o changas.
                  </p>
                </div>
              )}
            </div>

            {/* Educación */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <p className="text-sm font-semibold text-slate-800">🎓 Educación</p>
              <div className="space-y-3">
                {educaciones.map((edu, idx) => (
                  <div key={idx} className="bg-white/60 border border-purple-100 rounded-xl p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={edu.titulo}
                        onChange={(e) => actualizarEducacion(idx, 'titulo', e.target.value)}
                        placeholder="Título o carrera (ej: Secundario, Lic. en Marketing...)"
                        className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                      />
                      <input
                        type="text"
                        value={edu.institucion}
                        onChange={(e) => actualizarEducacion(idx, 'institucion', e.target.value)}
                        placeholder="Institución"
                        className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                      />
                    </div>
                    <input
                      type="text"
                      value={edu.estado}
                      onChange={(e) => actualizarEducacion(idx, 'estado', e.target.value)}
                      placeholder="Estado (ej: Completo, En curso - 3er año, 2022)"
                      className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                    />
                    {educaciones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitarEducacion(idx)}
                        className="text-xs text-red-500 hover:text-red-600"
                      >
                        🗑️ Quitar esta educación
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={agregarEducacion}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  + Agregar otro dato de educación
                </button>
              </div>
            </div>

            {/* Habilidades, idiomas, certificaciones y resumen libre */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Habilidades y herramientas que manejás
                </label>
                <textarea
                  rows={2}
                  value={habilidadesDesdeCero}
                  onChange={(e) => setHabilidadesDesdeCero(e.target.value)}
                  placeholder="Ej: Excel, atención al cliente, manejo de caja, Photoshop..."
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Idiomas (opcional)</label>
                  <input
                    type="text"
                    value={idiomasHabladosDesdeCero}
                    onChange={(e) => setIdiomasHabladosDesdeCero(e.target.value)}
                    placeholder="Ej: Inglés intermedio, Portugués básico"
                    className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Certificaciones o cursos (opcional)
                  </label>
                  <input
                    type="text"
                    value={certificacionesDesdeCero}
                    onChange={(e) => setCertificacionesDesdeCero(e.target.value)}
                    placeholder="Ej: Curso de Excel (2023)"
                    className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  ¿Algo más que quieras contar? (opcional)
                </label>
                <textarea
                  rows={2}
                  value={resumenLibreDesdeCero}
                  onChange={(e) => setResumenLibreDesdeCero(e.target.value)}
                  placeholder="Ej: proyectos propios, voluntariado, por qué te interesa este tipo de puesto..."
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-2.5 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-400 px-1 animate-fade-in">{error}</p>}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {cargando && <Spinner />}
              {cargando ? 'Armando tu CV...' : '✨ Armar mi CV'}
            </button>
          </form>
        )}

        {/* Resultado */}
        {hayResultado && (
          <div className="space-y-4 animate-fade-in-up">
            {puntajes && (
              <div className="space-y-3">
                <div
                  className={`bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border ${
                    colorDeNota(puntajes.global).borde
                  } p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-purple-950/30 animate-scale-in`}
                >
                  <div>
                    <span className="text-slate-800 font-semibold block">Compatibilidad con el puesto</span>
                    <span className="text-slate-500 text-xs">Qué tan listo está tu CV para esta búsqueda</span>
                  </div>
                  <span
                    className={`text-3xl font-extrabold ${colorDeNota(puntajes.global).texto} ring-4 ${
                      colorDeNota(puntajes.global).anillo
                    } bg-white rounded-full w-24 h-24 flex items-center justify-center`}
                  >
                    {puntajes.global}%
                  </span>
                </div>

                {typeof puntajes.proyectado === 'number' && puntajes.proyectado > puntajes.global && (
                  <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-2xl px-5 py-3 flex items-center justify-center gap-3">
                    <span className={`text-lg font-bold ${colorDeNota(puntajes.global).texto}`}>
                      {puntajes.global}%
                    </span>
                    <span className="text-slate-400 text-sm">→</span>
                    <span className={`text-lg font-bold ${colorDeNota(puntajes.proyectado).texto}`}>
                      {puntajes.proyectado}% estimado
                    </span>
                    <span className="text-slate-500 text-xs">aplicando las 3 acciones de abajo</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Formato ATS', valor: puntajes.formato_ats },
                    { label: 'Logros', valor: puntajes.logros },
                    { label: 'Palabras clave', valor: puntajes.palabras_clave },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border ${
                        colorDeNota(item.valor).borde
                      } rounded-xl p-3 text-center shadow-md shadow-purple-950/10`}
                    >
                      <p className={`text-xl font-bold ${colorDeNota(item.valor).texto}`}>{item.valor}%</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5">
              <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                <ReactMarkdown>{introMarkdown}</ReactMarkdown>
                <ReactMarkdown>{formatoMarkdown}</ReactMarkdown>
                <ReactMarkdown>{logrosMarkdown}</ReactMarkdown>
                <ReactMarkdown>{palabrasClaveMarkdown}</ReactMarkdown>
                <ReactMarkdown>{cierreMarkdown}</ReactMarkdown>
              </div>
            </div>

            {cvReescritoMarkdown && (
              <div className="bg-gradient-to-br from-emerald-50 via-white to-[#f1f0ff] border border-emerald-200 rounded-2xl shadow-xl shadow-emerald-950/10 p-5 space-y-3">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">
                    {modoResultado === 'desde_cero'
                      ? '🧾 Tu primer CV, listo para adjuntar'
                      : '🧾 Tu CV optimizado, listo para adjuntar'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {modoResultado === 'desde_cero'
                      ? 'Es tu CV completo, armado con todo lo que nos contaste — revisalo acá abajo, completá los placeholders si quedó alguno, y descargalo.'
                      : 'Es tu CV completo, reescrito con todo lo de arriba ya aplicado — podés revisarlo acá abajo y descargarlo para mandarlo directo.'}
                  </p>
                </div>
                <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none max-h-96 overflow-y-auto bg-white/60 rounded-xl p-4 border border-emerald-100">
                  <ReactMarkdown>{cvReescritoMarkdown}</ReactMarkdown>
                </div>
                <button
                  onClick={handleDescargarCvReescrito}
                  disabled={descargandoCv}
                  className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-500 text-white py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {descargandoCv && <Spinner />}
                  {descargandoCv
                    ? 'Generando PDF...'
                    : modoResultado === 'desde_cero'
                      ? '📥 Descargar mi CV (PDF)'
                      : '📥 Descargar tu CV optimizado (PDF)'}
                </button>
              </div>
            )}

            <FeedbackInforme herramienta="cv" />

            <div className="flex gap-3">
              <button
                onClick={handleDescargarPdf}
                disabled={descargandoPdf}
                className="flex-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {descargandoPdf && <Spinner />}
                {descargandoPdf
                  ? 'Generando PDF...'
                  : modoResultado === 'desde_cero'
                    ? '📥 Descargar consejos en PDF'
                    : '📥 Descargar Informe en PDF'}
              </button>
              <button
                onClick={reiniciarTodo}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2.5 rounded-full font-medium text-sm transition-all active:scale-[0.99]"
              >
                {modoResultado === 'desde_cero' ? '🔄 Armar otro CV' : '🔄 Analizar otro CV'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
