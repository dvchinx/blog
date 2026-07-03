---
titulo: "Tareas programadas en Spring Boot con @Scheduled"
seoTitulo: "Spring Boot @Scheduled: guía práctica de tareas programadas y cron jobs"
fecha: "2026-07-04"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a programar tareas periódicas en Spring Boot con @Scheduled: fixed rate, fixed delay, expresiones cron, configuración del thread pool y estrategias para entornos con múltiples instancias."
imagenPortada: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java", "Backend", "Scheduling", "Cron", "Tareas Programadas"]
categoria: "tech"
keywords: "Spring Boot scheduled tasks, @Scheduled Java, cron Spring Boot, tareas programadas Spring, fixed rate fixed delay Spring, ThreadPoolTaskScheduler, distributed scheduling Spring, ShedLock Spring Boot, programar tareas periódicas Java"
---

# Tareas programadas en Spring Boot con @Scheduled

Cualquier backend con cierta madurez tiene tareas que deben ejecutarse de forma periódica: limpiar registros expirados, enviar reportes por email, sincronizar datos con sistemas externos, recalcular agregados, o generar archivos de exportación. Spring Boot ofrece un mecanismo nativo para esto con la anotación `@Scheduled`, que requiere muy poca configuración y se integra perfectamente con el contexto de Spring.

## Habilitar el scheduling

El primer paso es añadir `@EnableScheduling` en una clase de configuración o en la clase principal de la aplicación:

```java
@SpringBootApplication
@EnableScheduling
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

Sin esta anotación, `@Scheduled` no tiene efecto: los métodos se definen pero Spring nunca los invoca.

## Las tres formas de programar una tarea

### fixedRate: ejecución a intervalos fijos

`fixedRate` ejecuta el método cada N milisegundos medidos desde el **inicio** de la ejecución anterior. Si la tarea tarda más de N milisegundos, la siguiente invocación se encola y arranca en cuanto la anterior termina.

```java
@Scheduled(fixedRate = 5000)
public void sincronizarInventario() {
    log.info("Sincronizando inventario...");
    inventarioService.sincronizar();
}
```

### fixedDelay: espera entre ejecuciones

`fixedDelay` espera N milisegundos desde el **final** de la ejecución anterior antes de lanzar la siguiente. Garantiza que siempre hay un intervalo de reposo entre invocaciones, independientemente de cuánto tarde la tarea.

```java
@Scheduled(fixedDelay = 10_000)
public void procesarColaCorreos() {
    log.info("Procesando cola de correos pendientes...");
    correoService.procesarPendientes();
}
```

La diferencia clave:

- `fixedRate`: "ejecuta cada 5 segundos contando desde que empezó la última vez".
- `fixedDelay`: "ejecuta 10 segundos después de que terminó la última vez".

Usa `fixedDelay` cuando la tarea no debe solaparse ni acumularse; usa `fixedRate` cuando necesitas que el ritmo sea constante sin importar la duración de cada ejecución.

### cron: expresiones de cinco o seis campos

Las expresiones cron dan control fino sobre cuándo se ejecuta la tarea. Spring usa el formato de seis campos: segundos, minutos, horas, día del mes, mes y día de la semana.

```java
// Cada día a las 2:30 AM
@Scheduled(cron = "0 30 2 * * *")

// Cada lunes a las 8:00 AM
@Scheduled(cron = "0 0 8 * * MON")

// El primer día de cada mes a medianoche
@Scheduled(cron = "0 0 0 1 * *")

// Cada 15 minutos
@Scheduled(cron = "0 0/15 * * * *")

