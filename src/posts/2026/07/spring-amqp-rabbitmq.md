---
titulo: "Spring AMQP con RabbitMQ: mensajería asíncrona en Java"
seoTitulo: "Spring AMQP con RabbitMQ: guía práctica de mensajería asíncrona en Spring Boot"
fecha: "2026-07-23"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a integrar RabbitMQ en Spring Boot con Spring AMQP: configura exchanges, queues y bindings, envía mensajes con RabbitTemplate y consúmelos con @RabbitListener, con manejo de errores y dead-letter queues."
imagenPortada: "https://i.imgur.com/J1U9rba.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "RabbitMQ", "Java", "Mensajería", "AMQP", "Backend"]
categoria: "tech"
keywords: "Spring AMQP, RabbitMQ Spring Boot, RabbitTemplate, @RabbitListener, mensajería asíncrona Java, exchanges RabbitMQ, dead letter queue Spring, Spring Boot RabbitMQ configuración, AMQP Java, colas mensajes Spring"
---

# Spring AMQP con RabbitMQ: mensajería asíncrona en Java

La comunicación síncrona entre servicios funciona bien cuando los tiempos de respuesta son cortos y la disponibilidad del receptor está garantizada. Cuando ninguna de las dos condiciones se cumple —procesamiento lento, picos de carga, operaciones que pueden diferirse— un message broker como RabbitMQ cambia el modelo: el productor deposita el mensaje y sigue adelante; el consumidor lo procesa cuando puede.

Spring AMQP es la abstracción de Spring para trabajar con brokers que implementan el protocolo AMQP, y `spring-boot-starter-amqp` conecta esa abstracción con RabbitMQ con muy poca configuración.

## Conceptos clave de RabbitMQ

Antes de ver código, conviene entender los tres componentes centrales del modelo de mensajería de RabbitMQ:

- **Exchange**: recibe los mensajes del productor y los enruta a las queues según una regla de routing. Los tipos más usados son `direct` (enruta por routing key exacta), `topic` (enruta por patrón con comodines) y `fanout` (envía a todas las queues enlazadas).
- **Queue**: almacena los mensajes hasta que un consumidor los procesa. Los mensajes se entregan a un solo consumidor a la vez (modelo competitivo por defecto).
- **Binding**: enlaza un exchange con una queue, opcionalmente con una routing key.

El productor nunca escribe directamente en una queue; siempre publica en un exchange y deja que el broker enrute.

## Dependencia y configuración básica

Agrega el starter al `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

Configura la conexión en `application.yml`:

```yaml
spring:
  rabbitmq:
    host: localhost
    port: 5672
    username: guest
    password: guest
    virtual-host: /
```

Para desarrollo local, levanta RabbitMQ con Docker:

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3.13-management
```

El puerto 5672 es el broker AMQP; el 15672 es la UI de administración accesible en `http://localhost:15672` (usuario/contraseña: `guest`/`guest`).

## Declarar exchanges, queues y bindings

Spring AMQP puede crear la infraestructura de RabbitMQ al arrancar la aplicación si declaras beans de tipo `Queue`, `Exchange` y `Binding`. Esto es útil en desarrollo; en producción se suele gestionar la infraestructura por separado.

```java
@Configuration
public class RabbitMQConfig {

    public static final String PEDIDOS_EXCHANGE = "pedidos.exchange";
    public static final String PEDIDOS_QUEUE    = "pedidos.procesamiento";
    public static final String PEDIDOS_DLQ      = "pedidos.procesamiento.dlq";
    public static final String PEDIDOS_ROUTING  = "pedido.creado";

    // Exchange principal (direct)
    @Bean
    public DirectExchange pedidosExchange() {
        return ExchangeBuilder.directExchange(PEDIDOS_EXCHANGE)
                .durable(true)
                .build();
    }

    // Dead-letter exchange y queue (para mensajes que fallan)
    @Bean
    public DirectExchange pedidosDlxExchange() {
        return ExchangeBuilder.directExchange("pedidos.dlx")
                .durable(true)
                .build();
    }

    @Bean
    public Queue pedidosDlq() {
        return QueueBuilder.durable(PEDIDOS_DLQ).build();
    }

    @Bean
    public Binding pedidosDlqBinding() {
        return BindingBuilder.bind(pedidosDlq())
                .to(pedidosDlxExchange())
                .with(PEDIDOS_ROUTING);
    }

    // Queue principal con dead-letter configurado
    @Bean
    public Queue pedidosQueue() {
        return QueueBuilder.durable(PEDIDOS_QUEUE)
                .withArgument("x-dead-letter-exchange", "pedidos.dlx")
                .withArgument("x-dead-letter-routing-key", PEDIDOS_ROUTING)
                .build();
    }

    @Bean
    public Binding pedidosBinding() {
        return BindingBuilder.bind(pedidosQueue())
                .to(pedidosExchange())
                .with(PEDIDOS_ROUTING);
    }
}
```

