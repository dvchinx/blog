---
titulo: "Testcontainers con Spring Boot: integración real sin mocks"
seoTitulo: "Testcontainers con Spring Boot: guía completa de tests de integración"
fecha: "2026-07-25"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Testcontainers con Spring Boot para escribir tests de integración que arrancan contenedores Docker reales de PostgreSQL, Redis y Kafka, eliminando la necesidad de mocks frágiles."
imagenPortada: "https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Testcontainers", "Testing", "Docker", "Integration Tests", "Java"]
categoria: "tech"
keywords: "testcontainers spring boot, tests de integración, spring boot docker tests, testcontainers postgresql, testcontainers redis, testcontainers kafka, integration testing java, SpringBootTest testcontainers, spring boot testing"
---

# Testcontainers con Spring Boot: integración real sin mocks

Los tests de integración tienen un problema clásico: para probar que tu código funciona con PostgreSQL, Redis o Kafka, necesitas esas dependencias disponibles durante los tests. Las soluciones habituales son insatisfactorias. Los mocks de bases de datos no replican el comportamiento real del motor (diferencias de tipos, transacciones, índices). H2 en modo compatibilidad con PostgreSQL falla cuando usas características específicas del dialecto. Un servidor externo de CI compartido introduce acoplamiento y dependencias de red.

**Testcontainers** resuelve esto arrancando contenedores Docker reales durante los tests. Tu suite de integración habla con una instancia real de PostgreSQL —la misma imagen que correrás en producción— y al terminar el contenedor desaparece sin dejar estado. Sin configuración externa, sin servidores compartidos, sin mocks.

## ¿Qué es Testcontainers?

Testcontainers es una librería Java que gestiona el ciclo de vida de contenedores Docker desde el código de test. Expone una API fluente para definir qué imagen usar, qué puertos mapear y qué condiciones de salud esperar antes de que el test arranque.

Su integración con Spring Boot 3.1 en adelante es especialmente directa: la anotación `@ServiceConnection` configura automáticamente el `DataSource`, el cliente Redis o el consumer de Kafka apuntando al contenedor levantado, sin que tengas que sobreescribir propiedades manualmente.

## Configuración del proyecto

Añade las dependencias necesarias en `pom.xml`. Testcontainers publica un BOM que gestiona las versiones de todos sus módulos:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.testcontainers</groupId>
      <artifactId>testcontainers-bom</artifactId>
      <version>1.20.1</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>

<dependencies>
  <!-- Spring Boot Test (incluye JUnit 5) -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
  </dependency>

  <!-- Módulo de Testcontainers para JUnit 5 -->
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
  </dependency>

  <!-- Módulos específicos según lo que necesites -->
  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
  </dependency>

  <dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>kafka</artifactId>
    <scope>test</scope>
  </dependency>
</dependencies>
```

Para Redis no existe un módulo oficial de Testcontainers; se usa el módulo genérico con la imagen de Docker Hub.

También necesitas tener Docker corriendo en la máquina donde se ejecutan los tests (local o en CI). La mayoría de los entornos de CI modernos —GitHub Actions, GitLab CI, CircleCI— incluyen Docker sin configuración adicional.

## Tests con PostgreSQL

El caso más común es probar un repositorio JPA contra PostgreSQL real. Con `@ServiceConnection` en Spring Boot 3.1+, la configuración es mínima:

```java
@SpringBootTest
@Testcontainers
class PedidoRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private PedidoRepository pedidoRepository;

    @Test
    void debeGuardarYRecuperarPedido() {
        Pedido pedido = new Pedido();
        pedido.setClienteId("cliente-123");
        pedido.setTotal(BigDecimal.valueOf(99.99));
        pedido.setEstado(EstadoPedido.PENDIENTE);

        Pedido guardado = pedidoRepository.save(pedido);

        assertThat(guardado.getId()).isNotNull();
        assertThat(pedidoRepository.findById(guardado.getId()))
            .isPresent()
            .get()
            .satisfies(p -> {
                assertThat(p.getClienteId()).isEqualTo("cliente-123");
                assertThat(p.getTotal()).isEqualByComparingTo("99.99");
            });
    }
}
```

`@Container` le dice a Testcontainers que gestione el ciclo de vida del contenedor. `static` es clave: el contenedor se crea una sola vez por clase de test, no por cada método. `@ServiceConnection` inspecciona el tipo de contenedor (`PostgreSQLContainer`) y configura automáticamente el `DataSource` de Spring apuntando al puerto dinámico que Docker asignó.

Cuando el test termina, JUnit 5 destruye el contenedor automáticamente. El estado de la base de datos no persiste entre ejecuciones de test.

## Patrón con `@DynamicPropertySource` (Spring Boot 2.x y anteriores)

Si usas una versión de Spring Boot anterior a 3.1, o un tipo de contenedor que no tiene soporte de `@ServiceConnection`, puedes sobreescribir las propiedades de conexión manualmente:

```java
@SpringBootTest
@Testcontainers
class PedidoRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("testdb")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void configurarPropiedades(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    // ... tests
}
```

`@DynamicPropertySource` se ejecuta antes de que el contexto de Spring se inicialice, de modo que las propiedades inyectadas ya están disponibles cuando se configura el `DataSource`.

## Tests con Redis

Para Redis se usa el módulo genérico `GenericContainer` con la imagen oficial:

```java
@SpringBootTest
@Testcontainers
class SesionCacheServiceTest {

