---
titulo: "Rate limiting: estrategias para proteger tus APIs bajo carga"
seoTitulo: "Rate Limiting en APIs: algoritmos, patrones y estrategias para controlar el tráfico"
fecha: "2026-08-21"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es el rate limiting, cómo funcionan los algoritmos principales —token bucket, leaky bucket, fixed window y sliding window—, cuándo usar cada uno y cómo implementarlos con Redis en sistemas distribuidos."
imagenPortada: "https://i.imgur.com/qhQkNY5.png?w=800&h=600&fit=crop"
etiquetas: ["Architecture", "APIs", "Best Practices", "Reliability", "Distributed Systems"]
categoria: "tech"
keywords: "rate limiting, límite de tasa, token bucket, leaky bucket, sliding window counter, fixed window counter, throttling, API protection, rate limiter distribuido, Redis rate limit, control de tráfico API, burst traffic"
---

# Rate limiting: estrategias para proteger tus APIs bajo carga

Una API sin rate limiting es una API con fecha de caducidad. Puede aguantar perfectamente durante meses de tráfico normal, y derrumbarse en segundos cuando un cliente entra en un bucle de reintentos descontrolado, cuando un script mal configurado dispara miles de peticiones por minuto, o cuando el tráfico legítimo de un Black Friday supera todas las proyecciones de capacidad.

El **rate limiting** —control de tasa o limitación de velocidad— es la técnica que controla cuántas peticiones puede hacer un cliente en un período de tiempo determinado. No es solo un mecanismo de defensa ante abusos: es una forma de garantizar que tu sistema se comporta de manera predecible bajo carga, que los usuarios reciben el nivel de servicio que su contrato especifica, y que un cliente mal comportado no degrada la experiencia del resto.

Suena conceptualmente simple. La complejidad está en los detalles: qué algoritmo usar, cómo implementarlo de forma distribuida, qué identificador usar como clave del límite, qué hacer cuando el límite se supera, y cómo comunicarlo de manera que los clientes puedan adaptarse. Este artículo recorre cada una de esas decisiones.

## Los cuatro algoritmos fundamentales

No hay un único algoritmo de rate limiting. Cada uno resuelve el problema con compromisos distintos entre simplicidad, consumo de memoria, suavidad del tráfico que produce y precisión frente a la realidad del tiempo continuo. Conocer sus diferencias es el punto de partida para elegir el correcto.

### Fixed window counter

El algoritmo más simple. El tiempo se divide en ventanas fijas de duración determinada —un minuto, una hora— y se cuenta cuántas peticiones llegan en cada ventana. Si el contador supera el límite, las peticiones se rechazan hasta que comience la siguiente ventana.

```java
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
public class FixedWindowRateLimiter {

    private final StringRedisTemplate redisTemplate;
    private final long limit;
    private final long windowSeconds;

    public FixedWindowRateLimiter(StringRedisTemplate redisTemplate, long limit, long windowSeconds) {
        this.redisTemplate = redisTemplate;
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    public RateLimitResult isAllowed(String clientId) {
        // La clave incluye el número de ventana actual para que expire automáticamente
        long window = Instant.now().getEpochSecond() / windowSeconds;
        String key = "ratelimit:fixed:%s:%d".formatted(clientId, window);

        List<Object> results = redisTemplate.executePipelined(new SessionCallback<Object>() {
            @Override
            public Object execute(RedisOperations operations) {
                operations.opsForValue().increment(key);
                operations.expire(key, Duration.ofSeconds(windowSeconds * 2)); // TTL holgado para evitar race conditions
                return null;
            }
        });

        long count = (Long) results.get(0);
        long remaining = Math.max(0, limit - count);
        long windowReset = (window + 1) * windowSeconds;

        return new RateLimitResult(count <= limit, limit, remaining, windowReset);
    }

    public record RateLimitResult(boolean allowed, long limit, long remaining, long reset) {}
}
```

La implementación es trivial y el consumo de memoria es mínimo: una clave por cliente por ventana. El problema es el **boundary problem** o problema de la frontera de ventana. Un cliente puede hacer 100 peticiones al final de una ventana y otras 100 al inicio de la siguiente, logrando efectivamente 200 peticiones en 2 segundos cuando el límite era 100 por minuto.

