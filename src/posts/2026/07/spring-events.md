---
titulo: "Spring Events: Comunicación Desacoplada"
seoTitulo: "Spring Events en Java: cómo usar ApplicationEventPublisher y @EventListener para comunicación desacoplada"
fecha: "2026-07-19"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar el sistema de eventos de Spring para desacoplar componentes dentro de tu aplicación con ApplicationEventPublisher y @EventListener."
imagenPortada: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Events", "Java", "Arquitectura"]
categoria: "tech"
keywords: "Spring Events, ApplicationEventPublisher, EventListener, Spring Boot eventos, comunicación desacoplada, Spring ApplicationEvent, TransactionalEventListener, async events Spring, Java eventos"
---

# Spring Events: Comunicación Desacoplada con ApplicationEventPublisher

En una aplicación bien diseñada, los componentes no deberían saber demasiado los unos de los otros. Cuando un servicio de registro de usuarios necesita enviar un correo, registrar una auditoría y actualizar estadísticas al mismo tiempo, llamar a tres servicios distintos desde el mismo método crea un acoplamiento fuerte que hace el código difícil de probar y extender.

Spring Events resuelve este problema con un mecanismo de publicación-suscripción integrado en el framework: un componente publica un evento y uno o más listeners reaccionan a él, sin que el publicador sepa quién escucha.

## ¿Qué son los Spring Events?

Spring Events es el sistema de eventos interno de Spring Framework. Funciona con tres piezas:

- **Evento**: Un objeto que representa algo que ocurrió (p. ej., `UsuarioRegistradoEvent`).
- **Publicador**: Cualquier bean que use `ApplicationEventPublisher` para emitir el evento.
- **Listener**: Un método anotado con `@EventListener` (o un bean que implemente `ApplicationListener<T>`) que reacciona al evento.

Todo ocurre dentro de la misma JVM. Spring Events no es un message broker como Kafka; es comunicación en proceso, no entre servicios. Su valor está en desacoplar capas y responsabilidades dentro de una misma aplicación.

## Creando un evento personalizado

Un evento puede ser cualquier clase. Opcionalmente puedes extender `ApplicationEvent` (la clase base de Spring), pero desde Spring 4.2 esto ya no es necesario.

```java
public class UsuarioRegistradoEvent {

    private final String email;
    private final String nombre;
    private final Instant momento;

    public UsuarioRegistradoEvent(String email, String nombre) {
        this.email = email;
        this.nombre = nombre;
        this.momento = Instant.now();
    }

    public String getEmail() { return email; }
    public String getNombre() { return nombre; }
    public Instant getMomento() { return momento; }
}
```

Mantén los eventos como objetos de valor simples e inmutables. Deben transportar los datos relevantes del hecho ocurrido, no referencias a entidades mutables.

## Publicando el evento

Inyecta `ApplicationEventPublisher` en el servicio que detecta el hecho y llama a `publishEvent`:

```java
@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final ApplicationEventPublisher eventPublisher;

    public void registrar(String nombre, String email, String password) {
        Usuario usuario = new Usuario(nombre, email, encriptar(password));
        usuarioRepository.save(usuario);

        // Publica el evento sin saber quién lo escucha
        eventPublisher.publishEvent(new UsuarioRegistradoEvent(email, nombre));
    }

    private String encriptar(String password) {
        // BCrypt u otro mecanismo
        return password;
    }
}
```

El servicio cumple su responsabilidad principal (persistir el usuario) y delega las consecuencias secundarias a los listeners.

## Escuchando el evento con @EventListener

Anota cualquier método de un bean de Spring con `@EventListener`. El tipo del parámetro determina a qué evento responde:

```java
@Component
@Slf4j
public class EmailListener {

    private final EmailService emailService;

    public EmailListener(EmailService emailService) {
        this.emailService = emailService;
    }

    @EventListener
    public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
        log.info("Enviando email de bienvenida a {}", event.getEmail());
        emailService.enviarBienvenida(event.getNombre(), event.getEmail());
    }
}
```

```java
@Component
@Slf4j
public class AuditoriaListener {

    private final AuditoriaRepository auditoriaRepository;

    public AuditoriaListener(AuditoriaRepository auditoriaRepository) {
        this.auditoriaRepository = auditoriaRepository;
    }

    @EventListener
    public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
        auditoriaRepository.save(new RegistroAuditoria(
            "REGISTRO_USUARIO",
            event.getEmail(),
            event.getMomento()
        ));
    }
}
```

Puedes tener múltiples listeners para el mismo tipo de evento. Spring los invoca a todos, en el mismo hilo y de forma síncrona por defecto.

## Eventos asíncronos

Por defecto, la publicación de un evento es síncrona: `publishEvent` no retorna hasta que todos los listeners han terminado. Si un listener hace I/O lento (enviar correo, escribir a un log externo), esto bloquea el hilo del publicador.

Para ejecutar un listener en un hilo separado, usa `@Async` sobre el método del listener. Recuerda habilitar el procesamiento asíncrono en tu configuración:

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean
    public TaskExecutor eventTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("event-");
        executor.initialize();
        return executor;
    }
}
```

```java
@Component
@Slf4j
public class EmailListener {