// De lunes a viernes a las 9:00 AM
@Scheduled(cron = "0 0 9 * * MON-FRI")
```

Spring también acepta macros predefinidas para los casos más comunes:

```java
@Scheduled(cron = "@daily")    // equivale a "0 0 0 * * *"
@Scheduled(cron = "@weekly")   // equivale a "0 0 0 * * 0"
@Scheduled(cron = "@monthly")  // equivale a "0 0 0 1 * *"
```

## Externalizar la configuración

Hardcodear intervalos o expresiones cron en el código dificulta ajustarlos sin recompilar. Lo habitual es leerlos desde `application.yml`:

```yaml
app:
  scheduling:
    inventario:
      fixed-rate: 5000
    correos:
      fixed-delay: 10000
    reporte-diario:
      cron: "0 0 8 * * MON-FRI"
```

```java
@Scheduled(fixedRateString = "${app.scheduling.inventario.fixed-rate}")
public void sincronizarInventario() {
    inventarioService.sincronizar();
}

@Scheduled(fixedDelayString = "${app.scheduling.correos.fixed-delay}")
public void procesarColaCorreos() {
    correoService.procesarPendientes();
}

@Scheduled(cron = "${app.scheduling.reporte-diario.cron}")
public void generarReporteDiario() {
    reporteService.generarYEnviar();
}
```

Las variantes `String` (`fixedRateString`, `fixedDelayString`, `cron`) aceptan expresiones SpEL y referencias a propiedades. Esto permite cambiar la frecuencia por entorno sin tocar el código: producción puede tener un cron real y el entorno de desarrollo puede usar un intervalo corto para pruebas.

## initialDelay: retrasar el primer arranque

Por defecto, `@Scheduled` ejecuta la primera invocación en cuanto el contexto de Spring termina de arrancar. Esto puede ser un problema si la tarea depende de que otros servicios externos estén disponibles. `initialDelay` (o `initialDelayString`) añade una espera antes de la primera ejecución:

```java
@Scheduled(fixedRate = 60_000, initialDelay = 30_000)
public void verificarConexionExterna() {
    // Espera 30 segundos antes de la primera verificación,
    // luego ejecuta cada 60 segundos
    monitorService.verificar();
}
```

## Configurar el thread pool

Por defecto, Spring usa un único hilo para todas las tareas `@Scheduled`. Esto significa que si una tarea tarda mucho, bloquea las demás. Para producción, es importante configurar un pool de hilos dedicado:

```java
@Configuration
public class SchedulingConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        registrar.setScheduler(taskScheduler());
    }

    @Bean(destroyMethod = "shutdown")
    public Executor taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(5);
        scheduler.setThreadNamePrefix("scheduled-task-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(30);
        return scheduler;
    }
}
```

Con `poolSize = 5`, hasta cinco tareas pueden ejecutarse en paralelo. `setWaitForTasksToCompleteOnShutdown(true)` junto con `setAwaitTerminationSeconds(30)` garantiza que Spring espera hasta 30 segundos a que las tareas en curso terminen antes de apagar la aplicación, evitando cortes a mitad de proceso.

Ajusta el tamaño del pool según el número de tareas concurrentes que necesites. Un valor entre 3 y 10 suele ser suficiente para la mayoría de los casos.

## Manejo de excepciones

Si un método `@Scheduled` lanza una excepción, Spring la captura, la registra en el log y programa la siguiente ejecución normalmente. La tarea no se cancela. Esto es conveniente para errores transitorios, pero puede enmascarar fallos persistentes.

El patrón más común es encapsular la lógica en un bloque try-catch y decidir explícitamente qué hacer con los errores:

```java
@Scheduled(cron = "0 0 3 * * *")
public void limpiarSesionesExpiradas() {
    try {
        int eliminadas = sessionService.eliminarExpiradas();
        log.info("Sesiones expiradas eliminadas: {}", eliminadas);
    } catch (DataAccessException e) {
        log.error("Error de BD al limpiar sesiones: {}", e.getMessage(), e);
        alertaService.notificar("Fallo en limpieza de sesiones", e);
    } catch (Exception e) {
        log.error("Error inesperado en limpieza de sesiones: {}", e.getMessage(), e);
    }
}
```

También puedes configurar un `ErrorHandler` a nivel del scheduler para centralizar el manejo:

```java
@Bean(destroyMethod = "shutdown")
public ThreadPoolTaskScheduler taskScheduler() {
    ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    scheduler.setPoolSize(5);
    scheduler.setThreadNamePrefix("scheduled-task-");
    scheduler.setErrorHandler(t -> 
        log.error("Error no controlado en tarea programada: {}", t.getMessage(), t)
    );
    return scheduler;
}
```

## Tareas programadas en entornos con múltiples instancias

Aquí está el problema más importante que suele ignorarse al empezar: **cuando despliegas tu aplicación con más de una instancia (horizontal scaling, Kubernetes con múltiples réplicas), cada instancia ejecutará sus propias tareas de forma independiente**.

Si tienes tres réplicas, una tarea cron que genera un reporte diario se ejecutará tres veces. Si la tarea inserta registros en una base de datos, los insertará tres veces. Esto puede ser catastrófico.

Hay tres estrategias comunes para resolver esto:

### 1. ShedLock: bloqueo distribuido con base de datos

[ShedLock](https://github.com/lukas-krecan/ShedLock) es la solución más usada. Usa una tabla en tu base de datos (o Redis, MongoDB, etc.) como mecanismo de bloqueo: solo la instancia que adquiere el lock ejecuta la tarea.

Agrega la dependencia:

```xml
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>5.13.0</version>
</dependency>
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-provider-jdbc-template</artifactId>
    <version>5.13.0</version>
