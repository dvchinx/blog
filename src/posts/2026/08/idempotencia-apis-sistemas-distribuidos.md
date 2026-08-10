---
titulo: "Idempotencia en APIs y sistemas distribuidos: operaciones seguras de reintentar"
seoTitulo: "Idempotencia en APIs REST y sistemas distribuidos: patrones, claves de idempotencia y deduplicación"
fecha: "2026-08-11"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es la idempotencia, por qué es esencial en APIs y sistemas distribuidos, cómo implementar claves de idempotencia en operaciones HTTP y cómo garantizar procesamiento exactamente-una-vez en consumidores de mensajes."
imagenPortada: "https://i.imgur.com/XSccD7r.png?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "APIs", "Distributed Systems", "Best Practices", "Reliability"]
categoria: "tech"
keywords: "idempotencia apis, idempotency key, operaciones idempotentes, sistemas distribuidos, exactly-once semantics, deduplicación mensajes, HTTP idempotente, reintentos seguros, at-least-once delivery, idempotency REST API"
---

# Idempotencia en APIs y sistemas distribuidos: operaciones seguras de reintentar

En un sistema distribuido, los fallos de red no son la excepción: son la norma. Una petición HTTP puede enviarse correctamente pero la respuesta puede perderse. Un mensaje puede procesarse y el broker fallar antes de que el consumidor confirme la entrega. Un cliente puede recibir un timeout sin saber si la operación se completó o no.

La respuesta instintiva a estos escenarios es reintentar. El problema es que reintentar una operación que no es idempotente puede producir efectos duplicados: un mismo pago procesado dos veces, un mismo email enviado tres veces, un mismo registro insertado cuatro veces.

**La idempotencia** es la propiedad que hace que reintentar sea seguro. Una operación es idempotente si ejecutarla una o más veces produce exactamente el mismo resultado que ejecutarla una sola vez. No importa cuántos reintentos haya: el estado final del sistema es idéntico.

Construir sistemas distribuidos fiables sin idempotencia es casi imposible. Este artículo explica qué la hace funcionar, cómo implementarla en APIs REST y sistemas de mensajería, y qué trampas evitar.

## Idempotencia en HTTP: lo que ya tienes y lo que debes construir

El protocolo HTTP define explícitamente qué métodos son idempotentes y cuáles no. Entender esta distinción es el punto de partida.

### Métodos idempotentes por definición

**GET** es idempotente por naturaleza: leer un recurso no cambia el estado del servidor. Diez llamadas a `GET /orders/123` devuelven el mismo recurso diez veces sin efecto colateral.

**DELETE** es idempotente: eliminar un recurso que ya no existe debe devolver un estado consistente (en general `404` o `204`), pero el estado final del sistema —el recurso no existe— es el mismo que tras la primera llamada.

**PUT** es idempotente cuando se usa correctamente: reemplazar el estado completo de un recurso con el mismo payload siempre produce el mismo resultado. `PUT /users/42` con el mismo cuerpo JSON aplicado diez veces deja al usuario en el mismo estado.

**PATCH** no es idempotente por defecto. `PATCH /accounts/1` con el cuerpo `{"balance": "+100"}` no es idempotente: aplicarlo tres veces añade 300 en lugar de 100. Sin embargo, puede diseñarse para serlo si el patch expresa el estado final en lugar de una operación delta: `{"balance": 1500}` sí es idempotente.

### El caso problemático: POST

**POST** no es idempotente en el modelo HTTP estándar. Cada llamada a `POST /payments` se interpreta como "crear un nuevo pago". Si la red falla después de que el servidor ha procesado la petición pero antes de que el cliente reciba la respuesta, y el cliente reintenta, el servidor no tiene forma de saber si ya procesó esa petición.

El resultado sin protección:

```
Cliente → POST /payments {amount: 100, card: "****1234"}  → Servidor procesa pago #1
Servidor → respuesta 200 {payment_id: "pay_abc"}
Red falla: cliente no recibe la respuesta
Cliente → POST /payments {amount: 100, card: "****1234"}  → Servidor procesa pago #2  ← DUPLICADO
Servidor → respuesta 200 {payment_id: "pay_def"}
```

