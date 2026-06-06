---
titulo: "Validación en Spring Boot con Bean Validation"
seoTitulo: "Validación en Spring Boot: Bean Validation, @Valid, @Validated y restricciones personalizadas"
fecha: "2026-06-07"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a validar entradas en Spring Boot usando la API de Bean Validation: restricciones estándar, validación en controladores y servicios, mensajes personalizados y cómo crear tus propias anotaciones de validación."
imagenPortada: "https://images.unsplash.com/photo-1760952851538-17a59f691efe?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java", "Bean Validation", "Backend", "REST API", "@Valid"]
categoria: "tech"
keywords: "Spring Boot validation, Bean Validation, @Valid, @Validated, @NotNull, @NotBlank, validación Spring Boot, restricciones personalizadas, javax.validation, jakarta.validation"
---

# Validación en Spring Boot con Bean Validation

Aceptar entradas sin validarlas es uno de los errores más comunes en APIs REST. Spring Boot integra Bean Validation (la especificación `jakarta.validation`) de forma nativa, lo que permite declarar reglas de validación directamente en las clases de datos y activarlas con una sola anotación.

Este artículo cubre desde las restricciones estándar hasta la creación de validadores personalizados, pasando por la integración con `@ControllerAdvice` para devolver errores estructurados.

## Dependencia

En un proyecto Spring Boot, el starter web ya incluye Bean Validation a través de Hibernate Validator (la implementación de referencia). No necesitas agregar nada si ya tienes:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

Si trabajas sin el starter web (por ejemplo, en un proyecto de solo servicios), añade el starter de validación explícitamente:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

## Restricciones estándar

Bean Validation define un conjunto de anotaciones en el paquete `jakarta.validation.constraints`. Las más usadas son:

| Anotación | Aplica a | Descripción |
|---|---|---|
| `@NotNull` | Cualquier tipo | El valor no puede ser `null` |
| `@NotBlank` | `String` | No puede ser `null`, vacío ni solo espacios |
| `@NotEmpty` | `String`, colecciones | No puede ser `null` ni vacío |
| `@Size(min, max)` | `String`, colecciones, arrays | Longitud o tamaño dentro del rango |
| `@Min(value)` | Números | Valor mínimo inclusivo |
| `@Max(value)` | Números | Valor máximo inclusivo |
| `@DecimalMin` / `@DecimalMax` | Números | Mínimo / máximo para `BigDecimal` |
| `@Positive` / `@PositiveOrZero` | Números | Mayor que cero / mayor o igual que cero |
| `@Negative` / `@NegativeOrZero` | Números | Menor que cero / menor o igual que cero |
| `@Email` | `String` | Formato de dirección de correo |
| `@Pattern(regexp)` | `String` | Coincide con la expresión regular |
| `@Past` / `@Future` | Fechas | Fecha en el pasado / en el futuro |
| `@PastOrPresent` / `@FutureOrPresent` | Fechas | Pasado o presente / futuro o presente |

## Validación en controladores con @Valid

El caso más frecuente es validar el cuerpo de una petición HTTP. Anota los campos de tu DTO y activa la validación con `@Valid` en el parámetro del controlador:

```java
public record CreateProductRequest(
        @NotBlank(message = "El nombre no puede estar vacío")
        @Size(max = 120, message = "El nombre no puede superar los 120 caracteres")
        String name,

        @NotNull(message = "El precio es obligatorio")
        @Positive(message = "El precio debe ser mayor que cero")
        BigDecimal price,

        @NotNull(message = "La categoría es obligatoria")
        Long categoryId,

        @Email(message = "El correo del proveedor no tiene un formato válido")
        String supplierEmail
) {}
```

```java
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(@Valid @RequestBody CreateProductRequest request) {
        return productService.create(request);
    }
}
```

Con `@Valid` en el parámetro, Spring lanza una `MethodArgumentNotValidException` si alguna restricción falla antes de que el método del controlador se ejecute.

## Manejar los errores de validación

Sin configuración adicional, Spring devuelve un JSON de error poco descriptivo. Lo habitual es capturar `MethodArgumentNotValidException` en un `@ControllerAdvice` y construir una respuesta estructurada:

```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ValidationErrorResponse handleValidationErrors(MethodArgumentNotValidException ex) {
        List<FieldError> errors = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fe -> new FieldError(fe.getField(), fe.getDefaultMessage()))
                .toList();

        return new ValidationErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                "Error de validación",
                errors
        );
    }
}
```

