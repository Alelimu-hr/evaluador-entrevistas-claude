'use client';

import { useState } from 'react';
import { registrarFeedbackInforme, type HerramientaFunnel } from '@/lib/analytics';

// Botón de "¿te sirvió este informe?" (👍/👎) al final de cada una de las 5
// herramientas. Guarda la respuesta en Supabase (tabla feedback_informe, ver
// sql_feedback_informe.sql) para poder revisar una vez por mes los casos con
// 👎 y ajustar el prompt de esa herramienta en consecuencia — es la forma
// real de "mejorar con el uso" en esta arquitectura BYOK (no hay
// aprendizaje/fine-tuning automático entre llamadas a la API de Gemini).
export function FeedbackInforme({ herramienta }: { herramienta: HerramientaFunnel }) {
  const [enviado, setEnviado] = useState<'util' | 'no_util' | null>(null);

  const handleClick = (util: boolean) => {
    // Optimista: se marca al toque para que la interacción se sienta
    // instantánea, sin esperar la respuesta de Supabase.
    setEnviado(util ? 'util' : 'no_util');
    registrarFeedbackInforme(herramienta, util);
  };

  if (enviado) {
    return (
      <p className="text-center text-xs text-slate-400 py-1 animate-fade-in">
        {enviado === 'util' ? '¡Gracias por tu feedback! 🙌' : 'Gracias, lo vamos a tener en cuenta. 🙏'}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-center gap-3 text-xs text-slate-400 py-1 animate-fade-in">
      <span>¿Te sirvió este informe?</span>
      <button
        type="button"
        onClick={() => handleClick(true)}
        className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:-translate-y-0.5 transition-all"
        aria-label="Sí, me sirvió"
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => handleClick(false)}
        className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:-translate-y-0.5 transition-all"
        aria-label="No me sirvió"
      >
        👎
      </button>
    </div>
  );
}
