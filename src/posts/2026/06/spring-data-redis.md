---
titulo: "Spring Data Redis: más allá de la caché"
seoTitulo: "Spring Data Redis: RedisTemplate, pub/sub, sorted sets y bloqueos distribuidos en Spring Boot"
fecha: "2026-06-30"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Spring Data Redis más allá de @Cacheable: operaciones directas con RedisTemplate, sorted sets, pub/sub, bloqueos distribuidos y repositorios Redis."
imagenPortada: "https://i.imgur.com/B9LJ6jO.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Redis", "Java", "Backend", "Caché", "Pub/Sub", "Distributed Systems"]
categoria: "tech"
keywords: "Spring Data Redis, RedisTemplate, Spring Boot Redis, sorted sets Redis Java, pub/sub Spring Redis, bloqueo distribuido Redis, RedisRepository, Lettuce Spring Boot, Redis rate limiting Java"
---

# Spring Data Redis: más allá de la caché

Redis es mucho más que un servidor de caché. Es una base de datos en memoria con estructuras de datos ricas: listas, conjuntos, sorted sets, hashes, streams y pub/sub. La mayoría de los tutoriales de Spring Boot muestran Redis únicamente a través de `@Cacheable`, pero eso es apenas la punta del iceberg.

Este artículo cubre el uso directo de Redis desde Spring Boot: `RedisTemplate` para operaciones de bajo nivel, sorted sets para rankings y leaderboards, el patrón pub/sub para mensajería ligera, repositorios Redis con `@RedisHash`, y bloqueos distribuidos para coordinar instancias.

## Dependencias y configuración

Agrega el starter de Redis en `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

Por defecto, Spring Boot usa **Lettuce** como cliente Redis (asíncrono, basado en Netty). Si prefieres **Jedis** (bloqueante, más simple), puedes excluir Lettuce y agregar Jedis:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
    <exclusions>
        <exclusion>
            <groupId>io.lettuce</groupId>
            <artifactId>lettuce-core</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
</dependency>
```

Para la mayoría de los casos, Lettuce es la mejor opción porque una sola conexión puede multiplexar múltiples peticiones concurrentes.

Configuración mínima en `application.yml`:

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}   # vacío si no tienes contraseña
      lettuce:
        pool:
          max-active: 10
          max-idle: 5
          min-idle: 1
```

Para desarrollo local, un contenedor Docker es suficiente:

```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

## RedisTemplate: la API de bajo nivel

`RedisTemplate` es la clase central para interactuar con Redis directamente. Spring Boot autoconfigura una instancia de `RedisTemplate<Object, Object>`, pero es más conveniente declarar una con tipos concretos:

```java
@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // Serializar claves como String
        template.setKeySerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());

        // Serializar valores como JSON
        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer();
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
```

La configuración de serializadores es crítica: sin ella, Redis almacena los valores con la serialización Java por defecto (binario ilegible y frágil). Con `GenericJackson2JsonRedisSerializer` los valores quedan como JSON legible en Redis.

### Operaciones básicas

`RedisTemplate` expone las operaciones de Redis a través de "ops" especializadas por tipo de estructura:

```java
@Service
@RequiredArgsConstructor
public class UserSessionService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final Duration SESSION_TTL = Duration.ofHours(2);

    // Guardar un valor con TTL
    public void saveSession(String sessionId, UserSession session) {
        String key = "session:" + sessionId;
        redisTemplate.opsForValue().set(key, session, SESSION_TTL);
    }

    // Leer un valor
    public UserSession getSession(String sessionId) {
        String key = "session:" + sessionId;
        return (UserSession) redisTemplate.opsForValue().get(key);
    }

    // Eliminar una clave
    public void deleteSession(String sessionId) {
        redisTemplate.delete("session:" + sessionId);
    }

    // Verificar si existe
    public boolean sessionExists(String sessionId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("session:" + sessionId));
    }

    // Extender el TTL
    public void refreshSession(String sessionId) {
        redisTemplate.expire("session:" + sessionId, SESSION_TTL);
    }
}
```

