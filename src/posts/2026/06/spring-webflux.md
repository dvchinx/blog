---
titulo: "Spring WebFlux: programación reactiva con Spring Boot"
seoTitulo: "Spring WebFlux: guía práctica de programación reactiva en Spring Boot"
fecha: "2026-06-11"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es Spring WebFlux, cómo funciona la programación reactiva con Mono y Flux, y cuándo tiene sentido usarla en lugar del modelo tradicional bloqueante."
imagenPortada: "https://miro.medium.com/1*NRBC0wt4t_ThDKYeu4AW2Q.png?w=800&h=500&fit=fill"
etiquetas: ["Spring Boot", "WebFlux", "Java", "Backend", "Reactive", "Programación Reactiva"]
categoria: "tech"
keywords: "Spring WebFlux, programación reactiva Java, Mono Flux, Project Reactor, reactive streams, Spring Boot reactivo, R2DBC, WebClient, non-blocking Spring"
---

# Spring WebFlux: programación reactiva con Spring Boot

La mayoría de las aplicaciones Spring Boot usan el modelo de servlet tradicional: cada petición ocupa un hilo hasta que termina, incluyendo el tiempo de espera de operaciones de I/O. Ese modelo funciona bien en la mayoría de los casos, pero empieza a mostrar limitaciones cuando el sistema hace muchas llamadas externas en paralelo o necesita manejar miles de conexiones concurrentes.

Spring WebFlux es la respuesta de Spring a ese problema. Ofrece un modelo de programación no bloqueante basado en flujos reactivos que permite hacer más trabajo con menos hilos.

## ¿Qué es la programación reactiva?

La programación reactiva es un paradigma orientado al flujo de datos asíncrono. En lugar de esperar activamente a que una operación termine, defines transformaciones y reacciones sobre los datos que llegarán en el futuro.

Los pilares son:

- **Asincronía**: las operaciones no bloquean el hilo mientras esperan.
- **Flujos de datos**: los datos se procesan como secuencias (streams) que pueden tener 0, 1 o N elementos.
- **Backpressure**: el consumidor puede señalar al productor que baje el ritmo, evitando desbordamientos.

Spring WebFlux implementa la especificación **Reactive Streams** a través de **Project Reactor**, que define dos tipos principales: `Mono` y `Flux`.

## Mono y Flux

### Mono

Representa un flujo de **0 o 1 elemento**. Es el equivalente reactivo de un valor opcional o una operación que devuelve un único resultado.

```java
Mono<String> nombre = Mono.just("Jesús");
Mono<String> vacio = Mono.empty();
Mono<String> error = Mono.error(new RuntimeException("algo salió mal"));
```

### Flux

Representa un flujo de **0 a N elementos**. Es el equivalente reactivo de una lista o un stream de datos.

```java
Flux<String> lenguajes = Flux.just("Java", "Kotlin", "Python");
Flux<Integer> numeros = Flux.range(1, 10);
Flux<Long> ticks = Flux.interval(Duration.ofSeconds(1)); // emite cada segundo
```

Ambos tipos son **lazy**: no ejecutan nada hasta que alguien se suscribe con `.subscribe()`.

## Configuración del proyecto

Para usar Spring WebFlux, agrega el starter correspondiente en lugar del starter web tradicional:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

**Importante**: `spring-boot-starter-web` y `spring-boot-starter-webflux` no deben coexistir en el mismo proyecto. Si están juntos, Spring Boot da prioridad al modelo de servlets.

## Controladores reactivos

La sintaxis de los controladores es casi idéntica a la de Spring MVC. La diferencia está en los tipos de retorno: en lugar de devolver objetos directamente, devuelves `Mono` o `Flux`.

```java
@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public Flux<ProductDto> findAll() {
        return productService.findAll();
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<ProductDto>> findById(@PathVariable Long id) {
        return productService.findById(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Mono<ProductDto> create(@RequestBody @Valid Mono<CreateProductRequest> request) {
        return request.flatMap(productService::create);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> delete(@PathVariable Long id) {
        return productService.delete(id);
    }
}
```

El servidor web por defecto en WebFlux es **Netty** (no Tomcat), que implementa un loop de eventos no bloqueante similar al modelo de Node.js.

## Operadores esenciales

Project Reactor ofrece un conjunto rico de operadores para transformar y componer flujos. Los más usados son:

### map y flatMap

```java
// map: transformación síncrona 1-a-1
Mono<String> upper = Mono.just("hola")
        .map(String::toUpperCase); // "HOLA"

// flatMap: transformación asíncrona (cuando el resultado es otro Mono/Flux)
Mono<ProductDto> producto = productRepository.findById(1L)
        .flatMap(entity -> categoryRepository.findById(entity.getCategoryId())
                .map(cat -> toDto(entity, cat)));
```

