-- 1) Habilitar 'cv' como herramienta válida en el funnel compartido.
-- No se puede alterar un CHECK existente directamente: hay que borrarlo y
-- crearlo de nuevo con el valor nuevo incluido. Esto NO borra filas ni datos
-- ya guardados, solo cambia la regla de validación hacia adelante.
--
-- El nombre de la restricción de abajo ("eventos_funnel_herramienta_check")
-- es el que Postgres le pone por default a un CHECK como el que usamos al
-- crear la tabla. Si este DROP tira error de que no existe, corré primero
-- esto para ver el nombre real y usalo en el DROP:
--   select conname from pg_constraint where conrelid = 'eventos_funnel'::regclass;
alter table eventos_funnel drop constraint eventos_funnel_herramienta_check;
alter table eventos_funnel add constraint eventos_funnel_herramienta_check
  check (herramienta in ('entrevista', 'linkedin', 'cv'));

-- 2) Tabla para los análisis de CV completados, mismo patrón que
-- analisis_linkedin (historial + base para las queries de "cuántos lo
-- probaron").
create table if not exists analisis_cv (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modo text not null check (modo in ('dirigido', 'general')),
  puntaje_global numeric,
  creado_en timestamptz not null default now()
);

alter table analisis_cv enable row level security;

create policy "Usuarios insertan sus propios análisis de CV"
  on analisis_cv for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuarios ven sus propios análisis de CV"
  on analisis_cv for select
  to authenticated
  using (auth.uid() = user_id);


-- ============================================================
-- Queries de referencia para esta herramienta nueva
-- ============================================================

-- Total de gente que completó un análisis de CV
select count(distinct user_id) as personas_que_hicieron_cv
from analisis_cv;

-- Embudo completo de la herramienta de CV
select paso, count(distinct user_id) as personas_unicas
from eventos_funnel
where herramienta = 'cv'
group by paso
order by array_position(
  array['formulario_visto', 'api_key_valida', 'envio_formulario', 'completado_exito'],
  paso
);

-- Mails de quienes completaron un análisis de CV
select distinct u.email, a.creado_en
from analisis_cv a
join auth.users u on u.id = a.user_id
order by a.creado_en desc;
