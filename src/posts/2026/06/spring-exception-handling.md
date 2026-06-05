---
titulo: "Manejo de excepciones en Spring Boot con @ControllerAdvice"
seoTitulo: "Manejo de excepciones en Spring Boot: @ControllerAdvice, @ExceptionHandler y respuestas de error consistentes"
fecha: "2026-06-06"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a centralizar el manejo de excepciones en Spring Boot usando @ControllerAdvice y @ExceptionHandler. Cubre excepciones de dominio, validación de entrada, errores HTTP personalizados y estructura de respuestas de error consistente."
imagenPortada: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java", "Backend", "Excepciones", "REST API", "@ControllerAdvice"]
categoria: "tech"
keywords: "Spring Boot exception handling, @ControllerAdvice Spring Boot, @ExceptionHandler Spring, manejo de excepciones REST, respuestas de error Spring Boot, GlobalExceptionHandler, ProblemDetail Spring, Bean Validation Spring Boot"
---

# Manejo de excepciones en Spring Boot con @ControllerAdvice

Una API que solo maneja el camino feliz no está lista para producción. Tarde o temprano un recurso no existe, una validación falla o un servicio externo no responde, y lo que el cliente recibe en esos momentos dice mucho sobre la calidad del sistema.

Spring Boot ofrece un mecanismo limpio para centralizar todo ese manejo en un solo lugar: `@ControllerAdvice`. En lugar de repetir bloques `try-catch` en cada controlador, defines los manejadores de excepciones una vez y Spring los aplica a toda la aplicación.

## El problema sin centralización

Sin un mecanismo centralizado, el manejo de errores tiende a dispersarse:

```java
@GetMapping("/products/{id}")
public ResponseEntity<Product> getProduct(@PathVariable Long id) {
    try {
        Product product = productService.getById(id);
        return ResponseEntity.ok(product);
    } catch (ProductNotFoundException e) {
        return ResponseEntity.notFound().build();
    } catch (Exception e) {
        return ResponseEntity.internalServerError().build();
    }
}
```

Este patrón se repite en cada endpoint, genera inconsistencias en el formato de la respuesta de error y mezcla la lógica de manejo de errores con la lógica de negocio. `@ControllerAdvice` resuelve todo eso.

## Estructura de la respuesta de error

Antes de escribir el manejador, conviene definir un formato de respuesta de error consistente. Un buen punto de partida:

```java
public record ErrorResponse(
        int status,
        String error,
        String message,
        String path,
        Instant timestamp
) {
    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(status, error, message, path, Instant.now());
    }
}
```

Ejemplo de respuesta JSON para un recurso no encontrado:

```json
{
  "status": 404,
  "error": "Not Found",
  "message": "Producto no encontrado: 99",
  "path": "/api/products/99",
  "timestamp": "2026-06-05T14:30:00Z"
}
```

Un formato uniforme facilita el trabajo en el cliente: siempre sabe dónde mirar el mensaje de error, independientemente del tipo de falla.

## Excepciones de dominio

El primer paso es definir excepciones de dominio que expresen condiciones de negocio:

```java
public class ProductNotFoundException extends RuntimeException {
    public ProductNotFoundException(Long id) {
        super("Producto no encontrado: " + id);
    }
}

public class DuplicateProductException extends RuntimeException {
    public DuplicateProductException(String name) {
        super("Ya existe un producto con el nombre: " + name);
    }
}

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(Long productId, int requested, int available) {
        super("Stock insuficiente para el producto %d: solicitado %d, disponible %d"
                .formatted(productId, requested, available));
    }
}
```

Usar `RuntimeException` como base evita que el compilador fuerce el manejo en cada llamada, lo que es apropiado para excepciones que representan errores irrecuperables en el contexto del request.

## @ControllerAdvice y @ExceptionHandler

Con las excepciones definidas, el manejador global:

```java
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ProductNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleProductNotFound(
            ProductNotFoundException ex,
            HttpServletRequest request) {

        log.warn("Producto no encontrado: {}", ex.getMessage());

        ErrorResponse body = ErrorResponse.of(
                HttpStatus.NOT_FOUND.value(),
                "Not Found",
                ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(DuplicateProductException.class)
    public ResponseEntity<ErrorResponse> handleDuplicate(
            DuplicateProductException ex,
            HttpServletRequest request) {

        ErrorResponse body = ErrorResponse.of(
                HttpStatus.CONFLICT.value(),
                "Conflict",
                ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ErrorResponse> handleInsufficientStock(
            InsufficientStockException ex,
            HttpServletRequest request) {

        ErrorResponse body = ErrorResponse.of(
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                "Unprocessable Entity",
                ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(
            Exception ex,
            HttpServletRequest request) {

        log.error("Error inesperado en {}: {}", request.getRequestURI(), ex.getMessage(), ex);

        ErrorResponse body = ErrorResponse.of(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "Ocurrió un error inesperado. Por favor, inténtalo más tarde.",
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
```

`@RestControllerAdvice` es equivalente a `@ControllerAdvice` + `@ResponseBody`: el valor de retorno de cada método se serializa automáticamente como JSON.

Spring evalúa los manejadores de más específico a más general. Si lanzas una `ProductNotFoundException`, el primer método la captura. Si lanza algo no mapeado, el manejador de `Exception.class` actúa como red de seguridad.

## Validación de entrada con Bean Validation

Cuando usas `@Valid` o `@Validated` en los controladores, Spring lanza `MethodArgumentNotValidException` para cuerpos inválidos y `ConstraintViolationException` para parámetros de path o query inválidos. Es importante manejarlos explícitamente para devolver los errores de validación de forma estructurada:

```java
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ValidationErrorResponse> handleValidation(
        MethodArgumentNotValidException ex,
        HttpServletRequest request) {

    List<FieldError> fieldErrors = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
            .toList();

    ValidationErrorResponse body = new ValidationErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Bad Request",
            "La solicitud contiene campos inválidos",
            request.getRequestURI(),
            Instant.now(),
            fieldErrors
    );
    return ResponseEntity.badRequest().body(body);
}

@ExceptionHandler(ConstraintViolationException.class)
public ResponseEntity<ValidationErrorResponse> handleConstraintViolation(
        ConstraintViolationException ex,
        HttpServletRequest request) {

    List<FieldError> fieldErrors = ex.getConstraintViolations()
            .stream()
            .map(v -> new FieldError(
                    v.getPropertyPath().toString(),
                    v.getMessage()
            ))
            .toList();

    ValidationErrorResponse body = new ValidationErrorResponse(
            HttpStatus.BAD_REQUEST.value(),
            "Bad Request",
            "Parámetros inválidos",
            request.getRequestURI(),
            Instant.now(),
            fieldErrors
    );
    return ResponseEntity.badRequest().body(body);
}
```

Los registros de apoyo:

```java
public record FieldError(String field, String message) {}

public record ValidationErrorResponse(
        int status,
        String error,
        String message,
        String path,
        Instant timestamp,
        List<FieldError> errors
) {}
```

La respuesta JSON para una validación fallida quedaría:

```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "La solicitud contiene campos inválidos",
  "path": "/api/products",
  "timestamp": "2026-06-05T14:31:00Z",
  "errors": [
    { "field": "name", "message": "no debe estar vacío" },
    { "field": "price", "message": "debe ser mayor que 0" }
  ]
}
```

## Errores HTTP estándar

Spring también lanza sus propias excepciones para situaciones comunes que conviene interceptar:

```java
@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
public ResponseEntity<ErrorResponse> handleMethodNotAllowed(
        HttpRequestMethodNotSupportedException ex,
        HttpServletRequest request) {

    ErrorResponse body = ErrorResponse.of(
            HttpStatus.METHOD_NOT_ALLOWED.value(),
            "Method Not Allowed",
            "Método HTTP no permitido: " + ex.getMethod(),
            request.getRequestURI()
    );
    return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(body);
}

@ExceptionHandler(HttpMediaTypeNotSupportedException.class)
public ResponseEntity<ErrorResponse> handleUnsupportedMediaType(
        HttpMediaTypeNotSupportedException ex,
        HttpServletRequest request) {

    ErrorResponse body = ErrorResponse.of(
            HttpStatus.UNSUPPORTED_MEDIA_TYPE.value(),
            "Unsupported Media Type",
            "Content-Type no soportado: " + ex.getContentType(),
            request.getRequestURI()
    );
    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(body);
}

@ExceptionHandler(NoResourceFoundException.class)
public ResponseEntity<ErrorResponse> handleNoResourceFound(
        NoResourceFoundException ex,
        HttpServletRequest request) {

    ErrorResponse body = ErrorResponse.of(
            HttpStatus.NOT_FOUND.value(),
            "Not Found",
            "Ruta no encontrada: " + request.getRequestURI(),
            request.getRequestURI()
    );
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
}
```

