---
titulo: "Spring Cache Abstraction: caché declarativa en Spring Boot"
seoTitulo: "Spring Cache en Spring Boot: @Cacheable, @CachePut, @CacheEvict con Redis y EhCache"
fecha: "2026-06-09"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar la abstracción de caché de Spring Boot: almacena resultados con @Cacheable, actualiza entradas con @CachePut, invalida con @CacheEvict e integra Redis o EhCache como proveedor."
imagenPortada: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java", "Cache", "Redis", "EhCache", "Backend", "Performance"]
categoria: "tech"
keywords: "Spring Cache, @Cacheable, @CachePut, @CacheEvict, Spring Boot caché, Redis Spring Boot, EhCache Spring, caché declarativa Java, spring cache abstraction, CacheManager"
---

# Spring Cache Abstraction: caché declarativa en Spring Boot

Consultar la base de datos repetidamente para los mismos datos es uno de los cuellos de botella más comunes en aplicaciones backend. La abstracción de caché de Spring ofrece una solución elegante: con unas pocas anotaciones, los resultados de un método se almacenan y reutilizan sin modificar la lógica de negocio.

Este artículo cubre la abstracción desde cero: configuración básica, las tres anotaciones principales, estrategias de invalidación, y la integración con Redis y EhCache como proveedores de producción.

## Dependencias

Para empezar, necesitas el starter de caché de Spring Boot:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
```

Este starter configura un `ConcurrentMapCacheManager` por defecto (caché en memoria, suficiente para desarrollo). Para producción, agregas el proveedor que necesites (Redis, EhCache, Caffeine, etc.).

## Habilitar la caché

Añade `@EnableCaching` a cualquier clase de configuración o a la clase principal:

```java
@SpringBootApplication
@EnableCaching
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

Sin `@EnableCaching`, las anotaciones de caché son ignoradas silenciosamente.

## @Cacheable: almacenar resultados

`@Cacheable` intercepta la llamada al método y, si ya existe un resultado guardado para la misma clave, lo devuelve sin ejecutar el cuerpo del método.

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    @Cacheable(value = "products", key = "#id")
    public ProductResponse findById(Long id) {
        // Solo se ejecuta si no hay entrada en caché para este id
        return productRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new ProductNotFoundException(id));
    }
}
```

- **`value`**: nombre del caché (se puede pensar como una "región" o "tabla" de caché).
- **`key`**: expresión SpEL que determina la clave. `#id` toma el valor del parámetro `id`.

La primera vez que se llama `findById(5L)`, Spring ejecuta el método y guarda el resultado. En llamadas posteriores con el mismo argumento, devuelve el resultado guardado directamente.

### Clave compuesta y SpEL

Cuando el método tiene varios parámetros, puedes construir una clave compuesta:

```java
@Cacheable(value = "products", key = "#category + '-' + #page + '-' + #size")
public Page<ProductResponse> findByCategory(String category, int page, int size) {
    return productRepository.findByCategory(category, PageRequest.of(page, size))
            .map(this::mapToResponse);
}
```

También puedes usar `#root.methodName` para incluir el nombre del método, o acceder a propiedades del objeto con `#param.field`:

```java
@Cacheable(value = "products", key = "#request.category + '-' + #request.page")
public Page<ProductResponse> search(ProductSearchRequest request) { ... }
```

### Caché condicional con condition y unless

`condition` evalúa **antes** de ejecutar el método; si es falsa, no se usa caché:

```java
@Cacheable(value = "products", key = "#id", condition = "#id > 0")
public ProductResponse findById(Long id) { ... }
```

`unless` evalúa **después** de ejecutar el método; si es verdadera, el resultado no se guarda:

```java
@Cacheable(value = "products", key = "#id", unless = "#result == null")
public ProductResponse findById(Long id) { ... }
```

El uso más común de `unless` es evitar guardar resultados nulos o listas vacías.

## @CachePut: actualizar la caché

`@CachePut` siempre ejecuta el método **y además** guarda el resultado en caché. Es útil para mantener la caché sincronizada al actualizar un recurso:

```java
@CachePut(value = "products", key = "#id")
public ProductResponse update(Long id, UpdateProductRequest request) {
    Product product = productRepository.findById(id)
            .orElseThrow(() -> new ProductNotFoundException(id));

    product.setName(request.name());
    product.setPrice(request.price());
    productRepository.save(product);

    return mapToResponse(product);
}
```

Después de esta llamada, la entrada `products::5` en caché contiene la versión actualizada. La siguiente llamada a `findById(5L)` devolverá el dato fresco sin consultar la base de datos.

> **Diferencia clave**: `@Cacheable` evita ejecutar el método si hay caché; `@CachePut` siempre ejecuta el método y actualiza la caché.

## @CacheEvict: invalidar entradas

