---
titulo: "Robot humanoide de OpenAI: qué confirmó Sam Altman y qué hay detrás de la demo de 2027"
seoTitulo: "Robot humanoide de OpenAI: qué se sabe de la demo de 2027"
fecha: "2026-10-20"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Robot humanoide de OpenAI: qué dijo Sam Altman, cómo funciona su cerebro de IA, el laboratorio de Richmond, los rivales y qué esperar de la demo de 2027."
imagenPortada: "https://i.imgur.com/mao0V3v.png"
etiquetas: ["OpenAI", "Robótica", "Robots humanoides", "Inteligencia Artificial", "Sam Altman", "Noticias"]
categoria: "tech"
keywords: "robot humanoide de openai, openai robot humanoide, robot humanoide openai 2027, sam altman robot humanoide, openai robotica, ia fisica, modelo vla vision lenguaje accion, teleoperacion robots gello, laboratorio robotica openai richmond, openai vs tesla optimus, figure ai openai, 1x neo openai, robots humanoides 2026, gemini robotics 2, actuadores robot humanoide, envios robots humanoides 2026"
---

# Robot humanoide de OpenAI: qué confirmó Sam Altman y qué hay detrás de la demo de 2027

Durante años, la relación de OpenAI con la robótica fue la de un ex que no termina de irse. En 2019 enseñó una mano robótica que resolvía un cubo de Rubik, en 2020 cerró su equipo de robótica por falta de datos y después se dedicó a financiar a otros —Figure AI, 1X— para que pusieran sus modelos dentro de cuerpos de metal. En 2026 eso cambió del todo: OpenAI montó una división de robótica, alquiló una nave industrial gigante en California y, en septiembre, Sam Altman lo dijo sin rodeos. Sobre si la empresa construirá un **robot humanoide de OpenAI**, respondió: *"We will"* ("lo haremos"). Y puso fecha: *"Creo que tendremos una demo genial en 2027"*.

La frase volvió a recorrer los medios este fin de semana, después de que Engadget publicara el 17 de octubre un análisis de lo que implica, y vale la pena ordenar el ruido. Altman no enseñó ningún robot, no hay nombre, ni especificaciones, ni precio. Pero sí hay bastantes piezas públicas: ofertas de empleo muy reveladoras, un laboratorio donde personas enseñan a brazos robóticos a doblar ropa, una salida sonada por el acuerdo con el Pentágono y un mercado de humanoides que ya mueve decenas de miles de unidades, casi todas chinas. En este artículo junto esas piezas, explico cómo funciona el "cerebro" que OpenAI dice que es lo difícil y comparo su posición con la de Tesla, Figure y Google DeepMind.

## ¿Qué confirmó Sam Altman sobre el robot humanoide?

**El robot humanoide de OpenAI es, por ahora, un proyecto confirmado pero sin presentar: Sam Altman dijo en septiembre de 2026 que la empresa construirá un humanoide (además de otros formatos), que habrá una primera demostración en 2027 y que los robots caminando por la calle tardarán "unos años más". No hay diseño, nombre, socio de fabricación ni precio anunciados.**

Las declaraciones salieron de dos entrevistas distintas:

1. **El podcast *Sources*** (principios de septiembre). Preguntado directamente si OpenAI haría un humanoide, Altman contestó *"We will"* y añadió que "definitivamente" habrá un humanoide, pero "también otros formatos". Cuando le preguntaron si apuntaban a humanoides o a máquinas para centros de datos, la respuesta fue una palabra: *"Both"* ("ambos").
2. **Una entrevista con Fortune** (mediados de septiembre). Ahí dio el calendario: *"I think we'll have a cool demo in 2027"*, y enfrió las expectativas a renglón seguido: *"No creo que haya robots caminando por las calles hasta unos años después"*.

