---
titulo: "Bloqueo optimista y pesimista en JPA: control de concurrencia en Spring Boot sin perder actualizaciones"
seoTitulo: "Bloqueo optimista y pesimista en JPA con Spring Boot"
fecha: "2026-11-24"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Bloqueo optimista y pesimista en JPA con Spring Boot: @Version, @Lock, reintentos, HTTP 409, SKIP LOCKED, deadlocks y cómo probar la concurrencia de verdad."
imagenPortada: ""
etiquetas: ["Spring Boot", "Spring Data JPA", "Hibernate", "Base de datos", "Concurrencia", "Java", "Backend"]
categoria: "tech"
keywords: "bloqueo optimista y pesimista, bloqueo optimista jpa, bloqueo pesimista jpa, bloqueo optimista spring boot, optimistic locking spring boot, pessimistic locking jpa, @version jpa, optimisticlockexception, objectoptimisticlockingfailureexception, @lock pessimistic_write, lockmodetype jpa, select for update spring data jpa, skip locked spring boot, lost update actualización perdida, concurrencia spring data jpa, control de concurrencia base de datos, reintentar optimisticlockexception, http 409 conflict spring boot, etag if-match spring boot, deadlock jpa"
---

# Bloqueo optimista y pesimista en JPA: control de concurrencia en Spring Boot sin perder actualizaciones

Todo funciona en local. Pruebas el endpoint que descuenta stock, el saldo cuadra, los tests pasan. Luego llega el Black Friday, dos personas compran la última unidad del mismo producto en el mismo segundo y el inventario termina en `-1`; o dos administradores editan la misma ficha y los cambios del primero desaparecen sin dejar rastro. No hay excepción, no hay error en los logs: simplemente un dato incorrecto. Es la **actualización perdida**, y el **bloqueo optimista y pesimista en JPA** existe precisamente para evitarla.

La mayoría de tutoriales despachan el tema con un `@Version` y un `@Lock(PESSIMISTIC_WRITE)`, pero se callan lo importante: qué hacer cuando salta la `OptimisticLockException`, por qué un reintento dentro de `@Transactional` no sirve de nada, cómo trasladar el conflicto a la API con un `409` o un `ETag`, cómo repartir trabajo entre varias instancias con `SKIP LOCKED`, cómo evitar deadlocks y, sobre todo, cómo **probar** que tu código aguanta la concurrencia en lugar de suponerlo. En esta guía lo recorremos todo con **Spring Boot 4.1, Spring Data JPA y PostgreSQL**, con código que puedes copiar.

## El problema: la actualización perdida (lost update)

![Diagrama de una actualización perdida: dos transacciones leen stock 10, ambas escriben 9 y la base de datos termina con stock 9 en lugar de 8](/diagrams/2026/11/bloqueo-optimista-pesimista-jpa/actualizacion-perdida-lost-update.png)

El patrón que la provoca es el más natural del mundo en una aplicación con JPA: **leer, modificar en memoria y guardar**.

```java
@Transactional
public void descontarStock(Long productoId, int cantidad) {
    Producto producto = repositorio.findById(productoId).orElseThrow();
    if (producto.getStock() < cantidad) {
        throw new StockInsuficienteException(productoId);
    }
    producto.setStock(producto.getStock() - cantidad); // se escribe en el flush
}
```

Si dos peticiones ejecutan este método a la vez, ambas leen `stock = 10`, ambas calculan `9` y ambas escriben `9`. La segunda escritura pisa a la primera. La transacción no te protege: con el nivel de aislamiento por defecto de PostgreSQL (*Read Committed*), cada `UPDATE` es válido por separado. El fallo está en que la decisión se tomó con un dato que ya no era cierto en el momento de escribir.

Tampoco sirve `synchronized` en el método: en cuanto despliegas dos réplicas (y en Kubernetes siempre las hay), cada JVM tiene su propio monitor y el problema vuelve. El control de concurrencia tiene que vivir donde viven los datos: en la base de datos.

## ¿Qué es el bloqueo optimista y pesimista?

