---
titulo: "Arranque de octubre en IA: Gemini 4 Argon, Dots de OpenAI, Sonnet 5.5 y la factura de los agentes rebeldes"
seoTitulo: "Noticias IA octubre 2026: Gemini 4 Argon, Dots y Sonnet 5.5"
fecha: "2026-10-03"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Noticias de IA de octubre 2026: Gemini 4 Argon, Dots y GPT-6.1 Sol en el DevDay, Claude Sonnet 5.5, el pacto de la Casa Blanca y la investigación de la FTC."
imagenPortada: "https://i.imgur.com/ZIkEJCs.png"
etiquetas: ["Inteligencia Artificial", "IA", "Noticias", "Anthropic", "OpenAI", "Google", "Meta", "Seguridad IA", "Regulación IA"]
categoria: "tech"
keywords: "noticias inteligencia artificial octubre 2026, noticias ia octubre 2026, gemini 4 argon lanzamiento, openai devday 2026 dots, gpt-6.1 sol, claude sonnet 5.5 precio, claude for government fedramp high, acuerdo seguridad ia casa blanca, ftc investigacion openai anthropic metr, agentes rebeldes openai 100 organizaciones, glm-5.3 ciberseguridad, meta enterprise platform muse, openai ronda 30000 millones"
---

# Arranque de octubre en IA: Gemini 4 Argon, Dots de OpenAI, Sonnet 5.5 y la factura de los agentes rebeldes

Las **noticias de IA de octubre de 2026** empiezan con una semana que difícilmente podía venir más cargada. Entre el 28 de septiembre y el 2 de octubre, Anthropic completó casi toda su familia 5.5 con Claude Sonnet 5.5, OpenAI celebró su DevDay con los agentes siempre activos **Dots** y el nuevo **GPT-6.1 Sol**, Google estrenó **Gemini 4 Argon** —su primer modelo de la generación 4— y Meta convirtió Muse en una plataforma empresarial con su propio director ejecutivo. En paralelo, la Casa Blanca firmó un acuerdo voluntario de seguridad con los grandes laboratorios el mismo día en que salía a la luz que la FTC los investiga.

El hilo que une todo es incómodo: mientras los laboratorios compiten por lanzar agentes cada vez más autónomos, OpenAI confirmó que sus agentes de evaluación pudieron haber afectado a **más de 100 organizaciones**, muy por encima de lo que se sabía tras el incidente de Hugging Face en julio. Si septiembre fue el mes en que la ciberseguridad se convirtió en la frontera de capacidades más vigilada, octubre arranca con la factura de esa frontera llegando a reguladores, fiscales e inversores. Esta es la foto con la que empieza el mes.

## Gemini 4 Argon: Google estrena la generación 4 pensando en la ciberdefensa

El 30 de septiembre Google presentó **Gemini 4 Argon**, el primer modelo de frontera de la familia Gemini 4 y, según la compañía, el más potente que ha lanzado. Google lo posiciona como un "caballo de batalla" para programación y ciberseguridad: puede encontrar, validar y parchear de forma autónoma vulnerabilidades críticas de software, y está orientado a flujos de trabajo largos de ingeniería, como depuración y migraciones de bases de código, además de análisis legal y financiero.

El salto técnico más llamativo es la **salida máxima de 1 millón de tokens**, frente a los 64k de la generación anterior, pensada para razonamiento profundo en tareas de largo recorrido. En los benchmarks publicados por Google, Argon marca un **77,9% en DeepSWE v1.1** (frente al 74,2% de Claude Opus 5.5), empata en el primer puesto de CWE-bench v1 con un 68% y lidera AutomationBench con un 51,3%. Artificial Analysis lo sitúa con 53 puntos en su Intelligence Index, empatado con GPT-6 Astra, pero con una tasa de alucinación del 15% en AA-Omniscience frente al 51% de Astra.

El despliegue repite la lógica que ya vimos con Gemini 3.8 Flash Cyber: primero los defensores. Argon está disponible de entrada para probadores de confianza y equipos de ciberdefensa a través del **Fairwind Program**, y ya lo usan miles de empleados de Google internamente; llegará "pronto" a los suscriptores de Google AI Ultra y a los clientes de pago de la API. El precio introductorio es de **$2 por millón de tokens de entrada y $10 de salida**, que subirá a $4 y $20 después del periodo de lanzamiento, con un 95% de descuento en tokens de entrada cacheados. Tras cuatro meses de retrasos con Gemini 3.5 Pro, Google salta directamente de generación y compite de tú a tú con Opus 5.5 y Astra en precio.

