---
titulo: "Spring AOP: aspectos para código limpio y transversal"
seoTitulo: "Spring AOP: guía práctica de Programación Orientada a Aspectos en Spring Boot"
fecha: "2026-06-10"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Spring AOP para separar responsabilidades transversales como logging, auditoría y métricas del código de negocio. Cubre pointcuts, advices, @Around, @Before, @AfterReturning y casos de uso reales."
imagenPortada: "https://images.unsplash.com/photo-1542831371-32f555c86880?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "AOP", "Java", "Backend", "Aspectos", "Logging"]
categoria: "tech"
keywords: "Spring AOP, Programación Orientada a Aspectos, Spring Boot AOP, @Aspect, @Around, pointcut, advice, logging Spring, auditoría Spring, cross-cutting concerns"
---

# Spring AOP: aspectos para código limpio y transversal

Hay funcionalidades que cruzan todos los módulos de una aplicación: logging, auditoría, manejo de transacciones, métricas, control de acceso. Si las implementas directamente en cada servicio, terminas con código repetido en cientos de métodos y una lógica de negocio enterrada bajo responsabilidades técnicas.

La **Programación Orientada a Aspectos** (AOP) resuelve exactamente eso. Spring AOP permite extraer esas responsabilidades transversales en módulos separados —llamados aspectos— que se aplican automáticamente sin contaminar el código principal.

## Concepto central

AOP introduce algunos términos propios que vale la pena tener claros antes de escribir código:

- **Aspect**: el módulo que encapsula la funcionalidad transversal (por ejemplo, el aspecto de logging).
- **Advice**: la acción que ejecuta el aspecto. Puede ser *antes*, *después* o *alrededor* de un método.
- **Pointcut**: la expresión que define *en qué métodos* se aplica el advice.
- **Join point**: el punto de ejecución concreto donde el aspecto interviene (en Spring AOP, siempre es la invocación de un método).
- **Weaving**: el proceso de aplicar los aspectos al código objetivo. Spring lo hace en tiempo de ejecución mediante proxies.

## Dependencia

Spring Boot incluye AOP a través de `spring-boot-starter-aop`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

Con esto, Spring activa automáticamente el soporte para `@Aspect` y la creación de proxies.

## Primer aspecto: logging de métodos

El caso de uso más común es registrar cuándo se llama a un método y cuánto tarda en ejecutarse:

```java
@Aspect
@Component
@Slf4j
public class LoggingAspect {

    @Around("execution(* com.example.service..*(..))")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().toShortString();
        long start = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            long elapsed = System.currentTimeMillis() - start;
            log.info("[{}] completado en {}ms", methodName, elapsed);
            return result;
        } catch (Throwable ex) {
            log.error("[{}] lanzó excepción: {}", methodName, ex.getMessage());
            throw ex;
        }
    }
}
```

`@Around` es el advice más poderoso: rodea la ejecución completa del método y puede modificar los argumentos de entrada, el valor de retorno, o incluso evitar que el método se ejecute.

`joinPoint.proceed()` es la llamada que efectivamente invoca el método original. Sin ella, el método nunca se ejecutaría.

## Tipos de advice

Spring AOP ofrece cinco tipos de advice:

```java
@Aspect
@Component
public class AuditAspect {

    // Se ejecuta antes del método
    @Before("execution(* com.example.service.UserService.*(..))")
    public void beforeUserOp(JoinPoint jp) {
        log.info("Operación iniciada: {}", jp.getSignature().getName());
    }

    // Se ejecuta si el método retorna sin excepción
    @AfterReturning(
        pointcut = "execution(* com.example.service.UserService.*(..))",
        returning = "result"
    )
    public void afterSuccess(JoinPoint jp, Object result) {
        log.info("Operación exitosa: {} → {}", jp.getSignature().getName(), result);
    }

    // Se ejecuta si el método lanza una excepción
    @AfterThrowing(
        pointcut = "execution(* com.example.service.UserService.*(..))",
        throwing = "ex"
    )
    public void afterException(JoinPoint jp, Exception ex) {
        log.warn("Excepción en {}: {}", jp.getSignature().getName(), ex.getMessage());
    }

    // Se ejecuta siempre (éxito o excepción), como un finally
    @After("execution(* com.example.service.UserService.*(..))")
    public void afterAlways(JoinPoint jp) {
        log.info("Operación finalizada: {}", jp.getSignature().getName());
    }
}
```

## Expresiones de pointcut

El string de `execution(...)` es una expresión AspectJ. La sintaxis general es:

```
execution([modificador] tipo-retorno [clase.]método(parámetros) [throws])
```

Algunos patrones frecuentes:

```java
// Todos los métodos de todos los servicios del paquete
"execution(* com.example.service.*.*(..))"

// Todos los métodos del paquete y subpaquetes (.. doble)
"execution(* com.example.service..*(..))"

// Solo métodos públicos que retornen String
"execution(public String com.example..*.*(..))"

// Métodos con un solo parámetro de tipo Long
"execution(* com.example..*(Long))"

// Clases anotadas con @Service
"@within(org.springframework.stereotype.Service)"

// Métodos anotados con una anotación propia
"@annotation(com.example.annotation.Auditable)"
```

