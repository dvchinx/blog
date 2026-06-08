---
titulo: "Spring Boot Actuator: monitoreo y observabilidad en producción"
seoTitulo: "Spring Boot Actuator: health checks, métricas y monitoreo en producción"
fecha: "2026-06-08"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Spring Boot Actuator para exponer endpoints de salud, métricas e información del sistema. Cubre configuración, seguridad de endpoints, integración con Micrometer y Prometheus, y personalización de health checks."
imagenPortada: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Actuator", "Java", "Backend", "Monitoreo", "Prometheus", "Micrometer"]
categoria: "tech"
keywords: "Spring Boot Actuator, health check Spring Boot, métricas Spring Boot, Micrometer Prometheus, monitoreo Spring, endpoints actuator, observabilidad Spring Boot, production-ready Spring"
---

# Spring Boot Actuator: monitoreo y observabilidad en producción

Una aplicación que funciona en desarrollo no siempre es una aplicación lista para producción. Necesita exponer información sobre su estado interno: ¿está sana? ¿Qué tan cargada está? ¿Cuántos requests procesa por segundo? ¿Qué versión está corriendo?

Spring Boot Actuator resuelve esto sin necesidad de código extra. Con una sola dependencia obtienes decenas de endpoints que exponen métricas, estado de salud, información de configuración, trazas de requests y mucho más. Este artículo cubre cómo configurarlo, asegurarlo y extenderlo.

## Dependencia

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Con esto, al arrancar la aplicación verás en los logs que Actuator ha mapeado sus endpoints bajo `/actuator`.

## Endpoints principales

Por defecto, solo `/actuator/health` e `/actuator/info` están expuestos en HTTP. El resto existen pero no son accesibles sin configuración explícita.

Los endpoints más útiles son:

| Endpoint | Descripción |
|----------|-------------|
| `/actuator/health` | Estado de la aplicación y sus dependencias |
| `/actuator/info` | Metadatos del build (versión, git commit, etc.) |
| `/actuator/metrics` | Lista de métricas disponibles |
| `/actuator/metrics/{nombre}` | Valor de una métrica específica |
| `/actuator/env` | Variables de entorno y propiedades de configuración |
| `/actuator/beans` | Todos los Spring Beans registrados en el contexto |
| `/actuator/mappings` | Todos los endpoints HTTP mapeados |
| `/actuator/loggers` | Niveles de log actuales (permite cambiarlos en caliente) |
| `/actuator/threaddump` | Estado de todos los threads de la JVM |
| `/actuator/httptrace` | Últimas N peticiones HTTP recibidas |

## Configuración de exposición

Para exponer todos los endpoints en HTTP:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: "*"
```

Para exponer solo un subconjunto:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, loggers
```

También puedes cambiar el puerto base o la ruta raíz de Actuator. Esto es útil para separar el tráfico de monitoreo del tráfico de la aplicación:

```yaml
management:
  server:
    port: 8081
  endpoints:
    web:
      base-path: /management
```

Con esta configuración, los endpoints de Actuator responden en `http://host:8081/management/health` y la aplicación sigue en el puerto 8080.

## Health checks

El endpoint `/actuator/health` devuelve el estado agregado de la aplicación. Por defecto incluye:

- **DiskSpaceHealthIndicator**: espacio disponible en disco
- **DataSourceHealthIndicator**: conectividad con la base de datos
- **RedisHealthIndicator**: si Redis está configurado
- Otros indicadores para RabbitMQ, MongoDB, Elasticsearch, etc.

La respuesta básica:

```json
{
  "status": "UP"
}
```

Para ver el detalle de cada componente, hay que habilitar la visibilidad completa:

```yaml
management:
  endpoint:
    health:
      show-details: always
```

Con eso la respuesta incluye el estado de cada dependencia:

```json
{
  "status": "UP",
  "components": {
    "db": {
      "status": "UP",
      "details": {
        "database": "PostgreSQL",
        "validationQuery": "isValid()"
      }
    },
    "diskSpace": {
      "status": "UP",
      "details": {
        "total": 499963174912,
        "free": 312045674496,
        "threshold": 10485760,
        "exists": true
      }
    }
  }
}
```

El estado general es `DOWN` si cualquier componente individual está en `DOWN`. Esto es lo que usa un load balancer o un orchestrador como Kubernetes para determinar si debe enviar tráfico a la instancia.

### Health check personalizado

Para agregar lógica propia al health check, implementa `HealthIndicator`:

```java
@Component
public class ExternalApiHealthIndicator implements HealthIndicator {

    private final ExternalApiClient apiClient;

    public ExternalApiHealthIndicator(ExternalApiClient apiClient) {
        this.apiClient = apiClient;
    }

    @Override
    public Health health() {
        try {
            boolean reachable = apiClient.ping();
            if (reachable) {
                return Health.up()
                        .withDetail("api", "external-payments-service")
                        .withDetail("status", "reachable")
                        .build();
            }
            return Health.down()
                    .withDetail("api", "external-payments-service")
                    .withDetail("reason", "ping failed")
                    .build();
        } catch (Exception e) {
            return Health.down(e)
                    .withDetail("api", "external-payments-service")
                    .build();
        }
    }
}
```

