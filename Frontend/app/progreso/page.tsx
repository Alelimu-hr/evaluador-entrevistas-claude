import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Poppins } from 'next/font/google';
import { createClient } from '@/lib/supabase/server';
import { ProgresoContenido } from '@/components/ProgresoContenido';

// Mismo tratamiento visual que el resto de la app rediseñada (fondo claro,
// blobs de marca, logo real de Chelaburo). ProgresoContenido ya usaba
// tarjetas blancas/claras (pensadas para flotar sobre el fondo oscuro
// anterior), así que siguen viéndose bien tal cual sobre el fondo nuevo —
// no hizo falta tocar ese componente.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

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
    <div className={`${poppins.className} cl-landing`}>
      <div className="cl-bg" />
      <div className="cl-blob cl-blob-1" />
      <div className="cl-blob cl-blob-2" />

      <div className="cl-wrap" style={{ maxWidth: 1000, paddingBottom: 60 }}>
        <header className="cl-header">
          <div className="cl-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chelaburo-logo.png" alt="Chelaburo" />
          </div>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/inicio" className="font-semibold text-[#0B205F] opacity-75 hover:opacity-100 transition-opacity">
              🏠 Inicio
            </Link>
            <Link href="/simulador" className="font-semibold text-[#0B205F] opacity-75 hover:opacity-100 transition-opacity">
              🎙 Simulador
            </Link>
            <span className="text-[#64748b] text-xs hidden sm:inline">{user.email}</span>
          </nav>
        </header>

        <h1 className="text-2xl font-extrabold text-[#0B205F] mt-8 mb-6">📈 Mi Progreso</h1>

        <ProgresoContenido sesionesIniciales={sesiones || []} />
      </div>
    </div>
  );
}
