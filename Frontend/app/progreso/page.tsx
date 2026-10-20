import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HistorialChart } from '@/components/HistorialChart';

const FONDO = 'bg-app';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-4 rounded-2xl text-center shadow-xl shadow-purple-950/30">
      <p className="font-display text-2xl font-semibold text-slate-800">{value}</p>
      <p className="text-xs text-slate-600 mt-1">{label}</p>
    </div>
  );
}

export default async function ProgresoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: sesiones } = await supabase
    .from('simulaciones')
    .select('id, creado_en, rol, seniority, nota_global, nota_tecnica, nota_star, nota_oratoria, nota_tono')
    .order('creado_en', { ascending: true });

  const lista = sesiones || [];
  const total = lista.length;
  const promedio = total
    ? Math.round((lista.reduce((acc, s) => acc + (s.nota_global || 0), 0) / total) * 10) / 10
    : 0;
  const ultima = total ? lista[total - 1].nota_global : null;

  return (
    <div className={`min-h-screen ${FONDO} text-white p-6 font-sans`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            📈 Mi Progreso
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              🏠 Inicio
            </Link>
            <Link href="/simulador" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador
            </Link>
            <span className="text-slate-600 hidden sm:inline">{user.email}</span>
          </nav>
        </header>

        {total === 0 ? (
          <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-8 rounded-2xl text-center text-slate-600 shadow-xl shadow-purple-950/30 animate-fade-in-up">
            Todavía no completaste ninguna simulación.
            <br />
            <Link href="/simulador" className="text-indigo-600 underline hover:text-indigo-700">
              Empezá tu primera práctica →
            </Link>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-3 gap-4">
              <StatTile label="Sesiones completadas" value={total} />
              <StatTile label="Promedio general" value={`${promedio} / 10`} />
              <StatTile label="Última calificación" value={`${ultima} / 10`} />
            </div>

            <div className="bg-gradient-to-br from-white via-[#f7f5ff] to-[#f1f0ff] border border-white/60 p-5 rounded-2xl shadow-xl shadow-purple-950/30">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Evolución de tu Nota Global por sesión
              </h2>
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
                  </tr>
                </thead>
                <tbody>
                  {[...lista].reverse().map((s) => (
                    <tr key={s.id} className="border-t border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="py-2 text-slate-500">
                        {new Date(s.creado_en).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2 text-slate-800">{s.rol}</td>
                      <td className="py-2 text-slate-500">{s.seniority}</td>
                      <td className="py-2 text-right font-semibold text-slate-800">
                        {s.nota_global} / 10
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