Su argumento para elegir la forma humana es pragmático: *"El mundo está muy diseñado para las personas"*, así que igualar ese formato "parece bueno". Puertas, escaleras, teclados, herramientas y estaciones de trabajo asumen un cuerpo con dos brazos, dos piernas y una altura determinada. Un robot que encaje ahí no obliga a rediseñar la fábrica, el almacén o la casa. Y añadió la idea que recorre todo el proyecto: el cuerpo es lo de menos, lo difícil es **el cerebro que hace que el robot funcione**.

Antes de eso, el 31 de mayo de 2026, Altman ya había publicado una convocatoria de contratación para OpenAI Robotics en la que describía el objetivo a corto plazo: **robots de propósito general que ayuden a trabajadores cualificados a construir infraestructura**, con los centros de datos como una de las primeras aplicaciones. El robot personal, para casa y para tareas más variadas, queda como meta a largo plazo.

## De Dactyl a Richmond: la historia de OpenAI con la robótica

![Línea de tiempo de OpenAI y la robótica desde la mano Dactyl en 2019 hasta la demo del robot humanoide prevista para 2027](/diagrams/2026/10/robot-humanoide-openai/linea-tiempo-openai-robotica.png)

La vuelta de OpenAI a la robótica se entiende mejor con su historial delante:

- **2019 — Dactyl.** OpenAI entrena en simulación una mano robótica que acaba resolviendo un cubo de Rubik. Fue un hito de *sim-to-real* (entrenar en un mundo virtual y transferir al real), pero también dejó claro el problema: la física real siempre encuentra la forma de romper lo que funcionaba en simulación.
- **2020 — Cierre del equipo.** La empresa desmantela su grupo de robótica. La explicación que se dio después fue la **falta de datos**: los modelos de lenguaje tenían internet entero para aprender, los robots no tenían nada parecido.
- **2023 — Inversor, no fabricante.** El fondo de OpenAI lidera una ronda de 23,5 millones de dólares en 1X Technologies, la empresa noruega que hoy apunta al hogar con su robot NEO. En 2024 participa también en la ronda de Figure AI y anuncia una colaboración para llevar sus modelos a los humanoides de Figure.
- **Febrero de 2025 — Ruptura con Figure.** Brett Adcock, CEO de Figure, da por terminada la colaboración: dice que su equipo consiguió un avance con su propio modelo integrado (lo que luego sería Helix) y que ya no necesita a OpenAI.
- **Noviembre de 2024 – marzo de 2026 — La etapa Kalinowski.** Caitlin Kalinowski, que había liderado en Meta las gafas de realidad aumentada, llega para dirigir el hardware y la robótica. El 7 de marzo de 2026 dimite por el acuerdo de OpenAI con el Pentágono: le preocupaba la vigilancia de ciudadanos sin control judicial y las armas autónomas sin autorización humana, y dijo que el anuncio se hizo "con prisa, sin las salvaguardas definidas". Su frase de despedida fue: *"Esto fue por principios, no por personas"*. Conté el contexto de ese acuerdo en el [arranque de septiembre en IA, con ChatGPT Mil en GenAI.mil](/2026/09/noticias-ia-septiembre-2026).
- **Marzo de 2026 — Richmond.** OpenAI firma el alquiler de unos **18.700 m²** (202.000 pies cuadrados) en el Portside Commerce Center de Richmond, California, la antigua sede de Moxion Power. El dato que más llama la atención es eléctrico: más de **14.000 amperios** de capacidad, cuando una nave industrial típica tiene entre 200 y 4.000. Es la infraestructura de un sitio pensado para cargar y probar muchos robots a la vez.
- **Mayo–septiembre de 2026.** Se oficializa OpenAI Robotics, se multiplican las vacantes y Altman confirma el humanoide.

## ¿Cómo funciona el "cerebro" de un robot humanoide?