```java
public record ValidationErrorResponse(
        int status,
        String message,
        List<FieldError> errors
) {}

public record FieldError(String field, String message) {}
```

Con esto, una petición inválida devuelve algo como:

```json
{
  "status": 400,
  "message": "Error de validación",
  "errors": [
    { "field": "name", "message": "El nombre no puede estar vacío" },
    { "field": "price", "message": "El precio debe ser mayor que cero" }
  ]
}
```

## Validación en parámetros de URL y query strings

Para validar path variables y query params, añade `@Validated` a nivel de clase en el controlador (no en el parámetro) y aplica las anotaciones directamente:

```java
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Validated
public class ProductController {

    @GetMapping("/{id}")
    public ProductResponse getById(
            @PathVariable @Positive(message = "El ID debe ser positivo") Long id) {
        return productService.findById(id);
    }

    @GetMapping
    public Page<ProductResponse> list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return productService.list(page, size);
    }
}
```

En este caso Spring lanza `ConstraintViolationException` (no `MethodArgumentNotValidException`), así que añade otro handler en el `@ControllerAdvice`:

```java
@ExceptionHandler(ConstraintViolationException.class)
@ResponseStatus(HttpStatus.BAD_REQUEST)
public ValidationErrorResponse handleConstraintViolation(ConstraintViolationException ex) {
    List<FieldError> errors = ex.getConstraintViolations()
            .stream()
            .map(cv -> new FieldError(
                    extractFieldName(cv.getPropertyPath().toString()),
                    cv.getMessage()))
            .toList();

    return new ValidationErrorResponse(400, "Error de validación", errors);
}

private String extractFieldName(String propertyPath) {
    String[] parts = propertyPath.split("\\.");
    return parts[parts.length - 1];
}
```

## Validar objetos anidados con @Valid

Cuando un DTO contiene otro objeto, la validación no se propaga automáticamente. Debes anotar el campo anidado con `@Valid`:

```java
public record CreateOrderRequest(
        @NotNull
        @Valid
        CustomerInfo customer,

        @NotEmpty(message = "El pedido debe tener al menos un ítem")
        @Valid
        List<OrderItemRequest> items
) {}

public record CustomerInfo(
        @NotBlank String name,
        @NotBlank @Email String email,
        @NotBlank String address
) {}

public record OrderItemRequest(
        @NotNull Long productId,
        @Positive int quantity
) {}
```

Sin `@Valid` en el campo `customer` o en la lista `items`, las restricciones internas serían ignoradas.

## Mensajes personalizados con ValidationMessages.properties

Por defecto, los mensajes de error están en el bundle `ValidationMessages.properties` de Hibernate Validator. Puedes sobreescribirlos creando el archivo `src/main/resources/ValidationMessages.properties`:

```properties
jakarta.validation.constraints.NotBlank.message=Este campo es obligatorio
jakarta.validation.constraints.Size.message=Debe tener entre {min} y {max} caracteres
jakarta.validation.constraints.Email.message=Ingresa un correo electrónico válido
jakarta.validation.constraints.Positive.message=El valor debe ser mayor que cero
```

O puedes definir claves propias y referenciarlas en la anotación:

```java
@NotBlank(message = "{product.name.required}")
String name;
```

```properties
# ValidationMessages.properties
product.name.required=El nombre del producto es obligatorio
```

## Restricciones personalizadas

Cuando ninguna anotación estándar cubre tu regla de negocio, creas la tuya. Requiere dos piezas: la anotación y la clase que implementa la validación.

Ejemplo: validar que un número de teléfono colombiano tenga el formato correcto.

### 1. Definir la anotación

```java
@Documented
@Constraint(validatedBy = ColombianPhoneValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ColombianPhone {

    String message() default "El número de teléfono debe tener 10 dígitos y empezar por 3";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
```

Los tres métodos `message`, `groups` y `payload` son obligatorios por la especificación de Bean Validation.

### 2. Implementar el validador

```java
public class ColombianPhoneValidator
        implements ConstraintValidator<ColombianPhone, String> {

    private static final Pattern PHONE_PATTERN =
            Pattern.compile("^3[0-9]{9}$");

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) return true; // @NotNull se encarga del null
        return PHONE_PATTERN.matcher(value).matches();
    }
}
```

### 3. Usar la anotación