Nota el patrón de nombrado de claves `tipo:id` (por ejemplo, `session:abc123`). Redis no tiene namespaces, así que la convención de prefijos es la única forma de organizar claves.

### Operaciones atómicas

Redis ejecuta operaciones individuales de forma atómica. Para operaciones compuestas que deben ejecutarse como unidad, usa `execute` con una función que no sea interrumpida:

```java
// Incremento atómico — útil para contadores
public Long incrementLoginAttempts(String username) {
    String key = "login:attempts:" + username;
    Long attempts = redisTemplate.opsForValue().increment(key);
    // Establecer TTL solo la primera vez (cuando el valor pasa a 1)
    if (Long.valueOf(1).equals(attempts)) {
        redisTemplate.expire(key, Duration.ofMinutes(15));
    }
    return attempts;
}

// GETSET: obtener el valor anterior y establecer el nuevo, atómicamente
public Object getAndSet(String key, Object newValue) {
    return redisTemplate.opsForValue().getAndSet(key, newValue);
}
```

## Hashes: objetos parcialmente actualizables

Un hash Redis almacena múltiples campos bajo una sola clave, similar a un mapa. La ventaja sobre guardar un objeto JSON serializado es que puedes leer o actualizar campos individuales sin cargar el objeto completo.

```java
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final RedisTemplate<String, Object> redisTemplate;

    private String key(Long userId) {
        return "user:profile:" + userId;
    }

    // Guardar múltiples campos
    public void saveProfile(Long userId, String name, String email, String avatarUrl) {
        Map<String, Object> fields = Map.of(
                "name", name,
                "email", email,
                "avatarUrl", avatarUrl,
                "updatedAt", Instant.now().toString()
        );
        redisTemplate.opsForHash().putAll(key(userId), fields);
        redisTemplate.expire(key(userId), Duration.ofDays(7));
    }

    // Leer un campo individual sin cargar todo el hash
    public String getEmail(Long userId) {
        return (String) redisTemplate.opsForHash().get(key(userId), "email");
    }

    // Actualizar solo un campo
    public void updateAvatar(Long userId, String newAvatarUrl) {
        redisTemplate.opsForHash().put(key(userId), "avatarUrl", newAvatarUrl);
    }

    // Leer todo el hash
    public Map<Object, Object> getProfile(Long userId) {
        return redisTemplate.opsForHash().entries(key(userId));
    }
}
```

Los hashes son especialmente útiles para datos de usuario o sesión donde diferentes partes del sistema acceden a distintos campos.

## Sorted Sets: rankings y leaderboards

Un sorted set asocia cada miembro con una puntuación (`score`) numérica y mantiene los elementos ordenados. Es la estructura perfecta para leaderboards, colas de prioridad y rate limiting deslizante.

```java
@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String LEADERBOARD_KEY = "game:leaderboard";

    // Agregar o actualizar la puntuación de un jugador
    public void updateScore(String playerId, double score) {
        redisTemplate.opsForZSet().add(LEADERBOARD_KEY, playerId, score);
    }

    // Obtener los N mejores jugadores (orden descendente)
    public Set<ZSetOperations.TypedTuple<Object>> getTopPlayers(int n) {
        return redisTemplate.opsForZSet()
                .reverseRangeWithScores(LEADERBOARD_KEY, 0, n - 1);
    }

    // Obtener el ranking de un jugador (0-indexed, menor = mejor)
    public Long getPlayerRank(String playerId) {
        Long rank = redisTemplate.opsForZSet().reverseRank(LEADERBOARD_KEY, playerId);
        return rank != null ? rank + 1 : null; // Convertir a 1-indexed
    }

    // Obtener la puntuación de un jugador
    public Double getPlayerScore(String playerId) {
        return redisTemplate.opsForZSet().score(LEADERBOARD_KEY, playerId);
    }

    // Incrementar la puntuación (útil en juegos donde sumas puntos)
    public Double addPoints(String playerId, double points) {
        return redisTemplate.opsForZSet().incrementScore(LEADERBOARD_KEY, playerId, points);
    }
}
```

