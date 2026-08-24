---
titulo: "Estrategias de caché: diseñar sistemas que escalan sin explotar la base de datos"
seoTitulo: "Estrategias de caché en Java y Spring Boot: cache-aside, write-through, write-behind y stampede"
fecha: "2026-08-25"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Una guía exhaustiva sobre estrategias de caché —cache-aside, read-through, write-through, write-behind— y los problemas clásicos de invalidación, stampede y consistencia, implementados con Java y Spring Boot."
imagenPortada: "https://i.imgur.com/pDE3lG9.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java", "Caching", "Redis", "Architecture", "Backend", "Performance"]
categoria: "tech"
keywords: "estrategias de caché, cache-aside, read-through, write-through, write-behind, invalidación de caché, cache stampede, TTL, Redis, Spring Boot, caché distribuida, consistencia eventual, caché warming, thundering herd, Java"
---

# Estrategias de caché: diseñar sistemas que escalan sin explotar la base de datos

Hay una frase atribuida a Phil Karlton que los ingenieros de software repetimos con una mezcla de humor y resignación: *"There are only two hard things in Computer Science: cache invalidation and naming things."* Décadas después, sigue siendo cierta. La caché es la herramienta más potente que tenemos para mejorar la latencia y reducir la carga en los sistemas de backend. También es la fuente más común de bugs sutiles en producción: datos obsoletos que se sirven como si fueran frescos, stampedes que colapsan la base de datos exactamente cuando más la necesitamos, e inconsistencias que tardan horas en manifestarse y días en diagnosticarse.

Entender las estrategias de caché no es solo saber usar `@Cacheable` de Spring. Es entender qué promesas de consistencia ofrece cada patrón, qué fallos introduce y en qué contextos cada uno es la elección correcta. Este artículo recorre las estrategias fundamentales con implementaciones concretas en Java y Spring Boot usando Redis como store distribuido.

## Dependencias

Para los ejemplos de este artículo necesitas las dependencias de Spring Data Redis y Jackson para serialización:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
</dependency>
```

Y la configuración básica de Redis en `application.yml`:

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 500ms
      lettuce:
        pool:
          max-active: 20
          max-idle: 10
```

## Cache-aside (lazy loading)

El cache-aside es el patrón más común y el punto de partida para casi cualquier sistema que añade caché. La lógica es responsabilidad de la aplicación: cuando llega una petición de datos, la aplicación verifica primero si el dato existe en caché. Si existe (**cache hit**), lo devuelve directamente. Si no existe (**cache miss**), lo lee de la base de datos, lo almacena en caché para futuras peticiones y lo devuelve al cliente.

```
Petición
   │
   ▼
¿Existe en caché?
   │           │
  Sí           No
   │           │
   ▼           ▼
Devolver    Leer de BD
  dato          │
               ▼
           Guardar en caché
               │
               ▼
           Devolver dato
```

```java
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;

@Repository
public class UserCacheAsideRepository {

    private static final Duration TTL = Duration.ofMinutes(5);
    private static final String KEY_PREFIX = "user:";

    private final StringRedisTemplate redis;
    private final UserJpaRepository jpa;
    private final ObjectMapper objectMapper;

    public UserCacheAsideRepository(StringRedisTemplate redis,
                                    UserJpaRepository jpa,
                                    ObjectMapper objectMapper) {
        this.redis = redis;
        this.jpa = jpa;
        this.objectMapper = objectMapper;
    }

    public Optional<UserDto> findById(Long userId) {
        String key = KEY_PREFIX + userId;

        // 1. Intentar leer desde caché
        String cached = redis.opsForValue().get(key);
        if (cached != null) {
            return Optional.of(deserialize(cached, UserDto.class));
        }

        // 2. Cache miss: leer desde la base de datos
        Optional<UserDto> user = jpa.findById(userId).map(UserDto::from);

        // 3. Poblar la caché para futuras peticiones
        user.ifPresent(u -> redis.opsForValue().set(key, serialize(u), TTL));
        return user;
    }

    public UserDto update(Long userId, UpdateUserRequest request) {
        UserEntity updated = jpa.findById(userId)
                .map(u -> {
                    u.setName(request.name());
                    u.setEmail(request.email());
                    return jpa.save(u);
                })
                .orElseThrow(() -> new UserNotFoundException(userId));

        // Invalidar la caché — la próxima lectura cargará el dato fresco
        redis.delete(KEY_PREFIX + userId);
        return UserDto.from(updated);
    }

    private String serialize(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new CacheSerializationException(e);
        }
    }

    private <T> T deserialize(String json, Class<T> type) {
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            throw new CacheSerializationException(e);
        }
    }
}
```

