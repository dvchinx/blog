---
titulo: "Circuit Breaker en Spring Boot con Resilience4J"
seoTitulo: "Circuit Breaker con Resilience4J en Spring Boot: guía práctica de tolerancia a fallos"
fecha: "2026-07-13"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a implementar el patrón Circuit Breaker en Spring Boot usando Resilience4J: estados, configuración, Retry, RateLimiter, Bulkhead y estrategias para entornos de producción."
imagenPortada: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java", "Backend", "Resilience4J", "Circuit Breaker", "Microservicios", "Tolerancia a Fallos"]
categoria: "tech"
keywords: "circuit breaker Spring Boot, Resilience4J Spring, tolerancia a fallos microservicios, Retry Spring Boot, RateLimiter Spring, Bulkhead Spring, fallback Spring Boot, fault tolerance Java, resilience patterns Spring, Spring Cloud Circuit Breaker"
---

# Circuit Breaker en Spring Boot con Resilience4J

En una arquitectura de microservicios, los servicios se comunican entre sí constantemente. Si un servicio dependiente empieza a responder lento o a fallar, esas solicitudes en tus propios hilos se acumulan esperando una respuesta que nunca llega —o que llega tarde— agotando recursos y propagando la degradación a lo largo de la cadena. El patrón **Circuit Breaker** actúa como un fusible eléctrico: detecta cuándo un servicio externo está en problemas y deja de enviarle solicitudes por un tiempo, permitiendo que el sistema se recupere en lugar de hundirse junto a él.