El usuario ha sido cobrado dos veces por la misma operación.

## Claves de idempotencia: la solución estándar para POST

La solución es introducir una **clave de idempotencia** (`Idempotency-Key`): un identificador único generado por el cliente que el servidor usa para deduplicar peticiones. Si el servidor ya procesó una petición con esa clave, devuelve la respuesta almacenada sin volver a ejecutar la operación.

Stripe popularizó este patrón en 2015 y desde entonces se ha convertido en el estándar de la industria para APIs de pagos y cualquier operación con efectos costosos de duplicar.

### El flujo con clave de idempotencia

```
Cliente genera UUID: "idem_key_550e8400-e29b"

Cliente → POST /payments
          Idempotency-Key: idem_key_550e8400-e29b
          {amount: 100, card: "****1234"}

Servidor: ¿he visto "idem_key_550e8400-e29b" antes? → No
Servidor: procesa el pago → {payment_id: "pay_abc", status: "success"}
Servidor: almacena (clave → respuesta) en caché
Servidor → 200 {payment_id: "pay_abc", status: "success"}

[Red falla, cliente no recibe la respuesta]

Cliente → POST /payments                            ← reintento
          Idempotency-Key: idem_key_550e8400-e29b
          {amount: 100, card: "****1234"}

Servidor: ¿he visto "idem_key_550e8400-e29b" antes? → Sí
Servidor → 200 {payment_id: "pay_abc", status: "success"}  ← respuesta almacenada, sin procesar nada
```

El resultado es siempre un único pago, independientemente de cuántos reintentos haya habido.

### Implementación en el servidor

Un servidor que soporta claves de idempotencia necesita tres componentes:

1. **Un filtro que intercepte peticiones POST** y verifique si la clave ya existe.
2. **Un almacén de idempotencia**: Redis es la opción más común por su velocidad y TTL nativo.
3. **Lógica de expiración**: las claves no deben vivir indefinidamente. Un TTL de 24 horas es razonable para la mayoría de los casos.

En Spring Boot, la forma más limpia de implementarlo es con un `OncePerRequestFilter` que envuelva la respuesta con un `ContentCachingResponseWrapper` para poder capturar su contenido:

```java
@Component
@RequiredArgsConstructor
public class IdempotencyFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private static final long TTL_SECONDS = 86400; // 24 horas

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        if (!"POST".equals(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        String idempotencyKey = request.getHeader("Idempotency-Key");
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            chain.doFilter(request, response);
            return;
        }

        // Combinamos la ruta y la clave del cliente para evitar colisiones entre endpoints
        String cacheKey = "idem:" + request.getRequestURI() + ":" + idempotencyKey;
        String cached = redis.opsForValue().get(cacheKey);

        if (cached != null) {
            // Devolvemos la respuesta almacenada directamente
            IdempotencyEntry entry = objectMapper.readValue(cached, IdempotencyEntry.class);
            response.setStatus(entry.getStatus());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(entry.getBody());
            return;
        }

        // Envolvemos la respuesta para capturar su contenido
        ContentCachingResponseWrapper wrappedResponse =
            new ContentCachingResponseWrapper(response);
        chain.doFilter(request, wrappedResponse);

        // Almacenamos la respuesta para futuros reintentos
        String body = new String(wrappedResponse.getContentAsByteArray(), StandardCharsets.UTF_8);
        IdempotencyEntry entry = new IdempotencyEntry(wrappedResponse.getStatus(), body);
        redis.opsForValue().set(
            cacheKey,
            objectMapper.writeValueAsString(entry),
            Duration.ofSeconds(TTL_SECONDS)
        );

        wrappedResponse.copyBodyToResponse();
    }
}

@Data
@AllArgsConstructor
@NoArgsConstructor
class IdempotencyEntry {
    private int status;
    private String body;
}
```

### El problema de la concurrencia: bloqueos distribuidos

Hay un caso borde crítico: ¿qué pasa si dos peticiones con la misma clave llegan simultáneamente antes de que ninguna haya terminado? Sin protección adicional, ambas pasarían la verificación inicial (la clave no existe aún) y procesarían el pago dos veces.