La gran ventaja del cache-aside es su resiliencia. Si Redis falla o está caído, la aplicación simplemente lee de la base de datos. El rendimiento se degrada, pero el sistema sigue funcionando. Además, solo se cachean los datos que realmente se solicitan: no hay desperdicio de memoria en datos que nadie lee.

El cache-aside es la opción por defecto para datos de lectura intensiva que cambian con poca frecuencia: perfiles de usuario, configuraciones, catálogos de productos y resultados de queries complejas.

## Write-through

En write-through, cada escritura se hace **simultáneamente en la caché y en la base de datos**. No hay invalidación: cuando los datos se actualizan, la caché refleja inmediatamente el nuevo valor.

```
Aplicación ──── escribir ───► Caché
                                 │
                          Escribir en BD
                                 │
                           Confirmar
```

```java
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

@Service
public class WriteThroughUserService {

    private static final Duration TTL = Duration.ofHours(1);
    private static final String KEY_PREFIX = "user:";

    private final StringRedisTemplate redis;
    private final UserJpaRepository jpa;
    private final ObjectMapper objectMapper;

    // constructor omitido por brevedad

    @Transactional
    public UserDto createUser(CreateUserRequest request) {
        // 1. Persistir en la base de datos primero
        UserEntity entity = new UserEntity();
        entity.setName(request.name());
        entity.setEmail(request.email());
        UserEntity saved = jpa.save(entity);

        UserDto dto = UserDto.from(saved);

        // 2. Escribir inmediatamente en la caché (no invalidar, sino poblar)
        redis.opsForValue().set(KEY_PREFIX + saved.getId(), serialize(dto), TTL);
        return dto;
    }

    @Transactional
    public UserDto updateUser(Long userId, UpdateUserRequest request) {
        UserEntity entity = jpa.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));

        entity.setName(request.name());
        entity.setEmail(request.email());
        UserEntity updated = jpa.save(entity);

        UserDto dto = UserDto.from(updated);

        // Sobrescribir en caché — no se invalida, se actualiza directamente
        redis.opsForValue().set(KEY_PREFIX + userId, serialize(dto), TTL);
        return dto;
    }
}
```

La ventaja del write-through es la **consistencia inmediata**: la caché siempre tiene el dato más reciente después de una escritura, sin ventanas de stale. El precio es que cada escritura implica dos operaciones (caché + BD) en el camino crítico, aumentando la latencia de escritura.

Write-through es la estrategia correcta cuando la consistencia de lectura es crítica: sistemas de inventario, balances de cuentas, configuración de producción, o cualquier dominio donde servir un dato obsoleto tiene consecuencias reales.

## Write-behind (write-back)

El write-behind lleva la lógica un paso más allá: las escrituras se confirman en la **caché inmediatamente** y se propagan a la base de datos de forma **asíncrona**, en diferido. La aplicación recibe confirmación tan pronto como la caché acepta la operación, sin esperar a que la base de datos la persista.

```
Aplicación ──── escribir ───► Caché
                                 │
                        Confirmar (inmediato)
                                 │
                    (segundo plano, asíncrono)
                                 │
                          Escribir en BD
```

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;

@Service
public class WriteBehindMetricsService {