La regla práctica: usa `map` cuando la transformación es síncrona y directa; usa `flatMap` cuando la transformación devuelve otro `Mono` o `Flux`.

### filter y defaultIfEmpty

```java
Mono<Product> activo = productRepository.findById(id)
        .filter(Product::isActive)
        .defaultIfEmpty(Product.inactive());
```

### zip y zipWith

Para combinar resultados de múltiples fuentes en paralelo:

```java
Mono<ProductDetail> detail = Mono.zip(
        productRepository.findById(id),
        reviewRepository.findByProductId(id).collectList(),
        stockService.getStock(id)
).map(tuple -> new ProductDetail(tuple.getT1(), tuple.getT2(), tuple.getT3()));
```

`Mono.zip` suscribe a los tres simultáneamente y espera a que todos completen.

### collectList y collectMap

Para convertir un `Flux` en un `Mono` con la colección completa:

```java
Mono<List<Product>> lista = productRepository.findAll().collectList();

Mono<Map<Long, Product>> mapa = productRepository.findAll()
        .collectMap(Product::getId);
```

### onErrorReturn y onErrorResume

Para manejar errores de forma reactiva:

```java
Mono<Product> conFallback = productRepository.findById(id)
        .onErrorReturn(Product.empty());

Mono<Product> conRecuperacion = productRepository.findById(id)
        .onErrorResume(ex -> cacheService.findById(id));
```

## Capa de servicio reactiva

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;

    public Flux<ProductDto> findAll() {
        return productRepository.findAll()
                .map(this::toDto);
    }

    public Mono<ProductDto> findById(Long id) {
        return productRepository.findById(id)
                .switchIfEmpty(Mono.error(new ProductNotFoundException(id)))
                .map(this::toDto);
    }

    public Mono<ProductDto> create(CreateProductRequest request) {
        return categoryRepository.findById(request.categoryId())
                .switchIfEmpty(Mono.error(new CategoryNotFoundException(request.categoryId())))
                .flatMap(category -> {
                    Product product = Product.builder()
                            .name(request.name())
                            .price(request.price())
                            .category(category)
                            .build();
                    return productRepository.save(product);
                })
                .map(this::toDto);
    }

    public Mono<Void> delete(Long id) {
        return productRepository.findById(id)
                .switchIfEmpty(Mono.error(new ProductNotFoundException(id)))
                .flatMap(productRepository::delete);
    }

    private ProductDto toDto(Product product) {
        return new ProductDto(product.getId(), product.getName(), product.getPrice());
    }
}
```

## Persistencia reactiva con R2DBC

Para mantener la pila completamente no bloqueante, la capa de base de datos también debe ser asíncrona. JPA/Hibernate es bloqueante por naturaleza, así que WebFlux usa **R2DBC** (Reactive Relational Database Connectivity).

Dependencias para PostgreSQL:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-r2dbc</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>r2dbc-postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

Configuración en `application.yml`:

```yaml
spring:
  r2dbc:
    url: r2dbc:postgresql://localhost:5432/mydb
    username: postgres
    password: secret
```

La entidad con R2DBC es más simple que con JPA:

```java
@Table("products")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    @Id
    private Long id;
    private String name;
    private BigDecimal price;
    private Long categoryId; // referencia por ID, no por objeto
    private LocalDateTime createdAt;
}
```

R2DBC no soporta relaciones entre entidades como JPA. Las asociaciones se resuelven manualmente con `flatMap` o `zip`. Este es uno de sus mayores compromisos: ganas asincronía, pero pierdes la comodidad del ORM.

El repositorio extiende `ReactiveCrudRepository`:

```java
public interface ProductRepository extends ReactiveCrudRepository<Product, Long> {

    Flux<Product> findByCategoryId(Long categoryId);

    Flux<Product> findByPriceLessThan(BigDecimal maxPrice);
}
```

## WebClient: llamadas HTTP reactivas

Cuando tu aplicación necesita llamar a servicios externos, `WebClient` es la alternativa reactiva a `RestTemplate` o `RestClient`:

```java
@Component
public class InventoryClient {

    private final WebClient webClient;

    public InventoryClient(WebClient.Builder builder) {
        this.webClient = builder
                .baseUrl("http://inventory-service")
                .build();
    }

