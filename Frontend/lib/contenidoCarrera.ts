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
          'Construye el software en sí. **Frontend** arma lo que ve y usa la persona (la pantalla de una app o sitio web). **Backend** arma la lógica que corre "atrás" — qué pasa cuando apretás un botón, cómo se guardan los datos. **Full Stack** hace ambas cosas. **Mobile** se especializa en apps para celular (iOS/Android). Es el área con más roles abiertos del mercado tech en general.',
        herramientas:
          'Depende de la especialización — Frontend: JavaScript/TypeScript, React; Backend: Python, Java, Node.js, SQL; Mobile: Swift/Kotlin o frameworks como React Native/Flutter. Git es transversal a todos.',
      },
      {
        nombre: 'Infraestructura / DevOps / SRE',
        descripcion:
          'Mantiene los sistemas corriendo y disponibles. Automatiza cómo se despliega el software a producción, gestiona los servidores/la nube (AWS, Azure, GCP) y es quien responde cuando algo se cae a las 3 de la mañana. SRE (Site Reliability Engineering) es una variante más enfocada en confiabilidad y métricas de uptime.',
        herramientas: 'AWS / Azure / GCP, Docker, Kubernetes, Terraform, CI/CD (GitHub Actions, Jenkins), Linux, scripting en Bash/Python.',
      },
      {
        nombre: 'Seguridad (Ciberseguridad)',
        descripcion:
          'Protege sistemas y datos de ataques. Incluye desde auditar vulnerabilidades (pentesting) hasta diseñar las políticas de acceso y respuesta ante incidentes. Es un área con alta demanda y relativamente pocos perfiles formados, comparado con Desarrollo.',
        herramientas: 'Nmap, Burp Suite, Metasploit, Wireshark, plataformas SIEM (Splunk), marcos de referencia como ISO 27001 o NIST.',
      },
      {
        nombre: 'QA / Testing',
        descripcion:
          'Prueba el software antes de que llegue a la gente, buscando errores. Puede ser manual (probar a mano distintos flujos) o automatizado (escribir código que prueba el código). Es una puerta de entrada frecuente para gente sin background técnico profundo que quiere sumarse a IT.',
        herramientas: 'Selenium, Cypress, Postman, Jira/Azure DevOps para gestión de bugs.',
      },
      {
        nombre: 'Soporte Técnico / Helpdesk',
        descripcion:
          'Resuelve problemas técnicos del día a día de otros empleados o de clientes externos. Suele ser el primer escalón de IT en muchas empresas y una puerta de entrada común para quien recién arranca en tecnología sin experiencia previa.',
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
          'Analiza datos que ya existen para responder preguntas concretas de negocio: "¿por qué bajaron las ventas en marzo?", "¿qué canal trae mejores clientes?".',
        herramientas: 'SQL, Excel/Google Sheets, Power BI, Tableau o Looker, a veces Python (pandas) para análisis más complejos.',
      },
      {
        nombre: 'Data Scientist',
        descripcion:
          'Va un paso más allá del análisis descriptivo: construye modelos estadísticos y predictivos (¿qué cliente es más probable que se dé de baja?). Requiere más formación matemática/estadística y programación que Data Analyst.',
        herramientas: 'Python, R, SQL, Jupyter Notebooks, librerías como scikit-learn, a veces frameworks de deep learning (TensorFlow, PyTorch).',
      },
      {
        nombre: 'Data Engineer',
        descripcion:
          'Construye y mantiene los "caños" (pipelines) que mueven y ordenan los datos desde donde se generan hasta donde los usan Analysts y Scientists. Es un rol más cercano a Desarrollo que a análisis puro.',
        herramientas: 'Python, SQL, bases de datos (PostgreSQL, bases NoSQL), orquestación de pipelines (Airflow, dbt), plataformas cloud (AWS/GCP), a veces Spark.',
      },
      {
        nombre: 'BI Analyst (Business Intelligence)',
        descripcion:
          'Muy parecido a Data Analyst, con foco específico en reporting y dashboards para que el negocio tome decisiones — suele ser el rol que entrega la "foto" ejecutiva de cómo viene andando la empresa.',
        herramientas: 'SQL, Power BI, Tableau o Looker, Excel.',
      },
      {
        nombre: 'ML Engineer (Machine Learning Engineer)',
        descripcion:
          'Lleva los modelos que arma un Data Scientist y los pone a funcionar en producción, a escala y de forma confiable. Es el puente entre Data Science y Desarrollo/Infraestructura.',
        herramientas: 'Python, TensorFlow/PyTorch, Docker, Kubernetes, plataformas de ML en la nube (SageMaker, Vertex AI).',
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
          'Define QUÉ construir y POR QUÉ, priorizando según impacto de negocio y necesidad real de los usuarios. No programa ni diseña — coordina entre Desarrollo, Diseño y el negocio.',
        herramientas: 'Jira, Notion/Confluence, analytics de producto (Amplitude, Mixpanel), Figma (para revisar, no para diseñar).',
      },
      {
        nombre: 'Product Owner (PO)',
        descripcion:
          'Similar a PM, pero más operativo/táctico: suele trabajar codo a codo con el equipo de desarrollo día a día, gestionando el backlog (típicamente dentro de metodologías ágiles tipo Scrum). En empresas chicas, PM y PO suelen ser la misma persona.',
        herramientas: 'Jira, Trello, Confluence.',
      },
      {
        nombre: 'Product Analyst',
        descripcion:
          'Analiza datos de uso del producto (qué funciones usa la gente, dónde abandona un flujo) para informar las decisiones de Producto. Es el "Data Analyst" especializado en producto.',
        herramientas: 'SQL, Amplitude o Mixpanel, Excel/Google Sheets.',
      },
      {
        nombre: 'UX Researcher',
        descripcion:
          'Investiga de primera mano las necesidades y el comportamiento real de los usuarios: entrevistas, tests de usabilidad, encuestas. Alimenta tanto a Producto como a Diseño.',
        herramientas: 'Testeo remoto (UserTesting, Maze), encuestas (Typeform), Figma.',
      },
      {
        nombre: 'UX/UI Designer',
        descripcion:
          'Diseña la experiencia (UX: el flujo, cómo se siente de usar) y la interfaz (UI: cómo se ve) de un producto digital. *Nota: en muchas empresas este rol reporta a Marketing en vez de a Producto — depende de la estructura de cada compañía, no hay una regla única.*',
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
        descripcion: 'Define la identidad visual de las piezas de marca — el "cómo se ve y se siente" todo lo que publica la empresa. Suele liderar a Diseñadores Gráficos.',
        herramientas: 'Adobe Creative Suite (Photoshop, Illustrator), Figma.',
      },
      {
        nombre: 'Performance Marketing',
        descripcion: 'Gestiona pauta paga (ads en Google, Meta, LinkedIn, etc.) optimizada por métricas concretas de conversión y retorno de inversión. Es de los roles de Marketing más orientados a números.',
        herramientas: 'Google Ads, Meta Ads Manager, Google Analytics, herramientas de atribución/tracking.',
      },
      {
        nombre: 'Diseñador Gráfico',
        descripcion: 'Crea las piezas visuales concretas: posteos de redes, campañas, branding. Trabaja frecuentemente bajo la dirección de un/a Director/a de Arte.',
        herramientas: 'Adobe Photoshop/Illustrator, Canva, Figma.',
      },
      {
        nombre: 'Marketing Digital / Growth',
        descripcion: 'Rol más generalista, a cargo de la estrategia general de canales digitales y del crecimiento (adquisición de usuarios/clientes), combinando varios canales.',
        herramientas: 'Google Analytics, HubSpot, SEO (SEMrush, Ahrefs), email marketing (Mailchimp).',
      },
      {
        nombre: 'Content / Community Manager',
        descripcion: 'Genera contenido (posteos, newsletters, copys) y gestiona la comunidad de la marca en redes sociales — responde comentarios, modera, construye relación con la audiencia.',
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
        descripcion: 'Busca y evalúa candidatos para cubrir posiciones abiertas: publica avisos, hace entrevistas, coordina el proceso hasta la contratación.',
        herramientas: 'LinkedIn Recruiter, ATS (Greenhouse, Lever o similares), plataformas de assessment/evaluación.',
      },
      {
        nombre: 'Capacitación / L&D (Learning & Development)',
        descripcion: 'Diseña y dicta programas de formación interna — desde onboarding hasta programas de liderazgo o habilidades técnicas específicas.',
        herramientas: 'Plataformas LMS (gestión de capacitación), herramientas de diseño instruccional, encuestas de clima/feedback.',
      },
      {
        nombre: 'Compensaciones y Beneficios (C&B)',
        descripcion: 'Define estructuras salariales, bandas de compensación y paquetes de beneficios, buscando que sean competitivos en el mercado y equitativos puertas adentro.',
        herramientas: 'Excel avanzado, encuestas/benchmarks salariales de mercado, HRIS.',
      },
      {
        nombre: 'HRBP (HR Business Partner)',
        descripcion: 'Asesora estratégicamente a los líderes de un área de negocio en todo lo relacionado a personas — no es operativo, es un rol de consultoría interna cercana al negocio.',
        herramientas: 'HRIS, encuestas de engagement/clima, Excel.',
      },
      {
        nombre: 'People Operations',
        descripcion: 'Gestión operativa del ciclo de vida completo del empleado: onboarding, administración de legajos, procesos internos. Es el motor operativo detrás de todo lo que decide HRBP/C&B.',
        herramientas: 'HRIS (Workday, SAP SuccessFactors, BambooHR o similares), Excel.',
      },
      {
        nombre: 'Employer Branding',
        descripcion: 'Construye y comunica la marca empleadora de la empresa — por qué alguien debería querer trabajar ahí — tanto hacia afuera (atraer candidatos) como hacia adentro (retener).',
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
        descripcion: 'Arma proyecciones financieras, presupuestos y análisis de rentabilidad para ayudar a la empresa a tomar decisiones de negocio informadas.',
        herramientas: 'Excel avanzado, Power BI, ERP (SAP u otros), herramientas de modelado financiero.',
      },
      {
        nombre: 'Contador/a',
        descripcion: 'Registra y controla las operaciones contables de la empresa, asegurando cumplimiento con normativa fiscal e impositiva. Suele requerir matrícula profesional.',
        herramientas: 'Sistemas contables (Tango, SAP, Xubio u otros según el mercado), Excel.',
      },
      {
        nombre: 'Tesorería',
        descripcion: 'Gestiona el flujo de caja de la empresa — cuánta plata entra, cuánta sale, cuándo — y las relaciones con bancos e inversiones de corto plazo.',
        herramientas: 'Excel, sistemas bancarios/ERP, herramientas de proyección de flujo de caja.',
      },
      {
        nombre: 'Analista de Costos',
        descripcion: 'Analiza y controla los costos de producción/operación de la empresa, buscando eficiencias e identificando dónde se está gastando de más.',
        herramientas: 'Excel avanzado, ERP, Power BI.',
      },
      {
        nombre: 'Controller',
        descripcion: 'Rol de supervisión financiera integral — suele combinar control de gestión, reporting financiero y asegurar que los números de la empresa sean confiables y estén bajo control.',
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
        descripcion: 'Gestiona el proceso de venta de principio a fin con clientes — desde el primer contacto hasta el cierre.',
        herramientas: 'CRM (Salesforce, HubSpot u otros), LinkedIn Sales Navigator.',
      },
      {
        nombre: 'Account Manager',
        descripcion: 'Gestiona la relación con cuentas ya existentes (clientes activos), buscando retenerlos y hacer crecer esa relación comercial en el tiempo.',
        herramientas: 'CRM, Excel.',
      },
      {
        nombre: 'Key Account Manager (KAM)',
        descripcion: 'Como Account Manager, pero especializado en las cuentas más grandes/estratégicas de la empresa.',
        herramientas: 'CRM, herramientas de reporting ejecutivo.',
      },
      {
        nombre: 'SDR / BDR (Sales/Business Development Representative)',
        descripcion: 'Rol de ventas B2B enfocado en la primera etapa: generar y calificar leads (contactos potenciales) antes de pasárselos a un Ejecutivo de Ventas que cierra el trato. Puerta de entrada muy común al mundo comercial.',
        herramientas: 'CRM, LinkedIn Sales Navigator, prospección/outreach (Apollo, Outreach).',
      },
      {
        nombre: 'Customer Success',
        descripcion: 'Acompaña al cliente DESPUÉS de la venta para asegurarse de que use bien el producto/servicio y vea valor real — el objetivo es que renueve y no se vaya (reducir el "churn").',
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
        descripcion: 'Asesora legalmente a la empresa en sus operaciones del día a día: contratos, relaciones laborales, estructura societaria, entre otros.',
        herramientas: 'Herramientas de gestión documental, bases de jurisprudencia/legislación.',
      },
      {
        nombre: 'Compliance',
        descripcion: 'Se asegura de que la empresa cumpla con regulaciones externas (normativa del sector, leyes de protección de datos, etc.) y con sus propias políticas internas.',
        herramientas: 'Software de gestión de riesgos/compliance, Excel.',
      },
      {
        nombre: 'Legal Tech',
        descripcion: 'Rol más nuevo, en la intersección de Legales y Tecnología — implementa herramientas que automatizan o agilizan procesos legales (gestión de contratos, firma digital, etc.).',
        herramientas: 'Herramientas de automatización/gestión de contratos (DocuSign, Ironclad o similares).',
      },
      {
        nombre: 'Paralegal',
        descripcion: 'Asiste a los abogados en tareas de soporte: investigación, preparación de documentos, organización de expedientes — sin estar habilitado/a para ejercer como abogado/a.',
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
        descripcion: 'Gestiona equipos y métricas de atención al cliente — tiempos de respuesta, satisfacción (NPS), eficiencia operativa de un call/contact center.',
        herramientas: 'Software de call center (Genesys, Zendesk, Aircall o similares), dashboards de métricas.',
      },
      {
        nombre: 'Operaciones Fintech / Producto Financiero',
        descripcion: 'Gestiona procesos operativos específicos de productos financieros: conciliaciones, prevención de fraude, onboarding de usuarios, cumplimiento operativo del día a día.',
        herramientas: 'Herramientas de conciliación, dashboards de monitoreo de fraude, SQL básico en algunos casos.',
      },
      {
        nombre: 'Supply Chain / Logística',
        descripcion: 'Gestiona la cadena de abastecimiento: desde la compra de insumos hasta que el producto llega a destino, optimizando tiempos y costos.',
        herramientas: 'ERP (SAP u otros), sistemas de gestión de almacenes (WMS), Excel.',
      },
      {
        nombre: 'Mejora de Procesos / Calidad (Continuous Improvement)',
        descripcion: 'Aplica metodologías (Lean, Six Sigma, entre otras) para identificar y eliminar ineficiencias en procesos ya existentes de la empresa, en cualquier área.',
        herramientas: 'Herramientas de mapeo de procesos (Visio, Lucidchart), metodologías Lean/Six Sigma.',
      },
    ],
  },
];