    private static final String DIRTY_SET_KEY = "dirty:user-metrics";
    private static final String METRICS_PREFIX = "metrics:user:";
    private static final Duration TTL = Duration.ofHours(2);

    private final StringRedisTemplate redis;
    private final UserMetricsJpaRepository jpa;
    private final ObjectMapper objectMapper;

    // constructor omitido

    /**
     * Registra una acción del usuario: se escribe en Redis inmediatamente.
     * La BD se actualiza en diferido por el flush periódico.
     */
    public void recordAction(Long userId, String actionType) {
        String key = METRICS_PREFIX + userId;

        // Actualizar contador en Redis de forma atómica
        redis.opsForHash().increment(key, actionType, 1);
        redis.expire(key, TTL);

        // Marcar como pendiente de persistir
        redis.opsForSet().add(DIRTY_SET_KEY, userId.toString());
    }

    /**
     * Flush periódico: persiste las métricas dirty en la BD cada 10 segundos.
     */
    @Scheduled(fixedDelay = 10_000)
    @Async
    public void flushPendingToBatch() {
        Set<String> dirtyUserIds = redis.opsForSet().members(DIRTY_SET_KEY);
        if (dirtyUserIds == null || dirtyUserIds.isEmpty()) return;

        for (String userIdStr : dirtyUserIds) {
            Long userId = Long.parseLong(userIdStr);
            String key = METRICS_PREFIX + userId;

            try {
                var entries = redis.opsForHash().entries(key);
                if (!entries.isEmpty()) {
                    // Upsert en BD
                    jpa.upsertMetrics(userId, entries);
                    // Limpiar del set dirty solo si la persistencia fue exitosa
                    redis.opsForSet().remove(DIRTY_SET_KEY, userIdStr);
                }
            } catch (Exception e) {
                // No eliminar del dirty set: se reintentará en el próximo ciclo
                log.error("Error al persistir métricas del usuario {}: {}", userId, e.getMessage());
            }
        }
    }
}
```

El write-behind es potente pero introduce el riesgo más severo: si Redis falla antes de que los datos se persistan, **se pierden escrituras**. Por eso, está reservado para casos donde una pequeña pérdida de datos es aceptable: contadores de métricas, registros de actividad, actualizaciones de posición en tiempo real, o carritos de compra donde perder la última adición es un inconveniente menor frente al costo de persistir cada cambio síncronamente.

## Token bucket en caché: limitación de escrituras masivas

Cuando se combina write-behind con un mecanismo de token bucket, es posible controlar la tasa de flush hacia la base de datos y evitar ráfagas de escrituras que la saturen. La idea es sencilla: el flush consume tokens; si no hay tokens disponibles, las escrituras se acumulan en Redis hasta el próximo ciclo.

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class RateLimitedFlushService {

    // Script Lua para que la operación sea atómica en Redis
    private static final String TOKEN_BUCKET_SCRIPT = """
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local refill_rate = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])
        
        local data = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(data[1]) or capacity
        local last_refill = tonumber(data[2]) or now
        
        local elapsed = now - last_refill
        local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)
        
        if new_tokens < requested then
            redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)
            return 0
        end
        
        redis.call('HMSET', key, 'tokens', new_tokens - requested, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)
        return 1
        """;

    private final StringRedisTemplate redis;
    private final DefaultRedisScript<Long> tokenScript;

    public RateLimitedFlushService(StringRedisTemplate redis) {
        this.redis = redis;
        this.tokenScript = new DefaultRedisScript<>(TOKEN_BUCKET_SCRIPT, Long.class);
    }

    public boolean tryAcquireFlushToken(int tokensNeeded) {
        double now = Instant.now().toEpochMilli() / 1000.0;
        Long result = redis.execute(
                tokenScript,
                List.of("flush:token-bucket"),
                String.valueOf(now),
                "100",   // capacity: máximo 100 registros por ciclo
                "10.0",  // refill_rate: 10 tokens/segundo
                String.valueOf(tokensNeeded)
        );
        return result != null && result == 1L;
    }
}
```

