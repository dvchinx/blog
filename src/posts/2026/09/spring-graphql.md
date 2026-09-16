---
titulo: "APIs GraphQL con Spring Boot y Spring GraphQL"
seoTitulo: "Spring GraphQL: construir APIs GraphQL con Spring Boot — esquema, resolvers, DataLoaders y testing"
fecha: "2026-09-17"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a construir APIs GraphQL con Spring Boot y Spring GraphQL: definición de esquema SDL, anotaciones de mapeo, resolución de relaciones, el problema N+1 con DataLoaders, manejo de errores y testing."
imagenPortada: "https://i.imgur.com/UktyzLI.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "GraphQL", "Java", "API", "Backend", "Spring GraphQL"]
categoria: "tech"
keywords: "spring graphql, spring boot graphql, graphql java spring, spring graphql tutorial, graphql schema spring boot, querymapping spring graphql, spring graphql dataloader, n+1 graphql spring, graphql mutations spring boot, spring graphql testing, graphqltest, graphql subscriptions spring, spring graphql error handling"
---

# APIs GraphQL con Spring Boot y Spring GraphQL

El modelo REST lleva décadas siendo la arquitectura dominante para APIs web y por buenas razones: es simple, stateless y se apoya sobre HTTP de manera natural. Sin embargo, en aplicaciones con múltiples clientes —web, móvil, dispositivos con ancho de banda limitado— aparece un problema recurrente: el cliente recibe demasiados datos o tiene que combinar varias llamadas para obtener lo que necesita. El primero se conoce como **over-fetching**; el segundo, como **under-fetching**.

**GraphQL** resuelve ambos problemas desde el diseño. En lugar de endpoints fijos que devuelven estructuras predefinidas, GraphQL expone un único endpoint al que el cliente envía una consulta declarando exactamente qué campos necesita. El servidor devuelve exactamente eso: ni más, ni menos. Además, el cliente puede obtener datos relacionados en una sola petición, eliminando la necesidad de múltiples llamadas.

**Spring GraphQL**, parte oficial del ecosistema Spring desde la versión 6.0 de Spring Framework y disponible en Spring Boot desde la 2.7, trae esta capacidad al mundo Java con la filosofía habitual de Spring: convención sobre configuración, integración natural con el resto del stack, y anotaciones que mantienen el código limpio y enfocado en la lógica de negocio.

## ¿Por qué GraphQL en lugar de REST?

Antes de entrar en la implementación, vale la pena delimitar cuándo GraphQL aporta valor real y cuándo REST sigue siendo la mejor opción.

GraphQL brilla cuando hay múltiples clientes con necesidades de datos distintas (una app móvil que pide datos mínimos frente a un panel de administración que necesita todo), cuando las relaciones entre entidades son complejas y el cliente necesita navegar grafos de objetos, o cuando el frontend evoluciona rápido y depender de que el backend cambie cada endpoint es un cuello de botella.

REST sigue siendo la elección natural para APIs públicas simples, para casos donde el caching HTTP agresivo es crítico (GraphQL usa POST por defecto, lo que complica el caching de red), o para equipos que no tienen experiencia previa con GraphQL y el proyecto no justifica la curva de aprendizaje.

No es una elección excluyente: muchas arquitecturas combinan ambas.

## Configuración en Spring Boot

Añade las dependencias en `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-graphql</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<!-- Para WebSocket y subscriptions -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

Spring Boot autoconfigura Spring GraphQL sin configuración manual. El endpoint por defecto es `POST /graphql`. También puedes habilitar **GraphiQL**, el IDE interactivo en el navegador:

```yaml
spring:
  graphql:
    graphiql:
      enabled: true          # Disponible en http://localhost:8080/graphiql
    path: /graphql
    websocket:
      path: /graphql-ws      # Para subscriptions
