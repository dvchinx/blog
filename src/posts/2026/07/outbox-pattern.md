---
titulo: "El patrón Outbox: consistencia entre base de datos y mensajería"
seoTitulo: "Outbox Pattern explicado: cómo resolver el problema de dual-write en microservicios"
fecha: "2026-07-21"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "El patrón Transactional Outbox resuelve uno de los problemas más frecuentes en microservicios: garantizar que los cambios en la base de datos y los mensajes publicados al broker sean siempre consistentes, sin depender de transacciones distribuidas."
imagenPortada: "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Microservices", "Distributed Systems", "Outbox Pattern", "Best Practices"]
categoria: "tech"
keywords: "outbox pattern, transactional outbox, dual write problem, microservicios consistencia, message broker consistencia, CDC change data capture, Debezium, event driven, publicación eventos confiable, idempotencia"
---

# El patrón Outbox: consistencia entre base de datos y mensajería

En los sistemas de microservicios orientados a eventos existe un problema que aparece antes de lo que se espera: necesitas modificar la base de datos **y** publicar un mensaje al broker, y ambas cosas deben ocurrir juntas o no ocurrir ninguna.

Si publicas primero al broker y luego falla la escritura en base de datos, tienes un evento publicado que no corresponde a ningún cambio real. Si escribes primero en base de datos y luego falla la publicación, tienes un cambio de estado que nadie conoce. Este problema se llama **dual-write**, y no hay forma de resolverlo con dos llamadas independientes.

El patrón Outbox resuelve esto sin transacciones distribuidas ni coordinación entre sistemas.

## El problema del dual-write en detalle

Imagina un servicio de pedidos. Cuando se confirma un pedido, hay que actualizar su estado en la base de datos **y** publicar un evento `PedidoConfirmado` en Kafka para que el servicio de inventario pueda reservar los productos.

El código ingenuo se ve así:

```java
@Transactional
public void confirmarPedido(String pedidoId) {
    Pedido pedido = pedidoRepository.findById(pedidoId)
        .orElseThrow(() -> new NotFoundException(pedidoId));

    pedido.confirmar();
    pedidoRepository.save(pedido); // guarda en base de datos

    kafkaTemplate.send("pedidos", new PedidoConfirmado(pedidoId)); // ¿qué pasa si falla aquí?
}
```

El `@Transactional` protege la escritura en base de datos, pero Kafka está fuera de esa transacción. Si la publicación falla — red caída, broker reiniciándose, error en la serialización — el pedido ya fue confirmado en la base de datos pero el resto del sistema no lo sabe. El inventario nunca reservó los productos. El pedido quedó en un estado inconsistente.

Podría invertirse el orden, publicando primero en Kafka, pero el problema es el mismo con los roles cambiados.

## La solución: escribir el mensaje en la base de datos

La idea central del patrón Outbox es simple: **en lugar de publicar directamente al broker, persiste el mensaje en una tabla de la misma base de datos**, dentro de la misma transacción que modifica el estado del negocio. Luego, un proceso separado lee esa tabla y publica los mensajes al broker.

```
┌─────────────────────────────────────────────┐
│            Transacción atómica              │
│  ┌─────────────┐     ┌─────────────────┐   │
│  │  tabla      │     │  tabla          │   │
│  │  pedidos    │     │  outbox         │   │
│  │             │     │                 │   │
│  │ UPDATE ...  │ +   │ INSERT evento   │   │
│  └─────────────┘     └─────────────────┘   │
└─────────────────────────────────────────────┘
           │
           ▼ (proceso asíncrono)
    ┌──────────────┐       ┌─────────────┐
    │ Message      │──────▶│   Kafka /   │
    │ Relay        │       │   RabbitMQ  │
    └──────────────┘       └─────────────┘
```

La atomicidad la garantiza la base de datos. Si la transacción se confirma, tanto el cambio de estado como el mensaje en la tabla outbox quedaron persistidos. Si la transacción falla, ambos se revierten. La publicación al broker se convierte en un problema separado, manejado de forma asíncrona.

## La tabla Outbox

La tabla outbox almacena los mensajes pendientes de enviar. Su estructura básica cubre todo lo que necesita el proceso de relay:

```sql
CREATE TABLE outbox (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo        VARCHAR(255) NOT NULL,       -- nombre del evento, p.ej. "PedidoConfirmado"
    payload     JSONB NOT NULL,             -- cuerpo del mensaje serializado
    destino     VARCHAR(255) NOT NULL,       -- topic o exchange de destino
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    enviado_en  TIMESTAMPTZ,                -- NULL mientras no se haya enviado
    intentos    INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_outbox_no_enviados ON outbox (creado_en)
    WHERE enviado_en IS NULL;
```