Cuando Altman dice que lo difícil es el cerebro, se refiere a un tipo de modelo que en 2026 domina la conversación sobre **IA física**: los **modelos VLA (visión-lenguaje-acción)**. Es una idea sencilla de enunciar y muy difícil de hacer bien.

![Diagrama del cerebro de un robot humanoide: cámaras y sensores alimentan un modelo VLA de visión, lenguaje y acción que genera comandos motores para los actuadores, con retroalimentación en tiempo real](/diagrams/2026/10/robot-humanoide-openai/como-piensa-robot-humanoide-modelo-vla.png)

Un modelo VLA recibe tres cosas: **imágenes** de las cámaras del robot, el **estado del cuerpo** (posición de cada articulación, fuerza en las pinzas) y una **instrucción en lenguaje natural** ("guarda la taza en el armario"). Lo que devuelve no es texto, sino **acciones**: pequeños trozos de trayectoria para cada motor, que se ejecutan y se vuelven a calcular decenas de veces por segundo. La parte de "visión y lenguaje" suele heredarse de un modelo multimodal como los que ya hacen funcionar ChatGPT o Gemini; la parte de "acción" es la que hay que aprender casi desde cero.

Un ejemplo que usa Engadget lo ilustra bien: para coger una taza el robot tiene que reconocerla, localizar el asa, decidir cómo cerrar la mano y con cuánta fuerza levantarla para que no se derrame. Si la taza resbala, tiene que darse cuenta y corregir sobre la marcha. Simplificado, el bucle de control se parece a esto:

```python
# Bucle de control simplificado de un robot con un modelo VLA (ilustrativo)
instruccion = "guarda la taza en el armario"

while not tarea_terminada():
    observacion = {
        "imagenes": camaras.capturar(),          # cabeza y muñecas
        "propiocepcion": cuerpo.estado_articulaciones(),
        "instruccion": instruccion,
    }
    # El modelo predice un "chunk" de acciones: p. ej. 50 pasos para ~1 s
    acciones = modelo_vla.predecir(observacion)

    for accion in acciones[:10]:                 # ejecuta solo los primeros pasos...
        actuadores.aplicar(accion)               # ...y vuelve a mirar el mundo
        if sensores.detectar_anomalia():         # la taza resbala, alguien se cruza
            break                                # replanifica con información nueva
```

Ese "ejecutar un poco y volver a mirar" es lo que diferencia a un robot útil de uno que solo funciona en el vídeo de presentación. Google DeepMind presentó el 30 de julio **Gemini Robotics 2**, su segunda familia de modelos VLA; Figure tiene Helix; Physical Intelligence y Skild AI venden "cerebros" para robots de terceros. OpenAI llega tarde a esta carrera, pero con una ventaja que nadie le discute: los modelos multimodales y la capacidad de cómputo para entrenarlos a escala.

## La fábrica de datos: teleoperación, GELLO y simulación

El motivo por el que OpenAI cerró su equipo en 2020 —la falta de datos— sigue siendo el problema central. Un modelo de lenguaje aprende de billones de palabras ya escritas; nadie ha grabado billones de horas de manos robóticas doblando toallas. Así que hay que **fabricar esos datos**, y eso es exactamente lo que hace el laboratorio de OpenAI.

<!-- IMAGEN PENDIENTE: descargar https://d8j0ntlcm91z4.cloudfront.net/user_3G8oPhod0MkEuxG6fztuEjJLort/hf_20261019_142328_40561dd1-751f-4320-afa7-9ac7d14d4c72.png y guardarla como public/diagrams/2026/10/robot-humanoide-openai/fabrica-datos-teleoperacion-robots-openai.png; luego descomentar la línea siguiente -->
<!-- ![Ciclo de la fábrica de datos de OpenAI para robots: teleoperación humana, demostraciones, entrenamiento del modelo con apoyo de simulación y robot ejecutando tareas](/diagrams/2026/10/robot-humanoide-openai/fabrica-datos-teleoperacion-robots-openai.png) -->