```

## Definición del esquema SDL

GraphQL usa un lenguaje de definición de esquema (**SDL**, Schema Definition Language) independiente del lenguaje de implementación. El esquema es el contrato entre cliente y servidor: define qué tipos existen, qué campos tienen, y qué operaciones se pueden ejecutar.

Spring GraphQL busca archivos `.graphqls` en `src/main/resources/graphql/` y los combina automáticamente. Un esquema típico:

```graphql
# src/main/resources/graphql/schema.graphqls

type Query {
    libro(id: ID!): Libro
    libros(pagina: Int = 0, tamaño: Int = 10): [Libro!]!
    buscarLibros(titulo: String!): [Libro!]!
}

type Mutation {
    crearLibro(input: CrearLibroInput!): Libro!
    actualizarLibro(id: ID!, input: ActualizarLibroInput!): Libro!
    eliminarLibro(id: ID!): Boolean!
}

type Subscription {
    libroCreado: Libro!
}

type Libro {
    id: ID!
    titulo: String!
    isbn: String!
    publicadoEn: String
    autor: Autor!
    reseñas: [Reseña!]!
    puntuacionPromedio: Float
}

type Autor {
    id: ID!
    nombre: String!
    apellido: String!
    libros: [Libro!]!
}

type Reseña {
    id: ID!
    puntuacion: Int!
    comentario: String
    usuario: String!
    fechaCreacion: String!
}

input CrearLibroInput {
    titulo: String!
    isbn: String!
    publicadoEn: String
    autorId: ID!
}

input ActualizarLibroInput {
    titulo: String
    isbn: String
    publicadoEn: String
}
```

Los tipos no nulos se indican con `!`. Las listas se expresan con `[Tipo]`. Los tipos de entrada (`input`) se usan para mutaciones y permiten agrupar los parámetros de escritura en un objeto estructurado.

## Modelos y repositorios

Antes de los resolvers, los modelos de dominio y repositorios:

```java
@Entity
public class Libro {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String titulo;
    private String isbn;
    private LocalDate publicadoEn;

    @ManyToOne(fetch = FetchType.LAZY)
    private Autor autor;

    @OneToMany(mappedBy = "libro", fetch = FetchType.LAZY)
    private List<Reseña> reseñas = new ArrayList<>();

    // getters, setters
}

@Entity
public class Autor {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre;
    private String apellido;

    @OneToMany(mappedBy = "autor", fetch = FetchType.LAZY)
    private List<Libro> libros = new ArrayList<>();
    // getters, setters
}

@Entity
public class Reseña {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private int puntuacion;
    private String comentario;
    private String usuario;
    private LocalDateTime fechaCreacion;

    @ManyToOne(fetch = FetchType.LAZY)
    private Libro libro;
    // getters, setters
}
```

```java
public interface LibroRepository extends JpaRepository<Libro, Long> {
    List<Libro> findByTituloContainingIgnoreCase(String titulo);
    Page<Libro> findAll(Pageable pageable);
}

public interface AutorRepository extends JpaRepository<Autor, Long> {}
public interface ReseñaRepository extends JpaRepository<Reseña, Long> {
    List<Reseña> findByLibroId(Long libroId);
    List<Reseña> findByLibroIdIn(List<Long> libroIds);
}
```

## Resolvers con anotaciones de Spring GraphQL

Spring GraphQL mapea los campos del esquema a métodos Java mediante anotaciones. El controlador actúa como resolver:

```java
@Controller
public class LibroController {

    private final LibroRepository libroRepository;
    private final AutorRepository autorRepository;

    public LibroController(LibroRepository libroRepository,
                           AutorRepository autorRepository) {
        this.libroRepository = libroRepository;
        this.autorRepository = autorRepository;
    }

    // ── Queries ─────────────────────────────────────────────────────────────

    @QueryMapping
    public Optional<Libro> libro(@Argument Long id) {
        return libroRepository.findById(id);
    }

    @QueryMapping
    public Page<Libro> libros(@Argument int pagina, @Argument int tamaño) {
        return libroRepository.findAll(PageRequest.of(pagina, tamaño));
    }

    @QueryMapping
    public List<Libro> buscarLibros(@Argument String titulo) {
        return libroRepository.findByTituloContainingIgnoreCase(titulo);
    }

