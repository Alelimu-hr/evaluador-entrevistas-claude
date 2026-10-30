// Contenido ESTÁTICO (no generado por IA) de la Guía de Salida Laboral —
// decisión deliberada tomada con Ale: la descripción de qué hace cada rol es
// información fáctica que no debería variar entre cargas de página ni correr
// riesgo de que un modelo la invente o la desactualice. Se edita a mano acá,
// no vía prompt. La capa personalizada ("cómo entro a este rol desde el mío")
// es la que en el futuro sí usará IA, aparte de este archivo.

export type RolCarrera = {
  nombre: string;
  descripcion: string; // markdown simple (negrita/itálica), sin títulos
  herramientas: string;
};

export type LenguajeProgramacion = {
  nombre: string;
  aFavor: string;
  enContra: string;
  demanda: string;
};

export type AreaCarrera = {
  slug: string;
  nombre: string;
  emoji: string;
  roles: RolCarrera[];
};

export const LENGUAJES_PROGRAMACION: LenguajeProgramacion[] = [
  {
    nombre: 'Python',
    aFavor: 'Sintaxis simple y rápida de aprender; ecosistema enorme para IA, Data Science y automatización; la comunidad más grande de los ocho.',
    enContra: 'Más lento en ejecución que los lenguajes compilados; no es la opción nativa para apps móviles; el GIL limita la concurrencia real con threads.',
    demanda: '#1 en TIOBE (19.23%) y en PYPL, con el mayor crecimiento de uso profesional de la lista (+7.3 puntos). Es el lenguaje dominante en IA — aparece en casi la mitad de los repositorios nuevos de IA en GitHub.',
  },
  {
    nombre: 'Java',
    aFavor: 'Fuertísimo en sistemas corporativos y bancarios (legacy y nuevo); tipado fuerte; corre en cualquier plataforma vía JVM; es el lenguaje nativo de Android.',
    enContra: 'Más verboso que las alternativas modernas; configuración/setup más pesado; percepción de "menos moderno" entre devs jóvenes.',
    demanda: 'Es el único de los ocho cuyo uso cayó en la encuesta 2025 (-0.9 puntos), pero sigue con fuerte presencia en empresas grandes — demanda estable aunque menos "de moda".',
  },
  {
    nombre: 'JavaScript',
    aFavor: 'El lenguaje nativo (y único) del navegador; ecosistema gigante, también para backend vía Node.js; suele ser la puerta de entrada más fácil al primer trabajo de Dev.',
    enContra: 'Solo el 46.8% de quienes lo usan hoy quiere seguir usándolo el año que viene (señal de fatiga); fragmentación constante de frameworks.',
    demanda: 'El más usado de los ocho por lejos (68.9% de devs profesionales), aunque cada vez más atado a TypeScript (62.8% de sus usuarios también usa TS).',
  },
  {
    nombre: 'Go (Golang)',
    aFavor: 'Diseñado para sistemas distribuidos y alta concurrencia; rápido y simple; es el lenguaje de herramientas de infraestructura cloud clave (Docker, Kubernetes).',
    enContra: 'Ecosistema de librerías más chico que Python o JS; comunidad más nicho; menos recursos de aprendizaje en español.',
    demanda: 'Más gente quiere aprenderlo (27.4%) que la que ya lo usa (16.5%) — demanda creciente, aunque bajó un poco en el ranking TIOBE este último año.',
  },
  {
    nombre: 'Rust',
    aFavor: 'Seguridad de memoria sin garbage collector; rendimiento altísimo; el lenguaje más "amado" de la lista — 72.5% de quienes lo usan quiere seguir usándolo.',
    enContra: 'Curva de aprendizaje empinada (el "borrow checker" cuesta); ecosistema todavía joven; menos oportunidades abiertas hoy que la demanda de aprenderlo.',
    demanda: 'El que más subió en TIOBE en el último año (del puesto 18 al 10). Mercado en expansión — más apuesta a futuro que salida laboral inmediata y masiva.',
  },
  {
    nombre: 'Ruby',
    aFavor: 'Sintaxis muy legible y productiva; Ruby on Rails sigue siendo sólido para armar productos rápido.',
    enContra: 'Uso decreciente y nicho (menos del 9% de devs profesionales lo usa); menos oportunidades nuevas que hace una década; comunidad más chica.',
    demanda: 'El más bajo de los ocho en esta comparación — señal de que no es donde está el volumen de demanda hoy.',
  },
  {
    nombre: 'C',
    aFavor: 'Control total sobre hardware y memoria; es la base de sistemas operativos, drivers y sistemas embebidos; extremadamente estable.',
    enContra: 'Sin gestión automática de memoria (más riesgo de bugs/vulnerabilidades); curva de aprendizaje alta; no es la opción para desarrollo ágil de producto.',
    demanda: 'El que más creció en TIOBE este último año (+2.04 puntos, ahora en el puesto #2). Fuerte en sistemas embebidos y firmware, un nicho con poca rotación de lenguaje.',
  },
  {
    nombre: 'C++',
    aFavor: 'Alto rendimiento con más herramientas modernas que C; estándar en gaming, motores gráficos y sistemas de altísimo rendimiento.',
    enContra: 'Lenguaje complejo (muchas formas distintas de resolver lo mismo); más común en ámbito educativo que profesional; compilación y setup pesados.',
    demanda: 'Estable en el puesto #3 de TIOBE. Creciendo en IA — sus repositorios de IA en GitHub crecieron 11% en el último año.',
  },
];