`durable(true)` garantiza que el exchange y la queue sobreviven a reinicios del broker. La configuración `x-dead-letter-exchange` redirige los mensajes rechazados o que expiran a la dead-letter queue, donde pueden ser inspeccionados o reprocesados.

## Serialización con Jackson

Por defecto, Spring AMQP serializa los mensajes como bytes de Java (`Java serialization`). En la práctica, casi siempre se prefiere JSON para mantener interoperabilidad. Configura un `MessageConverter` con Jackson:

```java
@Configuration
public class RabbitMQConfig {

    // ... resto de la configuración

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return rabbitTemplate;
    }
}
```

Con este converter, puedes publicar y consumir objetos Java directamente; Spring AMQP se encarga de la conversión a/desde JSON.

## Publicar mensajes con RabbitTemplate

`RabbitTemplate` es la clase central para enviar mensajes. Inyéctala donde necesites publicar:

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class PedidoService {

    private final RabbitTemplate rabbitTemplate;
    private final PedidoRepository pedidoRepository;

    @Transactional
    public Pedido crear(CrearPedidoRequest request) {
        Pedido pedido = pedidoRepository.save(
            Pedido.builder()
                .clienteId(request.clienteId())
                .total(request.total())
                .estado(EstadoPedido.PENDIENTE)
                .build()
        );

        PedidoCreadoEvent evento = new PedidoCreadoEvent(
            pedido.getId(),
            pedido.getClienteId(),
            pedido.getTotal()
        );

        rabbitTemplate.convertAndSend(
            RabbitMQConfig.PEDIDOS_EXCHANGE,
            RabbitMQConfig.PEDIDOS_ROUTING,
            evento
        );

        log.info("Pedido {} publicado en RabbitMQ", pedido.getId());
        return pedido;
    }
}
```

`convertAndSend(exchange, routingKey, message)` serializa el objeto con el `MessageConverter` configurado y lo envía al exchange indicado con la routing key dada.

El objeto de evento es un POJO simple:

```java
public record PedidoCreadoEvent(
    Long pedidoId,
    Long clienteId,
    BigDecimal total
) {}
```

## Consumir mensajes con @RabbitListener

Anota un método con `@RabbitListener` para suscribirte a una queue. Spring AMQP crea los consumidores al arrancar la aplicación:

```java
@Component
@Slf4j
@RequiredArgsConstructor
public class PedidoConsumer {

    private final InventarioService inventarioService;
    private final NotificacionService notificacionService;

