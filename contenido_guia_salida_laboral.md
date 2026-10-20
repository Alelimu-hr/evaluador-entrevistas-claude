# Guía de Salida Laboral — Contenido por Área

Resumen de qué hace cada posición, pensado para alguien que no conoce el organigrama típico de esa área. Son descripciones generales — varían según el tamaño y el tipo de empresa. Revisalo y corregime lo que no te cierre, sobre todo fuera de RRHH.

## 💻 IT

### Desarrollo (Dev) — Frontend, Backend, Full Stack, Mobile
Construye el software en sí. **Frontend** arma lo que ve y usa la persona (la pantalla de una app o sitio web). **Backend** arma la lógica que corre "atrás" — qué pasa cuando apretás un botón, cómo se guardan los datos. **Full Stack** hace ambas cosas. **Mobile** se especializa en apps para celular (iOS/Android). Es el área con más roles abiertos del mercado tech en general.
- 🛠️ Herramientas comunes: depende de la especialización — Frontend: JavaScript/TypeScript, React; Backend: Python, Java, Node.js, SQL; Mobile: Swift/Kotlin o frameworks como React Native/Flutter. Git es transversal a todos.

#### Repaso de lenguajes de programación

Lista: **Python, Java, JavaScript, Go, Rust, Ruby, C, C++**. Datos reales de TIOBE (octubre 2026) y Stack Overflow Developer Survey 2025 — aclaración importante: ninguna de las dos fuentes mide "cantidad de vacantes publicadas", sino popularidad de búsquedas/tutoriales (TIOBE) y uso autoreportado por desarrolladores (Stack Overflow). Las uso como la mejor aproximación disponible a "qué tan pedido está", no como un conteo literal de avisos laborales.

**Python**
- A favor: sintaxis simple y rápida de aprender; ecosistema enorme para IA, Data Science y automatización; la comunidad más grande de las ocho.
- En contra: más lento en ejecución que los lenguajes compilados; no es la opción nativa para apps móviles; el GIL limita la concurrencia real con threads.
- Demanda: #1 en TIOBE (19.23%) y en PYPL, con el mayor crecimiento de uso profesional de la lista (+7.3 puntos). Es el lenguaje dominante en IA — aparece en casi la mitad de los repositorios nuevos de IA en GitHub.

**Java**
- A favor: fuertísimo en sistemas corporativos y bancarios (legacy y nuevo); tipado fuerte; corre en cualquier plataforma vía JVM; es el lenguaje nativo de Android.
- En contra: más verboso que las alternativas modernas; configuración/setup más pesado; percepción de "menos moderno" entre devs jóvenes.
- Demanda: es el único de los ocho cuyo uso cayó en la encuesta 2025 (-0.9 puntos), pero sigue con fuerte presencia en empresas grandes — demanda estable aunque menos "de moda".

**JavaScript**
- A favor: el lenguaje nativo (y único) del navegador; ecosistema gigante, también para backend vía Node.js; suele ser la puerta de entrada más fácil al primer trabajo de Dev.
- En contra: solo el 46.8% de quienes lo usan hoy quiere seguir usándolo el año que viene (señal de fatiga); fragmentación constante de frameworks.
- Demanda: el más usado de los ocho por lejos (68.9% de devs profesionales), aunque cada vez más atado a TypeScript (62.8% de sus usuarios también usa TS) — vale la pena mencionarlo como complemento natural.

**Go (Golang)**
- A favor: diseñado para sistemas distribuidos y alta concurrencia; rápido y simple; es el lenguaje de herramientas de infraestructura cloud clave (Docker, Kubernetes).
- En contra: ecosistema de librerías más chico que Python o JS; comunidad más nicho; menos recursos de aprendizaje en español.
- Demanda: más gente quiere aprenderlo (27.4%) que la que ya lo usa (16.5%) — señal clara de demanda creciente, aunque bajó un poco en el ranking TIOBE este último año.