## Invalidación: el verdadero problema difícil

Las estrategias anteriores describen cómo se pobla la caché. Pero el problema que Karlton tenía en mente es la **invalidación**: cómo y cuándo se marca como obsoleto un dato en caché cuando la fuente de verdad cambia.

### TTL (Time To Live)

El más simple: cada entrada tiene un tiempo de expiración. Pasado ese tiempo, Redis la elimina automáticamente.

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class TtlCacheExample {

    private final StringRedisTemplate redis;

    public TtlCacheExample(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void cacheWithContextualTtl(String entityType, Long id, String json) {
        String key = entityType + ":" + id;
        Duration ttl = switch (entityType) {
            case "stock"        -> Duration.ofSeconds(30);   // cambia frecuentemente
            case "product"      -> Duration.ofMinutes(15);   // estable
            case "config"       -> Duration.ofHours(1);      // muy estable
            case "translation"  -> Duration.ofDays(7);       // casi nunca cambia
            default             -> Duration.ofMinutes(5);
        };
        redis.opsForValue().set(key, json, ttl);
    }
}
```

El TTL es el mecanismo de invalidación más barato de implementar y operar. La contrapartida es que acepta datos obsoletos durante el período de vida de la entrada. La elección del TTL es un trade-off entre **frescura** (TTL corto) y **eficiencia** (TTL largo).

### Invalidación explícita por evento

La aplicación invalida activamente las entradas de caché cuando sabe que los datos han cambiado. Una forma limpia de implementarlo en Spring es con eventos de dominio:

```java
import org.springframework.context.ApplicationEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

// Evento de dominio
public class ProductUpdatedEvent extends ApplicationEvent {
    private final Long productId;
    private final Long categoryId;

    public ProductUpdatedEvent(Object source, Long productId, Long categoryId) {
        super(source);
        this.productId = productId;
        this.categoryId = categoryId;
    }

    public Long getProductId() { return productId; }
    public Long getCategoryId() { return categoryId; }
}

// Servicio que publica el evento tras la escritura
@Service
public class ProductService {

    private final ProductJpaRepository jpa;
    private final ApplicationEventPublisher eventPublisher;

    public ProductService(ProductJpaRepository jpa, ApplicationEventPublisher eventPublisher) {
        this.jpa = jpa;
        this.eventPublisher = eventPublisher;
    }

    public ProductDto updatePrice(Long productId, UpdatePriceRequest request) {
        ProductEntity product = jpa.findById(productId)
                .orElseThrow(() -> new ProductNotFoundException(productId));

        product.setPrice(request.newPrice());
        ProductEntity saved = jpa.save(product);

        // Publicar evento para que la caché se invalide de forma desacoplada
        eventPublisher.publishEvent(
                new ProductUpdatedEvent(this, productId, saved.getCategoryId()));

        return ProductDto.from(saved);
    }
}

// Listener que gestiona la invalidación de caché
@Component
public class ProductCacheInvalidationListener {

    private final StringRedisTemplate redis;

    public ProductCacheInvalidationListener(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Async
    @EventListener
    public void onProductUpdated(ProductUpdatedEvent event) {
        // Invalida el producto específico
        redis.delete("product:" + event.getProductId());

        // Invalida la lista de la categoría (puede contener el precio)
        redis.delete("catalog:category:" + event.getCategoryId());

        // Invalida la página del catálogo general
        redis.delete("catalog:all");
    }
}
```

La invalidación basada en eventos desacopla la capa de escritura de la capa de caché: el servicio que escribe no necesita conocer qué cachés existen; solo publica lo que ocurrió. Los listeners deciden qué invalidar. Esto escala bien cuando múltiples servicios escriben los mismos datos.

### Versionado de caché

Una variante elegante para invalidaciones masivas: en lugar de borrar entradas específicas, se incrementa un número de versión global. Todas las claves incluyen ese número y las entradas de la versión anterior se convierten en misses automáticamente.

```java
@Component
public class VersionedCache {

    private static final String VERSION_KEY = "cache:global-version";

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public VersionedCache(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    public String buildKey(String entity, Long id) {
        String version = redis.opsForValue().get(VERSION_KEY);
        if (version == null) version = "1";
        return "v%s:%s:%d".formatted(version, entity, id);
    }

    /**
     * Invalida toda la caché de forma atómica.
     * Las entradas antiguas se limpiarán solas por TTL.
     */
    public void invalidateAll() {
        redis.opsForValue().increment(VERSION_KEY);
    }
}
```

Este enfoque es ideal para cambios de esquema, despliegues, o actualizaciones de configuración global: invalida todo de forma atómica sin necesidad de borrar claves individualmente.

## Cache stampede (thundering herd)

El cache stampede es uno de los problemas más insidiosos del caching. Ocurre cuando una entrada de caché expira y simultáneamente llegan múltiples peticiones que producen misses. Todas van a la base de datos al mismo tiempo, generando una ráfaga concentrada justo cuando el sistema tiene menos capacidad para manejarla.

```
t=0: TTL expira para "product:popular-123"
t=0: Petición 1 → miss → consulta BD
t=0: Petición 2 → miss → consulta BD
...
t=0: Petición 500 → miss → consulta BD

→ 500 queries simultáneas para el mismo dato
→ La BD colapsa o ralentiza
→ Latencias altas → más reintentos → el problema se amplifica
```

### Mutex con Redis

La solución mutex asegura que solo una petición de entre todas las que tienen un miss va a la base de datos. Las demás esperan:

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

@Component
public class StampedeProtectedCache {

    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    private static final Duration RETRY_WAIT = Duration.ofMillis(50);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public StampedeProtectedCache(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    public <T> Optional<T> getWithMutex(String key, Supplier<Optional<T>> loader,
                                         Class<T> type, Duration ttl) {
        // 1. Intentar leer desde caché
        String cached = redis.opsForValue().get(key);
        if (cached != null) {
            return Optional.of(deserialize(cached, type));
        }

        String lockKey = "lock:" + key;
        String lockValue = UUID.randomUUID().toString();

        // 2. Intentar adquirir el lock (SET NX EX es atómico en Redis)
        Boolean acquired = redis.opsForValue().setIfAbsent(lockKey, lockValue, LOCK_TTL);

        if (Boolean.TRUE.equals(acquired)) {
            try {
                // 3. Solo este hilo carga el dato desde la BD
                Optional<T> value = loader.get();
                value.ifPresent(v -> redis.opsForValue().set(key, serialize(v), ttl));
                return value;
            } finally {
                // Liberar el lock solo si sigue siendo nuestro
                String currentLockValue = redis.opsForValue().get(lockKey);
                if (lockValue.equals(currentLockValue)) {
                    redis.delete(lockKey);
                }
            }
        } else {
            // 4. Otro hilo está cargando el dato; esperar y reintentar
            try {
                Thread.sleep(RETRY_WAIT.toMillis());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return getWithMutex(key, loader, type, ttl);
        }
    }

    private String serialize(Object obj) { /* ... */ return ""; }
    private <T> T deserialize(String json, Class<T> type) { /* ... */ return null; }
}
```

### Stale-while-revalidate

El patrón stale-while-revalidate sirve el dato de caché aunque haya "expirado" mientras en segundo plano se recarga el dato fresco. El cliente nunca espera por la recarga:

```java
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.function.Supplier;

@Component
public class StaleWhileRevalidateCache {

    /**
     * La clave de frescura (freshness key) expira según el TTL normal.
     * La clave del dato (data key) expira más tarde (TTL + stale window).
     * Si el dato existe pero la clave de frescura no, está stale pero usable.
     */
    public <T> Optional<T> get(StringRedisTemplate redis, ObjectMapper mapper,
                                String key, Supplier<Optional<T>> loader,
                                Class<T> type, Duration ttl, Duration staleWindow) {
        String dataKey = "data:" + key;
        String freshKey = "fresh:" + key;

        String raw = redis.opsForValue().get(dataKey);
        boolean isFresh = Boolean.TRUE.equals(redis.hasKey(freshKey));

        if (raw != null && isFresh) {
            // Dato fresco — respuesta directa
            return Optional.of(deserialize(raw, type, mapper));
        }

        if (raw != null) {
            // Dato stale — servir inmediatamente y recargar en background
            reloadAsync(redis, mapper, dataKey, freshKey, loader, type, ttl, staleWindow);
            return Optional.of(deserialize(raw, type, mapper));
        }

        // Miss completo — cargar síncronamente
        Optional<T> value = loader.get();
        value.ifPresent(v -> {
            String json = serialize(v, mapper);
            redis.opsForValue().set(dataKey, json, ttl.plus(staleWindow));
            redis.opsForValue().set(freshKey, "1", ttl);
        });
        return value;
    }

    @Async
    public <T> void reloadAsync(StringRedisTemplate redis, ObjectMapper mapper,
                                 String dataKey, String freshKey,
                                 Supplier<Optional<T>> loader, Class<T> type,
                                 Duration ttl, Duration staleWindow) {
        loader.get().ifPresent(v -> {
            String json = serialize(v, mapper);
            redis.opsForValue().set(dataKey, json, ttl.plus(staleWindow));
            redis.opsForValue().set(freshKey, "1", ttl);
        });
    }

    private String serialize(Object obj, ObjectMapper mapper) { /* ... */ return ""; }
    private <T> T deserialize(String json, Class<T> type, ObjectMapper mapper) { /* ... */ return null; }
}
```

### Probabilistic early expiration (XFetch)

El XFetch evita el stampede sin locks: con cierta probabilidad, una petición decide refrescar el dato **antes de que expire**, de forma que cuando el TTL real llega, la caché ya tiene el valor actualizado.

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.function.Supplier;

@Component
public class XFetchCache {

    /**
     * XFetch: probabilistic early expiration.
     * beta controla la agresividad del early refresh (1.0 es el valor estándar).
     * Valores más altos → refreshes más tempranos y frecuentes.
     */
    public <T> Optional<T> get(StringRedisTemplate redis, ObjectMapper mapper,
                                String key, Supplier<Optional<T>> loader,
                                Class<T> type, Duration ttl, double beta) {
        String raw = redis.opsForValue().get(key);

        if (raw == null) {
            // Miss completo: cargar y guardar con metadatos de tiempo
            return loadAndStore(redis, mapper, key, loader, type, ttl);
        }

        XFetchEntry<T> entry = deserializeEntry(raw, type, mapper);
        double remaining = entry.expiry() - Instant.now().getEpochSecond();

        // Probabilidad de early refresh: crece exponencialmente al acercarse al TTL
        double threshold = -beta * entry.loadTimeSecs() * Math.log(Math.random());

        if (threshold >= remaining) {
            // Early refresh asíncrono (en producción, delegar a un executor)
            return loadAndStore(redis, mapper, key, loader, type, ttl);
        }

        return Optional.of(entry.value());
    }

    private <T> Optional<T> loadAndStore(StringRedisTemplate redis, ObjectMapper mapper,
                                          String key, Supplier<Optional<T>> loader,
                                          Class<T> type, Duration ttl) {
        long start = System.nanoTime();
        Optional<T> value = loader.get();
        double loadTimeSecs = (System.nanoTime() - start) / 1_000_000_000.0;

        value.ifPresent(v -> {
            var entry = new XFetchEntry<>(v, loadTimeSecs,
                    Instant.now().getEpochSecond() + ttl.getSeconds());
            redis.opsForValue().set(key, serializeEntry(entry, mapper), ttl);
        });

        return value;
    }

    record XFetchEntry<T>(T value, double loadTimeSecs, long expiry) {}

    private String serializeEntry(XFetchEntry<?> entry, ObjectMapper mapper) { /* ... */ return ""; }
    private <T> XFetchEntry<T> deserializeEntry(String json, Class<T> type, ObjectMapper mapper) { /* ... */ return null; }
}
```

## Cache warming: arrancar sin un cold start desastroso

Un sistema que arranca con una caché vacía puede hundirse en sus primeros minutos de operación. El **cache warming** pobla la caché con datos anticipadamente, antes de que llegue el tráfico real.

```java
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

@Component
public class CacheWarmer {

    private static final Duration WARM_TTL = Duration.ofMinutes(30);
    private static final int BATCH_SIZE = 500;

    private final StringRedisTemplate redis;
    private final UserJpaRepository userJpa;
    private final ProductJpaRepository productJpa;
    private final ObjectMapper objectMapper;

    public CacheWarmer(StringRedisTemplate redis,
                       UserJpaRepository userJpa,
                       ProductJpaRepository productJpa,
                       ObjectMapper objectMapper) {
        this.redis = redis;
        this.userJpa = userJpa;
        this.productJpa = productJpa;
        this.objectMapper = objectMapper;
    }

    /**
     * Se ejecuta una vez que la aplicación está completamente levantada.
     * En Kubernetes, idealmente corría como un init container o un Job previo
     * al cambio de tráfico en el load balancer.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void warmOnStartup() {
        warmMostAccessedUsers();
        warmActiveProductCatalog();
    }

    private void warmMostAccessedUsers() {
        // Obtener los usuarios más accedidos según historial
        List<UserEntity> popularUsers = userJpa.findMostAccessed(BATCH_SIZE);

        var pipeline = redis.executePipelined((connection) -> {
            for (UserEntity user : popularUsers) {
                String key = "user:" + user.getId();
                byte[] value = serializeBytes(UserDto.from(user));
                connection.stringCommands().setEx(
                        key.getBytes(), WARM_TTL.getSeconds(), value);
            }
            return null;
        });
    }

    private void warmActiveProductCatalog() {
        List<ProductEntity> activeProducts = productJpa.findAllActive();

        var pipeline = redis.executePipelined((connection) -> {
            for (ProductEntity product : activeProducts) {
                String key = "product:" + product.getId();
                byte[] value = serializeBytes(ProductDto.from(product));
                connection.stringCommands().setEx(
                        key.getBytes(), WARM_TTL.getSeconds(), value);
            }
            return null;
        });
    }

    private byte[] serializeBytes(Object obj) {
        try {
            return objectMapper.writeValueAsBytes(obj);
        } catch (Exception e) {
            throw new CacheSerializationException(e);
        }
    }
}
```

El warming es especialmente importante en arquitecturas de microservicios donde los pods se escalan frecuentemente. Un pod que arranca con 0 entradas en caché bajo tráfico de producción puede causar degradación hasta que el hit ratio se estabilice.

## Caché multi-nivel: L1 en proceso, L2 en Redis

Un error común es asumir que "caché" significa siempre Redis. Los sistemas de alta disponibilidad típicamente tienen múltiples niveles: caché en proceso (L1) con latencia de nanosegundos y caché distribuida (L2) con estado compartido entre instancias.

```java
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Caché de dos niveles:
 * L1 - Caffeine (in-process, ~nanosegundos de latencia, consistencia eventual entre instancias)
 * L2 - Redis (distribuido, ~microsegundos de latencia, estado compartido)
 */
@Component
public class TwoLevelCache {

    // L1: Caffeine con TTL corto para aceptar un pequeño grado de stale
    private final Cache<String, String> l1 = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofSeconds(5))
            .recordStats()
            .build();

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public TwoLevelCache(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    public <T> Optional<T> get(String key, Supplier<Optional<T>> loader,
                                Class<T> type, Duration l2Ttl) {
        // 1. L1: in-process (sub-microsegundo)
        String l1Value = l1.getIfPresent(key);
        if (l1Value != null) {
            return Optional.of(deserialize(l1Value, type));
        }

        // 2. L2: Redis (sub-milisegundo)
        String l2Value = redis.opsForValue().get(key);
        if (l2Value != null) {
            l1.put(key, l2Value);  // Propagar a L1
            return Optional.of(deserialize(l2Value, type));
        }

        // 3. Fuente de verdad: BD
        Optional<T> value = loader.get();
        value.ifPresent(v -> {
            String json = serialize(v);
            redis.opsForValue().set(key, json, l2Ttl);
            l1.put(key, json);
        });
        return value;
    }

    public void invalidate(String key) {
        l1.invalidate(key);    // Invalida en este proceso
        redis.delete(key);     // Invalida en Redis (afecta a todas las instancias)
        // Nota: el L1 de otras instancias expirará en hasta 5 segundos (TTL de L1)
    }

    private String serialize(Object obj) { /* ... */ return ""; }
    private <T> T deserialize(String json, Class<T> type) { /* ... */ return null; }
}
```

El TTL corto del L1 —5 segundos en el ejemplo— es el período de inconsistencia máxima que aceptamos entre instancias. Para datos de configuración esto es imperceptible. Para precios de stock en tiempo real, puede ser demasiado.

Para la dependencia de Caffeine en Maven:

```xml
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>
```

## Qué estrategia usar y cuándo

Con cuatro estrategias principales y múltiples variantes de invalidación, la elección se simplifica en la práctica:

**Cache-aside** es el punto de partida para casi todo. Úsalo cuando el tráfico es principalmente de lectura, los datos cambian con baja o media frecuencia, y la resiliencia ante fallos de Redis es importante. Es el patrón más común en APIs REST con Spring Boot.

**Write-through** cuando la consistencia inmediata de lectura es un requisito no negociable. Los datos escritos deben ser leíbles con el valor actualizado en la siguiente petición, sin tolerancia a stale. Sistemas financieros, inventario crítico, configuración de producción.

**Write-behind** cuando la latencia de escritura es el cuello de botella y puedes aceptar una pequeña ventana de posible pérdida de datos. Contadores, métricas, registros de actividad, estados de sesión.

Para la invalidación: TTL como mecanismo por defecto, invalidación explícita con eventos de Spring para consistencia más alta, y stale-while-revalidate o XFetch para evitar stampedes en datos de alta concurrencia.

## Relación con Spring Cache Abstraction

Las estrategias de este artículo son implementaciones manuales con `StringRedisTemplate`. Spring ofrece también una capa declarativa con `@Cacheable`, `@CachePut` y `@CacheEvict` que implementa cache-aside de forma transparente. Para la mayoría de los casos de uso donde cache-aside es suficiente, la abstracción declarativa es más limpia y requiere menos código.

Las implementaciones manuales son necesarias cuando se necesita control fino: write-through atómico con transacciones de BD, write-behind con flush por lotes, protección contra stampede, o cachés multi-nivel con TTLs diferenciados por entidad.

## Conclusión

La caché no es un componente que se añade al final del proyecto para "hacer las cosas más rápidas". Es una decisión arquitectónica con compromisos claros sobre consistencia, resiliencia y complejidad operativa.

Cache-aside, write-through y write-behind no son alternativas equivalentes: cada una hace una promesa diferente sobre cuándo la caché refleja la realidad. TTL, invalidación explícita por eventos y versionado resuelven el problema de la expiración con trade-offs distintos. Y stampede, cold start y multi-nivel son problemas que emergen en producción —con tráfico real, con múltiples pods, con picos de carga— y que conviene anticipar antes de que sean una crisis.

Lo que sí es universal es que una caché sin estrategia explícita, añadida ad hoc sin pensar en la invalidación, es solo una fuente de bugs que aún no has encontrado.
