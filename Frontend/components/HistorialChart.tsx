'use client';

import { useState } from 'react';

type Sesion = {
  id: string;
  creado_en: string;
  rol: string;
  nota_global: number | null;
};

const ESCALA_MAX = 10;

export function HistorialChart({ sesiones }: { sesiones: Sesion[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-end gap-1.5 h-48 border-b border-slate-800 relative">
        {[0, 2.5, 5, 7.5, 10].map((v) => (
          <div
            key={v}
            className="absolute left-0 right-0 border-t border-slate-800/60 pointer-events-none"
            style={{ bottom: `${(v / ESCALA_MAX) * 100}%` }}
          />
        ))}
        {sesiones.map((s, i) => {
          const nota = s.nota_global ?? 0;
          const alturaPct = Math.max((nota / ESCALA_MAX) * 100, 3);
          return (
            <div
              key={s.id}
              className="relative flex-1 flex items-end justify-center h-full cursor-pointer"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <div
                className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-blue-600 to-blue-400 transition-all hover:from-blue-500 hover:to-blue-300"
                style={{ height: `${alturaPct}%` }}
              />
              {hoverIdx === i && (
                <div className="absolute bottom-full mb-2 bg-slate-900 border border-slate-700 text-xs text-white px-2.5 py-1.5 rounded-lg shadow-lg whitespace-nowrap z-10 animate-fade-in">
                  <p className="font-semibold">{s.rol}</p>
                  <p className="text-slate-400">
                    {new Date(s.creado_en).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-blue-300">Nota: {nota} / 10</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1">
        {sesiones.map((s, i) => (
          <div key={s.id} className="flex-1 text-center text-[10px] text-slate-500">
            #{i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