    @Container
    static GenericContainer<?> redis =
        new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configurarRedis(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", redis::getFirstMappedPort);
    }

    @Autowired
    private SesionCacheService sesionCacheService;

    @Test
    void debeAlmacenarYRecuperarSesion() {
        String sessionId = "sess-abc123";
        DatosSesion datos = new DatosSesion("usuario-1", List.of("ROLE_USER"));

        sesionCacheService.guardar(sessionId, datos, Duration.ofMinutes(30));

        Optional<DatosSesion> recuperado = sesionCacheService.buscar(sessionId);
        assertThat(recuperado).isPresent();
        assertThat(recuperado.get().getUsuarioId()).isEqualTo("usuario-1");
    }

    @Test
    void debeExpirarlaSesionTrasTTL() throws InterruptedException {
        String sessionId = "sess-efímera";
        sesionCacheService.guardar(sessionId, new DatosSesion("u", List.of()), Duration.ofSeconds(1));

        Thread.sleep(1500);

        assertThat(sesionCacheService.buscar(sessionId)).isEmpty();
    }
}
```

Con Spring Boot 3.1 hay soporte experimental de `@ServiceConnection` para Redis usando la imagen `redis:` como tipo reconocido, pero la API todavía está en maduración; `@DynamicPropertySource` sigue siendo la opción más robusta.

## Tests con Kafka

El módulo de Testcontainers para Kafka levanta un broker Kafka completo (usando la imagen `confluentinc/cp-kafka`) en segundos:

```java
@SpringBootTest
@Testcontainers
class PedidoEventoPublicadorTest {

    @Container
    @ServiceConnection
    static KafkaContainer kafka =
        new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.6.1"));

    @Autowired
    private PedidoEventoPublicador publicador;

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Value("${app.kafka.topic.pedidos}")
    private String topicPedidos;

    @Test
    void debePublicarEventoDePedidoCreado() throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        List<String> mensajesRecibidos = new ArrayList<>();

        // Consumidor inline para verificar el mensaje
        KafkaConsumer<String, String> consumer = crearConsumer();
        consumer.subscribe(List.of(topicPedidos));

        PedidoCreado evento = new PedidoCreado("pedido-999", "cliente-1", BigDecimal.TEN);
        publicador.publicar(evento);

        // Esperar hasta 5 segundos a que llegue el mensaje
        Awaitility.await()
            .atMost(5, TimeUnit.SECONDS)
            .until(() -> {
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(200));
                records.forEach(r -> mensajesRecibidos.add(r.value()));
                return !mensajesRecibidos.isEmpty();
            });

        assertThat(mensajesRecibidos).hasSize(1);
        assertThat(mensajesRecibidos.get(0)).contains("pedido-999");

        consumer.close();
    }
}
```

`@ServiceConnection` con `KafkaContainer` configura automáticamente `spring.kafka.bootstrap-servers` con la dirección del broker del contenedor, de modo que tanto los productores como los consumidores de tu aplicación apuntan al Kafka de test sin configuración adicional.

## Reutilización de contenedores entre clases de test

Por defecto, cada clase de test que declara un `@Container static` arranca y destruye su propio contenedor. Si tienes decenas de tests de integración, esto puede hacer que la suite tarde varios minutos solo en iniciar y destruir contenedores.

La solución es compartir el contenedor entre todos los tests usando el patrón de clase base:

```java
// Clase base compartida para todos los tests de integración
@SpringBootTest
@Testcontainers
public abstract class IntegrationTestBase {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:16-alpine");

    @Container
    static GenericContainer<?> redis =
        new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configurarRedis(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", redis::getFirstMappedPort);
    }
}

// Tests que heredan la infraestructura
class PedidoRepositoryTest extends IntegrationTestBase {
    @Autowired
    private PedidoRepository repository;

    @Test
    void debeGuardarPedido() { /* ... */ }
}

class ClienteServiceTest extends IntegrationTestBase {
    @Autowired
    private ClienteService service;