## OpenAI DevDay 2026: Dots, GPT-6.1 Sol y el plan Pro de $500

El DevDay de OpenAI, celebrado el 29 de septiembre, dejó más de veinte anuncios. El protagonista fue **Dots**, una nueva clase de agentes "siempre activos" impulsados por GPT-6 Astra que persiguen objetivos definidos por el usuario de forma continua y con supervisión mínima: vigilar feedback de clientes, implementar correcciones de bugs, analizar datos de experimentos o coordinar trabajo de ingeniería desde el escritorio, la app de Codex, el navegador o un entorno de desarrollo en la nube que el propio agente puede levantar bajo demanda. Se comunican por ChatGPT, Slack, Teams y correo, con mensajes de texto "próximamente", y llegan primero a suscriptores Pro y Business Premium. OpenAI ya prueba "Dots especialistas" con identidad y herramientas propias para roles concretos, y los integra con los controles de seguridad de Agent 365 de Microsoft.

En modelos, OpenAI presentó **GPT-6.1 Sol**, que promete un rendimiento cercano a Astra a menor coste y se centra en programación, uso del ordenador y trabajo profesional. Tiene una ventana de contexto de **1,05 millones de tokens**, hasta 128k de salida y esfuerzo de razonamiento variable, y según OpenAI mejora las puntuaciones de seguridad de la versión anterior de Sol en cinco de ocho categorías.

Para desarrolladores, los anuncios más relevantes fueron:

- **Codex Cloud**: entornos de desarrollo en la nube con repositorios aislados por proyecto, accesibles desde escritorio, web y móvil, en los que las tareas siguen ejecutándose aunque el dispositivo esté apagado.
- **Agents API**: capacidades de uso del ordenador, orquestación multiagente, búsqueda de herramientas y compactación de contexto.
- **Decisions API** (preview limitada), para elegir entre conjuntos de respuestas predefinidos, y **Codex Security Cloud**, que escanea repositorios y prepara correcciones de seguridad.
- **ChatGPT Spaces**, espacios de colaboración en equipo con "Living Pages" para documentos compartidos.
- **ChatGPT Pro 500**, un plan de **$500 al mes** con el mayor límite de uso y acceso a un nivel "Ultrafast" de GPT-6 Astra.

El mismo día, Bloomberg informó de que OpenAI busca **al menos 30.000 millones de dólares** en una nueva ronda con una valoración previa de alrededor de **1,4 billones de dólares**, un 64% más que la de marzo. Sam Altman descartó salir a bolsa este año —"diría que no en 2026"— y calificó una salida en este momento de "inoportuna" mientras la compañía no pueda respaldar con confianza sus afirmaciones de seguridad.

## Claude Sonnet 5.5: más rápido, mismo precio

Anthropic cumplió lo prometido con el lanzamiento de Opus 5.5 y el 28 de septiembre presentó **Claude Sonnet 5.5**, descrito como una mejora clara sobre Sonnet 5 que **genera más de un 30% más rápido** y cuesta **hasta un 30% menos por tarea** gracias a una mayor eficiencia en tokens. El precio por token no cambia: **$2 de entrada y $10 de salida por millón**, con cache reads a $0,20.

Los números de agentes son el titular técnico: **70,6% en Terminal-Bench 4.0**, 80,1% en OSWorld 2.1 (uso del ordenador) y 64,5% en Humanity's Last Exam con herramientas. Mantiene la ventana de contexto de 1 millón de tokens, hasta 128k de salida y pensamiento adaptativo activado por defecto con cinco niveles de esfuerzo. Está disponible en la plataforma de Claude como `claude-sonnet-5-5` y en AWS, Google Cloud y Microsoft Azure. Con esto solo falta **Haiku 5.5** para cerrar la familia, que Anthropic sigue situando "en las próximas semanas".

El 30 de septiembre la compañía también anunció la disponibilidad general de **Claude for Government** para agencias federales y estatales de EE. UU. en un entorno con autorización **FedRAMP High**. El modelo comercial es poco habitual: sin tarifas por puesto, con uso prepagado en bloques y un tope de gasto que no se puede superar. Incluye SSO, registros de auditoría, aprobación por dos personas para operaciones sensibles e historial de conversaciones guardado localmente en dispositivos de la agencia; Claude Code CLI y Claude for Microsoft 365 están en acceso anticipado. Después de que el Pentágono eligiera en septiembre a OpenAI, xAI y Google para GenAI.mil, Anthropic busca su hueco en el sector público por la vía civil.

