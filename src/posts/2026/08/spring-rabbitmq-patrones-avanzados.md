---
titulo: "Patrones avanzados con RabbitMQ en Spring AMQP"
seoTitulo: "Patrones avanzados de RabbitMQ con Spring AMQP: Publisher Confirms, RPC, TTL y Priority Queues"
fecha: "2026-08-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Publisher Confirms, Request-Reply (RPC), TTL de mensajes y colas, Priority Queues y Delayed Messages con Spring AMQP y RabbitMQ."
imagenPortada: "https://i.imgur.com/J1U9rba.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "RabbitMQ", "Java", "Mensajería", "AMQP", "Backend"]
categoria: "tech"
keywords: "RabbitMQ Publisher Confirms, Spring AMQP RPC, Request Reply RabbitMQ, TTL mensajes RabbitMQ Spring, Priority Queue RabbitMQ, Delayed Messages RabbitMQ Spring Boot, patrones avanzados RabbitMQ, Spring AMQP avanzado, convertSendAndReceive, RabbitMQ Spring Boot"
---

# Patrones avanzados con RabbitMQ en Spring AMQP

El [artículo introductorio sobre Spring AMQP](/2026/07/spring-amqp-rabbitmq) cubre la base: exchanges, queues, `RabbitTemplate`, `@RabbitListener` y dead-letter queues. Con ese conocimiento puedes construir sistemas de mensajería funcionales. Pero hay escenarios que requieren ir un paso más allá:

- ¿Cómo verifico que el broker realmente recibió mi mensaje?
- ¿Puedo hacer una llamada "síncrona" sobre RabbitMQ?
- ¿Cómo hago que un mensaje expire si nadie lo consume?
- ¿Cómo proceso mensajes urgentes antes que los normales?
- ¿Puedo programar un mensaje para que se entregue en el futuro?

Este artículo responde cada una de esas preguntas con código concreto.

## Publisher Confirms: garantizar la llegada al broker

El método `convertAndSend` de `RabbitTemplate` es fire-and-forget por defecto. El productor no sabe si el broker recibió el mensaje. En la mayoría de los casos eso es aceptable, pero en flujos críticos —pagos, reservas, eventos de auditoría— necesitas una confirmación explícita del broker.

RabbitMQ implementa dos mecanismos complementarios:

- **Publisher Confirms**: el broker confirma que el mensaje llegó a un exchange.
- **Publisher Returns**: el broker notifica si el mensaje no pudo enrutarse a ninguna queue desde el exchange.

### Configuración

```yaml
spring:
  rabbitmq:
    publisher-confirm-type: correlated  # activa confirms asíncronos
    publisher-returns: true             # activa returns
    template:
      mandatory: true                   # activa el callback de return
```

Con `publisher-confirm-type: correlated`, cada mensaje publicado recibe un número de secuencia que el broker devuelve en el `ack` o `nack`. Spring AMQP correlaciona la respuesta con el mensaje original automáticamente.

### Callbacks en RabbitTemplate

```java
@Configuration
public class RabbitMQConfig {

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);

        // Callback de confirm: el broker acusa recibo (ack) o rechaza (nack)
        template.setConfirmCallback((correlationData, ack, cause) -> {
            if (ack) {
                log.info("Mensaje confirmado por el broker. ID: {}",
                    correlationData != null ? correlationData.getId() : "sin ID");
            } else {
                log.error("Broker rechazó el mensaje. Causa: {}. ID: {}", cause,
                    correlationData != null ? correlationData.getId() : "sin ID");
                // Aquí: reintento, alerta, registro en base de datos...
            }
        });

        // Callback de return: el exchange no encontró ninguna queue de destino
        template.setReturnsCallback(returned -> {
            log.warn("Mensaje devuelto: exchange={}, routingKey={}, replyCode={}",
                returned.getExchange(),
                returned.getRoutingKey(),
                returned.getReplyCode());
        });

        return template;
    }
}
```

### Publicar con CorrelationData