```
Límite: 100 req/min, ventana fija

  Ventana 1 [00:00 - 01:00]    Ventana 2 [01:00 - 02:00]
  ...........│████████████████│████████████████│...........
                 100 req en    100 req en
                 los últimos   los primeros
                 2 segundos    2 segundos
                 
             └────────────────────────┘
               200 peticiones en 4 segundos
```

Este comportamiento hace al fixed window inadecuado para límites que deben ser estrictamente uniformes. Es aceptable cuando el objetivo es proteger contra abusos burdos, no cuando la precisión es crítica.

### Sliding window log

El sliding window log soluciona el problema de la frontera manteniendo un registro con el timestamp exacto de cada petición. Para verificar si una nueva petición está dentro del límite, se cuentan todas las entradas del log que caen dentro del intervalo `[ahora - ventana, ahora]`.

```java
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class SlidingWindowLogRateLimiter {

    private final StringRedisTemplate redisTemplate;
    private final long limit;
    private final long windowSeconds;

    public SlidingWindowLogRateLimiter(StringRedisTemplate redisTemplate, long limit, long windowSeconds) {
        this.redisTemplate = redisTemplate;
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    public RateLimitResult isAllowed(String clientId) {
        double now = Instant.now().toEpochMilli() / 1000.0;
        double windowStart = now - windowSeconds;
        String key = "ratelimit:log:" + clientId;
        // member único (timestamp + UUID) para evitar colisiones
        String member = now + ":" + UUID.randomUUID();

        List<Object> results = redisTemplate.executePipelined(new SessionCallback<Object>() {
            @Override
            public Object execute(RedisOperations operations) {
                // Eliminamos entradas antiguas fuera de la ventana
                operations.opsForZSet().removeRangeByScore(key, 0, windowStart);
                // Contamos las entradas en la ventana actual
                operations.opsForZSet().zCard(key);
                // Añadimos la entrada actual (score = timestamp)
                operations.opsForZSet().add(key, member, now);
                // TTL para evitar claves huérfanas
                operations.expire(key, Duration.ofSeconds(windowSeconds + 1));
                return null;
            }
        });

        // La segunda operación del pipeline es el zCard previo a añadir la entrada actual
        long count = (Long) results.get(1);
        // La petición actual ya fue añadida; si count+1 > limit, rechazamos
        boolean allowed = (count + 1) <= limit;

        if (!allowed) {
            // Si no se permite, eliminamos la entrada que acabamos de añadir
            redisTemplate.opsForZSet().remove(key, member);
        }

        return new RateLimitResult(allowed, limit, Math.max(0, limit - count - 1), (long) (now + windowSeconds));
    }

    public record RateLimitResult(boolean allowed, long limit, long remaining, long reset) {}
}
```

La precisión es perfecta: no existe el problema de la frontera porque la ventana se desplaza continuamente con cada petición. El precio es el consumo de memoria: almacenar un timestamp por petición puede ser costoso para clientes con tráfico alto. Si un cliente hace 10 000 peticiones por hora, el sorted set en Redis contendrá hasta 10 000 entradas por cliente. Para la mayoría de los casos de uso esto es aceptable, pero en APIs con millones de clientes activos puede ser problemático.

### Sliding window counter

El sliding window counter es un compromiso entre la eficiencia del fixed window y la precisión del sliding window log. En lugar de guardar cada timestamp individual, mantiene contadores de ventanas fijas pero los combina para aproximar el conteo dentro de una ventana deslizante.

La idea: si el límite es 100 req/min y estás en el segundo 45 de la ventana actual, el estimado de peticiones en los últimos 60 segundos es:

```
estimado = peticiones_ventana_anterior * (15/60) + peticiones_ventana_actual
```

Los 15 segundos de la ventana anterior se incluyen proporcionalmente porque son los que "se superponen" con los últimos 60 segundos contados desde ahora.

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Component
public class SlidingWindowCounterRateLimiter {

    private final StringRedisTemplate redisTemplate;
    private final long limit;
    private final long windowSeconds;

