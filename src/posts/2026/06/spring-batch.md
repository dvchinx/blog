---
titulo: "Spring Batch: procesamiento de datos en lotes con Spring Boot"
seoTitulo: "Spring Batch: guía práctica de procesamiento batch con Spring Boot"
fecha: "2026-06-21"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a construir pipelines de procesamiento batch con Spring Batch: Jobs, Steps, chunk-oriented processing, ItemReader, ItemProcessor, ItemWriter y manejo de errores."
imagenPortada: "https://i.imgur.com/YvDSYzx.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Batch", "Java", "Backend", "Batch Processing", "ETL"]
categoria: "tech"
keywords: "Spring Batch, Spring Boot batch, procesamiento batch Java, Job Spring Batch, Step batch, ItemReader, ItemProcessor, ItemWriter, chunk processing, ETL Spring"
---

# Spring Batch: procesamiento de datos en lotes con Spring Boot

Procesar millones de registros de una base de datos, transformar archivos CSV de gran tamaño, generar reportes nocturnos, migrar datos entre sistemas: estas tareas tienen algo en común. No se ejecutan en respuesta a una petición HTTP, no necesitan respuesta inmediata, y fallar a mitad del proceso sin poder reiniciar desde el punto de falla es inaceptable.

**Spring Batch** resuelve exactamente esto. Es el framework del ecosistema Spring para construir pipelines de procesamiento por lotes: confiables, reiniciables y con soporte nativo para el manejo de errores, reintentos y skip de registros inválidos.

## Conceptos fundamentales

Antes del código, conviene tener claros los bloques que Spring Batch ensambla:

- **Job**: la unidad de trabajo completa. Puede tener uno o varios pasos.
- **Step**: una fase del Job. Puede ser chunk-oriented (lee, procesa y escribe en lotes) o tasklet (una operación personalizada).
- **ItemReader**: lee los datos de la fuente (DB, CSV, XML, API...).
- **ItemProcessor**: transforma o filtra cada ítem. Es opcional.
- **ItemWriter**: escribe el resultado en el destino.
- **JobRepository**: persiste el estado de ejecución (Jobs, Steps, parámetros) en base de datos.
- **JobLauncher**: dispara la ejecución de un Job.

El flujo de un Step chunk-oriented es: leer N ítems → procesarlos uno a uno → escribirlos todos juntos. Ese grupo de N ítems es el **chunk**.

## Dependencias

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-batch</artifactId>
</dependency>
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
```

Spring Batch requiere una base de datos para el `JobRepository`. En desarrollo H2 en memoria es suficiente; en producción usa PostgreSQL o MySQL. Spring Boot autoconfigura las tablas de metadatos automáticamente con `spring.batch.jdbc.initialize-schema=always`.

Configuración mínima en `application.yml`:

```yaml
spring:
  batch:
    job:
      enabled: false          # evita que los Jobs arranquen al iniciar la app
    jdbc:
      initialize-schema: always
  datasource:
    url: jdbc:h2:mem:batchdb
    driver-class-name: org.h2.Driver
```

`job.enabled: false` es importante: por defecto Spring Boot lanza todos los Jobs al arrancar. En producción querrás controlar cuándo se ejecutan.

## Un Job completo: importar un CSV de usuarios

El ejemplo clásico de Spring Batch es leer un CSV, transformar los datos y guardarlos en base de datos.

### El modelo de datos

```java
public record UserRecord(String firstName, String lastName, String email) {}

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String firstName;
    private String lastName;
    private String email;
    private LocalDateTime importedAt;

    // constructores, getters, setters
}
```

### El ItemReader

Para leer CSV, Spring Batch incluye `FlatFileItemReader`:

```java
@Bean
public FlatFileItemReader<UserRecord> userCsvReader() {
    return new FlatFileItemReaderBuilder<UserRecord>()
        .name("userCsvReader")
        .resource(new ClassPathResource("data/users.csv"))
        .delimited()
        .names("firstName", "lastName", "email")
        .targetType(UserRecord.class)
        .linesToSkip(1)  // salta el encabezado
        .build();
}
```

El archivo `users.csv` tiene este aspecto:

```
firstName,lastName,email
Ana,García,ana@example.com
Carlos,López,carlos@example.com
María,Martínez,maria@example.com
```

### El ItemProcessor

El processor transforma `UserRecord` en la entidad `User` y puede filtrar registros (retornar `null` descarta el ítem):

```java
@Component
public class UserProcessor implements ItemProcessor<UserRecord, User> {