    // ── Mutaciones ───────────────────────────────────────────────────────────

    @MutationMapping
    public Libro crearLibro(@Argument CrearLibroInput input) {
        Autor autor = autorRepository.findById(input.getAutorId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Autor no encontrado: " + input.getAutorId()));

        Libro libro = new Libro();
        libro.setTitulo(input.getTitulo());
        libro.setIsbn(input.getIsbn());
        if (input.getPublicadoEn() != null) {
            libro.setPublicadoEn(LocalDate.parse(input.getPublicadoEn()));
        }
        libro.setAutor(autor);

        return libroRepository.save(libro);
    }

    @MutationMapping
    public Libro actualizarLibro(@Argument Long id,
                                  @Argument ActualizarLibroInput input) {
        Libro libro = libroRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Libro no encontrado: " + id));

        if (input.getTitulo() != null)      libro.setTitulo(input.getTitulo());
        if (input.getIsbn() != null)        libro.setIsbn(input.getIsbn());
        if (input.getPublicadoEn() != null) libro.setPublicadoEn(
                LocalDate.parse(input.getPublicadoEn()));

        return libroRepository.save(libro);
    }

    @MutationMapping
    public boolean eliminarLibro(@Argument Long id) {
        if (!libroRepository.existsById(id)) return false;
        libroRepository.deleteById(id);
        return true;
    }
}
```

La anotación `@QueryMapping` mapea el método al campo del mismo nombre en el tipo `Query` del esquema. `@Argument` extrae los argumentos de la petición GraphQL. Si el nombre del método difiere del campo del esquema, puedes especificarlo: `@QueryMapping("buscarLibros")`.

Para los tipos con relaciones, los campos que requieren cargar datos adicionales se resuelven con `@SchemaMapping`:

```java
@Controller
public class LibroRelacionesController {

    private final ReseñaRepository reseñaRepository;

    public LibroRelacionesController(ReseñaRepository reseñaRepository) {
        this.reseñaRepository = reseñaRepository;
    }

    @SchemaMapping(typeName = "Libro", field = "reseñas")
    public List<Reseña> reseñas(Libro libro) {
        return reseñaRepository.findByLibroId(libro.getId());
    }

    @SchemaMapping(typeName = "Libro", field = "puntuacionPromedio")
    public Double puntuacionPromedio(Libro libro) {
        List<Reseña> reseñas = reseñaRepository.findByLibroId(libro.getId());
        return reseñas.isEmpty()
                ? null
                : reseñas.stream()
                         .mapToInt(Reseña::getPuntuacion)
                         .average()
                         .orElse(0.0);
    }

    @SchemaMapping(typeName = "Autor", field = "libros")
    public List<Libro> librosDelAutor(Autor autor,
                                       LibroRepository libroRepository) {
        return libroRepository.findByAutorId(autor.getId());
    }
}
```

`@SchemaMapping` recibe la instancia del objeto padre como primer argumento. Spring GraphQL inyecta automáticamente las dependencias adicionales declaradas como parámetros del método.

## El problema N+1 y los DataLoaders

El mayor riesgo de rendimiento en GraphQL es el problema **N+1**: si el cliente consulta 100 libros y cada libro necesita resolver su autor, el servidor ejecuta 1 consulta para los libros y 100 consultas adicionales para los autores (una por libro). Con relaciones anidadas, el problema se multiplica.

La solución es **DataLoader**: una utilidad que acumula las peticiones de un mismo tipo durante la resolución de un nivel del árbol y las ejecuta en un único lote.

```java
@Component
public class AutorDataLoader {

    private final AutorRepository autorRepository;

    public AutorDataLoader(AutorRepository autorRepository) {
        this.autorRepository = autorRepository;
    }

    // Spring GraphQL registra automáticamente los beans que implementan
    // BatchLoaderRegistry o que definen métodos anotados
    @Bean
    public BatchLoaderRegistry batchLoaderRegistry() {
        return BatchLoaderRegistry.newRegistry();
    }
}
```

La forma más directa con Spring GraphQL es registrar el batch loader en la configuración:

```java
@Configuration
public class DataLoaderConfig {