```java
public record ContactRequest(
        @NotBlank String name,
        @NotBlank @ColombianPhone String phone
) {}
```

## Validaciones a nivel de clase

A veces la restricción involucra más de un campo. Por ejemplo, verificar que una fecha de fin sea posterior a la de inicio:

```java
@Documented
@Constraint(validatedBy = DateRangeValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidDateRange {
    String message() default "La fecha de fin debe ser posterior a la fecha de inicio";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
```

```java
public class DateRangeValidator implements ConstraintValidator<ValidDateRange, DateRangeRequest> {

    @Override
    public boolean isValid(DateRangeRequest value, ConstraintValidatorContext context) {
        if (value.startDate() == null || value.endDate() == null) return true;
        return value.endDate().isAfter(value.startDate());
    }
}
```

```java
@ValidDateRange
public record DateRangeRequest(
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate
) {}
```

La anotación se aplica a la clase completa (`@Target(ElementType.TYPE)`), lo que permite al validador acceder a todos los campos.

## @Validated vs @Valid

Ambas activan la validación, pero tienen diferencias importantes:

- **`@Valid`** (de `jakarta.validation`): activa la validación estándar de Bean Validation. Necesaria para validar el `@RequestBody` en controladores y para propagar la validación a objetos anidados.
- **`@Validated`** (de Spring): variante de Spring que además soporta **grupos de validación** y permite validar parámetros en cualquier bean gestionado por Spring (no solo controladores).

## Grupos de validación

Los grupos permiten aplicar distintas restricciones según el contexto (por ejemplo, al crear vs. al actualizar):

```java
public interface OnCreate {}
public interface OnUpdate {}
```

```java
public class ProductRequest {

    @Null(groups = OnCreate.class)
    @NotNull(groups = OnUpdate.class)
    private Long id;

    @NotBlank(groups = {OnCreate.class, OnUpdate.class})
    private String name;

    @NotNull(groups = OnCreate.class)
    private BigDecimal price;
}
```

En el controlador, usa `@Validated` con el grupo correspondiente:

```java
@PostMapping
public ProductResponse create(
        @Validated(OnCreate.class) @RequestBody ProductRequest request) {
    return productService.create(request);
}

@PutMapping("/{id}")
public ProductResponse update(
        @PathVariable Long id,
        @Validated(OnUpdate.class) @RequestBody ProductRequest request) {
    return productService.update(id, request);
}
```

## Validación en la capa de servicio

No toda la validación pertenece al controlador. Reglas de negocio complejas (unicidad, consistencia con el estado actual, etc.) se validan en el servicio. Anotando el servicio con `@Validated`, Spring intercepta las llamadas y aplica las restricciones:

```java
@Service
@Validated
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    public ProductResponse create(
            @Valid CreateProductRequest request) {

        if (productRepository.existsByName(request.name())) {
            throw new BusinessException("Ya existe un producto con ese nombre");
        }

        Product product = new Product(request.name(), request.price());
        return mapToResponse(productRepository.save(product));
    }
}
```

## Buenas prácticas

1. **Valida en la capa más externa posible** (controlador) para rechazar entradas inválidas antes de que lleguen a la lógica de negocio.
2. **No dupliques reglas**: si una restricción ya está en el DTO, no la repitas manualmente en el servicio. Usa `@Valid` en el servicio solo para reglas de negocio adicionales.
3. **Siempre captura las excepciones de validación** en un `@ControllerAdvice`. Los errores 500 por validación no manejada son confusos para los consumidores de la API.
4. **Devuelve todos los errores a la vez**, no solo el primero. `BindingResult.getFieldErrors()` devuelve la lista completa.
5. **Mantén los mensajes en `ValidationMessages.properties`** para centralizar y facilitar la internacionalización.
6. **No abuses de los grupos**: si tienes muchos grupos, evalúa si es mejor tener DTOs separados para cada operación.

## Conclusión

Bean Validation convierte reglas de negocio en anotaciones declarativas que viven junto al modelo de datos. Con `@Valid` en los controladores, un `@ControllerAdvice` para capturar los errores y validadores personalizados para las reglas específicas del dominio, se obtiene una capa de validación robusta y mantenible sin código repetitivo.

El siguiente paso natural es combinar esta validación con el manejo centralizado de excepciones para garantizar que la API siempre devuelva respuestas de error coherentes y descriptivas.