export const AREAS_CARRERA: AreaCarrera[] = [
  {
    slug: 'it',
    nombre: 'IT',
    emoji: '💻',
    roles: [
      {
        nombre: 'Desarrollo (Dev)',
        descripcion:
          'Construye el software en sí. **Frontend** arma lo que ve y usa la persona (la pantalla de una app o sitio web). **Backend** arma la lógica que corre "atrás" — qué pasa cuando apretás un botón, cómo se guardan los datos. **Full Stack** hace ambas cosas. **Mobile** se especializa en apps para celular (iOS/Android). Es el área con más roles abiertos del mercado tech en general.\n\nEs el área con más demanda sostenida del mercado tech, y también la que más caminos de entrada ofrece: bootcamps, carreras tradicionales, o autodidactas con portfolio propio en GitHub. Para alguien que recién arranca, Frontend suele ser el ingreso más rápido (se ven resultados visuales enseguida, lo que ayuda a mantener la motivación); Backend pide un poco más de lógica y estructuras de datos antes de sentirte productivo. No hace falta saber programar en varios lenguajes para entrar, alcanza con dominar bien uno y entender los fundamentos.',
        herramientas:
          'Depende de la especialización — Frontend: JavaScript/TypeScript, React; Backend: Python, Java, Node.js, SQL; Mobile: Swift/Kotlin o frameworks como React Native/Flutter. Git es transversal a todos.',
      },
      {
        nombre: 'Infraestructura / DevOps / SRE',
        descripcion:
          'Mantiene los sistemas corriendo y disponibles. Automatiza cómo se despliega el software a producción, gestiona los servidores/la nube (AWS, Azure, GCP) y es quien responde cuando algo se cae a las 3 de la mañana. SRE (Site Reliability Engineering) es una variante más enfocada en confiabilidad y métricas de uptime.\n\nRara vez es el primer rol de alguien en IT: la mayoría llega acá después de haber pasado por Desarrollo o Soporte Técnico, entendiendo primero cómo funciona una aplicación antes de encargarse de dónde y cómo corre. Es un área con pocos perfiles senior disponibles en el mercado, así que certificaciones de cloud (AWS, Azure) ayudan mucho a acortar ese camino si venís de otro lado dentro de IT.',
        herramientas: 'AWS / Azure / GCP, Docker, Kubernetes, Terraform, CI/CD (GitHub Actions, Jenkins), Linux, scripting en Bash/Python.',
      },
      {
        nombre: 'Seguridad (Ciberseguridad)',
        descripcion:
          'Protege sistemas y datos de ataques. Incluye desde auditar vulnerabilidades (pentesting) hasta diseñar las políticas de acceso y respuesta ante incidentes. Es un área con alta demanda y relativamente pocos perfiles formados, comparado con Desarrollo.\n\nSe entra desde varios lugares distintos: hay quien arranca directamente estudiando ciberseguridad, y hay quien llega después de haber trabajado en Desarrollo o Infraestructura y se especializa. Las certificaciones (CompTIA Security+, CEH, OSCP según el nivel) pesan bastante acá, más que en otras áreas de IT, porque son una forma rápida de demostrar conocimiento concreto sin depender solo de la experiencia laboral previa.',
        herramientas: 'Nmap, Burp Suite, Metasploit, Wireshark, plataformas SIEM (Splunk), marcos de referencia como ISO 27001 o NIST.',
      },
      {
        nombre: 'QA / Testing',
        descripcion:
          'Prueba el software antes de que llegue a la gente, buscando errores. Puede ser manual (probar a mano distintos flujos) o automatizado (escribir código que prueba el código). Es una puerta de entrada frecuente para gente sin background técnico profundo que quiere sumarse a IT.\n\nEs probablemente la puerta de entrada más accesible a todo IT: muchas posiciones de QA manual no piden experiencia previa en programación, solo atención al detalle y capacidad de pensar "cómo rompería esto". Desde ahí, el camino natural para crecer en sueldo y en demanda es ir sumando QA automatizado (escribir código que testea código), que abre bastante más mercado que quedarse solo en lo manual.',
        herramientas: 'Selenium, Cypress, Postman, Jira/Azure DevOps para gestión de bugs.',
      },
      {
        nombre: 'Soporte Técnico / Helpdesk',
        descripcion:
          'Resuelve problemas técnicos del día a día de otros empleados o de clientes externos. Suele ser el primer escalón de IT en muchas empresas y una puerta de entrada común para quien recién arranca en tecnología sin experiencia previa.\n\nEs, junto con QA, de las entradas más bajas en requisitos formales a todo el mundo IT: muchas empresas solo piden buena comunicación y ganas de resolver problemas, el conocimiento técnico específico se termina de aprender en el puesto. Es un buen punto de partida si todavía no tenés certezas de hacia dónde especializarte, porque desde ahí se ve de cerca cómo funcionan varias áreas de IT antes de elegir una.',
        herramientas: 'Sistemas de ticketing (Zendesk, Freshdesk, ServiceNow), Active Directory, herramientas de acceso remoto.',
      },
    ],
  },
  {
    slug: 'data',
    nombre: 'Data',
    emoji: '📊',
    roles: [
      {
        nombre: 'Data Analyst',
        descripcion:
          'Analiza datos que ya existen para responder preguntas concretas de negocio: "¿por qué bajaron las ventas en marzo?", "¿qué canal trae mejores clientes?".\n\nEs de las puertas de entrada más accesibles al mundo de Data: muchas empresas no piden un título específico, sino manejo de Excel/SQL y capacidad de contar una historia clara con los números. Si venís de otra área y sabés armar reportes o te gusta buscar patrones en información, es un buen primer paso. De acá se suele crecer hacia Data Scientist (sumando estadística y programación) o hacia BI Analyst (profundizando en dashboards).',
        herramientas: 'SQL, Excel/Google Sheets, Power BI, Tableau o Looker, a veces Python (pandas) para análisis más complejos.',
      },
      {
        nombre: 'Data Scientist',
        descripcion:
          'Va un paso más allá del análisis descriptivo: construye modelos estadísticos y predictivos (¿qué cliente es más probable que se dé de baja?). Requiere más formación matemática/estadística y programación que Data Analyst.\n\nNo suele ser el primer rol de alguien que recién entra a Data: la mayoría llega acá después de pasar por Analyst, o viniendo de carreras con base matemática fuerte (ingeniería, estadística, física). Si te interesa este rol pero no tenés esa base, el camino más realista es primero sumar SQL y Python como Analyst, y recién después dar el salto. Es uno de los roles donde más pesa el portfolio propio (proyectos reales, no solo cursos) a la hora de conseguir la primera oportunidad.',
        herramientas: 'Python, R, SQL, Jupyter Notebooks, librerías como scikit-learn, a veces frameworks de deep learning (TensorFlow, PyTorch).',
      },
      {
        nombre: 'Data Engineer',
        descripcion:
          'Construye y mantiene los "caños" (pipelines) que mueven y ordenan los datos desde donde se generan hasta donde los usan Analysts y Scientists. Es un rol más cercano a Desarrollo que a análisis puro.\n\nEs un rol que pide una base más sólida de programación que Data Analyst, por eso muchas veces quienes llegan acá vienen de Desarrollo Backend y se especializan en datos, más que de un camino puramente analítico. Si te gusta más construir sistemas que interpretar resultados, puede ser un mejor fit que Data Scientist o Analyst, aunque el conocimiento de SQL sigue siendo la base común a los tres roles.',
        herramientas: 'Python, SQL, bases de datos (PostgreSQL, bases NoSQL), orquestación de pipelines (Airflow, dbt), plataformas cloud (AWS/GCP), a veces Spark.',
      },
      {
        nombre: 'BI Analyst (Business Intelligence)',
        descripcion:
          'Muy parecido a Data Analyst, con foco específico en reporting y dashboards para que el negocio tome decisiones — suele ser el rol que entrega la "foto" ejecutiva de cómo viene andando la empresa.\n\nComparte casi toda la base técnica con Data Analyst (SQL, dashboards), así que suelen ser roles intercambiables en empresas chicas donde no hay una separación formal entre ambos. La diferencia real aparece en empresas grandes: ahí BI Analyst está más atado a reporting recurrente para el negocio, mientras Data Analyst suele tener más margen para investigar preguntas puntuales y ad hoc.',
        herramientas: 'SQL, Power BI, Tableau o Looker, Excel.',
      },
      {
        nombre: 'ML Engineer (Machine Learning Engineer)',
        descripcion:
          'Lleva los modelos que arma un Data Scientist y los pone a funcionar en producción, a escala y de forma confiable. Es el puente entre Data Science y Desarrollo/Infraestructura.\n\nEs uno de los roles más difíciles de conseguir como primer trabajo en Data: casi siempre se llega acá después de haber sido Data Scientist o Desarrollador Backend, porque exige manejar bien tanto el modelado como la puesta en producción de ese modelo. Si te interesa este camino a largo plazo, el orden más realista es primero afianzarte en Python y alguno de los dos roles de origen, y recién ahí especializarte.',
        herramientas: 'Python, TensorFlow/PyTorch, Docker, Kubernetes, plataformas de ML en la nube (SageMaker, Vertex AI).',
      },
      {
        nombre: 'AI Engineer',
        descripcion:
          'Construye productos y funcionalidades usando modelos de IA ya entrenados (vía APIs de proveedores como OpenAI, Gemini o Anthropic): arma los prompts, conecta la IA con datos propios (RAG), diseña agentes que ejecutan tareas, y se asegura de que las respuestas sean confiables y el costo esté controlado. A diferencia del ML Engineer, no entrena modelos desde cero: integra y hace funcionar modelos que ya existen dentro de un producto real.\n\nEs uno de los roles más nuevos y con demanda más creciente del mercado, y una puerta de entrada relativamente accesible a IA para quien ya programa: no hace falta una maestría en machine learning, alcanza con buen manejo de Backend (especialmente Python) y entender bien cómo funcionan los modelos de lenguaje. Mucha gente llega acá desde Desarrollo Backend, sumando conocimientos de IA generativa. Si además te interesa el lado más matemático de entrenar modelos propios, el crecimiento natural es hacia ML Engineer o Data Scientist.',
        herramientas: 'Python, APIs de modelos (OpenAI, Gemini, Claude/Anthropic), frameworks de orquestación (LangChain, LlamaIndex), bases de datos vectoriales (Pinecone, Chroma), Git.',
      },
    ],
  },
  {
    slug: 'producto',
    nombre: 'Producto',
    emoji: '🧩',
    roles: [
      {
        nombre: 'Product Manager (PM)',
        descripcion:
          'Define QUÉ construir y POR QUÉ, priorizando según impacto de negocio y necesidad real de los usuarios. No programa ni diseña — coordina entre Desarrollo, Diseño y el negocio.\n\nCasi nunca es un primer trabajo: la mayoría de quienes son PM hoy vienen de haber trabajado antes en Desarrollo, Diseño, Data o incluso Ventas, y usan ese conocimiento de un área específica como punto de apoyo para coordinar el resto. Si te interesa este rol a futuro pero estás empezando tu carrera, lo más realista es primero volverte muy bueno en alguna disciplina puntual (la que sea) y recién después dar el salto a Producto.',
        herramientas: 'Jira, Notion/Confluence, analytics de producto (Amplitude, Mixpanel), Figma (para revisar, no para diseñar).',
      },
      {
        nombre: 'Product Owner (PO)',
        descripcion:
          'Similar a PM, pero más operativo/táctico: suele trabajar codo a codo con el equipo de desarrollo día a día, gestionando el backlog (típicamente dentro de metodologías ágiles tipo Scrum). En empresas chicas, PM y PO suelen ser la misma persona.\n\nEn la práctica, suele ser más accesible que Product Manager como primera posición dentro de Producto, porque el foco está puesto en la ejecución día a día con el equipo de desarrollo más que en la estrategia de negocio. Conocer metodologías ágiles (Scrum en particular) ayuda mucho a entrar, incluso sin experiencia previa formal en Producto.',
        herramientas: 'Jira, Trello, Confluence.',
      },
      {
        nombre: 'Product Analyst',
        descripcion:
          'Analiza datos de uso del producto (qué funciones usa la gente, dónde abandona un flujo) para informar las decisiones de Producto. Es el "Data Analyst" especializado en producto.\n\nEs una de las puertas de entrada más directas a Producto para quien viene del mundo de Data: si ya sabés SQL y trabajar con métricas, el salto a analizar específicamente comportamiento de producto (en vez de ventas o finanzas, por ejemplo) no pide aprender herramientas completamente nuevas, sino reorientar el enfoque de análisis.',
        herramientas: 'SQL, Amplitude o Mixpanel, Excel/Google Sheets.',
      },
      {
        nombre: 'UX Researcher',
        descripcion:
          'Investiga de primera mano las necesidades y el comportamiento real de los usuarios: entrevistas, tests de usabilidad, encuestas. Alimenta tanto a Producto como a Diseño.\n\nPide habilidades bastante distintas a UX/UI Designer, aunque a veces se las confunde: acá importa más saber diseñar y moderar una entrevista o un test de usabilidad que saber diseñar visualmente. Viene bien tanto de carreras de diseño como de psicología o sociología, siempre que sumes herramientas concretas de investigación de usuarios.',
        herramientas: 'Testeo remoto (UserTesting, Maze), encuestas (Typeform), Figma.',
      },
      {
        nombre: 'UX/UI Designer',
        descripcion:
          'Diseña la experiencia (UX: el flujo, cómo se siente de usar) y la interfaz (UI: cómo se ve) de un producto digital. *Nota: en muchas empresas este rol reporta a Marketing en vez de a Producto — depende de la estructura de cada compañía, no hay una regla única.*\n\nEs uno de los roles donde más pesa el portfolio a la hora de conseguir la primera oportunidad, mucho más que el título que tengas. Figma es prácticamente un estándar no negociable: dominarlo bien, junto con 2 o 3 proyectos de caso mostrando tu proceso (no solo el resultado final), suele abrir más puertas que una certificación.',
        herramientas: 'Figma (el estándar hoy), Adobe XD, Sketch.',
      },
    ],
  },
  {
    slug: 'marketing',
    nombre: 'Marketing',
    emoji: '📣',
    roles: [
      {
        nombre: 'Dirección de Arte',
        descripcion: 'Define la identidad visual de las piezas de marca — el "cómo se ve y se siente" todo lo que publica la empresa. Suele liderar a Diseñadores Gráficos.\n\nCasi nunca es un primer puesto: se llega acá después de varios años como Diseñador/a Gráfico/a, construyendo tanto el ojo para la identidad visual como la capacidad de dirigir el trabajo de otros diseñadores. Un portfolio sólido y variado importa más que cualquier otra credencial para dar este salto.',
        herramientas: 'Adobe Creative Suite (Photoshop, Illustrator), Figma.',
      },
      {
        nombre: 'Performance Marketing',
        descripcion: 'Gestiona pauta paga (ads en Google, Meta, LinkedIn, etc.) optimizada por métricas concretas de conversión y retorno de inversión. Es de los roles de Marketing más orientados a números.\n\nEs de los roles de Marketing más fáciles de entrar sin un título específico en la materia, porque el conocimiento se valida con resultados medibles (campañas, métricas, ROI) más que con un diploma. Certificaciones gratuitas de Google Ads o Meta Blueprint son un punto de entrada común y bien visto incluso sin experiencia previa.',
        herramientas: 'Google Ads, Meta Ads Manager, Google Analytics, herramientas de atribución/tracking.',
      },
      {
        nombre: 'Diseñador Gráfico',
        descripcion: 'Crea las piezas visuales concretas: posteos de redes, campañas, branding. Trabaja frecuentemente bajo la dirección de un/a Director/a de Arte.\n\nAl igual que UX/UI Designer, acá el portfolio pesa mucho más que el título formal. Es un buen punto de partida dentro de Marketing si te interesa después crecer hacia Dirección de Arte, aunque también es un camino de carrera válido y completo en sí mismo sin necesidad de ese siguiente escalón.',
        herramientas: 'Adobe Photoshop/Illustrator, Canva, Figma.',
      },
      {
        nombre: 'Marketing Digital / Growth',
        descripcion: 'Rol más generalista, a cargo de la estrategia general de canales digitales y del crecimiento (adquisición de usuarios/clientes), combinando varios canales.\n\nEs un rol bastante generalista, así que suele ser más accesible para quien viene de otras áreas de Marketing (Performance, Contenido) y quiere ampliar su manejo de canales, que para alguien completamente nuevo en Marketing. Conviene primero especializarte en un canal (ads, SEO, email) antes de apuntar a este rol más amplio.',
        herramientas: 'Google Analytics, HubSpot, SEO (SEMrush, Ahrefs), email marketing (Mailchimp).',
      },
      {
        nombre: 'Content / Community Manager',
        descripcion: 'Genera contenido (posteos, newsletters, copys) y gestiona la comunidad de la marca en redes sociales — responde comentarios, modera, construye relación con la audiencia.\n\nEs de las entradas más accesibles a Marketing: muchas empresas valoran más la capacidad de escribir bien y entender una comunidad que la experiencia previa formal. Es también un buen punto de partida si después te interesa especializarte en Marketing Digital o en Employer Branding (del lado de RRHH), porque las habilidades de contenido se trasladan bastante bien entre esas dos áreas.',
        herramientas: 'Canva, herramientas de programación de posteos (Hootsuite, Buffer, Metricool).',
      },
    ],
  },
  {
    slug: 'rrhh',
    nombre: 'RRHH',
    emoji: '👥',
    roles: [
      {
        nombre: 'Selección / Talent Acquisition',
        descripcion: 'Busca y evalúa candidatos para cubrir posiciones abiertas: publica avisos, hace entrevistas, coordina el proceso hasta la contratación.\n\nEs la puerta de entrada más común a RRHH: muchas empresas contratan perfiles junior para este rol específicamente, y desde ahí se construye el conocimiento del resto del área. Si recién arrancás en RRHH y no sabés bien hacia dónde especializarte, empezar acá te da visibilidad de cómo funciona toda la organización, lo cual ayuda a elegir después.',
        herramientas: 'LinkedIn Recruiter, ATS (Greenhouse, Lever o similares), plataformas de assessment/evaluación.',
      },
      {
        nombre: 'Capacitación / L&D (Learning & Development)',
        descripcion: 'Diseña y dicta programas de formación interna — desde onboarding hasta programas de liderazgo o habilidades técnicas específicas.\n\nSe llega acá tanto desde Selección (entendiendo primero qué perfiles necesita la empresa) como desde carreras de educación o psicología, aportando la mirada pedagógica. Pesa bastante tener experiencia armando y dictando contenido, no solo diseñándolo en teoría.',
        herramientas: 'Plataformas LMS (gestión de capacitación), herramientas de diseño instruccional, encuestas de clima/feedback.',
      },
      {
        nombre: 'Compensaciones y Beneficios (C&B)',
        descripcion: 'Define estructuras salariales, bandas de compensación y paquetes de beneficios, buscando que sean competitivos en el mercado y equitativos puertas adentro.\n\nEs uno de los roles más técnicos y analíticos de RRHH, por eso quienes llegan acá suelen tener buen manejo de Excel y sentirse cómodos trabajando con números más que la media del área. No es habitual que sea un primer puesto: generalmente se construye después de un tiempo en roles más generalistas de RRHH.',
        herramientas: 'Excel avanzado, encuestas/benchmarks salariales de mercado, HRIS.',
      },
      {
        nombre: 'HRBP (HR Business Partner)',
        descripcion: 'Asesora estratégicamente a los líderes de un área de negocio en todo lo relacionado a personas — no es operativo, es un rol de consultoría interna cercana al negocio.\n\nCasi nunca es un primer trabajo: para asesorar estratégicamente a un líder de negocio hace falta primero haber pasado por la operación de RRHH (Selección, People Ops, o similar) y entender cómo funciona realmente una empresa por dentro. Es de los roles de RRHH con mejor proyección salarial a mediano plazo.',
        herramientas: 'HRIS, encuestas de engagement/clima, Excel.',
      },
      {
        nombre: 'People Operations',
        descripcion: 'Gestión operativa del ciclo de vida completo del empleado: onboarding, administración de legajos, procesos internos. Es el motor operativo detrás de todo lo que decide HRBP/C&B.\n\nEs un buen punto de entrada a RRHH si te interesa más la parte operativa y de procesos que la de relación directa con candidatos. Suele requerir buen manejo de sistemas (HRIS) y atención al detalle, ya que errores acá (legajos, altas, bajas) tienen impacto administrativo y legal directo.',
        herramientas: 'HRIS (Workday, SAP SuccessFactors, BambooHR o similares), Excel.',
      },
      {
        nombre: 'Employer Branding',
        descripcion: 'Construye y comunica la marca empleadora de la empresa — por qué alguien debería querer trabajar ahí — tanto hacia afuera (atraer candidatos) como hacia adentro (retener).\n\nEs un rol relativamente nuevo dentro de RRHH, en la intersección con Marketing, así que no hay un único camino de entrada establecido: se llega tanto desde RRHH (sumando herramientas de comunicación) como desde Marketing o Comunicación (sumando conocimiento de RRHH). Conocer bien las dos áreas es lo que te hace fuerte acá.',
        herramientas: 'LinkedIn, Canva, herramientas de gestión de redes sociales.',
      },
    ],
  },
  {
    slug: 'finanzas',
    nombre: 'Finanzas',
    emoji: '💰',
    roles: [
      {
        nombre: 'Analista Financiero (FP&A)',
        descripcion: 'Arma proyecciones financieras, presupuestos y análisis de rentabilidad para ayudar a la empresa a tomar decisiones de negocio informadas.\n\nEs de las puertas de entrada más comunes a Finanzas corporativas para quien viene de carreras como Administración de Empresas, Economía o Contador Público. El dominio de Excel avanzado es prácticamente no negociable, y es habitual que de acá se crezca hacia Controller con los años.',
        herramientas: 'Excel avanzado, Power BI, ERP (SAP u otros), herramientas de modelado financiero.',
      },
      {
        nombre: 'Contador/a',
        descripcion: 'Registra y controla las operaciones contables de la empresa, asegurando cumplimiento con normativa fiscal e impositiva. Suele requerir matrícula profesional.\n\nA diferencia de otros roles de esta lista, acá sí hace falta matrícula profesional en la mayoría de los casos, así que el camino de entrada está más definido por la formación universitaria que por el portfolio o la experiencia autodidacta. Es una base sólida desde la que después se puede migrar hacia roles más estratégicos como Controller o FP&A.',
        herramientas: 'Sistemas contables (Tango, SAP, Xubio u otros según el mercado), Excel.',
      },
      {
        nombre: 'Tesorería',
        descripcion: 'Gestiona el flujo de caja de la empresa — cuánta plata entra, cuánta sale, cuándo — y las relaciones con bancos e inversiones de corto plazo.\n\nSuele requerir haber pasado antes por roles más generales de Finanzas o Administración, porque implica mucha responsabilidad sobre el flujo de caja real de la empresa desde el primer día. No es habitual que sea el primer trabajo de alguien recién recibido.',
        herramientas: 'Excel, sistemas bancarios/ERP, herramientas de proyección de flujo de caja.',
      },
      {
        nombre: 'Analista de Costos',
        descripcion: 'Analiza y controla los costos de producción/operación de la empresa, buscando eficiencias e identificando dónde se está gastando de más.\n\nEs un buen punto de entrada a Finanzas para quien le interesa más el lado operativo del negocio (producción, logística) que el puramente contable o financiero. Conocer bien el proceso productivo de la empresa es tan importante acá como el manejo de Excel.',
        herramientas: 'Excel avanzado, ERP, Power BI.',
      },
      {
        nombre: 'Controller',
        descripcion: 'Rol de supervisión financiera integral — suele combinar control de gestión, reporting financiero y asegurar que los números de la empresa sean confiables y estén bajo control.\n\nEs un rol de mediana a alta seniority, al que casi siempre se llega después de varios años combinando experiencia en Contabilidad, FP&A o Auditoría. No conviene apuntar a esto como primer trabajo; sí como un objetivo de mediano plazo dentro de Finanzas.',
        herramientas: 'ERP (SAP u otros), Excel avanzado, herramientas de reporting (Power BI).',
      },
    ],
  },
  {
    slug: 'comercial',
    nombre: 'Comercial',
    emoji: '🤝',
    roles: [
      {
        nombre: 'Ejecutivo/a de Ventas',
        descripcion: 'Gestiona el proceso de venta de principio a fin con clientes — desde el primer contacto hasta el cierre.\n\nEs un área donde la actitud y la capacidad de comunicación suelen pesar más que el título universitario a la hora de conseguir el primer puesto. Muchas empresas forman internamente a quien entra con poca experiencia, así que es un camino accesible si te sentís cómodo/a hablando con gente y no te asusta el rechazo (parte inevitable del rubro).',
        herramientas: 'CRM (Salesforce, HubSpot u otros), LinkedIn Sales Navigator.',
      },
      {
        nombre: 'Account Manager',
        descripcion: 'Gestiona la relación con cuentas ya existentes (clientes activos), buscando retenerlos y hacer crecer esa relación comercial en el tiempo.\n\nGeneralmente no es el primer rol dentro de Comercial: se llega acá después de haber demostrado buenos resultados cerrando ventas nuevas, y el foco cambia de "conseguir clientes" a "cuidar y hacer crecer" los que ya existen. Pide más paciencia y visión de largo plazo que Ejecutivo de Ventas puro.',
        herramientas: 'CRM, Excel.',
      },
      {
        nombre: 'Key Account Manager (KAM)',
        descripcion: 'Como Account Manager, pero especializado en las cuentas más grandes/estratégicas de la empresa.\n\nEs un escalón más dentro de Account Management, reservado para quien ya demostró que sabe manejar relaciones comerciales complejas. No es una entrada típica al área comercial, sino un objetivo de mediano plazo.',
        herramientas: 'CRM, herramientas de reporting ejecutivo.',
      },
      {
        nombre: 'SDR / BDR (Sales/Business Development Representative)',
        descripcion: 'Rol de ventas B2B enfocado en la primera etapa: generar y calificar leads (contactos potenciales) antes de pasárselos a un Ejecutivo de Ventas que cierra el trato. Puerta de entrada muy común al mundo comercial.\n\nEs probablemente la puerta de entrada más común a Ventas B2B, sobre todo en empresas de tecnología/SaaS: el trabajo es más repetitivo y medible que el de un Ejecutivo de Ventas, lo cual lo hace más accesible para alguien sin experiencia comercial previa. De acá se suele promocionar a Ejecutivo de Ventas en relativamente poco tiempo si los números acompañan.',
        herramientas: 'CRM, LinkedIn Sales Navigator, prospección/outreach (Apollo, Outreach).',
      },
      {
        nombre: 'Customer Success',
        descripcion: 'Acompaña al cliente DESPUÉS de la venta para asegurarse de que use bien el producto/servicio y vea valor real — el objetivo es que renueve y no se vaya (reducir el "churn").\n\nPide un perfil distinto al de Ventas tradicional: importa más la capacidad de entender el problema del cliente y ayudarlo a resolverlo con el producto, que la de cerrar un trato. Es un buen camino de entrada a Comercial para quien viene de Soporte Técnico o de áreas de atención al cliente y quiere sumar un componente más estratégico a su rol.',
        herramientas: 'CRM, plataformas de customer success (Gainsight, Intercom o similares).',
      },
    ],
  },
  {
    slug: 'legales',
    nombre: 'Legales',
    emoji: '⚖️',
    roles: [
      {
        nombre: 'Abogado/a Corporativo/a',
        descripcion: 'Asesora legalmente a la empresa en sus operaciones del día a día: contratos, relaciones laborales, estructura societaria, entre otros.\n\nComo con Contador/a, acá la matrícula profesional es un requisito excluyente, así que el camino de entrada pasa necesariamente por la carrera universitaria y la habilitación correspondiente. Dentro de esa base, especializarte en un área del derecho relevante para empresas (laboral, societario, contractual) ayuda a diferenciarte.',
        herramientas: 'Herramientas de gestión documental, bases de jurisprudencia/legislación.',
      },
      {
        nombre: 'Compliance',
        descripcion: 'Se asegura de que la empresa cumpla con regulaciones externas (normativa del sector, leyes de protección de datos, etc.) y con sus propias políticas internas.\n\nSe llega tanto desde Legales (abogados que se especializan) como desde Auditoría o Riesgo, dependiendo de si el foco de la empresa es más normativo o más operativo. Es un área en crecimiento, particularmente en sectores regulados como finanzas o salud.',
        herramientas: 'Software de gestión de riesgos/compliance, Excel.',
      },
      {
        nombre: 'Legal Tech',
        descripcion: 'Rol más nuevo, en la intersección de Legales y Tecnología — implementa herramientas que automatizan o agilizan procesos legales (gestión de contratos, firma digital, etc.).\n\nEs un rol nuevo y todavía poco estandarizado, lo que significa que no hay un único camino de entrada correcto: tanto abogados con interés en tecnología como perfiles tech con interés en procesos legales pueden encontrar su lugar acá. Es un buen nicho si te gusta la intersección entre ambos mundos y no te cierra ninguno de los dos caminos.',
        herramientas: 'Herramientas de automatización/gestión de contratos (DocuSign, Ironclad o similares).',
      },
      {
        nombre: 'Paralegal',
        descripcion: 'Asiste a los abogados en tareas de soporte: investigación, preparación de documentos, organización de expedientes — sin estar habilitado/a para ejercer como abogado/a.\n\nEs una puerta de entrada accesible al mundo legal para quien todavía no completó la carrera de abogacía o no quiere ejercer como abogado/a pero le interesa el área. Da experiencia real del día a día de un estudio o departamento legal, útil incluso si después decidís completar la carrera.',
        herramientas: 'Herramientas de gestión documental, Excel, bases de jurisprudencia.',
      },
    ],
  },
  {
    slug: 'operaciones',
    nombre: 'Operaciones',
    emoji: '⚙️',
    roles: [
      {
        nombre: 'Operaciones de Contact Center / Atención al Cliente',
        descripcion: 'Gestiona equipos y métricas de atención al cliente — tiempos de respuesta, satisfacción (NPS), eficiencia operativa de un call/contact center.\n\nEs un rol de gestión al que generalmente se llega después de haber trabajado directamente en atención al cliente, entendiendo primero la operación desde adentro antes de liderarla. El manejo de métricas (tiempos de respuesta, NPS) es tan importante acá como las habilidades de liderazgo de equipos.',
        herramientas: 'Software de call center (Genesys, Zendesk, Aircall o similares), dashboards de métricas.',
      },
      {
        nombre: 'Operaciones Fintech / Producto Financiero',
        descripcion: 'Gestiona procesos operativos específicos de productos financieros: conciliaciones, prevención de fraude, onboarding de usuarios, cumplimiento operativo del día a día.\n\nEs un área relativamente nueva y en crecimiento, así que se nutre tanto de gente con background en Finanzas tradicional como de perfiles más operativos/tech que se suman por el lado de producto. Conocer de cerca regulación financiera es un plus importante, sobre todo en roles de prevención de fraude o cumplimiento operativo.',
        herramientas: 'Herramientas de conciliación, dashboards de monitoreo de fraude, SQL básico en algunos casos.',
      },
      {
        nombre: 'Supply Chain / Logística',
        descripcion: 'Gestiona la cadena de abastecimiento: desde la compra de insumos hasta que el producto llega a destino, optimizando tiempos y costos.\n\nPide conocimiento concreto de cómo funciona la cadena de abastecimiento de punta a punta, así que es habitual que se llegue acá desde carreras de Ingeniería Industrial o Administración con orientación en operaciones. El manejo de ERP es prácticamente estándar en toda la industria.',
        herramientas: 'ERP (SAP u otros), sistemas de gestión de almacenes (WMS), Excel.',
      },
      {
        nombre: 'Mejora de Procesos / Calidad (Continuous Improvement)',
        descripcion: 'Aplica metodologías (Lean, Six Sigma, entre otras) para identificar y eliminar ineficiencias en procesos ya existentes de la empresa, en cualquier área.\n\nNo suele ser un primer trabajo: se necesita primero conocer bien cómo funciona una operación (de cualquier área) para después poder identificar dónde mejorarla. Certificaciones en metodologías como Lean o Six Sigma ayudan mucho a formalizar ese conocimiento y a conseguir el salto a este rol.',
        herramientas: 'Herramientas de mapeo de procesos (Visio, Lucidchart), metodologías Lean/Six Sigma.',
      },
    ],
  },
  {
    slug: 'educacion',
    nombre: 'Educación',
    emoji: '🎓',
    roles: [
      {
        nombre: 'Contenidista / Diseñador Instruccional',
        descripcion:
          'Diseña y produce el contenido educativo en sí: guiones de clases, materiales de estudio, ejercicios y evaluaciones, aplicando principios de diseño instruccional para que el contenido realmente enseñe (no solo informe). Trabaja en conjunto con el área Académica para asegurar que el contenido sea correcto y esté actualizado.\n\nEs una puerta de entrada frecuente a ed-tech para gente que viene del mundo docente o de comunicación/redacción, sin necesidad de experiencia previa en tecnología. Ayuda mucho haber dado clases o escrito contenido educativo en cualquier formato, aunque haya sido de forma informal. Desde acá se suele crecer hacia Líder Académico (si el interés es más pedagógico) o hacia Producto (si el interés es más de diseño de la experiencia de aprendizaje en general).',
        herramientas: 'Herramientas de autor de e-learning (Articulate, Canva, Genially), procesadores de texto/presentaciones, plataformas LMS para publicar el contenido.',
      },
      {
        nombre: 'Líder Académico / Coordinador Pedagógico',
        descripcion:
          'Define los lineamientos pedagógicos de los programas: qué se enseña, en qué orden y con qué metodología, y se asegura de que el contenido y los tutores/docentes cumplan con ese estándar de calidad educativa. Suele venir con formación docente o en ciencias de la educación.\n\nCasi nunca es el primer rol de alguien en ed-tech: se llega acá con experiencia real previa dando clases o coordinando equipos docentes, ya sea en educación tradicional o en otra ed-tech. Si te interesa este camino pero estás arrancando, Contenidista o Tutor son los pasos previos más naturales para sumar esa experiencia primero.',
        herramientas: 'Plataformas LMS, herramientas de seguimiento de indicadores académicos (deserción, aprobación), Excel/Google Sheets.',
      },
      {
        nombre: 'Tutor / Docente Online',
        descripcion:
          'Acompaña a los estudiantes durante el curso: responde dudas, corrige entregas, da feedback y motiva a que no abandonen el proceso. Puede ser en vivo (clases sincrónicas) o asincrónico (foros, mensajes, corrección de tareas).\n\nEs la puerta de entrada más accesible a toda el área de Educación: muchas ed-tech contratan tutores con dedicación parcial y sin pedir experiencia previa en el rubro, solo dominio del tema que se enseña y buena comunicación. Es un buen punto de partida si te gusta enseñar pero todavía no tenés el perfil para roles de diseño de contenido o coordinación.',
        herramientas: 'Plataformas LMS (Moodle, Canvas o propias de cada ed-tech), videollamada (Zoom, Google Meet), foros/mensajería interna.',
      },
      {
        nombre: 'Coordinador de Programas Educativos',
        descripcion:
          'Gestiona la logística operativa de que un programa o curso suceda: calendarios, inscripciones, asignación de tutores/docentes a cada grupo, y comunicación con los estudiantes sobre fechas y requisitos. Es un rol más operativo que pedagógico.\n\nEs accesible para quien viene de Operaciones o Atención al Cliente en cualquier industria y quiere sumarse a ed-tech, no hace falta background docente. La organización, el manejo de varias tareas en simultáneo y la buena comunicación pesan más acá que el conocimiento pedagógico en sí.',
        herramientas: 'LMS, CRM o planillas de seguimiento de estudiantes, herramientas de comunicación masiva (email marketing, WhatsApp Business).',
      },
    ],
  },
  {
    slug: 'construccion',
    nombre: 'Construcción / Arquitectura / Ingeniería',
    emoji: '🏗️',
    roles: [
      {
        nombre: 'Arquitecto/a',
        descripcion:
          'Diseña espacios y edificios, desde el anteproyecto hasta los planos ejecutivos, balanceando estética, funcionalidad y normativa de construcción vigente. Puede trabajar en estudios de arquitectura, desarrolladoras inmobiliarias o de forma independiente.\n\nRequiere matrícula profesional habilitante (colegio de arquitectos de la jurisdicción) para firmar planos y ejercer formalmente, así que no es un camino 100% autodidacta. El primer empleo suele ser en un estudio de arquitectura como dibujante/proyectista, sumando experiencia real antes de liderar proyectos propios.',
        herramientas: 'AutoCAD, Revit (BIM), SketchUp, Illustrator/Photoshop para presentaciones.',
      },
      {
        nombre: 'Ingeniero/a Civil',
        descripcion:
          'Diseña y supervisa la parte estructural y técnica de una obra (cimientos, estructura, cálculo de cargas), asegurando que lo que diseña el arquitecto sea seguro y viable de construir.\n\nComo Arquitectura, exige matrícula profesional para ejercer formalmente y firmar cálculos estructurales. Suele trabajar codo a codo con Arquitectura desde las primeras etapas del proyecto, así que entender bien ambas disciplinas ayuda a progresar más rápido en la carrera.',
        herramientas: 'AutoCAD, software de cálculo estructural (SAP2000, ETABS), Revit.',
      },
      {
        nombre: 'Jefe/a de Obra / Project Manager de Obra',
        descripcion:
          'Coordina la ejecución de la obra en el día a día: equipos de trabajo, proveedores, cronograma y presupuesto, asegurando que lo que está en los planos se construya en tiempo y forma.\n\nCasi nunca es un primer trabajo: se llega acá después de haber pasado por roles técnicos en obra (como Arquitecto/a, Ingeniero/a Civil o Maestro Mayor de Obras) y haber demostrado capacidad de gestión y liderazgo de equipos en terreno.',
        herramientas: 'MS Project o software de gestión de obra, Excel, herramientas de seguimiento de certificaciones de avance.',
      },
      {
        nombre: 'Computista / Presupuestista',
        descripcion:
          'Calcula con precisión los costos de un proyecto de construcción: materiales, mano de obra, tiempos, antes y durante la obra, para que el presupuesto se cumpla y no haya sorpresas.\n\nEs un rol con alta demanda y relativamente pocos perfiles especializados, porque combina conocimiento técnico de construcción con manejo detallado de números. Buen punto de entrada para quien viene de Arquitectura, Ingeniería o Administración de Empresas con interés en el rubro.',
        herramientas: 'Excel avanzado, software de cómputo y presupuesto (Presto, Devexa u otros según el mercado), AutoCAD para medir planos.',
      },
      {
        nombre: 'Comprador/a de Materiales (Procurement de Obra)',
        descripcion:
          'Gestiona la compra de materiales e insumos para la obra: cotiza proveedores, negocia precios y plazos de entrega, y se asegura de que el material llegue a tiempo para no frenar el avance de la construcción.\n\nEs un rol accesible para quien viene de Compras/Procurement en cualquier industria y quiere sumarse a Construcción, no hace falta formación técnica específica, aunque ayuda mucho conocer los materiales del rubro.',
        herramientas: 'ERP o sistemas de gestión de compras, Excel, relación directa con proveedores/corralones.',
      },
    ],
  },
  {
    slug: 'medios',
    nombre: 'Medios / Comunicación / Producción Audiovisual',
    emoji: '🎬',
    roles: [
      {
        nombre: 'Periodista / Redactor/a',
        descripcion:
          'Investiga, escribe y edita notas, artículos o guiones informativos para medios tradicionales o digitales, verificando datos y fuentes antes de publicar.\n\nSe entra tanto desde la carrera de Periodismo o Comunicación como de forma autodidacta, construyendo un portfolio de notas publicadas (incluso en blog propio o medios chicos) que demuestre capacidad de investigar y escribir con claridad. Desde acá se suele crecer hacia edición, coordinación de contenidos o especializarse en un tema puntual (economía, tecnología, deportes).',
        herramientas: 'CMS de publicación (WordPress u otros), herramientas de verificación de fuentes, Google Docs/Sheets.',
      },
      {
        nombre: 'Editor/a de Video',
        descripcion:
          'Arma el producto audiovisual final a partir del material filmado: corte, ritmo, color, sonido y efectos, adaptando el video al formato y plataforma donde se va a publicar.\n\nEs una de las puertas de entrada más accesibles a producción audiovisual: se puede aprender de forma autodidacta y armar un portfolio propio sin necesidad de un título formal, aunque la competencia es alta por lo mismo. Un buen reel con 3 o 4 trabajos sólidos suele pesar más que cualquier curso a la hora de conseguir el primer cliente o trabajo.',
        herramientas: 'Adobe Premiere Pro, After Effects, DaVinci Resolve, CapCut para formatos cortos.',
      },
      {
        nombre: 'Productor/a Audiovisual',
        descripcion:
          'Organiza todo lo necesario para que una producción (un video, una serie, un evento filmado) suceda: presupuesto, locaciones, equipo técnico, cronograma de rodaje y logística general.\n\nPide experiencia previa real en sets de filmación, así que el camino típico es empezar en roles de asistencia de producción y escalar a cargo de la producción completa con el tiempo. La capacidad de resolver problemas bajo presión (algo siempre se complica en un rodaje) es tan importante como el conocimiento técnico.',
        herramientas: 'Planillas de producción/presupuesto, software de gestión de proyectos, contactos de proveedores del rubro (equipos, locaciones).',
      },
      {
        nombre: 'Conductor/a / Locutor/a',
        descripcion:
          'Presenta y conduce contenido en vivo o grabado (radio, streaming, eventos, videos institucionales), con buena dicción y capacidad de improvisar y sostener la atención de la audiencia.\n\nEs un rol donde el talento y la presencia en cámara/micrófono pesan más que el título, aunque formarse en locución ayuda con la técnica de voz. Muchas veces se arranca en formatos chicos (streaming propio, radio local) antes de llegar a proyectos con más alcance.',
        herramientas: 'Software de streaming (OBS Studio), consola de audio básica, teleprompter en formatos más profesionales.',
      },
    ],
  },
  {
    slug: 'inmobiliario',
    nombre: 'Real Estate / Inmobiliario',
    emoji: '🏠',
    roles: [
      {
        nombre: 'Corredor/a Inmobiliario / Agente de Ventas',
        descripcion:
          'Intermedia entre quien vende/alquila una propiedad y quien busca comprarla/alquilarla: capta propiedades, las muestra, negocia condiciones y acompaña hasta el cierre de la operación.\n\nEn Argentina requiere matrícula de Corredor Inmobiliario (según la jurisdicción) para ejercer de forma independiente y cobrar comisión, aunque muchas inmobiliarias contratan agentes junior sin matrícula propia para que vayan sumando experiencia bajo la matrícula de la empresa. La cartera de contactos y la capacidad comercial pesan mucho más que el título a la hora de generar ingresos.',
        herramientas: 'Portales inmobiliarios (Zonaprop, Argenprop), CRM inmobiliario, redes sociales para mostrar propiedades.',
      },
      {
        nombre: 'Tasador/a',
        descripcion:
          'Determina el valor de mercado de una propiedad, analizando ubicación, estado, comparables de la zona y condiciones del mercado, para operaciones de compraventa, créditos hipotecarios o sucesiones.\n\nSuele requerir formación específica en tasaciones (a veces con matrícula propia según la jurisdicción) y conocimiento profundo del mercado de la zona donde se trabaja. Es un buen camino de especialización para alguien que ya viene del mundo inmobiliario o de la construcción y quiere un rol más técnico y menos comercial.',
        herramientas: 'Bases de datos de comparables de mercado, planillas de cálculo, informes catastrales.',
      },
      {
        nombre: 'Property Manager / Administrador de Propiedades',
        descripcion:
          'Gestiona el día a día de una o varias propiedades en alquiler por cuenta de su dueño: cobra alquileres, coordina mantenimiento y reparaciones, y resuelve problemas con inquilinos.\n\nEs un rol accesible para quien viene de Atención al Cliente u Operaciones, no hace falta matrícula ni formación específica en la mayoría de los casos, aunque ayuda mucho ser organizado y resolutivo. Con la gestión de propiedades para alquiler temporario (tipo Airbnb) en alza, es un área con demanda creciente.',
        herramientas: 'Software de gestión de alquileres, Excel, plataformas de alquiler temporario si aplica.',
      },
      {
        nombre: 'Desarrollador/a Inmobiliario (Gestión de Proyectos)',
        descripcion:
          'Lidera un proyecto inmobiliario de punta a punta, desde la compra del terreno hasta la venta de las unidades: coordina arquitectos, constructoras, financiamiento y comercialización.\n\nEs un rol de alta responsabilidad al que casi nunca se llega como primer trabajo: se necesita experiencia previa real en Construcción, Finanzas o Comercial inmobiliario antes de liderar un proyecto propio. No conviene apuntar a esto como punto de partida, sí como un objetivo de carrera de mediano a largo plazo dentro del rubro.',
        herramientas: 'Excel avanzado (modelos financieros de proyecto), software de gestión de proyectos, relación con bancos/financiamiento.',
      },
    ],
  },
  {
    slug: 'industria',
    nombre: 'Industria / Manufactura',
    emoji: '🏭',
    roles: [
      {
        nombre: 'Ingeniero/a de Procesos',
        descripcion:
          'Diseña y optimiza los procesos de producción de una planta industrial, buscando mejorar eficiencia, calidad y costos, y resolviendo problemas técnicos que surgen en la línea de producción.\n\nRequiere formación en Ingeniería (industrial, química, mecánica u otra según el rubro de la planta), y suele ser un buen primer trabajo técnico para quien recién se recibe, trabajando primero bajo la supervisión de ingenieros más senior.',
        herramientas: 'Software de simulación de procesos, Excel, metodologías de mejora continua (Lean, Six Sigma).',
      },
      {
        nombre: 'Jefe/a de Planta',
        descripcion:
          'Responsable integral de la operación de una planta productiva: gestiona al equipo, los objetivos de producción, el cumplimiento de normas de calidad y seguridad, y el presupuesto operativo.\n\nEs un rol de liderazgo al que se llega después de varios años de experiencia en producción industrial, generalmente habiendo pasado antes por roles como Ingeniero/a de Procesos o supervisión de línea. No es un primer trabajo; sí un objetivo de mediano plazo dentro de la industria.',
        herramientas: 'ERP de producción (SAP u otros), indicadores de productividad (OEE), Excel avanzado.',
      },
      {
        nombre: 'Mantenimiento Industrial',
        descripcion:
          'Se encarga de que la maquinaria y los equipos de la planta funcionen correctamente: mantenimiento preventivo programado y reparaciones cuando algo falla, para minimizar tiempos de parada de producción.\n\nEs una puerta de entrada técnica accesible para quien tiene formación en electromecánica, electricidad industrial o similar, incluso de nivel terciario (no siempre se exige título universitario). La experiencia práctica con maquinaria pesa mucho más que la formación teórica sola.',
        herramientas: 'Software de gestión de mantenimiento (CMMS), herramientas específicas según el tipo de maquinaria, planes de mantenimiento preventivo.',
      },
      {
        nombre: 'Seguridad e Higiene (Seguridad Laboral)',
        descripcion:
          'Diseña e implementa las políticas de seguridad de la planta para prevenir accidentes laborales, capacita al personal, y asegura el cumplimiento de la normativa vigente en la materia.\n\nRequiere formación específica (Técnico/a o Licenciado/a en Higiene y Seguridad) y en muchos casos matrícula profesional para firmar informes técnicos. Es un área con demanda estable porque la normativa laboral exige tener a alguien a cargo de esto en cualquier planta industrial.',
        herramientas: 'Normativa de seguridad e higiene laboral vigente, planillas de relevamiento de riesgos, software de gestión de capacitaciones.',
      },
    ],
  },
  {
    slug: 'ong',
    nombre: 'Sector Social / ONG',
    emoji: '🤲',
    roles: [
      {
        nombre: 'Coordinador/a de Proyectos Sociales',
        descripcion:
          'Planifica y ejecuta proyectos con impacto social (educativos, de salud, ambientales, entre otros): define objetivos, coordina al equipo y a los beneficiarios, y se asegura de que el proyecto se cumpla en tiempo y con los recursos disponibles.\n\nSe valora mucho la experiencia previa de campo (haber trabajado directamente con la comunidad o población objetivo) además de capacidad de gestión de proyectos. Es un camino accesible tanto desde carreras sociales (Trabajo Social, Ciencias Sociales) como desde perfiles de gestión que quieren aportar en el sector.',
        herramientas: 'Herramientas de gestión de proyectos, Excel/Google Sheets, a veces marcos de trabajo específicos (marco lógico).',
      },
      {
        nombre: 'Fundraising / Desarrollo de Fondos',
        descripcion:
          'Consigue los recursos económicos que la organización necesita para funcionar: arma propuestas para donantes y financiadores (individuos, empresas, organismos internacionales) y gestiona esas relaciones en el tiempo.\n\nCombina habilidades comerciales/de relación con conocimiento del sector social, así que es un buen camino para quien viene de Ventas o Marketing y quiere orientar esas habilidades hacia un propósito social. La capacidad de escribir propuestas claras y convincentes es clave para crecer en este rol.',
        herramientas: 'CRM de donantes, herramientas de redacción de propuestas, plataformas de crowdfunding si aplica.',
      },
      {
        nombre: 'Voluntariado y Comunidad',
        descripcion:
          'Recluta, capacita y coordina a los voluntarios de la organización, asegurando que tengan una buena experiencia y que su trabajo esté bien organizado y alineado con los objetivos del proyecto.\n\nEs una puerta de entrada frecuente al sector social, muchas veces para quien empezó como voluntario/a en la misma organización y fue asumiendo responsabilidades de coordinación. Las habilidades de comunicación y organización de personas pesan más que un título específico.',
        herramientas: 'Planillas de seguimiento de voluntarios, herramientas de comunicación grupal (WhatsApp, Slack), redes sociales.',
      },
      {
        nombre: 'Monitoreo y Evaluación de Impacto',
        descripcion:
          'Mide si los proyectos de la organización realmente están logrando el impacto que buscan: diseña indicadores, recolecta datos y arma informes para la organización y para los financiadores.\n\nEs un rol más técnico y analítico dentro del sector social, donde ayuda mucho tener formación o experiencia en investigación social, estadística o Data Analyst. Si te gusta el lado social pero también los números, es un buen punto de encuentro entre ambos intereses.',
        herramientas: 'Excel/Google Sheets, herramientas de encuestas (Google Forms, KoboToolbox), a veces SQL o Power BI en organizaciones más grandes.',
      },
    ],
  },
  {
    slug: 'salud',
    nombre: 'Salud (Gestión)',
    emoji: '🏥',
    roles: [
      {
        nombre: 'Administración de Clínicas / Centros de Salud',
        descripcion:
          'Gestiona la operación administrativa de una institución de salud: turnos, facturación a obras sociales/prepagas, recursos humanos del centro y cumplimiento de normativa sanitaria.\n\nEs un rol de gestión accesible desde carreras de Administración, sin necesidad de formación médica, aunque conocer el funcionamiento del sistema de salud y las obras sociales/prepagas es clave para desempeñarse bien. Se valora mucho la experiencia previa en administración de salud específicamente, por la cantidad de normativa particular del sector.',
        herramientas: 'Sistemas de gestión hospitalaria/de turnos, Excel, conocimiento de facturación a obras sociales y prepagas.',
      },
      {
        nombre: 'Asuntos Regulatorios (Industria Farmacéutica)',
        descripcion:
          'Se asegura de que los medicamentos y productos de la empresa cumplan con toda la normativa sanitaria para poder fabricarse, importarse y venderse legalmente (ANMAT en Argentina, y organismos equivalentes en otros países).\n\nRequiere formación específica (generalmente Farmacia, Bioquímica o carreras afines) y conocimiento profundo de la normativa del sector, que es compleja y cambia con frecuencia. Es un rol con alta demanda dentro de laboratorios farmacéuticos y relativamente pocos perfiles formados.',
        herramientas: 'Normativa de ANMAT (o el organismo regulador correspondiente), software de gestión documental regulatoria, Excel.',
      },
      {
        nombre: 'Farmacovigilancia',
        descripcion:
          'Monitorea la seguridad de los medicamentos una vez que ya están en el mercado: recibe y analiza reportes de efectos adversos, y se asegura de que se informen correctamente a las autoridades sanitarias.\n\nTambién requiere formación en ciencias de la salud (Farmacia, Medicina, Enfermería) y suele ser un área donde se valora mucho la precisión y el detalle, porque los reportes tienen implicancias regulatorias y de seguridad real. Convive de cerca con Asuntos Regulatorios dentro de un laboratorio farmacéutico.',
        herramientas: 'Bases de datos de farmacovigilancia, normativa sanitaria vigente, herramientas de gestión documental.',
      },
      {
        nombre: 'Coordinador/a de Ensayos Clínicos',
        descripcion:
          'Organiza y supervisa el desarrollo de un ensayo clínico en un centro de salud: coordina a los pacientes voluntarios, al equipo médico y asegura que el estudio cumpla con el protocolo y la normativa ética y sanitaria.\n\nRequiere formación en ciencias de la salud (Enfermería, Medicina, Bioquímica u otra carrera afín) y suele exigir capacitación específica en Buenas Prácticas Clínicas (BPC/GCP). Es un rol con buena demanda dentro de la industria farmacéutica y centros de investigación médica.',
        herramientas: 'Software de gestión de ensayos clínicos, normativa de Buenas Prácticas Clínicas (GCP), planillas de seguimiento de pacientes.',
      },
    ],
  },
];
