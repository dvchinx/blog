---
titulo: "Patrones de Microservicios: Circuit Breaker, Saga y API Gateway"
seoTitulo: "Patrones de Microservicios: Circuit Breaker, Saga y API Gateway explicados con ejemplos"
fecha: "2026-06-31"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende tres patrones fundamentales para arquitecturas de microservicios: Circuit Breaker para tolerancia a fallos, Saga para transacciones distribuidas y API Gateway para gestionar el acceso a servicios."
imagenPortada: "https://i.imgur.com/VHxjbCU.png?w=800&h=500&fit=crop"
etiquetas: ["Microservicios", "Architecture", "Circuit Breaker", "Saga", "API Gateway", "Backend"]
categoria: "tech"
keywords: "patrones de microservicios, circuit breaker spring boot, saga pattern java, API gateway spring cloud, resilience4j, spring cloud gateway, tolerancia a fallos microservicios, transacciones distribuidas java, arquitectura microservicios spring"
---

# Patrones de Microservicios: Circuit Breaker, Saga y API Gateway

Dividir una aplicación en microservicios resuelve varios problemas de escalabilidad y despliegue independiente, pero introduce una categoría completamente nueva de desafíos: los servicios se comunican por red, los fallos son inevitables y coordinar operaciones que antes eran una sola transacción de base de datos ahora implica múltiples sistemas autónomos.

Para manejar esta complejidad, la industria ha desarrollado un conjunto de patrones recurrentes. Este artículo cubre tres de los más fundamentales: **Circuit Breaker** para gestionar fallos de servicios dependientes, **Saga** para transacciones distribuidas y **API Gateway** para centralizar el acceso desde el exterior.

## Circuit Breaker

### El problema

En un sistema de microservicios, un servicio A llama a un servicio B para completar su tarea. Si B se cae o se vuelve muy lento, A empieza a acumular solicitudes que no pueden completarse. Los hilos quedan bloqueados esperando una respuesta que no llega, los recursos se agotan y A también se cae. El fallo se propaga en cascada hacia todos los servicios que dependen de A.

El problema no es solo que B falle, sino que A no tiene forma de saber cuándo dejar de intentarlo.

### La solución

El patrón Circuit Breaker actúa como un interruptor entre A y B. Tiene tres estados:

**Closed (cerrado)**: el estado normal. Las solicitudes fluyen libremente hacia B. Si los errores superan un umbral definido (por ejemplo, más del 50% de las últimas 10 llamadas fallaron), el circuito se abre.

**Open (abierto)**: el circuito está abierto. Las solicitudes hacia B se rechazan inmediatamente sin siquiera intentar la llamada. En vez de esperar un timeout de varios segundos, A obtiene un fallo instantáneo y puede responder con un fallback (respuesta por defecto, caché, etc.). Después de un tiempo configurable, el circuito pasa al estado half-open.

**Half-open (semiabierto)**: se permite pasar una cantidad limitada de solicitudes para comprobar si B se recuperó. Si tienen éxito, el circuito vuelve a cerrarse. Si fallan, vuelve a abrirse.

```
Solicitudes → [ Circuit Breaker ] → Servicio B
                    ↕
              Estado: CLOSED → OPEN → HALF-OPEN → CLOSED
```

### Implementación con Spring Boot y Resilience4j

En Spring Boot, **Resilience4j** es la biblioteca estándar para implementar este patrón. Se integra con Spring Boot mediante anotaciones y expone métricas automáticamente a través de Spring Boot Actuator.

La dependencia en `pom.xml`:

```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.2.0</version>
</dependency>
```

La configuración del circuito en `application.yml`:

```yaml
resilience4j:
  circuitbreaker:
    instances:
      inventario:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
        permittedNumberOfCallsInHalfOpenState: 3
        registerHealthIndicator: true
```

El servicio que aplica el Circuit Breaker mediante la anotación `@CircuitBreaker`:

```java
@Service
public class PedidoService {

    private final InventarioClient inventarioClient;

    public PedidoService(InventarioClient inventarioClient) {
        this.inventarioClient = inventarioClient;
    }

    @CircuitBreaker(name = "inventario", fallbackMethod = "fallbackStock")
    public StockDTO consultarStock(Long productoId) {
        return inventarioClient.getStock(productoId);
    }

    // Se invoca automáticamente cuando el circuito está abierto o la llamada falla
    public StockDTO fallbackStock(Long productoId, Exception e) {
        return new StockDTO(productoId, 0, "SIN_DATOS_DISPONIBLES");
    }
}
```

El cliente Feign que representa la llamada al servicio externo:

```java
@FeignClient(name = "inventario", url = "${servicios.inventario.url}")
public interface InventarioClient {
    @GetMapping("/stock/{productoId}")
    StockDTO getStock(@PathVariable Long productoId);
}
```

Con esta configuración, si más del 50% de las últimas 10 llamadas fallan, el circuito se abre durante 30 segundos. En ese tiempo, todas las llamadas van directamente al método `fallbackStock` sin intentar conectarse al servicio de inventario. Netflix Hystrix cumplió este rol durante muchos años, pero entró en modo mantenimiento y Resilience4j es hoy el reemplazo recomendado.

### Cuándo usarlo

El Circuit Breaker es apropiado cuando un servicio realiza llamadas síncronas a otros servicios o a sistemas externos (APIs de terceros, bases de datos remotas). No tiene sentido en comunicación asíncrona basada en colas, donde el productor no espera respuesta.

---

## Saga

### El problema

En una arquitectura monolítica, una operación que involucra múltiples tablas de base de datos puede envolverse en una única transacción ACID: o todo se completa o todo se revierte. En microservicios, cada servicio tiene su propia base de datos. No hay un gestor de transacciones que coordine rollbacks a través de múltiples sistemas.

Imagina un proceso de compra que involucra tres servicios: órdenes, inventario y pagos. Si el pago falla después de que el inventario ya descontó el stock, ¿cómo se revierte el inventario? No existe una transacción distribuida que lo haga automáticamente.

### La solución

El patrón Saga divide la transacción en una secuencia de transacciones locales, cada una en un servicio distinto. Si algún paso falla, se ejecutan **transacciones compensatorias** para deshacer los pasos anteriores.

Existen dos variantes principales:

**Saga coreografiada**: cada servicio publica eventos que activan al siguiente. No hay un coordinador central. El flujo es reactivo: el servicio de órdenes publica `OrdenCreada`, el servicio de inventario escucha ese evento, reserva el stock y publica `StockReservado`, y así sucesivamente.

```
ServicioOrdenes  →(OrdenCreada)→  ServicioInventario  →(StockReservado)→  ServicioPagos
       ↑                                  ↓                                      ↓
(OrdenCancelada) ←(StockLiberado)← si pago falla ←──────────────────────(PagoFallido)
```

En Spring Boot, la coreografía se puede implementar publicando y escuchando eventos a través de Apache Kafka. El servicio de órdenes publica el evento:

```java
@Service
public class OrdenService {

    private final KafkaTemplate<String, OrdenCreadaEvent> kafkaTemplate;

    public void crearOrden(CrearOrdenRequest request) {
        Orden orden = ordenRepository.save(new Orden(request));
        kafkaTemplate.send("ordenes.creadas", new OrdenCreadaEvent(orden.getId(), orden.getProductoId(), orden.getCantidad()));
    }
}
```

El servicio de inventario escucha el evento y publica el resultado:

```java
@Service
public class InventarioSagaListener {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "ordenes.creadas", groupId = "inventario-saga")
    public void onOrdenCreada(OrdenCreadaEvent event) {
        boolean reservado = inventarioService.reservarStock(event.getProductoId(), event.getCantidad());

        if (reservado) {
            kafkaTemplate.send("inventario.stock-reservado", new StockReservadoEvent(event.getOrdenId()));
        } else {
            kafkaTemplate.send("inventario.stock-insuficiente", new StockInsuficienteEvent(event.getOrdenId()));
        }
    }
}
```

**Saga orquestada**: un componente central (orquestador o saga manager) coordina la secuencia, enviando comandos a cada servicio y esperando respuestas para decidir el siguiente paso. Si alguno falla, el orquestador envía los comandos de compensación.