Según los reportajes publicados en 2026, operadores humanos guían **brazos robóticos Franka** con controladores **GELLO**, un sistema de teleoperación de bajo coste desarrollado en la academia: es una réplica a escala del brazo, hecha con piezas impresas en 3D y servomotores baratos, que la persona mueve con la mano y el robot real imita en tiempo real. Cada movimiento queda grabado junto con lo que ven las cámaras, y ese par "lo que vi / lo que hice" es justo el ejemplo de entrenamiento que necesita un modelo VLA. Un reportaje republicado por AOL describió el laboratorio como un lugar donde los trabajadores entrenan brazos para **doblar ropa y tostar pan**: tareas aburridas a propósito, porque son las que llenan un día normal.

La teleoperación tiene un límite obvio: escala con personas y horas. Por eso se combina con **simulación**, donde se pueden generar millones de variaciones (otra luz, otra taza, otra mesa) a coste casi cero, y con vídeo de humanos haciendo tareas. El ciclo completo es un *flywheel*: humanos enseñan, el modelo aprende, el robot ejecuta, los fallos se convierten en nuevas demostraciones. Es la misma lógica que llevó a los LLM de "curiosidad" a producto, aplicada a un dominio donde cada dato cuesta dinero de verdad.

## Lo que revelan las ofertas de empleo de OpenAI Robotics

Si OpenAI no enseña el robot, sus vacantes enseñan bastante. A finales de septiembre la página de empleo listaba **27 puestos de robótica**, frente a 11 cuatro meses antes, con salarios base de hasta **500.000 dólares** para ingenieros de infraestructura de ML. Lo interesante es el tipo de perfil:

- **Diseñadores de actuadores electromecánicos** (motores, reductoras, sensores y gestión térmica). Esto apunta a que OpenAI no quiere solo poner su modelo en el robot de otro: quiere **diseñar su propio cuerpo**.
- **Firmware, diseño de PCB y técnicos de prototipado**: trabajo de hardware puro.
- **Ingenieros de software en tiempo real con Rust o C++**: el código que corre en el robot no tolera pausas de recolección de basura ni latencias impredecibles.
- **Especialistas en fabricación y cadena de suministro**: alguien está pensando ya en producir en serie.
- Un anuncio que menciona **telémetro láser y batería**, lo que sugiere también un robot móvil autónomo, coherente con el "otros formatos" de Altman.

Lo de los actuadores es más importante de lo que parece. Según estimaciones de McKinsey citadas por Forbes, los actuadores suponen **entre el 40 % y el 60 % del coste de materiales** de un humanoide, y buena parte de sus componentes críticos —reductoras armónicas, husillos de rodillos, imanes de tierras raras— dependen de proveedores chinos. Desarrollar un actuador propio lleva años. Quien lo controle controla el precio del robot.

## Robot humanoide de OpenAI vs. Tesla Optimus, Figure y la ola china

OpenAI no entra en un mercado vacío. Estos son los principales actores y cómo se posicionan en octubre de 2026:

| Empresa | Robot / modelo | Enfoque | Estado en 2026 |
|---------|----------------|---------|----------------|
| **OpenAI** | Sin nombre | Cerebro (modelos) + cuerpo propio; primero infraestructura | Confirmado, demo prevista en 2027 |
| **Tesla** | Optimus | Integración vertical, fabricación propia | Producción iniciada en Fremont, sin entregas a clientes según Forbes |
| **Figure AI** | Figure 03 + Helix | Humanoide industrial con VLA propio | Pruebas en fábricas como la de BMW |
| **1X** | NEO | Robot doméstico | En proceso de llegar a hogares; OpenAI sigue como inversor |
| **Google DeepMind** | Gemini Robotics 2 | Solo el cerebro, para robots de socios | Lanzado el 30 de julio de 2026 |
| **AGIBOT / Unitree** | Varios modelos | Volumen y precio | Líderes mundiales en envíos |