    @Async("eventTaskExecutor")
    @EventListener
    public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
        log.info("Enviando email en hilo: {}", Thread.currentThread().getName());
        emailService.enviarBienvenida(event.getNombre(), event.getEmail());
    }
}
```

Con `@Async`, `publishEvent` retorna inmediatamente y el listener corre en el pool configurado. Las excepciones lanzadas por el listener ya no se propagan al publicador; debes manejarlas internamente o configurar un `AsyncUncaughtExceptionHandler`.

## @TransactionalEventListener

Un escenario común: publicas un evento dentro de una transacción, pero el listener que envía el correo de bienvenida no debería ejecutarse si la transacción hace rollback. Si usas `@EventListener` normal, el listener corre inmediatamente aunque la transacción falle más tarde.

`@TransactionalEventListener` ata la ejecución del listener a la fase de la transacción del publicador:

```java
@Component
@Slf4j
public class EmailListener {

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
        // Se ejecuta SOLO si la transacción del publicador hizo commit
        emailService.enviarBienvenida(event.getNombre(), event.getEmail());
    }
}
```

Las fases disponibles son:

| Fase | Cuándo se ejecuta |
|------|-------------------|
| `AFTER_COMMIT` | Después de que la transacción hace commit (default) |
| `AFTER_ROLLBACK` | Después de un rollback |
| `AFTER_COMPLETION` | Después de commit o rollback |
| `BEFORE_COMMIT` | Justo antes del commit |

Si no hay transacción activa cuando se publica el evento, el listener no se ejecuta por defecto. Para cambiarlo, usa `fallbackExecution = true`:

```java
@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
public void onUsuarioRegistrado(UsuarioRegistradoEvent event) {
    emailService.enviarBienvenida(event.getNombre(), event.getEmail());
}
```

## Ejemplo completo integrado

A continuación se muestra la estructura completa del flujo de registro de usuarios con tres listeners independientes:

```java
// Evento
public record UsuarioRegistradoEvent(String email, String nombre, Instant momento) {
    public UsuarioRegistradoEvent(String email, String nombre) {
        this(email, nombre, Instant.now());
    }
}

// Publicador
@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public void registrar(RegistroRequest request) {
        Usuario usuario = usuarioRepository.save(
            Usuario.builder()
                .nombre(request.nombre())
                .email(request.email())
                .build()
        );
        eventPublisher.publishEvent(
            new UsuarioRegistradoEvent(usuario.getEmail(), usuario.getNombre())
        );
    }
}

// Listener 1: Bienvenida por email (tras commit)
@Component
@RequiredArgsConstructor
@Slf4j
public class BienvenidaEmailListener {

    private final EmailService emailService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(UsuarioRegistradoEvent event) {
        emailService.enviarBienvenida(event.nombre(), event.email());
    }
}

// Listener 2: Auditoría (tras commit)
@Component
@RequiredArgsConstructor
public class AuditoriaListener {

    private final AuditoriaRepository auditoriaRepository;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(UsuarioRegistradoEvent event) {
        auditoriaRepository.save(new Auditoria("REGISTRO", event.email(), event.momento()));
    }
}

// Listener 3: Métricas (siempre, sin importar transacción)
@Component
@RequiredArgsConstructor
public class MetricasListener {

    private final MeterRegistry meterRegistry;

    @EventListener
    public void handle(UsuarioRegistradoEvent event) {
        meterRegistry.counter("usuarios.registrados").increment();
    }
}
```

## Filtrando eventos con condiciones SpEL

`@EventListener` acepta un atributo `condition` con una expresión SpEL. Útil para filtrar sin lógica if en el cuerpo del método:

```java
@EventListener(condition = "#event.email.endsWith('@empresa.com')")
public void onUsuarioCorporativo(UsuarioRegistradoEvent event) {
    // Solo se ejecuta para correos corporativos
    provisioningService.crearCuentaEmpresarial(event.email());
}
```

## Cuándo usar Spring Events (y cuándo no)

**Úsalos cuando:**
- Quieres separar la lógica principal de efectos secundarios (correo, auditoría, métricas).
- Varios componentes necesitan reaccionar a un mismo hecho sin conocerse entre sí.
- Las consecuencias son opcionales y podrían añadirse o quitarse sin modificar el publicador.

**Evítalos cuando:**
- Necesitas comunicación entre microservicios (usa Kafka, RabbitMQ o similar).
- El listener necesita devolver un resultado al publicador (rompe el desacoplamiento; úsa un servicio directo).
- El flujo de negocio depende del orden exacto de ejecución de múltiples listeners (el orden no está garantizado sin `@Order`).

## Testing

Testear con Spring Events es sencillo: publica el evento directamente desde el test o usa `@MockBean` para verificar que `publishEvent` fue llamado.

```java
@SpringBootTest
class UsuarioServiceTest {

    @Autowired
    private UsuarioService usuarioService;

    @MockBean
    private EmailService emailService;

    @Test
    void registrar_debeEnviarEmailDeBienvenida() {
        usuarioService.registrar(new RegistroRequest("Ana", "ana@test.com"));

        verify(emailService, timeout(1000)).enviarBienvenida("Ana", "ana@test.com");
    }
}
```

El `timeout` es necesario si el listener es `@Async`.

## Conclusión

Spring Events te permite construir aplicaciones más cohesivas y extensibles: el servicio central hace su trabajo principal y los efectos secundarios se distribuyen entre listeners independientes. Agregar un nuevo comportamiento ante un evento existente es tan simple como crear un nuevo `@EventListener`, sin tocar el publicador original.

Combina `@TransactionalEventListener` para garantizar consistencia con la base de datos y `@Async` para no bloquear el hilo principal con I/O lento. El resultado es un diseño que escala bien en complejidad sin convertirse en un laberinto de dependencias.