`@CacheEvict` elimina una o varias entradas del caché cuando el método es invocado. Se usa típicamente al eliminar un recurso:

```java
@CacheEvict(value = "products", key = "#id")
public void delete(Long id) {
    productRepository.deleteById(id);
}
```

### Limpiar todo un caché con allEntries

Para invalidar todas las entradas de un caché de una vez, usa `allEntries = true`:

```java
@CacheEvict(value = "products", allEntries = true)
public void deleteAll() {
    productRepository.deleteAll();
}
```

### beforeInvocation

Por defecto, la invalidación ocurre **después** de que el método termina exitosamente. Si el método lanza una excepción, la caché no se limpia. Con `beforeInvocation = true`, la invalidación ocurre antes, independientemente del resultado:

```java
@CacheEvict(value = "products", key = "#id", beforeInvocation = true)
public void delete(Long id) {
    productRepository.deleteById(id);
}
```

## @Caching: combinar anotaciones

Cuando necesitas aplicar varias operaciones de caché en un mismo método, usa `@Caching`:

```java
@Caching(
    put = {
        @CachePut(value = "products", key = "#result.id"),
        @CachePut(value = "productsBySlug", key = "#result.slug")
    }
)
public ProductResponse create(CreateProductRequest request) {
    Product product = new Product(request.name(), request.price(), generateSlug(request.name()));
    productRepository.save(product);
    return mapToResponse(product);
}
```

O para invalidar varias cachés a la vez:

```java
@Caching(evict = {
    @CacheEvict(value = "products", key = "#id"),
    @CacheEvict(value = "productsBySlug", allEntries = true)
})
public void delete(Long id) {
    productRepository.deleteById(id);
}
```

## Proveedor de caché: Redis

Para producción, el `ConcurrentMapCacheManager` no es adecuado: los datos se pierden al reiniciar la aplicación y no se comparte entre instancias. Redis es la opción más común.

### Dependencia

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### Configuración en application.yml

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      password: ${REDIS_PASSWORD:}
      timeout: 2000ms
  cache:
    type: redis
    redis:
      time-to-live: 600000  # 10 minutos en milisegundos
      cache-null-values: false
```

Con solo estas propiedades, Spring Boot autoconfigura un `RedisCacheManager` que serializa los valores como JSON.

### Configuración programática para TTL por caché

Si necesitas TTL diferentes para cada caché, configura el `RedisCacheManager` manualmente:

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair
                                .fromSerializer(new GenericJackson2JsonRedisSerializer())
                );

        Map<String, RedisCacheConfiguration> cacheConfigs = new HashMap<>();
        cacheConfigs.put("products", defaultConfig.entryTtl(Duration.ofMinutes(30)));
        cacheConfigs.put("categories", defaultConfig.entryTtl(Duration.ofHours(2)));
        cacheConfigs.put("users", defaultConfig.entryTtl(Duration.ofMinutes(5)));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigs)
                .build();
    }
}
```

### Serialización: hacer los objetos serializables

Con `GenericJackson2JsonRedisSerializer`, los objetos se guardan como JSON. Solo necesitas asegurarte de que las clases tengan constructor sin argumentos (o que Jackson pueda deserializarlas):

```java
@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS)
public record ProductResponse(
        Long id,
        String name,
        BigDecimal price,
        String category
) {}
```

La anotación `@JsonTypeInfo` es importante con `GenericJackson2JsonRedisSerializer` porque permite a Jackson reconstruir el tipo correcto al deserializar.

## Proveedor de caché: EhCache

EhCache es una buena alternativa cuando no quieres infraestructura externa (no necesitas un servidor Redis) y la aplicación corre en una sola instancia.

### Dependencias

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
<dependency>
    <groupId>org.ehcache</groupId>
    <artifactId>ehcache</artifactId>
</dependency>
<dependency>
    <groupId>javax.cache</groupId>
    <artifactId>cache-api</artifactId>
</dependency>
```

### Configuración

Crea el archivo `src/main/resources/ehcache.xml`:

```xml
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns="http://www.ehcache.org/v3"
        xsi:schemaLocation="http://www.ehcache.org/v3 http://www.ehcache.org/schema/ehcache-core.xsd">

    <cache alias="products">
        <expiry>
            <ttl unit="minutes">30</ttl>
        </expiry>
        <heap unit="entries">500</heap>
    </cache>

    <cache alias="categories">
        <expiry>
            <ttl unit="hours">2</ttl>
        </expiry>
        <heap unit="entries">100</heap>
    </cache>

</config>
```

En `application.yml`, apunta al archivo de configuración:

```yaml
spring:
  cache:
    type: jcache
    jcache:
      config: classpath:ehcache.xml
```

## KeyGenerator personalizado

Cuando las claves generadas automáticamente no son suficientes, puedes implementar tu propio `KeyGenerator`:

```java
@Component("customKeyGenerator")
public class CustomKeyGenerator implements KeyGenerator {