El último renglón es el que más contexto da. Según Counterpoint Research, en el primer semestre de 2026 se enviaron **más de 22.000 robots humanoides** en el mundo, casi **un 300 % más** que un año antes. AGIBOT lideró con unas 9.700 unidades (más del 43 %) y Unitree superó las 7.000 (31 %); las cinco primeras empresas del ranking son chinas. Counterpoint espera que 2026 cierre por encima de las **50.000 unidades**. Mientras OpenAI habla de una demo, otros ya cuentan robots vendidos por miles.

Hay también una ironía que muchos medios han señalado: OpenAI acaba compitiendo con empresas que financió. Figure se fue por su cuenta, 1X fabrica su propio robot y ahora OpenAI quiere ambas cosas: el cerebro y el cuerpo. Es el mismo patrón que vimos con Tesla y SpaceX compartiendo tecnología en el [Tesla Roadster volador](/2026/10/tesla-roadster-volador): las grandes empresas tecnológicas ya no se conforman con una capa del producto.

## ¿Qué podemos esperar de la demo de 2027?

Con lo que hay sobre la mesa, mi lectura es que conviene ajustar las expectativas en tres puntos:

1. **Una demo no es un producto.** Altman habló de una "demo genial", no de un lanzamiento. Lo razonable es esperar un entorno controlado y tareas acotadas (manipular objetos, moverse por un espacio preparado), no un robot que puedas comprar.
2. **El primer cliente probablemente no seas tú.** La propia OpenAI habla de infraestructura y centros de datos como punto de partida. Tiene sentido: entornos repetitivos, cliente con presupuesto y, en el caso de los centros de datos, un cliente que se llama OpenAI y está construyendo Stargate.
3. **La pregunta clave es la generalización.** Lo difícil no es que un robot doble una camiseta en un vídeo, sino que lo haga con la camiseta de otra persona, en otra casa, con otra luz, cien veces seguidas sin romper nada. Ahí es donde un modelo de OpenAI podría marcar diferencias… o no.

También hay dudas que OpenAI no ha despejado: quién dirige ahora el hardware tras la salida de Kalinowski, qué política de privacidad tendrá un robot con cámaras dentro de casa y cómo encaja todo esto con el dispositivo personal que desarrolla el equipo de Jony Ive tras la compra de io por 6.500 millones de dólares. Si sigues las novedades del sector, en el [resumen de noticias de IA de octubre de 2026](/2026/10/noticias-ia-octubre-2026) tienes el resto del panorama de OpenAI este mes.

## Preguntas frecuentes

### ¿OpenAI está fabricando un robot humanoide?

Sí. Sam Altman confirmó en septiembre de 2026, en el podcast *Sources*, que OpenAI construirá un humanoide y también robots con otros formatos. La empresa está contratando ingenieros de actuadores, firmware y fabricación, lo que indica que diseñará su propio hardware y no solo el software.

### ¿Cuándo presentará OpenAI su robot humanoide?

Altman dijo a Fortune que espera "una demo genial en 2027", sin fecha concreta. También aclaró que no espera ver robots caminando por las calles hasta varios años después. No hay fecha de venta, precio ni socio de fabricación anunciados.

### ¿Qué es un modelo VLA y por qué importa para los robots?

Un modelo VLA (visión-lenguaje-acción) recibe imágenes de las cámaras del robot y una instrucción en lenguaje natural, y genera directamente los movimientos de los motores. Es el "cerebro" que permite que un robot haga tareas nuevas sin programarlas paso a paso. Gemini Robotics 2 de Google y Helix de Figure son ejemplos de este tipo de modelos.

### ¿Cómo entrena OpenAI a sus robots?

Combina teleoperación y simulación. En su laboratorio, operadores humanos guían brazos robóticos Franka con controladores GELLO para hacer tareas como doblar ropa, y esas demostraciones grabadas sirven de datos de entrenamiento. La simulación permite generar millones de variaciones adicionales a bajo coste.

