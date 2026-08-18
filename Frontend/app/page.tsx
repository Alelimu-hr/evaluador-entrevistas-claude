'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { createClient } from '@/lib/supabase/client';
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

function colorDeNota(nota: number) {
  if (nota >= 7) return { texto: 'text-emerald-400', anillo: 'ring-emerald-500/30', bg: 'from-emerald-500/15' };
  if (nota >= 4) return { texto: 'text-amber-400', anillo: 'ring-amber-500/30', bg: 'from-amber-500/15' };
  return { texto: 'text-red-400', anillo: 'ring-red-500/30', bg: 'from-red-500/15' };
}

export default function Home() {
  // --- Formulario inicial ---
  const [apiKey, setApiKey] = useState('');
  const [estadoKey, setEstadoKey] = useState<EstadoKey>('vacio');
  const [rol, setRol] = useState('Desarrollador Fullstack');
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
        setEstadoKey(data.valido ? 'valida' : 'invalida');
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
        setPreguntas(data.preguntas);
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
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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
    formData.append('audio', blob, 'respuesta.webm');

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
    historial.forEach((h, i) => formData.append('audios', h.audioBlob, `respuesta_${i}.webm`));

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
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(37,99,235,0.16),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(239,68,68,0.08),transparent),#050811] text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
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

        {/* PASO 1: Formulario */}
        {paso === 'form' && (
          <form onSubmit={handleGenerarPreguntas} className="space-y-4 animate-fade-in-up">
            <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 shadow-lg shadow-black/20 transition-colors hover:border-slate-700">
              <div>
                <label className="block text-sm font-semibold text-slate-200">🔑 API Key de Gemini:</label>
                <p className="text-xs text-slate-400">Pega tu clave de Google AI Studio para probar.</p>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-xs text-blue-400 underline hover:text-blue-300 transition-colors"
                >
                  👉 Conseguí tu API Key gratuita acá
                </a>
                <p className="text-xs text-slate-500 mt-0.5">
                  Es 100% gratis y te lleva menos de 1 minuto generarla con tu cuenta de Google.
                </p>
              </div>
              <div className="relative w-72">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  required
                  className="w-full bg-[#050811] border border-slate-700 text-slate-100 pl-3 pr-9 py-2 rounded-lg transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  {estadoKey === 'verificando' && <Spinner className="text-slate-400" />}
                  {estadoKey === 'valida' && (
                    <span className="text-emerald-400 animate-scale-in" title="API Key válida">
                      🟢
                    </span>
                  )}
                  {estadoKey === 'invalida' && (
                    <span className="text-red-400 animate-scale-in" title="API Key inválida">
                      🔴
                    </span>
                  )}
                </span>
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

            <div className="bg-[#0b1329] border border-slate-800 p-5 rounded-xl space-y-4 shadow-lg shadow-black/20 transition-colors hover:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Puesto / Rol</label>
                  <input
                    type="text"
                    value={rol}
                    onChange={(e) => setRol(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Seniority</label>
                  <select
                    value={seniority}
                    onChange={(e) => setSeniority(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Junior">Junior</option>
                    <option value="Semi-Senior">Semi-Senior</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead / Tech Lead">Lead / Tech Lead</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Enfoque de la Entrevista</label>
                  <select
                    value={enfoque}
                    onChange={(e) => setEnfoque(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Mixta (Técnica + Conductual)">Mixta (Técnica + Conductual)</option>
                    <option value="Metodología STAR / Conductual">Metodología STAR / Conductual</option>
                    <option value="Técnica Estricta">Técnica Estricta</option>
                    <option value="Deep Dive: brechas entre el CV y la Job Description">
                      Deep Dive: CV vs. JD (buscar brechas)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Idioma de la Entrevista</label>
                  <select
                    value={idioma}
                    onChange={(e) => setIdioma(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Español">Español</option>
                    <option value="Inglés">Inglés</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Cantidad de Preguntas</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value))}
                  className="w-full bg-[#050811] border border-slate-700 text-slate-100 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Job Description (JD)</label>
                <textarea
                  rows={3}
                  placeholder="Pegá aquí las responsabilidades y requisitos de la vacante..."
                  value={jd}
                  onChange={(e) => setJd(e.target.value)}
                  className="w-full bg-[#050811] border border-slate-700 text-slate-100 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Adjuntar Curriculum Vitae (CV)</label>
                <input
                  type="file"
                  accept=".pdf,.txt,.docx"
                  onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={cargandoPreguntas}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {cargandoPreguntas && <Spinner />}
                {cargandoPreguntas ? 'Generando Cuestionario...' : 'Obtener Preguntas 🎯'}
              </button>
            </div>
          </form>
        )}

        {/* PASO 2: Pregunta activa, una por vez */}
        {paso === 'pregunta' && preguntas.length > 0 && (
          <div className="bg-[#0b1329] border border-slate-800 p-5 rounded-xl space-y-4 shadow-lg shadow-black/20 animate-fade-in-up">
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((preguntaIndex + 1) / preguntas.length) * 100}%` }}
              />
            </div>

            {/* key={preguntaIndex} para que la pregunta haga un fade sutil cada vez que avanza */}
            <div key={preguntaIndex} className="space-y-3 animate-fade-in-up">
              <span className="inline-block text-xs font-semibold text-blue-300 bg-blue-950/50 border border-blue-900 px-3 py-1 rounded-full">
                🤖 PREGUNTA {preguntaIndex + 1} DE {preguntas.length}
              </span>

              <p className="text-lg text-slate-100 font-medium">{preguntas[preguntaIndex]}</p>

              <div className="flex items-center gap-3 pt-2">
                {!grabando ? (
                  <button
                    onClick={iniciarGrabacion}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
                  >
                    🟢 Grabar Respuesta
                  </button>
                ) : (
                  <button
                    onClick={detenerGrabacion}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all animate-pulse-glow active:scale-[0.98]"
                  >
                    ⏹ Detener ({segundos}s)
                  </button>
                )}

                {audioUrl && <audio src={audioUrl} controls className="h-8 max-w-xs animate-fade-in" />}
              </div>

              {cargandoFeedback && (
                <p className="text-sm text-slate-400 flex items-center gap-2 animate-fade-in">
                  <Spinner /> Analizando ritmo, fluidez y tono emocional del audio...
                </p>
              )}

              {feedbackActual && !cargandoFeedback && (
                <div className="bg-emerald-950/30 border border-emerald-900 p-4 rounded-lg space-y-1 text-sm animate-scale-in">
                  <p className="font-semibold text-emerald-300">📊 Feedback de Oratoria y Tono Vocal:</p>
                  <p className="text-slate-300">
                    ⏱️ <b>Duración:</b> {feedbackActual.duracion_segundos} segs | 🗣️ <b>Velocidad:</b> ~
                    {feedbackActual.ppm} PPM | ⚡ <b>Ritmo:</b> {feedbackActual.evaluacion_ritmo}
                  </p>
                  <p className="text-slate-300">
                    🎭 <b>Tono Emocional Detectado:</b> {feedbackActual.tono_emocional}
                  </p>
                  <p className="text-slate-400 italic">💡 {feedbackActual.consejo_oratoria}</p>
                </div>
              )}

              {feedbackActual && !cargandoFeedback && (
                <button
                  onClick={handleGuardarYSiguiente}
                  className="w-full mt-2 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-lg font-medium text-sm transition-all hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.99] animate-fade-in-up"
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
            <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-6 rounded-2xl shadow-xl shadow-black/30 border border-slate-800">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🎙️ Simulador Pro de Entrevistas con IA
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Ya respondiste las {preguntas.length} preguntas. Generá tu evaluación completa con
                análisis STAR, gaps técnicos y respuestas modelo.
              </p>
            </div>
            <button
              onClick={handleGenerarInforme}
              disabled={cargandoInforme}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {cargandoInforme && <Spinner />}
              {cargandoInforme
                ? 'Analizando tus respuestas y generando el informe...'
                : '🚀 Generar Evaluación y Reporte de Métricas'}
            </button>
          </div>
        )}

        {/* PASO 4: Informe final */}
        {paso === 'informe' && (
          <div className="space-y-4 animate-fade-in-up">
            {notas && (
              <div
                className={`bg-gradient-to-br ${colorDeNota(notas.global).bg} to-transparent border border-slate-800 p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-black/30 animate-scale-in`}
              >
                <div>
                  <span className="text-slate-300 font-semibold block">Nota Global</span>
                  <span className="text-slate-500 text-xs">Resultado de tu simulación</span>
                </div>
                <span
                  className={`text-4xl font-extrabold ${colorDeNota(notas.global).texto} ring-4 ${
                    colorDeNota(notas.global).anillo
                  } rounded-full w-24 h-24 flex items-center justify-center`}
                >
                  {notas.global}
                </span>
              </div>
            )}

            <div className="bg-[#0b1329] border border-slate-800 p-5 rounded-xl shadow-lg shadow-black/20">
              <div className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none">
                <ReactMarkdown>{informeMarkdown}</ReactMarkdown>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDescargarPdf}
                disabled={descargandoPdf}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {descargandoPdf && <Spinner />}
                {descargandoPdf ? 'Generando PDF...' : '📥 Descargar Informe en PDF'}
              </button>
              <button
                onClick={reiniciarTodo}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg font-medium text-sm transition-all active:scale-[0.99]"
              >
                🔄 Hacer otra simulación
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
