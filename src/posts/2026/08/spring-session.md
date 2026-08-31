---
titulo: "Sesiones distribuidas en Spring Boot con Spring Session"
seoTitulo: "Spring Session con Redis en Spring Boot: guía completa de sesiones distribuidas"
fecha: "2026-09-01"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a gestionar sesiones HTTP distribuidas en Spring Boot con Spring Session y Redis: configuración, persistencia, seguridad, expiración y consideraciones para entornos de múltiples instancias."
imagenPortada: "https://i.imgur.com/c8xZ3zy.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Session", "Redis", "Java", "Seguridad", "Backend"]
categoria: "tech"
keywords: "spring session redis spring boot, spring session distribuida, sesiones http spring boot, spring session configuracion, spring session redis ejemplo, HttpSession spring boot redis, spring session seguridad, sesiones distribuidas java, spring boot clustered sessions, spring session jdbc"
---

# Sesiones distribuidas en Spring Boot con Spring Session

Una aplicación que corre en una sola instancia puede guardar la sesión de usuario en memoria sin mayor problema. En cuanto se añade una segunda instancia —ya sea por escalado horizontal o por un reinicio del proceso— el problema aparece de inmediato: el usuario que inició sesión en la instancia A se conecta a la instancia B y, para ella, es un desconocido. El balanceador de carga puede mitigar esto con *sticky sessions*, pero esa solución tiene sus propios costos: pierde la distribución uniforme de carga, complica los despliegues *blue-green* y el fallo de una instancia invalida las sesiones de todos los usuarios que tenía asignados.

**Spring Session** resuelve el problema en su raíz: saca el almacenamiento de sesiones del proceso y lo lleva a un store externo compartido —Redis, JDBC o Hazelcast— de modo que cualquier instancia de la aplicación puede leer y escribir la sesión de cualquier usuario. El balanceador de carga deja de necesitar stickiness y los despliegues se vuelven transparentes para el usuario.

## Cómo funciona

Spring Session reemplaza el `HttpSession` estándar de Servlet con una implementación propia que delega el almacenamiento al store configurado. El reemplazo es transparente: el código de aplicación sigue usando `HttpSession` con exactamente la misma API, y Spring Session intercepta las llamadas antes de que lleguen al contenedor.

El mecanismo de interceptación varía según el entorno:

- En aplicaciones Servlet tradicionales y Spring MVC se registra un `SessionRepositoryFilter` que envuelve la request original.
- En Spring WebFlux se usa `WebSessionStore` con el mismo propósito.

Desde el punto de vista del código de aplicación —controladores, servicios, filtros de seguridad— el cambio es invisible.

## Configuración con Redis

Redis es la opción más común: es extremadamente rápido para lecturas y escrituras de clave-valor, soporte TTL nativo por clave (ideal para expiración de sesiones) y tiene amplio soporte operativo.

### Dependencias

```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

Spring Boot gestiona las versiones a través del BOM, por lo que no es necesario especificar versiones manualmente.

### Configuración en `application.yml`

```yaml
spring:
  session:
    store-type: redis
    timeout: 30m           # duración máxima de inactividad
    redis:
      namespace: myapp     # prefijo de las claves en Redis (evita colisiones entre apps)
      flush-mode: on-save  # escribe en Redis solo cuando la sesión se modifica
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}
      timeout: 2000ms
      lettuce:
        pool:
          max-active: 16
          max-idle: 8
          min-idle: 2
```

Con solo esta configuración, Spring Boot autoconfigura `RedisIndexedSessionRepository` y registra el `SessionRepositoryFilter`. No es necesaria ninguna clase adicional.

`flush-mode: on-save` es el valor recomendado para la mayoría de las aplicaciones: la sesión se serializa y escribe en Redis solo cuando se modifica durante la request. El valor alternativo `immediate` sincroniza cada atributo en el momento en que se establece, lo que garantiza consistencia a costa de más llamadas a Redis.

### Conexión a Redis con SSL en producción

```yaml
spring:
  data:
    redis:
      host: redis.prod.internal
      port: 6380
      ssl:
        enabled: true
      password: ${REDIS_PASSWORD}
      lettuce:
        pool:
          max-active: 32