    public SlidingWindowCounterRateLimiter(StringRedisTemplate redisTemplate, long limit, long windowSeconds) {
        this.redisTemplate = redisTemplate;
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    public RateLimitResult isAllowed(String clientId) {
        long now = Instant.now().getEpochSecond();
        long currentWindow = now / windowSeconds;
        long previousWindow = currentWindow - 1;

        String keyCurrent = "ratelimit:swc:%s:%d".formatted(clientId, currentWindow);
        String keyPrevious = "ratelimit:swc:%s:%d".formatted(clientId, previousWindow);

        List<String> counts = redisTemplate.opsForValue().multiGet(List.of(keyCurrent, keyPrevious));
        long currentCount = parseOrZero(counts.get(0));
        long previousCount = parseOrZero(counts.get(1));

        // Fracción de la ventana anterior que cae en nuestra ventana deslizante
        long elapsedInCurrent = now - (currentWindow * windowSeconds);
        double previousWeight = 1.0 - ((double) elapsedInCurrent / windowSeconds);

        double estimated = previousCount * previousWeight + currentCount;
        long reset = (currentWindow + 1) * windowSeconds;

        if (estimated >= limit) {
            return new RateLimitResult(false, limit, 0, reset);
        }

        redisTemplate.opsForValue().increment(keyCurrent);
        redisTemplate.expire(keyCurrent, Duration.ofSeconds(windowSeconds * 2));

        long remaining = Math.max(0, (long) (limit - estimated - 1));
        return new RateLimitResult(true, limit, remaining, reset);
    }

    private long parseOrZero(String value) {
        return value == null ? 0 : Long.parseLong(value);
    }

    public record RateLimitResult(boolean allowed, long limit, long remaining, long reset) {}
}
```

El sliding window counter consume solo dos claves por cliente —la ventana actual y la anterior— independientemente del volumen de tráfico. La precisión no es perfecta —la ponderación lineal es una aproximación— pero en la práctica el error es inferior al 1 % para tráfico uniforme y aceptable para tráfico irregular. Es el algoritmo que usa Cloudflare para sus rate limits distribuidos a escala global, y el que recomienda Redis Labs para la mayoría de los casos de uso.

### Token bucket

Los tres algoritmos anteriores son de ventana: limitan el número de peticiones en un período. El token bucket es diferente: modela el rate limit como un cubo que se llena de tokens a una velocidad constante. Cada petición consume un token; si el cubo está vacío, la petición se rechaza.

```java
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class TokenBucketRateLimiter {

    // Usamos un script Lua para que la operación sea atómica en Redis
    private static final String SCRIPT = """
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local capacity = tonumber(ARGV[2])
        local refill_rate = tonumber(ARGV[3])
        local requested = tonumber(ARGV[4])

        local data = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(data[1]) or capacity
        local last_refill = tonumber(data[2]) or now

        -- Calculamos los tokens que se han acumulado desde la última solicitud
        local elapsed = now - last_refill
        local new_tokens = math.min(capacity, tokens + elapsed * refill_rate)

        if new_tokens < requested then
            -- No hay suficientes tokens
            redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)
            return {0, math.floor(new_tokens)}
        end

        -- Consumimos los tokens solicitados
        new_tokens = new_tokens - requested
        redis.call('HMSET', key, 'tokens', new_tokens, 'last_refill', now)
        redis.call('EXPIRE', key, 3600)
        return {1, math.floor(new_tokens)}
        """;

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<List> redisScript;
    private final long capacity;
    private final double refillRate;

    /**
     * capacity: número máximo de tokens (y también tamaño del burst permitido)
     * refillRate: tokens añadidos por segundo
     */
    public TokenBucketRateLimiter(StringRedisTemplate redisTemplate, long capacity, double refillRate) {
        this.redisTemplate = redisTemplate;
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.redisScript = new DefaultRedisScript<>(SCRIPT, List.class);
    }

    public RateLimitResult isAllowed(String clientId) {
        return isAllowed(clientId, 1);
    }

    @SuppressWarnings("unchecked")
    public RateLimitResult isAllowed(String clientId, long tokensRequested) {
        double now = Instant.now().toEpochMilli() / 1000.0;
        String key = "ratelimit:token:" + clientId;

        List<Long> result = redisTemplate.execute(
                redisScript,
                List.of(key),
                String.valueOf(now),
                String.valueOf(capacity),
                String.valueOf(refillRate),
                String.valueOf(tokensRequested)
        );

        boolean allowed = result.get(0) == 1;
        long remainingTokens = result.get(1);
        double retryAfter = allowed ? 0 : (tokensRequested - remainingTokens) / refillRate;

        return new RateLimitResult(allowed, capacity, remainingTokens, retryAfter);
    }

    public record RateLimitResult(boolean allowed, long limit, long remaining, double retryAfterSeconds) {}
}
```

La diferencia clave con los algoritmos de ventana es que el token bucket permite **bursts controlados**: si el cliente no ha hecho peticiones durante un tiempo, los tokens acumulados le permiten hacer una ráfaga de peticiones por encima de la tasa media, hasta el límite de la capacidad del cubo.

```
Token bucket con capacity=10, refill_rate=2 tokens/segundo

Cliente inactivo por 5 segundos → cubo lleno (10 tokens)
Petición 1: consume 1 token → 9 restantes
Petición 2: consume 1 token → 8 restantes
...
Petición 10: consume 1 token → 0 restantes
Petición 11: rechazada (cubo vacío)

Espera 0.5 segundos → 1 token recargado
Petición 12: permitida
```

Esto hace al token bucket ideal para clientes que tienen tráfico en ráfagas por naturaleza: navegadores que cargan una página, SDKs que hacen varias llamadas en paralelo al arrancar, o procesos batch que procesan lotes de datos. El comportamiento es más natural y menos frustrante para el cliente que los algoritmos de ventana, que pueden rechazar una petición legítima simplemente porque llegó 0.1 segundos antes del reset de la ventana.

### Leaky bucket

El leaky bucket es el opuesto filosófico del token bucket. En lugar de controlar cuánto puede consumir el cliente, controla a qué velocidad procesas tú. Las peticiones entrantes se encolan; el sistema las procesa a una tasa fija, independientemente de cuánto tráfico llegue. Si la cola se llena, se rechaza la petición.

El resultado es un flujo de salida perfectamente uniforme: da igual si el cliente manda 100 peticiones en un segundo o en una hora, el sistema las procesa siempre al mismo ritmo. Esto lo hace especialmente valioso en integraciones con sistemas externos que degradan su rendimiento con ráfagas de tráfico, o en pipelines de procesamiento donde la uniformidad es más importante que la latencia mínima.

En la práctica, el leaky bucket puro es menos común en rate limiting de APIs públicas porque la cola implica latencia indeterminada para el cliente. Es más frecuente encontrarlo en sistemas de throttling internos o en gateways que necesitan suavizar el tráfico antes de enviarlo a un backend frágil.

## La dimensión de la clave: ¿limitar qué?

El algoritmo es solo la mitad de la decisión. La otra mitad es definir la **clave** del rate limit: qué identifica a la entidad cuyas peticiones se están contando.

### Por IP

La opción más simple. No requiere autenticación ni contexto: cualquier petición que llegue de la misma IP comparte el límite.

```java
public String getRateLimitKey(HttpServletRequest request) {
    // Considerar cabeceras de proxy inverso
    String forwardedFor = request.getHeader("X-Forwarded-For");
    String ip;
    if (forwardedFor != null && !forwardedFor.isBlank()) {
        // X-Forwarded-For puede contener múltiples IPs: "client, proxy1, proxy2"
        // Solo confiamos en la primera si el proxy inverso es de confianza
        ip = forwardedFor.split(",")[0].trim();
    } else {
        ip = request.getRemoteAddr();
    }
    return "ip:" + ip;
}
```

El problema es que la IP no identifica a un usuario de forma fiable. Una universidad, una empresa grande o un proveedor de VPN pueden tener cientos de usuarios detrás de la misma IP. Limitar por IP puede bloquear acceso legítimo de usuarios no relacionados. Y los atacantes sofisticados pueden rotar IPs fácilmente.

Por estas razones, limitar por IP es útil como primera línea de defensa contra ataques de fuerza bruta o rastreo masivo, pero no es suficiente como estrategia principal para APIs autenticadas.

### Por token de API o usuario autenticado

Para APIs que requieren autenticación, el identificador natural es el token de API o el ID de usuario:

```java
import org.apache.commons.codec.digest.DigestUtils;

public String getRateLimitKey(HttpServletRequest request) {
    String authHeader = request.getHeader("Authorization");
    if (authHeader != null && authHeader.startsWith("Bearer ")) {
        String token = authHeader.substring("Bearer ".length());
        // Hasheamos el token para no almacenarlo en las claves de Redis
        String hash = DigestUtils.sha256Hex(token).substring(0, 16);
        return "token:" + hash;
    }
    // Fallback a IP si no hay autenticación
    return "ip:" + request.getRemoteAddr();
}
```

Esto resuelve el problema de las IPs compartidas y permite aplicar límites diferenciados por nivel de plan (un usuario premium tiene un límite mayor que uno gratuito), que es el modelo que usan virtualmente todas las APIs comerciales.

### Por operación o endpoint

No todas las operaciones cuestan lo mismo. Una consulta de búsqueda que dispara una query compleja contra la base de datos es mucho más costosa que leer un registro por ID. Aplicar el mismo límite a ambas es ineficiente: el límite debe ser conservador para proteger las operaciones costosas, lo que resulta en límites innecesariamente bajos para las baratas.

La solución es combinar la identidad del cliente con el endpoint o el tipo de operación:

```java
public String getRateLimitKey(HttpServletRequest request, String granularity) {
    String clientId = getClientId(request);

    return switch (granularity) {
        case "endpoint" -> "ratelimit:%s:%s".formatted(clientId, normalizePath(request.getRequestURI()));
        case "method_endpoint" -> "ratelimit:%s:%s:%s".formatted(
                clientId, request.getMethod(), normalizePath(request.getRequestURI()));
        default -> "ratelimit:%s:global".formatted(clientId);
    };
}

// Reemplaza segmentos numéricos con {id} para agrupar endpoints similares
private String normalizePath(String path) {
    return path.replaceAll("/\\d+", "/{id}");
}
```

Una API típica puede tener tres capas de rate limiting simultáneas: un límite global por cliente (p. ej., 10 000 req/hora), un límite por endpoint para operaciones costosas (p. ej., 100 búsquedas/minuto), y un límite por IP como defensa contra ataques sin autenticación.

## Respuestas estándar: HTTP 429 y cabeceras

Cuando el límite se supera, el estándar de la industria es devolver un código `429 Too Many Requests`. Además, hay un conjunto de cabeceras que los clientes bien implementados usan para adaptar su comportamiento:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1724188800
Retry-After: 37

{
  "error": "rate_limit_exceeded",
  "message": "Has superado el límite de 100 peticiones por minuto.",
  "retry_after": 37
}
```

`X-RateLimit-Limit` es el límite total del período. `X-RateLimit-Remaining` es cuántas peticiones quedan hasta el límite. `X-RateLimit-Reset` es el timestamp Unix en que el límite se reinicia. `Retry-After` indica cuántos segundos debe esperar el cliente antes de reintentar.

Estas cabeceras deben enviarse en **todas las respuestas**, no solo en las 429. Los clientes bien implementados las leen continuamente para ajustar su velocidad de forma proactiva antes de llegar al límite, en lugar de esperar a que les rechacen peticiones.

```java
// Anotación para marcar qué endpoints están sujetos a rate limiting
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimited {
    int limit();
    int windowSeconds();
}
```

```java
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;

@Aspect
@Component
public class RateLimitAspect {

    private final SlidingWindowCounterRateLimiter limiter;

    public RateLimitAspect(SlidingWindowCounterRateLimiter limiter) {
        this.limiter = limiter;
    }

    @Around("@annotation(rateLimited)")
    public Object enforce(ProceedingJoinPoint joinPoint, RateLimited rateLimited) throws Throwable {
        HttpServletRequest request = ((ServletRequestAttributes)
                RequestContextHolder.currentRequestAttributes()).getRequest();
        HttpServletResponse response = ((ServletRequestAttributes)
                RequestContextHolder.currentRequestAttributes()).getResponse();

        String clientKey = getDefaultKey(request);
        var result = limiter.isAllowed(clientKey);

        // Cabeceras estándar en todas las respuestas
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.limit()));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(result.remaining()));
        response.setHeader("X-RateLimit-Reset", String.valueOf(result.reset()));

        if (!result.allowed()) {
            long retryAfter = result.reset() - Instant.now().getEpochSecond();
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write("""
                    {"error":"rate_limit_exceeded","message":"Límite de %d peticiones por %ds superado.","retry_after":%d}
                    """.formatted(rateLimited.limit(), rateLimited.windowSeconds(), retryAfter));
            return null;
        }

        return joinPoint.proceed();
    }
}
```

```java
// Uso:
@RestController
@RequestMapping("/api")
public class SearchController {

    @GetMapping("/search")
    @RateLimited(limit = 20, windowSeconds = 60)
    public ResponseEntity<?> search(@RequestParam String q) {
        ...
    }
}
```

## Rate limiting distribuido: el problema de la consistencia

Cuando tu API se ejecuta en múltiples instancias —lo que es el caso en cualquier despliegue de producción moderno— el rate limiter no puede almacenar el estado en memoria local. Si cada instancia mantiene sus propios contadores, un cliente que envía 10 peticiones distribuidas entre 10 instancias elude completamente el límite de 10 req/s.

La solución estándar es centralizar el estado en Redis. Todas las implementaciones que hemos visto hasta ahora usan Redis precisamente por esto: es un store en memoria con operaciones atómicas (y scripts Lua para operaciones compuestas que deben ser atómicas), latencia de sub-milisegundo y soporte nativo de TTL.

Sin embargo, hay matices importantes en la consistencia del contador distribuido.

El comando `INCR` de Redis es atómico: dos instancias que ejecutan `INCR` simultáneamente no producen una condición de carrera. El problema aparece cuando la operación de rate limiting requiere leer-modificar-escribir en múltiples pasos: leer el contador, verificar si supera el límite, e incrementar solo si no lo supera. Este patrón no es atómico si se implementa con comandos Redis separados.

La solución es usar scripts Lua, que Redis ejecuta de forma atómica en el servidor. Cualquier operación que requiera múltiples pasos interdependientes debe ir en un script Lua para garantizar que nadie más modifica el estado entre pasos:

```lua
-- Script Lua para sliding window counter (atómico en Redis)
local current_key = KEYS[1]
local previous_key = KEYS[2]
local limit = tonumber(ARGV[1])
local window_seconds = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local current_window = math.floor(now / window_seconds)
local elapsed = now - (current_window * window_seconds)
local previous_weight = 1.0 - (elapsed / window_seconds)

local current_count  = tonumber(redis.call('GET', current_key)  or 0)
local previous_count = tonumber(redis.call('GET', previous_key) or 0)
local estimated = previous_count * previous_weight + current_count

if estimated >= limit then
    return {0, math.floor(estimated), math.floor(limit - estimated)}
end

redis.call('INCR', current_key)
redis.call('EXPIRE', current_key, window_seconds * 2)
return {1, math.floor(estimated + 1), math.floor(limit - estimated - 1)}
```

### Consistencia eventual en entornos multi-región

Si tu infraestructura está distribuida en múltiples regiones geográficas con Redis independiente en cada una, la consistencia distribuida añade otra capa de complejidad. Un cliente que hace peticiones desde diferentes regiones puede "gastar" el presupuesto de rate limiting en cada región por separado, eficamente multiplicando su límite real.

Las opciones son:

**Redis Cluster con replicación**: mantiene un único estado distribuido, pero añade latencia de red en cada verificación. Viable si las regiones están geográficamente cercanas.

**Límites por región más conservadores**: si el límite global es 1 000 req/min y tienes 3 regiones, cada región aplica un límite de 400 req/min. El cliente no puede superar 1 200 req/min en total, que es un margen aceptable.

**Sincronización asíncrona**: cada región mantiene contadores locales que se sincronizan con un contador central cada N segundos. La consistencia no es perfecta, pero la latencia de las verificaciones de rate limiting es mínima. Twitter usó este enfoque durante años.

Para la mayoría de los sistemas, la segunda opción —límites conservadores por región— ofrece el mejor equilibrio entre simplicidad operativa y protección efectiva.

## Cuándo rechazar vs cuándo encolar

Hasta ahora hemos asumido que la respuesta al superar el límite es rechazar la petición con 429. Pero hay un espectro de respuestas posibles, y la correcta depende del tipo de operación y del contexto.

**Rechazar (429)** es la respuesta apropiada cuando el cliente puede y debe reintentar más tarde, y la latencia adicional es aceptable. Es el caso de la mayoría de las APIs: el cliente recibe el 429, espera `Retry-After` segundos y reintenta.

**Encolado** es la alternativa cuando la operación es asíncrona por naturaleza. En lugar de rechazar, la API acepta la petición y la encola para procesarla más tarde. El cliente recibe un `202 Accepted` con una URL donde puede consultar el estado. Esto es adecuado para operaciones de larga duración —generar un informe, procesar un archivo— donde el cliente no necesita el resultado inmediatamente.

```java
@RestController
@RequestMapping("/api")
public class ReportController {

    private final SlidingWindowCounterRateLimiter queueLimiter;
    private final ReportQueueService reportQueue;

    public ReportController(SlidingWindowCounterRateLimiter queueLimiter, ReportQueueService reportQueue) {
        this.queueLimiter = queueLimiter;
        this.reportQueue = reportQueue;
    }

    @PostMapping("/reports")
    public ResponseEntity<?> createReport(@RequestBody ReportRequest body, HttpServletRequest request) {
        String clientId = getClientId(request);
        var result = queueLimiter.isAllowed(clientId);

        if (!result.allowed()) {
            // El cliente tiene demasiados trabajos en cola
            return ResponseEntity.status(429)
                    .body(Map.of("error", "queue_full", "message", "Demasiados trabajos pendientes."));
        }

        Job job = reportQueue.enqueue(body);
        return ResponseEntity.status(202)
                .body(Map.of("job_id", job.getId(), "status_url", "/api/jobs/" + job.getId()));
    }
}
```

**Degradación gradual** es una tercera opción para operaciones donde una respuesta aproximada es mejor que ninguna respuesta. Si el límite se supera, la API responde con datos cacheados o con una versión simplificada de la respuesta, indicando en las cabeceras que el resultado puede estar desactualizado.

## Estrategias para el cliente: exponential backoff con jitter

La otra cara del rate limiting es cómo deben responder los clientes cuando reciben un 429. El patrón estándar es el **exponential backoff con jitter**.

El exponential backoff simple espera cada vez más tiempo entre reintentos: 1s, 2s, 4s, 8s, 16s... El problema con el backoff puro es la **thundering herd**: si 1 000 clientes reciben un 429 al mismo tiempo y todos esperan el mismo tiempo antes de reintentar, el retry storm puede volver a saturar el servidor exactamente cuando el límite se reseteó.

El jitter —ruido aleatorio en el tiempo de espera— distribuye los reintentos en el tiempo para evitar este patrón:

```java
import java.io.IOException;
import java.net.http.HttpResponse;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Supplier;

public class RetryWithBackoff {

    /**
     * Reintenta una petición con exponential backoff y jitter opcional.
     * Respeta la cabecera Retry-After si está disponible.
     */
    public static HttpResponse<String> retryWithBackoff(
            Supplier<HttpResponse<String>> request,
            int maxRetries,
            double baseDelaySeconds,
            double maxDelaySeconds,
            boolean jitter
    ) throws InterruptedException {
        for (int attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                HttpResponse<String> response = request.get();

                if (response.statusCode() == 429) {
                    if (attempt == maxRetries) {
                        throw new IllegalStateException("Rate limit excedido tras " + maxRetries + " reintentos");
                    }

                    // Respetamos Retry-After si el servidor lo envía
                    double wait = response.headers().firstValue("Retry-After")
                            .map(Double::parseDouble)
                            // Exponential backoff: 1s, 2s, 4s, 8s, 16s...
                            .orElseGet(() -> Math.min(baseDelaySeconds * Math.pow(2, attempt), maxDelaySeconds));

                    if (jitter) {
                        // Full jitter: espera un tiempo aleatorio entre 0 y el backoff calculado
                        wait = ThreadLocalRandom.current().nextDouble(0, wait);
                    }

                    Thread.sleep((long) (wait * 1000));
                    continue;
                }

                return response;

            } catch (IOException e) {
                if (attempt == maxRetries) {
                    throw new IllegalStateException("Rate limit excedido tras " + maxRetries + " reintentos", e);
                }
                double wait = Math.min(baseDelaySeconds * Math.pow(2, attempt), maxDelaySeconds);
                if (jitter) {
                    wait = ThreadLocalRandom.current().nextDouble(0, wait);
                }
                Thread.sleep((long) (wait * 1000));
            }
        }

        throw new IllegalStateException("Máximo de reintentos alcanzado");
    }
}
```

Existen dos variantes de jitter. **Full jitter** elige un tiempo aleatorio uniforme entre 0 y el backoff calculado: los reintentos se distribuyen de forma completamente uniforme pero la espera media puede ser más corta de lo deseado. **Equal jitter** mantiene la mitad del backoff calculado como base y añade aleatoriedad solo en la otra mitad: garantiza un tiempo mínimo de espera que crece exponencialmente, lo que es más predecible para el cliente. Los papers de AWS recomiendan full jitter para la distribución de carga más homogénea.

## Comunicar los límites en la documentación

Un rate limiter bien implementado pero mal documentado es inútil. Los desarrolladores que integran tu API necesitan saber con exactitud cuáles son los límites antes de escribir su código de cliente, no cuando empiezan a recibir 429 en producción.

La documentación debe especificar: qué límites existen y en qué períodos, cómo se identifica al cliente (por IP, por token, por usuario), si hay límites diferenciados por plan o endpoint, qué cabeceras se devuelven en cada respuesta, y cuál es el comportamiento esperado cuando se supera el límite.

Muchas APIs también exponen un endpoint de estado del rate limit que el cliente puede consultar sin consumir cuota:

```
GET /api/rate-limit-status
Authorization: Bearer {token}

HTTP/1.1 200 OK
{
  "limits": [
    {
      "scope": "global",
      "limit": 1000,
      "remaining": 847,
      "reset": 1724188800,
      "window": "1h"
    },
    {
      "scope": "/api/search",
      "limit": 20,
      "remaining": 20,
      "reset": 1724185260,
      "window": "1m"
    }
  ]
}
```

Este endpoint es especialmente valioso durante el desarrollo y la depuración, y cuesta casi nada implementar: es una consulta a Redis que no modifica ningún contador.

## Qué algoritmo usar y cuándo

Con cuatro algoritmos y múltiples dimensiones de configuración, la elección puede parecer abrumadora. En la práctica, la decisión se simplifica bastante.

Si necesitas una implementación simple y el problema de la frontera de ventana es aceptable para tu caso de uso —por ejemplo, como primera capa de defensa contra abusos—, **fixed window counter** es suficiente. Es trivial de implementar y de entender.

Si el tráfico de tus clientes tiene ráfagas naturales —SDKs que hacen múltiples llamadas en paralelo, procesos que procesan lotes de datos— y quieres que la experiencia sea fluida, **token bucket** es la opción correcta. Permite bursts hasta la capacidad del cubo mientras mantiene la tasa media bajo control.

Si la precisión es crítica y el consumo de memoria no es un problema —pocos clientes, límites bajos—, **sliding window log** ofrece el comportamiento más correcto. Es el que tiene el menor margen de error posible.

Para el caso general —muchos clientes, memoria limitada, precisión razonablemente alta—, **sliding window counter** es el mejor equilibrio. No por casualidad es el que eligen operadores a escala como Cloudflare y Redis Labs para sus implementaciones de referencia.

## Conclusión

El rate limiting es uno de esos componentes de infraestructura que no se perciben cuando funcionan bien y generan crisis cuando faltan. Una API sin límites puede ser secuestrada por un cliente mal configurado, colapsada por un ataque de fuerza bruta o degradada por una ráfaga de tráfico legítimo que supera la capacidad del sistema.

Los cuatro algoritmos que hemos visto —fixed window, sliding window log, sliding window counter y token bucket— cubren la mayoría de los casos de uso. La clave de idempotencia del límite —por IP, por token, por endpoint— determina a qué granularidad se protege el sistema. Y Redis con scripts Lua garantiza que el estado sea consistente en entornos distribuidos con múltiples instancias.

Pero tan importante como la implementación es la comunicación: cabeceras estándar en todas las respuestas, documentación clara de los límites y comportamiento predecible ante el 429 son lo que diferencia un rate limiter que frustra a los desarrolladores de uno que les ayuda a construir clientes robustos. El rate limiting bien hecho no es un obstáculo: es una promesa de calidad de servicio.