```
Orquestador ──→ ServicioInventario (ReservarStock)
            ←── StockReservado / StockInsuficiente

Orquestador ──→ ServicioPagos (ProcesarPago)
            ←── PagoAprobado / PagoRechazado

si PagoRechazado:
Orquestador ──→ ServicioInventario (LiberarStock)
```

En Spring Boot, el orquestador puede implementarse como un componente que maneja el estado de la saga y reacciona a cada respuesta:

```java
@Service
public class CompraOrquestador {

    private final InventarioClient inventarioClient;
    private final PagosClient pagosClient;
    private final SagaRepository sagaRepository;

    @Transactional
    public void iniciar(Long ordenId, Long productoId, int cantidad, BigDecimal monto) {
        SagaEstado saga = sagaRepository.save(new SagaEstado(ordenId, "INICIADA"));

        try {
            inventarioClient.reservarStock(productoId, cantidad);
            saga.setEstado("STOCK_RESERVADO");
            sagaRepository.save(saga);

            pagosClient.procesarPago(ordenId, monto);
            saga.setEstado("COMPLETADA");
            sagaRepository.save(saga);

        } catch (StockInsuficienteException e) {
            saga.setEstado("FALLIDA_SIN_STOCK");
            sagaRepository.save(saga);

        } catch (PagoRechazadoException e) {
            // Compensación: liberar el stock ya reservado
            inventarioClient.liberarStock(productoId, cantidad);
            saga.setEstado("FALLIDA_PAGO_RECHAZADO");
            sagaRepository.save(saga);
        }
    }
}
```

### Compensación, no rollback

La compensación es semánticamente diferente a un rollback. Si el pago falla y se ejecuta la compensación del inventario, ambas transacciones ya se confirmaron en sus respectivas bases de datos. La compensación crea una nueva transacción que deshace el efecto de la anterior, pero no borra el historial.

Esto tiene implicaciones prácticas: el estado de los datos puede ser visible temporalmente en estados intermedios. Los sistemas que usen Saga deben diseñarse con **consistencia eventual** en mente, no consistencia inmediata.

### Coreografía vs orquestación

| Aspecto | Coreografía | Orquestación |
|---|---|---|
| Acoplamiento | Bajo (servicios se comunican por eventos) | Mayor (servicios conocen el orquestador) |
| Visibilidad del flujo | Difícil de seguir (distribuido entre servicios) | Clara (centralizada en el orquestador) |
| Complejidad | Aumenta con la cantidad de pasos | Manejable con herramientas como Camunda o Temporal |
| Fallo del orquestador | No aplica | Punto único de fallo (requiere alta disponibilidad) |

En flujos simples de dos o tres pasos, la coreografía suele ser suficiente. En flujos complejos con muchos pasos y múltiples bifurcaciones, la orquestación facilita el mantenimiento y la visibilidad.

---

## API Gateway

### El problema

En una arquitectura de microservicios, los clientes necesitan acceder a múltiples servicios para completar una operación. Una pantalla de inicio de sesión podría necesitar datos del servicio de usuarios, del de preferencias y del de notificaciones. Si el cliente hace tres llamadas directas a tres servicios distintos, aumenta la latencia, el acoplamiento del cliente con la topología interna y la complejidad de gestionar autenticación en cada servicio por separado.

Además, los servicios internos no deberían estar expuestos directamente a internet: necesitas un punto de entrada único donde aplicar autenticación, rate limiting, logging y enrutamiento.

### La solución

El API Gateway es ese punto de entrada único. Recibe todas las solicitudes externas y las enruta al servicio interno correspondiente, opcionalmente transformando la petición o agregando respuestas de múltiples servicios.

```
Clientes (web, móvil, terceros)
        ↓
   [ API Gateway ]
   /      |      \
ServA  ServB  ServC
```

Las responsabilidades típicas de un API Gateway son:

**Enrutamiento**: redirigir `/api/usuarios/*` al servicio de usuarios y `/api/pedidos/*` al servicio de pedidos.