```

Redis sin TLS es aceptable en redes privadas aisladas, pero cualquier despliegue que atraviese redes no confiables debe usar TLS.

## Uso desde el código de aplicación

El código de aplicación no cambia respecto a la API estándar de `HttpSession`:

```java
@RestController
@RequestMapping("/api/carrito")
@RequiredArgsConstructor
public class CarritoController {

    @PostMapping("/items")
    public ResponseEntity<CarritoResponse> agregarItem(
            HttpSession session,
            @RequestBody ItemRequest item) {

        @SuppressWarnings("unchecked")
        List<ItemCarrito> carrito = (List<ItemCarrito>)
            session.getAttribute("carrito");

        if (carrito == null) {
            carrito = new ArrayList<>();
        }
        carrito.add(new ItemCarrito(item.productoId(), item.cantidad()));
        session.setAttribute("carrito", carrito);

        return ResponseEntity.ok(new CarritoResponse(carrito));
    }

    @GetMapping
    public ResponseEntity<CarritoResponse> obtenerCarrito(HttpSession session) {
        @SuppressWarnings("unchecked")
        List<ItemCarrito> carrito = (List<ItemCarrito>)
            session.getAttribute("carrito");
        return ResponseEntity.ok(
            new CarritoResponse(carrito != null ? carrito : List.of())
        );
    }

    @DeleteMapping
    public ResponseEntity<Void> vaciarCarrito(HttpSession session) {
        session.invalidate();
        return ResponseEntity.noContent().build();
    }
}
```

Spring Session intercepta `getAttribute`, `setAttribute` e `invalidate` y los delega a Redis. El desarrollador no interactúa directamente con Redis en ningún momento.

### Serializabilidad de los atributos

Todos los objetos guardados en sesión deben ser serializables. Spring Session usa por defecto `JdkSerializationRedisSerializer`, que requiere que las clases implementen `java.io.Serializable`. Si se prefiere JSON (más legible en Redis y más robusto ante cambios de versión), se puede configurar explícitamente:

```java
@Configuration
public class SessionConfig {

    @Bean
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        return new GenericJackson2JsonRedisSerializer();
    }
}
```

Con esta configuración, los atributos de sesión se almacenan como JSON en Redis. Ventaja: se pueden inspeccionar con `redis-cli` sin necesidad de deserialización. Desventaja: requiere que Jackson pueda serializar y deserializar los objetos, incluida la información de tipo.

## Integración con Spring Security

Spring Session y Spring Security se integran de forma natural. Spring Security almacena el contexto de autenticación (`SecurityContext`) en la sesión, y Spring Session lo persiste automáticamente en Redis. No se requiere configuración adicional para que funcione.

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .anyRequest().authenticated()
            )
            .formLogin(form -> form
                .loginProcessingUrl("/api/auth/login")
                .successHandler(authSuccessHandler())
                .failureHandler(authFailureHandler())
            )
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .invalidateHttpSession(true)     // invalida la sesión en Redis al hacer logout
                .deleteCookies("SESSION")        // elimina la cookie de sesión del cliente
            )
            .sessionManagement(session -> session
                .maximumSessions(3)              // máximo 3 sesiones simultáneas por usuario
                .maxSessionsPreventsLogin(false) // la nueva sesión expulsa la más antigua
            )
            .build();
    }
}
```

`maximumSessions(3)` usa `SpringSessionBackedSessionRegistry` internamente cuando Spring Session está activo, lo que hace que el conteo de sesiones sea correcto incluso con múltiples instancias. Sin Spring Session, el conteo es por instancia y completamente inaccurate en entornos clusterizados.

### Invalidación de sesiones en tiempo real

Spring Session con Redis permite encontrar e invalidar sesiones activas de un usuario específico. Esto es útil para implementar "cerrar todas las sesiones" o para invalidar la sesión de un usuario cuya cuenta ha sido suspendida:

```java
@Service
@RequiredArgsConstructor
public class SessionAdminService {

    private final FindByIndexNameSessionRepository<? extends Session> sessionRepository;

    public void cerrarTodasLasSesiones(String username) {
        Map<String, ? extends Session> sesiones =
            sessionRepository.findByPrincipalName(username);

        sesiones.forEach((sessionId, session) -> {
            sessionRepository.deleteById(sessionId);
        });
    }

    public int contarSesionesActivas(String username) {
        return sessionRepository.findByPrincipalName(username).size();
    }
}
```

`findByPrincipalName` funciona porque Spring Session mantiene un índice secundario en Redis que mapea el nombre del usuario a sus IDs de sesión. Este índice se actualiza automáticamente al guardar la autenticación en la sesión.

## Configuración de la cookie de sesión

Por defecto, Spring Session usa una cookie llamada `SESSION` (en lugar de `JSESSIONID`). Los atributos de la cookie se configuran con `CookieSerializer`:

```java
@Bean
public CookieSerializer cookieSerializer() {
    DefaultCookieSerializer serializer = new DefaultCookieSerializer();
    serializer.setCookieName("SESSION");
    serializer.setCookiePath("/");
    serializer.setDomainNamePattern("^.+?\\.(\\w+\\.[a-z]+)$"); // ej: .miapp.com
    serializer.setCookieMaxAge(1800);      // 30 minutos en segundos
    serializer.setUseHttpOnlyCookie(true); // no accesible desde JavaScript
    serializer.setUseSecureCookie(true);   // solo HTTPS
    serializer.setSameSite("Lax");         // protección básica contra CSRF
    return serializer;
}
```

`HttpOnly` y `Secure` son obligatorios en producción. `SameSite=Lax` proporciona protección contra ataques CSRF para la mayoría de los casos sin romper flujos de navegación normales. Si la aplicación usa OAuth2 y necesita recibir la sesión en requests cross-site, puede ser necesario ajustar a `None` (con `Secure` obligatorio).

## Sesiones sin cookies: header-based sessions

En APIs consumidas por clientes móviles o SPAs que gestionan la autenticación de forma programática, puede ser preferible transmitir el ID de sesión en un header HTTP en lugar de una cookie. Spring Session lo soporta con `HeaderHttpSessionIdResolver`:

```java
@Bean
public HttpSessionIdResolver httpSessionIdResolver() {
    return HeaderHttpSessionIdResolver.xAuthToken();
}
```

Con esta configuración, el cliente debe incluir el header `X-Auth-Token` con el ID de sesión en cada request. El servidor devuelve el ID de sesión en el header de la respuesta al crear la sesión. Este enfoque elimina la dependencia de cookies y funciona bien con clientes que no gestionan cookies automáticamente.

## Configuración alternativa: JDBC

Si el stack no incluye Redis, Spring Session puede usar una base de datos relacional como store:

```xml
<dependency>
    <groupId>org.springframework.session</groupId>
    <artifactId>spring-session-jdbc</artifactId>
</dependency>
```

```yaml
spring:
  session:
    store-type: jdbc
    jdbc:
      initialize-schema: always   # crea las tablas SPRING_SESSION automáticamente
      table-name: SPRING_SESSION
    timeout: 30m
```

Spring Session JDBC crea dos tablas: `SPRING_SESSION` (datos de sesión) y `SPRING_SESSION_ATTRIBUTES` (atributos individuales). La limpieza de sesiones expiradas se ejecuta mediante un `@Scheduled` configurable con `spring.session.jdbc.cleanup-cron`.

JDBC es considerablemente más lento que Redis para operaciones de sesión (cada lectura implica un SELECT, cada escritura un UPDATE o INSERT), pero es válido para aplicaciones con tráfico moderado que quieren evitar añadir Redis a su infraestructura.

## Expiración y eventos

Spring Session publica eventos cuando una sesión expira o se elimina. Estos eventos pueden usarse para limpiar recursos asociados o para auditoría:

```java
@Component
@Slf4j
public class SessionEventListener {

    @EventListener
    public void onSessionExpired(SessionExpiredEvent event) {
        String sessionId = event.getSessionId();
        log.info("Sesión expirada: {}", sessionId);
        // Liberar recursos, notificar al sistema de presencia online, etc.
    }

    @EventListener
    public void onSessionDeleted(SessionDeletedEvent event) {
        String sessionId = event.getSessionId();
        log.info("Sesión eliminada (logout): {}", sessionId);
    }
}
```

