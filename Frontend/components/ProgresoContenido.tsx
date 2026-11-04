'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { HistorialChart } from '@/components/HistorialChart';

type Sesion = {
  id: string;
  creado_en: string;
  rol: string;
  seniority: string | null;
  nota_global: number | null;
  nota_tecnica: number | null;
  nota_star: number | null;
  nota_oratoria: number | null;
  nota_tono: number | null;
};

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-4 rounded-2xl text-center shadow-xl shadow-purple-950/30">
      <p className="font-display text-2xl font-semibold text-slate-800">{value}</p>
      <p className="text-xs text-slate-600 mt-1">{label}</p>
    </div>
  );
}

// Mismo contenido que antes vivía directo en page.tsx, movido a un componente
// cliente para poder borrar sesiones sin recargar la página: el server
// component (page.tsx) solo busca los datos iniciales, y este se encarga de
// mostrarlos y de la interacción (stats, gráfico y tabla se actualizan solos
// al borrar, porque recalculan todo a partir del mismo estado "lista").
export function ProgresoContenido({ sesionesIniciales }: { sesionesIniciales: Sesion[] }) {
  const [lista, setLista] = useState<Sesion[]>(sesionesIniciales);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const total = lista.length;
  const promedio = total
    ? Math.round((lista.reduce((acc, s) => acc + (s.nota_global || 0), 0) / total) * 10) / 10
    : 0;
  const ultima = total ? lista[total - 1].nota_global : null;

  const handleBorrar = async (id: string, rol: string) => {
    if (!confirm(`¿Borrar la sesión de "${rol}" de tu historial? No se puede deshacer.`)) return;

    setBorrandoId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('simulaciones').delete().eq('id', id);
      if (error) throw error;
      // Actualiza todo en el momento (stats, gráfico y tabla dependen del
      // mismo estado), sin esperar a recargar la página.
      setLista((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('No se pudo borrar la sesión:', err);
      alert('No se pudo borrar la sesión. Probá de nuevo en un momento.');
    } finally {
      setBorrandoId(null);
    }
  };

  if (total === 0) {
    return (
      <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-8 rounded-2xl text-center text-slate-600 shadow-xl shadow-purple-950/30 animate-fade-in-up">
        Todavía no completaste ninguna simulación.
        <br />
        <Link href="/simulador" className="text-indigo-600 underline hover:text-indigo-700">
          Empezá tu primera práctica →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Sesiones completadas" value={total} />
        <StatTile label="Promedio general" value={`${promedio} / 10`} />
        <StatTile label="Última calificación" value={`${ultima} / 10`} />
      </div>

      <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl shadow-xl shadow-purple-950/30">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Evolución de tu Nota Global por sesión</h2>
        <HistorialChart sesiones={lista} />
      </div>

      <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl overflow-x-auto shadow-xl shadow-purple-950/30">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Detalle de sesiones</h2>
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-slate-500 text-xs uppercase">
              <th className="pb-2 font-medium">Fecha</th>
              <th className="pb-2 font-medium">Rol</th>
              <th className="pb-2 font-medium">Seniority</th>
              <th className="pb-2 font-medium text-right">Nota</th>
              <th className="pb-2 font-medium text-right w-8"></th>
            </tr>
          </thead>
          <tbody>
            {[...lista].reverse().map((s) => (
              <tr key={s.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors group">
                <td className="py-2 text-slate-500">
                  {new Date(s.creado_en).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-2 text-slate-800">{s.rol}</td>
                <td className="py-2 text-slate-500">{s.seniority}</td>
                <td className="py-2 text-right font-semibold text-slate-800">{s.nota_global} / 10</td>
                <td className="py-2 text-right pl-2">
                  <button
                    onClick={() => handleBorrar(s.id, s.rol)}
                    disabled={borrandoId === s.id}
                    title="Borrar esta sesión del historial"
                    aria-label="Borrar esta sesión del historial"
                    className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40 disabled:cursor-wait opacity-60 group-hover:opacity-100"
                  >
                    {borrandoId === s.id ? '…' : '🗑️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
