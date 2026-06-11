---
titulo: "Claude Fable 5: el modelo más poderoso de Anthropic ya es de acceso público"
seoTitulo: "Claude Fable 5: qué es, capacidades, benchmarks, precio y disponibilidad"
fecha: "2026-06-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Anthropic lanzó Claude Fable 5 el 9 de junio de 2026: el primer modelo de clase Mythos disponible para el público general. Supera a todos los modelos anteriores en benchmarks de ingeniería de software, visión y razonamiento científico, con nuevos clasificadores de seguridad para su lanzamiento responsable."
imagenPortada: "https://cdn.analyticsvidhya.com/wp-content/uploads/2026/06/I-Tested-Claude-Fable-5_-Can-Anthropics-Newest-AI-Deliver-on-the-Hype_.webp?w=800&h=500&fit=crop"
etiquetas: ["Inteligencia Artificial", "Anthropic", "Claude", "Claude Fable 5", "LLM", "Noticias"]
categoria: "tech"
keywords: "Claude Fable 5, Anthropic, modelo IA 2026, Claude Mythos 5, benchmarks IA, SWE-Bench, modelos de lenguaje grandes, LLM junio 2026"
---

# Claude Fable 5: el modelo más poderoso de Anthropic ya es de acceso público

El 9 de junio de 2026, Anthropic lanzó **Claude Fable 5**: el primer modelo de clase Mythos disponible para el público general. Es el modelo más capaz que la compañía ha puesto a disposición de sus usuarios hasta la fecha, y marca el inicio de una nueva era en la línea de productos Claude.

## Una nueva clase de modelo: Mythos

Para entender qué es Fable 5, primero hay que entender qué significa "clase Mythos". Anthropic organiza sus modelos en niveles de capacidad: Haiku, Sonnet, Opus... y ahora Mythos. La clase Mythos está por encima de Opus y representa un salto cualitativo en razonamiento autónomo, tareas de larga duración y habilidades científicas.