    @Bean
    public RuntimeWiringConfigurer dataLoaderWiringConfigurer(
            AutorRepository autorRepository,
            ReseñaRepository reseñaRepository) {

        return wiringBuilder -> {
            // El DataLoader de autores se registra con el nombre "AutorDataLoader"
        };
    }
}
```

La integración más limpia usa `@SchemaMapping` con `DataLoader` como parámetro:

```java
@SchemaMapping(typeName = "Libro", field = "autor")
public CompletableFuture<Autor> autor(Libro libro,
                                      DataLoader<Long, Autor> dataLoader) {
    // DataLoader acumula todos los autorId del nivel actual
    // y ejecuta un único batch con todos ellos
    return dataLoader.load(libro.getAutor().getId());
}
```

Para que esto funcione, registra el DataLoader con el nombre que coincida con el tipo (`Autor`) en la configuración de la aplicación:

```java
@Configuration
public class DataLoaderConfig {

    @Bean
    public BatchLoaderRegistry batchLoaderRegistry(AutorRepository autorRepository) {
        return BatchLoaderRegistry.newRegistry()
                .forTypePair(Long.class, Autor.class)
                .withName("AutorDataLoader")
                .registerBatchLoader((ids, environment) ->
                    Mono.fromCallable(() -> {
                        List<Autor> autores = autorRepository.findAllById(ids);
                        Map<Long, Autor> mapa = autores.stream()
                                .collect(Collectors.toMap(Autor::getId, a -> a));
                        return ids.stream()
                                .map(mapa::get)
                                .collect(Collectors.toList());
                    })
                );
    }
}
```

Con el DataLoader activo, 100 libros generan exactamente 2 consultas a base de datos: una para los libros y una para todos sus autores. El speedup en APIs con relaciones complejas puede ser de órdenes de magnitud.

## Subscriptions con WebSocket

GraphQL soporta subscriptions para datos en tiempo real. Spring GraphQL las implementa sobre WebSocket usando el protocolo `graphql-ws`:

```graphql
# El esquema ya define:
type Subscription {
    libroCreado: Libro!
}
```

```java
@Controller
public class LibroSubscriptionController {

    private final Sinks.Many<Libro> librosSink;

    public LibroSubscriptionController() {
        // Un sink de Reactor que actúa como canal de eventos
        this.librosSink = Sinks.many().multicast().onBackpressureBuffer();
    }

    @SubscriptionMapping
    public Flux<Libro> libroCreado() {
        return librosSink.asFlux();
    }

    // Este método puede llamarse desde un servicio cuando se crea un libro
    public void publicarLibroCreado(Libro libro) {
        librosSink.tryEmitNext(libro);
    }
}
```

Desde el controlador de mutaciones, inyecta y notifica al sink cuando se crea un libro:

```java
@MutationMapping
public Libro crearLibro(@Argument CrearLibroInput input) {
    // ... lógica de creación
    Libro libro = libroRepository.save(nuevoLibro);
    subscriptionController.publicarLibroCreado(libro);  // notifica a suscriptores
    return libro;
}
```

Un cliente puede suscribirse con:

```graphql
subscription {
    libroCreado {
        id
        titulo
        autor {
            nombre
            apellido
        }
    }
}
```

## Manejo de errores

GraphQL no usa códigos de estado HTTP para errores de negocio: siempre devuelve `200 OK` y los errores van en el campo `errors` de la respuesta JSON. Spring GraphQL proporciona varias formas de controlar este comportamiento.

### DataFetcherExceptionResolver

Para errores controlados, implementa `DataFetcherExceptionResolverAdapter`:

```java
@Component
public class GraphQLExceptionHandler extends DataFetcherExceptionResolverAdapter {