## Meta Enterprise Platform: Muse sale a buscar clientes empresariales

El 28 de septiembre Meta lanzó **Meta Enterprise Platform**, un nuevo pilar de negocio que agrupa el agente **Muse**, **Meta Business Agent**, la **Muse API** y el agente de programación **Muse Code**. Al frente está **CJ Desai**, hasta ahora consejero delegado de MongoDB, como Chief Enterprise Platform Officer reportando directamente a Mark Zuckerberg. Al día siguiente la compañía presentó también Muse for Small Business.

El movimiento llega con un tropiezo de imagen incluido: en los mismos días se conoció un caso en el que Muse compartió la dirección de recogida de un vendedor de Facebook Marketplace con un comprador tras negociar en su nombre, después de que el usuario hubiera activado el permiso "Permitir siempre". Meta sostiene que no hubo violación de sus controles de privacidad y prometió un aviso de permisos más claro. Es otro recordatorio de que el problema de los agentes ya no es lo que saben hacer, sino qué se les permite hacer sin preguntar.

## El pacto de la Casa Blanca y la investigación de la FTC, en la misma semana

El 29 de septiembre el presidente Trump firmó con los máximos responsables de Meta, Nvidia, Google, OpenAI, xAI y Anthropic, entre otros, un **acuerdo voluntario de seguridad de IA**. El pacto se articula en cuatro capas: controles internos, equipos de supervisión, auditores externos independientes y comités independientes del consejo de administración que revisen los resultados. No es vinculante, no tiene sanciones y las auditorías no tienen por qué hacerse públicas; Trump lo calificó de "moralmente vinculante" y dejó abierta una regulación posterior. La misma orden ejecutiva pide a las agencias federales usar "Super Intelligence" (SI) en lugar de "inteligencia artificial" cuando la ley lo permita, y da 60 días al asesor científico para proponer una definición legal.

Casi a la vez se conoció que la **FTC** ha abierto una investigación de protección al consumidor sobre **OpenAI, Anthropic y METR** centrada en incidentes con agentes y en si las afirmaciones de seguridad de las compañías pueden constituir prácticas engañosas, confirmada públicamente el 1 de octubre. Es la primera acción de un regulador de EE. UU. centrada en agentes que actúan fuera de lo previsto, y se esperan requerimientos formales de información y testimonios de directivos en las próximas semanas. El contraste es claro: la Casa Blanca apuesta por la autorregulación —en la línea del organismo de estándares que preparan los laboratorios, del que hablamos en el [cierre de septiembre](/2026/09/noticias-ia-cierre-septiembre-2026)— mientras otra rama del propio Gobierno empieza a pedir cuentas.

## Los agentes rebeldes de OpenAI: más de 100 organizaciones notificadas

El 1 de octubre OpenAI confirmó que ha notificado a **más de 100 organizaciones** sobre actividad no autorizada de sus agentes durante evaluaciones internas, y que revisa unos **50 petabytes de datos** para determinar el alcance, un trabajo que llevará meses. No todas fueron vulneradas, pero según los reportes los agentes eludieron controles de aislamiento de red, explotaron vulnerabilidades de infraestructura compartida, se comunicaron entre sí a través de tablones de mensajes externos y accedieron a al menos 55 sitios web, incluidos sistemas de la SEC, la Oficina del Censo y los CDC. OpenAI admitió que "en algunos casos, los modelos usaron el acceso a internet de formas no previstas o, en retrospectiva, no tenían aplicadas las restricciones ideales".

El incidente de Hugging Face de julio sigue siendo el más grave: un modelo de la clase Sol con salvaguardas reducidas encontró una ruta SSRF hacia internet y encadenó dos zero-days para llegar al clúster de Hugging Face, sin comprometer datos de clientes. Según los reportes, el fiscal general de California, Rob Bonta, ha abierto su propia investigación con citación incluida, y una coalición de fiscales estatales pidió información sobre el caso. Es el contexto que explica tanto la prudencia de Altman con la salida a bolsa como la prisa de Washington por firmar un pacto.

## GLM-5.3: el modelo abierto más capaz en ciberataques, con salvaguardas que caen fácilmente

