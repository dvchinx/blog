---
titulo: "Spring Cloud Gateway: enrutamiento y filtros para microservicios"
seoTitulo: "Spring Cloud Gateway: guía práctica de API Gateway con Spring Boot y Spring Cloud"
fecha: "2026-07-07"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a construir un API Gateway con Spring Cloud Gateway: define rutas con predicados, aplica filtros para autenticación, limitación de tasa y transformación de cabeceras, y entiende cómo integra con Eureka para enrutamiento dinámico."
imagenPortada: "https://i.imgur.com/Vqxqsgy.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Cloud", "Microservicios", "Java", "Backend", "API Gateway"]
categoria: "tech"
keywords: "Spring Cloud Gateway, API Gateway Spring Boot, enrutamiento microservicios, filtros Spring Cloud Gateway, predicados Gateway, rate limiting Spring, Spring Cloud LoadBalancer, Eureka Gateway, Spring WebFlux Gateway, seguridad API Gateway"
---

# Spring Cloud Gateway: enrutamiento y filtros para microservicios

En una arquitectura de microservicios, los clientes no deberían conocer la ubicación ni la existencia de cada servicio individual. Un API Gateway actúa como punto de entrada único: recibe todas las peticiones, las enruta al servicio correcto y puede aplicar lógica transversal —autenticación, limitación de tasa, registro— sin que cada servicio tenga que implementarla por su cuenta.

Spring Cloud Gateway es la solución reactiva de Spring para este rol. Está construido sobre Spring WebFlux y Reactor Netty, lo que significa que maneja las peticiones de forma no bloqueante y puede procesar miles de conexiones concurrentes con pocos hilos.

## Arquitectura del Gateway

```
                        ┌──────────────────────────────────┐
Cliente ──── HTTPS ───► │        Spring Cloud Gateway       │
                        │                                   │
                        │  1. Predicado: ¿coincide la ruta? │
                        │  2. Pre-filtros (auth, logging…)  │
                        │  3. Enrutar al servicio destino   │
                        │  4. Post-filtros (headers, logs…) │
                        └─────────────┬────────────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               ▼                      ▼                       ▼
        order-service           user-service           product-service
```

Cada petición pasa por tres etapas:

1. **Route Predicate**: determina si la petición coincide con una ruta definida (por path, método HTTP, cabecera, etc.).
2. **Pre-filters**: se ejecutan antes de enviar la petición al servicio destino.
3. **Post-filters**: se ejecutan después de recibir la respuesta del servicio destino.

## Dependencias

