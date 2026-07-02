---
titulo: "Event Sourcing: guardar eventos en lugar de estado"
seoTitulo: "Event Sourcing explicado: qué es, cómo funciona, ventajas y cuándo usarlo"
fecha: "2026-07-03"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es Event Sourcing, por qué almacenar el historial de eventos en lugar del estado actual simplifica la auditoría y el debugging, y cómo se complementa con CQRS para construir sistemas más trazables y resilientes."
imagenPortada: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Event Sourcing", "CQRS", "Best Practices", "Software"]
categoria: "tech"
keywords: "event sourcing, event store, fuente de eventos, CQRS event sourcing, reconstrucción de estado, auditoría eventos, domain events, arquitectura software, proyecciones event sourcing"
---

# Event Sourcing: guardar eventos en lugar de estado

La mayoría de los sistemas almacenan el estado actual de cada entidad. Una cuenta bancaria tiene un saldo. Un pedido tiene un estado. Un usuario tiene una dirección. Cuando algo cambia, se actualiza el registro existente y el valor anterior desaparece para siempre.

Event Sourcing invierte esa lógica: en lugar de guardar el estado actual, **guarda la secuencia de eventos que llevaron a ese estado**. El saldo de una cuenta no es un número almacenado en una columna; es el resultado de sumar todos los depósitos y restar todos los retiros registrados desde el inicio. El estado actual siempre se puede reconstruir, y el historial completo nunca se pierde.

## El problema con el estado mutable

Imagina que un cliente llama porque su pedido tiene un precio incorrecto. Con un sistema tradicional que solo guarda el estado actual, tienes el pedido con su precio final y ninguna pista de por qué llegó a ese valor. ¿Hubo un descuento aplicado y luego revertido? ¿Un error de cálculo que fue corregido? No lo sabes. Necesitas logs, tablas de auditoría adicionales o reconstruir la conversación con el cliente.

Este problema aparece en muchos contextos: sistemas financieros donde cada transacción importa, aplicaciones legales donde los cambios deben ser rastreables, o cualquier dominio donde la pregunta "¿cómo llegamos aquí?" tiene respuesta relevante.

Event Sourcing resuelve esto de raíz: si guardas los eventos, tienes la historia completa por diseño, no como una característica adicional.

## Qué es un evento de dominio

Un evento de dominio representa algo que sucedió en el sistema, expresado en tiempo pasado y en el lenguaje del negocio. No es una intención ni un comando: es un hecho consumado.

- `PedidoCreado`
- `ProductoAgregadoAPedido`
- `DescuentoAplicado`
- `PedidoConfirmado`
- `PedidoCancelado`

Cada evento captura toda la información relevante en el momento en que ocurrió: quién lo originó, cuándo sucedió y qué datos estaban involucrados. Los eventos son inmutables — nunca se modifican ni eliminan. Son el registro permanente de lo que pasó.

```java
public abstract class EventoDominio {
    private final String eventoId;
    private final Instant occurridoEn;
    private final String tipo;

    protected EventoDominio(String tipo) {
        this.eventoId = UUID.randomUUID().toString();
        this.occurridoEn = Instant.now();
        this.tipo = tipo;
    }

    public String getEventoId() { return eventoId; }
    public Instant getOcurridoEn() { return occurridoEn; }
    public String getTipo() { return tipo; }
}

public class PedidoCreado extends EventoDominio {
    private final String pedidoId;
    private final String clienteId;

    public PedidoCreado(String pedidoId, String clienteId) {
        super("PedidoCreado");
        this.pedidoId = pedidoId;
        this.clienteId = clienteId;
    }

    public String getPedidoId() { return pedidoId; }
    public String getClienteId() { return clienteId; }
}

public class ProductoAgregadoAPedido extends EventoDominio {
    private final String pedidoId;
    private final String productoId;
    private final int cantidad;
    private final BigDecimal precioUnitario;

    public ProductoAgregadoAPedido(String pedidoId, String productoId, int cantidad, BigDecimal precioUnitario) {
        super("ProductoAgregadoAPedido");
        this.pedidoId = pedidoId;
        this.productoId = productoId;
        this.cantidad = cantidad;
        this.precioUnitario = precioUnitario;
    }

    // getters...
}
```

## El Event Store

El Event Store es la base de datos central de un sistema con Event Sourcing. A diferencia de una base de datos tradicional donde hay tablas con el estado actual de cada entidad, el Event Store es esencialmente un log append-only: solo se pueden agregar eventos, nunca modificar los existentes.

La estructura básica es simple:

```sql
CREATE TABLE eventos (
    id          BIGSERIAL PRIMARY KEY,
    stream_id   VARCHAR(255) NOT NULL,   -- identifica el agregado (p.ej. pedido-42)
    tipo        VARCHAR(255) NOT NULL,   -- nombre del evento
    version     INT NOT NULL,           -- número de secuencia dentro del stream
    payload     JSONB NOT NULL,         -- datos del evento
    occurido_en TIMESTAMPTZ NOT NULL,
    UNIQUE (stream_id, version)
);
```

