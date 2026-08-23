---
titulo: "Reintentos declarativos en Spring Boot con Spring Retry"
seoTitulo: "Spring Retry: @Retryable, @Recover, RetryTemplate y backoff en Spring Boot"
fecha: "2026-08-23"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a manejar fallos transitorios en Spring Boot con Spring Retry: anotaciones @Retryable y @Recover, backoff exponencial con jitter, RetryTemplate programático y cuándo preferirlo sobre un Circuit Breaker."
imagenPortada: "https://i.imgur.com/q58nOu9.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Retry", "Java", "Resiliencia", "Backend"]
categoria: "tech"
keywords: "spring retry spring boot, @Retryable spring boot, @Recover spring, RetryTemplate spring, backoff exponencial spring retry, spring retry configuracion, reintentos spring boot, spring retry vs circuit breaker, spring retry jitter, spring retry stateless stateful"
---

# Reintentos declarativos en Spring Boot con Spring Retry

Los sistemas distribuidos fallan. Una base de datos tarda en responder bajo carga, un servicio externo devuelve un 503 por mantenimiento o una conexión de red se interrumpe unos milisegundos. En la mayoría de estos casos, volver a intentar la operación un momento después la resuelve. Sin Spring Retry, ese manejo termina siendo un bucle `while` envuelto en un `try-catch` con un `Thread.sleep`, código repetitivo que oscurece la lógica de negocio y que distintos desarrolladores implementan de formas distintas.

**Spring Retry** externaliza ese patrón. Define la política de reintento —cuántas veces, con qué espera entre intentos, ante qué excepciones— en la configuración o en anotaciones, y deja el método de negocio sin ruido adicional.

## Dependencia y habilitación

Añade `spring-retry` al `pom.xml`. También necesitas `spring-aspects` porque la funcionalidad de anotaciones se implementa sobre AOP:

```xml
<dependency>
    <groupId>org.springframework.retry</groupId>
    <artifactId>spring-retry</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-aspects</artifactId>
</dependency>
```

Habilita el soporte de anotaciones en la clase de configuración o en la clase principal:

```java
@SpringBootApplication
@EnableRetry
public class MiAplicacion {
    public static void main(String[] args) {
        SpringApplication.run(MiAplicacion.class, args);
    }
}
```

`@EnableRetry` activa el interceptor AOP que envuelve los métodos anotados con `@Retryable`. Sin esta anotación, `@Retryable` se ignora en silencio.

## @Retryable: el caso más común

La forma más directa de añadir reintentos es anotar el método que puede fallar:

```java
@Service
@Slf4j
public class PagosService {

    @Retryable(
        retryFor = {HttpServerErrorException.class, ResourceAccessException.class},
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000)
    )
    public PagoResponse procesarPago(PagoRequest request) {
        log.info("Procesando pago {}", request.pagoId());
        // Llamada a API externa que puede fallar transitoriamente
        return clientePagos.procesar(request);
    }
}
```

Con esta configuración:

- Se reintenta hasta 3 veces en total (el intento inicial más dos reintentos).
- Solo se reintenta ante `HttpServerErrorException` o `ResourceAccessException`. Cualquier otra excepción se propaga inmediatamente sin reintentar.
- Entre cada intento hay una espera fija de 1 000 ms.

`retryFor` (equivalente a `value` en versiones anteriores) acepta un array de clases de excepción. Todas sus subclases también quedan cubiertas.

### Excluir excepciones específicas

A veces es más cómodo definir la regla al revés: reintentar ante cualquier excepción excepto algunas concretas:

```java
@Retryable(
    noRetryFor = {IllegalArgumentException.class, ValidationException.class},
    maxAttempts = 4,
    backoff = @Backoff(delay = 500)
)
public ResultadoConsulta consultarInventario(String sku) {
    return inventarioClient.consultar(sku);
}
```

`noRetryFor` indica las excepciones que no deben generar un reintento. Un `IllegalArgumentException` es un error de programación, no un fallo transitorio; reintentarlo sería inútil.

## @Recover: el plan B