    @Override
    protected GraphQLError resolveToSingleError(Throwable ex,
                                                 DataFetchingEnvironment env) {
        if (ex instanceof EntityNotFoundException notFound) {
            return GraphqlErrorBuilder.newError(env)
                    .errorType(ErrorType.NOT_FOUND)
                    .message(notFound.getMessage())
                    .build();
        }

        if (ex instanceof IllegalArgumentException illegalArg) {
            return GraphqlErrorBuilder.newError(env)
                    .errorType(ErrorType.BAD_REQUEST)
                    .message(illegalArg.getMessage())
                    .build();
        }

        // Para errores no manejados, delega al comportamiento por defecto
        return null;
    }
}
```

### Errores de validación

Para campos marcados con Bean Validation (`@Valid`, `@NotBlank`, etc.) en los inputs, Spring GraphQL los captura y transforma automáticamente en errores GraphQL cuando se configura correctamente:

```java
public record CrearLibroInput(
        @NotBlank String titulo,
        @NotBlank String isbn,
        @NotNull Long autorId
) {}

@MutationMapping
public Libro crearLibro(@Argument @Valid CrearLibroInput input) {
    // Si input no pasa la validación, Spring GraphQL
    // lanza ConstraintViolationException automáticamente
    return libroService.crear(input);
}
```

### Errores personalizados con extensiones

GraphQL permite incluir información adicional en el campo `extensions` de cada error:

```java
return GraphqlErrorBuilder.newError(env)
        .errorType(ErrorType.NOT_FOUND)
        .message("Libro no encontrado con ID: " + id)
        .extensions(Map.of(
                "errorCode", "LIBRO_NOT_FOUND",
                "timestamp", Instant.now().toString()
        ))
        .build();
```

## Paginación

GraphQL no define un estándar de paginación, pero hay dos enfoques comunes: **offset-based** y **cursor-based** (Connection). Spring GraphQL soporta ambos.

### Paginación por offset (simple)

```graphql
type Query {
    libros(pagina: Int = 0, tamaño: Int = 10): PaginaLibros!
}

type PaginaLibros {
    contenido: [Libro!]!
    totalElementos: Int!
    totalPaginas: Int!
    paginaActual: Int!
    tieneProxima: Boolean!
}
```

```java
@QueryMapping
public Map<String, Object> libros(@Argument int pagina, @Argument int tamaño) {
    Page<Libro> page = libroRepository.findAll(
            PageRequest.of(pagina, tamaño, Sort.by("titulo")));
    return Map.of(
            "contenido",        page.getContent(),
            "totalElementos",   page.getTotalElements(),
            "totalPaginas",     page.getTotalPages(),
            "paginaActual",     page.getNumber(),
            "tieneProxima",     page.hasNext()
    );
}
```

### Cursor-based (Connection Spec)

Para listas grandes donde el offset sería ineficiente, la **Relay Connection Specification** es el estándar de facto. Spring GraphQL la soporta nativamente:

```graphql
type Query {
    libros(first: Int, after: String, last: Int, before: String): LibroConnection!
}

type LibroConnection {
    edges: [LibroEdge!]!
    pageInfo: PageInfo!
}

type LibroEdge {
    node: Libro!
    cursor: String!
}

type PageInfo {
    hasPreviousPage: Boolean!
    hasNextPage: Boolean!
    startCursor: String
    endCursor: String
}
```

```java
@QueryMapping
public Connection<Libro> libros(ScrollSubrange subrange) {
    // Spring GraphQL convierte automáticamente first/after/last/before
    // en un ScrollSubrange que puede usarse con Spring Data
    CursorPageable pageable = subrange.position()
            .map(pos -> ScrollPosition.of(Map.of("id", pos.key()), ScrollPosition.Direction.FORWARD))
            .map(pos -> CursorRequest.of(pos, subrange.count().orElse(10)))
            .orElse(CursorRequest.of(ScrollPosition.offset(), subrange.count().orElse(10)));

    // Simplificado: devuelve una Window usando Spring Data Scroll
    Window<Libro> window = libroRepository.findAll(
            ScrollPosition.offset(), PageRequest.of(0, subrange.count().orElse(10)));

    return DefaultConnectionFactory.create(window);
}
```

La integración de cursores con Spring Data evoluciona rápidamente; consulta la documentación oficial de Spring GraphQL para la versión específica que estés usando.

## Testing

Spring GraphQL incluye soporte de testing con `@GraphQlTest` y un cliente `GraphQlTester` que permite escribir tests legibles:

```java
@GraphQlTest(LibroController.class)
class LibroControllerTest {