    public Mono<Integer> getStock(Long productId) {
        return webClient.get()
                .uri("/stock/{id}", productId)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError,
                        response -> Mono.error(new ProductNotFoundException(productId)))
                .bodyToMono(StockResponse.class)
                .map(StockResponse::quantity);
    }

    public Flux<InventoryItem> findLowStock(int threshold) {
        return webClient.get()
                .uri(uri -> uri.path("/stock/low")
                        .queryParam("threshold", threshold)
                        .build())
                .retrieve()
                .bodyToFlux(InventoryItem.class);
    }
}
```

`WebClient` puede usarse también en proyectos Spring MVC (no reactivos) cuando necesitas hacer llamadas HTTP asíncronas. No es exclusivo de WebFlux.

## Cuándo usar WebFlux y cuándo no

**Tiene sentido con WebFlux cuando:**

- La aplicación hace muchas llamadas a servicios externos o bases de datos de forma concurrente.
- El sistema necesita manejar un alto número de conexiones simultáneas con pocos recursos.
- Estás construyendo una API gateway o un aggregator que combina respuestas de múltiples servicios.
- Necesitas streaming de datos en tiempo real (Server-Sent Events, WebSocket).

**No tiene sentido con WebFlux cuando:**

- La lógica de negocio es CPU-intensiva (WebFlux no mejora el rendimiento en cómputo puro).
- El equipo no está familiarizado con la programación reactiva y los tiempos de entrega son ajustados.
- Usas librerías que solo tienen APIs bloqueantes (no tiene sentido mezclar bloqueante dentro de una cadena reactiva).
- La aplicación es simple y no tiene cuellos de botella de concurrencia.

Adoptar WebFlux por moda o porque "es más moderno" sin una necesidad real solo añade complejidad sin beneficio.

## Error frecuente: bloquear dentro de una cadena reactiva

El error más común al empezar con WebFlux es llamar a código bloqueante dentro de un operador reactivo:

```java
// MAL: bloquea el hilo del event loop
public Mono<ProductDto> findById(Long id) {
    return Mono.just(id)
            .map(i -> productRepository.findById(i).block()); // nunca hagas esto
}

// BIEN: la cadena es completamente asíncrona
public Mono<ProductDto> findById(Long id) {
    return productRepository.findById(id)
            .map(this::toDto);
}
```

Si absolutamente necesitas llamar código bloqueante (por ejemplo, una librería que no tiene API reactiva), usa `Mono.fromCallable()` junto con `subscribeOn(Schedulers.boundedElastic())` para moverlo a un pool de hilos separado:

```java
public Mono<String> llamadaBloqueante(String input) {
    return Mono.fromCallable(() -> servicioLegacy.procesar(input))
            .subscribeOn(Schedulers.boundedElastic());
}
```

## Buenas prácticas

1. **No mezcles bloqueante con reactivo** en la misma cadena. Si tienes código bloqueante, aíslalo con `Schedulers.boundedElastic()`.
2. **Usa `switchIfEmpty` para casos vacíos** en lugar de chequeos null: es más expresivo y evita `NullPointerException`.
3. **Prefiere `flatMap` sobre `map` + `block()`**. Si una transformación devuelve un `Mono`, encadénala con `flatMap`.
4. **Limita el uso de `collectList()`** en listas muy grandes: acumula todos los elementos en memoria antes de continuar.
5. **Activa el debug mode en desarrollo** con `Hooks.onOperatorDebug()` para obtener stack traces útiles. En producción es costoso, desactívalo.
6. **Escribe tests con `StepVerifier`** del módulo `reactor-test` en lugar de suscribirte manualmente.

```java
@Test
void findById_deberiaRetornarProducto() {
    when(productRepository.findById(1L)).thenReturn(Mono.just(product));

    StepVerifier.create(productService.findById(1L))
            .expectNextMatches(dto -> dto.id().equals(1L))
            .verifyComplete();
}

@Test
void findById_deberiaLanzarExcepcionSiNoExiste() {
    when(productRepository.findById(99L)).thenReturn(Mono.empty());

    StepVerifier.create(productService.findById(99L))
            .expectError(ProductNotFoundException.class)
            .verify();
}
```

## Conclusión

Spring WebFlux es una herramienta poderosa para escenarios donde el modelo bloqueante tradicional se queda corto: alta concurrencia, muchas llamadas externas en paralelo o streaming de datos. Su modelo de programación con `Mono` y `Flux` requiere un cambio de mentalidad, pero una vez asimilado resulta expresivo y predecible.

El punto clave es elegirlo cuando hay una razón concreta: un cuello de botella de I/O, necesidad de concurrencia masiva o streaming en tiempo real. Para la mayoría de los proyectos CRUD, Spring MVC sigue siendo la opción más pragmática. Cuando el problema requiere lo que WebFlux ofrece, la inversión en aprenderlo se recupera rápido.