Cuando se agotan todos los intentos sin éxito, Spring Retry puede invocar un método de recuperación en lugar de propagar la excepción final al llamador. Se define con `@Recover`:

```java
@Service
@Slf4j
public class PagosService {

    @Retryable(
        retryFor = {HttpServerErrorException.class, ResourceAccessException.class},
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000)
    )
    public PagoResponse procesarPago(PagoRequest request) {
        return clientePagos.procesar(request);
    }

    @Recover
    public PagoResponse recuperarPago(HttpServerErrorException ex, PagoRequest request) {
        log.error("Pago {} fallido tras 3 intentos. Encolando para reintento diferido.", 
            request.pagoId(), ex);
        colaReintentosDiferidos.encolar(request);
        return PagoResponse.pendiente(request.pagoId());
    }

    @Recover
    public PagoResponse recuperarPago(ResourceAccessException ex, PagoRequest request) {
        log.error("Error de conectividad para pago {}. Activando fallback.", request.pagoId(), ex);
        return pagosFallback.procesar(request);
    }
}
```

Spring Retry selecciona el método `@Recover` correcto por tipo de excepción. Las reglas de coincidencia son:

- El primer parámetro debe ser la excepción (o una superclase de ella).
- Los parámetros siguientes deben coincidir en tipo y orden con los del método `@Retryable`.
- El tipo de retorno debe ser el mismo.

Puedes tener múltiples métodos `@Recover` para distintos tipos de excepción dentro de la misma clase. Si ninguno coincide exactamente, Spring Retry busca el más general (por ejemplo, un `@Recover` que recibe `Exception` actúa como fallback universal).

## Backoff: controlar la espera entre reintentos

La espera fija (`delay = 1000`) es el punto de partida, pero en sistemas con carga alta puede empeorar las cosas: si muchos clientes reintentan al mismo tiempo con el mismo intervalo, golpean el servicio sobrecargado de forma sincronizada. El **backoff exponencial con jitter** resuelve esto.

### Backoff exponencial

```java
@Retryable(
    retryFor = ServiceUnavailableException.class,
    maxAttempts = 5,
    backoff = @Backoff(
        delay = 500,        // espera inicial: 500 ms
        multiplier = 2.0,   // cada reintento multiplica la espera por 2
        maxDelay = 10_000   // límite máximo: 10 s
    )
)
public void sincronizarDatos(String tenantId) {
    sincronizadorExterno.sincronizar(tenantId);
}
```

Con esta configuración, las esperas son aproximadamente: 500 ms → 1 000 ms → 2 000 ms → 4 000 ms. Sin `maxDelay`, el quinto reintento esperaría 8 000 ms; con él, se limita a 10 000 ms.

### Jitter para distribuir los reintentos

```java
@Retryable(
    retryFor = TransientDataAccessException.class,
    maxAttempts = 4,
    backoff = @Backoff(
        delay = 1000,
        multiplier = 1.5,
        maxDelay = 8_000,
        random = true       // añade variación aleatoria a cada espera
    )
)
public List<Orden> obtenerOrdenesPendientes() {
    return repositorioOrdenes.buscarPendientes();
}
```

`random = true` añade una variación aleatoria a cada espera calculada, dispersando los reintentos de distintos clientes en el tiempo. Es el equivalente al "jitter" del patrón de backoff exponencial con jitter y es especialmente útil cuando múltiples instancias del servicio reintentan la misma operación de forma simultánea.

## RetryTemplate: control programático

Las anotaciones cubren el 90 % de los casos. Cuando necesitas lógica más dinámica —determinar la política en tiempo de ejecución, reutilizar la misma política en varios métodos, o usar Spring Retry sin AOP— `RetryTemplate` ofrece una API imperativa:

```java
@Configuration
public class RetryConfig {

    @Bean
    public RetryTemplate retryTemplate() {
        return RetryTemplate.builder()
            .maxAttempts(3)
            .exponentialBackoff(500, 2.0, 5_000)
            .retryOn(HttpServerErrorException.class)
            .withListener(new RetryListenerSupport() {
                @Override
                public <T, E extends Throwable> void onError(
                        RetryContext context, RetryCallback<T, E> callback, Throwable throwable) {
                    log.warn("Intento {} fallido: {}", 
                        context.getRetryCount(), throwable.getMessage());
                }
            })
            .build();
    }
}
```

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificacionService {

    private final RetryTemplate retryTemplate;
    private final NotificacionClient client;

    public void enviarNotificacion(Notificacion notificacion) {
        retryTemplate.execute(
            context -> {
                client.enviar(notificacion);
                return null;
            },
            context -> {
                // RecoveryCallback: se ejecuta cuando se agotan los intentos
                log.error("Notificacion {} no enviada tras {} intentos. Guardando para reenvío.",
                    notificacion.id(), context.getRetryCount());
                colaReintentos.guardar(notificacion);
                return null;
            }
        );
    }
}
```

`RetryListenerSupport` permite observar cada intento sin modificar la lógica de retry. Es útil para métricas, logs estructurados o alertas cuando el número de reintentos supera un umbral.

## Retry condicional con RetryPolicy personalizada

Para casos donde la decisión de reintentar depende del contenido de la excepción (no solo de su tipo), implementa `RetryPolicy` directamente:

```java
@Bean
public RetryTemplate retryTemplateCondicional() {
    SimpleRetryPolicy policy = new SimpleRetryPolicy() {
        @Override
        public boolean canRetry(RetryContext context) {
            Throwable lastThrowable = context.getLastThrowable();
            if (lastThrowable instanceof HttpClientErrorException ex) {
                // No reintentar en 4xx (errores del cliente), solo en 5xx (errores del servidor)
                return ex.getStatusCode().is5xxServerError() && super.canRetry(context);
            }
            return super.canRetry(context);
        }
    };
    policy.setMaxAttempts(4);

    return RetryTemplate.builder()
        .customPolicy(policy)
        .exponentialBackoff(300, 2.0, 6_000)
        .build();
}
```

Este enfoque te da control total sobre la lógica de decisión sin mezclarla con el código de negocio.

## Spring Retry con métodos @Async

Spring Retry es compatible con `@Async`. Si ambas anotaciones están presentes en el mismo método, el order de los proxies AOP determina qué se aplica primero. La configuración por defecto aplica `@Async` antes que `@Retryable`, lo que significa que el reintento ocurre dentro del hilo asíncrono:

```java
@Async
@Retryable(
    retryFor = IOException.class,
    maxAttempts = 3,
    backoff = @Backoff(delay = 2000)
)
public CompletableFuture<Void> procesarArchivoAsync(String rutaArchivo) throws IOException {
    procesador.procesar(rutaArchivo);
    return CompletableFuture.completedFuture(null);
}
```

El llamador recibe el `CompletableFuture` inmediatamente. Los reintentos, si los hay, suceden en el pool de hilos asíncronos sin bloquear al llamador. Si se agotan todos los intentos y hay un `@Recover`, este también se ejecuta en el hilo asíncrono.

## @Retryable en repositorios y llamadas externas

Un uso frecuente es envolver repositorios JPA ante errores de concurrencia o conexión:

```java
@Service
@Slf4j
@RequiredArgsConstructor
@Transactional
public class ProductoService {

    private final ProductoRepository repositorio;