Cada agregado tiene su propio stream de eventos identificado por `stream_id`. La columna `version` garantiza que los eventos se replayan en el orden correcto y permite detectar conflictos de escritura concurrente.

En la práctica, existen bases de datos diseñadas específicamente para este patrón (EventStoreDB es la más conocida), pero también es perfectamente válido implementarlo sobre PostgreSQL, DynamoDB o cualquier almacenamiento que soporte escrituras append-only.

## Reconstruir el estado desde los eventos

Para trabajar con un agregado, se cargan todos sus eventos desde el Event Store y se reproduce la secuencia para llegar al estado actual. Este proceso se llama **replay** o reconstitución.

```java
public class Pedido {
    private String id;
    private String clienteId;
    private List<LineaPedido> lineas = new ArrayList<>();
    private EstadoPedido estado;
    private List<EventoDominio> cambiosPendientes = new ArrayList<>();

    // Constructor vacío para reconstitución
    public Pedido() {}

    // Constructor para nuevo pedido — genera el primer evento
    public static Pedido crear(String clienteId) {
        Pedido pedido = new Pedido();
        pedido.aplicar(new PedidoCreado(UUID.randomUUID().toString(), clienteId));
        return pedido;
    }

    public void agregarProducto(String productoId, int cantidad, BigDecimal precio) {
        if (estado != EstadoPedido.BORRADOR) {
            throw new IllegalStateException("El pedido no está en estado borrador");
        }
        aplicar(new ProductoAgregadoAPedido(this.id, productoId, cantidad, precio));
    }

    public void confirmar() {
        if (lineas.isEmpty()) {
            throw new IllegalStateException("No se puede confirmar un pedido vacío");
        }
        aplicar(new PedidoConfirmado(this.id));
    }

    // Método central: aplica un evento y lo registra como cambio pendiente
    private void aplicar(EventoDominio evento) {
        when(evento);
        cambiosPendientes.add(evento);
    }

    // Reconstitución desde el Event Store: aplica sin registrar como pendiente
    public void reconstituirDesde(List<EventoDominio> eventos) {
        eventos.forEach(this::when);
    }

    // Mutaciones de estado por tipo de evento
    private void when(EventoDominio evento) {
        if (evento instanceof PedidoCreado e) {
            this.id = e.getPedidoId();
            this.clienteId = e.getClienteId();
            this.estado = EstadoPedido.BORRADOR;
        } else if (evento instanceof ProductoAgregadoAPedido e) {
            this.lineas.add(new LineaPedido(e.getProductoId(), e.getCantidad(), e.getPrecioUnitario()));
        } else if (evento instanceof PedidoConfirmado) {
            this.estado = EstadoPedido.CONFIRMADO;
        } else if (evento instanceof PedidoCancelado) {
            this.estado = EstadoPedido.CANCELADO;
        }
    }

    public List<EventoDominio> getCambiosPendientes() {
        return Collections.unmodifiableList(cambiosPendientes);
    }
}
```

El repositorio carga el stream de eventos y llama a `reconstituirDesde()` para recomponer el estado:

```java
public class PedidoRepository {
    private final EventStore eventStore;

    public Optional<Pedido> buscarPorId(String pedidoId) {
        List<EventoDominio> eventos = eventStore.cargarStream("pedido-" + pedidoId);
        if (eventos.isEmpty()) return Optional.empty();

        Pedido pedido = new Pedido();
        pedido.reconstituirDesde(eventos);
        return Optional.of(pedido);
    }

    public void guardar(Pedido pedido) {
        String streamId = "pedido-" + pedido.getId();
        eventStore.append(streamId, pedido.getCambiosPendientes());
    }
}
```

## Snapshots: optimizar el replay

Si un agregado acumula miles de eventos, reconstituirlo cada vez se vuelve costoso. La solución es crear un **snapshot**: una fotografía del estado en un punto dado. El siguiente replay solo necesita cargar los eventos posteriores al último snapshot.

```java
public Optional<Pedido> buscarConSnapshot(String pedidoId) {
    String streamId = "pedido-" + pedidoId;

    Optional<Snapshot<Pedido>> snapshot = snapshotStore.cargarUltimo(streamId);

    if (snapshot.isPresent()) {
        Pedido pedido = snapshot.get().getEstado();
        long versionSnapshot = snapshot.get().getVersion();
        List<EventoDominio> eventosPendientes =
            eventStore.cargarStreamDesde(streamId, versionSnapshot + 1);
        pedido.reconstituirDesde(eventosPendientes);
        return Optional.of(pedido);
    }

    return buscarPorId(pedidoId);
}
```

Los snapshots se crean típicamente en background de forma periódica o cuando el stream supera cierto tamaño. No afectan la corrección del sistema — si el snapshot no existe, simplemente se hace el replay completo.

