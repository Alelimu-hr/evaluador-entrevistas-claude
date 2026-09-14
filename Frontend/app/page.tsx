'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { createClient } from '@/lib/supabase/client';
import { registrarEventoFunnel } from '@/lib/analytics';
import { Spinner } from '@/components/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type FeedbackOratoria = {
  transcripcion: string;
  palabras_aprox: number;
  ppm: number;
  evaluacion_ritmo: string;
  tono_emocional: string;
  consejo_oratoria: string;
  duracion_segundos: number;
};

type RespuestaGuardada = {
  pregunta: string;
  audioBlob: Blob;
  audioUrl: string;
  feedback: FeedbackOratoria;
};

type Notas = {
  global: number;
  tecnica: number;
  star: number;
  oratoria: number;
  tono: number;
};

type Paso = 'form' | 'pregunta' | 'resumen' | 'informe';

type EstadoKey = 'vacio' | 'verificando' | 'valida' | 'invalida';

// El navegador decide con qué formato graba (MediaRecorder), y eso varía
// mucho por dispositivo: en Android suele ser webm/opus, en iPhone (Safari,
// y Chrome/Firefox en iOS que usan el mismo motor) SIEMPRE es mp4/aac, nunca
// webm. Antes el código forzaba la etiqueta "audio/webm" sin importar el
// formato real, lo que rompía la reproducción y a veces el análisis en
// celular. Ahora usamos el mimeType real que reporta el MediaRecorder para
// nombrar el archivo con la extensión correcta.
function extensionDeMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  return 'webm';
}

// Opciones de "Enfoque de la Entrevista" del formulario inicial, con una
// descripción corta de qué evalúa cada una (para que quien no sabe qué
// significa "STAR" o "Deep Dive" pueda elegir con criterio).
const ENFOQUES: { value: string; label: string; descripcion: string }[] = [
  {
    value: 'Mixta (Técnica + Conductual)',
    label: 'Mixta',
    descripcion: 'Combina preguntas técnicas y de comportamiento — ideal para una práctica general y equilibrada.',
  },
  {
    value: 'Metodología STAR / Conductual',
    label: 'STAR / Conductual',
    descripcion:
      'Preguntas sobre situaciones que ya viviste (Situación, Tarea, Acción, Resultado) — practica cómo contás tus logros y decisiones.',
  },
  {
    value: 'Técnica Estricta',
    label: 'Técnica Estricta',
    descripcion: 'Preguntas centradas en conocimientos y habilidades específicas del rol.',
  },
  {
    value: 'Deep Dive: brechas entre el CV y la Job Description',
    label: 'Deep Dive: CV vs. JD',
    descripcion:
      'Preguntas enfocadas en las diferencias entre tu CV y la descripción del puesto — te prepara para justificar esos gaps.',
  },
];

function colorDeNota(nota: number) {
  if (nota >= 7) return { texto: 'text-emerald-600', anillo: 'ring-emerald-300', borde: 'border-emerald-200' };
  if (nota >= 4) return { texto: 'text-amber-600', anillo: 'ring-amber-300', borde: 'border-amber-200' };
  return { texto: 'text-red-600', anillo: 'ring-red-300', borde: 'border-red-200' };
}

// El informe final que devuelve Gemini viene con una estructura fija de
// títulos numerados (ver el prompt de /api/informe-final en el backend). En
// vez de mostrar todo ese texto larguísimo de un tirón, lo partimos acá en
// "módulos" navegables por pestaña, buscando esos títulos por palabra clave
// (así no dependemos de que Gemini use exactamente el mismo formato de
// markdown/numeración cada vez).
const SECCIONES_INFORME_DEF: { key: string; label: string; match: RegExp }[] = [
  { key: 'notas', label: '🎯 Notas', match: /DESGLOSE DE NOTAS/i },
  { key: 'tiempo', label: '⏱️ Tiempo y Ritmo', match: /TIEMPO.{0,15}RITMO|RITMO POR RESPUESTA/i },
  { key: 'gap', label: '💡 Gap Técnico', match: /EVALUACI[ÓO]N T[ÉE]CNICA/i },
  { key: 'star', label: '🌟 Metodología STAR', match: /METODOLOG[ÍI]A\s+S\.?\s*T\.?\s*A\.?\s*R\.?/i },
  { key: 'tono', label: '🎭 Tono y Emoción', match: /EMOCIONALIDAD Y TONO/i },
  { key: 'consejos', label: '🚀 Consejos Clave', match: /CONSEJOS CLAVE/i },
  { key: 'respuestas', label: '📌 Respuestas Modelo', match: /RESPUESTAS MODELO/i },
];

