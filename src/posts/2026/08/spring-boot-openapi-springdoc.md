---
titulo: "Documentación automática de APIs con Springdoc OpenAPI en Spring Boot"
seoTitulo: "Springdoc OpenAPI en Spring Boot: guía completa de documentación automática de APIs REST"
fecha: "2026-08-08"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a generar documentación interactiva de tus APIs REST con Springdoc OpenAPI: configura Swagger UI, anota controladores y DTOs, protege el esquema con JWT, organiza múltiples grupos de APIs y personaliza la especificación para entornos reales."
imagenPortada: "https://i.imgur.com/D0kJrND.png?w=800&h=600&fit=crop"
etiquetas: ["Spring Boot", "OpenAPI", "Swagger", "Java", "Backend", "REST API", "Documentación"]
categoria: "tech"
keywords: "springdoc openapi spring boot, swagger ui spring boot 3, documentación rest api java, openapi 3 spring boot, springdoc configuración, anotaciones openapi controlador, swagger bearer token, springdoc grupos api, spring boot api documentation, springdoc security scheme jwt"
---

# Documentación automática de APIs con Springdoc OpenAPI en Spring Boot

Una API sin documentación es una API que nadie sabe usar correctamente, incluido tú mismo tres meses después de haberla escrito. El problema clásico de la documentación manual es que envejece: el código cambia, la documentación no, y llega un momento en que ambas describen aplicaciones diferentes.

**Springdoc OpenAPI** resuelve esto invirtiendo la relación: la documentación se genera automáticamente a partir del código, los tipos Java y las anotaciones. Cuando el código cambia, la documentación cambia con él. El resultado es una especificación OpenAPI 3 completa y una interfaz Swagger UI interactiva donde cualquier consumidor puede explorar y probar los endpoints directamente desde el navegador.

## Dependencia

Springdoc OpenAPI tiene una única dependencia que incluye tanto la generación de la especificación como la interfaz Swagger UI:

```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.6.0</version>
</dependency>
```

Si usas WebFlux en lugar de Spring MVC, cambia el artefacto por `springdoc-openapi-starter-webflux-ui`.

Con solo agregar la dependencia y arrancar la aplicación, Springdoc ya genera la especificación en `http://localhost:8080/v3/api-docs` y abre Swagger UI en `http://localhost:8080/swagger-ui.html`.

## Configuración básica

La configuración mínima en `application.yml` expone la URL canónica de Swagger UI y permite ajustar la ruta de la especificación:

```yaml
springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
    operations-sorter: alpha       # ordena los endpoints por nombre
    tags-sorter: alpha             # ordena los tags alfabéticamente
    try-it-out-enabled: true       # habilita "Try it out" por defecto
  show-actuator: false             # oculta los endpoints de Actuator
```

Para enriquecer los metadatos de la especificación —título, versión, contacto, licencia— se define un bean `OpenAPI`:

```java
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("Products API")
                .version("1.0.0")
                .description("API REST para gestión de productos y catálogo")
                .contact(new Contact()
                    .name("Jesús Flórez")
                    .email("api@ejemplo.com")
                    .url("https://jesusflorez.cloud"))
                .license(new License()
                    .name("Apache 2.0")
                    .url("https://www.apache.org/licenses/LICENSE-2.0")))
            .externalDocs(new ExternalDocumentation()
                .description("Repositorio del proyecto")
                .url("https://github.com/ejemplo/products-api"));
    }
}
```

## Documentar controladores

Springdoc extrae automáticamente rutas, métodos HTTP y tipos de retorno de los controladores Spring MVC. Las anotaciones OpenAPI permiten enriquecer esa información con descripciones, ejemplos y códigos de respuesta explícitos.

### @Tag

Agrupa los endpoints en secciones dentro de Swagger UI:

```java
@RestController
@RequestMapping("/api/products")
@Tag(name = "Productos", description = "Gestión del catálogo de productos")
public class ProductController {
    // ...
}
```

### @Operation

Describe un endpoint individual:

```java
@GetMapping("/{id}")
@Operation(
    summary = "Obtener producto por ID",
    description = "Devuelve los detalles completos de un producto. Incluye precio, stock y categoría.",
    responses = {
        @ApiResponse(
            responseCode = "200",
            description = "Producto encontrado",
            content = @Content(schema = @Schema(implementation = ProductResponse.class))
        ),
        @ApiResponse(
            responseCode = "404",
            description = "Producto no encontrado",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))
        )
    }
)
public ResponseEntity<ProductResponse> getProduct(@PathVariable Long id) {
    return productService.findById(id)
        .map(ResponseEntity::ok)
        .orElse(ResponseEntity.notFound().build());
}
```

### @Parameter

Documenta parámetros de ruta, query y cabecera:

```java
@GetMapping
@Operation(summary = "Listar productos con paginación y filtros")
public Page<ProductResponse> listProducts(
    @Parameter(description = "Número de página (empieza en 0)", example = "0")
    @RequestParam(defaultValue = "0") int page,

    @Parameter(description = "Tamaño de página", example = "20")
    @RequestParam(defaultValue = "20") int size,

    @Parameter(description = "Filtrar por categoría", example = "electronica")
    @RequestParam(required = false) String categoria,

    @Parameter(description = "Texto de búsqueda en nombre o descripción")
    @RequestParam(required = false) String q
) {
    return productService.search(categoria, q, PageRequest.of(page, size));
}
```

### @RequestBody explícito

Cuando el cuerpo de la petición necesita más contexto, se puede anotar directamente:

```java
@PostMapping
@Operation(summary = "Crear nuevo producto")
public ResponseEntity<ProductResponse> createProduct(
    @io.swagger.v3.oas.annotations.parameters.RequestBody(
        description = "Datos del producto a crear",
        required = true,
        content = @Content(
            schema = @Schema(implementation = CreateProductRequest.class),
            examples = @ExampleObject(
                name = "Ejemplo básico",
                value = """
                    {
                      "nombre": "Laptop ProBook 450",
                      "precio": 899.99,
                      "stock": 50,
                      "categoriaId": 3
                    }
                    """
            )
        )
    )
    @Valid @RequestBody CreateProductRequest request
) {
    ProductResponse created = productService.create(request);
    URI location = URI.create("/api/products/" + created.id());
    return ResponseEntity.created(location).body(created);
}
```

## Documentar modelos y DTOs

Las anotaciones `@Schema` enriquecen la descripción de los campos en los modelos:

```java
@Schema(description = "Solicitud de creación de producto")
public record CreateProductRequest(

    @Schema(description = "Nombre del producto", example = "Laptop ProBook 450", minLength = 2, maxLength = 150)
    @NotBlank
    @Size(min = 2, max = 150)
    String nombre,

    @Schema(description = "Precio en euros, sin IVA", example = "899.99", minimum = "0.01")
    @NotNull
    @DecimalMin("0.01")
    BigDecimal precio,

    @Schema(description = "Unidades disponibles en almacén", example = "50", minimum = "0")
    @NotNull
    @Min(0)
    Integer stock,

    @Schema(description = "ID de la categoría a la que pertenece el producto", example = "3")
    @NotNull
    Long categoriaId
) {}
```

Para el objeto de respuesta:

```java
@Schema(description = "Datos completos de un producto")
public record ProductResponse(

    @Schema(description = "Identificador único", example = "42")
    Long id,

    @Schema(description = "Nombre del producto", example = "Laptop ProBook 450")
    String nombre,

    @Schema(description = "Precio en euros", example = "899.99")
    BigDecimal precio,

    @Schema(description = "Stock disponible", example = "50")
    Integer stock,

    @Schema(description = "Categoría del producto")
    CategoriaResumen categoria,

    @Schema(description = "Fecha y hora de creación en UTC", example = "2026-08-07T14:30:00Z")
    Instant creadoEn
) {}
```

## Seguridad: esquema Bearer con JWT

Cuando la API está protegida con JWT, hay que declarar el esquema de seguridad en la configuración OpenAPI y aplicarlo a los endpoints que lo requieren.

### Declarar el esquema de seguridad

```java
@Bean
public OpenAPI customOpenAPI() {
    return new OpenAPI()
        .info(new Info().title("Products API").version("1.0.0"))
        .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
        .components(new Components()
            .addSecuritySchemes("Bearer Authentication",
                new SecurityScheme()
                    .name("Bearer Authentication")
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("Introduce el token JWT obtenido en /auth/login")
            )
        );
}
```

Con esta configuración, Swagger UI muestra el botón "Authorize" en la esquina superior derecha. Al pegar el token, todas las peticiones enviadas desde la UI incluirán automáticamente el header `Authorization: Bearer <token>`.

### Marcar endpoints como públicos

Si hay endpoints que no requieren autenticación —como el login o los endpoints de salud—, se puede excluirlos del requisito de seguridad:

```java
@PostMapping("/auth/login")
@Operation(
    summary = "Autenticar usuario y obtener JWT",
    security = @SecurityRequirement(name = "")   // sin requisito de seguridad
)
public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
    return ResponseEntity.ok(authService.login(request));
}
```

## Grupos de APIs

En proyectos grandes es útil separar la documentación en grupos independientes, cada uno con su propio Swagger UI. Por ejemplo, APIs públicas vs. de administración:

```java
@Configuration
public class OpenApiGroupConfig {

    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder()
            .group("public")
            .displayName("API Pública")
            .pathsToMatch("/api/products/**", "/api/categories/**", "/auth/**")
            .build();
    }

    @Bean
    public GroupedOpenApi adminApi() {
        return GroupedOpenApi.builder()
            .group("admin")
            .displayName("API de Administración")
            .pathsToMatch("/admin/**")
            .addOperationCustomizer((operation, handlerMethod) -> {
                operation.addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"));
                return operation;
            })
            .build();
    }
}
```

Con los grupos definidos, Swagger UI muestra un selector en la esquina superior derecha que permite cambiar entre las dos especificaciones.

## Múltiples servidores

