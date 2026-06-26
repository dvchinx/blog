---
titulo: "CQRS: separar lecturas y escrituras para escalar mejor"
seoTitulo: "CQRS explicado: qué es Command Query Responsibility Segregation y cuándo usarlo"
fecha: "2026-06-26"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es CQRS, cómo separa las operaciones de lectura y escritura en un sistema, cuándo tiene sentido aplicarlo y qué ventajas ofrece frente a un modelo CRUD tradicional."
imagenPortada: "https://i.imgur.com/G4VvzdP.png?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "CQRS", "Best Practices", "Software", "Design Patterns"]
categoria: "tech"
keywords: "CQRS, Command Query Responsibility Segregation, arquitectura CQRS, patrones de diseño arquitectura, lectura escritura separada, Event Sourcing, arquitectura software, escalabilidad"
---

# CQRS: separar lecturas y escrituras para escalar mejor

La mayoría de las aplicaciones CRUD tratan las lecturas y las escrituras de la misma forma: el mismo modelo de datos, la misma capa de acceso, la misma lógica de negocio. Eso funciona bien en sistemas simples, pero a medida que el sistema crece empiezan a aparecer tensiones difíciles de resolver con ese enfoque.

CQRS (Command Query Responsibility Segregation) es un patrón arquitectónico que propone una solución directa: **separar físicamente las operaciones que modifican el estado del sistema de las que solo lo leen**. Lo que suena simple tiene implicaciones profundas en cómo se diseña, escala y evoluciona una aplicación.

## El problema que resuelve CQRS

En un sistema CRUD tradicional, el mismo modelo de datos se usa para leer y escribir. Esto crea fricciones concretas:

**Las escrituras y las lecturas tienen requisitos distintos.** Escribir requiere validaciones, reglas de negocio, transacciones y consistencia estricta. Leer requiere velocidad, proyecciones específicas para cada pantalla y muy pocas validaciones. Forzarlos a compartir el mismo modelo obliga a hacer compromisos que ninguno resuelve bien.

**Las consultas complejas contaminan el modelo de dominio.** Cuando necesitas mostrar un dashboard con datos de cinco entidades distintas, terminas agregando joins y proyecciones al repositorio, o cargando más datos de los necesarios para luego filtrar en memoria. El modelo de dominio, que debería reflejar las reglas del negocio, acaba lleno de métodos que solo existen para satisfacer una pantalla específica.

**La escala de lecturas y escrituras no es la misma.** En muchas aplicaciones, la proporción de lecturas frente a escrituras es 10:1 o mayor. Si escalar lecturas requiere escalar también el sistema de escritura (porque comparten infraestructura), se desperdician recursos.

## La idea central de CQRS

CQRS divide el sistema en dos lados:

- **El lado de comandos (Commands)**: se encarga de todo lo que modifica el estado. Recibe intenciones explícitas del usuario o del sistema ("registrar pedido", "cancelar suscripción", "actualizar dirección"), aplica las reglas de negocio y persiste los cambios. No devuelve datos del dominio; solo confirma si la operación tuvo éxito o falló.

- **El lado de consultas (Queries)**: se encarga de leer y proyectar el estado actual del sistema. Devuelve exactamente lo que cada pantalla o cliente necesita, sin pasar por el modelo de dominio completo. Puede leer desde una base de datos optimizada para lectura, un caché o una vista materializada.

El nombre del patrón viene del principio de separación de consultas y comandos formulado por Bertrand Meyer en los años 80: un método debería o bien modificar el estado (comando) o bien devolver un resultado (consulta), pero nunca las dos cosas a la vez.

## Cómo se ve CQRS en la práctica

Imagina una aplicación de gestión de pedidos. En el modelo CRUD clásico, la misma entidad `Pedido` se usa para crear, actualizar y mostrar pedidos en listados, en el detalle, en el historial del cliente y en el panel de logística.

Con CQRS, el flujo se divide:

**Lado de comandos:**
```
Cliente → PlacerPedidoCommand → PedidoCommandHandler → (valida, aplica reglas) → PedidoRepository → base de datos de escritura
```

**Lado de consultas:**
```
Cliente → GetPedidosDelClienteQuery → PedidoQueryHandler → ReadModel → base de datos de lectura (optimizada)
```

El `PedidoCommandHandler` trabaja con el agregado `Pedido` completo, con todas sus invariantes y validaciones. El `PedidoQueryHandler` trabaja con una proyección específica —por ejemplo `PedidoResumenDTO`— que contiene exactamente los campos que necesita la pantalla de listado, sin cargar relaciones innecesarias.

