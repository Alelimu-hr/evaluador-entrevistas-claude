'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { Spinner } from '@/components/Spinner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type EstadoKey = 'vacio' | 'verificando' | 'valida' | 'invalida';
type ModoAnalisis = 'dirigido' | 'objetivo';

type Puntajes = {
  global: number;
  headline: number;
  acerca_de: number;
  experiencia: number;
  palabras_clave: number;
};

function colorDeNota(nota: number) {
  if (nota >= 7) return { texto: 'text-emerald-600', anillo: 'ring-emerald-300', borde: 'border-emerald-200' };
  if (nota >= 4) return { texto: 'text-amber-600', anillo: 'ring-amber-300', borde: 'border-amber-200' };
  return { texto: 'text-red-600', anillo: 'ring-red-300', borde: 'border-red-200' };
}

export default function LinkedinPage() {
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
  const [informeMarkdown, setInformeMarkdown] = useState('');
  const [titularesSugeridos, setTitularesSugeridos] = useState<string[]>([]);
  const [acercaDeSugerido, setAcercaDeSugerido] = useState('');
  // Qué botón de "Copiar" mostró el check verde últimamente (por índice, o
  // 'acerca_de' para esa sección) — se resetea solo después de 2 segundos.
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiarTexto = async (texto: string, id: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(id);
      setTimeout(() => setCopiado((actual) => (actual === id ? null : actual)), 2000);
    } catch {
      alert('No se pudo copiar automáticamente. Seleccioná el texto a mano.');
    }
  };

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
        setEstadoKey(data.valido ? 'valida' : 'invalida');
      } catch {
        setEstadoKey('invalida');
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [apiKey]);

  const reiniciarTodo = () => {
    setPerfilFile(null);
    setPuntajes(null);
    setInformeMarkdown('');
    setTitularesSugeridos([]);
    setAcercaDeSugerido('');
    setError('');
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
      setTitularesSugeridos(Array.isArray(data.titulares_sugeridos) ? data.titulares_sugeridos : []);
      setAcercaDeSugerido(data.acerca_de_sugerido || '');
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
    formData.append('rol', rolObjetivo);
    formData.append('titulo', `Informe de Perfil de LinkedIn — ${rolObjetivo}`);
    formData.append('nombre_archivo', `Perfil_LinkedIn_${rolObjetivo}`);

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

  const hayResultado = !!informeMarkdown;

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            💼 Mejorá tu Perfil de LinkedIn
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador de Entrevistas
            </Link>
          </nav>
        </header>

        {!hayResultado && (
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

        {!hayResultado && (
          <form onSubmit={handleAnalizar} className="space-y-4 animate-fade-in-up">
            {/* API Key */}
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl shadow-xl shadow-purple-950/30 transition-colors">
              <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 bg-purple-200/40 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-10 w-48 h-48 bg-blue-200/40 rounded-full blur-3xl" />

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-800 mb-2">🔑 API Key de Gemini:</label>
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

            {/* Modo de análisis + rol objetivo + idioma */}
            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl space-y-4 shadow-xl shadow-purple-950/30 transition-colors">
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
                      Analizamos tu perfil pensando en el rol al que te gustaría adaptarlo.
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
                      Análisis objetivo de tu perfil actual, sin compararlo contra ninguna vacante puntual.
                    </p>
                  </button>
                </div>
              </div>

              <div className={`grid grid-cols-1 ${modo === 'dirigido' ? 'md:grid-cols-2' : ''} gap-4`}>
                {modo === 'dirigido' && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-1">
                      Puesto al que apuntás
                    </label>
                    <input
                      type="text"
                      value={rolObjetivo}
                      onChange={(e) => setRolObjetivo(e.target.value)}
                      placeholder="Ej: Analista Contable, Líder de Ventas, Desarrollador Backend..."
                      className="w-full bg-white border border-purple-200 text-slate-800 placeholder:text-slate-400 px-3 py-2 rounded-lg transition-all focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-300/40"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Así te sugerimos palabras clave y ajustes pensados para ESE rol puntual.
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
                {modo === 'dirigido' && (
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

            {error && (
              <p className="text-xs text-red-400 px-1 animate-fade-in">{error}</p>
            )}

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

            {(titularesSugeridos.length > 0 || acercaDeSugerido) && (
              <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5 space-y-4">
                <p className="text-sm font-semibold text-slate-800">📋 Listo para copiar y pegar en tu perfil</p>

                {titularesSugeridos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Titular</p>
                    {titularesSugeridos.map((titular, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3"
                      >
                        <p className="flex-1 text-sm text-slate-700">{titular}</p>
                        <button
                          type="button"
                          onClick={() => copiarTexto(titular, `titular-${i}`)}
                          className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white border border-purple-200 text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                        >
                          {copiado === `titular-${i}` ? '✓ Copiado' : '📋 Copiar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {acercaDeSugerido && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Acerca de</p>
                    <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="flex-1 text-sm text-slate-700 whitespace-pre-line">{acercaDeSugerido}</p>
                      <button
                        type="button"
                        onClick={() => copiarTexto(acercaDeSugerido, 'acerca_de')}
                        className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white border border-purple-200 text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                      >
                        {copiado === 'acerca_de' ? '✓ Copiado' : '📋 Copiar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5">
              <div className="text-slate-700 text-sm leading-relaxed informe-contenido max-w-none">
                <ReactMarkdown>{informeMarkdown}</ReactMarkdown>
              </div>
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
                🔄 Analizar otro perfil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
