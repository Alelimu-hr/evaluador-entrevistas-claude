-- Suma 'api_key_invalida' como paso válido del embudo (eventos_funnel.paso),
-- para poder distinguir "nunca tocó el campo de la API Key" de "la intentó
-- poner y no pasó la validación" dentro de la caída que hay en ese escalón.
-- Mismo mecanismo que cuando sumamos herramientas nuevas a
-- eventos_funnel.herramienta (ver sql_herramienta_cv.sql). Esto NO borra
-- filas ni datos ya guardados.
--
-- Si este DROP tira error de que la restricción no existe (puede que la
-- columna "paso" nunca haya tenido un CHECK, solo texto libre), no hace
-- falta hacer nada más: el INSERT de 'api_key_invalida' ya va a funcionar
-- sin este paso. Para confirmar el nombre real de la restricción, si la
-- hay, corré primero:
--   select conname from pg_constraint where conrelid = 'eventos_funnel'::regclass;
alter table eventos_funnel drop constraint eventos_funnel_paso_check;
alter table eventos_funnel add constraint eventos_funnel_paso_check
  check (paso in (
    'formulario_visto',
    'api_key_invalida',
    'api_key_valida',
    'envio_formulario',
    'completado_exito'
  ));


-- ============================================================
-- Query de referencia: compara "nunca tocó la key" vs "la intentó y falló"
-- vs "la puso bien", herramienta por herramienta.
-- ============================================================
select
  herramienta,
  count(distinct user_id) filter (where paso = 'formulario_visto') as vio_formulario,
  count(distinct user_id) filter (where paso = 'api_key_invalida') as intento_key_invalida,
  count(distinct user_id) filter (where paso = 'api_key_valida') as logro_key_valida
from eventos_funnel
group by herramienta
order by herramienta;