El índice parcial sobre `enviado_en IS NULL` hace que el proceso de relay solo escanee los mensajes pendientes, sin recorrer toda la historia de la tabla.

## Modificar el servicio para usar Outbox

El servicio ya no llama al broker directamente. En cambio, persiste el mensaje en la tabla outbox dentro de la misma transacción del negocio:

```java
@Transactional
public void confirmarPedido(String pedidoId) {
    Pedido pedido = pedidoRepository.findById(pedidoId)
        .orElseThrow(() -> new NotFoundException(pedidoId));

    pedido.confirmar();
    pedidoRepository.save(pedido);

    // El mensaje se persiste en la misma transacción — atomicidad garantizada
    OutboxMessage mensaje = OutboxMessage.builder()
        .tipo("PedidoConfirmado")
        .destino("pedidos.eventos")
        .payload(toJson(new PedidoConfirmadoEvent(pedidoId, pedido.getClienteId())))
        .build();

    outboxRepository.save(mensaje);
}
```

```java
@Entity
@Table(name = "outbox")
public class OutboxMessage {
    @Id
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private String tipo;

    @Column(nullable = false)
    private String destino;

    @Column(columnDefinition = "jsonb", nullable = false)
    private String payload;

    @Column(name = "creado_en", nullable = false)
    private Instant creadoEn = Instant.now();

    @Column(name = "enviado_en")
    private Instant enviadoEn;

    private int intentos;

    // getters, setters, builder...
}
```

## El Message Relay: polling publisher

El proceso que lee la tabla outbox y publica al broker se llama **Message Relay** o **Polling Publisher**. Se ejecuta en background de forma periódica:

```java
@Component
public class OutboxRelay {

    private final OutboxRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;

    @Scheduled(fixedDelay = 1000) // ejecuta cada segundo
    @Transactional
    public void procesarPendientes() {
        List<OutboxMessage> pendientes = outboxRepository
            .findTop50ByEnviadoEnIsNullOrderByCreadoEnAsc();

        for (OutboxMessage mensaje : pendientes) {
            try {
                kafkaTemplate.send(mensaje.getDestino(), mensaje.getId().toString(), mensaje.getPayload())
                    .get(5, TimeUnit.SECONDS); // esperar confirmación del broker

                mensaje.setEnviadoEn(Instant.now());
                outboxRepository.save(mensaje);
            } catch (Exception e) {
                mensaje.setIntentos(mensaje.getIntentos() + 1);
                outboxRepository.save(mensaje);
                log.warn("Error publicando mensaje {}: {}", mensaje.getId(), e.getMessage());
            }
        }
    }
}
```

```java
@Repository
public interface OutboxRepository extends JpaRepository<OutboxMessage, UUID> {
    List<OutboxMessage> findTop50ByEnviadoEnIsNullOrderByCreadoEnAsc();
}
```

Algunos detalles a tener en cuenta en el relay:

**Lote limitado**: procesar de 50 en 50 (o el tamaño que corresponda al volumen del sistema) evita transacciones largas y presión sobre el broker.

**Espera de confirmación del broker**: el `.get()` convierte la publicación asíncrona en síncrona para este contexto, garantizando que el mensaje fue aceptado antes de marcarlo como enviado.

**Registro de intentos**: llevar un contador de intentos fallidos permite implementar dead-letter logic después de N intentos, o escalar la alerta.

## Change Data Capture con Debezium

El polling publisher es simple de implementar, pero tiene un coste: ejecuta queries de lectura constantes sobre la base de datos, aunque no haya mensajes pendientes. Para sistemas de alto volumen, la alternativa más eficiente es **Change Data Capture (CDC)**.

CDC aprovecha el log de transacciones de la base de datos (WAL en PostgreSQL, binlog en MySQL) para detectar nuevas filas en la tabla outbox en el momento exacto en que se insertan, sin polling.

**Debezium** es el conector CDC más usado en el ecosistema JVM. Se conecta al log de transacciones de la base de datos y emite eventos de cambio que pueden enrutarse directamente a Kafka:

```yaml
# Configuración de conector Debezium para PostgreSQL
connector.class: io.debezium.connector.postgresql.PostgresConnector
database.hostname: postgres
database.port: 5432
database.user: debezium
database.password: secret
database.dbname: miapp
database.server.name: miapp

# Solo monitorear la tabla outbox
table.include.list: public.outbox

# Transformaciones para enrutar cada mensaje a su topic
transforms: outbox
transforms.outbox.type: io.debezium.transforms.outbox.EventRouter
transforms.outbox.table.field.event.id: id
transforms.outbox.table.field.event.key: id
transforms.outbox.table.field.event.type: tipo
transforms.outbox.table.field.event.payload: payload
transforms.outbox.route.by.field: destino
```