    @Test
    void debeBuscarCliente() { /* ... */ }
}
```

Como los campos `static` se comparten entre las clases que heredan, Spring Boot reutiliza el mismo contexto de aplicación —y los mismos contenedores— para todos los tests que extienden `IntegrationTestBase`. El arranque ocurre una sola vez por ejecución de la suite completa.

Testcontainers también ofrece la opción de reutilización explícita con `.withReuse(true)`, que mantiene el contenedor vivo entre ejecuciones del proceso de Maven o Gradle. Es útil en desarrollo local para evitar el tiempo de arranque en cada `./mvnw test`, pero no se recomienda en CI porque puede dejar estado entre ejecuciones de diferentes PRs.

## Limpieza de datos entre tests

Con contenedores compartidos, el estado de la base de datos persiste entre métodos de test dentro de la misma suite. Hay varias estrategias para mantener el aislamiento:

**Transacciones revertidas**: la anotación `@Transactional` en los tests hace que Spring revierta la transacción al finalizar cada método. Es la opción más sencilla para tests de repositorio.

```java
@Transactional
@Test
void debeGuardarPedido() {
    pedidoRepository.save(new Pedido(/* ... */));
    // Al terminar el test, la transacción se revierte automáticamente
}
```

**SQL de limpieza con `@Sql`**: ejecuta scripts de limpieza antes o después de cada test.

```java
@Sql(scripts = "/sql/limpiar-pedidos.sql",
     executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
@Test
void debeListarPedidosPendientes() { /* ... */ }
```

**`@DirtiesContext`**: destruye y recrea el contexto de Spring (y con él los datos en memoria o el contenedor si no es `static`). Caro en tiempo; usar solo cuando sea estrictamente necesario.

## Arranque local de la aplicación con Testcontainers

Desde Spring Boot 3.1, Testcontainers se puede usar también para el arranque local del proyecto, no solo en tests. El módulo `spring-boot-testcontainers` permite definir una clase de arranque alternativa en `src/test/java` que levanta los contenedores antes de que arranque la aplicación:

```java
// src/test/java/.../LocalApplication.java
public class LocalApplication {

    public static void main(String[] args) {
        SpringApplication
            .from(Application::main)
            .with(LocalContainersConfig.class)
            .run(args);
    }
}

@TestConfiguration(proxyBeanMethods = false)
class LocalContainersConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>("postgres:16-alpine");
    }

    @Bean
    @ServiceConnection
    GenericContainer<?> redis() {
        return new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);
    }
}
```

Con esto, ejecutar `LocalApplication.main()` desde el IDE arranca PostgreSQL y Redis en Docker automáticamente, sin instalarlos ni configurarlos en el sistema operativo local. El entorno de desarrollo queda completamente gestionado por código.

## Mejores prácticas

**Usa imágenes fijadas a una versión específica.** `postgres:latest` puede cambiar entre ejecuciones y romper tests sin que haya cambiado nada en tu código. Usa siempre `postgres:16-alpine` o similar con versión explícita.

**Prefiere `@ServiceConnection` sobre `@DynamicPropertySource` cuando esté disponible.** Es menos código y aprovecha la integración oficial de Spring Boot, que gestiona correctamente el orden de inicialización.

**Evita `Thread.sleep()` para esperar eventos asíncronos.** Usa Awaitility con un timeout razonable. El `sleep` hace los tests lentos cuando todo va bien y los vuelve flaky cuando el sistema está bajo carga.

**Segrega los tests de integración del resto.** Usa una anotación propia o el perfil `integration-test` de Maven/Gradle para que los tests de integración no se ejecuten en cada `mvn test` del ciclo de desarrollo rápido, sino solo en CI o bajo demanda.

```xml
<!-- pom.xml: excluir tests de integración del ciclo test por defecto -->
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <excludes>
            <exclude>**/*IntegrationTest.java</exclude>
            <exclude>**/*IT.java</exclude>
        </excludes>
    </configuration>
</plugin>
```

**Mide el tiempo de arranque.** Si la suite de integración supera los 3-4 minutos, revisa cuántos contextos de Spring Boot distintos estás arrancando. Cada `@SpringBootTest` con propiedades diferentes crea un contexto nuevo. La clase base compartida reduce drásticamente ese número.

## Conclusión

Testcontainers elimina la brecha entre "funciona con el mock" y "funciona con la base de datos real". El precio es que los tests son más lentos que los unitarios puros, pero el valor que aportan es cualitativamente diferente: detectan problemas de migraciones, de tipos de datos, de transacciones y de configuración que ningún mock puede revelar.

Con la integración nativa de Spring Boot 3.1 a través de `@ServiceConnection`, el código de configuración se reduce al mínimo. La mayor parte del esfuerzo va donde debe ir: en escribir aserciones útiles que verifiquen el comportamiento real del sistema. El contenedor es un detalle de infraestructura que Testcontainers gestiona por ti.
