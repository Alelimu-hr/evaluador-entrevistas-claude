'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { AREAS_CARRERA, LENGUAJES_PROGRAMACION, type RolCarrera } from '@/lib/contenidoCarrera';
import { createClient } from '@/lib/supabase/client';
import { registrarEventoFunnel } from '@/lib/analytics';
import { Spinner } from '@/components/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// La navegación de áreas/roles (todo lo de más arriba en este archivo) es
// puro contenido estático, sin API key ni IA, así que a propósito NO
// trackea funnel. La sección de abajo ("¿Cómo entro a este rol?") es la
// capa de IA personalizada que sí usa Gemini — esa parte sí trackea funnel
// con la herramienta 'plan_carrera' (ver Frontend/lib/analytics.ts).

const ROL_DEV = 'Desarrollo (Dev)';

type EstadoKey = 'vacio' | 'verificando' | 'valida' | 'invalida';

export default function GuiaCarreraPage() {
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [rol, setRol] = useState<RolCarrera | null>(null);

  // --- Estado de la capa de IA ("¿Cómo entro a este rol?") ---
  const [apiKey, setApiKey] = useState('');
  const [estadoKey, setEstadoKey] = useState<EstadoKey>('vacio');
  const [situacionActual, setSituacionActual] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [idioma, setIdioma] = useState('Español');
  const [cargandoPlan, setCargandoPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState('');
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const [preparacion, setPreparacion] = useState<number | null>(null);
  // Mismo patrón que CV y LinkedIn: el backend devuelve el informe ya
  // partido en estos 5 campos de markdown independientes (ver
  // Backend/main.py, plan_transicion_carrera).
  const [informeMarkdown, setInformeMarkdown] = useState(''); // versión completa, solo para el PDF
  const [introMarkdown, setIntroMarkdown] = useState('');
  const [brechaMarkdown, setBrechaMarkdown] = useState('');
  const [planMarkdown, setPlanMarkdown] = useState('');
  const [portfolioMarkdown, setPortfolioMarkdown] = useState('');
  const [cierreMarkdown, setCierreMarkdown] = useState('');

  const area = areaSlug ? AREAS_CARRERA.find((a) => a.slug === areaSlug) ?? null : null;
  const esDev = rol?.nombre === ROL_DEV;
  const hayPlan = !!informeMarkdown;

  // Limpia solo el RESULTADO del plan (no la API Key, ni lo que la persona
  // ya escribió sobre su situación) — así si explora varios roles no tiene
  // que volver a pegar su situación actual cada vez, pero tampoco se le queda
  // pegado el plan de un rol anterior mezclado con el de uno nuevo.
  const limpiarResultadoPlan = () => {
    setPreparacion(null);
    setInformeMarkdown('');
    setIntroMarkdown('');
    setBrechaMarkdown('');
    setPlanMarkdown('');
    setPortfolioMarkdown('');
    setCierreMarkdown('');
    setErrorPlan('');
  };

  const volverAAreas = () => {
    setAreaSlug(null);
    setRol(null);
    limpiarResultadoPlan();
  };
  const volverARoles = () => {
    setRol(null);
    limpiarResultadoPlan();
  };
  const elegirRol = (r: RolCarrera) => {
    setRol(r);
    limpiarResultadoPlan();
  };

  // Primer escalón del embudo de la capa de IA: se considera "vista" la
  // primera vez que alguien entra al detalle de un rol (ahí es donde vive el
  // formulario de "¿Cómo entro a este rol?").
  useEffect(() => {
    if (rol) registrarEventoFunnel('plan_carrera', 'formulario_visto');
  }, [rol]);

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
        if (valido) {
          registrarEventoFunnel('plan_carrera', 'api_key_valida'); // 2do escalón
        } else {
          registrarEventoFunnel('plan_carrera', 'api_key_invalida'); // intentó, pero no pasó
        }
      } catch {
        setEstadoKey('invalida');
        registrarEventoFunnel('plan_carrera', 'api_key_invalida');
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  // Registra el plan generado para ver uso/adopción, igual que
  // guardarAnalisisEnSupabase() en CV y LinkedIn. Nunca bloquea ni rompe la
  // UI si falla.
  const guardarPlanEnSupabase = async (rolActual: RolCarrera, areaNombre: string) => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('planes_transicion').insert({
        user_id: user.id,
        area_objetivo: areaNombre,
        rol_objetivo: rolActual.nombre,
      });
    } catch (err) {
      console.error('No se pudo guardar el plan de carrera en el historial:', err);
    }
  };

  const handleGenerarPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rol || !area) return;
    if (!apiKey) return alert('Pegá tu clave de Google AI Studio para probar.');
    if (!situacionActual.trim()) {
      return alert('Contanos un poco tu situación actual: tu rol de hoy, experiencia y skills.');
    }

    setCargandoPlan(true);
    setErrorPlan('');
    registrarEventoFunnel('plan_carrera', 'envio_formulario'); // 3er escalón

    const formData = new FormData();
    formData.append('rol_objetivo', rol.nombre);
    formData.append('descripcion_rol', rol.descripcion);
    formData.append('herramientas_rol', rol.herramientas);
    formData.append('situacion_actual', situacionActual);
    formData.append('idioma', idioma);
    if (cvFile) formData.append('cv', cvFile);

    try {
      const res = await fetch(`${API_URL}/api/plan-transicion-carrera`, {
        method: 'POST',
        headers: { 'x-gemini-api-key': apiKey },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'No se pudo generar el plan.');
      }
      setPreparacion(data.puntajes?.preparacion ?? null);
      setInformeMarkdown(data.informe_markdown || '');
      setIntroMarkdown(data.intro_markdown || '');
      setBrechaMarkdown(data.brecha_markdown || '');
      setPlanMarkdown(data.plan_markdown || '');
      setPortfolioMarkdown(data.portfolio_markdown || '');
      setCierreMarkdown(data.cierre_markdown || '');
      guardarPlanEnSupabase(rol, area.nombre);
      registrarEventoFunnel('plan_carrera', 'completado_exito'); // 4to escalón
    } catch (err: any) {
      setErrorPlan(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setCargandoPlan(false);
    }
  };

  const handleDescargarPdf = async () => {
    if (!rol) return;
    setDescargandoPdf(true);
    const formData = new FormData();
    formData.append('informe_markdown', informeMarkdown);
    formData.append('titulo', `Tu plan para pasar a ${rol.nombre}`);
    formData.append('nombre_archivo', `Plan_${rol.nombre}`);

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
      a.download = 'Plan_de_carrera.pdf';
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
            🧭 Guía de Salida Laboral
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
            <Link href="/cv" className="text-slate-400 hover:text-white transition-colors">
              📄 CV
            </Link>
            <Link href="/negociacion" className="text-slate-400 hover:text-white transition-colors">
              💬 Negociación
            </Link>
          </nav>
        </header>

        {/* Selector de las 5 herramientas */}
        {!area && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 animate-fade-in-up">
            <div className="relative overflow-hidden text-left p-4 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Estás acá
              </span>
              <p className="text-2xl">🧭</p>
              <p className="font-semibold text-white text-sm mt-1.5">Guía de Salida Laboral</p>
              <p className="text-xs text-white/80 mt-0.5">Explorá áreas y roles, y armá tu plan de carrera con IA para entrar al que te interesa.</p>
            </div>
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

        {!area && (
          <div className="text-center pt-2 pb-2 animate-fade-in-up">
            <p className="text-sm uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
              Orientación de carrera
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-white leading-tight max-w-2xl mx-auto">
              ¿No sabés para dónde apuntar?
            </h2>
            <p className="text-slate-300 text-base mt-3 max-w-xl mx-auto">
              Elegí un área para ver qué roles existen adentro, en qué consiste cada uno, y después pedile a la
              IA un plan concreto de cómo llegar ahí desde tu situación actual.
            </p>
          </div>
        )}

        {/* Nivel 1: grilla de áreas */}
        {!area && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-fade-in-up">
            {AREAS_CARRERA.map((a) => (
              <button
                key={a.slug}
                onClick={() => setAreaSlug(a.slug)}
                className="text-left p-5 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
              >
                <p className="text-3xl">{a.emoji}</p>
                <p className="font-semibold text-slate-800 mt-2">{a.nombre}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.roles.length} {a.roles.length === 1 ? 'rol' : 'roles'}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Nivel 2: grilla de roles dentro de un área */}
        {area && !rol && (
          <div className="space-y-4 animate-fade-in-up">
            <button
              onClick={volverAAreas}
              className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              ← Volver a áreas
            </button>
            <div className="text-center pt-1 pb-1">
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-white leading-tight flex items-center justify-center gap-2">
                <span>{area.emoji}</span> {area.nombre}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {area.roles.map((r) => (
                <button
                  key={r.nombre}
                  onClick={() => elegirRol(r)}
                  className="text-left p-5 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
                >
                  <p className="font-semibold text-slate-800">{r.nombre}</p>
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{r.descripcion.replace(/\*\*/g, '')}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nivel 3: detalle del rol */}
        {area && rol && (
          <div className="space-y-5 animate-fade-in-up">
            <button
              onClick={volverARoles}
              className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              ← Volver a {area.nombre}
            </button>

            <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-purple-500 font-semibold">
                  {area.emoji} {area.nombre}
                </p>
                <h2 className="font-display text-2xl md:text-3xl font-semibold text-slate-800 mt-1">{rol.nombre}</h2>
              </div>

              <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                <ReactMarkdown>{rol.descripcion}</ReactMarkdown>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  🛠️ Herramientas comunes
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">{rol.herramientas}</p>
              </div>

              {esDev && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    🔤 Repaso de lenguajes de programación
                  </p>
                  <p className="text-xs text-slate-400 -mt-2">
                    Ninguna fuente mide "cantidad de vacantes publicadas" con exactitud — estos datos son la mejor
                    aproximación disponible a qué tan pedido está cada lenguaje, no un conteo literal de avisos.
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {LENGUAJES_PROGRAMACION.map((l) => (
                      <div key={l.nombre} className="border border-slate-200 rounded-xl p-4">
                        <p className="font-semibold text-slate-800 text-sm mb-2">{l.nombre}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-emerald-600 font-semibold mb-0.5">A favor</p>
                            <p className="text-slate-600 leading-relaxed">{l.aFavor}</p>
                          </div>
                          <div>
                            <p className="text-amber-600 font-semibold mb-0.5">En contra</p>
                            <p className="text-slate-600 leading-relaxed">{l.enContra}</p>
                          </div>
                          <div>
                            <p className="text-blue-600 font-semibold mb-0.5">Demanda</p>
                            <p className="text-slate-600 leading-relaxed">{l.demanda}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Capa de IA: "¿Cómo entro a este rol?" */}
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-6 md:p-8 space-y-5">
              <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 bg-purple-200/40 rounded-full blur-3xl" />
              <div className="relative space-y-5">
                <div>
                  <h3 className="font-display text-xl md:text-2xl font-semibold text-slate-800 flex items-center gap-2">
                    🧭 ¿Cómo entro a este rol?
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Contanos tu situación actual y te armamos un plan concreto para llegar a {rol.nombre} —
                    qué te falta, qué estudiar, y cómo demostrarlo.
                  </p>
                </div>

                {!hayPlan && (
                  <form onSubmit={handleGenerarPlan} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        🔑 API Key de Gemini:{' '}
                        <span className="text-xs font-normal text-slate-400">
                          — así conectás con la IA que arma el plan
                        </span>
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
                      <div className="mt-2 text-xs">
                        <a
                          href="https://aistudio.google.com/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 underline hover:text-indigo-700 transition-colors font-medium"
                        >
                          👉 Conseguí tu API Key gratuita acá
                        </a>
                        <span className="text-slate-500"> · Es 100% gratis y te lleva menos de 1 minuto.</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-1">
                        Tu situación actual
                      </label>
                      <textarea
                        rows={4}
                        value={situacionActual}
                        onChange={(e) => setSituacionActual(e.target.value)}
                        placeholder="Contanos tu rol actual, años de experiencia, skills que ya tenés, y por qué te interesa este rol."
                        className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 p-3 rounded-lg text-sm transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40 resize-none"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">
                          Tu CV en PDF <span className="text-xs font-normal text-slate-400">(opcional)</span>
                        </label>
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                        />
                        <p className="text-xs text-slate-500 mt-1">Si lo subís, el diagnóstico es más preciso.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 mb-1">Idioma del plan</label>
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

                    {errorPlan && <p className="text-xs text-red-500 px-1 animate-fade-in">{errorPlan}</p>}

                    <button
                      type="submit"
                      disabled={cargandoPlan}
                      className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white py-3 rounded-full font-medium text-sm transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/40 active:scale-[0.99] flex items-center justify-center gap-2"
                    >
                      {cargandoPlan && <Spinner />}
                      {cargandoPlan ? 'Armando tu plan...' : '🧭 Armar mi plan'}
                    </button>
                  </form>
                )}

                {hayPlan && (
                  <div className="space-y-4">
                    {preparacion !== null && (
                      <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center justify-between shadow-md">
                        <div>
                          <span className="text-slate-800 font-semibold block">Qué tan preparado/a estás hoy</span>
                          <span className="text-slate-500 text-xs">Para {rol.nombre}</span>
                        </div>
                        <span className="text-3xl font-extrabold text-indigo-600 ring-4 ring-indigo-200 bg-white rounded-full w-20 h-20 flex items-center justify-center">
                          {preparacion}
                        </span>
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-2xl p-5">
                      <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                        <ReactMarkdown>{introMarkdown}</ReactMarkdown>
                        <ReactMarkdown>{brechaMarkdown}</ReactMarkdown>
                        <ReactMarkdown>{planMarkdown}</ReactMarkdown>
                        <ReactMarkdown>{portfolioMarkdown}</ReactMarkdown>
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
                        {descargandoPdf ? 'Generando PDF...' : '📥 Descargar plan en PDF'}
                      </button>
                      <button
                        onClick={limpiarResultadoPlan}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-full font-medium text-sm transition-all active:scale-[0.99]"
                      >
                        🔄 Rehacer el plan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