**Rust**
- A favor: seguridad de memoria sin garbage collector; rendimiento altísimo; es el lenguaje más "amado" de la lista — 72.5% de quienes lo usan quiere seguir usándolo.
- En contra: curva de aprendizaje empinada (el "borrow checker" cuesta); ecosistema todavía joven; menos oportunidades abiertas hoy que la demanda de aprenderlo.
- Demanda: el que más subió en TIOBE en el último año (del puesto 18 al 10). Brecha grande entre quienes quieren trabajar con él (34.2%) y quienes ya lo usan (14.9%) — mercado en expansión, conviene presentarlo como una apuesta a futuro más que una salida laboral inmediata y masiva.

**Ruby**
- A favor: sintaxis muy legible y productiva; Ruby on Rails sigue siendo sólido para armar productos rápido.
- En contra: uso decreciente y nicho (menos del 9% de devs profesionales lo usa); menos oportunidades nuevas que hace una década; comunidad más chica.
- Demanda: el más bajo de los ocho en esta comparación — no hay datos de ranking específicos en las fuentes consultadas, lo cual en sí mismo es una señal de que no es donde está el volumen de demanda hoy.

**C**
- A favor: control total sobre hardware y memoria; es la base de sistemas operativos, drivers y sistemas embebidos; extremadamente estable.
- En contra: sin gestión automática de memoria (más riesgo de bugs/vulnerabilidades); curva de aprendizaje alta; no es la opción para desarrollo ágil de producto.
- Demanda: el que más creció en TIOBE este último año (+2.04 puntos, ahora en el puesto #2). Fuerte en sistemas embebidos y firmware, un nicho con poca rotación de lenguaje.

**C++**
- A favor: alto rendimiento con más herramientas modernas que C; estándar en gaming, motores gráficos y sistemas de altísimo rendimiento.
- En contra: lenguaje complejo (muchas formas distintas de resolver lo mismo); más común en ámbito educativo que profesional (40% de estudiantes lo usa vs. 21.8% de profesionales); compilación y setup pesados.
- Demanda: estable en el puesto #3 de TIOBE. Creciendo en IA — sus repositorios de IA en GitHub crecieron 11% en el último año.

**Fuentes:** [TIOBE Index](https://www.tiobe.com/tiobe-index/), [Second Talent — Top Programming Languages by Usage Statistics](https://www.secondtalent.com/resources/top-programming-usage-statistics/)

### Infraestructura / DevOps / SRE
Mantiene los sistemas corriendo y disponibles. Automatiza cómo se despliega el software a producción, gestiona los servidores/la nube (AWS, Azure, GCP) y es quien responde cuando algo se cae a las 3 de la mañana. SRE (Site Reliability Engineering) es una variante más enfocada en confiabilidad y métricas de uptime.
- 🛠️ Herramientas comunes: AWS / Azure / GCP, Docker, Kubernetes, Terraform, CI/CD (GitHub Actions, Jenkins), Linux, scripting en Bash/Python.

### Seguridad (Ciberseguridad)
Protege sistemas y datos de ataques. Incluye desde auditar vulnerabilidades (pentesting) hasta diseñar las políticas de acceso y respuesta ante incidentes. Es un área con alta demanda y relativamente pocos perfiles formados, comparado con Desarrollo.
- 🛠️ Herramientas comunes: Nmap, Burp Suite, Metasploit, Wireshark, plataformas SIEM (Splunk), marcos de referencia como ISO 27001 o NIST.

### QA / Testing
Prueba el software antes de que llegue a la gente, buscando errores. Puede ser manual (probar a mano distintos flujos) o automatizado (escribir código que prueba el código). Es una puerta de entrada frecuente para gente sin background técnico profundo que quiere sumarse a IT.
- 🛠️ Herramientas comunes: Selenium, Cypress, Postman, Jira/Azure DevOps para gestión de bugs.

### Soporte Técnico / Helpdesk
Resuelve problemas técnicos del día a día de otros empleados o de clientes externos. Suele ser el primer escalón de IT en muchas empresas y una puerta de entrada común para quien recién arranca en tecnología sin experiencia previa.
- 🛠️ Herramientas comunes: sistemas de ticketing (Zendesk, Freshdesk, ServiceNow), Active Directory, herramientas de acceso remoto.

---

## 📊 Data

### Data Analyst
Analiza datos que ya existen para responder preguntas concretas de negocio: "¿por qué bajaron las ventas en marzo?", "¿qué canal trae mejores clientes?". Trabaja mucho con SQL, Excel/Google Sheets y herramientas de dashboards (Power BI, Looker, Tableau).
- 🛠️ Herramientas comunes: SQL, Excel/Google Sheets, Power BI, Tableau o Looker, a veces Python (pandas) para análisis más complejos.

### Data Scientist
Va un paso más allá del análisis descriptivo: construye modelos estadísticos y predictivos (¿qué cliente es más probable que se dé de baja?). Requiere más formación matemática/estadística y programación (Python, R) que Data Analyst.
- 🛠️ Herramientas comunes: Python, R, SQL, Jupyter Notebooks, librerías como scikit-learn, a veces frameworks de deep learning (TensorFlow, PyTorch).

### Data Engineer
Construye y mantiene los "caños" (pipelines) que mueven y ordenan los datos desde donde se generan hasta donde los usan Analysts y Scientists. Es un rol más cercano a Desarrollo que a análisis puro.
- 🛠️ Herramientas comunes: Python, SQL, bases de datos (PostgreSQL, bases NoSQL), herramientas de orquestación de pipelines (Airflow, dbt), plataformas cloud (AWS/GCP), a veces Spark.

### BI Analyst (Business Intelligence)
Muy parecido a Data Analyst, con foco específico en reporting y dashboards para que el negocio tome decisiones — suele ser el rol que entrega la "foto" ejecutiva de cómo viene andando la empresa.
- 🛠️ Herramientas comunes: SQL, Power BI, Tableau o Looker, Excel.

### ML Engineer (Machine Learning Engineer)
Lleva los modelos que arma un Data Scientist y los pone a funcionar en producción, a escala y de forma confiable. Es el puente entre Data Science y Desarrollo/Infraestructura.
- 🛠️ Herramientas comunes: Python, TensorFlow/PyTorch, Docker, Kubernetes, plataformas de ML en la nube (SageMaker, Vertex AI).

---

## 🧩 Producto

### Product Manager (PM)
Define QUÉ construir y POR QUÉ, priorizando según impacto de negocio y necesidad real de los usuarios. No programa ni diseña — coordina entre Desarrollo, Diseño y el negocio para que el producto avance en la dirección correcta.
- 🛠️ Herramientas comunes: Jira, Notion/Confluence, herramientas de analytics de producto (Amplitude, Mixpanel), Figma (para revisar, no para diseñar).

### Product Owner (PO)
Similar a PM, pero más operativo/táctico: suele trabajar codo a codo con el equipo de desarrollo día a día, gestionando el backlog de tareas (típicamente dentro de metodologías ágiles tipo Scrum). En muchas empresas chicas, PM y PO son la misma persona.
- 🛠️ Herramientas comunes: Jira, Trello, Confluence.

### Product Analyst
Analiza datos de uso del producto (qué funciones usa la gente, dónde abandona un flujo) para informar las decisiones de Producto. Es el "Data Analyst" especializado en producto.
- 🛠️ Herramientas comunes: SQL, Amplitude o Mixpanel, Excel/Google Sheets.

### UX Researcher
Investiga de primera mano las necesidades y el comportamiento real de los usuarios: entrevistas, tests de usabilidad, encuestas. Su trabajo alimenta tanto a Producto como a Diseño.
- 🛠️ Herramientas comunes: herramientas de testeo remoto (UserTesting, Maze), encuestas (Typeform), Figma.

### UX/UI Designer
Diseña la experiencia (UX: cómo se siente de usar, el flujo) y la interfaz (UI: cómo se ve) de un producto digital. *Nota: en muchas empresas este rol reporta a Marketing en vez de a Producto — dónde vive depende de la estructura de cada compañía, no hay una regla única.*
- 🛠️ Herramientas comunes: Figma (el estándar hoy), Adobe XD, Sketch.

---

## 📣 Marketing

### Dirección de Arte
Define la identidad visual de las piezas de marca — el "cómo se ve y se siente" todo lo que publica la empresa. Suele liderar a Diseñadores Gráficos.
- 🛠️ Herramientas comunes: Adobe Creative Suite (Photoshop, Illustrator), Figma.

### Performance Marketing
Gestiona pauta paga (ads en Google, Meta, LinkedIn, etc.) optimizada por métricas concretas de conversión y retorno de inversión. Es de los roles de Marketing más orientados a números.
- 🛠️ Herramientas comunes: Google Ads, Meta Ads Manager, Google Analytics, herramientas de atribución/tracking.

### Diseñador Gráfico
Crea las piezas visuales concretas: posteos de redes, campañas, branding. Trabaja frecuentemente bajo la dirección de un/a Director/a de Arte.
- 🛠️ Herramientas comunes: Adobe Photoshop/Illustrator, Canva, Figma.

### Marketing Digital / Growth
Rol más generalista, a cargo de la estrategia general de canales digitales y del crecimiento (adquisición de usuarios/clientes) de forma integral, combinando varios canales.
- 🛠️ Herramientas comunes: Google Analytics, HubSpot, herramientas de SEO (SEMrush, Ahrefs), email marketing (Mailchimp).

### Content / Community Manager
Genera contenido (posteos, newsletters, copys) y gestiona la comunidad de la marca en redes sociales — responde comentarios, modera, construye relación con la audiencia.
- 🛠️ Herramientas comunes: Canva, herramientas de programación de posteos (Hootsuite, Buffer, Metricool).

---

## 👥 RRHH

### Selección / Talent Acquisition
Busca y evalúa candidatos para cubrir posiciones abiertas: publica avisos, hace entrevistas, coordina el proceso hasta la contratación.
- 🛠️ Herramientas comunes: LinkedIn Recruiter, ATS (Greenhouse, Lever o similares), plataformas de assessment/evaluación.

### Capacitación / L&D (Learning & Development)
Diseña y dicta programas de formación interna — desde onboarding hasta programas de liderazgo o habilidades técnicas específicas.
- 🛠️ Herramientas comunes: plataformas LMS (gestión de capacitación), herramientas de diseño instruccional, encuestas de clima/feedback.

### Compensaciones y Beneficios (C&B)
Define estructuras salariales, bandas de compensación y paquetes de beneficios, buscando que sean competitivos en el mercado y equitativos puertas adentro.
- 🛠️ Herramientas comunes: Excel avanzado, encuestas/benchmarks salariales de mercado, HRIS.

### HRBP (HR Business Partner)
Asesora estratégicamente a los líderes de un área de negocio en todo lo relacionado a personas — no es operativo, es un rol de consultoría interna cercana al negocio.
- 🛠️ Herramientas comunes: HRIS, encuestas de engagement/clima, Excel.

### People Operations
Gestión operativa del ciclo de vida completo del empleado: onboarding, administración de legajos, procesos internos. Es el motor operativo detrás de todo lo que decide HRBP/C&B.
- 🛠️ Herramientas comunes: HRIS (Workday, SAP SuccessFactors, BambooHR o similares), Excel.

### Employer Branding
Construye y comunica la marca empleadora de la empresa — por qué alguien debería querer trabajar ahí — tanto hacia afuera (atraer candidatos) como hacia adentro (retener).
- 🛠️ Herramientas comunes: LinkedIn, Canva, herramientas de gestión de redes sociales.

---

## 💰 Finanzas

### Analista Financiero (FP&A — Financial Planning & Analysis)
Arma proyecciones financieras, presupuestos y análisis de rentabilidad para ayudar a la empresa a tomar decisiones de negocio informadas.
- 🛠️ Herramientas comunes: Excel avanzado, Power BI, ERP (SAP u otros), herramientas de modelado financiero.

### Contador/a
Registra y controla las operaciones contables de la empresa, asegurando cumplimiento con normativa fiscal e impositiva. Suele requerir matrícula profesional.
- 🛠️ Herramientas comunes: sistemas contables (Tango, SAP, Xubio u otros según el mercado), Excel.

### Tesorería
Gestiona el flujo de caja de la empresa — cuánta plata entra, cuánta sale, cuándo — y las relaciones con bancos e inversiones de corto plazo.
- 🛠️ Herramientas comunes: Excel, sistemas bancarios/ERP, herramientas de proyección de flujo de caja.

### Analista de Costos
Analiza y controla los costos de producción/operación de la empresa, buscando eficiencias e identificando dónde se está gastando de más.
- 🛠️ Herramientas comunes: Excel avanzado, ERP, Power BI.

### Controller
Rol de supervisión financiera integral — suele combinar control de gestión, reporting financiero y asegurar que los números de la empresa sean confiables y estén bajo control.
- 🛠️ Herramientas comunes: ERP (SAP u otros), Excel avanzado, herramientas de reporting (Power BI).

---

## 🤝 Comercial

### Ejecutivo/a de Ventas
Gestiona el proceso de venta de principio a fin con clientes — desde el primer contacto hasta el cierre.
- 🛠️ Herramientas comunes: CRM (Salesforce, HubSpot u otros), LinkedIn Sales Navigator.

### Account Manager
Gestiona la relación con cuentas ya existentes (clientes activos), buscando retenerlos y hacer crecer esa relación comercial en el tiempo.
- 🛠️ Herramientas comunes: CRM, Excel.

### Key Account Manager (KAM)
Como Account Manager, pero especializado en las cuentas más grandes/estratégicas de la empresa.
- 🛠️ Herramientas comunes: CRM, herramientas de reporting ejecutivo.

### SDR / BDR (Sales/Business Development Representative)
Rol de ventas B2B enfocado en la primera etapa: generar y calificar leads (contactos potenciales) antes de pasárselos a un Ejecutivo de Ventas que cierra el trato. Es una puerta de entrada muy común al mundo comercial.
- 🛠️ Herramientas comunes: CRM, LinkedIn Sales Navigator, herramientas de prospección/outreach (Apollo, Outreach).

### Customer Success
Acompaña al cliente DESPUÉS de la venta para asegurarse de que use bien el producto/servicio y vea valor real — el objetivo es que renueve y no se vaya (reducir el "churn").
- 🛠️ Herramientas comunes: CRM, plataformas de customer success (Gainsight, Intercom o similares).

---

## ⚖️ Legales

### Abogado/a Corporativo/a
Asesora legalmente a la empresa en sus operaciones del día a día: contratos, relaciones laborales, estructura societaria, entre otros.
- 🛠️ Herramientas comunes: herramientas de gestión documental, bases de jurisprudencia/legislación.

### Compliance
Se asegura de que la empresa cumpla con regulaciones externas (normativa del sector, leyes de protección de datos, etc.) y con sus propias políticas internas.
- 🛠️ Herramientas comunes: software de gestión de riesgos/compliance, Excel.

### Legal Tech
Rol más nuevo, en la intersección de Legales y Tecnología — implementa herramientas que automatizan o agilizan procesos legales (gestión de contratos, firma digital, etc.).
- 🛠️ Herramientas comunes: herramientas de automatización/gestión de contratos (DocuSign, Ironclad o similares).

### Paralegal
Asiste a los abogados en tareas de soporte: investigación, preparación de documentos, organización de expedientes — sin estar habilitado/a para ejercer como abogado/a.
- 🛠️ Herramientas comunes: herramientas de gestión documental, Excel, bases de jurisprudencia.

---

## ⚙️ Operaciones

### Operaciones de Contact Center / Atención al Cliente
Gestiona equipos y métricas de atención al cliente — tiempos de respuesta, satisfacción (NPS), eficiencia operativa de un call/contact center.
- 🛠️ Herramientas comunes: software de call center (Genesys, Zendesk, Aircall o similares), dashboards de métricas.

### Operaciones Fintech / Producto Financiero
Gestiona procesos operativos específicos de productos financieros: conciliaciones, prevención de fraude, onboarding de usuarios, cumplimiento operativo del día a día.
- 🛠️ Herramientas comunes: herramientas de conciliación, dashboards de monitoreo de fraude, SQL básico en algunos casos.

### Supply Chain / Logística
Gestiona la cadena de abastecimiento: desde la compra de insumos hasta que el producto llega a destino, optimizando tiempos y costos.
- 🛠️ Herramientas comunes: ERP (SAP u otros), sistemas de gestión de almacenes (WMS), Excel.

### Mejora de Procesos / Calidad (Continuous Improvement)
Aplica metodologías (Lean, Six Sigma, entre otras) para identificar y eliminar ineficiencias en procesos ya existentes de la empresa, en cualquier área.
- 🛠️ Herramientas comunes: herramientas de mapeo de procesos (Visio, Lucidchart), metodologías Lean/Six Sigma.
