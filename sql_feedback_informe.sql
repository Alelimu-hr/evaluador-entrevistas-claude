-- Tabla para el botón "¿te sirvió este informe?" (👍/👎) que ahora aparece al
-- final de las 5 herramientas (ver components/FeedbackInforme.tsx). Mismo
-- patrón de RLS que el resto (planes_transicion, simulaciones, etc.): cada
-- usuario solo puede insertar y ver sus propias filas.
--
-- La idea es revisar esto una vez por mes: mirar los casos con 👎 (cruzados
-- contra el informe guardado si la herramienta lo guarda, ej.
-- simulaciones.informe_markdown) para detectar patrones y ajustar el prompt
-- de esa herramienta en consecuencia. Es la forma real de "mejorar con el
-- uso" en esta arquitectura BYOK: la API de Gemini no aprende sola entre
-- llamadas, así que la mejora la hacés vos, a mano, sobre el prompt.
create table if not exists feedback_informe (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  herramienta text not null check (herramienta in ('entrevista', 'linkedin', 'cv', 'plan_carrera', 'negociacion')),
  util boolean not null,
  creado_en timestamptz not null default now()
);

alter table feedback_informe enable row level security;

create policy "Usuarios insertan su propio feedback"
  on feedback_informe for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuarios ven su propio feedback"
  on feedback_informe for select
  to authenticated
  using (auth.uid() = user_id);


-- ============================================================
-- Query de referencia: % de informes marcados como útiles, por herramienta.
-- Corré esto una vez por mes para ver si alguna herramienta se cayó en
-- utilidad percibida (señal de que el prompt necesita un ajuste).
-- ============================================================
select
  herramienta,
  count(*) filter (where util) as util_si,
  count(*) filter (where not util) as util_no,
  round(100.0 * count(*) filter (where util) / nullif(count(*), 0), 1) as pct_util
from feedback_informe
group by herramienta
order by pct_util asc nulls last;