Para que los eventos de expiración funcionen con Redis, Spring Session necesita que el servidor Redis tenga habilitadas las notificaciones de keyspace. Spring Session con `spring-session-data-redis` lo configura automáticamente al iniciar si la propiedad `spring.session.redis.configure-action` no está en `none`.

## Monitorización con Spring Boot Actuator

Si Actuator está en el classpath, Spring Session expone métricas sobre el número de sesiones activas y el tiempo de respuesta del store. Las métricas aparecen bajo `session.*` en el endpoint `/actuator/metrics`. Para ver el número de sesiones activas:

```
GET /actuator/metrics/session.active.count
```

En Grafana o cualquier sistema de métricas compatible con Micrometer, estas métricas permiten detectar picos inusuales de creación de sesiones, fugas (sesiones que no expiran correctamente) o degradación del store.

## Consideraciones de producción

**Tamaño de sesión.** Cada atributo de sesión se serializa y se guarda en Redis. Guardar objetos grandes o colecciones extensas incrementa el tiempo de serialización y el ancho de banda entre la aplicación y Redis. El principio de sesión mínima aplica aquí: guarda solo lo indispensable —el ID de usuario, roles, preferencias ligeras— y recarga el resto desde la base de datos cuando sea necesario.

**Conexión a Redis.** Un pool de conexiones bien dimensionado es crítico. Si el pool se agota (todas las conexiones están en uso), las requests que necesiten leer o escribir sesión esperarán hasta que haya una conexión disponible o hasta que expire el timeout. Monitoriza el uso del pool con las métricas de Lettuce y ajusta `max-active` según el throughput esperado.

**Redis como punto único de fallo.** Si Redis no está disponible, Spring Session no puede leer ni escribir sesiones y las requests autenticadas fallan. Redis Sentinel o Redis Cluster resuelven la alta disponibilidad a nivel de infraestructura. A nivel de aplicación, define un `timeout` razonable en el cliente Redis y activa alertas cuando el tiempo de respuesta de Redis se degrada.

**Rotación de claves de sesión.** Tras un cambio de privilegios del usuario (elevación de permisos, cambio de contraseña, revocación de acceso), invalida la sesión actual y crea una nueva. Mantener la misma sesión después de un cambio de privilegios es un vector de *session fixation* conocido. Spring Security lo hace automáticamente en el login, pero no en cambios de privilegios en caliente; esa lógica debe implementarse explícitamente con `session.invalidate()` seguido de una nueva autenticación.

## Cuándo usar Spring Session (y cuándo no)

Spring Session es la herramienta correcta cuando:

- La aplicación escala horizontalmente y la sesión debe compartirse entre instancias.
- Se necesita invalidación centralizada de sesiones (por administración o por cambios de seguridad).
- Se requiere control de sesiones concurrentes por usuario en un entorno clusterizado.
- El modelo de autenticación es sesión basada en cookies y no hay intención de migrar a tokens stateless.

No es la herramienta correcta cuando:

- La API es puramente stateless y usa JWT u otro mecanismo de token. En ese caso, no hay sesión que gestionar y Spring Session solo añade complejidad innecesaria.
- La aplicación corre en una sola instancia sin planes de escalar. El overhead de Redis no compensa si no hay problema de consistencia entre instancias.

## Conclusión

Spring Session desacopla el almacenamiento de sesiones del proceso de aplicación con un cambio de configuración mínimo. El código de aplicación y de seguridad no se modifica: el `HttpSession` y la integración con Spring Security funcionan exactamente igual, pero ahora la sesión vive en Redis y es accesible desde cualquier instancia del servicio.

El resultado práctico es que el escalado horizontal deja de ser una fuente de problemas de sesión, los despliegues pueden ser *rolling* sin invalidar sesiones de usuarios activos, y la administración de sesiones —expiración, invalidación por usuario, conteo de sesiones activas— se vuelve posible y consistente en entornos con múltiples réplicas.
