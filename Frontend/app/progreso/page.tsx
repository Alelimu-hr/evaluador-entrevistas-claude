import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProgresoContenido } from '@/components/ProgresoContenido';

const FONDO = 'bg-app';

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

  return (
    <div className={`min-h-screen ${FONDO} text-white p-6 font-sans`}>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex justify-between items-center pb-4 border-b border-slate-800 animate-fade-in">
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            📈 Mi Progreso
          </h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/inicio" className="text-slate-400 hover:text-white transition-colors">
              🏠 Inicio
            </Link>
            <Link href="/simulador" className="text-slate-400 hover:text-white transition-colors">
              🎙 Simulador
            </Link>
            <span className="text-slate-600 hidden sm:inline">{user.email}</span>
          </nav>
        </header>

        <ProgresoContenido sesionesIniciales={sesiones || []} />
      </div>
    </div>
  );
}
