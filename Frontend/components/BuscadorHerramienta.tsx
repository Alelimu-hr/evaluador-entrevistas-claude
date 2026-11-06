'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';

// "El buscador": pedido explícito de Ale para gente que no tiene ni idea de
// cuál de las 5 herramientas necesita (caso real: una amiga suya que tenía
// que rehacer su CV y ni se le cruzó por la cabeza que "Optimizador de CV"
// era lo que necesitaba). Es un arbolito de decisión fijo (sin IA — no hace
// falta gastar un pedido a Gemini para esto, y así funciona incluso antes de
// que la persona tenga su API Key a mano). Vive colapsado como un botón
// arriba de las 5 tarjetas en /inicio, y se despliega ahí mismo.
type Paso = 'inicio' | 'q1' | 'q2' | 'resultado';

type Recomendacion = {
  href: string;
  emoji: string;
  titulo: string;
  motivo: string;
};

function TarjetaRecomendacion({ href, emoji, titulo, motivo }: Recomendacion) {
  return (
    <Link
      href={href}
      className="block text-left p-4 rounded-xl border border-indigo-200 bg-white hover:border-indigo-400 hover:-translate-y-0.5 transition-all"
    >
      <p className="text-2xl">{emoji}</p>
      <p className="font-semibold text-slate-800 text-sm mt-1.5">{titulo}</p>
      <p className="text-xs text-slate-500 mt-1">{motivo}</p>
      <p className="text-xs font-semibold text-indigo-600 mt-2">Ir ahora →</p>
    </Link>
  );
}

function BotonOpcion({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 transition-all text-sm text-slate-700"
    >
      {children}
    </button>
  );
}

export function BuscadorHerramienta() {
  const [paso, setPaso] = useState<Paso>('inicio');
  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([]);

  const irAResultado = (recs: Recomendacion[]) => {
    setRecomendaciones(recs);
    setPaso('resultado');
  };

  const cerrar = () => {
    setPaso('inicio');
    setRecomendaciones([]);
  };

  if (paso === 'inicio') {
    return (
      <button
        type="button"
        onClick={() => setPaso('q1')}
        className="w-full flex items-center justify-center gap-2 text-sm text-indigo-200 bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/25 rounded-full py-2.5 px-4 transition-all animate-fade-in-up"
      >
        🧭 ¿No sabés por dónde empezar? Hacé este test de 2 preguntas
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 rounded-2xl shadow-xl shadow-purple-950/30 p-5 space-y-3 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">🧭 ¿Qué herramienta te conviene usar?</p>
        <button
          type="button"
          onClick={cerrar}
          className="text-slate-400 hover:text-slate-600 text-xs"
          aria-label="Cerrar el test"
        >
          ✕ Cerrar
        </button>
      </div>

      {paso === 'q1' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-1">¿Qué describe mejor tu situación hoy?</p>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/guia-carrera',
                  emoji: '🧭',
                  titulo: 'Guía de Salida Laboral',
                  motivo: 'Explorá roles y armá un plan concreto con IA para entrar al que te interesa.',
                },
              ])
            }
          >
            Quiero cambiar de rubro o de rol, pero no sé bien hacia dónde apuntar
          </BotonOpcion>
          <BotonOpcion onClick={() => setPaso('q2')}>
            Sé a qué puesto quiero apuntar, pero mis materiales (CV, LinkedIn) todavía no están a la altura
          </BotonOpcion>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/simulador',
                  emoji: '🎙️',
                  titulo: 'Practicá tu entrevista',
                  motivo: 'Simulá una entrevista real y recibí feedback honesto con IA para llegar más preparado/a.',
                },
              ])
            }
          >
            Mis materiales están bien, pero me cuesta la instancia de la entrevista
          </BotonOpcion>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/negociacion',
                  emoji: '💬',
                  titulo: 'Negociá tu oferta',
                  motivo: 'Armamos un plan concreto para que negocies sueldo y condiciones con más seguridad.',
                },
              ])
            }
          >
            Ya tengo una propuesta u oferta, y quiero negociarla mejor
          </BotonOpcion>
        </div>
      )}

      {paso === 'q2' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-1">¿Qué es lo que más te preocupa de tus materiales?</p>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/cv?modo=desde_cero',
                  emoji: '✨',
                  titulo: 'Armá tu CV de cero',
                  motivo: 'Respondés un formulario guiado y te armamos un CV completo, sin que sepas nada de formato.',
                },
              ])
            }
          >
            Todavía no tengo armado un CV
          </BotonOpcion>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/cv?modo=optimizar',
                  emoji: '📄',
                  titulo: 'Optimizá tu CV',
                  motivo: 'Lo comparamos contra el puesto puntual y te decimos qué cambiar para pasar el filtro ATS.',
                },
              ])
            }
          >
            Tengo un CV, pero no sé si pasa los filtros para el puesto que quiero
          </BotonOpcion>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/linkedin',
                  emoji: '💼',
                  titulo: 'LinkedIn y marca personal',
                  motivo: 'Optimizamos tu perfil y armamos una estrategia de contenido para que te encuentren.',
                },
              ])
            }
          >
            Mi perfil de LinkedIn no me trae resultados
          </BotonOpcion>
          <BotonOpcion
            onClick={() =>
              irAResultado([
                {
                  href: '/cv',
                  emoji: '📄',
                  titulo: 'Armado y optimización de CV',
                  motivo: 'Empezá por acá: armalo de cero o optimizá el que ya tenés.',
                },
                {
                  href: '/linkedin',
                  emoji: '💼',
                  titulo: 'LinkedIn y marca personal',
                  motivo: 'Después seguí con tu perfil y tu estrategia de contenido.',
                },
              ])
            }
          >
            Las dos cosas (CV y LinkedIn)
          </BotonOpcion>
          <button
            type="button"
            onClick={() => setPaso('q1')}
            className="text-xs text-slate-400 hover:text-slate-600 pt-1"
          >
            ← Volver
          </button>
        </div>
      )}

      {paso === 'resultado' && (
        <div className="space-y-3">
          <div className={`grid grid-cols-1 ${recomendaciones.length > 1 ? 'sm:grid-cols-2' : ''} gap-2.5`}>
            {recomendaciones.map((rec) => (
              <TarjetaRecomendacion key={rec.href} {...rec} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPaso('q1')}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            🔄 Volver a elegir
          </button>
        </div>
      )}
    </div>
  );
}