    @RabbitListener(queues = RabbitMQConfig.PEDIDOS_QUEUE)
    public void procesarPedido(PedidoCreadoEvent evento) {
        log.info("Procesando pedido {}", evento.pedidoId());

        inventarioService.reservar(evento.pedidoId(), evento.total());
        notificacionService.notificarCliente(evento.clienteId(), evento.pedidoId());

        log.info("Pedido {} procesado correctamente", evento.pedidoId());
    }
}
```

Spring AMQP deserializa el JSON entrante al tipo del parámetro del método usando el `MessageConverter` configurado. Si el método termina sin excepción, el mensaje se confirma automáticamente (`ack`); si lanza una excepción, el mensaje se rechaza.

## Manejo de errores y reintentos

El comportamiento ante errores es el aspecto más crítico de un consumidor. Sin configuración adicional, un mensaje que provoca una excepción se reintenta indefinidamente, bloqueando el consumidor en un bucle.

La solución correcta es configurar una política de reintentos con backoff y redirigir los mensajes que agotan los intentos a la dead-letter queue:

```java
@Configuration
public class RabbitMQConfig {

    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory,
            MessageConverter messageConverter) {

        SimpleRabbitListenerContainerFactory factory =
            new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter);

        // Configuración de reintentos con backoff exponencial
        RetryInterceptorBuilder<?> retryBuilder = RetryInterceptorBuilder.stateless()
            .maxAttempts(3)
            .backOffOptions(1000, 2.0, 10000) // inicial, multiplicador, máximo (ms)
            .recoverer(new RejectAndDontRequeueRecoverer()); // tras agotar intentos: DLQ

        factory.setAdviceChain(retryBuilder.build());
        factory.setDefaultRequeueRejected(false); // no reencolar al rechazar
        return factory;
    }
}
```

Con esta configuración:
1. Si el consumidor lanza excepción, Spring AMQP reintenta hasta 3 veces con backoff exponencial (1s, 2s, 4s... máximo 10s).
2. Si los 3 intentos fallan, `RejectAndDontRequeueRecoverer` rechaza el mensaje sin reencolarlo.
3. RabbitMQ, al recibir el rechazo con `requeue=false`, enruta el mensaje al dead-letter exchange configurado en la queue.

## Acceder al mensaje completo

Si necesitas los headers o metadatos del mensaje además del cuerpo, recibe un `Message` de Spring AMQP o un `org.springframework.amqp.core.Message`:

```java
@RabbitListener(queues = RabbitMQConfig.PEDIDOS_QUEUE)
public void procesarPedido(Message message) {
    String correlationId = (String) message.getMessageProperties()
        .getHeaders().get("correlationId");
    
    PedidoCreadoEvent evento = objectMapper.readValue(
        message.getBody(), PedidoCreadoEvent.class
    );

    log.info("Procesando pedido {} con correlationId {}",
        evento.pedidoId(), correlationId);
    
    inventarioService.reservar(evento.pedidoId(), evento.total());
}
```

También puedes combinar el objeto deserializado con los headers usando `@Header`:

```java
@RabbitListener(queues = RabbitMQConfig.PEDIDOS_QUEUE)
public void procesarPedido(
        PedidoCreadoEvent evento,
        @Header(AmqpHeaders.CORRELATION_ID) String correlationId) {
    
    log.info("Pedido {} con correlationId {}", evento.pedidoId(), correlationId);
    inventarioService.reservar(evento.pedidoId(), evento.total());
}
```

## Exchange de tipo Topic

Cuando el routing es más flexible que una clave exacta, usa un `TopicExchange`. Las routing keys pueden tener comodines: `*` reemplaza exactamente una palabra, `#` reemplaza cero o más palabras.

```java
@Bean
public TopicExchange notificacionesExchange() {
    return ExchangeBuilder.topicExchange("notificaciones.exchange")
            .durable(true)
            .build();
}

@Bean
public Binding notificacionesEmailBinding() {
    return BindingBuilder.bind(notificacionesEmailQueue())
            .to(notificacionesExchange())
            .with("notificacion.email.*"); // email.bienvenida, email.reset, etc.
}

@Bean
public Binding notificacionesSmsBinding() {
    return BindingBuilder.bind(notificacionesSmsQueue())
            .to(notificacionesExchange())
            .with("notificacion.sms.#"); // cualquier clave que empiece con notificacion.sms
}
```

El publicador solo necesita ajustar la routing key:

```java
// Llega solo a la queue de email
rabbitTemplate.convertAndSend("notificaciones.exchange", "notificacion.email.bienvenida", evento);

// Llega solo a la queue de SMS
rabbitTemplate.convertAndSend("notificaciones.exchange", "notificacion.sms.urgente", evento);
```

## Exchange de tipo Fanout

Un `FanoutExchange` ignora la routing key y entrega el mensaje a todas las queues enlazadas. Es útil para broadcast de eventos a múltiples consumidores independientes:

```java
@Bean
public FanoutExchange pedidosBroadcastExchange() {
    return ExchangeBuilder.fanoutExchange("pedidos.broadcast")
            .durable(true)
            .build();
}

// Cada servicio tiene su propia queue enlazada al fanout
@Bean
public Binding analyticsBinding() {
    return BindingBuilder.bind(analyticsQueue()).to(pedidosBroadcastExchange());
}

@Bean
public Binding reportesBinding() {
    return BindingBuilder.bind(reportesQueue()).to(pedidosBroadcastExchange());
}
```