La solución es un bloqueo distribuido usando `setIfAbsent` de Redis, equivalente al comando `SET NX` (set if not exists):

```java
@Component
@RequiredArgsConstructor
public class IdempotencyFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String idempotencyKey = request.getHeader("Idempotency-Key");
        if (!"POST".equals(request.getMethod()) || idempotencyKey == null) {
            chain.doFilter(request, response);
            return;
        }

        String cacheKey = "idem:" + request.getRequestURI() + ":" + idempotencyKey;
        String lockKey  = "lock:" + cacheKey;

        // Intentamos adquirir el lock (NX = set if not exists, con TTL de 30s)
        Boolean lockAcquired = redis.opsForValue()
            .setIfAbsent(lockKey, "1", Duration.ofSeconds(30));

        if (!Boolean.TRUE.equals(lockAcquired)) {
            // Otro hilo está procesando la misma clave: esperamos y buscamos el resultado
            for (int i = 0; i < 10; i++) {
                Thread.sleep(500);
                String cached = redis.opsForValue().get(cacheKey);
                if (cached != null) {
                    IdempotencyEntry entry = objectMapper.readValue(cached, IdempotencyEntry.class);
                    response.setStatus(entry.getStatus());
                    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                    response.getWriter().write(entry.getBody());
                    return;
                }
            }
            response.setStatus(HttpStatus.CONFLICT.value());
            response.getWriter()
                    .write("{\"error\": \"Conflicto de idempotencia: reintenta más tarde\"}");
            return;
        }

        try {
            // Revisamos si ya hay resultado (otro hilo puede haber terminado mientras esperábamos)
            String cached = redis.opsForValue().get(cacheKey);
            if (cached != null) {
                IdempotencyEntry entry = objectMapper.readValue(cached, IdempotencyEntry.class);
                response.setStatus(entry.getStatus());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.getWriter().write(entry.getBody());
                return;
            }

            ContentCachingResponseWrapper wrappedResponse =
                new ContentCachingResponseWrapper(response);
            chain.doFilter(request, wrappedResponse);

            String body = new String(wrappedResponse.getContentAsByteArray(), StandardCharsets.UTF_8);
            IdempotencyEntry entry = new IdempotencyEntry(wrappedResponse.getStatus(), body);
            redis.opsForValue().set(
                cacheKey,
                objectMapper.writeValueAsString(entry),
                Duration.ofSeconds(86400)
            );
            wrappedResponse.copyBodyToResponse();

        } finally {
            redis.delete(lockKey); // Liberamos el lock siempre, incluso si hay excepción
        }
    }
}
```

### Qué hacer si el cuerpo de la petición no coincide

¿Qué ocurre si el cliente reutiliza una clave de idempotencia con un cuerpo diferente? Por ejemplo, `Idempotency-Key: abc123` con `amount: 100` en el primer intento y `amount: 200` en el segundo. La respuesta correcta es rechazar la petición con `422 Unprocessable Entity`.

Para detectar esto, almacenamos un hash del payload original junto a la respuesta. Spring ofrece `DigestUtils.sha256Hex` de `spring-core` para calcularlo, pero el request body es un stream que solo puede leerse una vez: hay que envolverlo en un `ContentCachingRequestWrapper` antes de extraerlo:

```java
// Model actualizado con hash del request original
@Data
@AllArgsConstructor
@NoArgsConstructor
class IdempotencyEntry {
    private int status;
    private String body;
    private String requestHash; // SHA-256 del payload original
}

// En el filtro, envolvemos también el request para poder releerlo:
ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(request);
chain.doFilter(wrappedRequest, wrappedResponse); // pasamos el request envuelto
String requestBody = new String(wrappedRequest.getContentAsByteArray(), StandardCharsets.UTF_8);
String currentHash = DigestUtils.sha256Hex(requestBody);

// Al verificar si la clave existe:
if (cached != null) {
    IdempotencyEntry entry = objectMapper.readValue(cached, IdempotencyEntry.class);
    if (!currentHash.equals(entry.getRequestHash())) {
        response.setStatus(HttpStatus.UNPROCESSABLE_ENTITY.value());
        response.getWriter().write(
            "{\"error\": \"La clave de idempotencia ya fue usada con datos diferentes\"}"
        );
        return;
    }
    response.setStatus(entry.getStatus());
    response.getWriter().write(entry.getBody());
    return;
}
```