[Resilience4J](https://resilience4j.readme.io/) es la librería de tolerancia a fallos más popular en el ecosistema Spring. Funciona mediante decoradores funcionales sobre clases estándar de Java (suppliers, functions, runnables), sin necesitar proxies ni AOP en su núcleo, aunque también ofrece integración con Spring AOP para usarla con anotaciones.

## Dependencias

Con Spring Boot 3.x, agrega las siguientes dependencias a tu `pom.xml`:

```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.2.0</version>
</dependency>
<!-- Para usar las anotaciones (@CircuitBreaker, @Retry, etc.) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
<!-- Para exponer métricas via Spring Boot Actuator -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Con Spring Boot 2.x usa `resilience4j-spring-boot2` en su lugar.

## Los tres estados del Circuit Breaker

El Circuit Breaker es una máquina de estados con tres estados principales:

**CLOSED (cerrado)**: el estado normal. Las llamadas pasan al servicio externo. El circuit breaker registra los resultados (éxitos y fallos) en una ventana deslizante. Si la tasa de fallos supera el umbral configurado, el circuito se abre.

**OPEN (abierto)**: el circuit breaker bloquea todas las llamadas sin intentarlas siquiera. En su lugar, invoca el método de fallback inmediatamente. Permanece abierto durante un tiempo de espera configurable (`waitDurationInOpenState`), dando tiempo al servicio externo para recuperarse.

**HALF-OPEN (semiabierto)**: tras el tiempo de espera, el circuit breaker permite pasar un número limitado de llamadas de prueba (`permittedNumberOfCallsInHalfOpenState`). Si esas llamadas tienen éxito, el circuito se cierra; si siguen fallando, se vuelve a abrir.

```
CLOSED ──(tasa de fallos > umbral)──► OPEN
  ▲                                       │
  │                                       │ (waitDurationInOpenState)
  │                                       ▼
  └──(pruebas exitosas)────────── HALF-OPEN
```

También existe un estado **DISABLED** (deshabilita el circuit breaker) y **FORCED_OPEN** (fuerza el estado abierto), útiles para mantenimiento.

## Configuración en application.yml

La forma más práctica de configurar Resilience4J es mediante propiedades en `application.yml`. Puedes definir configuraciones compartidas (instancias base) y sobrescribirlas por instancia:

```yaml
resilience4j:
  circuit-breaker:
    configs:
      default:
        # Tamaño de la ventana deslizante (número de llamadas)
        sliding-window-size: 10
        # Tipo de ventana: COUNT_BASED o TIME_BASED
        sliding-window-type: COUNT_BASED
        # % de fallos para abrir el circuito
        failure-rate-threshold: 50
        # % de llamadas lentas para abrir el circuito
        slow-call-rate-threshold: 80
        # Duración que define una llamada "lenta"
        slow-call-duration-threshold: 2s
        # Tiempo en estado OPEN antes de pasar a HALF_OPEN
        wait-duration-in-open-state: 30s
        # Llamadas permitidas en estado HALF_OPEN
        permitted-number-of-calls-in-half-open-state: 5
        # Mínimo de llamadas antes de calcular la tasa de fallos
        minimum-number-of-calls: 5
        # Registrar excepciones como fallos
        record-exceptions:
          - java.io.IOException
          - java.util.concurrent.TimeoutException
          - feign.FeignException
        # Ignorar estas excepciones (no cuentan como fallos)
        ignore-exceptions:
          - com.example.BusinessException
    instances:
      servicioInventario:
        base-config: default
        # Sobreescritura solo para este servicio
        wait-duration-in-open-state: 60s
        failure-rate-threshold: 60
      servicioNotificaciones:
        base-config: default
        failure-rate-threshold: 70
```

La separación entre `configs` (plantillas reutilizables) e `instances` (configuraciones específicas por servicio) mantiene el YAML organizado cuando tienes muchos circuit breakers.

## Uso con anotaciones

La forma más común de usar Resilience4J en Spring Boot es con la anotación `@CircuitBreaker`. Solo necesitas marcar el método que hace la llamada externa y definir un método de fallback con la misma firma más un parámetro de tipo `Throwable`:

```java
@Service
public class PedidoService {

    private final InventarioClient inventarioClient;

    public PedidoService(InventarioClient inventarioClient) {
        this.inventarioClient = inventarioClient;
    }

    @CircuitBreaker(name = "servicioInventario", fallbackMethod = "inventarioFallback")
    public StockResponse verificarStock(Long productoId) {
        return inventarioClient.getStock(productoId);
    }

    // Fallback: mismo tipo de retorno + Throwable al final
    private StockResponse inventarioFallback(Long productoId, Throwable t) {
        log.warn("Circuit breaker activo para inventario. Producto: {}. Causa: {}",
                productoId, t.getMessage());
        // Respuesta degradada: asumimos stock disponible o redirigimos
        return StockResponse.builder()
                .productoId(productoId)
                .disponible(true)
                .cantidad(-1)  // -1 indica "desconocido"
                .build();
    }
}
```

El `name` en `@CircuitBreaker` debe coincidir exactamente con el nombre de la instancia definida en `application.yml`. Si no existe la instancia, Resilience4J usa la configuración `default`.

## Uso programático

A veces necesitas más control sobre el circuit breaker: crearlo dinámicamente, decorar funciones con varios patrones a la vez, o usarlo en código sin Spring. Resilience4J ofrece una API funcional para esto:

```java
@Service
public class PedidoService {

    private final CircuitBreaker circuitBreaker;
    private final InventarioClient inventarioClient;

    public PedidoService(CircuitBreakerRegistry registry, InventarioClient inventarioClient) {
        this.circuitBreaker = registry.circuitBreaker("servicioInventario");
        this.inventarioClient = inventarioClient;
    }

    public StockResponse verificarStock(Long productoId) {
        // Decorar la función con el circuit breaker
        Supplier<StockResponse> decoratedSupplier = CircuitBreaker.decorateSupplier(
                circuitBreaker,
                () -> inventarioClient.getStock(productoId)
        );

        // Ejecutar con fallback en caso de CallNotPermittedException o error
        return Try.ofSupplier(decoratedSupplier)
                .recover(CallNotPermittedException.class, ex -> inventarioFallback(productoId, ex))
                .recover(Exception.class, ex -> inventarioFallback(productoId, ex))
                .get();
    }

    private StockResponse inventarioFallback(Long productoId, Throwable t) {
        log.warn("Fallback activado para producto {}: {}", productoId, t.getMessage());
        return StockResponse.unavailable(productoId);
    }
}
```

El uso de `Try` de Vavr (incluido transitivamente con Resilience4J) hace que el manejo de excepciones sea funcional y componible.

## Retry: reintentos automáticos

El Retry de Resilience4J reintenta automáticamente una operación fallida un número configurable de veces con espera exponencial entre intentos. Es el compañero natural del Circuit Breaker: úsalo para fallos transitorios (timeout de red, 503 momentáneo) y el Circuit Breaker para fallos sostenidos.

```yaml
resilience4j:
  retry:
    configs:
      default:
        max-attempts: 3
        wait-duration: 500ms
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
        retry-exceptions:
          - java.io.IOException
          - feign.RetryableException
        ignore-exceptions:
          - com.example.ClientException  # 4xx no se reintenta
    instances:
      servicioInventario:
        base-config: default
        max-attempts: 4
        wait-duration: 1s
```

```java
@CircuitBreaker(name = "servicioInventario", fallbackMethod = "inventarioFallback")
@Retry(name = "servicioInventario")
public StockResponse verificarStock(Long productoId) {
    return inventarioClient.getStock(productoId);
}
```

Cuando combinas `@Retry` y `@CircuitBreaker`, el orden de aplicación importa: Resilience4J aplica los decoradores de afuera hacia adentro. La anotación más externa se aplica primero. En el ejemplo anterior, el Retry envuelve al Circuit Breaker, lo que significa que el retry se ejecuta sobre la llamada ya protegida por el circuit breaker. Para que el Circuit Breaker vea todos los intentos fallidos del Retry y abra el circuito correctamente, invierte el orden:

```java
@Retry(name = "servicioInventario")                                      // externo: se aplica primero
@CircuitBreaker(name = "servicioInventario", fallbackMethod = "fallback") // interno: ve cada intento
public StockResponse verificarStock(Long productoId) {
    return inventarioClient.getStock(productoId);
}
```

Con este orden, el Circuit Breaker registra cada intento individual del Retry como una llamada separada, acumulando fallos con más precisión.

## RateLimiter: control de tasa de peticiones

El RateLimiter limita cuántas llamadas por unidad de tiempo pueden realizarse a un servicio externo. Es útil para respetar los rate limits de APIs de terceros o para proteger servicios débiles de sobrecargas:

```yaml
resilience4j:
  rate-limiter:
    instances:
      servicioNotificaciones:
        limit-for-period: 20           # máximo 20 llamadas
        limit-refresh-period: 1s       # por cada segundo
        timeout-duration: 100ms        # espera máxima para obtener permiso
```

```java
@RateLimiter(name = "servicioNotificaciones", fallbackMethod = "notificacionFallback")
public void enviarNotificacion(Long usuarioId, String mensaje) {
    notificacionClient.enviar(usuarioId, mensaje);
}

private void notificacionFallback(Long usuarioId, String mensaje, RequestNotPermitted ex) {
    log.warn("Rate limit alcanzado. Notificación encolada para usuario {}", usuarioId);
    colaNotificaciones.encolar(usuarioId, mensaje);
}
```

## Bulkhead: aislamiento de recursos

El Bulkhead limita el número de llamadas concurrentes a un servicio externo, aislando los recursos que ese servicio consume de los que necesita el resto de la aplicación. Resilience4J ofrece dos implementaciones:

**Semaphore Bulkhead** (ligero, dentro del hilo del llamador):

```yaml
resilience4j:
  bulkhead:
    instances:
      servicioPagos:
        max-concurrent-calls: 10      # máximo 10 llamadas simultáneas
        max-wait-duration: 100ms      # espera máxima para obtener un slot
```

**ThreadPool Bulkhead** (ejecución en pool de hilos dedicado, solo para código reactivo o async):

```yaml
resilience4j:
  thread-pool-bulkhead:
    instances:
      servicioPagos:
        max-thread-pool-size: 10
        core-thread-pool-size: 5
        queue-capacity: 20
```

```java
@Bulkhead(name = "servicioPagos", fallbackMethod = "pagoFallback")
public PagoResponse procesarPago(PagoRequest request) {
    return pagoClient.procesar(request);
}

private PagoResponse pagoFallback(PagoRequest request, BulkheadFullException ex) {
    log.warn("Bulkhead lleno. Pago rechazado temporalmente para orden {}", request.getOrdenId());
    throw new ServiceUnavailableException("Servicio de pagos temporalmente no disponible");
}
```

## TimeLimiter: timeout declarativo

El TimeLimiter de Resilience4J aplica un timeout a operaciones asíncronas (que retornan `CompletableFuture`). Para llamadas síncronas, es más natural configurar el timeout directamente en el cliente HTTP (RestClient, WebClient, FeignClient):

```yaml
resilience4j:
  time-limiter:
    instances:
      servicioInventario:
        timeout-duration: 3s
        cancel-running-future: true
```

```java
@CircuitBreaker(name = "servicioInventario", fallbackMethod = "inventarioFallback")
@TimeLimiter(name = "servicioInventario")
public CompletableFuture<StockResponse> verificarStockAsync(Long productoId) {
    return CompletableFuture.supplyAsync(() -> inventarioClient.getStock(productoId));
}
```

## Observabilidad: métricas y eventos

Resilience4J expone automáticamente métricas en Micrometer cuando `spring-boot-starter-actuator` está presente. Con el endpoint `/actuator/health` puedes ver el estado de cada circuit breaker:

```yaml
management:
  health:
    circuitbreakers:
      enabled: true
  endpoints:
    web:
      exposure:
        include: health, metrics
  endpoint:
    health:
      show-details: always
```

La respuesta de `/actuator/health` incluirá algo como:

```json
{
  "status": "UP",
  "components": {
    "circuitBreakers": {
      "status": "UP",
      "details": {
        "servicioInventario": {
          "status": "UP",
          "details": {
            "failureRate": "0.0%",
            "slowCallRate": "0.0%",
            "state": "CLOSED",
            "bufferedCalls": 5,
            "failedCalls": 0
          }
        }
      }
    }
  }
}
```

También puedes suscribirte a eventos del circuit breaker para logging o alertas:

```java
@PostConstruct
public void configurarEventListeners() {
    CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("servicioInventario");

    cb.getEventPublisher()
        .onStateTransition(event ->
            log.warn("Circuit Breaker '{}' cambió de {} a {}",
                event.getCircuitBreakerName(),
                event.getStateTransition().getFromState(),
                event.getStateTransition().getToState()))
        .onError(event ->
            log.error("Error en '{}': {}",
                event.getCircuitBreakerName(), event.getThrowable().getMessage()))
        .onCallNotPermitted(event ->
            log.warn("Llamada bloqueada por '{}' (circuito abierto)",
                event.getCircuitBreakerName()));
}
```

## Testing

Resilience4J es fácil de testear porque puedes manipular el estado del circuit breaker directamente en los tests:

```java
@SpringBootTest
class PedidoServiceTest {

    @Autowired
    private PedidoService pedidoService;

    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @MockBean
    private InventarioClient inventarioClient;

    @BeforeEach
    void setUp() {
        // Resetear el circuit breaker entre tests
        circuitBreakerRegistry.circuitBreaker("servicioInventario").reset();
    }

    @Test
    void cuandoServicioFalla_deberiaActivarFallback() {
        when(inventarioClient.getStock(anyLong()))
            .thenThrow(new RuntimeException("Servicio no disponible"));

        // Provocar suficientes fallos para abrir el circuito
        for (int i = 0; i < 10; i++) {
            StockResponse response = pedidoService.verificarStock(1L);
            // El fallback devuelve cantidad -1
            assertThat(response.getCantidad()).isEqualTo(-1);
        }

        // Verificar que el circuito está abierto
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("servicioInventario");
        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.OPEN);
    }

    @Test
    void cuandoCircuitoEstaAbierto_deberiaBloquearLlamadasInmediatamente() {
        // Forzar apertura del circuito
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("servicioInventario");
        cb.transitionToOpenState();

        StockResponse response = pedidoService.verificarStock(1L);

        // El fallback debe activarse sin llamar al cliente
        assertThat(response.getCantidad()).isEqualTo(-1);
        verify(inventarioClient, never()).getStock(anyLong());
    }

    @Test
    void cuandoServicioSeRecupera_deberiaCerrarElCircuito() {
        CircuitBreaker cb = circuitBreakerRegistry.circuitBreaker("servicioInventario");
        cb.transitionToHalfOpenState();

        when(inventarioClient.getStock(anyLong()))
            .thenReturn(StockResponse.builder().disponible(true).cantidad(100).build());

        // Llamadas exitosas en HALF_OPEN deben cerrar el circuito
        for (int i = 0; i < 5; i++) {
            pedidoService.verificarStock(1L);
        }

        assertThat(cb.getState()).isEqualTo(CircuitBreaker.State.CLOSED);
    }
}
```

## Estrategia de composición en producción

En producción, los cuatro patrones de Resilience4J se complementan y se pueden combinar por capas sobre el mismo método. Este es el orden recomendado (de más externo a más interno):

```java
@RateLimiter(name = "servicioInventario")          // 1. Primero limitar la tasa
@Bulkhead(name = "servicioInventario")             // 2. Limitar concurrencia
@Retry(name = "servicioInventario")                // 3. Reintentar si falla
@CircuitBreaker(name = "servicioInventario",       // 4. Abrir circuito si persiste
        fallbackMethod = "inventarioFallback")