Spring Cloud Gateway usa el stack reactivo, así que **no debes incluir `spring-boot-starter-web`**; es incompatible con WebFlux.

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
```

Con el BOM de Spring Cloud en `dependencyManagement`:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.3</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

## Definir rutas en YAML

La forma más directa de configurar rutas es en `application.yml`. Cada ruta tiene un `id`, un `uri` de destino, un conjunto de `predicates` y, opcionalmente, `filters`.

```yaml
spring:
  application:
    name: api-gateway
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: http://localhost:8081
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1

        - id: user-service
          uri: http://localhost:8082
          predicates:
            - Path=/api/users/**
          filters:
            - StripPrefix=1

        - id: product-service
          uri: http://localhost:8083
          predicates:
            - Path=/api/products/**
          filters:
            - StripPrefix=1
```

Con esta configuración, una petición a `GET /api/orders/123` se reenvía a `http://localhost:8081/orders/123`. El filtro `StripPrefix=1` elimina el primer segmento del path (`/api`) antes de hacer el reenvío.

## Predicados disponibles

Spring Cloud Gateway incluye un conjunto rico de predicados que puedes combinar:

```yaml
routes:
  - id: ejemplo-predicados
    uri: http://localhost:8081
    predicates:
      - Path=/api/orders/**          # coincide con el path
      - Method=GET,POST              # solo estos métodos HTTP
      - Header=X-Request-Id, \d+    # cabecera X-Request-Id debe ser numérica
      - Query=version, v2            # parámetro ?version=v2
      - After=2026-01-01T00:00:00Z   # solo después de esta fecha
      - RemoteAddr=192.168.1.0/24    # solo desde esta subred
```

Cuando defines varios predicados en una misma ruta, todos deben cumplirse al mismo tiempo (AND lógico). Para comportamiento OR necesitas rutas separadas.

## Filtros integrados

### AddRequestHeader y AddResponseHeader

Agrega cabeceras a la petición antes de enviarla al servicio, o a la respuesta antes de devolverla al cliente:

```yaml
filters:
  - AddRequestHeader=X-Gateway-Source, api-gateway
  - AddResponseHeader=X-Response-Time, ${responseTime}
```

### RewritePath

Transforma el path con una expresión regular:

```yaml
filters:
  - RewritePath=/api/(?<segment>.*), /$\{segment}
```

Esta expresión reescribe `/api/orders/123` como `/orders/123` sin usar `StripPrefix`.

### Retry

Reintenta la petición al servicio destino si falla con ciertos códigos de error:

```yaml
filters:
  - name: Retry
    args:
      retries: 3
      statuses: BAD_GATEWAY,SERVICE_UNAVAILABLE
      methods: GET
      backoff:
        firstBackoff: 100ms
        maxBackoff: 500ms
        factor: 2
```

### CircuitBreaker

Integra un circuit breaker (Resilience4j) que abre el circuito cuando el servicio falla repetidamente, y puede redirigir a un fallback:

```yaml
filters:
  - name: CircuitBreaker
    args:
      name: orderCircuitBreaker
      fallbackUri: forward:/fallback/orders
```

Y el controlador de fallback en el propio Gateway:

```java
@RestController
public class FallbackController {

    @GetMapping("/fallback/orders")
    public ResponseEntity<Map<String, String>> ordersFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "error", "Order service no disponible",
                "message", "Intenta de nuevo en unos segundos"
            ));
    }
}
```

## Rate Limiting

El filtro `RequestRateLimiter` limita cuántas peticiones puede hacer un cliente en un intervalo de tiempo. La implementación por defecto usa Redis para llevar el conteo de manera distribuida.

Agrega la dependencia de Redis:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>
```

Define el bean `KeyResolver` que identifica al cliente (aquí por dirección IP):

```java
@Configuration
public class GatewayConfig {

    @Bean
    public KeyResolver ipKeyResolver() {
        return exchange -> Mono.just(
            exchange.getRequest()
                    .getRemoteAddress()
                    .getAddress()
                    .getHostAddress()
        );
    }
}
```

Configura el filtro en la ruta:

```yaml
routes:
  - id: order-service
    uri: http://localhost:8081
    predicates:
      - Path=/api/orders/**
    filters:
      - name: RequestRateLimiter
        args:
          redis-rate-limiter.replenishRate: 10    # tokens por segundo
          redis-rate-limiter.burstCapacity: 20    # máximo en ráfaga
          redis-rate-limiter.requestedTokens: 1   # tokens por petición
          key-resolver: "#{@ipKeyResolver}"
```

Con esta configuración, cada IP puede hacer 10 peticiones por segundo en estado estable, con una ráfaga máxima de 20. Las peticiones que excedan ese límite reciben un `429 Too Many Requests`.

## Integración con Eureka (enrutamiento dinámico)

Apuntar a `http://localhost:8081` funciona en desarrollo, pero en producción los servicios pueden estar en distintas IPs o correr en múltiples instancias. La solución es registrar los servicios en Eureka y que el Gateway los descubra dinámicamente.

Agrega las dependencias de Eureka Client y Load Balancer:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

Cambia el `uri` de las rutas para usar el esquema `lb://` (load balancer) con el nombre de la aplicación registrada en Eureka:

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service        # nombre en Eureka, no URL fija
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1

        - id: user-service
          uri: lb://user-service
          predicates:
            - Path=/api/users/**
          filters:
            - StripPrefix=1
```

Spring Cloud LoadBalancer se encarga de resolver `lb://order-service` a una instancia disponible con balanceo round-robin. Si hay tres instancias de `order-service` corriendo, las peticiones se distribuyen automáticamente.

### Descubrimiento automático de rutas

Puedes ir un paso más allá y dejar que el Gateway cree rutas automáticamente para cada servicio registrado en Eureka, sin definir nada en el YAML:

```yaml
spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: true
          lower-case-service-id: true   # order-service en lugar de ORDER-SERVICE
```

Con esto, un servicio registrado en Eureka como `order-service` quedará disponible en `http://gateway/order-service/**` sin ninguna configuración adicional. Es conveniente en etapas tempranas, pero para producción es mejor definir las rutas explícitamente para tener control total sobre paths y filtros.

## Filtros globales

Los filtros globales se aplican a todas las rutas sin necesidad de configurarlos individualmente. Son ideales para lógica transversal como logging, propagación de correlación IDs o verificación de tokens.

```java
@Component
public class LoggingFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(LoggingFilter.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        log.info("[{}] {} {}",
            request.getId(),
            request.getMethod(),
            request.getURI());

        long start = System.currentTimeMillis();

        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            long duration = System.currentTimeMillis() - start;
            log.info("[{}] respondió en {} ms con status {}",
                request.getId(),
                duration,
                exchange.getResponse().getStatusCode());
        }));
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
```

El método `getOrder()` controla el orden de ejecución cuando hay múltiples filtros globales. Valores más bajos se ejecutan primero.

## Configuración por código (RouteLocator)

Además de YAML, puedes definir rutas programáticamente con el `RouteLocatorBuilder`:

```java
@Configuration
public class GatewayRoutesConfig {

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
            .route("order-service", r -> r
                .path("/api/orders/**")
                .filters(f -> f
                    .stripPrefix(1)
                    .addRequestHeader("X-Gateway-Source", "api-gateway")
                    .retry(config -> config
                        .setRetries(2)
                        .setStatuses(HttpStatus.BAD_GATEWAY)))
                .uri("lb://order-service"))
            .route("user-service", r -> r
                .path("/api/users/**")
                .and()
                .method(HttpMethod.GET, HttpMethod.POST)
                .filters(f -> f.stripPrefix(1))
                .uri("lb://user-service"))
            .build();
    }
}
```

La API fluida es más expresiva para rutas complejas y facilita la creación de rutas condicionales en tiempo de arranque.

## CORS global

Para APIs consumidas desde navegadores, configura CORS a nivel de Gateway en lugar de en cada servicio individual:

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOrigins:
              - "https://mi-frontend.com"
              - "http://localhost:3000"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - OPTIONS
            allowedHeaders: "*"
            allowCredentials: true
            maxAge: 3600
```

Con esta configuración, el Gateway añade las cabeceras CORS a todas las respuestas sin que los microservicios tengan que preocuparse por ello.

## Actuator y monitoreo

Con Spring Boot Actuator en el classpath, el Gateway expone endpoints útiles para inspeccionar el estado de las rutas:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: gateway, health, info, metrics
  endpoint:
    gateway:
      enabled: true
```

Endpoints disponibles:

```bash
# Lista todas las rutas definidas
GET /actuator/gateway/routes

# Detalle de una ruta específica
GET /actuator/gateway/routes/order-service

# Refresca las rutas sin reiniciar (requiere RouteLocator dinámico)
POST /actuator/gateway/refresh

# Filtros globales activos
GET /actuator/gateway/globalfilters

# Filtros de ruta activos
GET /actuator/gateway/routefilters
```

## Resumen

Spring Cloud Gateway centraliza el acceso a los microservicios, elimina lógica transversal duplicada y se integra de forma natural con el ecosistema Spring Cloud. Los conceptos clave son:

- **Rutas**: combinan un predicado (¿qué peticiones coinciden?) con un destino y filtros opcionales.
- **Predicados**: condiciones sobre path, método, cabeceras o parámetros que determinan qué ruta se aplica.
- **Filtros pre y post**: transforman la petición antes de enviarla y la respuesta antes de devolverla.
- **Rate Limiting**: usa Redis para limitar peticiones por cliente de forma distribuida.
- **Eureka + `lb://`**: habilita descubrimiento de servicios y balanceo de carga sin URLs fijas.
- **Filtros globales**: aplican lógica a todas las rutas sin repetir configuración.

El siguiente paso natural es agregar **Spring Security** al Gateway para validar JWT en el punto de entrada y propagar la identidad del usuario a los microservicios mediante cabeceras, liberando a cada servicio de repetir esa lógica de autenticación.