### Rate limiting con sorted set deslizante

Otra aplicación clásica de los sorted sets es implementar un limitador de tasa con ventana deslizante:

```java
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Devuelve true si la petición está permitida, false si el límite se superó.
     *
     * @param identifier  clave del cliente (IP, userId, API key...)
     * @param limit       máximo de peticiones permitidas en la ventana
     * @param windowMs    tamaño de la ventana en milisegundos
     */
    public boolean isAllowed(String identifier, int limit, long windowMs) {
        String key = "rate:" + identifier;
        long now = System.currentTimeMillis();
        long windowStart = now - windowMs;

        // Eliminar peticiones fuera de la ventana
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, windowStart);

        // Contar peticiones en la ventana actual
        Long count = redisTemplate.opsForZSet().zCard(key);
        if (count != null && count >= limit) {
            return false;
        }

        // Registrar la petición actual
        redisTemplate.opsForZSet().add(key, String.valueOf(now), now);
        redisTemplate.expire(key, Duration.ofMillis(windowMs));
        return true;
    }
}
```

A diferencia de un contador simple con TTL fijo, la ventana deslizante elimina peticiones antiguas en cada llamada, garantizando que el límite se aplica a los últimos N milisegundos exactos.

## Pub/Sub: mensajería ligera entre servicios

Redis pub/sub permite publicar mensajes en canales y recibir notificaciones en tiempo real. A diferencia de Kafka, no hay persistencia: si no hay consumidores conectados cuando llega el mensaje, se pierde. Úsalo para notificaciones efímeras, invalidación de caché coordinada o eventos de estado.

### Publicar mensajes

```java
@Service
@RequiredArgsConstructor
public class NotificationPublisher {

    private final RedisTemplate<String, Object> redisTemplate;

    public void publishUserUpdated(Long userId) {
        redisTemplate.convertAndSend("user.updated", userId.toString());
    }

    public void publishInventoryAlert(String productId, int stock) {
        Map<String, Object> message = Map.of(
                "productId", productId,
                "stock", stock,
                "timestamp", Instant.now().toString()
        );
        redisTemplate.convertAndSend("inventory.alert", message);
    }
}
```

### Suscribirse a canales

Define un `MessageListener` para procesar los mensajes:

```java
@Component
@Slf4j
public class UserUpdateListener implements MessageListener {

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String userId = new String(message.getBody());
        log.info("Usuario actualizado: {}", userId);
        // Invalida la caché local, notifica WebSocket clients, etc.
    }
}
```

Luego registra el listener en un `RedisMessageListenerContainer`:

```java
@Configuration
@RequiredArgsConstructor
public class RedisPubSubConfig {

    private final RedisConnectionFactory connectionFactory;
    private final UserUpdateListener userUpdateListener;

    @Bean
    public RedisMessageListenerContainer messageListenerContainer() {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);

        // Suscribirse a un canal exacto
        container.addMessageListener(userUpdateListener,
                new ChannelTopic("user.updated"));

        // Suscribirse a un patrón (acepta wildcards)
        container.addMessageListener(userUpdateListener,
                new PatternTopic("inventory.*"));

        return container;
    }
}
```

El `RedisMessageListenerContainer` gestiona la suscripción en un hilo separado; tus listeners se ejecutan en el pool de tareas que le configures (por defecto un `SimpleAsyncTaskExecutor`).

## Repositorios Redis con @RedisHash

Spring Data Redis incluye soporte para repositorios declarativos, similar a JPA pero persistiendo en Redis como hashes:

```java
@RedisHash(value = "Product", timeToLive = 3600) // TTL en segundos
public class ProductCache {

    @Id
    private String id;

    private String name;
    private BigDecimal price;
    private int stock;
    private String category;

    @Indexed  // Crea un índice secundario para búsquedas por este campo
    private String category;
}
```

```java
public interface ProductCacheRepository extends CrudRepository<ProductCache, String> {

    // Spring Data genera la implementación automáticamente
    List<ProductCache> findByCategory(String category);
}
```

```java
@Service
@RequiredArgsConstructor
public class ProductCacheService {

    private final ProductCacheRepository repository;

    public void cache(Product product) {
        ProductCache cached = new ProductCache();
        cached.setId(product.getId().toString());
        cached.setName(product.getName());
        cached.setPrice(product.getPrice());
        cached.setStock(product.getStock());
        cached.setCategory(product.getCategory());
        repository.save(cached);
    }

    public Optional<ProductCache> findById(String id) {
        return repository.findById(id);
    }

    public List<ProductCache> findByCategory(String category) {
        return repository.findByCategory(category);
    }
}
```

`@RedisHash` almacena cada objeto como un hash Redis con clave `Product:{id}`. `@Indexed` crea índices secundarios que permiten búsquedas por campo, aunque con un coste adicional en escritura y espacio.

## Bloqueos distribuidos

En un entorno con múltiples instancias de una misma aplicación, puede ser necesario que solo una instancia ejecute una tarea a la vez (por ejemplo, un job de mantenimiento o la generación de un ID único). Un bloqueo distribuido con Redis implementa este patrón.

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class DistributedLockService {

    private final StringRedisTemplate stringRedisTemplate;

    /**
     * Intenta adquirir un bloqueo con SET NX EX (atómico).
     * Devuelve true si el bloqueo se adquirió, false si ya está tomado.
     */
    public boolean tryLock(String lockName, String lockValue, Duration ttl) {
        Boolean acquired = stringRedisTemplate.opsForValue()
                .setIfAbsent("lock:" + lockName, lockValue, ttl);
        return Boolean.TRUE.equals(acquired);
    }

    /**
     * Libera el bloqueo solo si el valor coincide (evita liberar el bloqueo de otro proceso).
     */
    public boolean releaseLock(String lockName, String lockValue) {
        String key = "lock:" + lockName;
        String current = stringRedisTemplate.opsForValue().get(key);
        if (lockValue.equals(current)) {
            stringRedisTemplate.delete(key);
            return true;
        }
        return false;
    }
}
```

Uso en un job de mantenimiento:

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class MaintenanceJob {

    private final DistributedLockService lockService;

    @Scheduled(fixedDelay = 60_000)
    public void runCleanup() {
        String lockValue = UUID.randomUUID().toString(); // Identificador único de esta instancia
        boolean acquired = lockService.tryLock("cleanup-job", lockValue, Duration.ofSeconds(55));

        if (!acquired) {
            log.debug("Otra instancia ya está ejecutando el cleanup, omitiendo.");
            return;
        }

        try {
            log.info("Ejecutando cleanup...");
            // lógica de limpieza
        } finally {
            lockService.releaseLock("cleanup-job", lockValue);
        }
    }
}
```

El truco está en que `setIfAbsent` es atómico en Redis: solo el primero en ejecutarlo gana el bloqueo. El TTL garantiza que el bloqueo se libere incluso si la instancia que lo adquirió se cae antes de llamar a `releaseLock`.

Para casos de producción más robustos (especialmente en clusters Redis), considera usar **Redisson**, una librería que implementa el algoritmo Redlock y ofrece `RLock`, `RSemaphore` y otras primitivas de sincronización distribuida.

## Pipeline y operaciones en lote

Cuando necesitas ejecutar múltiples comandos Redis en secuencia, enviarlos de uno en uno implica una latencia de red por cada llamada. El **pipeline** agrupa los comandos y los envía en un solo viaje de red:

