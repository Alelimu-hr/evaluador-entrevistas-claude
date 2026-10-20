-- 1) Habilitar 'plan_carrera' como herramienta válida en el funnel
-- compartido (mismo mecanismo que cuando agregamos 'cv' — ver
-- sql_herramienta_cv.sql para el detalle de por qué hay que borrar y
-- recrear el CHECK). Esto NO borra filas ni datos ya guardados.
--
-- Si este DROP tira error de que la restricción no existe, corré primero
-- esto para ver el nombre real y usalo acá:
--   select conname from pg_constraint where conrelid = 'eventos_funnel'::regclass;
alter table eventos_funnel drop constraint eventos_funnel_herramienta_check;
alter table eventos_funnel add constraint eventos_funnel_herramienta_check
  check (herramienta in ('entrevista', 'linkedin', 'cv', 'plan_carrera'));

-- 2) Tabla para los planes de transición generados, mismo patrón que
-- analisis_cv/analisis_linkedin (historial + base para las queries de
-- "cuántos lo probaron" y "qué roles son los más buscados").
create table if not exists planes_transicion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area_objetivo text not null,
  rol_objetivo text not null,
  creado_en timestamptz not null default now()
);

alter table planes_transicion enable row level security;

create policy "Usuarios insertan sus propios planes de carrera"
  on planes_transicion for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Usuarios ven sus propios planes de carrera"
  on planes_transicion for select
  to authenticated
  using (auth.uid() = user_id);


-- ============================================================
-- Queries de referencia para esta herramienta nueva
-- ============================================================

-- Total de gente que generó un plan de transición
select count(distinct user_id) as personas_que_generaron_plan
from planes_transicion;

-- Embudo completo de la herramienta
select paso, count(distinct user_id) as personas_unicas
from eventos_funnel
where herramienta = 'plan_carrera'
group by paso
order by array_position(
  array['formulario_visto', 'api_key_valida', 'envio_formulario', 'completado_exito'],
  paso
);

-- Qué roles son los más pedidos (para priorizar qué áreas reforzar primero)
select rol_objetivo, count(*) as veces_pedido
from planes_transicion
group by rol_objetivo
order by veces_pedido desc;

-- Mails de quienes generaron un plan, con el rol al que apuntaron
select u.email, p.area_objetivo, p.rol_objetivo, p.creado_en
from planes_transicion p
join auth.users u on u.id = p.user_id
order by p.creado_en desc;