    @Autowired
    private GraphQlTester graphQlTester;

    @MockBean
    private LibroRepository libroRepository;

    @MockBean
    private AutorRepository autorRepository;

    @Test
    void cuandoSeConsultaLibroPorId_devuelveLibro() {
        Autor autor = new Autor();
        autor.setId(1L);
        autor.setNombre("Gabriel");
        autor.setApellido("García Márquez");

        Libro libro = new Libro();
        libro.setId(1L);
        libro.setTitulo("Cien años de soledad");
        libro.setIsbn("978-0-06-088328-7");
        libro.setAutor(autor);

        when(libroRepository.findById(1L)).thenReturn(Optional.of(libro));

        graphQlTester.document("""
                query {
                    libro(id: 1) {
                        id
                        titulo
                        autor {
                            nombre
                            apellido
                        }
                    }
                }
                """)
                .execute()
                .path("libro.id").entity(String.class).isEqualTo("1")
                .path("libro.titulo").entity(String.class).isEqualTo("Cien años de soledad")
                .path("libro.autor.nombre").entity(String.class).isEqualTo("Gabriel");
    }

    @Test
    void cuandoSeCrearLibro_retornaLibroPersistido() {
        Autor autor = new Autor();
        autor.setId(1L);
        autor.setNombre("Isabel");
        autor.setApellido("Allende");

        Libro libro = new Libro();
        libro.setId(2L);
        libro.setTitulo("La casa de los espíritus");
        libro.setIsbn("978-0-14-043915-7");
        libro.setAutor(autor);

        when(autorRepository.findById(1L)).thenReturn(Optional.of(autor));
        when(libroRepository.save(any())).thenReturn(libro);

        graphQlTester.document("""
                mutation {
                    crearLibro(input: {
                        titulo: "La casa de los espíritus",
                        isbn: "978-0-14-043915-7",
                        autorId: "1"
                    }) {
                        id
                        titulo
                    }
                }
                """)
                .execute()
                .path("crearLibro.id").entity(String.class).isEqualTo("2")
                .path("crearLibro.titulo").entity(String.class)
                        .isEqualTo("La casa de los espíritus");
    }