`NoResourceFoundException` es la excepción que Spring MVC lanza cuando ningún handler coincide con la URL solicitada (reemplaza a `NoHandlerFoundException` en versiones recientes de Spring Boot).

## ProblemDetail: el estándar RFC 9457

Spring Boot 3 introdujo soporte nativo para `ProblemDetail`, el formato estandarizado por RFC 9457 (antes RFC 7807). Si quieres adherirte al estándar en lugar de un formato propio, puedes usarlo directamente:

```java
@ExceptionHandler(ProductNotFoundException.class)
public ResponseEntity<ProblemDetail> handleProductNotFound(
        ProductNotFoundException ex,
        HttpServletRequest request) {

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND,
            ex.getMessage()
    );
    problem.setTitle("Producto no encontrado");
    problem.setInstance(URI.create(request.getRequestURI()));
    problem.setProperty("timestamp", Instant.now());

    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(problem);
}
```

La respuesta sigue el formato RFC 9457:

```json
{
  "type": "about:blank",
  "title": "Producto no encontrado",
  "status": 404,
  "detail": "Producto no encontrado: 99",
  "instance": "/api/products/99",
  "timestamp": "2026-06-05T14:30:00Z"
}
```

`ProblemDetail` es una buena opción cuando construyes APIs públicas o integras con clientes que esperan el estándar. Para APIs internas, un formato propio controlado puede ser más práctico.

## Probando el manejador global

El `GlobalExceptionHandler` es un candidato natural para tests con `@WebMvcTest`:

```java
@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductService productService;

    @Test
    void getById_returns404_withErrorBody_whenNotFound() throws Exception {
        when(productService.getById(99L))
                .thenThrow(new ProductNotFoundException(99L));

        mockMvc.perform(get("/api/products/99")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message").value("Producto no encontrado: 99"))
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    void create_returns400_withFieldErrors_whenInvalid() throws Exception {
        String invalidJson = """
                {"name": "", "price": -5}
                """;

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors.length()").value(greaterThan(0)));
    }
}
```

Los tests verifican tanto el código HTTP como la estructura del cuerpo de error, asegurando que el contrato con el cliente se mantiene.

## Buenas prácticas

1. **Define excepciones de dominio expresivas**: una `ProductNotFoundException` comunica más que una `RuntimeException` genérica. Crea una excepción por condición de negocio distinta.
2. **No expongas detalles internos en producción**: el manejador genérico de `Exception.class` debe devolver un mensaje neutro al cliente y registrar el detalle completo en los logs.
3. **Usa los códigos HTTP correctos**: `404` para recursos no encontrados, `409` para conflictos, `422` para entidades no procesables, `400` para validación de entrada. Evita usar siempre `500` o `400`.
4. **Centraliza todo en un solo `@ControllerAdvice`**: tener múltiples clases con `@ControllerAdvice` puede causar conflictos de orden. Un único handler global es más predecible.
5. **Registra con el nivel correcto**: `WARN` para errores esperados (recurso no encontrado, conflicto); `ERROR` para excepciones inesperadas.
6. **Incluye tests para los caminos de error**: los clientes dependen del formato de la respuesta de error tanto como del camino feliz. Protégelo con tests.

## Conclusión

`@ControllerAdvice` convierte el manejo de excepciones en una responsabilidad centralizada y coherente. Las excepciones de dominio expresan las condiciones de negocio, el manejador global las traduce a respuestas HTTP con un formato uniforme, y los tests verifican que ese contrato se mantiene.

El resultado es una API que comunica sus errores con la misma precisión que sus respuestas exitosas, lo que simplifica el trabajo de los clientes y facilita el diagnóstico en producción.
