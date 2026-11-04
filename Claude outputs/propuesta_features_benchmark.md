# Propuesta de features: qué construir con lo que encontramos en el benchmark

Cruzando el benchmark con lo que ya existe en el código, los tres pedidos se ordenan naturalmente de más rápido/bajo riesgo a más grande/nuevo. Te los dejo en ese orden, con qué hay hoy, qué falta, y cómo lo construiría.

## 1. Optimizador de CV: pasar a % y mostrar el camino explícito (el más rápido)

Hoy el Optimizador de CV ya hace casi todo lo que el benchmark identificó como el punto débil de la competencia. Jobscan, Teal, Rezi y Resume Worded generan sugerencias de palabras clave genéricas y le advierten al usuario "editalo para que sea verdad, no inventes". Chelaburo ya no tiene ese problema: el prompt actual separa explícitamente las palabras clave que **sí tienen respaldo real en tu experiencia** ("✅ Podés sumar ya", con el lugar puntual del CV donde van) de las que no ("🔲 Todavía no están respaldadas"), y el CV reescrito usa solo contenido verídico. O sea: ya estás ganándole a la competencia en el punto que el benchmark marcó como el vacío más importante de la categoría, solo que no se lo estás diciendo así al usuario.

Lo que falta son dos cosas puntuales:

- **Mostrar los puntajes como porcentaje, no como x/10.** Es un cambio de presentación, no de lógica: el prompt ya le pide a Gemini un puntaje global y tres sub-puntajes. Pasarlo a 0-100% (con más granularidad que 1-10) y ajustar el frontend para mostrarlo como barra/medidor en vez de número.
- **Agregar un párrafo explícito de "camino de mejora"**: algo como "hoy estás en 42%. Si aplicás las 3 acciones de abajo (que ya están basadas en tu experiencia real, no son genéricas) tu compatibilidad subiría a un 85% estimado". Esto conecta el puntaje con las "3 acciones prioritarias" que el informe ya genera, cerrando el círculo que ningún competidor cierra (todos muestran el antes/después retroactivo, después de que editás, nunca una proyección).

Esto es prácticamente un cambio de prompt + un cambio de display. No toca la arquitectura ni la base de datos. Es el que recomendaría hacer primero.

## 2. Simulador de entrevistas: memoria real entre sesiones (el diferenciador más fuerte del benchmark)

Esto es justo lo que el benchmark marcó como el vacío más grande de toda la categoría: ninguna herramienta relevada (ni Yoodli, ni Big Interview, ni Pramp) ajusta la dificultad o el feedback según el historial real de la persona. Solo Huru muestra un gráfico de progreso, pero ni ellos adaptan el ejercicio en base a eso.

La buena noticia es que Chelaburo ya tiene la materia prima para esto sin construir nada de infraestructura nueva: cada simulación queda guardada en la tabla `simulaciones`, atada al `user_id` real de la persona (hay login con Supabase, no es anónimo), con el informe completo (`informe_markdown`) y las 5 notas. Hoy esa información solo se usa para la pantalla pasiva de "Mi Progreso"; nunca se le vuelve a mostrar a la IA.

Lo construiría en 3 pasos, de más simple a más ambicioso:

- **Paso 1 (el que recomendaría hacer ahora):** antes de generar las preguntas de una nueva simulación, si el `user_id` ya tiene sesiones anteriores, el backend busca la última (o las últimas 2-3), saca un resumen corto de los puntos débiles identificados, y lo inyecta como contexto en los prompts de `/api/generar-pregunta` y `/api/informe-final`. Así la IA genuinamente "recuerda": puede preguntar algo parecido a lo que te costó la vez pasada, y el informe final puede decir explícitamente "comparado con tu entrevista anterior, mejoraste en X y seguís teniendo la misma dificultad en Y". Esto también podría reemplazar (para usuarios con historial real) el campo de "¿cuántas entrevistas tuviste en tu vida?" que es autodeclarado, usando en su lugar el historial real de Chelaburo cuando existe, y dejando el autodeclarado solo como fallback para alguien nuevo.
- **Paso 2:** mostrar en la pantalla, antes de arrancar, un cartelito tipo "la vez pasada (12/10) te dijimos que te costaba cerrar con una pregunta para el entrevistador, hoy le vamos a prestar atención a eso" — hace tangible que el sistema "se acuerda", que es exactamente la sensación que ningún competidor da hoy.
- **Paso 3 (más grande, opcional):** una vista de "evolución" dentro de Mi Progreso que identifique patrones repetidos entre sesiones (no solo el gráfico de notas que ya existe), tipo "en 3 de tus últimas 4 entrevistas aparece el mismo comentario sobre X". Esto requeriría que la IA extraiga "temas" estructurados de cada informe (no solo texto libre) para poder agruparlos, así que lo dejaría para una segunda etapa una vez validado que el paso 1 funciona bien.

Esto sí toca el backend (nuevas queries a Supabase antes de llamar a Gemini) pero no requiere cambios de esquema para el paso 1, porque la información ya está guardada.

## 3. LinkedIn: estrategia de contenido y marca personal (el más nuevo y más grande)

Esto es la pieza que menos tiene construido hoy. La herramienta actual de LinkedIn (que además todavía está oculta del menú público, pendiente de pulido) solo optimiza el texto del perfil (headline, About). El benchmark confirma que hay un espacio libre real: Taplio, Supergrow y AuthoredUp (39 a 199 USD/mes, sin plan gratuito de verdad) están armados para creadores y marketers B2B que venden una audiencia, no para alguien buscando trabajo. Ninguno tiene un modo pensado para búsqueda laboral.

Lo armaría como un módulo nuevo (podría ser una pestaña dentro de la herramienta de LinkedIn existente, o una sexta herramienta) con dos capas:

- **Una capa de contenido educativo fijo** (no necesita IA, mismo patrón que ya usás en la Guía de Salida Laboral con `contenidoCarrera.ts`): cómo funciona realmente el algoritmo de LinkedIn explicado simple (la "hora dorada", por qué un comentario largo vale más que un like, por qué los carruseles funcionan mejor que el texto plano), y una cadencia sugerida (2-3 posteos por semana, no todos los días).
- **Una capa generada con IA, personalizada**: a partir del mismo perfil/CV que ya usás en las otras herramientas, Gemini propone 3-6 "pilares de contenido" para esa persona puntual (ej. para alguien de RRHH: aprendizajes del día a día, comentarios sobre tendencias del sector, logros propios sin sonar autobombo) adaptados específicamente a alguien en búsqueda laboral (compartir el proceso de búsqueda, pedir charlas informativas de forma natural, comentar en posteos de empresas objetivo), no a un marketer. Esto es exactamente el "modo para buscador de empleo" que el benchmark confirma que no existe en ningún lado.

Es el build más grande de los tres porque es una funcionalidad nueva de punta a punta (no hay nada parecido hoy en el código), así que la dejaría para después de validar los dos puntos anteriores, y la pensaría con más detalle (qué tan interactivo, si genera posteos concretos listos para pegar o solo ideas/pilares) antes de ponerme a escribir código.

## Orden que recomendaría

1. CV → % + camino de mejora (rápido, bajo riesgo, ya está 80% construido).
2. Simulador → memoria Paso 1 (el diferenciador más fuerte frente a la competencia, y los datos ya existen).
3. LinkedIn → estrategia de contenido (el más grande y más nuevo, conviene scopearlo con más detalle antes de construir).