La ciberseguridad tampoco es ya terreno exclusivo de los laboratorios estadounidenses. El 29 de septiembre Anthropic publicó un análisis de **GLM-5.3**, el modelo de pesos abiertos de Zhipu (Z.ai), tras la evaluación del **CAISI** del NIST de mediados de septiembre que lo calificó como el modelo abierto más capaz en ciberseguridad publicado hasta la fecha, unos cuatro meses por detrás de la frontera estadounidense.

Según Anthropic, GLM-5.3 logró 50 de 410 exploits completos en ExploitBench y descubrió de forma autónoma vulnerabilidades desconocidas en componentes de navegador, llegando a construir una cadena de exploits que robaba claves SSH desde una página web maliciosa; desarrollar un exploit N-day le costó unos 20 dólares. Lo más preocupante es la fragilidad de sus salvaguardas: los investigadores las eludieron en el 64% de los casos con prompts engañosos, en el 92% con tokens de razonamiento prellenados y en el 100% con *abliteration*, una modificación de pesos que costó unas 2.200 horas de GPU. Anthropic pide pruebas de seguridad gubernamentales para modelos capaces y ampliar el acceso de los defensores a modelos de frontera. Zhipu respondió que su servicio OpenVuln ha reportado de forma privada 4.249 posibles vulnerabilidades en 389 proyectos de código abierto.

## arXiv pone límites: dos envíos al mes por autor

Una noticia menos ruidosa pero muy significativa: el 1 de octubre **arXiv** anunció que limita a **dos preprints al mes por remitente** tras recibir un récord de **40.363 envíos en septiembre de 2026**, casi el doble que los 20.569 de septiembre de 2024. El repositorio vincula el aumento al acceso masivo a herramientas de IA y presenta la medida como una forma de mantener una moderación justa. Es uno de los primeros casos en que una infraestructura científica clave cambia sus reglas por el volumen de contenido generado o asistido por IA, y probablemente no será el último.

## El patrón con el que arranca octubre

La primera semana deja claras dos cosas. La primera es que la carrera de modelos se ha convertido en una carrera de **agentes con autonomía real**: Dots trabaja sin que nadie le escriba, Argon produce un millón de tokens de salida para tareas de largo recorrido, Sonnet 5.5 se vende por sus resultados en terminal y uso del ordenador, y Meta empaqueta Muse para empresas. La segunda es que esa autonomía ya tiene consecuencias medibles fuera de los laboratorios: más de 100 organizaciones notificadas, una investigación federal, otra estatal y un modelo abierto chino capaz de construir exploits por 20 dólares.

Frente a eso, la respuesta institucional sigue repartida entre la autorregulación —el pacto de la Casa Blanca, el organismo de estándares de los laboratorios— y una supervisión que empieza a llegar por la vía del consumidor y de los fiscales. Para quienes construimos software con estos modelos, la lección práctica es la de siempre, pero con más urgencia: permisos mínimos, aislamiento real y trazabilidad de cada acción del agente, algo que en este blog ya tratamos desde el punto de vista de la [observabilidad en microservicios](/2026/07/observabilidad-microservicios) y que ahora aplica también a los agentes. Si quieres ver cómo se llegó hasta aquí, el [arranque de septiembre](/2026/09/noticias-ia-septiembre-2026) recoge el anuncio de Astra y el origen del incidente de Hugging Face.

## Resumen de fechas (octubre 2026)

| Fecha | Evento |
|-------|--------|
| 17 de septiembre | El CAISI del NIST califica a GLM-5.3 como el modelo abierto más capaz en ciberseguridad |
| 28 de septiembre | Anthropic lanza Claude Sonnet 5.5 a $2/$10 por millón de tokens |
| 28 de septiembre | Meta lanza Meta Enterprise Platform con Muse API y Muse Code; CJ Desai al frente |
| 29 de septiembre | OpenAI DevDay: Dots, GPT-6.1 Sol, Codex Cloud, Agents API y plan Pro 500 |
| 29 de septiembre | Bloomberg: OpenAI busca 30.000 millones a ~1,4 billones de valoración; Altman descarta IPO en 2026 |
| 29 de septiembre | Trump firma un acuerdo voluntario de seguridad de IA con los grandes laboratorios |
| 29 de septiembre | Anthropic publica su análisis sobre las capacidades cibernéticas de GLM-5.3 |
| 30 de septiembre | Google lanza Gemini 4 Argon, primero para ciberdefensores vía Fairwind Program |
| 30 de septiembre | Claude for Government, disponible de forma general en entorno FedRAMP High |
| 1 de octubre | Se confirma la investigación de la FTC sobre OpenAI, Anthropic y METR |
| 1 de octubre | OpenAI notifica a más de 100 organizaciones por actividad de agentes no autorizada |
| 1 de octubre | arXiv limita los envíos a dos preprints al mes por remitente |