    @Override
    public Object generate(Object target, Method method, Object... params) {
        return target.getClass().getSimpleName()
                + "::" + method.getName()
                + "::" + Arrays.stream(params)
                        .map(Object::toString)
                        .collect(Collectors.joining("-"));
    }
}
```

Y referenciarlo en la anotación:

```java
@Cacheable(value = "products", keyGenerator = "customKeyGenerator")
public ProductResponse findById(Long id) { ... }
```

## Caché en la capa de repositorio vs servicio

Una pregunta frecuente es dónde colocar las anotaciones de caché: ¿en el repositorio o en el servicio?

La recomendación general es **siempre en el servicio** (o en la capa más alta que procesa la lógica de negocio), por varias razones:

- El servicio devuelve DTOs (objetos de transferencia), no entidades JPA. Las entidades tienen relaciones lazy que pueden fallar al serializarse fuera del contexto de persistencia.
- La lógica de caché es parte de la política de negocio, no de la infraestructura de datos.
- Es más fácil invalidar correctamente: el servicio conoce qué operaciones modifican el estado relevante.

```java
// ✅ Correcto: caché en el servicio sobre DTOs
@Cacheable(value = "products", key = "#id")
public ProductResponse findById(Long id) {
    return productRepository.findById(id)
            .map(this::mapToResponse)  // Convierte a DTO antes de cachear
            .orElseThrow(...);
}

// ❌ Evitar: caché directamente sobre entidades JPA
@Cacheable(value = "products", key = "#id")
public Product findById(Long id) { ... }
```

## Monitoreo con Spring Boot Actuator

Si tienes Spring Boot Actuator en el proyecto, el endpoint `/actuator/caches` expone las cachés configuradas y permite limpiarlas:

```bash
# Listar todos los cachés
GET /actuator/caches

# Limpiar un caché específico
DELETE /actuator/caches/products

# Limpiar todos los cachés
DELETE /actuator/caches
```

Habilita el endpoint en `application.yml`:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: caches, health, info
```

## Testing de métodos con caché

Al hacer pruebas unitarias o de integración, la caché puede interferir con los resultados esperados. Spring Test ofrece `@ClearCache` para limpiar antes de cada test, o puedes deshabilitarla con un perfil:

```java
@SpringBootTest
@ActiveProfiles("test")
class ProductServiceTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private CacheManager cacheManager;

    @BeforeEach
    void clearCache() {
        cacheManager.getCacheNames()
                .forEach(name -> cacheManager.getCache(name).clear());
    }

    @Test
    void findById_shouldCacheResult() {
        ProductResponse first = productService.findById(1L);
        ProductResponse second = productService.findById(1L);

        assertThat(first).isEqualTo(second);
        // Verificar que el repositorio solo fue llamado una vez
        verify(productRepository, times(1)).findById(1L);
    }
}
```

Para tests, usa el proveedor simple en `application-test.yml`:

```yaml
spring:
  cache:
    type: simple  # ConcurrentMapCacheManager, sin dependencias externas
```

## Buenas prácticas

1. **Nombra las cachés con constantes** para evitar errores de typo:

```java
public class CacheNames {
    public static final String PRODUCTS = "products";
    public static final String CATEGORIES = "categories";
    public static final String USERS = "users";
}

@Cacheable(value = CacheNames.PRODUCTS, key = "#id")
public ProductResponse findById(Long id) { ... }
```

2. **Define TTL explícitamente** para cada caché. Confiar en el TTL por defecto puede llevar a datos obsoletos o a memoria creciente sin límite.

3. **Invalida de forma proactiva** con `@CacheEvict` en todas las operaciones de escritura que afecten el dato cacheado. Una caché que no se invalida correctamente es peor que no tener caché.

4. **No caches por más tiempo del necesario**. La frecuencia de cambio del dato dicta el TTL: datos de configuración pueden durar horas; precios en e-commerce quizás segundos.

5. **Serializa solo lo necesario**. Cuanto más liviano sea el objeto cacheado, menor uso de memoria y menor latencia de deserialización.

6. **Evita cachear datos sensibles** (tokens, contraseñas, datos personales) o asegúrate de que el proveedor esté configurado con cifrado.

## Conclusión

La abstracción de caché de Spring Boot permite incorporar caché con un mínimo de código: unas pocas anotaciones bastan para almacenar, actualizar e invalidar resultados. La separación entre la lógica de negocio y el proveedor de caché hace que cambiar de `ConcurrentMap` a Redis o EhCache sea solo cuestión de configuración.

El siguiente paso es combinar la caché con la monitorización a través de Actuator para tener visibilidad sobre el comportamiento en producción: tasa de aciertos, tamaño de las cachés y latencia de acceso.