## Sincronización entre el lado de escritura y el lado de lectura

Si las bases de datos de lectura y escritura son distintas, algo tiene que mantenerlas sincronizadas. La forma más común es mediante **eventos de dominio**.

Cuando el `PedidoCommandHandler` procesa un comando y lo persiste con éxito, emite un evento: `PedidoCreado`, `PedidoActualizado`, `PedidoCancelado`. Un componente separado —un proyector o manejador de eventos— escucha esos eventos y actualiza el modelo de lectura.

```
PedidoCreado (evento) → PedidoProjector → actualiza tabla pedidos_resumen (lectura)
```

Esta sincronización puede ser síncrona (en la misma transacción, si lectura y escritura están en la misma base de datos) o asíncrona (mediante un bus de mensajes, si están separadas). La sincronización asíncrona introduce **consistencia eventual**: durante un instante, el lado de lectura puede estar desactualizado respecto al de escritura. La mayoría de los sistemas pueden tolerar esto sin problema.

## CQRS con Event Sourcing

CQRS se menciona frecuentemente junto con Event Sourcing, pero son patrones independientes que se complementan bien.

**Event Sourcing** propone almacenar no el estado actual del sistema, sino la secuencia completa de eventos que lo produjeron. En lugar de guardar `pedido.estado = "cancelado"`, se guarda el evento `PedidoCancelado` con su timestamp y sus datos. El estado actual se reconstruye reproduciendo todos los eventos.

Combinado con CQRS, el lado de escritura persiste eventos en un event store, y los proyectores construyen a partir de esos eventos las distintas vistas de lectura que necesita la aplicación. Esto ofrece un historial completo y auditable de todo lo que ha ocurrido en el sistema, y permite crear nuevas proyecciones en cualquier momento reproduciendo el historial de eventos desde el principio.

No es necesario usar Event Sourcing para aplicar CQRS. La separación de lecturas y escrituras puede hacerse incluso con una sola base de datos relacional, usando simplemente clases y responsabilidades distintas para cada lado.

## Cuándo tiene sentido aplicar CQRS

CQRS añade complejidad. Hay más clases, más infraestructura y más flujo de datos que gestionar. No es adecuado para cualquier sistema.

Tiene sentido cuando:

- El sistema tiene lógica de negocio compleja en las escrituras pero lecturas que deben ser muy rápidas y con proyecciones específicas.
- Las lecturas y las escrituras necesitan escalar de forma independiente.
- El equipo necesita que los modelos de lectura evolucionen sin afectar el modelo de dominio central.
- Se usa Event Sourcing y el modelo de lectura se construye a partir de proyecciones de eventos.

No tiene sentido cuando:

- El sistema es un CRUD simple sin lógica de negocio significativa.
- El equipo es pequeño y la complejidad adicional no justifica el beneficio.
- Las lecturas y escrituras tienen volúmenes similares y no hay problemas de rendimiento.

## Relación con otros patrones

CQRS funciona bien junto con varios patrones que ya existen en sistemas bien diseñados:

- **Arquitectura hexagonal**: el lado de comandos y el de consultas son puertos distintos con adaptadores propios.
- **Eventos de dominio**: son el mecanismo natural para propagar cambios del lado de escritura al de lectura.
- **Repository pattern**: el repositorio del lado de escritura maneja el ciclo de vida de los agregados; el del lado de lectura devuelve proyecciones planas.
- **Mediator pattern**: frameworks como MediatR (en .NET) o herramientas equivalentes en otros ecosistemas registran los manejadores de comandos y consultas y enrutan las peticiones al handler correspondiente.

## Conclusión

CQRS no es una solución universal, pero en sistemas con complejidad de dominio real es una de las herramientas más efectivas para mantener el código organizado mientras el sistema crece.

Su contribución más importante no es la separación técnica de bases de datos, sino la claridad conceptual que aporta: las operaciones que cambian el estado del sistema y las que lo consultan tienen propósitos distintos, y reconocer esa diferencia desde el diseño simplifica tanto el código como el razonamiento sobre él.

La consistencia eventual, la propagación de eventos y la sincronización entre modelos son complejidades reales que hay que gestionar. Pero cuando el sistema lo justifica, el resultado es un diseño más limpio, más testeable y más fácil de escalar en la dirección que el sistema necesita.