Con esta configuración, Debezium actúa como el relay automáticamente. No necesitas el `@Scheduled` del ejemplo anterior. Cada INSERT en la tabla outbox genera un mensaje en Kafka casi en tiempo real, con latencia de milisegundos.

La ventaja operacional es significativa: el CDC no añade carga a la base de datos de la aplicación (lee el WAL, que es un log que la base de datos mantiene de todos modos), y la latencia es mucho menor que el polling.

## Idempotencia en el consumidor

El patrón Outbox garantiza **at-least-once delivery**: si el proceso de relay falla después de publicar el mensaje pero antes de marcarlo como enviado, lo volverá a publicar en el siguiente ciclo. El consumidor podría recibir el mismo mensaje más de una vez.

La solución estándar es que los consumidores sean **idempotentes**: procesar el mismo mensaje dos veces debe producir el mismo resultado que procesarlo una vez.

Una forma simple es mantener una tabla de mensajes ya procesados, indexada por el ID del mensaje del outbox:

```java
@Transactional
public void procesarPedidoConfirmado(ConsumerRecord<String, String> record) {
    String messageId = record.key(); // el ID del registro en la tabla outbox

    if (mensajesProcesadosRepository.existsById(messageId)) {
        log.info("Mensaje {} ya procesado, ignorando duplicado", messageId);
        return;
    }

    PedidoConfirmadoEvent evento = deserializar(record.value());

    // lógica de negocio
    inventarioService.reservarProductos(evento.getPedidoId());

    // registrar el mensaje como procesado dentro de la misma transacción
    mensajesProcesadosRepository.save(new MensajeProcesado(messageId));
}
```

```sql
CREATE TABLE mensajes_procesados (
    message_id  VARCHAR(255) PRIMARY KEY,
    procesado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Muchos brokers también soportan exactly-once semantics a nivel de transacción (Kafka Transactions, por ejemplo), pero la deduplicación en el consumidor es más portable y funciona independientemente del broker.

## Limpieza de la tabla Outbox

Con el tiempo, la tabla outbox acumula millones de mensajes ya enviados. Es importante purgarlos periódicamente para evitar que crezca sin control:

```java
@Scheduled(cron = "0 0 3 * * *") // todos los días a las 3 AM
@Transactional
public void limpiarMensajesEnviados() {
    Instant hace7Dias = Instant.now().minus(7, ChronoUnit.DAYS);
    int eliminados = outboxRepository.deleteByEnviadoEnBefore(hace7Dias);
    log.info("Outbox cleanup: {} mensajes eliminados", eliminados);
}
```

```java
@Modifying
@Query("DELETE FROM OutboxMessage o WHERE o.enviadoEn < :antes")
int deleteByEnviadoEnBefore(@Param("antes") Instant antes);
```

El periodo de retención depende del negocio. Mantener los mensajes unos días permite reenviarlos manualmente si se detecta algún problema con el consumidor sin haber perdido la fuente.

## Ventajas y trade-offs

El patrón Outbox es casi siempre la solución correcta cuando necesitas consistencia entre estado y eventos, pero tiene costos reales.

**Ventajas:**
- Garantiza que los eventos se publiquen si y solo si la transacción del negocio se confirma.
- No depende de transacciones distribuidas (XA, 2PC), que tienen un coste de coordinación alto y poca adopción en ecosistemas modernos.
- Funciona con cualquier broker de mensajería.
- El historial de mensajes enviados queda en la base de datos, facilita el debugging.

**Trade-offs:**
- Introduce latencia en la publicación: los mensajes no llegan al broker en el mismo instante que la transacción, sino cuando el relay los procesa.
- Agrega complejidad operacional: el proceso de relay (polling o CDC) es otra pieza que puede fallar y necesita monitoreo.
- Requiere diseñar los consumidores para ser idempotentes.
- La tabla outbox puede crecer rápido en sistemas de alto volumen si la limpieza no está bien configurada.

## Cuándo tiene sentido

El patrón Outbox es necesario siempre que una operación de negocio deba producir tanto un cambio de estado **como** un evento observable por otros servicios, y la consistencia entre ambos sea un requisito real.

Es especialmente relevante en sistemas que combinan el patrón Saga (donde la coordinación entre microservicios depende de eventos fiables), Event Sourcing (donde los eventos son la fuente de verdad) o cualquier arquitectura donde la pérdida silenciosa de un evento tenga consecuencias en el negocio.

Por otro lado, si la publicación al broker es simplemente informativa y la pérdida ocasional de un evento es aceptable, el dual-write simple puede ser suficiente. La complejidad adicional del Outbox solo se justifica cuando la garantía de entrega importa de verdad.

La combinación de Transactional Outbox con los patrones que ya hemos visto en el blog —Saga, CQRS y Event Sourcing— forma la base de los sistemas distribuidos que pueden fallar en cualquier punto y aun así mantener la consistencia eventual del negocio.