### ¿Por qué OpenAI dejó de trabajar con Figure AI?

En febrero de 2025 Figure dio por terminada la colaboración, argumentando que había desarrollado su propio modelo de IA integrado para sus robots (Helix). Desde entonces, OpenAI y Figure pasaron de ser socios a competidores en el mercado de humanoides.

### ¿Quién lidera hoy el mercado de robots humanoides?

Por volumen, las empresas chinas. Según Counterpoint Research, en el primer semestre de 2026 se enviaron más de 22.000 humanoides en el mundo; AGIBOT lideró con más del 43 % y Unitree tuvo el 31 %. Tesla, Figure y ahora OpenAI compiten más por tecnología que por unidades vendidas.

## Conclusión

El robot humanoide de OpenAI todavía no existe como producto, pero ya no es un rumor. Hay una confirmación explícita de Sam Altman, una fecha para la primera demostración, un laboratorio de casi 19.000 m² con potencia eléctrica para un pequeño polígono industrial y 27 vacantes que dibujan un equipo de hardware completo, desde los actuadores hasta la cadena de suministro. La apuesta es coherente con lo que OpenAI sabe hacer: si el problema de los robots es el cerebro, quien mejor domina los modelos multimodales debería tener ventaja.

Pero la robótica castiga la arrogancia del software. OpenAI ya lo intentó una vez y lo dejó por falta de datos; sus antiguos socios ya tienen robots en fábricas, y China envía humanoides por decenas de miles mientras en San Francisco se habla de 2027. La demo será la primera prueba real. Lo que habrá que mirar no es si el robot hace algo espectacular en un escenario, sino si lo hace con objetos que nunca ha visto, en sitios para los que no se preparó, y sin un operador escondido detrás de la cortina.

## Fuentes

- [OpenAI is developing a humanoid robot, but the real challenge isn't its body — Engadget](https://www.engadget.com/2285040/openai-humanoid-robot-sam-altman-statement-real-challenge/)
- [OpenAI Confirms Humanoid Robot With 2027 Demo, Competing With Companies It Once Backed — Tech Times](https://www.techtimes.com/articles/329197/20261019/openai-confirms-humanoid-robot-2027-demo-competing-companies-it-once-backed.htm)
- [OpenAI Posts $500K Robotics Salaries to Fund Data Factory Behind Its Robot Comeback — Tech Times](https://www.techtimes.com/articles/327751/20260920/openai-posts-500k-robotics-salaries-fund-data-factory-behind-its-robot-comeback.htm)
- [Sam Altman adelanta el próximo gran proyecto de OpenAI: un robot humanoide — Forbes Argentina](https://www.forbesargentina.com/innovacion/sam-altman-adelanta-proximo-gran-proyecto-openai-robot-humanoide-n97289)
- [OpenAI's robotics chief resigns over the company's Pentagon deal — Cybernews](https://cybernews.com/ai-news/openais-robotics-chief-resigns-over-the-companys-pentagon-deal/)
- [Global Humanoid Robot Shipments Soar Nearly 300% YoY in H1 2026 — Counterpoint Research](https://counterpointresearch.com/en/insights/global-humanoid-robot-shipments-soar-nearly-300-percent-yoy-in-h1-2026)
- [Inside the OpenAI lab where workers train robotic arms to fold laundry and toast bread — AOL](https://www.aol.com/articles/inside-openais-renewed-push-robotics-101701659.html)
- [GELLO: A General, Low-Cost, and Intuitive Teleoperation Framework — paper](https://wuphilipp.github.io/gello_site/gello_9_18.pdf)
- [Google DeepMind Gemini Robotics 2 — Gigazine](https://gigazine.net/gsc_news/en/20260731-google-deepmind-gemini-robotics-2)