```java
public void saveMultipleSessions(Map<String, UserSession> sessions) {
    redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
        sessions.forEach((sessionId, session) -> {
            String key = "session:" + sessionId;
            byte[] keyBytes = key.getBytes();
            byte[] valueBytes = serialize(session); // tu lógica de serialización
            connection.stringCommands().setEx(keyBytes, 7200, valueBytes); // 2h en segundos
        });
        return null;
    });
}
```

El pipeline es especialmente valioso cuando insertas o lees cientos de claves: puede reducir el tiempo total en un orden de magnitud comparado con comandos individuales.

## Testing con Redis embebido

Para tests de integración sin depender de un Redis externo, usa `testcontainers` con el módulo de Redis:

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>redis</artifactId>
    <scope>test</scope>
</dependency>
```

```java
@SpringBootTest
@Testcontainers
class LeaderboardServiceTest {

    @Container
    static GenericContainer<?> redis =
            new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

    @DynamicPropertySource
    static void configureRedis(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
    }

    @Autowired
    private LeaderboardService leaderboardService;

    @Test
    void deberiaObtenerTopJugadores() {
        leaderboardService.updateScore("alice", 1500);
        leaderboardService.updateScore("bob", 2300);
        leaderboardService.updateScore("carol", 1800);

        var top = leaderboardService.getTopPlayers(2);

        assertThat(top).hasSize(2);
        assertThat(top.stream().map(t -> (String) t.getValue()))
                .containsExactly("bob", "carol");
    }
}
```

Testcontainers arranca un contenedor Redis real durante los tests y lo destruye al finalizar. Los tests son deterministas porque cada ejecución parte de un Redis limpio.

## Buenas prácticas

**Diseña las claves con prefijos significativos.** Usa el formato `entidad:id:campo` (`user:42:profile`, `session:abc123`). Esto facilita la búsqueda con el comando `SCAN` y evita colisiones entre módulos.

**Siempre establece TTL en datos temporales.** Redis puede configurarse para desalojar claves cuando la memoria se llena, pero es más predecible y seguro poner TTL explícito en sesiones, tokens y cualquier dato efímero. Las claves sin TTL pueden acumularse indefinidamente.

**No guardes objetos grandes serializados.** Si el objeto pesa varios kilobytes, considera si realmente necesitas cachearlo entero o si puedes cachear solo los campos frecuentemente consultados con un hash.

**Prefiere `StringRedisTemplate` para valores simples.** Si tus valores son cadenas (IDs, tokens, contadores), `StringRedisTemplate` es más simple y eficiente que `RedisTemplate<String, Object>` con Jackson.

**Cuidado con `KEYS` en producción.** El comando `KEYS *` bloquea el servidor Redis mientras escanea todas las claves. En producción, usa siempre `SCAN` en su lugar, que opera de forma incremental sin bloquear.

**Monitorea la memoria usada.** Redis es una base de datos en memoria. Configura `maxmemory` y una política de desalojo (`maxmemory-policy`) adecuada. `allkeys-lru` es una buena opción general para cachés; `noeviction` es adecuado cuando Redis almacena datos que no puedes perder.

## Conclusión

`@Cacheable` es la forma más rápida de empezar con Redis en Spring Boot, pero la verdadera potencia de Redis está en sus estructuras de datos nativas. `RedisTemplate` da acceso directo a sorted sets para rankings, hashes para objetos parcialmente actualizables, pub/sub para notificaciones efímeras y operaciones atómicas para bloqueos distribuidos y contadores.

La clave está en elegir la estructura adecuada para cada problema: un leaderboard encaja perfectamente en un sorted set, una sesión de usuario en un hash con TTL, un sistema de notificaciones en tiempo real en pub/sub. Redis no es solo caché; es un conjunto de herramientas de datos en memoria con garantías de atomicidad que resuelven problemas que serían complejos de implementar sobre una base de datos relacional.