Para rastrear cada mensaje individualmente, pasa un `CorrelationData` con un identificador único al publicar:

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class PagoService {

    private final RabbitTemplate rabbitTemplate;

    public void publicarPago(PagoEvent evento) {
        CorrelationData correlationData = new CorrelationData(
            "pago-" + evento.pagoId()
        );

        rabbitTemplate.convertAndSend(
            "pagos.exchange",
            "pago.procesado",
            evento,
            correlationData
        );

        log.info("Pago {} enviado, esperando confirm del broker", evento.pagoId());
    }
}
```

El confirm callback recibirá ese mismo `correlationData` cuando el broker responda, permitiéndote identificar exactamente qué mensaje fue confirmado o rechazado.

### ¿Cuándo usar Publisher Confirms?

El overhead de los confirms (una ida y vuelta adicional al broker por mensaje) puede reducir el throughput hasta un 50 % en escenarios de alto volumen. Úsalos cuando la pérdida de un mensaje tiene consecuencias graves —transacciones financieras, eventos de auditoría con requisitos regulatorios— y no en flujos de telemetría o logs donde perder un mensaje es aceptable.

---

## Request-Reply (RPC sobre RabbitMQ)

El patrón Request-Reply simula una llamada síncrona sobre la infraestructura asíncrona de RabbitMQ. El productor envía un mensaje y **espera una respuesta** del consumidor. Es útil cuando necesitas el resultado de una operación pero no quieres exponer un endpoint HTTP.

### Cómo funciona

1. El productor crea una queue de respuesta temporal (o reutilizable).
2. El productor publica el mensaje incluyendo en los headers: `reply-to` (nombre de la queue de respuesta) y `correlation-id` (para correlacionar la respuesta con la petición).
3. El consumidor procesa el mensaje y publica la respuesta en la queue indicada por `reply-to`, con el mismo `correlation-id`.
4. El productor, que está escuchando en su queue de respuesta, recibe la respuesta y la correlaciona.

Spring AMQP automatiza todo este flujo con `convertSendAndReceive`.

### Implementación del cliente (productor)

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class TarifaService {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Solicita el cálculo de tarifa al servicio de pricing y espera el resultado.
     * Bloquea el hilo hasta recibir la respuesta o agotar el timeout.
     */
    public TarifaResponse calcularTarifa(TarifaRequest request) {
        TarifaResponse response = (TarifaResponse) rabbitTemplate.convertSendAndReceive(
            "pricing.exchange",
            "tarifa.calcular",
            request
        );

        if (response == null) {
            throw new IllegalStateException(
                "Timeout esperando respuesta del servicio de pricing"
            );
        }

        log.info("Tarifa calculada: {}", response.monto());
        return response;
    }
}
```

El timeout por defecto de `convertSendAndReceive` es 5 segundos. Puedes ajustarlo:

```java
rabbitTemplate.setReplyTimeout(10_000); // 10 segundos
```

### Implementación del servidor (consumidor)

El consumidor solo necesita devolver el resultado desde el método del listener. Spring AMQP detecta que el mensaje incluye un `reply-to` y envía el valor retornado a esa queue automáticamente:

```java
@Component
@Slf4j
@RequiredArgsConstructor
public class PricingConsumer {

    private final PricingEngine pricingEngine;

    @RabbitListener(queues = "pricing.tarifa.queue")
    public TarifaResponse calcular(TarifaRequest request) {
        log.info("Calculando tarifa para ruta {}", request.rutaId());
        BigDecimal monto = pricingEngine.calcular(request.rutaId(), request.peso());
        return new TarifaResponse(monto, "COP");
    }
}
```

El valor que retorna el método se serializa con el mismo `MessageConverter` configurado y se envía a la queue indicada en `reply-to`. El cliente que llamó `convertSendAndReceive` lo recibe y lo deserializa.

### Queue de respuesta dedicada

Por defecto, `convertSendAndReceive` usa una queue temporal anónima creada por RabbitMQ. En producción es preferible una queue de respuesta persistente y nombrada, para no perder la correlación si la aplicación se reinicia:

```java
@Configuration
public class RpcConfig {

    @Bean
    public DirectReplyToMessageListenerContainer replyListenerContainer(
            ConnectionFactory connectionFactory,
            RabbitTemplate rabbitTemplate) {

        DirectReplyToMessageListenerContainer container =
            new DirectReplyToMessageListenerContainer(connectionFactory);
        container.setMessageListener(rabbitTemplate);
        return container;
    }
}
```

`DirectReplyToMessageListenerContainer` usa el mecanismo de "direct reply-to" de RabbitMQ, que evita crear queues temporales y reduce la latencia.

---

## TTL: expirar mensajes y colas

### Time-to-live de mensajes

Un mensaje con TTL que no fue consumido antes de que expire se descarta (o se envía a la DLQ si está configurada). Se puede definir a nivel de queue o a nivel de mensaje individual.

**TTL en la queue** (aplica a todos los mensajes de la queue):

```java
@Bean
public Queue cotizacionesQueue() {
    return QueueBuilder.durable("cotizaciones.queue")
        .withArgument("x-message-ttl", 60_000) // 60 segundos en milisegundos
        .withArgument("x-dead-letter-exchange", "cotizaciones.dlx")
        .build();
}
```

