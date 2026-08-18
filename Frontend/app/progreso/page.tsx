import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { HistorialChart } from '@/components/HistorialChart';

const FONDO =
  'bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(37,99,235,0.16),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(239,68,68,0.08),transparent),#050811]';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-xl text-center shadow-lg shadow-black/20">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
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
          <h1 className="text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            📈 Mi Progreso
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador
            </Link>
            <span className="text-slate-600 hidden sm:inline">{user.email}</span>
          </nav>
        </header>

        {total === 0 ? (
          <div className="bg-[#0b1329] border border-slate-800 p-8 rounded-xl text-center text-slate-400 animate-fade-in-up">
            Todavía no completaste ninguna simulación.
            <br />
            <Link href="/" className="text-blue-400 underline hover:text-blue-300">
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

            <div className="bg-[#0b1329] border border-slate-800 p-5 rounded-xl shadow-lg shadow-black/20">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">
                Evolución de tu Nota Global por sesión
              </h2>
              <HistorialChart sesiones={lista} />
            </div>

            <div className="bg-[#0b1329] border border-slate-800 p-5 rounded-xl overflow-x-auto shadow-lg shadow-black/20">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Detalle de sesiones</h2>
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
                    <tr key={s.id} className="border-t border-slate-800 hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 text-slate-400">
                        {new Date(s.creado_en).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-2 text-slate-100">{s.rol}</td>
                      <td className="py-2 text-slate-400">{s.seniority}</td>
                      <td className="py-2 text-right font-semibold text-slate-100">
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