**El bloqueo optimista y pesimista son las dos estrategias de JPA para evitar que transacciones concurrentes se pisen. El optimista no bloquea nada: detecta el conflicto al escribir comparando una columna de versión y falla si otro cambió la fila. El pesimista bloquea la fila al leerla (`SELECT ... FOR UPDATE`) y hace esperar a los demás.**

Dicho de otra forma: el optimista apuesta a que los conflictos son raros y paga solo cuando ocurren; el pesimista asume que serán frecuentes y paga siempre, a cambio de no tener que repetir trabajo. Ambos están definidos en la especificación [Jakarta Persistence](https://jakarta.ee/specifications/persistence/) a través de `LockModeType`, y Hibernate los traduce al SQL de cada base de datos.

| Criterio | Bloqueo optimista | Bloqueo pesimista |
|---|---|---|
| Mecanismo | Columna `@Version` en el `WHERE` del `UPDATE` | `SELECT ... FOR UPDATE` / `FOR SHARE` |
| Bloquea filas al leer | No | Sí, hasta el fin de la transacción |
| Cuándo detecta el conflicto | Al hacer flush/commit | Nunca hay conflicto: el segundo espera |
| Coste sin contención | Prácticamente cero | Bloqueos y esperas en cada lectura |
| Coste con mucha contención | Muchos reintentos fallidos | Colas de espera, riesgo de deadlock |
| Sirve entre peticiones HTTP | Sí (la versión viaja al cliente) | No (el bloqueo muere con la transacción) |
| Caso típico | Edición de fichas, formularios, la mayoría de CRUD | Saldos, stock muy disputado, colas de trabajo |

## Bloqueo optimista en JPA con @Version

![Diagrama del bloqueo optimista con @Version: dos transacciones leen la versión 1, la primera actualiza a versión 2 y la segunda recibe 0 filas y una OptimisticLockException](/diagrams/2026/11/bloqueo-optimista-pesimista-jpa/bloqueo-optimista-version-jpa.png)

Activarlo es añadir un campo anotado con `@Version` a la entidad. Hibernate se encarga del resto.

```java
@Entity
@Table(name = "productos")
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nombre;

    @Column(nullable = false)
    private int stock;

    @Version                 // la gestiona Hibernate: nunca la modifiques a mano
    private long version;    // tipo primitivo o Long; también admite Instant

    // getters, constructor protegido para JPA...
}
```

```sql
-- Migración con Flyway: la columna arranca en 0 para las filas existentes
ALTER TABLE productos ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
```

A partir de ahí, cada `UPDATE` que genera Hibernate incluye la versión leída en el `WHERE` y la incrementa:

```sql
UPDATE productos
SET stock = 9, version = 2
WHERE id = 42 AND version = 1;
```

Si otra transacción ya cambió la fila, la versión ya no es `1`, el `UPDATE` afecta a **0 filas** y Hibernate lanza una `OptimisticLockException`. Spring la traduce a `ObjectOptimisticLockingFailureException`, subclase de `OptimisticLockingFailureException`, que es la que deberías capturar en tu código para no acoplarte a Hibernate. Si aún no tienes claro cuándo hace Hibernate el flush, repasa la [gestión de transacciones en Spring](/2026/06/spring-transaction-management): la excepción no salta en el `setStock()`, sino al sincronizar con la base de datos, normalmente en el commit.

Un detalle que pocos mencionan: `@Version` también protege contra la actualización perdida cuando lo que se modifica es una **colección** o una relación del agregado, siempre que el cambio pase por la entidad raíz. Si quieres forzar el incremento aunque solo cambie un hijo, usa `LockModeType.OPTIMISTIC_FORCE_INCREMENT` al cargar la raíz.

### Qué hacer cuando salta la OptimisticLockException

Detectar el conflicto es la mitad del trabajo. La otra mitad es decidir qué hacer, y depende de quién tomó la decisión con datos viejos:

- **Si la decisión la toma el servidor** (descontar stock, sumar puntos, cambiar un estado tras validar reglas), lo correcto es **reintentar**: volver a leer, volver a validar y volver a escribir.
- **Si la decisión la tomó una persona** (editó un formulario viendo datos que ya cambiaron), **no reintentes**: devuelve un conflicto y deja que el usuario vea la versión actual.

### Reintentar con @Retryable: fuera de la transacción

Aquí está el error más común. Este código **no funciona**:

```java
// MAL: el reintento ocurre dentro de la misma transacción (o la excepción
// salta en el commit, después de que el método ya terminó)
@Transactional
@Retryable(includes = OptimisticLockingFailureException.class)
public void descontarStock(Long id, int cantidad) { ... }
```

Una transacción que ha sufrido una `OptimisticLockException` queda marcada para rollback y su contexto de persistencia contiene la entidad con la versión vieja: reintentar dentro de ella vuelve a fallar. Y como el conflicto suele detectarse en el commit, la excepción ni siquiera nace dentro del método. **El reintento tiene que envolver la transacción completa**, de modo que cada intento abra una transacción nueva y lea datos frescos.

Con Spring Framework 7 (la base de Spring Boot 4) ya no necesitas la librería externa: `@Retryable` forma parte del núcleo, en el paquete `org.springframework.resilience.annotation`, y se activa con `@EnableResilientMethods` (detalles en la [documentación de resiliencia de Spring](https://docs.spring.io/spring-framework/reference/core/resilience.html)). Si sigues en Spring Boot 3, el equivalente es el que vimos en [Spring Retry](/2026/08/spring-retry).

```java
@Configuration
@EnableResilientMethods
public class ResilienciaConfig {
}
```

```java
// Bean externo: reintenta y llama a la parte transaccional a través del proxy
@Service
public class InventarioFacade {

    private final InventarioService inventario;

    public InventarioFacade(InventarioService inventario) {
        this.inventario = inventario;
    }

    @Retryable(
            includes = OptimisticLockingFailureException.class,
            maxRetries = 3,      // 1 intento + 3 reintentos
            delay = 50,          // ms antes del primer reintento
            multiplier = 2,      // 50, 100, 200 ms...
            jitter = 25)         // aleatoriedad para que no reintenten todos a la vez
    public void descontarStock(Long productoId, int cantidad) {
        inventario.descontarStock(productoId, cantidad); // cada intento = transacción nueva
    }
}
```

```java
@Service
public class InventarioService {

    private final ProductoRepository repositorio;

    public InventarioService(ProductoRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional
    public void descontarStock(Long productoId, int cantidad) {
        Producto producto = repositorio.findById(productoId)
                .orElseThrow(() -> new ProductoNoEncontradoException(productoId));
        if (producto.getStock() < cantidad) {
            throw new StockInsuficienteException(productoId); // no se reintenta
        }
        producto.setStock(producto.getStock() - cantidad);
    }
}
```

Separarlo en dos beans no es burocracia: `@Retryable` y `@Transactional` funcionan con proxies, y una llamada interna dentro del mismo bean no pasa por el proxy. Además, reintenta solo cuando la operación es segura de repetir; si el método publica un evento o llama a otro servicio, combínalo con lo que vimos en [idempotencia en APIs](/2026/08/idempotencia-apis-sistemas-distribuidos) o con el [patrón Outbox](/2026/07/outbox-pattern).

### Bloqueo optimista en una API REST: la versión viaja al cliente

La gran ventaja del optimista es que funciona **entre peticiones**. El usuario abre la ficha (GET), tarda cinco minutos en editarla y la guarda (PUT). Ningún bloqueo de base de datos puede durar cinco minutos, pero la versión sí puede viajar al cliente y volver.

Aquí hay una trampa sutil: si en el PUT cargas la entidad con `findById()` y le copias los campos del DTO, Hibernate usa la versión **que acaba de leer**, no la que tenía el usuario. El conflicto nunca se detecta. Y asignar la versión del DTO a una entidad gestionada no sirve: Hibernate ignora ese cambio. La comparación hay que hacerla explícitamente:

```java
public record ActualizarProductoRequest(
        @NotBlank String nombre,
        @PositiveOrZero int stock,
        @NotNull Long version) {   // la versión que vio el usuario
}
```

```java
@Transactional
public Producto actualizar(Long id, ActualizarProductoRequest req) {
    Producto producto = repositorio.findById(id)
            .orElseThrow(() -> new ProductoNoEncontradoException(id));

    // Compara la versión del cliente con la actual: si difiere, alguien guardó antes
    if (producto.getVersion() != req.version()) {
        throw new ObjectOptimisticLockingFailureException(Producto.class, id);
    }
    producto.setNombre(req.nombre());
    producto.setStock(req.stock());
    return producto; // el UPDATE ... WHERE version = ? cubre la carrera restante
}
```

La comparación manual detecta los cambios ocurridos mientras el usuario editaba; el `WHERE version = ?` de Hibernate cubre la ventana de milisegundos entre la lectura y el commit. Con un manejador global, como el que construimos en [manejo de excepciones en Spring](/2026/06/spring-exception-handling), el conflicto se convierte en un `409 Conflict` con `ProblemDetail`:

```java
@RestControllerAdvice
public class ConcurrenciaExceptionHandler {

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ProblemDetail conflicto(OptimisticLockingFailureException ex) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "El recurso fue modificado por otra persona. Recarga y vuelve a intentarlo.");
        problema.setTitle("Conflicto de concurrencia");
        return problema;
    }
}
```

Si prefieres seguir el estándar HTTP, la versión encaja de forma natural en un **ETag**. El GET devuelve `ETag: "3"` y el cliente envía `If-Match: "3"` en el PUT; si no coincide, la respuesta correcta según las [peticiones condicionales de RFC 9110](https://www.rfc-editor.org/rfc/rfc9110#name-if-match) es `412 Precondition Failed`:

```java
@GetMapping("/{id}")
public ResponseEntity<ProductoDto> obtener(@PathVariable Long id) {
    Producto p = servicio.buscar(id);
    return ResponseEntity.ok()
            .eTag(String.valueOf(p.getVersion()))   // ETag: "3"
            .body(ProductoDto.de(p));
}

@PutMapping("/{id}")
public ResponseEntity<ProductoDto> actualizar(
        @PathVariable Long id,
        @RequestHeader(HttpHeaders.IF_MATCH) String ifMatch,
        @Valid @RequestBody ProductoRequest body) {
    long version = Long.parseLong(ifMatch.replace("\"", ""));
    Producto p = servicio.actualizar(id, body, version); // misma comparación de antes
    return ResponseEntity.ok().eTag(String.valueOf(p.getVersion())).body(ProductoDto.de(p));
}
```

Con `If-Match` ausente puedes responder `428 Precondition Required` para obligar a los clientes a participar en el control de concurrencia.

## Bloqueo pesimista en JPA con @Lock

Cuando el mismo registro se disputa constantemente (el saldo de una cuenta con muchos movimientos, el stock de un producto en oferta), el optimista se vuelve caro: la mayoría de intentos fallan y se reintentan. En ese escenario es mejor hacer cola desde el principio. En Spring Data JPA basta con anotar el método del repositorio:

```java
public interface CuentaRepository extends JpaRepository<Cuenta, Long> {

    // SELECT ... FROM cuentas WHERE id = ? FOR UPDATE
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Cuenta c where c.id = :id")
    Optional<Cuenta> findByIdParaActualizar(@Param("id") Long id);
}
```

```java
@Transactional
public void transferir(Long origenId, Long destinoId, BigDecimal monto) {
    // Bloquea siempre en el mismo orden (por id) para evitar deadlocks
    Long primero = Math.min(origenId, destinoId);
    Long segundo = Math.max(origenId, destinoId);

    Cuenta a = cuentas.findByIdParaActualizar(primero).orElseThrow();
    Cuenta b = cuentas.findByIdParaActualizar(segundo).orElseThrow();

    Cuenta origen = a.getId().equals(origenId) ? a : b;
    Cuenta destino = origen == a ? b : a;

    origen.debitar(monto);   // valida saldo con el dato bloqueado: nadie puede cambiarlo
    destino.acreditar(monto);
}   // commit: se liberan los bloqueos
```

Los modos pesimistas que ofrece `LockModeType` son tres:

- **`PESSIMISTIC_WRITE`**: bloqueo exclusivo (`FOR UPDATE`). Nadie más puede bloquear ni modificar la fila hasta tu commit. Es el que necesitas en el 95 % de los casos.
- **`PESSIMISTIC_READ`**: bloqueo compartido (`FOR SHARE` en PostgreSQL). Varios pueden leer bloqueando, pero nadie puede escribir. Útil para garantizar que un dato del que dependes no cambie mientras decides, sin bloquear a otros lectores. En bases de datos sin bloqueo compartido, Hibernate lo degrada a `FOR UPDATE`.
- **`PESSIMISTIC_FORCE_INCREMENT`**: bloqueo exclusivo que además incrementa la `@Version`, para que las transacciones optimistas que trabajan con la misma entidad detecten el cambio.

Recuerda que el bloqueo solo existe **dentro de una transacción**: un método `@Lock` llamado sin `@Transactional` fallará con `TransactionRequiredException`, o, peor, bloqueará y liberará en la misma sentencia sin proteger nada.

### Timeouts de bloqueo: no esperes para siempre

Por defecto, quien encuentra la fila bloqueada espera indefinidamente. Bajo carga eso significa hilos parados y un pool de conexiones agotado. Fija un límite con una pista de consulta estándar:

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000")) // ms
@Query("select c from Cuenta c where c.id = :id")
Optional<Cuenta> findByIdParaActualizar(@Param("id") Long id);
```

Un valor `0` pide `NOWAIT`: falla de inmediato si la fila está bloqueada. Si el tiempo se agota, Spring lanza una excepción de la familia `PessimisticLockingFailureException` (por ejemplo `CannotAcquireLockException`), que puedes reintentar o devolver como `503`/`409`. El soporte exacto depende del dialecto; en PostgreSQL también puedes poner una red de seguridad global con el parámetro `lock_timeout` o con `SET LOCAL lock_timeout = '3s'` al inicio de la transacción. Consulta la sección de [bloqueos explícitos de PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html) para entender qué modo adquiere cada sentencia.

### Deadlocks: el precio del bloqueo pesimista

Un deadlock ocurre cuando la transacción A bloquea la fila 1 y espera la 2, mientras B bloquea la 2 y espera la 1. La base de datos lo detecta, elige una víctima y aborta su transacción. Tres reglas lo previenen casi siempre:

1. **Bloquea en un orden consistente**, como en la transferencia de arriba (por id ascendente).
2. **Mantén las transacciones cortas**: nada de llamadas HTTP, envío de correos ni cálculos pesados con filas bloqueadas.
3. **Bloquea lo mínimo**: `@Lock` en una consulta que devuelve mil filas bloquea mil filas.

Aun así, trata el deadlock como un error transitorio: reintenta la operación completa, igual que con el optimista.

## SKIP LOCKED: colas de trabajo con varias instancias

![Diagrama de bloqueo pesimista: con SELECT FOR UPDATE la segunda transacción espera, y con FOR UPDATE SKIP LOCKED tres workers toman tareas distintas saltando las filas bloqueadas](/diagrams/2026/11/bloqueo-optimista-pesimista-jpa/bloqueo-pesimista-skip-locked.png)

Hay un uso del bloqueo pesimista que casi ningún artículo cubre y que resuelve un problema muy real: repartir trabajo pendiente en una tabla entre varias réplicas sin que dos procesen la misma tarea. Con `FOR UPDATE` normal, todas las instancias se pelean por las mismas primeras filas y hacen cola. Con **`FOR UPDATE SKIP LOCKED`**, cada instancia se salta las filas que otra ya bloqueó y toma las siguientes libres. Lo soportan PostgreSQL (desde 9.5), MySQL 8, Oracle y SQL Server (con la pista `READPAST`).

La forma más explícita y portable dentro de Spring Data es una consulta nativa:

```java
public interface TareaRepository extends JpaRepository<Tarea, Long> {

    @Query(value = """
            SELECT * FROM tareas
            WHERE estado = 'PENDIENTE'
            ORDER BY creada_en
            LIMIT :lote
            FOR UPDATE SKIP LOCKED
            """, nativeQuery = true)
    List<Tarea> reservarPendientes(@Param("lote") int lote);
}
```

```java
@Component
public class ProcesadorTareas {

    private final TareaRepository tareas;
    private final TransactionTemplate tx;

    public ProcesadorTareas(TareaRepository tareas, PlatformTransactionManager tm) {
        this.tareas = tareas;
        this.tx = new TransactionTemplate(tm);
    }

    @Scheduled(fixedDelay = 1000)
    public void procesar() {
        tx.executeWithoutResult(status -> {
            // Cada réplica recibe un lote distinto: las filas bloqueadas se saltan
            for (Tarea tarea : tareas.reservarPendientes(20)) {
                tarea.ejecutar();            // trabajo corto e idempotente
                tarea.marcarCompletada();
            }
        });
    }
}
```

Es exactamente lo que necesita el *relay* del patrón Outbox o cualquier job programado con varias réplicas, y en muchos casos te ahorra un broker de mensajes o la coordinación con ShedLock que vimos en [tareas programadas con Spring](/2026/07/spring-scheduling). Si el procesamiento es largo, no lo hagas con la fila bloqueada: marca la tarea como `EN_PROCESO` con un tiempo de expiración, haz commit y procesa fuera de la transacción.

## La alternativa que nadie menciona: UPDATE atómico

Antes de elegir entre optimista y pesimista, pregúntate si necesitas leer la entidad. Para el caso del stock, una sola sentencia hace la comprobación y la escritura de forma atómica, sin versión, sin bloqueo explícito y sin reintentos:

```java
@Modifying
@Query("""
        update Producto p
        set p.stock = p.stock - :cantidad
        where p.id = :id and p.stock >= :cantidad
        """)
int descontarSiHayStock(@Param("id") Long id, @Param("cantidad") int cantidad);
```

```java
@Transactional
public void descontar(Long id, int cantidad) {
    if (repositorio.descontarSiHayStock(id, cantidad) == 0) {
        throw new StockInsuficienteException(id); // 0 filas: no había stock suficiente
    }
}
```

La base de datos bloquea la fila durante el `UPDATE` y evalúa la condición con el valor actual, así que dos peticiones simultáneas nunca pueden dejar el stock negativo. Dos advertencias: un `UPDATE` masivo de JPQL no pasa por el contexto de persistencia (si ya tenías la entidad cargada, queda desactualizada; usa `clearAutomatically = true` si la vas a releer) y no incrementa la `@Version` salvo que lo hagas tú en la sentencia (`p.version = p.version + 1`). Si combinas este enfoque con edición optimista de la misma entidad, inclúyelo.

## Niveles de aislamiento: ¿no bastaría con SERIALIZABLE?

Subir el aislamiento es otra forma de evitar la actualización perdida, pero el comportamiento varía por motor. En PostgreSQL, `REPEATABLE READ` detecta que la fila cambió desde tu lectura y aborta con un error de serialización; `SERIALIZABLE` va más allá y detecta anomalías entre filas distintas. Ambos obligan a reintentar igual que el optimista, pero afectan a **todas** las consultas de la transacción. En MySQL InnoDB, `REPEATABLE READ` (su valor por defecto) **no** evita la actualización perdida en el patrón leer-modificar-escribir.

La recomendación práctica: deja el aislamiento por defecto y usa `@Version`, `@Lock` o un `UPDATE` atómico donde haga falta. Son explícitos, portables y se ven en el código.

## Cómo probar la concurrencia en Spring Boot

Un test que llama al método una vez no demuestra nada sobre concurrencia. Necesitas varios hilos golpeando la misma fila a la vez, contra una base de datos real: H2 no reproduce fielmente el comportamiento de bloqueos de PostgreSQL. Con [Testcontainers](/2026/07/spring-testcontainers) es directo:

```java
@SpringBootTest
@Testcontainers
class InventarioConcurrenciaTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @Autowired InventarioFacade inventario;
    @Autowired ProductoRepository productos;

    @Test
    void cincuentaComprasConcurrentesNoPierdenActualizaciones() throws Exception {
        Long id = productos.save(new Producto("Teclado", 100)).getId();

        int hilos = 50;
        CountDownLatch salida = new CountDownLatch(1);       // todos arrancan a la vez
        try (ExecutorService pool = Executors.newFixedThreadPool(hilos)) {
            List<Future<?>> resultados = new ArrayList<>();
            for (int i = 0; i < hilos; i++) {
                resultados.add(pool.submit(() -> {
                    salida.await();
                    inventario.descontarStock(id, 1);
                    return null;
                }));
            }
            salida.countDown();
            for (Future<?> f : resultados) {
                f.get(30, TimeUnit.SECONDS);                 // propaga cualquier fallo
            }
        }

        assertThat(productos.findById(id).orElseThrow().getStock()).isEqualTo(50);
    }
}
```

Haz la prueba al revés para convencerte: quita `@Version` y ejecuta el test. Verás un stock final mayor que 50, es decir, ventas que se perdieron. Con `@Version` pero sin reintentos verás `ObjectOptimisticLockingFailureException` en varios `Future`. Con la fachada y `@Retryable` (ajusta `maxRetries` a la contención del test), el resultado cuadra. Es el tipo de test que vale la pena dejar en la suite: protege contra el compañero que, dentro de seis meses, "simplifica" el código y quita la fachada.

## Riesgos y trade-offs

- **Optimista con mucha contención**: los reintentos se encadenan, aumenta la latencia y algunos usuarios ven errores tras agotar los intentos. Si más de un pequeño porcentaje de escrituras falla, cambia de estrategia.
- **Pesimista con transacciones largas**: cada milisegundo que una transacción mantiene filas bloqueadas es un milisegundo en que otras esperan con una conexión del pool ocupada. Bajo carga, el pool se agota antes que la base de datos.
- **Falsa sensación de seguridad**: `@Version` solo protege las escrituras que pasan por la entidad. Un `UPDATE` nativo, un script de migración o un proceso batch que no incremente la versión rompe la garantía en silencio.
- **Bloqueos no portables**: `PESSIMISTIC_READ`, los timeouts y `SKIP LOCKED` cambian según el motor y la versión. Pruébalo en la misma base de datos que usas en producción.
- **Bloqueo sin transacción**: un `@Lock` en un método no transaccional no protege nada.

## ¿Cuándo usar bloqueo optimista y cuándo pesimista?

Usa **bloqueo optimista** como opción por defecto: en la mayoría de aplicaciones dos usuarios rara vez modifican la misma fila al mismo tiempo, y `@Version` cuesta una columna. Es la única opción válida cuando la edición abarca varias peticiones HTTP (formularios, pantallas de edición) y combina muy bien con `ETag`/`If-Match`.

Usa **bloqueo pesimista** cuando la contención sobre una fila concreta es alta y repetir el trabajo es caro: saldos, inventario de productos en oferta, contadores de cupos, reservas de asientos. Y úsalo con `SKIP LOCKED` para repartir trabajo entre réplicas.

Usa un **UPDATE atómico** cuando la operación es una aritmética simple con condición (descontar, sumar, cambiar de estado si está en X): es la opción más rápida y la que menos puede fallar. Y no uses ninguno de los tres cuando el dato no se comparte o la última escritura gana de forma legítima (preferencias de un usuario, por ejemplo).

## Buenas prácticas

- **Añade `@Version` a todas las entidades que se editan**: es barato y convierte un bug silencioso en un error visible.
- **Captura las excepciones de Spring** (`OptimisticLockingFailureException`, `PessimisticLockingFailureException`), no las de Hibernate o JPA.
- **Reintenta fuera de la transacción**, con pocos intentos, *backoff* y *jitter*, y solo para operaciones idempotentes.
- **No reintentes decisiones humanas**: devuelve `409` o `412` y muestra el estado actual.
- **Transacciones cortas con filas bloqueadas**, y bloqueo en un orden consistente.
- **Configura siempre un timeout de bloqueo** en las consultas pesimistas.
- **Prueba la concurrencia con varios hilos y una base de datos real**, no con H2 ni con un único hilo.
- **Monitoriza los conflictos**: un contador de `OptimisticLockingFailureException` por entidad te dice cuándo ha llegado el momento de cambiar de estrategia.

## Preguntas frecuentes

### ¿Qué diferencia hay entre bloqueo optimista y pesimista?

El bloqueo optimista no bloquea filas: compara una columna de versión al escribir y falla si otra transacción la cambió, por lo que el conflicto se resuelve reintentando o avisando al usuario. El bloqueo pesimista bloquea la fila al leerla con `SELECT ... FOR UPDATE` y obliga a las demás transacciones a esperar. El optimista es más barato cuando los conflictos son raros; el pesimista, cuando son frecuentes.

### ¿Cómo funciona @Version en JPA?

`@Version` marca un campo numérico o de fecha que Hibernate incrementa en cada actualización. Al hacer `UPDATE`, añade `WHERE version = ?` con el valor leído; si la fila ya tiene otra versión, se actualizan 0 filas y se lanza `OptimisticLockException`, que Spring traduce a `ObjectOptimisticLockingFailureException`. Nunca debes modificar ese campo a mano.

### ¿Cómo manejar OptimisticLockException en Spring Boot?

Si la decisión la toma el servidor, reintenta la operación completa con `@Retryable` en un bean que envuelva al método `@Transactional`, para que cada intento lea datos frescos en una transacción nueva. Si la decisión la tomó un usuario, captura `OptimisticLockingFailureException` en un `@RestControllerAdvice` y devuelve `409 Conflict` (o `412` si usas `If-Match`).

### ¿Qué hace @Lock(LockModeType.PESSIMISTIC_WRITE) en Spring Data JPA?

Hace que la consulta del repositorio se ejecute con un bloqueo exclusivo, normalmente `SELECT ... FOR UPDATE`. La fila queda bloqueada hasta el commit o rollback de la transacción, así que otras transacciones que intenten bloquearla o modificarla esperan. Debe usarse dentro de `@Transactional` y conviene acompañarlo de un timeout con `jakarta.persistence.lock.timeout`.

### ¿Sirve synchronized para evitar problemas de concurrencia en Spring Boot?

No. `synchronized` solo coordina hilos de la misma JVM; en cuanto hay dos instancias de la aplicación, cada una tiene su propio bloqueo y las actualizaciones vuelven a pisarse. Además, no cubre la ventana entre el fin del método y el commit. El control de concurrencia sobre datos compartidos debe hacerse en la base de datos con versiones, bloqueos o sentencias atómicas.

### ¿Qué es SKIP LOCKED y cuándo usarlo?

`SKIP LOCKED` es una opción de `SELECT ... FOR UPDATE` que hace que la consulta ignore las filas que otra transacción ya tiene bloqueadas en lugar de esperar por ellas. Es ideal para colas de trabajo en una tabla: varias réplicas pueden tomar lotes de tareas pendientes en paralelo sin procesar dos veces la misma. Está disponible en PostgreSQL, MySQL 8, Oracle y SQL Server.

## Conclusión

El bloqueo optimista y pesimista en JPA no es un tema académico: es la diferencia entre un sistema que pierde ventas, saldos o ediciones en silencio y uno que detecta cada conflicto y lo resuelve de forma explícita. La actualización perdida no aparece en los tests de un solo hilo ni en local; aparece en producción, con carga y con varias réplicas, que es justo donde más cuesta encontrarla.

Si te quedas con lo esencial: pon `@Version` en las entidades que se editan y trata la `OptimisticLockException` como parte del diseño, reintentando fuera de la transacción o devolviendo un `409` al usuario. Reserva el bloqueo pesimista para las filas muy disputadas, con transacciones cortas, orden consistente y timeout, y aprovecha `SKIP LOCKED` para repartir trabajo entre instancias. Cuando la operación sea una simple resta con condición, un `UPDATE` atómico te ahorra todo lo anterior. Y, sobre todo, escribe el test con cincuenta hilos: es la única forma de saber que tu código aguanta la concurrencia en lugar de esperarlo.