## Idempotencia en sistemas de mensajería

Las APIs REST no son el único lugar donde la idempotencia importa. En sistemas orientados a eventos, el problema se manifiesta de forma diferente pero igual de frecuente.

### El modelo de entrega at-least-once

La mayoría de los brokers de mensajes (Kafka, RabbitMQ, SQS) garantizan entrega **at-least-once**: un mensaje será entregado al consumidor al menos una vez, pero potencialmente más de una si el broker no recibe la confirmación de procesamiento antes de su timeout.

El escenario típico:

```
Broker → Consumidor: mensaje "OrderPlaced" {order_id: "ord_123"}
Consumidor: procesa el pedido → reserva inventario, crea factura
Consumidor: falla antes de confirmar (ack) al broker
Broker: timeout → reenvía el mismo mensaje
Consumidor: procesa el pedido otra vez → intenta reservar inventario duplicado
```

Sin idempotencia en el consumidor, el sistema procesa el mismo pedido dos veces.

### Deduplicación por clave natural

La estrategia más directa es usar el identificador natural del mensaje como clave de deduplicación, apoyándose en una transacción de base de datos para que la verificación y el procesamiento sean atómicos:

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderProcessor {

    private final JdbcTemplate jdbc;
    private final InventoryService inventoryService;
    private final InvoiceService invoiceService;

    @KafkaListener(topics = "orders", groupId = "order-processor")
    @Transactional
    public void process(OrderPlacedEvent event) {
        String orderId = event.getOrderId();

        // Verificamos si ya procesamos este pedido (dentro de la misma transacción)
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM processed_orders WHERE order_id = ?",
            Integer.class,
            orderId
        );

        if (count != null && count > 0) {
            log.info("Pedido {} ya procesado, ignorando duplicado", orderId);
            return; // El ack llega al broker igualmente
        }

        // Procesamos el pedido
        inventoryService.reserve(orderId, event.getItems());
        invoiceService.create(orderId, event.getAmount());

        // Registramos que ya lo procesamos
        jdbc.update(
            "INSERT INTO processed_orders (order_id, processed_at) VALUES (?, NOW())",
            orderId
        );
    }
}
```

La clave es que la verificación y el procesamiento ocurren dentro de la misma transacción (`@Transactional`). Si la transacción falla, ningún cambio se persiste y el mensaje puede procesarse de nuevo. Si tiene éxito, el registro en `processed_orders` garantiza que el próximo intento sea un no-op.

### Deduplicación por hash del contenido

Cuando los mensajes no tienen un identificador único natural, se puede usar un hash del contenido completo como clave de deduplicación. Este componente genérico funciona con cualquier tipo de evento:

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class IdempotentConsumer {

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    @Value("${idempotency.ttl-seconds:3600}")
    private long ttlSeconds;

    public <T> void processOnce(T message, Consumer<T> handler) {
        String messageHash = computeHash(message);
        String dedupKey = "processed:" + messageHash;

        // Intentamos marcar el mensaje como en procesamiento (NX = set if not exists)
        Boolean isNew = redis.opsForValue()
            .setIfAbsent(dedupKey, "processing", Duration.ofSeconds(ttlSeconds));

        if (!Boolean.TRUE.equals(isNew)) {
            log.info("Mensaje duplicado detectado (hash: {}...), ignorando",
                     messageHash.substring(0, 8));
            return;
        }

        try {
            handler.accept(message);
            // Marcamos el procesamiento como completado
            redis.opsForValue().set(dedupKey, "done", Duration.ofSeconds(ttlSeconds));
        } catch (Exception e) {
            // Si el procesamiento falla, eliminamos la clave para permitir reintentos
            redis.delete(dedupKey);
            throw e;
        }
    }

    private <T> String computeHash(T message) {
        try {
            // Serializamos con claves ordenadas para que el hash sea determinista
            String canonical = objectMapper.writer()
                .with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .writeValueAsString(message);
            return DigestUtils.sha256Hex(canonical);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Error al serializar mensaje para hash", e);
        }
    }
}

// Uso en un listener de RabbitMQ:
@Service
@RequiredArgsConstructor
public class NotificationListener {

    private final IdempotentConsumer idempotentConsumer;
    private final EmailService emailService;

    @RabbitListener(queues = "notifications")
    public void onMessage(NotificationEvent event) {
        idempotentConsumer.processOnce(event, e -> emailService.send(e.getTo(), e.getBody()));
    }
}
```