El primer modelo de esta clase, **Claude Mythos Preview**, se lanzó en abril de 2026 de forma muy restringida, solo para un grupo selecto de profesionales de ciberseguridad a través del [Proyecto Glasswing](https://www.anthropic.com/glasswing), en colaboración con el gobierno de Estados Unidos. La razón: los modelos de clase Mythos son tan capaces que su acceso sin restricciones representaba riesgos reales.

Claude Fable 5 es la respuesta de Anthropic a ese dilema. El nombre no es casualidad: *Fable* viene del latín *fabula* ("lo que se cuenta"), un pariente de *mythos* (griego, "historia"). **Ambos modelos son el mismo modelo subyacente**; lo que los diferencia son los clasificadores de seguridad que Fable lleva activados y Mythos no.

## Qué puede hacer Claude Fable 5

### Ingeniería de software

Fable 5 es estado del arte en prácticamente todos los benchmarks de programación evaluados. En **SWE-Bench Pro** alcanza un **80.3%**, aproximadamente 11 puntos por delante del siguiente modelo frontera. En el benchmark **FrontierCode** de Cognition —que evalúa si un modelo puede completar tareas de programación difíciles cumpliendo los estándares de producción— Fable 5 obtiene la puntuación más alta entre todos los modelos frontera, incluso en modo de esfuerzo medio.

Stripe lo probó en su base de código de 50 millones de líneas de Ruby y reportó que el modelo realizó en un día una migración completa que habría llevado a un equipo entero más de dos meses. Cursor lo calificó como "estado del arte" en su CursorBench, destacando que "ha abierto una clase de problemas de larga duración que antes estaban fuera de alcance".

### Trabajo de conocimiento

En el **Finance Benchmark** de Hebbia —diseñado para razonamiento de nivel científico senior— Fable 5 obtiene la mayor puntuación de cualquier modelo, con mejoras notables en razonamiento sobre documentos, interpretación de gráficos y resolución de problemas. IMC informó que el modelo superó sus evaluaciones de análisis de trading en casi todas las áreas: búsqueda factual, razonamiento conceptual, análisis de causa raíz y valor esperado.

### Visión

Fable 5 es el nuevo líder en tareas que involucran visión. Puede extraer números precisos de figuras científicas detalladas y reconstruir el código fuente de una aplicación web a partir de capturas de pantalla. Un dato llamativo: los modelos Claude anteriores necesitaban herramientas adicionales para jugar a Pokémon FireRed; Fable 5 completó el juego con un arnés mínimo, solo a partir de capturas de pantalla del juego.

### Memoria y contexto largo

Con una **ventana de contexto de 1M+ tokens**, Fable 5 mantiene la concentración durante tareas que se extienden por millones de tokens. Cuando se le dio acceso a memoria persistente basada en archivos mientras jugaba al juego de construcción de mazos *Slay the Spire*, su rendimiento mejoró tres veces más que el de Opus 4.8 bajo las mismas condiciones.

### Investigación científica (Mythos 5)

Aunque este nivel de capacidades está reservado a Claude Mythos 5, vale la pena mencionarlo: los expertos internos de Anthropic en diseño de proteínas aceleraron aspectos del proceso de diseño de fármacos alrededor de **diez veces** usando Mythos 5. El modelo realizó de forma autónoma tareas que habitualmente requieren la intervención de un científico: selección de sitios de unión, configuración de herramientas de diseño de proteínas y recuperación de errores.

## Los clasificadores de seguridad

Anthropic no lanzó Fable 5 sin salvaguardas. El modelo incorpora un conjunto de **clasificadores**: sistemas de IA separados que detectan posibles abusos y redirigen automáticamente ciertas solicitudes al modelo Claude Opus 4.8.

Las tres áreas cubiertas por los clasificadores son:

**Ciberseguridad.** Los modelos de clase Mythos tienen capacidades avanzadas de descubrimiento y explotación de vulnerabilidades. El clasificador bloquea tareas de hacking ofensivo, reconocimiento y movimiento lateral. Los datos iniciales muestran que ningún red-teamer externo encontró jailbreaks universales en más de 1.000 horas de pruebas.

**Biología y química.** Mythos 5 demostró capacidad para completar pasos en el diseño de virus adenoasociados (AAVs), lo que tiene aplicaciones legítimas en terapia génica pero también riesgos de doble uso. Por cautela, Fable 5 redirige la mayoría de solicitudes relacionadas con biología y química a Opus 4.8. Anthropic planea un programa de acceso confiable para investigadores biomédicos que necesiten estas capacidades.

**Destilación.** Para evitar que terceros extraigan las capacidades de Fable 5 para entrenar modelos propios —algo que Anthropic ha detectado antes—, el clasificador detecta y bloquea intentos de destilación a gran escala.

La buena noticia: más del **95% de las sesiones** no activan ningún clasificador. Cuando uno se activa, el usuario recibe una respuesta de Opus 4.8, no un rechazo en blanco.

Junto con los clasificadores, Anthropic introdujo una nueva política de retención de datos: todo el tráfico en modelos de clase Mythos se conserva durante 30 días con fines de seguridad, sin usarse para entrenar nuevos modelos.

## Claude Mythos 5: para ciberdefensores y acceso confiable

**Claude Mythos 5** es el mismo modelo subyacente que Fable 5, pero con los clasificadores de ciberseguridad desactivados. Está disponible para los socios actuales del Proyecto Glasswing (ciberdefensores e infraestructura crítica) y pronto se ampliará a través de un programa de acceso confiable más amplio.

Anthropic también planea abrir un programa de acceso confiable para biología, que permitirá a investigadores en ciencias de la vida acceder a Fable 5 con los clasificadores de biología y química desactivados, manteniendo activos los de ciberseguridad.

## Precio y disponibilidad

| Aspecto | Detalle |
|---------|---------|
| Precio | $10 por millón de tokens de entrada / $50 por millón de salida |
| Plataformas | API de Claude, AWS Bedrock, Google Vertex AI, Microsoft Foundry, GitHub Copilot |
| Planes de suscripción | Incluido en Pro, Max, Team y Enterprise hasta el 22 de junio |
| Identificador API | `claude-fable-5` |
| Contexto | 1M+ tokens |

A partir del **23 de junio**, los planes de suscripción necesitarán créditos de uso para acceder a Fable 5. Anthropic ha indicado que su objetivo es restaurar el modelo como parte estándar de los planes tan pronto como la capacidad lo permita.

El precio de $10/$50 por millón de tokens representa menos de la mitad del precio de Claude Mythos Preview, lo que supone un acceso sustancialmente más económico al nivel más alto de capacidad de Anthropic.

## Lo que significa para los desarrolladores

Claude Fable 5 no es solo un modelo más rápido o más inteligente: es una demostración de que Anthropic puede lanzar modelos de capacidad extrema de forma responsable, usando clasificadores como puente entre potencia y seguridad.

Para los equipos de desarrollo, el impacto más inmediato está en tareas de larga duración: migraciones de código, análisis de bases de datos grandes, pipelines de agentes complejos. El modelo está pensado para trabajar solo durante horas, no solo generar un fragmento de código. La arquitectura de los sistemas que lo usan tendrá que adaptarse a esa realidad.

Para los investigadores y las empresas que trabajan en el límite de lo que la IA puede hacer, el acceso al programa de acceso confiable de Mythos 5 abre posibilidades que hasta ahora estaban reservadas a socios gubernamentales.

## Fuentes

- [Anuncio oficial de Anthropic — Claude Fable 5 y Claude Mythos 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)
- [TechCrunch — Anthropic releases Claude Fable 5](https://techcrunch.com/2026/06/09/anthropic-released-claude-fable-5-its-most-powerful-model-publicly-days-after-warning-ai-is-getting-too-dangerous/)
- [VentureBeat — Anthropic brings Mythos to the masses](https://venturebeat.com/technology/anthropic-brings-mythos-to-the-masses-with-claude-fable-5-its-most-powerful-generally-available-model-ever)
- [GitHub Changelog — Claude Fable 5 en GitHub Copilot](https://github.blog/changelog/2026-06-09-claude-fable-5-is-generally-available-for-github-copilot/)
- [Documentación de la API — Modelos disponibles](https://platform.claude.com/docs/en/about-claude/models/overview)
