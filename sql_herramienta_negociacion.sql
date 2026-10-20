-- 1) Habilitar 'negociacion' como herramienta válida en el funnel
-- compartido (mismo mecanismo que con 'cv' y 'plan_carrera' — ver
-- sql_herramienta_cv.sql para el detalle). Esto NO borra filas ni datos
-- ya guardados.
--
-- Si este DROP tira error de que la restricción no existe, corré primero
-- esto para ver el nombre real y usalo acá:
--   select conname from pg_constraint where conrelid = 'eventos_funnel'::regclass;
alter table eventos_funnel drop constraint eventos_funnel_herramienta_check;
alter table eventos_funnel add constraint eventos_funnel_herramienta_check
  check (herramienta in ('entrevista', 'linkedin', 'cv', 'plan_carrera', 'negociacion'));

-- 2) Tabla para los planes de negociación generados, mismo patrón que
-- analisis_cv/analisis_linkedin/planes_transicion.
create table if not exists planes_negociacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  puntaje_posicion numeric,
  creado_en timestamptz not null default now()
);

alter table planes_negociacion enable row level security;

create policy "Usuarios insertan sus propios planes de negociación"
  on planes_negociacion for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuarios ven sus propios planes de negociación"
  on planes_negociacion for select
  to authenticated
  using (auth.uid() = user_id);


-- ============================================================
-- Queries de referencia para esta herramienta nueva
-- ============================================================

-- Total de gente que generó un plan de negociación
select count(distinct user_id) as personas_que_generaron_plan
from planes_negociacion;

-- Embudo completo de la herramienta
select paso, count(distinct user_id) as personas_unicas
from eventos_funnel
where herramienta = 'negociacion'
group by paso
order by array_position(
  array['formulario_visto', 'api_key_valida', 'envio_formulario', 'completado_exito'],
  paso
);

-- Mails de quienes generaron un plan de negociación
select u.email, p.puntaje_posicion, p.creado_en
from planes_negociacion p
join auth.users u on u.id = p.user_id
order by p.creado_en desc;