</dependency>
```

Crea la tabla de bloqueos en tu base de datos:

```sql
CREATE TABLE shedlock (
    name        VARCHAR(64)  NOT NULL,
    lock_until  TIMESTAMP    NOT NULL,
    locked_at   TIMESTAMP    NOT NULL,
    locked_by   VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
```

Configura ShedLock en Spring:

```java
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT10M")
public class ShedLockConfig {

    @Bean
    public LockProvider lockProvider(DataSource dataSource) {
        return new JdbcTemplateLockProvider(
                JdbcTemplateLockProvider.Configuration.builder()
                        .withJdbcTemplate(new JdbcTemplate(dataSource))
                        .usingDbTime()
                        .build()
        );
    }
}
```

Anota tus tareas con `@SchedulerLock`:

```java
@Scheduled(cron = "0 0 8 * * MON-FRI")
@SchedulerLock(name = "generarReporteDiario", lockAtMostFor = "PT5M", lockAtLeastFor = "PT1M")
public void generarReporteDiario() {
    reporteService.generarYEnviar();
}
```

- `lockAtMostFor`: tiempo máximo que se mantiene el lock, incluso si la instancia muere sin liberarlo. Evita locks huérfanos.
- `lockAtLeastFor`: tiempo mínimo que se mantiene el lock, incluso si la tarea termina muy rápido. Evita que otra instancia la ejecute inmediatamente después.

### 2. Spring Profiles para deshabilitar scheduling en instancias secundarias

Una solución más simple pero menos robusta: designa una instancia "líder" mediante un perfil y solo esa ejecuta las tareas programadas. Es frágil porque si la instancia líder cae, las tareas dejan de ejecutarse.

```java
@Profile("scheduler")
@Component
public class TareasProgramadas {

    @Scheduled(cron = "0 0 3 * * *")
    public void limpiarSesiones() {
        sessionService.eliminarExpiradas();
    }
}
```

### 3. Quartz Scheduler

Para sistemas que necesitan alta disponibilidad, persistencia de jobs y clustering nativo, [Quartz](http://www.quartz-scheduler.org/) es la alternativa más completa. Spring Boot tiene soporte oficial con `spring-boot-starter-quartz`. La integración es más compleja que `@Scheduled` + ShedLock, pero ofrece control total sobre el clustering y la persistencia.

Para la mayoría de los proyectos, ShedLock es la opción correcta: sencillo, confiable y no requiere infraestructura adicional.

## Testing de tareas programadas

Probar tareas programadas tiene dos perspectivas diferentes:

### Probar la lógica de la tarea (unidad)

La lógica dentro de la tarea debe estar en un servicio separado. La tarea simplemente delega:

```java
@Scheduled(cron = "0 0 3 * * *")
public void limpiarSesionesExpiradas() {
    sessionService.eliminarExpiradas();
}
```

El servicio se prueba de forma ordinaria con Mockito, sin necesidad de scheduling:

```java
@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    @Mock
    private SessionRepository sessionRepository;

    @InjectMocks
    private SessionService sessionService;

    @Test
    void eliminarExpiradas_deberiaEliminarTodasLasSesionesVencidas() {
        when(sessionRepository.deleteByExpiresAtBefore(any())).thenReturn(42);

        int resultado = sessionService.eliminarExpiradas();

        assertThat(resultado).isEqualTo(42);
        verify(sessionRepository).deleteByExpiresAtBefore(any());
    }
}
```

### Probar que la tarea se ejecuta (integración)

Para verificar que `@Scheduled` se dispara correctamente en integración, puedes usar `@SpyBean` y `Awaitility` para esperar la invocación:

```java
@SpringBootTest
class LimpiezaSesionesScheduledTest {