En proyectos desplegados en varios entornos —local, staging, producción— es útil declarar los servidores explícitamente para que Swagger UI permita seleccionar contra cuál enviar las peticiones de prueba:

```java
@Bean
public OpenAPI customOpenAPI() {
    return new OpenAPI()
        .info(new Info().title("Products API").version("1.0.0"))
        .servers(List.of(
            new Server().url("http://localhost:8080").description("Desarrollo local"),
            new Server().url("https://staging-api.ejemplo.com").description("Staging"),
            new Server().url("https://api.ejemplo.com").description("Producción")
        ));
}
```

## Excluir endpoints de la documentación

Algunos endpoints no deben aparecer en la especificación pública —endpoints internos, de debugging, o de infraestructura—. Se pueden excluir con `@Hidden`:

```java
@Hidden   // no aparece en la especificación OpenAPI
@GetMapping("/internal/health-check")
public String internalCheck() {
    return "ok";
}
```

También es posible excluir un controlador entero aplicando `@Hidden` a nivel de clase.

## Integración con Spring Security

Si la aplicación usa Spring Security, hay que permitir el acceso a las rutas de Springdoc en la configuración de seguridad:

```java
@Bean
public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .authorizeHttpRequests(auth -> auth
            // rutas de documentación siempre públicas
            .requestMatchers(
                "/v3/api-docs/**",
                "/swagger-ui/**",
                "/swagger-ui.html"
            ).permitAll()
            // resto requiere autenticación
            .anyRequest().authenticated()
        )
        .sessionManagement(session ->
            session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
        )
        .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
}
```

## Validación de la especificación

Springdoc expone la especificación en formato JSON en `/v3/api-docs` y en formato YAML en `/v3/api-docs.yaml`. El YAML es especialmente útil para integrarlo en pipelines de CI que validan el contrato antes de cada despliegue.

Con Maven, se puede generar y guardar la especificación durante el build:

```xml
<plugin>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-maven-plugin</artifactId>
    <version>1.4</version>
    <executions>
        <execution>
            <goals>
                <goal>generate</goal>
            </goals>
        </execution>
    </executions>
    <configuration>
        <apiDocsUrl>http://localhost:8080/v3/api-docs</apiDocsUrl>
        <outputFileName>openapi.yaml</outputFileName>
        <outputDir>${project.build.directory}</outputDir>
    </configuration>
</plugin>
```

El archivo `openapi.yaml` generado puede ser versionado en Git, importado en Postman, publicado en un portal de API, o usado para generar clientes en otros lenguajes con `openapi-generator`.

## Buenas prácticas

Mantener la documentación útil a largo plazo requiere algunos hábitos:

**Escribe `summary` y `description` siempre distintos.** El `summary` es la etiqueta breve del endpoint en la lista; la `description` es el espacio donde explicas restricciones, comportamientos especiales o ejemplos de uso real.

**Documenta los casos de error, no solo el 200.** Los consumidores de la API necesitan saber qué significa un 400 vs un 422 vs un 404 en tu contexto específico. El `@ApiResponse` para errores es tan importante como el de éxito.

**Usa `@ExampleObject` con valores reales.** Los ejemplos inventados con valores genéricos ("string", 0, true) no ayudan. Un ejemplo con datos realistas —un nombre de producto verdadero, un precio con dos decimales— hace que la UI sea inmediatamente más legible.

**Mantén los DTOs separados de las entidades.** Documentar directamente las entidades JPA expone detalles de implementación (columnas, relaciones lazy) que no pertenecen al contrato de la API. Los DTOs controlados te dan precisión sobre qué mostrar y cómo anotarlo.

**Desactiva Swagger en producción si la API no es pública.** Si la documentación es solo para uso interno o de desarrollo, usa perfiles para deshabilitar Springdoc en el entorno de producción:

```yaml
# application-prod.yml
springdoc:
  api-docs:
    enabled: false
  swagger-ui:
    enabled: false
```

## Resumen

Springdoc OpenAPI conecta el código Java directamente con la especificación OpenAPI 3, eliminando la brecha entre lo que el código hace y lo que la documentación dice. Los puntos clave son:

- **Una sola dependencia** activa la generación de la especificación y la interfaz Swagger UI.
- **`@Tag`, `@Operation`, `@Parameter`, `@ApiResponse`** describen los endpoints con semántica OpenAPI sin salir del ecosistema Spring.
- **`@Schema`** en los DTOs construye modelos bien documentados con ejemplos y restricciones visibles.
- **El esquema Bearer** integra la autenticación JWT en Swagger UI con un solo clic.
- **Los grupos** permiten dividir la documentación cuando la API tiene secciones con audiencias distintas.
- **El plugin Maven** genera el YAML de la especificación en CI, habilitando validación de contratos y generación de clientes.

La combinación de Springdoc con una definición cuidadosa de DTOs y anotaciones produce una documentación que no solo describe la API, sino que actúa como su primera línea de pruebas: si algo no se puede documentar claramente, suele ser una señal de que el diseño del endpoint puede mejorar.
