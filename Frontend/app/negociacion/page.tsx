'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { createClient } from '@/lib/supabase/client';
import { registrarEventoFunnel } from '@/lib/analytics';
import { Spinner } from '@/components/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type EstadoKey = 'vacio' | 'verificando' | 'valida' | 'invalida';

function colorDeNota(nota: number) {
  if (nota >= 7) return { texto: 'text-emerald-600', anillo: 'ring-emerald-300', borde: 'border-emerald-200' };
  if (nota >= 4) return { texto: 'text-amber-600', anillo: 'ring-amber-300', borde: 'border-amber-200' };
  return { texto: 'text-red-600', anillo: 'ring-red-300', borde: 'border-red-200' };
}

export default function NegociacionPage() {
  const [apiKey, setApiKey] = useState('');
  const [estadoKey, setEstadoKey] = useState<EstadoKey>('vacio');
  const [ofertaRecibida, setOfertaRecibida] = useState('');
  const [situacionActual, setSituacionActual] = useState('');
  const [prioridades, setPrioridades] = useState('');
  const [idioma, setIdioma] = useState('Español');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const [posicion, setPosicion] = useState<number | null>(null);
  // Mismo patrón que las otras herramientas: el backend devuelve el informe
  // ya partido en estos 6 campos de markdown independientes, en vez de un
  // solo bloque gigante (ver Backend/main.py, plan_negociacion).
  const [informeMarkdown, setInformeMarkdown] = useState(''); // versión completa, solo para el PDF
  const [introMarkdown, setIntroMarkdown] = useState('');
  const [analisisMarkdown, setAnalisisMarkdown] = useState('');
  const [argumentosMarkdown, setArgumentosMarkdown] = useState('');
  const [guionMarkdown, setGuionMarkdown] = useState('');
  const [objecionesMarkdown, setObjecionesMarkdown] = useState('');
  const [cierreMarkdown, setCierreMarkdown] = useState('');

  // Primer escalón del embudo: entró logueado a la pantalla.
  useEffect(() => {
    registrarEventoFunnel('negociacion', 'formulario_visto');
  }, []);

  // Misma validación de API Key que las otras herramientas.
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
        if (valido) registrarEventoFunnel('negociacion', 'api_key_valida'); // 2do escalón
      } catch {
        setEstadoKey('invalida');
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  const reiniciarTodo = () => {
    setPosicion(null);
    setInformeMarkdown('');
    setIntroMarkdown('');
    setAnalisisMarkdown('');
    setArgumentosMarkdown('');
    setGuionMarkdown('');
    setObjecionesMarkdown('');
    setCierreMarkdown('');
    setError('');
  };

  // Registra el plan generado para ver uso/adopción, igual que en CV/LinkedIn/
  // Guía de carrera. Nunca bloquea ni rompe la UI si falla.
  const guardarPlanEnSupabase = async (posicionResultado: number | null) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('planes_negociacion').insert({
        user_id: user.id,
        puntaje_posicion: posicionResultado,
      });
    } catch (err) {
      console.error('No se pudo guardar el plan de negociación en el historial:', err);
    }
  };

  const handleGenerarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) return alert('Pegá tu clave de Google AI Studio para probar.');
    if (!ofertaRecibida.trim()) return alert('Contanos los detalles de la oferta que recibiste.');
    if (!situacionActual.trim()) return alert('Contanos tu situación actual.');

    setCargando(true);
    setError('');
    registrarEventoFunnel('negociacion', 'envio_formulario'); // 3er escalón

    const formData = new FormData();
    formData.append('oferta_recibida', ofertaRecibida);
    formData.append('situacion_actual', situacionActual);
    if (prioridades.trim()) formData.append('prioridades', prioridades);
    formData.append('idioma', idioma);

    try {
      const res = await fetch(`${API_URL}/api/plan-negociacion`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo generar el plan.');
      }
      setPosicion(data.puntajes?.posicion ?? null);
      setInformeMarkdown(data.informe_markdown || '');
      setIntroMarkdown(data.intro_markdown || '');
      setAnalisisMarkdown(data.analisis_markdown || '');
      setArgumentosMarkdown(data.argumentos_markdown || '');
      setGuionMarkdown(data.guion_markdown || '');
      setObjecionesMarkdown(data.objeciones_markdown || '');
      setCierreMarkdown(data.cierre_markdown || '');
      guardarPlanEnSupabase(data.puntajes?.posicion ?? null);
      registrarEventoFunnel('negociacion', 'completado_exito'); // 4to escalón
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargando(false);
    }
  };

  const handleDescargarPdf = async () => {
    setDescargandoPdf(true);
    const formData = new FormData();
    formData.append('informe_markdown', informeMarkdown);
    formData.append('titulo', 'Tu plan de negociación');
    formData.append('nombre_archivo', 'Plan_de_Negociacion');

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
      a.download = 'Plan_de_Negociacion.pdf';
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

  const hayResultado = !!informeMarkdown;

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            💬 Negociá tu oferta
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              🏠 Inicio
            </Link>
            <Link href="/simulador" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador de Entrevistas
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
            <Link
              href="/simulador"
              className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl">🎙️</p>
              <p className="font-semibold text-slate-800 text-sm mt-1.5">Practicá tu entrevista</p>
              <p className="text-xs text-slate-500 mt-0.5">Simulá una entrevista real y recibí feedback con IA.</p>
            </Link>
            <div className="relative overflow-hidden text-left p-4 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Estás acá
              </span>
              <p className="text-2xl">💬</p>
              <p className="font-semibold text-white text-sm mt-1.5">Negociá tu oferta</p>
              <p className="text-xs text-white/80 mt-0.5">Plan concreto para negociar sueldo y condiciones.</p>
            </div>
          </div>
        )}

        {!hayResultado && (
          <div className="text-center pt-2 pb-2 animate-fade-in-up">
            <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
              Negociación con IA
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
              ¿Vas a aceptar la primera oferta así nomás?
            </h2>
            <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
              Contanos la oferta que te hicieron y tu situación actual: te devolvemos un plan concreto con
              qué pedir, frases listas para usar, y cómo responder a las objeciones más comunes.
            </p>
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 border border-white/10 px-3 py-1 rounded-full mt-4">
              🌎 Gratis y para cualquier rol o industria.
            </p>
          </div>
        )}

        {!hayResultado && (
          <form onSubmit={handleGenerarPlan} className="space-y-4 animate-fade-in-up">
            {/* API Key */}
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl shadow-xl shadow-purple-950/30 transition-colors">
              <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 bg-purple-200/40 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-10 w-48 h-48 bg-blue-200/40 rounded-full blur-3xl" />

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  🔑 API Key de Gemini:{' '}
                  <span className="text-xs font-normal text-slate-400">— así conectás con la IA que arma el plan</span>
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

            {/* Oferta + situación + prioridades + idioma */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Contanos la oferta que recibiste
                </label>
                <textarea
                  rows={4}
                  value={ofertaRecibida}
                  onChange={(e) => setOfertaRecibida(e.target.value)}
                  placeholder="Sueldo ofrecido, beneficios, cualquier detalle que tengas — cuanto más completo, mejor el plan."
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Tu situación actual</label>
                <textarea
                  rows={4}
                  value={situacionActual}
                  onChange={(e) => setSituacionActual(e.target.value)}
                  placeholder="Sueldo actual (o tu situación si no tenés trabajo hoy), años de experiencia, y cualquier otra oferta o alternativa real que tengas — es tu principal poder de negociación."
                  className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    ¿Qué te importa además del sueldo?{' '}
                    <span className="text-xs font-normal text-slate-400">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={prioridades}
                    onChange={(e) => setPrioridades(e.target.value)}
                    placeholder="Ej: home office, flexibilidad horaria, crecimiento, beneficios."
                    className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                  />
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
            </div>

            {error && <p className="text-xs text-red-400 px-1 animate-fade-in">{error}</p>}

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {cargando && <Spinner />}
              {cargando ? 'Armando tu plan...' : '💬 Armar mi plan de negociación'}
            </button>
          </form>
        )}

        {/* Resultado */}
        {hayResultado && (
          <div className="space-y-4 animate-fade-in-up">
            {posicion !== null && (
              <div
                className={`bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border ${
                  colorDeNota(posicion).borde
                } p-6 rounded-2xl flex items-center justify-between shadow-xl shadow-purple-950/30 animate-scale-in`}
              >
                <div>
                  <span className="text-slate-800 font-semibold block">Tu posición negociadora</span>
                  <span className="text-slate-500 text-xs">Qué tan fuerte está hoy</span>
                </div>
                <span
                  className={`text-4xl font-extrabold ${colorDeNota(posicion).texto} ring-4 ${
                    colorDeNota(posicion).anillo
                  } bg-white rounded-full w-24 h-24 flex items-center justify-center`}
                >
                  {posicion}
                </span>
              </div>
            )}

            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5">
              <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                <ReactMarkdown>{introMarkdown}</ReactMarkdown>
                <ReactMarkdown>{analisisMarkdown}</ReactMarkdown>
                <ReactMarkdown>{argumentosMarkdown}</ReactMarkdown>
                <ReactMarkdown>{guionMarkdown}</ReactMarkdown>
                <ReactMarkdown>{objecionesMarkdown}</ReactMarkdown>
                <ReactMarkdown>{cierreMarkdown}</ReactMarkdown>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDescargarPdf}
                disabled={descargandoPdf}
                className="flex-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-2.5 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {descargandoPdf && <Spinner />}
                {descargandoPdf ? 'Generando PDF...' : '📥 Descargar Plan en PDF'}
              </button>
              <button
                onClick={reiniciarTodo}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20 py-2.5 rounded-full font-medium text-sm transition-all active:scale-[0.99]"
              >
                🔄 Armar otro plan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