### Reutilizar pointcuts con @Pointcut

Si el mismo pointcut aparece en múltiples advices, conviene extraerlo:

```java
@Aspect
@Component
public class ServiceAspect {

    @Pointcut("execution(* com.example.service..*(..))")
    public void serviceLayer() {}

    @Pointcut("@annotation(com.example.annotation.Auditable)")
    public void auditableMethod() {}

    @Before("serviceLayer()")
    public void logServiceCall(JoinPoint jp) { ... }

    @Around("serviceLayer() && auditableMethod()")
    public Object auditAndLog(ProceedingJoinPoint jp) throws Throwable { ... }
}
```

Los pointcuts se pueden combinar con `&&`, `||` y `!`.

## Anotación personalizada como pointcut

Una técnica muy limpia es crear tu propia anotación para marcar los métodos que deben ser interceptados:

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String action() default "";
}
```

Luego aplicas la anotación donde necesites:

```java
@Service
public class OrderService {

    @Auditable(action = "CREATE_ORDER")
    public Order createOrder(CreateOrderRequest request) {
        // lógica de negocio limpia, sin código de auditoría
        return orderRepository.save(new Order(request));
    }
}
```

Y el aspecto la recoge:

```java
@Aspect
@Component
@Slf4j
public class AuditAspect {

    private final AuditLogRepository auditLogRepository;

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint jp, Auditable auditable) throws Throwable {
        String user = getCurrentUser();
        String action = auditable.action();
        Object result = jp.proceed();

        auditLogRepository.save(AuditLog.builder()
            .user(user)
            .action(action)
            .timestamp(Instant.now())
            .build());

        return result;
    }

    private String getCurrentUser() {
        return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .map(Authentication::getName)
            .orElse("anonymous");
    }
}
```

El resultado: la lógica de auditoría vive en un solo lugar y el código de negocio no sabe que existe.

## Acceder a argumentos y valor de retorno

Spring AOP puede exponer los parámetros del método interceptado mediante `args`:

```java
@Before("execution(* com.example.service.UserService.updateUser(..)) && args(userId, request)")
public void beforeUpdate(Long userId, UpdateUserRequest request) {
    log.info("Actualizando usuario {} con datos: {}", userId, request);
}
```

Y el valor de retorno con `returning`:

```java
@AfterReturning(
    pointcut = "execution(* com.example.service.ProductService.findById(..))",
    returning = "product"
)
public void afterFind(Product product) {
    if (product != null) {
        cacheService.put(product.getId(), product);
    }
}
```

## Caso práctico: métricas con Micrometer

AOP se integra bien con Micrometer para registrar métricas sin contaminar la lógica de negocio:

```java
@Aspect
@Component
public class MetricsAspect {

    private final MeterRegistry meterRegistry;

    public MetricsAspect(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @Around("@annotation(com.example.annotation.Measured)")
    public Object measure(ProceedingJoinPoint jp) throws Throwable {
        String methodName = jp.getSignature().getName();
        Timer.Sample sample = Timer.start(meterRegistry);
        try {
            return jp.proceed();
        } finally {
            sample.stop(meterRegistry.timer("method.execution",
                "method", methodName,
                "class", jp.getTarget().getClass().getSimpleName()
            ));
        }
    }
}
```

Con esto, cada método anotado con `@Measured` registra automáticamente su tiempo de ejecución en Prometheus sin una sola línea de código extra en los servicios.

## Limitaciones a tener en cuenta

Spring AOP funciona mediante proxies dinámicos, lo que implica algunas restricciones:

**Solo intercepta llamadas externas.** Si un método de un bean llama a otro método del mismo bean, el aspecto no se activa. La llamada interna no pasa por el proxy.

```java
@Service
public class OrderService {

    public void processOrder(Order order) {
        validate(order); // ← este @Auditable NO se intercepta
    }

    @Auditable(action = "VALIDATE_ORDER")
    public void validate(Order order) { ... }
}
```

La solución es extraer el método a otro bean, o inyectar el propio bean para forzar la llamada a través del proxy (aunque esto último es un antipatrón).

**Solo funciona con beans de Spring.** AOP no intercepta métodos de objetos creados con `new`.

**No aplica a métodos `final` ni a clases `final`.** El proxy no puede sobreescribirlos.

## Cuándo usar AOP

AOP es la herramienta correcta para responsabilidades que son genuinamente transversales: logging, métricas, auditoría, manejo de transacciones (que Spring ya gestiona internamente con `@Transactional`), reintentos, rate limiting por anotación. Si la funcionalidad es específica de un módulo concreto, el código explícito sigue siendo más legible.

Mantén los aspectos simples y bien enfocados. Un aspecto que hace demasiadas cosas se convierte en un punto de falla difícil de depurar.