    @Test
    void cuandoLibroNoExiste_devuelveError() {
        when(libroRepository.findById(999L)).thenReturn(Optional.empty());

        graphQlTester.document("""
                query {
                    libro(id: 999) {
                        titulo
                    }
                }
                """)
                .execute()
                .path("libro").valueIsNull();
    }
}
```

Para tests de integración completa con base de datos real, combina `@SpringBootTest` con `HttpGraphQlTester`:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LibroIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    private HttpGraphQlTester graphQlTester;

    @BeforeEach
    void setUp() {
        graphQlTester = HttpGraphQlTester.builder(
                        restTemplate.getRootUri() + "/graphql")
                .build();
    }

    @Test
    void flujoCompletoCrearYConsultarLibro() {
        // 1. Crear libro
        // 2. Consultar por id
        // Assertions sobre el resultado
    }
}
```

## Introspección y documentación

GraphQL soporta **introspección** de forma nativa: el cliente puede consultar el esquema completo enviando una query de introspección estándar. GraphiQL (habilitado con `spring.graphql.graphiql.enabled=true`) usa esto para ofrecer autocompletado y documentación interactiva.

Para añadir descripciones que aparezcan en la documentación del esquema, usa comentarios SDL:

```graphql
"""
Representa un libro en el catálogo.
"""
type Libro {
    id: ID!

    """
    Título completo del libro tal como aparece en la portada.
    """
    titulo: String!

    """
    ISBN-13 del libro.
    """
    isbn: String!
}
```

En producción, es recomendable deshabilitar la introspección para evitar exponer el esquema completo:

```yaml
spring:
  graphql:
    schema:
      introspection:
        enabled: false  # Deshabilitar en producción
```

## Seguridad

Spring Security se integra con Spring GraphQL de forma transparente. Puedes usar `@PreAuthorize` en los métodos de los controladores:

```java
@Controller
public class LibroController {

    @QueryMapping
    @PreAuthorize("isAuthenticated()")
    public List<Libro> libros(@Argument int pagina, @Argument int tamaño) {
        // Solo usuarios autenticados
    }

    @MutationMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Libro crearLibro(@Argument CrearLibroInput input) {
        // Solo administradores
    }
}
```

Para manejar errores de autorización de forma apropiada en el contexto de GraphQL (devolviendo `UNAUTHORIZED` en el campo `errors` en lugar de un HTTP 403):

```java
@Component
public class SecurityExceptionHandler extends DataFetcherExceptionResolverAdapter {

    @Override
    protected GraphQLError resolveToSingleError(Throwable ex, DataFetchingEnvironment env) {
        if (ex instanceof AccessDeniedException) {
            return GraphqlErrorBuilder.newError(env)
                    .errorType(ErrorType.FORBIDDEN)
                    .message("No tienes permisos para realizar esta operación")
                    .build();
        }
        return null;
    }
}
```

## Mejores prácticas

**Diseña el esquema desde el cliente, no desde la base de datos.** El esquema GraphQL no debería ser un reflejo del modelo relacional. Diseña los tipos y campos pensando en qué datos necesita el cliente, no en cómo están almacenados. Esto puede significar desnormalizar, combinar, o dividir conceptos respecto al modelo de datos interno.

**Usa DataLoaders para todas las relaciones.** Cualquier campo de tipo objeto o lista que requiera una consulta adicional es un candidato para DataLoader. Sin él, el rendimiento con colecciones medianas se degrada rápidamente. Aplica DataLoader como regla por defecto, no como optimización posterior.

**Valida los inputs antes de alcanzar la capa de servicio.** Los argumentos de mutaciones deben validarse en el resolver con `@Valid` y anotaciones de Bean Validation. Devuelve errores claros y específicos en el campo `extensions` para que el cliente pueda reaccionar programáticamente.

**No expongas el esquema de dominio directamente.** Define DTOs específicos para GraphQL en lugar de devolver entidades JPA directamente. Esto desacopla el contrato de la API del modelo de persistencia y evita problemas con lazy loading de Hibernate.

**Limita la profundidad y complejidad de las queries.** GraphQL permite al cliente pedir relaciones arbitrariamente anidadas. Sin límites, un cliente malicioso podría construir una query que cargue todo el grafo de objetos. Usa librerías como `graphql-java-extended-validation` o `graphql-query-complexity` para establecer límites.

**Versiona con cuidado.** GraphQL tiene una filosofía de "schema evolution" en lugar de versionado de endpoints. Añade campos nuevos sin eliminar los antiguos, usa la directiva `@deprecated` para marcar campos que se eliminarán, y da a los clientes tiempo suficiente para migrar antes de hacer breaking changes.

## Conclusión

Spring GraphQL convierte la potencia de GraphQL en una extensión natural del modelo de programación de Spring: esquemas SDL en resources, controladores con anotaciones familiares, integración transparente con Spring Security y testing de primera clase con `@GraphQlTest`. El resultado es un stack completo para construir APIs flexibles sin sacrificar la productividad habitual del ecosistema Spring.

El punto de inflexión para adoptar GraphQL no está en la complejidad técnica —Spring GraphQL la gestiona bien— sino en la disposición del equipo para diseñar el esquema pensando en el cliente y para adoptar patrones como DataLoader desde el primer día. Con ese compromiso, las ganancias en flexibilidad para el frontend y en reducción de over-fetching son inmediatas y mensurables.