### El modelo exactly-once en Kafka

Kafka ofrece semántica **exactly-once** (EOS) nativa desde la versión 0.11, configurando productores con idempotencia y transacciones. En Spring Kafka, basta con habilitar `enable-idempotence` y definir un `transaction-id-prefix`:

```yaml
spring:
  kafka:
    producer:
      enable-idempotence: true
      transaction-id-prefix: payment-producer-
      acks: all
      max-in-flight-requests-per-connection: 5
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
```

Con esa configuración, el productor se usa de forma transaccional:

```java
@Service
@RequiredArgsConstructor
public class PaymentEventProducer {

    private final KafkaTemplate<String, PaymentEvent> kafkaTemplate;

    @Transactional("kafkaTransactionManager")
    public void publishPayment(PaymentEvent event) {
        // Si la transacción falla, Kafka hace rollback y el mensaje no se entrega
        kafkaTemplate.send("payments", event.getPaymentId(), event);
    }
}
```

Con `enable-idempotence: true`, Kafka asigna un número de secuencia a cada mensaje por partición. Si el productor reintenta un mensaje ya entregado por un timeout de red, el broker detecta el número de secuencia duplicado y lo descarta sin enviárselo a los consumidores.

La semántica exactly-once de extremo a extremo requiere además que el consumidor lea y confirme los offsets dentro de la misma transacción en que escribe los resultados. En la práctica, esto es complejo de implementar correctamente y muchos equipos optan por at-least-once con consumidores idempotentes, que es más sencillo de operar.

## Diseñar operaciones para ser idempotentes desde el principio

La mejor estrategia es diseñar las operaciones para que sean intrínsecamente idempotentes, sin depender de una capa de deduplicación externa.

### Usar PUT en lugar de incrementos relativos

En lugar de:

```
POST /accounts/42/balance
{"delta": +100}  ← No idempotente: aplicarlo dos veces suma 200
```

Diseñar así:

```
PUT /accounts/42/balance
{"value": 1500}  ← Idempotente: aplicarlo dos veces deja 1500
```

### Condiciones en las operaciones de base de datos

Las operaciones "crear si no existe" son inherentemente idempotentes. En Spring Data JPA, un `save()` con restricción `UNIQUE` combinado con manejo del `DataIntegrityViolationException` es suficiente:

```java
@Entity
@Table(name = "subscriptions",
       uniqueConstraints = @UniqueConstraint(columnNames = "user_id"))
public class Subscription {
    @Id @GeneratedValue
    private Long id;
    private Long userId;
    private String plan;
    private Instant updatedAt;
}

@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionRepository repository;

    // PUT /subscriptions/{userId} es idempotente
    @Transactional
    public Subscription upsert(Long userId, String plan) {
        return repository.findByUserId(userId)
            .map(existing -> {
                existing.setPlan(plan);
                existing.setUpdatedAt(Instant.now());
                return repository.save(existing);
            })
            .orElseGet(() -> repository.save(
                Subscription.builder()
                    .userId(userId)
                    .plan(plan)
                    .updatedAt(Instant.now())
                    .build()
            ));
    }
}
```

### Tokens de operación en el modelo de dominio

En lugar de gestionar la idempotencia en la capa de infraestructura, algunos sistemas la incorporan directamente al modelo de dominio. La restricción `UNIQUE` en `idempotency_token` hace que la segunda inserción falle con `DataIntegrityViolationException`, que el servicio maneja para devolver el resultado original:

```java
@Entity
@Table(name = "payments",
       uniqueConstraints = @UniqueConstraint(columnNames = "idempotency_token"))
public class Payment {
    @Id
    private String id;
    private int amount;
    private String currency;
    @Column(unique = true, nullable = false)
    private String idempotencyToken; // Parte del modelo de dominio
    private String status;
}

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository repository;
    private final PaymentGateway gateway;

    @Transactional
    public Payment processPayment(PaymentCommand command) {
        // La unicidad está garantizada a nivel de datos:
        // si el token ya existe, devolvemos el pago original sin ejecutar nada
        return repository.findByIdempotencyToken(command.getIdempotencyToken())
            .orElseGet(() -> {
                Payment payment = gateway.execute(command);
                return repository.save(payment);
            });
    }
}
```

## Qué monitorizar

Implementar idempotencia sin observabilidad es operar a ciegas. Con Spring Boot Actuator y Micrometer, registrar estas métricas es directo:

```java
@Component
@RequiredArgsConstructor
public class IdempotencyMetrics {

    private final Counter idempotencyHits;
    private final Counter idempotencyConflicts;

    public IdempotencyMetrics(MeterRegistry registry) {
        this.idempotencyHits = Counter.builder("idempotency.cache.hits")
            .description("Peticiones deduplicadas por clave de idempotencia")
            .register(registry);
        this.idempotencyConflicts = Counter.builder("idempotency.conflicts")
            .description("Claves reutilizadas con datos diferentes")
            .register(registry);
    }

    public void recordHit()     { idempotencyHits.increment(); }
    public void recordConflict() { idempotencyConflicts.increment(); }
}
```

Los tres indicadores que importan: la **tasa de peticiones duplicadas detectadas** (un aumento repentino puede indicar un problema de reintentos en el cliente o un bug en la generación de claves), el **tiempo de respuesta de los duplicados** (un duplicado detectado debería ser casi instantáneo; si tiene latencia similar a las peticiones originales, la deduplicación no está funcionando), y los **errores de colisión de clave** (cuántas veces una clave fue usada con datos diferentes; debería ser cero o casi cero).

## Errores comunes

**Generar la clave de idempotencia en el servidor.** La clave debe generarla el cliente antes de enviar la petición. Si el servidor la genera, no puede detectar reintentos del mismo cliente porque cada petición llega sin clave.

**TTL demasiado corto.** Si la clave expira antes de que el cliente haya confirmado el resultado, un reintento posterior creará una operación duplicada. El TTL debe ser significativamente mayor que el período máximo de reintento del cliente.

**No guardar la respuesta completa.** Almacenar solo "ya procesé esta clave" no es suficiente: el cliente que reintenta necesita recibir la respuesta original con el `payment_id` o el recurso creado. La caché debe guardar la respuesta completa.

**Claves de idempotencia predecibles o reutilizadas.** Una clave como `user_42_payment` que el cliente reutiliza en cada sesión de compra no es una clave de idempotencia: es un identificador de usuario. Las claves deben ser UUIDs únicos por operación, generados con `UUID.randomUUID()`, no por usuario o sesión.

**No manejar la idempotencia dentro de la transacción.** Si la verificación (¿ya procesé esto?) y la operación (procesar) ocurren en pasos separados sin transacción, existe una ventana de tiempo en la que dos procesos simultáneos pueden pasar la verificación y ejecutar la operación dos veces.

## Conclusión

La idempotencia es uno de esos conceptos que parece un detalle técnico menor hasta que un pago se procesa dos veces en producción a las 3 de la mañana. En sistemas distribuidos donde los fallos de red, los timeouts y los reinicios son inevitables, construir operaciones que toleren reintentos no es un lujo: es un requisito de fiabilidad.

La buena noticia es que los patrones son claros y la implementación, aunque requiere atención a los detalles de concurrencia, no es especialmente compleja. Claves de idempotencia en el cliente, un `OncePerRequestFilter` con Redis y TTL, bloqueos distribuidos con `setIfAbsent` para proteger la ventana de verificación-procesamiento, y restricciones `UNIQUE` en la base de datos como última línea de defensa: con estas piezas en su lugar, reintentar deja de ser un riesgo y se convierte en la estrategia correcta de resiliencia.

La idempotencia y los reintentos no son herramientas de último recurso para cuando algo falla. Son la forma normal de operar en un entorno donde los fallos parciales son esperados.