    @Override
    public User process(UserRecord record) {
        // filtra emails inválidos
        if (record.email() == null || !record.email().contains("@")) {
            return null;
        }

        User user = new User();
        user.setFirstName(record.firstName().trim());
        user.setLastName(record.lastName().trim());
        user.setEmail(record.email().toLowerCase());
        user.setImportedAt(LocalDateTime.now());
        return user;
    }
}
```

### El ItemWriter

Para persistir en JPA, `RepositoryItemWriter` delega directamente en un Spring Data repository:

```java
@Bean
public RepositoryItemWriter<User> userWriter(UserRepository userRepository) {
    RepositoryItemWriter<User> writer = new RepositoryItemWriter<>();
    writer.setRepository(userRepository);
    writer.setMethodName("save");
    return writer;
}
```

### El Step y el Job

```java
@Configuration
@EnableBatchProcessing
public class UserImportJobConfig {

    @Bean
    public Step importUsersStep(
        JobRepository jobRepository,
        PlatformTransactionManager transactionManager,
        FlatFileItemReader<UserRecord> reader,
        UserProcessor processor,
        RepositoryItemWriter<User> writer
    ) {
        return new StepBuilder("importUsersStep", jobRepository)
            .<UserRecord, User>chunk(100, transactionManager)
            .reader(reader)
            .processor(processor)
            .writer(writer)
            .build();
    }

    @Bean
    public Job importUsersJob(JobRepository jobRepository, Step importUsersStep) {
        return new JobBuilder("importUsersJob", jobRepository)
            .start(importUsersStep)
            .build();
    }
}
```

`chunk(100, transactionManager)` significa: lee 100 registros, procésalos y escríbelos en una sola transacción. Si falla alguno de los 100, toda la transacción se revierte y Spring Batch registra el fallo.

## Leer desde base de datos con JdbcPagingItemReader

Cuando la fuente es una tabla de base de datos, `JdbcPagingItemReader` pagina automáticamente la consulta para no cargar todo en memoria:

```java
@Bean
public JdbcPagingItemReader<OrderDto> orderReader(DataSource dataSource) {
    return new JdbcPagingItemReaderBuilder<OrderDto>()
        .name("orderReader")
        .dataSource(dataSource)
        .selectClause("SELECT id, customer_id, total, status")
        .fromClause("FROM orders")
        .whereClause("WHERE status = 'PENDING' AND created_at < :cutoff")
        .sortKeys(Map.of("id", Order.ASCENDING))
        .parameterValues(Map.of("cutoff", LocalDate.now().minusDays(30)))
        .rowMapper(new BeanPropertyRowMapper<>(OrderDto.class))
        .pageSize(500)
        .build();
}
```

Cada página lanza una consulta con `LIMIT/OFFSET` (o el equivalente del dialecto SQL), así el heap de la JVM no crece con el tamaño de la tabla.

## Manejo de errores: skip y retry

En un lote real, no todos los registros son perfectos. Spring Batch permite saltar registros fallidos o reintentarlos antes de descartar:

```java
@Bean
public Step robustStep(JobRepository jobRepository, PlatformTransactionManager txManager, ...) {
    return new StepBuilder("robustStep", jobRepository)
        .<UserRecord, User>chunk(100, txManager)
        .reader(reader)
        .processor(processor)
        .writer(writer)
        // reintenta hasta 3 veces ante errores transitorios de red o DB
        .faultTolerant()
        .retryLimit(3)
        .retry(TransientDataAccessException.class)
        // salta registros con datos inválidos (máximo 10 skips por Step)
        .skipLimit(10)
        .skip(ValidationException.class)
        .build();
}
```

Los registros saltados se registran en el `JobRepository` con su índice, lo que permite auditarlos después.

## Tasklet: para operaciones que no son chunk

No todo en un Job es leer-procesar-escribir. A veces necesitas ejecutar una sola operación: limpiar una tabla antes de importar, enviar un email al final, comprimir un archivo de salida. Para eso existe el `Tasklet`:

```java
@Component
public class CleanupTasklet implements Tasklet {

