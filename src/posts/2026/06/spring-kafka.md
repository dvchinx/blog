---
titulo: "Spring Boot con Apache Kafka: mensajería orientada a eventos"
seoTitulo: "Spring Boot con Apache Kafka: guía práctica de mensajería y event streaming"
fecha: "2026-06-24"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a integrar Apache Kafka en una aplicación Spring Boot: configura productores, consumidores, manejo de errores y serialización con ejemplos prácticos."
imagenPortada: "https://i.imgur.com/FvoQ1sH.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Kafka", "Java", "Backend", "Mensajería", "Event Streaming"]
categoria: "tech"
keywords: "Spring Boot Kafka, Apache Kafka Java, spring-kafka, productor Kafka Spring, consumidor Kafka Spring, KafkaTemplate, @KafkaListener, serialización JSON Kafka, mensajería orientada a eventos, event streaming Spring"
---

# Spring Boot con Apache Kafka: mensajería orientada a eventos

Las arquitecturas modernas de microservicios necesitan una forma fiable de que los servicios se comuniquen sin acoplarse directamente entre sí. Apache Kafka se ha convertido en el estándar de facto para ese problema: un broker de mensajería distribuido, de alto rendimiento y con persistencia duradera que actúa como columna vertebral del flujo de eventos entre servicios.

Spring Boot tiene soporte de primera clase para Kafka a través del módulo **spring-kafka**, que envuelve el cliente Java oficial de Kafka en abstracciones idiomáticas de Spring: configuración basada en propiedades, plantillas para producir mensajes y anotaciones para consumirlos.

## Conceptos clave de Kafka

Antes de ver código, vale la pena tener claros cuatro conceptos fundamentales:

- **Topic**: canal lógico al que los productores publican mensajes y del que los consumidores leen. Un topic puede tener múltiples particiones.
- **Partición**: unidad de paralelismo. Los mensajes dentro de una partición están ordenados; entre particiones no hay garantía de orden global.
- **Producer**: cliente que publica mensajes en un topic. Puede especificar una clave para controlar en qué partición cae el mensaje.
- **Consumer group**: conjunto de consumidores que leen de un mismo topic de forma cooperativa. Kafka garantiza que cada partición es leída por un único consumidor del grupo en un momento dado, lo que permite escalar horizontalmente sin procesar duplicados.

## Dependencias

Agrega el starter de Kafka en `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
```

El starter trae el cliente Kafka oficial y toda la infraestructura de spring-kafka. No necesitas dependencias adicionales para el caso básico.

## Configuración

La configuración mínima en `application.yml`:

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    consumer:
      group-id: my-service
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      auto-offset-reset: earliest
      properties:
        spring.json.trusted.packages: "com.example.events"
```

El serializador `JsonSerializer` convierte los objetos Java a JSON automáticamente. El deserializador `JsonDeserializer` necesita la propiedad `spring.json.trusted.packages` por seguridad: solo deserializa clases de los paquetes que declares explícitamente.

Para desarrollo local, la forma más rápida de levantar Kafka es con Docker Compose:

```yaml
services:
  kafka:
    image: confluentinc/cp-kafka:7.6.0
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      CLUSTER_ID: "MkU3OEVBNTcwNTJENDM2Qk"
```

Esta configuración usa el modo KRaft (sin ZooKeeper), disponible desde Kafka 3.3.

## Modelo de evento

Define los eventos como clases Java simples. Con Jackson, spring-kafka los serializa y deserializa automáticamente:

```java
package com.example.events;

public record OrderCreatedEvent(
        Long orderId,
        String customerId,
        List<OrderItem> items,
        BigDecimal total,
        Instant createdAt
) {}

public record OrderItem(Long productId, int quantity, BigDecimal unitPrice) {}
```

Usar `record` es ideal para eventos: son inmutables por naturaleza, tienen `equals`/`hashCode` automáticos y el código es más compacto.

## Productor: publicar eventos

`KafkaTemplate` es la abstracción central para publicar mensajes. Spring la configura automáticamente a partir de las propiedades de `application.yml`:

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    private static final String TOPIC = "order-events";

    public void publishOrderCreated(OrderCreatedEvent event) {
        kafkaTemplate.send(TOPIC, event.orderId().toString(), event)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Error al publicar evento para orden {}: {}", 
                                event.orderId(), ex.getMessage());
                    } else {
                        log.info("Evento publicado: orden={}, partition={}, offset={}",
                                event.orderId(),
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }
}
```

Observa dos detalles importantes:

- **La clave del mensaje** (`event.orderId().toString()`) determina la partición. Kafka garantiza que todos los mensajes con la misma clave van a la misma partición, preservando el orden por entidad.
- **`whenComplete`**: `KafkaTemplate.send()` devuelve un `CompletableFuture`. El callback `whenComplete` te permite reaccionar al éxito o error sin bloquear el hilo.

### Publicación síncrona

Si necesitas confirmar que el mensaje llegó antes de continuar (por ejemplo, en una transacción):