function parsearInformeEnSecciones(md: string) {
  const lineas = md.split('\n');
  const indices = SECCIONES_INFORME_DEF.map((def) => lineas.findIndex((l) => def.match.test(l)));

  const secciones: { key: string; label: string; contenido: string }[] = [];
  indices.forEach((inicio, i) => {
    if (inicio === -1) return; // Gemini no incluyó esta sección: la salteamos sin romper nada
    let fin = lineas.length;
    for (let j = i + 1; j < indices.length; j++) {
      if (indices[j] !== -1) {
        fin = indices[j];
        break;
      }
    }
    secciones.push({
      key: SECCIONES_INFORME_DEF[i].key,
      label: SECCIONES_INFORME_DEF[i].label,
      contenido: lineas.slice(inicio, fin).join('\n').trim(),
    });
  });

  const primerIndice = indices.find((i) => i !== -1);
  const intro = primerIndice !== undefined && primerIndice > 0 ? lineas.slice(0, primerIndice).join('\n').trim() : '';

  return { intro, secciones };
}

export default function Home() {
  // --- Formulario inicial ---
  const [apiKey, setApiKey] = useState('');
  const [estadoKey, setEstadoKey] = useState<EstadoKey>('vacio');
  const [rol, setRol] = useState('');
  const [seniority, setSeniority] = useState('Semi-Senior');
  const [enfoque, setEnfoque] = useState('Mixta (Técnica + Conductual)');
  const [idioma, setIdioma] = useState('Español');
  const [cantidad, setCantidad] = useState(3);
  const [jd, setJd] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cargandoPreguntas, setCargandoPreguntas] = useState(false);

  // --- Flujo de la simulación ---
  const [paso, setPaso] = useState<Paso>('form');
  const [preguntas, setPreguntas] = useState<string[]>([]);
  // Preguntas "de repuesto" pedidas en la misma llamada que las principales
  // (ver /api/generar-pregunta en el backend). Se usan para el botón
  // "Cambiar pregunta" sin gastar cuota extra de Gemini.
  const [preguntasReserva, setPreguntasReserva] = useState<string[]>([]);
  const [preguntaIndex, setPreguntaIndex] = useState(0);
  const [historial, setHistorial] = useState<RespuestaGuardada[]>([]);

  // --- Grabación de la pregunta activa ---
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cargandoFeedback, setCargandoFeedback] = useState(false);
  const [feedbackActual, setFeedbackActual] = useState<FeedbackOratoria | null>(null);

  // --- Informe final ---
  const [cargandoInforme, setCargandoInforme] = useState(false);
  const [informeMarkdown, setInformeMarkdown] = useState('');
  const [notas, setNotas] = useState<Notas | null>(null);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  // --- Sesión de usuario (Supabase) ---
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, []);

  // Primer escalón del embudo: entró logueado a la pantalla. Una vez por
  // carga de página (si recarga o vuelve a entrar, cuenta de nuevo — se
  // dedupea con COUNT DISTINCT al analizar, ver lib/analytics.ts).
  useEffect(() => {
    registrarEventoFunnel('entrevista', 'formulario_visto');
  }, []);

  const handleCerrarSesion = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  useEffect(() => {
    let intervalo: NodeJS.Timeout;
    if (grabando) {
      intervalo = setInterval(() => setSegundos((s) => s + 1), 1000);
    } else {
      setSegundos(0);
    }
    return () => clearInterval(intervalo);
  }, [grabando]);

  // Valida la API Key contra el backend medio segundo después de que el
  // usuario deja de tipear, sin gastar cuota de generación de Gemini.
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
        if (valido) registrarEventoFunnel('entrevista', 'api_key_valida'); // 2do escalón
      } catch {
        setEstadoKey('invalida');
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  useEffect(() => {
    if (paso === 'informe') {
      const duracion = 2200;
      const fin = Date.now() + duracion;
      const disparar = () => {
        confetti({ particleCount: 60, spread: 90, origin: { x: Math.random(), y: 0.2 } });
        if (Date.now() < fin) requestAnimationFrame(disparar);
      };
      disparar();
    }
  }, [paso]);

  const reiniciarTodo = () => {
    setPaso('form');
    setPreguntas([]);
    setPreguntasReserva([]);
    setPreguntaIndex(0);
    setHistorial([]);
    setAudioBlob(null);
    setAudioUrl(null);
    setFeedbackActual(null);
    setInformeMarkdown('');
    setNotas(null);
  };

  const handleGenerarPreguntas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return alert('Pega tu clave de Google AI Studio para probar.');

    setCargandoPreguntas(true);
    registrarEventoFunnel('entrevista', 'envio_formulario'); // 3er escalón

    const formData = new FormData();
    formData.append('rol', rol);
    formData.append('seniority', seniority);
    formData.append('enfoque', enfoque);
    formData.append('cantidad_preguntas', cantidad.toString());
    formData.append('idioma', idioma);
    formData.append('jd', jd);
    if (cvFile) formData.append('cv', cvFile);

    try {
      const res = await fetch(`${API_URL}/api/generar-pregunta`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.preguntas?.length > 0) {
        // El backend manda "cantidad" preguntas + una reserva chica al
        // final (mismo request, sin gasto extra de cuota). Separamos acá:
        // las primeras "cantidad" son las que se usan, el resto queda
        // guardado para el botón "Cambiar pregunta".
        setPreguntas(data.preguntas.slice(0, cantidad));
        setPreguntasReserva(data.preguntas.slice(cantidad));
        setPreguntaIndex(0);
        setHistorial([]);
        setPaso('pregunta');
      } else {
        alert(data.detail || 'Error al generar preguntas.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el backend. ¿Está corriendo en ' + API_URL + '?');
    } finally {
      setCargandoPreguntas(false);
    }
  };

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Le pedimos al navegador el mejor formato que sepa grabar de esta
      // lista (en vez de asumir siempre webm, que en iPhone ni existe).
      const TIPOS_AUDIO_PREFERIDOS = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus',
      ];
      const tipoSoportado =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
          ? TIPOS_AUDIO_PREFERIDOS.find((t) => MediaRecorder.isTypeSupported(t))
          : undefined;

      const mediaRecorder = tipoSoportado
        ? new MediaRecorder(stream, { mimeType: tipoSoportado })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        // Usamos el mimeType que el propio MediaRecorder reporta como
        // realmente usado (no el que pedimos): así el Blob queda etiquetado
        // con el formato de verdad, y el <audio> lo puede reproducir en
        // cualquier dispositivo.
        const tipoReal = mediaRecorder.mimeType || tipoSoportado || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: tipoReal });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        analizarOratoria(blob);
      };

      mediaRecorder.start();
      setGrabando(true);
      setFeedbackActual(null);
    } catch {
      alert('No se pudo acceder al micrófono.');
    }
  };

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop();
      setGrabando(false);
    }
  };

  const analizarOratoria = async (blob: Blob) => {
    setCargandoFeedback(true);
    const formData = new FormData();
    formData.append('pregunta', preguntas[preguntaIndex]);
    formData.append('idioma', idioma);
    formData.append('audio', blob, `respuesta.${extensionDeMime(blob.type)}`);

    try {
      const res = await fetch(`${API_URL}/api/evaluar-respuesta`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackActual(data);
      } else {
        alert(data.detail || 'Error al analizar la respuesta.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el backend.');
    } finally {
      setCargandoFeedback(false);
    }
  };

  const handleCambiarPregunta = () => {
    if (preguntasReserva.length === 0) return;
    const [siguiente, ...resto] = preguntasReserva;
    setPreguntas((prev) => {
      const copia = [...prev];
      copia[preguntaIndex] = siguiente;
      return copia;
    });
    setPreguntasReserva(resto);
  };

  const handleGuardarYSiguiente = () => {
    if (!audioBlob || !audioUrl || !feedbackActual) return;

    setHistorial((prev) => [
      ...prev,
      { pregunta: preguntas[preguntaIndex], audioBlob, audioUrl, feedback: feedbackActual },
    ]);

    setAudioBlob(null);
    setAudioUrl(null);
    setFeedbackActual(null);

    if (preguntaIndex + 1 < preguntas.length) {
      setPreguntaIndex((i) => i + 1);
    } else {
      setPaso('resumen');
    }
  };

  const handleGenerarInforme = async () => {
    setCargandoInforme(true);
    const formData = new FormData();
    formData.append('rol', rol);
    formData.append('seniority', seniority);
    formData.append('idioma', idioma);
    formData.append('jd', jd);
    formData.append(
      'preguntas_meta',
      JSON.stringify(
        historial.map((h) => ({
          pregunta: h.pregunta,
          duracion: h.feedback.duracion_segundos,
          ppm: h.feedback.ppm,
          tono_emocional: h.feedback.tono_emocional,
        }))
      )
    );
    historial.forEach((h, i) =>
      formData.append('audios', h.audioBlob, `respuesta_${i}.${extensionDeMime(h.audioBlob.type)}`)
    );

    try {
      const res = await fetch(`${API_URL}/api/informe-final`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setInformeMarkdown(data.informe_markdown || '');
        setNotas(data.notas || null);
        setPaso('informe');
        guardarEnProgreso(data.notas || null, data.informe_markdown || '');
        registrarEventoFunnel('entrevista', 'completado_exito'); // 4to escalón
      } else {
        alert(data.detail || 'Error al generar el informe.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión con el backend.');
    } finally {
      setCargandoInforme(false);
    }
  };

  // Guarda la simulación completa en Supabase para que aparezca en "Mi Progreso".
  // Si falla (sin conexión, sesión vencida, etc.) no interrumpe al usuario: el
  // informe ya se generó y se ve igual, solo no queda guardado en el historial.
  const guardarEnProgreso = async (notasGuardadas: Notas | null, informe: string) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('simulaciones').insert({
        user_id: user.id,
        rol,
        seniority,
        enfoque,
        idioma,
        cantidad_preguntas: preguntas.length,
        nota_global: notasGuardadas?.global ?? null,
        nota_tecnica: notasGuardadas?.tecnica ?? null,
        nota_star: notasGuardadas?.star ?? null,
        nota_oratoria: notasGuardadas?.oratoria ?? null,
        nota_tono: notasGuardadas?.tono ?? null,
        informe_markdown: informe,
      });
    } catch (err) {
      console.error('No se pudo guardar la simulación en el progreso:', err);
    }
  };

  const handleDescargarPdf = async () => {
    setDescargandoPdf(true);
    const formData = new FormData();
    formData.append('informe_markdown', informeMarkdown);
    formData.append('rol', rol);

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
      a.download = `Reporte_Entrevista_${rol}.pdf`;
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

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🎙 Simulador de Entrevistas
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

        {paso === 'form' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in-up">
            <div className="relative overflow-hidden text-left p-4 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Estás acá
              </span>
              <p className="text-2xl">🎙️</p>
              <p className="font-semibold text-white text-sm mt-1.5">Practicá tu entrevista</p>
              <p className="text-xs text-white/80 mt-0.5">Simulá una entrevista real y recibí feedback con IA.</p>
            </div>
            <Link
              href="/linkedin"
              className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl">💼</p>
              <p className="font-semibold text-slate-800 text-sm mt-1.5">Mejorá tu perfil de LinkedIn</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Optimizá tu perfil para que los reclutadores te encuentren primero.
              </p>
            </Link>
          </div>
        )}

        {paso === 'form' && (
          <div className="text-center pt-2 pb-2 animate-fade-in-up">
            <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
              Práctica de entrevistas con IA
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
              Preparate para tu próxima entrevista
            </h2>
            <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
              Preguntas personalizadas a tu rol y tu CV, feedback de oratoria en cada respuesta, y un informe final
              con tu diagnóstico completo.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full mt-4">
              🌎 Gratis y para cualquier rol o industria — no hace falta que sea un puesto técnico.
            </p>
          </div>
        )}

        {/* PASO 1: Formulario */}
        {paso === 'form' && (
          <form onSubmit={handleGenerarPreguntas} className="space-y-4 animate-fade-in-up">
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

                  <ol className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      'Entrá con tu cuenta de Google.',
                      'Arriba de la página, hacé clic en "Crear clave de API".',
                      'Esperá unos segundos: se abre tu clave, lista para copiar.',
                    ].map((paso, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-slate-500">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        {paso}
                      </li>
                    ))}
                  </ol>
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

            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Puesto / Rol</label>
                  <input
                    type="text"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    placeholder="Ej: Analista de Marketing, Vendedor, Líder de Legales, Desarrollador..."
                    className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Seniority</label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full bg-white border border-purple-200 text-slate-800 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Semi-Senior">Semi-Senior</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead / Tech Lead">Lead / Tech Lead</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">Enfoque de la Entrevista</label>
                  <p className="text-xs text-slate-500 mb-2">Elegí una y leé de qué se trata antes de arrancar 👇</p>
                  <div className="flex flex-wrap gap-1.5 bg-slate-100 border border-slate-300 rounded-2xl p-1.5">
                    {ENFOQUES.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => setEnfoque(opt.value)}
                        className={`px-3 py-1.5 text-xs sm:text-sm rounded-full whitespace-nowrap transition-all ${
                          enfoque === opt.value
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow'
                            : 'text-slate-600 hover:text-slate-800 hover:bg-white/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {ENFOQUES.find((o) => o.value === enfoque)?.descripcion}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Idioma</label>
                  <div className="flex bg-slate-100 border border-slate-300 rounded-full p-1.5 gap-1">
                    {['Español', 'Inglés'].map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setIdioma(opt)}
                        className={`px-4 py-1.5 text-sm rounded-full transition-all ${
                          idioma === opt
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow'
                            : 'text-slate-600 hover:text-slate-800'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Cantidad de Preguntas</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  className="w-full bg-white border border-purple-200 text-slate-800 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Descripción del puesto</label>
                <p className="text-xs text-slate-500 mb-1.5">
                  Pegá la descripción del puesto para el que vas a tener la entrevista, si la tenés — así las
                  preguntas se ajustan mejor a ese rol.
                </p>
                <textarea
                  rows={3}
                  placeholder="Pegá aquí las responsabilidades y requisitos de la vacante..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Adjuntar Curriculum Vitae (CV)</label>
                <p className="text-xs text-slate-500 mb-1.5">
                  Adjuntá tu CV para que la app pueda leerlo y hacer preguntas orientadas a tu experiencia real
                  (PDF, TXT o DOCX). Es opcional, pero mejora mucho la práctica.
                </p>
                <input
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={cargandoPreguntas}
                className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white font-semibold py-3 rounded-full transition-all duration-200 disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {cargandoPreguntas && <Spinner />}
                {cargandoPreguntas ? 'Generando Cuestionario...' : 'Obtener Preguntas 🎯'}
              </button>
            </div>
          </form>
        )}

        {/* PASO 2: Pregunta activa, una por vez */}
        {paso === 'pregunta' && preguntas.length > 0 && (
          <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 animate-fade-in-up">
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((preguntaIndex + 1) / preguntas.length) * 100}%` }}
              />
            </div>

            {/* key={preguntaIndex} para que la pregunta haga un fade sutil cada vez que avanza */}
            <div key={preguntaIndex} className="space-y-3 animate-fade-in-up">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-block text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
                  🤖 PREGUNTA {preguntaIndex + 1} DE {preguntas.length}
                </span>

                {!grabando && !audioBlob && preguntasReserva.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCambiarPregunta}
                    title="¿Muy técnica o muy específica? Probá con otra."
                    className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 hover:bg-indigo-50 px-3 py-1 rounded-full transition-all"
                  >
                    🔄 Cambiar pregunta
                  </button>
                )}
              </div>

              <p className="text-lg text-slate-800 font-medium">{preguntas[preguntaIndex]}</p>

              <div className="flex items-center gap-3 pt-2">
                {!grabando ? (
                  <button
                    onClick={iniciarGrabacion}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow hover:shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]"
                  >
                    🟢 Grabar Respuesta
                  </button>
                ) : (
                  <button
                    onClick={detenerGrabacion}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-all animate-pulse-glow active:scale-[0.98]"
                  >
                    ⏹ Detener ({segundos}s)
                  </button>
                )}

                {audioUrl && <audio src={audioUrl} controls className="h-8 max-w-xs animate-fade-in" />}
              </div>

              {cargandoFeedback && (
                <div className="space-y-1 animate-fade-in">
                  <p className="text-sm text-slate-500 flex items-center gap-2">
                    <Spinner /> Analizando ritmo, fluidez y tono emocional del audio...
                  </p>
                  <p className="text-xs text-amber-600">
                    📱 No cambies de app ni bloquees la pantalla hasta que termine — si estás en el celular, podés
                    perder el resultado.
                  </p>
                </div>
              )}

              {feedbackActual && !cargandoFeedback && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-1 text-sm animate-scale-in">
                  <p className="font-semibold text-emerald-700">📊 Feedback de Oratoria y Tono Vocal:</p>
                  <p className="text-slate-700">
                    ⏱️ <b>Duración:</b> {feedbackActual.duracion_segundos} segs | 🗣️ <b>Velocidad:</b> ~
                    {feedbackActual.ppm} PPM | ⚡ <b>Ritmo:</b> {feedbackActual.evaluacion_ritmo}
                  </p>
                  <p className="text-slate-700">
                    🎭 <b>Tono Emocional Detectado:</b> {feedbackActual.tono_emocional}
                  </p>
                  <p className="text-slate-500 italic">💡 {feedbackActual.consejo_oratoria}</p>
                </div>
              )}

              {feedbackActual && !cargandoFeedback && (
                <button
                  onClick={handleGuardarYSiguiente}
                  className="w-full mt-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-2.5 rounded-full font-medium text-sm transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] animate-fade-in-up"
                >
                  ➡️ Guardar Respuesta y Siguiente
                </button>
              )}
            </div>
          </div>
        )}

        {/* PASO 3: Pantalla previa al informe */}
        {paso === 'resumen' && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] p-6 rounded-2xl shadow-xl shadow-purple-950/30 border border-white/60">
              <h2 className="font-display text-2xl font-semibold text-slate-800 flex items-center gap-2">
                🎙️ Simulador Pro de Entrevistas con IA
              </h2>
              <p className="text-slate-600 text-sm mt-1">
                Ya respondiste las {preguntas.length} preguntas. Generá tu evaluación completa con
                análisis STAR, gaps técnicos y respuestas modelo.
              </p>
            </div>
            <button
              onClick={handleGenerarInforme}
              disabled={cargandoInforme}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white font-semibold py-3 rounded-full transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {cargandoInforme && <Spinner />}
              {cargandoInforme
                ? 'Analizando tus respuestas y generando el informe...'
                : '🚀 Generar Evaluación y Reporte de Métricas'}
            </button>
            {cargandoInforme && (
              <p className="text-xs text-amber-300 text-center -mt-2 animate-fade-in">
                📱 Este paso puede tardar un poco, sobre todo en celular — no cambies de app ni bloquees la
                pantalla hasta que termine.
              </p>
            )}
          </div>
        )}

        {/* PASO 4: Informe final */}
        {paso === 'informe' && (() => {
          const { intro, secciones } = parsearInformeEnSecciones(informeMarkdown);
          const seccionNotas = secciones.find((s) => s.key === 'notas');
          const otrasSecciones = secciones.filter((s) => s.key !== 'notas');

          // Si Gemini no siguió la estructura esperada (0 secciones detectadas),
          // no partimos nada: mostramos el markdown completo como antes, para
          // no perder información por un parseo que no encontró match.
          const huboParseo = secciones.length > 0;
          const tabs = huboParseo
            ? [
                {
                  key: 'resumen',
                  label: '📊 Resumen',
                  contenido: [intro, seccionNotas?.contenido].filter(Boolean).join('\n\n'),
                },
                ...otrasSecciones,
              ]
            : [{ key: 'todo', label: '📄 Informe', contenido: informeMarkdown }];

          const irASeccion = (key: string) => {
            document.getElementById(`informe-seccion-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };

          return (
            <div className="space-y-4 animate-fade-in-up">
              {notas && (
                <div className="space-y-3">
                  <div
                    className={`bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border ${
                      colorDeNota(notas.global).borde
                    } p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-purple-950/30 animate-scale-in`}
                  >
                    <div>
                      <span className="text-slate-800 font-semibold block">Nota Global</span>
                      <span className="text-slate-500 text-xs">Resultado de tu simulación</span>
                    </div>
                    <span
                      className={`text-4xl font-extrabold ${colorDeNota(notas.global).texto} ring-4 ${
                        colorDeNota(notas.global).anillo
                      } bg-white rounded-full w-24 h-24 flex items-center justify-center`}
                    >
                      {notas.global}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { label: 'Técnica', valor: notas.tecnica },
                      { label: 'STAR', valor: notas.star },
                      { label: 'Oratoria', valor: notas.oratoria },
                      { label: 'Tono', valor: notas.tono },
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

              {tabs.length > 1 && (
                <div className="sticky top-2 z-10 flex flex-wrap gap-1.5 bg-white/90 backdrop-blur border border-white/60 rounded-2xl shadow-lg shadow-purple-950/20 p-2.5">
                  {tabs.map((tab) => (
                    <button
                      type="button"
                      key={tab.key}
                      onClick={() => irASeccion(tab.key)}
                      className="px-3 py-1.5 text-xs sm:text-sm rounded-full whitespace-nowrap transition-all text-slate-600 hover:text-white hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:shadow"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5 space-y-6">
                {tabs.map((tab) => (
                  <div key={tab.key} id={`informe-seccion-${tab.key}`} className="scroll-mt-20">
                    <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                      <ReactMarkdown>{tab.contenido}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>

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
                🔄 Hacer otra simulación
              </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