public StockResponse verificarStock(Long productoId) {
    return inventarioClient.getStock(productoId);
}
```

La lógica de este orden: el RateLimiter evita generar más tráfico del que el servicio puede manejar. El Bulkhead evita que un servicio lento monopolice los hilos. El Retry maneja fallos transitorios antes de que el Circuit Breaker los contabilice. El Circuit Breaker actúa cuando los fallos son sostenidos y ya no tiene sentido reintentar.

Para la mayoría de servicios internos en un sistema con Spring Cloud Eureka y Gateway, es suficiente con `@CircuitBreaker` + `@Retry`. Añade `@RateLimiter` y `@Bulkhead` solo cuando tengas requisitos específicos de protección o cuando consumas APIs externas con rate limits explícitos.

## Buenas prácticas

**Diseña el fallback primero.** El fallback no es un detalle de implementación: es parte del contrato de la función. Define qué significa "éxito degradado" para tu dominio antes de implementar el circuit breaker.

**Ajusta los umbrales con datos reales.** Los valores por defecto (`slidingWindowSize: 100`, `failureRateThreshold: 50`) están pensados para sistemas con mucho tráfico. En servicios con pocas llamadas, ajusta `minimumNumberOfCalls` y `slidingWindowSize` a valores más pequeños.

**No uses Retry en llamadas que modifican estado** sin idempotencia. Reintentar un `POST /pagos` tres veces puede cobrar tres veces al usuario. Antes de añadir `@Retry`, asegúrate de que la operación sea idempotente o implementa idempotency keys en el servicio externo.

**Monitoriza los eventos de transición de estado.** Un circuit breaker que abre y cierra constantemente (flapping) indica que los umbrales son demasiado sensibles o que el servicio externo tiene problemas intermitentes que deben resolverse en origen.

**Configura `waitDurationInOpenState` acorde al tiempo de recuperación real.** Si sabes que tu servicio de inventario tarda unos 30 segundos en reiniciarse, no uses los 60 segundos por defecto: reduce el tiempo de espera para que el circuito se recupere más rápido.

## Conclusión

Resilience4J transforma la tolerancia a fallos en Spring Boot de algo ad-hoc —try-catch por aquí, timeout por allá— en una estrategia declarativa y observable. El Circuit Breaker protege tu servicio de cascadas de fallos; el Retry maneja la inestabilidad transitoria; el RateLimiter respeta los límites de los servicios externos; el Bulkhead aisla los recursos.

El patrón que funciona bien en producción es: empezar solo con `@CircuitBreaker` y un fallback bien pensado, monitorizar las métricas que expone Actuator, y añadir `@Retry`, `@RateLimiter` o `@Bulkhead` cuando los datos de producción muestran que son necesarios. La resiliencia no es un añadido de última hora —es una propiedad que se diseña desde el principio en la interfaz de cada servicio externo que consumes.
