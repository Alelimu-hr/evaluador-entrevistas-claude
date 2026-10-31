-- Queries de referencia para ver TODAS las métricas de las 5 herramientas
-- (entrevista, linkedin, cv, plan_carrera, negociación) en un solo lugar.
-- No crea ni modifica ninguna tabla — son solo SELECTs para correr en el
-- SQL Editor de Supabase (Database > SQL Editor > New query).
--
-- Tip: después de correr cualquiera de estas queries, arriba a la derecha
-- del resultado hay una pestaña "Chart" — la usás para armar un gráfico de
-- barras o líneas directo sobre el resultado, sin instalar nada. Si querés
-- guardar varias de estas queries + sus gráficos juntos en una sola página
-- que después podés volver a correr con un clic, activá "Explorer" en
-- Project Settings > Feature Previews: te deja armar "Notebooks" (consultas
-- guardadas + gráficos + notas, todo en un solo lugar).


-- ============================================================
-- 1) LA FOTO COMPLETA: una fila por herramienta, con el embudo entero,
-- el total histórico de usos, y el feedback (👍/👎). Esta es la query
-- principal si solo vas a correr una.
-- ============================================================
with funnel as (
  select
    herramienta,
    count(distinct user_id) filter (where paso = 'formulario_visto') as vio_formulario,
    count(distinct user_id) filter (where paso = 'api_key_invalida') as fallo_api_key,
    count(distinct user_id) filter (where paso = 'api_key_valida')   as logro_api_key,
    count(distinct user_id) filter (where paso = 'envio_formulario') as envio_formulario,
    count(distinct user_id) filter (where paso = 'completado_exito') as completo_exito
  from eventos_funnel
  group by herramienta
),
feedback as (
  select
    herramienta,
    count(*) filter (where util)     as feedback_positivo,
    count(*) filter (where not util) as feedback_negativo
  from feedback_informe
  group by herramienta
),
historico as (
  -- Cada herramienta guarda sus resultados en su propia tabla (no hay una
  -- tabla única de "usos"), así que las unimos acá para tener el total.
  select 'entrevista'::text as herramienta, count(*) as total_historico from simulaciones
  union all
  select 'cv', count(*) from analisis_cv
  union all
  select 'linkedin', count(*) from analisis_linkedin
  union all
  select 'plan_carrera', count(*) from planes_transicion
  union all
  select 'negociacion', count(*) from planes_negociacion
)
select
  h.herramienta,
  coalesce(f.vio_formulario, 0)   as vio_formulario,
  coalesce(f.fallo_api_key, 0)    as fallo_api_key,
  coalesce(f.logro_api_key, 0)    as logro_api_key,
  coalesce(f.envio_formulario, 0) as envio_formulario,
  coalesce(f.completo_exito, 0)   as completo_exito,
  round(
    100.0 * coalesce(f.completo_exito, 0) / nullif(f.vio_formulario, 0), 1
  ) as conversion_pct,
  h.total_historico,
  coalesce(fb.feedback_positivo, 0) as feedback_positivo,
  coalesce(fb.feedback_negativo, 0) as feedback_negativo,
  round(
    100.0 * coalesce(fb.feedback_positivo, 0)
    / nullif(coalesce(fb.feedback_positivo, 0) + coalesce(fb.feedback_negativo, 0), 0),
    1
  ) as pct_feedback_util
from historico h
left join funnel f on f.herramienta = h.herramienta
left join feedback fb on fb.herramienta = h.herramienta
order by h.herramienta;


-- ============================================================
-- 2) Solo el embudo, una fila por herramienta (versión más simple de la
-- query de arriba, si la de arriba da error por algo).
-- ============================================================
select
  herramienta,
  count(distinct user_id) filter (where paso = 'formulario_visto') as vio_formulario,
  count(distinct user_id) filter (where paso = 'api_key_invalida') as fallo_api_key,
  count(distinct user_id) filter (where paso = 'api_key_valida')   as logro_api_key,
  count(distinct user_id) filter (where paso = 'envio_formulario') as envio_formulario,
  count(distinct user_id) filter (where paso = 'completado_exito') as completo_exito,
  round(
    100.0 * count(distinct user_id) filter (where paso = 'completado_exito')
    / nullif(count(distinct user_id) filter (where paso = 'formulario_visto'), 0),
    1
  ) as conversion_pct
from eventos_funnel
group by herramienta
order by herramienta;


-- ============================================================
-- 3) Feedback (👍/👎) por herramienta.
-- ============================================================
select
  herramienta,
  count(*) filter (where util)     as positivos,
  count(*) filter (where not util) as negativos,
  round(100.0 * count(*) filter (where util) / nullif(count(*), 0), 1) as pct_util
from feedback_informe
group by herramienta
order by herramienta;


-- ============================================================
-- 4) Tendencia semanal: usuarios nuevos por herramienta, semana a semana.
-- Ideal para el "Chart" como gráfico de líneas (eje X = semana, series =
-- herramienta).
-- ============================================================
select
  date_trunc('week', creado_en)::date as semana,
  herramienta,
  count(distinct user_id) as usuarios_nuevos
from eventos_funnel
where paso = 'formulario_visto'
group by 1, 2
order by 1 desc, 2;


-- ============================================================
-- 5) Qué roles de la Guía de Salida Laboral son los más pedidos (para
-- priorizar qué áreas de contenido reforzar primero).
-- ============================================================
select rol_objetivo, count(*) as veces_pedido
from planes_transicion
group by rol_objetivo
order by veces_pedido desc;
