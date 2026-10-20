'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { AREAS_CARRERA, LENGUAJES_PROGRAMACION, type RolCarrera } from '@/lib/contenidoCarrera';

// Esta herramienta es distinta a las otras tres: es puro contenido estático
// (sin API key, sin llamada a Gemini, sin backend), así que a propósito NO
// usa registrarEventoFunnel/eventos_funnel — ese modelo de embudo (formulario
// visto → api key válida → envío → completado) está pensado para flujos con
// IA y no mapea bien a "entró a mirar contenido". Si más adelante se agrega la
// capa de IA personalizada ("cómo entro a este rol"), ahí sí tendría sentido
// trackear un paso de uso real.

const ROL_DEV = 'Desarrollo (Dev)';

export default function GuiaCarreraPage() {
  const [areaSlug, setAreaSlug] = useState<string | null>(null);
  const [rol, setRol] = useState<RolCarrera | null>(null);

  const area = areaSlug ? AREAS_CARRERA.find((a) => a.slug === areaSlug) ?? null : null;
  const esDev = rol?.nombre === ROL_DEV;

  const volverAAreas = () => {
    setAreaSlug(null);
    setRol(null);
  };
  const volverARoles = () => setRol(null);

  return (
    <div className="min-h-screen bg-app text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🧭 Guía de Salida Laboral
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador de Entrevistas
            </Link>
            <Link href="/linkedin" className="text-slate-400 hover:text-white transition-colors">
              💼 LinkedIn
            </Link>
            <Link href="/cv" className="text-slate-400 hover:text-white transition-colors">
              📄 CV
            </Link>
          </nav>
        </header>

        {/* Selector de las 4 herramientas */}
        {!area && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in-up">
            <Link
              href="/"
              className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl">🎙️</p>
              <p className="font-semibold text-slate-800 text-sm mt-1.5">Practicá tu entrevista</p>
              <p className="text-xs text-slate-500 mt-0.5">Simulá una entrevista real y recibí feedback con IA.</p>
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
              href="/cv"
              className="text-left p-4 rounded-2xl border border-white/60 bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] shadow-xl shadow-purple-950/30 hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl">📄</p>
              <p className="font-semibold text-slate-800 text-sm mt-1.5">Optimizá tu CV</p>
              <p className="text-xs text-slate-500 mt-0.5">Chequeo ATS y reescritura de logros, lista para pegar.</p>
            </Link>
            <div className="relative overflow-hidden text-left p-4 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 shadow-lg shadow-purple-500/30">
              <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Estás acá
              </span>
              <p className="text-2xl">🧭</p>
              <p className="font-semibold text-white text-sm mt-1.5">Guía de Salida Laboral</p>
              <p className="text-xs text-white/80 mt-0.5">Explorá áreas y roles para saber hacia dónde apuntar.</p>
            </div>
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
              Elegí un área para ver qué roles existen adentro y en qué consiste cada uno — una base para saber
              hacia dónde moverte, sin necesidad de API key ni de IA.
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
                  onClick={() => setRol(r)}
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
          </div>
        )}
      </div>
    </div>
  );
}