    @Retryable(
        retryFor = OptimisticLockingFailureException.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 1.5)
    )
    public Producto actualizarStock(Long productoId, int cantidad) {
        Producto producto = repositorio.findById(productoId)
            .orElseThrow(() -> new ProductoNoEncontradoException(productoId));
        producto.ajustarStock(cantidad);
        return repositorio.save(producto);
    }

    @Recover
    public Producto recuperarActualizacionStock(
            OptimisticLockingFailureException ex, Long productoId, int cantidad) {
        log.error("Conflicto de concurrencia persistente para producto {}. Lanzando excepción de negocio.", 
            productoId);
        throw new ConflictoConcurrenciaException(productoId, ex);
    }
}
```

`OptimisticLockingFailureException` ocurre cuando dos transacciones intentan modificar el mismo registro simultáneamente y la versión del registro ya no coincide. Reintentar con una pequeña espera resuelve la mayoría de estos conflictos sin que el llamador necesite saberlo.

## Spring Retry vs Circuit Breaker

Ambos patrones manejan fallos, pero con objetivos distintos:

**Spring Retry** es un patrón de **recuperación local**. Asume que el fallo es transitorio y que reintentar tiene probabilidades razonables de éxito. No tiene memoria entre llamadas distintas: cada invocación del método empieza desde cero, independientemente de cuántas veces haya fallado antes.

**Circuit Breaker** (Resilience4j, cubierto en [este artículo](/2026/07/spring-circuit-breaker-resilience4j)) es un patrón de **protección sistémica**. Observa el historial de llamadas recientes y, cuando la tasa de fallos supera un umbral, abre el circuito y rechaza llamadas sin siquiera intentarlas. Protege tanto al servicio que llama (de esperar en vano) como al servicio destino (de más carga cuando ya está saturado).

Los dos patrones son complementarios y se usan juntos habitualmente:

```java
// Spring Retry maneja los fallos transitorios individuales
@Retryable(
    retryFor = TransientException.class,
    maxAttempts = 2,
    backoff = @Backoff(delay = 200)
)
// Circuit Breaker detiene el flujo si el servicio lleva un tiempo degradado
@CircuitBreaker(name = "servicioPagos", fallbackMethod = "fallbackPago")
public PagoResponse procesarPago(PagoRequest request) {
    return clientePagos.procesar(request);
}
```

La regla práctica: usa **Spring Retry** cuando el fallo es ocasional y el reintento tiene alta probabilidad de éxito (errores de red esporádicos, timeouts puntuales, conflictos de concurrencia). Usa **Circuit Breaker** cuando el destino puede estar completamente inaccesible durante un período sostenido y necesitas un mecanismo de pausa automática.

## Consideraciones de producción

**Cuidado con los efectos secundarios.** Solo reintenta operaciones que sean idempotentes o que no tengan efectos secundarios visibles. Reintentar una llamada que envía un email o carga a una tarjeta puede resultar en duplicados. Si la operación no es idempotente por diseño, implementa idempotencia en el receptor antes de añadir reintentos en el emisor.

**Calcula el tiempo máximo de espera.** Con `maxAttempts = 5` y un backoff exponencial de 500 ms, multiplicador 2, el tiempo total antes de fallar puede superar los 15 segundos. Asegúrate de que ese tiempo es compatible con los timeouts de tus clientes (HTTP, gRPC, etc.). Un cliente con timeout de 5 s nunca verá el resultado de 4 reintentos.

**Monitoriza los reintentos.** Cada reintento es una señal de degradación. Expón el contador de reintentos como métrica (puedes hacerlo con `RetryListener` y Micrometer) y crea alertas cuando supere un umbral. Un aumento sostenido de reintentos suele preceder a un fallo completo del servicio destino.

**Los reintentos no sustituyen los timeouts.** Si el cliente externo nunca responde y no tienes un timeout configurado, el método `@Retryable` nunca lanzará la excepción que dispara el reintento: simplemente bloqueará el hilo indefinidamente. Configura timeouts en tus clientes HTTP antes de añadir reintentos.

## Conclusión

Spring Retry elimina el código boilerplate de los reintentos manuales y estandariza la forma en que el equipo maneja los fallos transitorios. Con `@Retryable` y `@Recover` basta para cubrir la mayoría de los casos: el código de negocio permanece limpio y la política de reintentos queda declarada junto al método que puede fallar. Para escenarios más elaborados —políticas dinámicas, métricas detalladas o reutilización entre múltiples servicios— `RetryTemplate` ofrece el control programático necesario.

El límite de Spring Retry es precisamente su alcance local: no sabe nada de lo que ocurrió en llamadas anteriores al mismo servicio. Cuando un servicio externo lleva minutos degradado y cada llamada acumula reintentos que solo empeoran su saturación, es momento de combinar Spring Retry con un Circuit Breaker que suspenda el flujo automáticamente hasta que el destino se recupere.