## Concurrencia en el consumidor

Por defecto, `@RabbitListener` usa un solo hilo por listener. Para procesar mensajes en paralelo, configura `concurrency` en el listener o en el factory:

```java
@RabbitListener(queues = RabbitMQConfig.PEDIDOS_QUEUE, concurrency = "3-10")
public void procesarPedido(PedidoCreadoEvent evento) {
    inventarioService.reservar(evento.pedidoId(), evento.total());
}
```

`concurrency = "3-10"` indica mínimo 3 hilos y máximo 10; Spring AMQP ajusta el número según la carga. Asegúrate de que el código del consumidor sea thread-safe antes de aumentar la concurrencia.

## Testing

Prueba la lógica del consumidor de forma unitaria sin necesidad de RabbitMQ:

```java
@ExtendWith(MockitoExtension.class)
class PedidoConsumerTest {

    @Mock
    private InventarioService inventarioService;

    @Mock
    private NotificacionService notificacionService;

    @InjectMocks
    private PedidoConsumer consumer;

    @Test
    void procesarPedido_debeReservarInventarioYNotificar() {
        PedidoCreadoEvent evento = new PedidoCreadoEvent(1L, 42L, new BigDecimal("150.00"));

        consumer.procesarPedido(evento);

        verify(inventarioService).reservar(1L, new BigDecimal("150.00"));
        verify(notificacionService).notificarCliente(42L, 1L);
    }
}
```

Para pruebas de integración con un RabbitMQ real, usa Testcontainers:

```java
@SpringBootTest
@Testcontainers
class PedidoIntegrationTest {

    @Container
    static RabbitMQContainer rabbitMQ = new RabbitMQContainer("rabbitmq:3.13-management");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.rabbitmq.host", rabbitMQ::getHost);
        registry.add("spring.rabbitmq.port", rabbitMQ::getAmqpPort);
    }

    @Autowired
    private PedidoService pedidoService;

    @MockBean
    private InventarioService inventarioService;

    @Test
    void crear_debePublicarEventoEnRabbitMQ() throws InterruptedException {
        pedidoService.crear(new CrearPedidoRequest(1L, new BigDecimal("100.00")));

        // Awaitility para esperar al consumidor asíncrono
        await().atMost(Duration.ofSeconds(5))
               .untilAsserted(() -> 
                   verify(inventarioService).reservar(any(), any())
               );
    }
}
```

## Buenas prácticas

**Declara siempre la dead-letter queue desde el principio.** Los mensajes que fallan sin DLQ configurada se pierden o se reencolan indefinidamente. Configurar la DLQ es más fácil al inicio que después.

**Usa mensajes idempotentes.** Con reintentos y at-least-once delivery, el mismo mensaje puede llegar más de una vez. El consumidor debe ser capaz de procesarlo sin efectos duplicados, ya sea verificando en base de datos antes de actuar o usando operaciones naturalmente idempotentes.

**Mantén los mensajes pequeños.** Los mensajes de RabbitMQ son volátiles por naturaleza; si necesitas datos grandes, envía solo el identificador y que el consumidor recupere los detalles de la fuente de datos.

**Versiona el esquema de los mensajes.** Cambiar la estructura de un evento puede romper los consumidores. Añade un campo `version` o usa una estrategia de compatibilidad hacia atrás en el esquema JSON.

**Monitorea las queues.** RabbitMQ Management UI y las métricas exportables vía Prometheus/Micrometer te permiten detectar queues que crecen sin control, indicativo de un consumidor lento o caído.

**Elige el exchange correcto para el caso de uso.** `direct` para routing determinista, `topic` cuando el routing depende de patrones jerárquicos, `fanout` para broadcast a múltiples consumidores independientes.

## Conclusión

Spring AMQP con RabbitMQ ofrece un modelo de mensajería asíncrona maduro que desacopla productores de consumidores y absorbe picos de carga sin perder mensajes. La configuración esencial —exchanges, queues, bindings, serialización JSON y dead-letter queues— requiere poco código con Spring Boot.

Los puntos que más impactan en producción son la política de reintentos (para evitar bucles infinitos ante errores transitorios) y la idempotencia del consumidor (para tolerar entregas duplicadas). Con ambos resueltos, RabbitMQ se convierte en una pieza confiable para comunicación asíncrona dentro o entre servicios.
