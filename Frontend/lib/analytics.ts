import { createClient } from '@/lib/supabase/client';

export type HerramientaFunnel = 'entrevista' | 'linkedin' | 'cv' | 'plan_carrera' | 'negociacion';

// Los escalones del embudo, iguales para las cinco herramientas, para poder
// comparar peras con peras en una sola query de SQL. "plan_carrera" es la capa
// de IA personalizada de la Guía de Salida Laboral ("cómo entro a este rol") —
// a diferencia de navegar la guía en sí (que es puro contenido estático y no
// se trackea, ver Frontend/app/guia-carrera/page.tsx), esto SÍ usa IA y API
// Key, así que entra en el mismo modelo de embudo que las otras:
// 1. formulario_visto     -> entró logueado a la pantalla inicial
// 2. api_key_invalida     -> pegó algo en el campo de API Key pero el backend
//                            la rechazó (o falló la validación por conexión).
//                            Sirve para distinguir "ni intentó poner una key"
//                            de "la intentó poner y se le complicó" dentro de
//                            la caída que hay en este escalón del embudo.
// 3. api_key_valida       -> pegó una API Key y el backend la validó como correcta
// 4. envio_formulario     -> completó el resto del formulario y le dio al botón
// 5. completado_exito     -> el backend respondió OK y vio el resultado
export type PasoFunnel =
  | 'formulario_visto'
  | 'api_key_invalida'
  | 'api_key_valida'
  | 'envio_formulario'
  | 'completado_exito';

// Registra un paso del embudo de uso, para poder ver en qué escalón se cae la
// gente entre "se inscribió" y "completó una prueba" (hoy solo se ve el
// inicio y el final, no los pasos del medio). Mismo criterio que
// guardarEnProgreso/guardarAnalisisEnSupabase: nunca bloquea ni rompe la UI
// si falla (sin sesión, sin conexión, tabla inexistente, etc.) — solo lo
// logueamos en consola para poder diagnosticarlo si hace falta.
//
// Se pueden registrar varias veces el mismo paso para el mismo usuario (ej.
// si edita la API Key dos veces, o recarga la página) — es a propósito, para
// no perder datos por una lógica de "solo una vez" mal calibrada. Al analizar
// los datos en SQL, contar con COUNT(DISTINCT user_id) por paso en vez de
// COUNT(*), así los duplicados no inflan el embudo.
export async function registrarEventoFunnel(herramienta: HerramientaFunnel, paso: PasoFunnel) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('eventos_funnel').insert({
      user_id: user.id,
      herramienta,
      paso,
    });
  } catch (err) {
    console.error('No se pudo registrar el evento de funnel:', err);
  }
}

// Guarda si un informe le sirvió o no a quien lo recibió (botón 👍/👎 al
// final de cada herramienta, ver components/FeedbackInforme.tsx y la tabla
// feedback_informe en sql_feedback_informe.sql). Esta es la forma real de
// "mejorar con el uso" en esta arquitectura: la API de Gemini no aprende
// sola entre llamadas (no hay fine-tuning automático en BYOK), así que la
// mejora pasa por revisar periódicamente los casos con 👎 y ajustar el
// prompt de esa herramienta a mano. Mismo criterio que el resto: nunca
// bloquea ni rompe la UI si falla.
export async function registrarFeedbackInforme(herramienta: HerramientaFunnel, util: boolean) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('feedback_informe').insert({
      user_id: user.id,
      herramienta,
      util,
    });
  } catch (err) {
    console.error('No se pudo registrar el feedback del informe:', err);
  }
}