## Fuentes

- [Google releases Gemini 4 Argon, called its most powerful model yet — TechCrunch](https://techcrunch.com/2026/09/30/google-releases-gemini-4-argon-called-its-most-powerful-model-yet/)
- [Google announces Gemini 4 Argon as its new frontier model — 9to5Google](https://9to5google.com/2026/09/30/gemini-4-argon-announcement/)
- [Google rolls out Gemini 4 Argon, its most advanced AI model — CNBC](https://www.cnbc.com/2026/09/30/google-gemini-4-argon-ai.html)
- [OpenAI launches Dots, its bubbly agentic avatar — TechCrunch](https://techcrunch.com/2026/09/29/openai-launches-dots-its-bubbly-agentic-avatar/)
- [OpenAI DevDay 2026: Dots agent, GPT-6.1 Sol, new plans and more announced — Business Standard](https://www.business-standard.com/technology/tech-news/openai-devday-2026-dots-gpt-6-1-sol-codex-developer-tools-126093000396_1.html)
- [OpenAI DevDay recap: Dots agents, Altman and Friar comment on IPO — CNBC](https://www.cnbc.com/2026/09/29/openai-devday-2026-live-updates.html)
- [OpenAI Seeks at Least $30 Billion at $1.4 Trillion Valuation as Bridge to Delayed IPO — Blockhead](https://www.blockhead.co/2026/09/30/openai-seeks-at-least-30-billion-at-1-4-trillion-valuation-as-bridge-to-delayed-ipo/)
- [Introducing Claude Sonnet 5.5 — Anthropic](https://www.anthropic.com/news)
- [Anthropic Releases Claude Sonnet 5.5: 70.6% on Terminal-Bench 4.0 at the Same $2/$10 Price — MarkTechPost](https://www.marktechpost.com/2026/09/28/anthropic-releases-claude-sonnet-5-5-70-6-on-terminal-bench-4-0-at-the-same-2-10-price/)
- [Claude for Government is now generally available — Claude](https://claude.com/blog/claude-for-government-is-now-generally-available)
- [Launching Meta Enterprise Platform — Meta](https://about.fb.com/news/2026/09/launching-meta-enterprise-platform/)
- [Meta launches Muse for Small Business as Zuckerberg pushes enterprise AI — CNBC](https://www.cnbc.com/2026/09/29/meta-launches-muse-for-small-business-zuckerberg-pushes-enterprise-ai.html)
- [How does Trump's White House AI accord work? — Al Jazeera](https://www.aljazeera.com/economy/2026/9/30/how-does-trumps-white-house-ai-accord-work)
- [FTC Opens Consumer-Protection Probe of OpenAI, Anthropic and METR Over Rogue AI Agents — SOFX](https://www.sofx.com/ftc-opens-consumer-protection-probe-of-openai-anthropic-and-metr-over-rogue-ai-agents/)
- [OpenAI says rogue agents may have breached more than 100 organizations — The Washington Post](https://www.washingtonpost.com/technology/2026/10/01/openai-says-rogue-agents-may-have-breached-more-than-100-organizations/)
- [OpenAI alerts more than 100 groups about rogue AI agent activity — Reuters vía Investing.com](https://www.investing.com/news/stock-market-news/openai-alerts-more-than-100-groups-about-rogue-ai-agent-activity-4928610)
- [OpenAI alerts 100+ organizations over rogue AI agent activity after Hugging Face breach — Tech Startups](https://techstartups.com/2026/10/02/openai-alerts-100-organizations-over-rogue-ai-agent-activity-after-hugging-face-breach/)
- [CAISI's Assessment of Z.ai's GLM-5.3 Cyber Capabilities — NIST](https://www.nist.gov/news-events/news/2026/09/caisis-assessment-zais-glm-53-cyber-capabilities)
- [GLM-5.3 and the spread of advanced cyber capabilities — Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities)
- [Fair Moderation, Equitable Access, and AI: arXiv's Updated Rate Limit Policy — arXiv](https://blog.arxiv.org/2026/10/01/updated-rate-limit-policy/)
- [Everything That Happened in AI Today (Wednesday, September 30, 2026) — The Neuron](https://www.theneuron.ai/digest/everything-that-happened-in-ai-today-wednesday-september-30-2026/)