## Event Sourcing y CQRS: la combinación natural

Event Sourcing y CQRS se complementan de forma muy directa. El Event Store es la fuente de verdad para los comandos (escrituras). Las proyecciones son vistas materializadas construidas a partir de los eventos, optimizadas para las consultas (lecturas).

Cuando se persiste un nuevo evento en el Event Store, un proceso asíncrono lo consume y actualiza las proyecciones relevantes:

```java
@Component
public class ProyeccionPedidos {

    @EventHandler
    public void on(PedidoCreado evento) {
        // Insertar fila en tabla de resumen de pedidos
        pedidosView.insertar(new PedidoResumen(
            evento.getPedidoId(),
            evento.getClienteId(),
            "BORRADOR",
            evento.getOcurridoEn()
        ));
    }

    @EventHandler
    public void on(ProductoAgregadoAPedido evento) {
        // Actualizar total en la vista de resumen
        pedidosView.actualizarTotal(evento.getPedidoId());
    }

    @EventHandler
    public void on(PedidoConfirmado evento) {
        pedidosView.actualizarEstado(evento.getPedidoId(), "CONFIRMADO");
    }
}
```

La gran ventaja es que las proyecciones se pueden **reconstruir desde cero** en cualquier momento. Si necesitas agregar una nueva vista para satisfacer un requisito de reporting, simplemente creas la proyección y reprocesas todos los eventos históricos. No hay que migrar datos ni reconstruir el historial — el historial ya está ahí.

## Ventajas concretas

**Auditoría gratuita.** Toda la historia del sistema está en el Event Store. No necesitas tablas de auditoría adicionales ni logs de aplicación para responder "¿qué pasó con este pedido?"

**Debugging simplificado.** Si algo salió mal, puedes reproducir exactamente la secuencia de eventos que llevó al problema. Puedes incluso tomar el stream de producción y reproducirlo en local.

**Time travel.** Puedes reconstruir el estado de cualquier entidad en cualquier punto del pasado. ¿Cómo estaba el pedido ayer a las 14:30? Solo hay que replayear hasta ese timestamp.

**Nuevas proyecciones retroactivas.** Agregar una nueva vista o reporte sobre datos históricos es trivial: procesas los eventos que ya existen.

**Integración desacoplada.** Los eventos publicados al Event Store pueden ser consumidos por otros sistemas (notificaciones, analytics, sincronización con terceros) sin acoplar directamente los bounded contexts.

## Los desafíos que no se deben ignorar

Event Sourcing no es gratis. Hay costos reales que hay que tener en cuenta.

**Consistencia eventual en las lecturas.** Las proyecciones se actualizan de forma asíncrona, lo que significa que las lecturas pueden devolver datos que no reflejan los últimos eventos. Esto es aceptable para muchos casos de uso, pero no para todos.

**Versionado de eventos.** Cuando el negocio cambia, los eventos también pueden cambiar: nuevos campos, campos renombrados, eventos que se dividen en dos. Necesitas una estrategia de versionado para poder seguir reproduciendo eventos antiguos. Las dos opciones más comunes son upcasting (transformar el evento viejo al formato nuevo al cargarlo) o mantener múltiples versiones del handler.

**Curva de aprendizaje.** El modelo mental es diferente al CRUD tradicional. Los equipos necesitan tiempo para interiorizar la diferencia entre comandos, eventos y proyecciones.

**Complejidad operacional.** El Event Store debe ser durable y de alta disponibilidad. La infraestructura de proyecciones necesita manejar retrasos y fallos de procesamiento.

## Cuándo tiene sentido

Event Sourcing brilla en dominios donde el historial importa tanto como el estado actual: sistemas financieros, e-commerce de alto volumen, aplicaciones de salud, sistemas legales o cualquier contexto donde la trazabilidad es un requisito de negocio, no un add-on.

También es útil cuando el sistema necesita integrarse con múltiples consumidores downstream — en ese caso, el Event Store actúa como la fuente de verdad compartida y cada consumidor construye su propia proyección.

Por otro lado, si el sistema es un CRUD relativamente simple donde el historial no aporta valor, Event Sourcing agrega complejidad sin beneficio proporcional. La regla general es que lo justifica cuando la respuesta a "¿cómo llegamos aquí?" es una pregunta frecuente y valiosa en el negocio.

## El registro permanente como ventaja competitiva

Lo más poderoso de Event Sourcing no es técnico: es que convierte el historial del sistema en un activo. Los datos de eventos pueden alimentar modelos de análisis, detectar patrones de comportamiento, generar auditorías automáticas y responder preguntas que todavía no se han hecho. Con un sistema CRUD tradicional, cuando necesitas el historial y no lo guardaste, ya es demasiado tarde.

La combinación de Event Sourcing con CQRS y DDD, conceptos que ya hemos visto en el blog, forma una base sólida para sistemas que necesitan ser trazables, escalables y evolucionables a medida que el negocio crece.
