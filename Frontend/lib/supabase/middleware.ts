import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// "/" (la landing pública de marketing) es pública, pero OJO: no puede ir en
// una lista chequeada con startsWith, porque TODAS las rutas del sitio
// empiezan con "/" — eso dejaría la app entera sin protección. Por eso va
// aparte, comparado con match exacto. "/login" sí usa startsWith, por si en
// el futuro hay subrutas tipo /login/reset-password.
const RUTA_PUBLICA_EXACTA = '/';
const RUTAS_PUBLICAS_PREFIJO = ['/login'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica =
    request.nextUrl.pathname === RUTA_PUBLICA_EXACTA ||
    RUTAS_PUBLICAS_PREFIJO.some((r) => request.nextUrl.pathname.startsWith(r));

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/inicio';
    return NextResponse.redirect(url);
  }

  // Alguien ya logueado que entra a la landing pública ("/") no necesita
  // ver el pitch de nuevo — lo mandamos directo al selector de herramientas.
  if (user && request.nextUrl.pathname === RUTA_PUBLICA_EXACTA) {
    const url = request.nextUrl.clone();
    url.pathname = '/inicio';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