    @SpyBean
    private TareasProgramadas tareas;

    @Test
    void limpiezaSesiones_deberiaEjecutarseSegunSchedule() {
        await()
            .atMost(Duration.ofSeconds(10))
            .untilAsserted(() -> 
                verify(tareas, atLeastOnce()).limpiarSesionesExpiradas()
            );
    }
}
```

Para que este test sea práctico, configura un `fixedDelay` muy corto para el entorno de test mediante propiedades de test:

```yaml
# src/test/resources/application-test.yml
app:
  scheduling:
    sesiones:
      cron: "* * * * * *"  # cada segundo, solo en tests
```

## Buenas prácticas

**Mantén los métodos `@Scheduled` delgados.** El método anotado debe limitarse a llamar a un servicio. Toda la lógica de negocio va en el servicio, donde es testeable de forma sencilla.

**Usa `fixedDelay` por defecto, `fixedRate` cuando necesitas ritmo constante.** El solapamiento que puede ocurrir con `fixedRate` si la tarea se retrasa es una fuente común de bugs difíciles de reproducir.

**Configura siempre el pool de hilos en producción.** El scheduler de un solo hilo por defecto es un cuello de botella que bloquea todas las tareas si una de ellas se atasca.

**Implementa ShedLock desde el principio si desplegarás más de una instancia.** Añadirlo después es sencillo técnicamente, pero corregir los efectos de ejecuciones duplicadas en producción puede ser costoso.

**Loguea el inicio y el resultado de cada ejecución.** Es difícil debuguear una tarea que falló silenciosamente a las 3 AM sin logs. Registra siempre cuándo empezó y cuánto tardó.

**Define un timeout para tareas largas.** Una tarea que se cuelga indefinidamente bloquea un hilo del pool. Considera envolver operaciones largas en un `CompletableFuture` con timeout o usar la gestión de timeouts del cliente HTTP/BD que uses.

## Conclusión

`@Scheduled` resuelve el caso más común —ejecutar código periódicamente— con muy poco código y sin dependencias adicionales. La configuración básica se hace en minutos; la parte que requiere cuidado real es el threading (pool de hilos) y el comportamiento en múltiples instancias (ShedLock).

El patrón que funciona bien en producción es: configurar un pool de hilos dedicado, externalizar todos los intervalos a propiedades, delegar la lógica a servicios testeables y proteger las tareas críticas con ShedLock cuando hay más de una réplica. Con eso, las tareas programadas dejan de ser una fuente de sorpresas.