    private final UserRepository userRepository;

    public CleanupTasklet(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public RepeatStatus execute(StepContribution contribution, ChunkContext chunkContext) {
        userRepository.deleteByImportedAtBefore(LocalDateTime.now().minusDays(90));
        log.info("Usuarios antiguos eliminados");
        return RepeatStatus.FINISHED;
    }
}

@Bean
public Step cleanupStep(JobRepository jobRepository,
                        PlatformTransactionManager txManager,
                        CleanupTasklet cleanupTasklet) {
    return new StepBuilder("cleanupStep", jobRepository)
        .tasklet(cleanupTasklet, txManager)
        .build();
}
```

## Jobs con múltiples Steps

Un Job puede encadenar varios Steps. Por defecto se ejecutan secuencialmente:

```java
@Bean
public Job fullImportJob(JobRepository jobRepository,
                         Step cleanupStep,
                         Step importUsersStep,
                         Step notifyStep) {
    return new JobBuilder("fullImportJob", jobRepository)
        .start(cleanupStep)
        .next(importUsersStep)
        .next(notifyStep)
        .build();
}
```

Si un Step falla, los Steps siguientes no se ejecutan. Spring Batch registra en qué Step falló, lo que permite reiniciar el Job desde ese punto en la siguiente ejecución en lugar de comenzar desde cero.

## Lanzar un Job manualmente

Con `job.enabled: false` en la configuración, necesitas disparar el Job explícitamente. El mecanismo habitual es un endpoint o un scheduler:

```java
@RestController
@RequestMapping("/batch")
public class BatchController {

    private final JobLauncher jobLauncher;
    private final Job importUsersJob;

    public BatchController(JobLauncher jobLauncher, Job importUsersJob) {
        this.jobLauncher = jobLauncher;
        this.importUsersJob = importUsersJob;
    }

    @PostMapping("/import-users")
    public ResponseEntity<String> triggerImport() throws Exception {
        JobParameters params = new JobParametersBuilder()
            .addLocalDateTime("startedAt", LocalDateTime.now())
            .toJobParameters();

        JobExecution execution = jobLauncher.run(importUsersJob, params);
        return ResponseEntity.ok("Job lanzado con ID: " + execution.getJobId());
    }
}
```

Los `JobParameters` son importantes: Spring Batch identifica una instancia de Job por la combinación de nombre + parámetros. Para poder ejecutar el mismo Job varias veces, al menos un parámetro debe cambiar entre ejecuciones (por eso se incluye el timestamp).

## Listeners para observabilidad

Spring Batch tiene listeners para interceptar el ciclo de vida de Jobs y Steps:

```java
@Component
public class JobCompletionListener implements JobExecutionListener {

    @Override
    public void afterJob(JobExecution jobExecution) {
        if (jobExecution.getStatus() == BatchStatus.COMPLETED) {
            long written = jobExecution.getStepExecutions().stream()
                .mapToLong(StepExecution::getWriteCount)
                .sum();
            log.info("Job completado. Registros escritos: {}", written);
        } else {
            log.error("Job terminó con estado: {}", jobExecution.getStatus());
        }
    }
}

// Se registra en el Job:
@Bean
public Job importUsersJob(JobRepository jobRepository, Step importStep,
                          JobCompletionListener listener) {
    return new JobBuilder("importUsersJob", jobRepository)
        .listener(listener)
        .start(importStep)
        .build();
}
```

Con `StepExecutionListener` se puede hacer lo mismo a nivel de Step, lo que es útil para métricas granulares.

## Cuándo usar Spring Batch

Spring Batch es la elección correcta cuando:

- El volumen de datos hace inviable procesarlos en una sola transacción.
- El proceso debe ser reiniciable: si falla a mitad, debe continuar desde donde se quedó.
- Necesitas auditoría detallada de cada ejecución (qué se procesó, cuánto tardó, cuántos registros fallaron).
- El procesamiento puede paralelizarse (Spring Batch tiene soporte para Steps paralelos y particionamiento).

Para tareas simples y pequeñas, un `@Scheduled` con lógica directa en el servicio es más que suficiente. La complejidad de Spring Batch se justifica cuando la confiabilidad y trazabilidad del proceso son requisitos reales, no opcionales.