```java
public void publishOrderCreatedSync(OrderCreatedEvent event) {
    try {
        SendResult<String, OrderCreatedEvent> result = 
                kafkaTemplate.send(TOPIC, event.orderId().toString(), event).get();
        log.info("Publicado en partition={}, offset={}",
                result.getRecordMetadata().partition(),
                result.getRecordMetadata().offset());
    } catch (InterruptedException | ExecutionException ex) {
        Thread.currentThread().interrupt();
        throw new KafkaPublishException("No se pudo publicar el evento", ex);
    }
}
```

La publicación síncrona reduce el throughput porque el productor espera el ACK del broker. Úsala solo cuando el orden de las operaciones lo requiera.

## Consumidor: procesar eventos

La anotación `@KafkaListener` marca un método como consumidor de uno o varios topics:

```java
@Service
@Slf4j
public class OrderEventConsumer {

    @KafkaListener(topics = "order-events", groupId = "inventory-service")
    public void handleOrderCreated(OrderCreatedEvent event, 
                                    @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
                                    @Header(KafkaHeaders.OFFSET) long offset) {
        log.info("Procesando orden={} desde partition={}, offset={}", 
                event.orderId(), partition, offset);
        
        // lógica de negocio...
        reserveStock(event);
    }

    private void reserveStock(OrderCreatedEvent event) {
        event.items().forEach(item -> {
            log.info("Reservando {} unidades del producto {}", 
                    item.quantity(), item.productId());
            // ...
        });
    }
}
```

`@Header` permite acceder a metadatos del mensaje de Kafka, como la partición y el offset. Es útil para logging y debugging.

### Escuchar múltiples topics o particiones

```java
// Múltiples topics
@KafkaListener(topics = {"order-events", "return-events"}, groupId = "warehouse-service")
public void handleEvents(ConsumerRecord<String, Object> record) {
    log.info("Topic: {}, evento: {}", record.topic(), record.value());
}

// Particiones específicas (menos común, para control fino)
@KafkaListener(topicPartitions = {
        @TopicPartition(topic = "order-events", partitions = {"0", "1"})
})
public void handlePartitions(OrderCreatedEvent event) {
    // solo procesa particiones 0 y 1
}
```

## Creación automática de topics

Por defecto, si el topic no existe, Kafka puede crearlo automáticamente (dependiendo de la configuración del broker). Para tener control explícito desde la aplicación, declare los topics como beans:

```java
@Configuration
public class KafkaTopicConfig {

    @Bean
    public NewTopic orderEventsTopic() {
        return TopicBuilder.name("order-events")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic returnEventsTopic() {
        return TopicBuilder.name("return-events")
                .partitions(3)
                .replicas(1)
                .build();
    }
}
```

Spring Kafka detecta estos beans al arrancar y crea los topics si no existen. En producción, normalmente los topics se crean con herramientas de infraestructura (Terraform, Confluent Control Center, etc.) y no desde la aplicación.

## Manejo de errores

### Retry con backoff

Cuando el consumidor lanza una excepción, spring-kafka puede reintentar el mensaje con espera exponencial antes de enviarlo a un dead-letter topic:

```java
@Configuration
public class KafkaConsumerConfig {

    @Bean
    public DefaultErrorHandler errorHandler(KafkaOperations<Object, Object> template) {
        // Reintentar hasta 3 veces con backoff: 1s, 2s, 4s
        ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(3);
        backOff.setInitialInterval(1_000L);
        backOff.setMultiplier(2.0);

        DeadLetterPublishingRecoverer recoverer = 
                new DeadLetterPublishingRecoverer(template,
                        (r, e) -> new TopicPartition(r.topic() + ".DLT", r.partition()));

        return new DefaultErrorHandler(recoverer, backOff);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory,
            DefaultErrorHandler errorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory = 
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }
}
```

`DeadLetterPublishingRecoverer` envía los mensajes que agotan los reintentos al topic `{topic-original}.DLT`. Esos mensajes pueden analizarse, corregirse y reprocesarse manualmente.

### Excepciones que no deben reintentarse

Algunas excepciones (como errores de deserialización o validación de negocio) no tienen sentido reintentar: el mismo mensaje fallará siempre. Puedes configurar una lista de excepciones no reintentables:

```java
DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer, backOff);
errorHandler.addNotRetryableExceptions(
        DeserializationException.class,
        IllegalArgumentException.class
);
```

## Concurrencia en el consumidor

Por defecto, cada `@KafkaListener` usa un único hilo. Para aumentar el paralelismo ajusta la concurrencia:

```java
@KafkaListener(topics = "order-events", groupId = "inventory-service", concurrency = "3")
public void handleOrderCreated(OrderCreatedEvent event) {
    // Este método se ejecuta en hasta 3 hilos en paralelo
    // (uno por partición asignada a este consumer group)
}
```

La concurrencia máxima útil está limitada por el número de particiones del topic. Si el topic tiene 3 particiones y pones `concurrency = "5"`, dos hilos quedarán sin trabajo.

## Transacciones con Kafka