Spring Boot descubre automáticamente los beans que implementan `HealthIndicator` y los incluye en el endpoint `/actuator/health`.

## Endpoint info

El endpoint `/actuator/info` está vacío por defecto. Para poblarlo hay dos formas comunes:

**Información estática en propiedades:**

```yaml
info:
  app:
    name: mi-api
    description: API de gestión de pedidos
    version: 2.3.1
  contact:
    email: ops@empresa.com
```

**Información del build (Maven):**

Agrega el plugin de info al `pom.xml`:

```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <executions>
        <execution>
            <goals>
                <goal>build-info</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

Y habilita los contributors en las propiedades:

```yaml
management:
  info:
    build:
      enabled: true
    git:
      enabled: true
      mode: full
```

Con el plugin de Git info (`git-commit-id-maven-plugin`), el endpoint devuelve el commit hash, la rama y la fecha del último deploy. Esto facilita diagnosticar qué versión exacta está corriendo en cada entorno.

## Métricas con Micrometer

Actuator usa **Micrometer** como capa de abstracción para métricas. Micrometer funciona como SLF4J pero para métricas: defines métricas en código y Micrometer las envía al sistema de monitoreo que configures (Prometheus, Datadog, Graphite, InfluxDB, etc.).

### Integración con Prometheus

```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

Con esta dependencia se crea automáticamente el endpoint `/actuator/prometheus` con todas las métricas en formato que Prometheus puede scrape:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, prometheus
  metrics:
    export:
      prometheus:
        enabled: true
```

Prometheus puede apuntar a ese endpoint para recoger métricas periódicamente, y luego Grafana las visualiza.

### Métricas personalizadas

Para instrumentar código propio:

```java
@Service
public class OrderService {

    private final Counter ordersCreated;
    private final Timer orderProcessingTime;

    public OrderService(MeterRegistry registry) {
        this.ordersCreated = Counter.builder("orders.created")
                .description("Total de órdenes creadas")
                .tag("source", "api")
                .register(registry);

        this.orderProcessingTime = Timer.builder("orders.processing.time")
                .description("Tiempo de procesamiento de órdenes")
                .register(registry);
    }

    public Order createOrder(OrderRequest request) {
        ordersCreated.increment();

        return orderProcessingTime.record(() -> {
            // lógica de negocio
            return processOrder(request);
        });
    }
}
```

Las métricas aparecen en `/actuator/metrics/orders.created` y en el endpoint de Prometheus.

Micrometer también ofrece la anotación `@Timed` para medir automáticamente la duración de métodos:

```java
@Timed(value = "orders.processing.time", description = "Tiempo de procesamiento")
public Order createOrder(OrderRequest request) {
    // ...
}
```

## Control de niveles de log en caliente

El endpoint `/actuator/loggers` permite ver y cambiar niveles de log sin reiniciar la aplicación. Esto es muy útil en producción para activar DEBUG temporalmente en un paquete específico mientras se investiga un problema.

Ver el nivel actual de un paquete:

```
GET /actuator/loggers/com.empresa.orders
```

```json
{
  "configuredLevel": "INFO",
  "effectiveLevel": "INFO"
}
```

Cambiar el nivel:

```
POST /actuator/loggers/com.empresa.orders
Content-Type: application/json

{ "configuredLevel": "DEBUG" }
```

Para restaurar al nivel configurado, envía `null` como valor.

## Seguridad de los endpoints

Exponer endpoints como `/actuator/env` o `/actuator/beans` en producción sin protección es un riesgo. Si tu aplicación ya usa Spring Security, puedes restringir el acceso:

```java
@Configuration
public class ActuatorSecurityConfig {

    @Bean
    public SecurityFilterChain actuatorSecurity(HttpSecurity http) throws Exception {
        http
            .securityMatcher("/actuator/**")
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .anyRequest().hasRole("ADMIN")
            )
            .httpBasic(Customizer.withDefaults());

        return http.build();
    }
}
```

Con esto, `health` e `info` son públicos (los necesita el load balancer), y el resto requiere autenticación con rol ADMIN.

Una estrategia alternativa es exponer Actuator en un puerto interno separado (`management.server.port`) y bloquearlo a nivel de red, permitiendo acceso solo desde la red interna del orquestador.

## Configuración recomendada para producción

```yaml
management:
  server:
    port: 8081
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus, loggers
      base-path: /actuator
  endpoint:
    health:
      show-details: when-authorized
      show-components: when-authorized
    loggers:
      enabled: true
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: ${spring.application.name}
      environment: ${spring.profiles.active}

info:
  app:
    name: ${spring.application.name}
    version: @project.version@
```

El tag `application` en las métricas permite filtrar por aplicación en Grafana cuando múltiples servicios envían métricas al mismo Prometheus.

## Conclusión

Spring Boot Actuator convierte cualquier aplicación en un sistema observable sin esfuerzo adicional. Con una dependencia obtienes health checks, métricas de la JVM, información del build, control de logs en caliente y la base para integrarse con cualquier stack de monitoreo.

El siguiente paso natural es conectar Prometheus + Grafana con los dashboards de JVM y HTTP de Micrometer para tener visibilidad completa del comportamiento de la aplicación en producción.