**TTL por mensaje individual** (sobreescribe el TTL de la queue si es menor):

```java
public void publicarCotizacion(CotizacionEvent evento) {
    rabbitTemplate.convertAndSend(
        "cotizaciones.exchange",
        "cotizacion.nueva",
        evento,
        message -> {
            message.getMessageProperties().setExpiration("30000"); // 30 segundos
            return message;
        }
    );
}
```

El campo `expiration` se establece como cadena de texto (milisegundos). Una cotización que nadie procesó en 30 segundos ya no tiene valor; el TTL evita que mensajes obsoletos lleguen a los consumidores tarde.

### TTL de colas

Las colas también pueden expirar si llevan cierto tiempo sin consumidores activos. Útil para queues de respuesta temporales o queues de trabajo creadas dinámicamente:

```java
@Bean
public Queue sessionQueue() {
    return QueueBuilder.durable("session.temporal.queue")
        .withArgument("x-expires", 300_000) // se elimina tras 5 minutos sin consumidores
        .build();
}
```

---

## Priority Queues: mensajes urgentes primero

Las colas de prioridad de RabbitMQ permiten que mensajes con mayor prioridad se entreguen antes que los de menor prioridad, incluso si llegaron después.

### Configurar la cola con prioridad máxima

```java
@Bean
public Queue notificacionesQueue() {
    return QueueBuilder.durable("notificaciones.queue")
        .withArgument("x-max-priority", 10) // prioridades de 0 a 10
        .build();
}
```

El argumento `x-max-priority` define el rango de prioridades. RabbitMQ recomienda no exceder 10 niveles: internamente mantiene una sub-cola por nivel, y muchos niveles impactan el rendimiento.

### Publicar con prioridad

```java
public void publicarNotificacion(NotificacionEvent evento, int prioridad) {
    rabbitTemplate.convertAndSend(
        "notificaciones.exchange",
        "notificacion.nueva",
        evento,
        message -> {
            message.getMessageProperties().setPriority(prioridad);
            return message;
        }
    );
}

// Uso
publicarNotificacion(alertaCritica, 9);    // prioridad máxima
publicarNotificacion(boletinSemanal, 1);   // prioridad mínima
```

### Constantes de prioridad

Es mejor definir las prioridades como constantes para evitar números mágicos dispersos en el código:

```java
public final class NotificacionPrioridad {
    public static final int CRITICA    = 9;
    public static final int ALTA       = 7;
    public static final int NORMAL     = 5;
    public static final int BAJA       = 2;
    public static final int INFORMATIVA = 1;

    private NotificacionPrioridad() {}
}
```

### Consideraciones importantes

Las priority queues solo funcionan como se espera cuando hay mensajes acumulados en la queue en el momento de la entrega. Si el consumidor es tan rápido que procesa cada mensaje antes de que llegue el siguiente, la prioridad no tiene efecto observable. Funcionan mejor en escenarios de picos donde la queue se llena y el consumidor trabaja para vaciarla.

---

## Delayed Messages: entregar en el futuro

RabbitMQ no incluye soporte nativo para mensajes diferidos, pero el **plugin `rabbitmq_delayed_message_exchange`** añade un tipo de exchange especial que retiene los mensajes durante el tiempo indicado antes de enrutarlos.

### Habilitar el plugin

```bash
rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

Con Docker:

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3.13-management

docker exec rabbitmq rabbitmq-plugins enable rabbitmq_delayed_message_exchange
```

### Configurar el exchange diferido

El exchange diferido usa el tipo personalizado `x-delayed-message` y recibe como argumento el tipo de exchange subyacente para el enrutamiento final:

```java
@Bean
public CustomExchange recordatoriosExchange() {
    Map<String, Object> args = new HashMap<>();
    args.put("x-delayed-type", "direct"); // tipo de exchange para el enrutamiento final
    return new CustomExchange(
        "recordatorios.exchange",
        "x-delayed-message",   // tipo custom del plugin
        true,                   // durable
        false,                  // auto-delete
        args
    );
}

@Bean
public Queue recordatoriosQueue() {
    return QueueBuilder.durable("recordatorios.queue").build();
}

@Bean
public Binding recordatoriosBinding() {
    return BindingBuilder.bind(recordatoriosQueue())
        .to(recordatoriosExchange())
        .with("recordatorio.enviar")
        .noargs();
}
```

### Publicar un mensaje diferido