Kafka soporta transacciones: producir mensajes y consumir offsets de forma atómica. Spring Kafka lo expone a través de `@Transactional` cuando el productor tiene el `transactional-id` configurado:

```yaml
spring:
  kafka:
    producer:
      transaction-id-prefix: tx-
```

```java
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    @Transactional // transacción de base de datos + Kafka coordinada
    public Order createOrder(CreateOrderRequest request) {
        Order order = orderRepository.save(Order.from(request));
        
        kafkaTemplate.send("order-events", 
                order.getId().toString(), 
                OrderCreatedEvent.from(order));

        return order;
    }
}
```

Con `transactional-id-prefix` configurado, `KafkaTemplate` participa en la transacción de Spring. Si la transacción de base de datos hace rollback, el mensaje de Kafka también se descarta. Esto resuelve el problema clásico del "doble commit": sin transacciones, podrías guardar en BD pero fallar al publicar (o viceversa).

**Nota**: las transacciones de Kafka implican un coste de latencia y throughput. Evalúa si los necesitas antes de activarlos.

## Testing

spring-kafka ofrece `EmbeddedKafka` para tests de integración sin necesidad de un broker real:

```java
@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {"order-events"})
@TestPropertySource(properties = {
        "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}",
        "spring.kafka.consumer.auto-offset-reset=earliest"
})
class OrderEventConsumerTest {

    @Autowired
    private KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    @SpyBean
    private OrderEventConsumer consumer;

    @Test
    void deberiaProcessarEventoDeOrden() throws Exception {
        OrderCreatedEvent event = new OrderCreatedEvent(
                1L, "customer-123",
                List.of(new OrderItem(10L, 2, new BigDecimal("29.99"))),
                new BigDecimal("59.98"),
                Instant.now()
        );

        kafkaTemplate.send("order-events", "1", event);

        // Esperar hasta 10 segundos a que el consumidor lo procese
        verify(consumer, timeout(10_000).times(1)).handleOrderCreated(eq(event), anyInt(), anyLong());
    }
}
```

`@EmbeddedKafka` arranca un broker Kafka en memoria durante el test. La propiedad `${spring.embedded.kafka.brokers}` se resuelve automáticamente a la dirección del broker embebido.

Para tests unitarios del productor o del consumidor aislados, puedes usar mocks estándar de Mockito sin necesidad de Kafka.

## Monitoreo

spring-kafka expone métricas de Kafka a través de Micrometer cuando tienes spring-boot-actuator en el classpath. Las más relevantes:

- `kafka.producer.record.send.rate`: mensajes enviados por segundo.
- `kafka.consumer.records.consumed.rate`: mensajes consumidos por segundo.
- `kafka.consumer.fetch.manager.records.lag`: diferencia entre el offset más reciente del topic y el offset del consumidor. Un lag creciente indica que el consumidor no da abasto.

El **consumer lag** es la métrica más importante para la salud de un sistema basado en Kafka: si crece de forma sostenida, hay que escalar los consumidores o revisar el rendimiento del procesamiento.

## Buenas prácticas

**Diseña eventos inmutables.** Un evento representa algo que ya ocurrió; no debería modificarse. Usa `record` en Java o clases con campos `final`.

**Incluye metadatos en el evento.** Agrega siempre un identificador único (`eventId`), la marca de tiempo (`occurredAt`) y el tipo de evento. Facilita el trazado, la deduplicación y la depuración.

**Haz los consumidores idempotentes.** Kafka garantiza al menos una entrega (*at-least-once*): en caso de fallos, el mismo mensaje puede llegar más de una vez. Tu consumidor debe poder procesar el mismo mensaje varias veces sin efectos secundarios indeseados.

**Elige bien las claves.** La clave determina la partición y, por tanto, el orden de procesamiento. Usa como clave el identificador de la entidad principal (ID de orden, ID de usuario). Sin clave, Kafka distribuye por round-robin y pierdes la garantía de orden por entidad.

**Define un esquema explícito para los eventos.** Para sistemas en producción con múltiples consumidores, considera usar un schema registry (como Confluent Schema Registry con Avro o Protobuf) en lugar de JSON libre. Detecta incompatibilidades antes de desplegar.

**No pongas lógica de negocio pesada en el listener.** El listener debe leer el mensaje, validarlo y delegarlo a un servicio. Mantén la lógica testeable e independiente de Kafka.

## Conclusión

Spring Boot hace que integrar Kafka sea sorprendentemente sencillo: unas pocas propiedades, `KafkaTemplate` para producir y `@KafkaListener` para consumir. La complejidad real está en el diseño de los eventos, el manejo de errores y la gestión de la idempotencia, que son desafíos propios de la arquitectura orientada a eventos independientemente del framework.

Kafka brilla en escenarios donde necesitas desacoplamiento entre servicios, procesamiento asíncrono de alta volumetría o un log de eventos durable que múltiples consumidores puedan leer de forma independiente. Para comunicación síncrona punto a punto entre microservicios, un cliente REST sigue siendo la opción más simple y directa.