**Autenticación y autorización**: validar tokens JWT o claves de API antes de que la solicitud llegue al servicio. Los servicios internos confían en que el gateway ya verificó la identidad.

**Rate limiting**: limitar cuántas solicitudes puede hacer un cliente por segundo para proteger los servicios de abusos.

**Agregación**: combinar respuestas de varios servicios en una sola respuesta para el cliente, reduciendo el número de llamadas que el cliente necesita hacer.

**Transformación**: traducir formatos, añadir o quitar cabeceras, convertir entre protocolos (por ejemplo, REST externo a gRPC interno).

**Observabilidad**: registrar todas las solicitudes entrantes en un único punto, lo que simplifica el logging y el monitoreo.

### API Gateway vs BFF

El patrón **Backend for Frontend (BFF)** es una variante donde se crea un gateway específico por tipo de cliente. En vez de un único gateway genérico, existe uno para la app web, otro para la app móvil y otro para integraciones de terceros. Cada uno agrega y transforma los datos de forma óptima para su cliente particular.

Esto evita que el gateway genérico acumule demasiada lógica de presentación y facilita optimizar el contrato de API para cada canal sin afectar a los demás.

### Implementación con Spring Cloud Gateway

En el ecosistema Spring, **Spring Cloud Gateway** es la opción estándar. Se configura con rutas, predicados y filtros, y se integra con Spring Security para autenticación y con Resilience4j para circuit breakers.

La dependencia en `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
```

La configuración básica de rutas en `application.yml`:

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: servicio-usuarios
          uri: lb://usuarios          # lb:// usa el balanceador de carga de Spring Cloud
          predicates:
            - Path=/api/usuarios/**
          filters:
            - StripPrefix=1           # elimina /api del path antes de reenviar

        - id: servicio-pedidos
          uri: lb://pedidos
          predicates:
            - Path=/api/pedidos/**
          filters:
            - StripPrefix=1
            - name: CircuitBreaker
              args:
                name: pedidos
                fallbackUri: forward:/fallback/pedidos
```

Para aplicar autenticación JWT en todas las rutas, se crea un filtro global con Spring Security:

```java
@Configuration
@EnableWebFluxSecurity
public class GatewaySecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        return http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .authorizeExchange(exchanges -> exchanges
                .pathMatchers("/api/auth/**").permitAll()
                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

Con esta configuración, el gateway valida el token JWT antes de reenviar cualquier solicitud a los servicios internos. Los servicios no necesitan implementar autenticación por separado: confían en que si la solicitud llegó, ya fue validada.

Fuera del ecosistema Java, opciones como **Kong**, **AWS API Gateway**, **Nginx** y **Traefik** resuelven el mismo problema con diferentes niveles de abstracción y características.

---

## Los tres patrones en conjunto

Estos patrones no son mutuamente excluyentes; en la práctica se usan juntos. Un sistema típico tiene un API Gateway en el borde, Circuit Breakers en las llamadas entre servicios internos, y Sagas para coordinar procesos de negocio que cruzan más de un servicio.

| Patrón | Problema que resuelve | Dónde aplica |
|---|---|---|
| Circuit Breaker | Fallos en cascada al llamar servicios dependientes | En las llamadas síncronas entre servicios |
| Saga | Transacciones que cruzan múltiples bases de datos | En flujos de negocio de varios pasos |
| API Gateway | Punto de entrada único, autenticación, enrutamiento | En el borde del sistema, entre clientes y servicios |

El mayor riesgo al adoptarlos es hacerlo de forma prematura. Una aplicación que todavía no necesita microservicios no necesita ninguno de estos patrones. Pero cuando la escala y la complejidad lo exigen, conocerlos antes de llegar a los problemas marca una diferencia real en cuánto tiempo lleva resolver esos problemas.

## Para seguir profundizando

Los patrones de microservicios no son una lista finita. A los tres de este artículo se les suman otros como **Event Sourcing** (registrar el historial de cambios en vez del estado actual), **Strangler Fig** (migrar gradualmente desde un monolito) o **Sidecar** (añadir capacidades a un servicio sin modificarlo). Cada uno responde a un desafío específico que aparece cuando los sistemas distribuidos crecen en complejidad.