El delay se especifica en el header `x-delay`, en milisegundos:

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class RecordatorioService {

    private final RabbitTemplate rabbitTemplate;

    /**
     * Programa un recordatorio para ser entregado después del delay indicado.
     */
    public void programar(RecordatorioEvent evento, Duration delay) {
        rabbitTemplate.convertAndSend(
            "recordatorios.exchange",
            "recordatorio.enviar",
            evento,
            message -> {
                message.getMessageProperties()
                    .setHeader("x-delay", (int) delay.toMillis());
                return message;
            }
        );

        log.info("Recordatorio programado para {} ms desde ahora", delay.toMillis());
    }
}

// Uso: recordatorio de carrito abandonado a las 2 horas
recordatorioService.programar(
    new RecordatorioEvent(carritoId, clienteEmail),
    Duration.ofHours(2)
);
```

El consumidor es un `@RabbitListener` normal; no necesita saber que el mensaje fue diferido:

```java
@Component
@Slf4j
@RequiredArgsConstructor
public class RecordatorioConsumer {

    private final EmailService emailService;

    @RabbitListener(queues = "recordatorios.queue")
    public void enviarRecordatorio(RecordatorioEvent evento) {
        log.info("Enviando recordatorio de carrito a {}", evento.clienteEmail());
        emailService.enviarRecordatorioCarrito(evento.carritoId(), evento.clienteEmail());
    }
}
```

### Casos de uso frecuentes para delayed messages

- **Recordatorio de carrito abandonado**: enviar un email 2 horas después de la última actividad.
- **Reintento con backoff personalizado**: si la DLQ no ofrece suficiente flexibilidad, reencolar el mensaje con un delay creciente.
- **Notificaciones programadas**: confirmaciones de reserva X días antes de la fecha.
- **Tareas diferidas de limpieza**: eliminar datos temporales 24 horas después de crearlos.

---

## Headers Exchange: enrutar por atributos, no por routing key

El `HeadersExchange` enruta mensajes basándose en los headers AMQP en lugar de en la routing key. Es el exchange menos usado, pero útil cuando el criterio de enrutamiento es complejo o multidimensional.

```java
@Bean
public HeadersExchange reportesExchange() {
    return ExchangeBuilder.headersExchange("reportes.exchange")
        .durable(true)
        .build();
}

// Queue para reportes de tipo 'ventas' en formato 'pdf'
@Bean
public Binding reportesPdfVentasBinding() {
    return BindingBuilder.bind(reportesPdfVentasQueue())
        .to(reportesExchange())
        .whereAll("tipo", "ventas", "formato", "pdf") // ambos headers deben coincidir
        .match();
}

// Queue para cualquier reporte en formato 'excel'
@Bean
public Binding reportesExcelBinding() {
    return BindingBuilder.bind(reportesExcelQueue())
        .to(reportesExchange())
        .whereAny("formato", "excel") // basta con que formato=excel
        .match();
}
```

Publicar con headers en lugar de routing key:

```java
public void generarReporte(ReporteEvent evento, String tipo, String formato) {
    rabbitTemplate.convertAndSend(
        "reportes.exchange",
        "",  // routing key ignorada en headers exchange
        evento,
        message -> {
            message.getMessageProperties().setHeader("tipo", tipo);
            message.getMessageProperties().setHeader("formato", formato);
            return message;
        }
    );
}
```

`whereAll` requiere que todos los headers coincidan (`x-match: all`); `whereAny` basta con uno (`x-match: any`).

---

## Resumen de patrones y cuándo aplicarlos

| Patrón | Cuándo usarlo |
|--------|--------------|
| **Publisher Confirms** | Mensajes críticos donde perder uno tiene consecuencias graves (pagos, auditoría) |
| **Request-Reply (RPC)** | Necesitas el resultado de una operación pero quieres mantener el desacoplamiento de RabbitMQ |
| **TTL de mensajes** | Mensajes con vigencia limitada (cotizaciones, alertas en tiempo real, tokens de un solo uso) |
| **TTL de colas** | Queues temporales que deben limpiarse automáticamente |
| **Priority Queues** | Mezcla de mensajes urgentes y no urgentes que comparten el mismo consumidor |
| **Delayed Messages** | Tareas programadas, reintentos con backoff, recordatorios futuros |
| **Headers Exchange** | Enrutamiento multidimensional que no encaja bien en routing keys de texto |

Cada uno de estos patrones resuelve un problema específico. El error más común es aplicarlos por defecto sin una necesidad concreta: Publisher Confirms añade latencia, las priority queues tienen overhead de memoria, y el plugin de delayed messages requiere instalación explícita. Usa cada patrón cuando el caso de uso lo justifica.
