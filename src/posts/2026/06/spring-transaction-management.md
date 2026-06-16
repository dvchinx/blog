---
titulo: "Spring Transaction Management: @Transactional a fondo"
seoTitulo: "Spring Transaction Management: guía completa de @Transactional en Spring Boot"
fecha: "2026-06-16"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Domina la gestión de transacciones en Spring Boot: propagación, niveles de aislamiento, rollback, transacciones programáticas y errores comunes que debes evitar."
imagenPortada: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring", "Java", "Backend", "Transacciones", "Base de datos"]
categoria: "tech"
keywords: "Spring Transaction Management, @Transactional Spring Boot, propagación transacciones Spring, isolation level Spring, rollback Spring, transacciones programáticas Spring, Spring transaccional"
---

# Spring Transaction Management: @Transactional a fondo

Las transacciones son el mecanismo que garantiza que un conjunto de operaciones de base de datos se ejecute de forma atómica: o todas tienen éxito, o ninguna. Spring simplifica esto con la anotación `@Transactional`, pero usarla correctamente requiere entender qué ocurre debajo: cuándo se abre y cierra una transacción, cuándo se hace rollback, y cuándo no.

## Configuración

En un proyecto Spring Boot con JPA, la gestión de transacciones está habilitada automáticamente. No necesitas ninguna configuración extra. En proyectos sin Spring Boot, añade `@EnableTransactionManagement` en tu clase de configuración:

```java
@Configuration
@EnableTransactionManagement
public class AppConfig {
    // ...
}
```

El `PlatformTransactionManager` es el componente central. Spring Boot autoconfigura el correcto según el stack: `JpaTransactionManager` para JPA/Hibernate, `DataSourceTransactionManager` para JDBC puro, `ReactiveTransactionManager` para aplicaciones reactivas.

## @Transactional básico

La anotación puede aplicarse a nivel de clase o de método. A nivel de clase, todos los métodos públicos heredan el comportamiento transaccional:

```java
@Service
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;

    // Constructor...

    public Order createOrder(OrderRequest request) {
        // Todo esto ocurre dentro de una misma transacción
        inventoryService.reserve(request.items());
        Order order = orderRepository.save(new Order(request));
        paymentService.charge(order.total(), request.paymentMethod());
        return order;
    }
}
```

Si `paymentService.charge()` lanza una excepción, la reserva de inventario y el `save` del pedido se revierten automáticamente.

## Propagación

La propagación define qué ocurre cuando un método transaccional llama a otro. Se configura con el atributo `propagation`:

```java
@Transactional(propagation = Propagation.REQUIRED)
public void metodoPadre() {
    // ...
    metodoHijo();
}

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void metodoHijo() {
    // ...
}
```

Los valores más importantes:

| Valor | Comportamiento |
|---|---|
| `REQUIRED` (default) | Usa la transacción existente; si no hay, crea una nueva |
| `REQUIRES_NEW` | Siempre crea una nueva transacción; suspende la existente |
| `NESTED` | Crea un savepoint dentro de la transacción existente |
| `SUPPORTS` | Usa la transacción si existe; si no, corre sin ella |
| `MANDATORY` | Requiere una transacción existente; lanza excepción si no hay |
| `NOT_SUPPORTED` | Suspende la transacción existente y corre sin ella |
| `NEVER` | Lanza excepción si existe una transacción activa |

### REQUIRED (el default)

```java
@Service
public class PaymentService {

    @Transactional // REQUIRED por defecto
    public void charge(BigDecimal amount, String method) {
        // Se une a la transacción del OrderService si ya existe
        // Si no existe, crea una nueva
    }
}
```

Este es el comportamiento correcto para la mayoría de los casos: los métodos colaboradores participan en la misma transacción del llamador.

### REQUIRES_NEW

```java
@Service
public class AuditService {

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logEvent(String event, String details) {
        // Corre en su propia transacción, independiente del llamador
        // Si el llamador hace rollback, este log se mantiene
        auditRepository.save(new AuditLog(event, details));
    }
}
```

Útil cuando quieres que una operación (como auditoría) persista incluso si la operación principal falla.

### NESTED

```java
@Transactional
public void processItems(List<Item> items) {
    for (Item item : items) {
        try {
            processItem(item); // NESTED
        } catch (ItemProcessingException e) {
            // El savepoint hace rollback solo de este item
            // Los items anteriores exitosos se mantienen
        }
    }
}

@Transactional(propagation = Propagation.NESTED)
public void processItem(Item item) {
    // ...
}
```

`NESTED` solo está soportado con `DataSourceTransactionManager` o Hibernate con savepoints habilitados. Con JPA estándar, generalmente no está disponible.

## Niveles de aislamiento

El aislamiento controla qué puede ver una transacción de los cambios de otras transacciones concurrentes. Se configura con el atributo `isolation`:

```java
@Transactional(isolation = Isolation.READ_COMMITTED)
public Report generateReport() {
    // ...
}
```

| Nivel | Lee cambios no commiteados | Lecturas fantasma | Non-repeatable reads |
|---|---|---|---|
| `READ_UNCOMMITTED` | ✅ (Sí, dirty reads) | ✅ | ✅ |
| `READ_COMMITTED` | ❌ | ✅ | ✅ |
| `REPEATABLE_READ` | ❌ | ✅ | ❌ |
| `SERIALIZABLE` | ❌ | ❌ | ❌ |

**`READ_COMMITTED`** es el default de PostgreSQL y el nivel más usado en aplicaciones web: evita leer datos sucios sin el overhead de `SERIALIZABLE`.

**`REPEATABLE_READ`** garantiza que si lees el mismo registro dos veces en la misma transacción, obtienes el mismo valor, aunque otro proceso lo haya modificado entre medio.

**`SERIALIZABLE`** es el más estricto: las transacciones se ejecutan como si fueran secuenciales. Úsalo solo cuando la consistencia lo exija porque impacta el rendimiento.

El nivel `DEFAULT` delega la decisión al motor de base de datos.

## Rollback

Por defecto, `@Transactional` solo hace rollback en `RuntimeException` y `Error`. Las checked exceptions no lo disparan:

```java
@Transactional
public void transfer(Long fromId, Long toId, BigDecimal amount) throws InsufficientFundsException {
    Account from = accountRepository.findById(fromId).orElseThrow();

    if (from.getBalance().compareTo(amount) < 0) {
        // Checked exception → NO hace rollback por defecto
        throw new InsufficientFundsException("Saldo insuficiente");
    }

    from.debit(amount);
    Account to = accountRepository.findById(toId).orElseThrow();
    to.credit(amount);
}
```

Para forzar rollback en checked exceptions, usa `rollbackFor`:

```java
@Transactional(rollbackFor = InsufficientFundsException.class)
public void transfer(Long fromId, Long toId, BigDecimal amount) throws InsufficientFundsException {
    // Ahora InsufficientFundsException también dispara rollback
}
```

O de forma general:

```java
@Transactional(rollbackFor = Exception.class)
public void transfer(Long fromId, Long toId, BigDecimal amount) throws Exception {
    // Cualquier excepción hace rollback
}
```

Para excluir una excepción específica del rollback:

```java
@Transactional(noRollbackFor = InventoryWarningException.class)
public void processOrder(Order order) {
    // InventoryWarningException no dispara rollback; otras RuntimeException sí
}
```

### Rollback manual

Dentro de un método transaccional puedes forzar el rollback sin lanzar una excepción:

```java
@Transactional
public void processOrder(Order order) {
    try {
        // ...
    } catch (SomeException e) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        log.warn("Operación marcada para rollback: {}", e.getMessage());
    }
}
```

## Timeout

Puedes limitar el tiempo de vida de una transacción para evitar bloqueos prolongados:

```java
@Transactional(timeout = 30) // segundos
public void longRunningOperation() {
    // Si tarda más de 30 segundos, lanza TransactionTimedOutException
}
```

## readOnly

Para operaciones de solo lectura, marca la transacción como tal:

```java
@Transactional(readOnly = true)
public List<Product> findAll() {
    return productRepository.findAll();
}
```

Esto le indica a Hibernate que no necesita rastrear cambios en las entidades (_dirty checking_), lo que reduce el uso de memoria y puede mejorar el rendimiento en consultas grandes. Algunos motores también aprovechan esta pista para optimizaciones internas.

Una práctica habitual en servicios con muchas operaciones de lectura es anotar la clase con `@Transactional(readOnly = true)` y sobreescribir con `@Transactional` los métodos que escriben:

```java
@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository productRepository;

    public List<Product> findAll() { ... }            // readOnly heredado
    public Optional<Product> findById(Long id) { ... } // readOnly heredado

    @Transactional // Sobreescribe: read-write
    public Product save(Product product) { ... }

    @Transactional // Sobreescribe: read-write
    public void delete(Long id) { ... }
}
```

## Transacciones programáticas

Cuando necesitas control granular sobre el inicio y fin de una transacción, usa `TransactionTemplate`:

```java
@Service
@RequiredArgsConstructor
public class BatchService {

    private final TransactionTemplate transactionTemplate;
    private final ItemRepository itemRepository;

    public void processBatch(List<Item> items) {
        for (Item item : items) {
            transactionTemplate.execute(status -> {
                try {
                    itemRepository.save(item);
                    return null;
                } catch (Exception e) {
                    status.setRollbackOnly();
                    log.error("Error procesando item {}: {}", item.getId(), e.getMessage());
                    return null;
                }
            });
        }
    }
}
```

Configura `TransactionTemplate` como bean si no lo tienes:

```java
@Bean
public TransactionTemplate transactionTemplate(PlatformTransactionManager txManager) {
    return new TransactionTemplate(txManager);
}
```

Para máximo control, usa `PlatformTransactionManager` directamente:

```java
@Service
@RequiredArgsConstructor
public class ManualTxService {

    private final PlatformTransactionManager txManager;

    public void runWithManualTransaction() {
        DefaultTransactionDefinition def = new DefaultTransactionDefinition();
        def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        def.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);

        TransactionStatus status = txManager.getTransaction(def);
        try {
            // ... operaciones
            txManager.commit(status);
        } catch (Exception e) {
            txManager.rollback(status);
            throw e;
        }
    }
}
```

## Errores comunes

### Self-invocation

`@Transactional` funciona mediante un proxy generado por Spring. Si un método llama a otro método del mismo bean, el proxy no intercepta la llamada interna:

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(OrderRequest request) {
        // ...
    }

    public void createOrdersInBatch(List<OrderRequest> requests) {
        for (OrderRequest r : requests) {
            createOrder(r); // ⚠️ El proxy NO intercepta esta llamada
            // createOrder() NO corre en su propia transacción
        }
    }
}
```

**Solución**: inyecta el propio bean (Spring lo maneja correctamente) o mueve el método transaccional a otro servicio:

```java
@Service
@RequiredArgsConstructor
public class OrderBatchService {

    private final OrderService orderService; // Bean externo → pasa por el proxy

    public void createOrdersInBatch(List<OrderRequest> requests) {
        for (OrderRequest r : requests) {
            orderService.createOrder(r); // ✅ Pasa por el proxy, @Transactional activo
        }
    }
}
```

### Métodos privados

`@Transactional` en métodos privados es silenciosamente ignorado por el proxy. Spring no emite advertencia:

```java
@Service
public class ProductService {

    @Transactional // ⚠️ No tiene efecto en métodos privados
    private void updateStock(Long productId, int delta) {
        // Esta transacción NUNCA se crea
    }
}
```

Usa siempre `@Transactional` en métodos `public`.

### LazyInitializationException

Acceder a una relación lazy fuera de una transacción activa lanza esta excepción:

```java
@Service
public class ReportService {

    public String getOrderSummary(Long orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow();
        // La transacción del findById ya terminó aquí
        return order.getItems().size() + " items"; // ⚠️ LazyInitializationException
    }
}
```

**Soluciones**:

1. Anotar el método con `@Transactional` para mantener el contexto de persistencia abierto.
2. Usar `JOIN FETCH` o `@EntityGraph` para cargar la relación junto con la entidad.
3. Usar una proyección o DTO que incluya los datos necesarios desde la query.

## Buenas prácticas

1. **Mantén las transacciones en la capa de servicio**, no en controladores ni repositorios. El servicio es quien coordina la lógica de negocio.
2. **Usa `readOnly = true`** en todos los métodos de lectura. El ahorro en dirty checking es real en consultas grandes.
3. **Sé explícito con `rollbackFor`** si trabajas con checked exceptions. El comportamiento por defecto puede sorprenderte.
4. **Evita transacciones largas**. Cuanto más tiempo permanece abierta una transacción, más locks sostiene. Procesa en lotes si es necesario.
5. **No captures y silencies excepciones** dentro de un método transaccional sin marcar el rollback. La transacción se commitará con datos inconsistentes.
6. **Conoce el nivel de aislamiento de tu base de datos** antes de asumir defaults. PostgreSQL usa `READ_COMMITTED`; MySQL puede usar `REPEATABLE_READ` según la configuración.
7. **Prueba el comportamiento transaccional con `@DataJpaTest`** que ya levanta un contexto con transacciones y rollback automático entre tests.

## Conclusión

`@Transactional` es una de las herramientas más potentes de Spring, pero su simplicidad aparente esconde varios matices críticos: la propagación determina si las operaciones comparten o aíslan sus transacciones; el nivel de aislamiento define qué ven las transacciones concurrentes; y el rollback por defecto no cubre checked exceptions.

El self-invocation y los métodos privados son las dos trampas más comunes. Entender que `@Transactional` opera mediante un proxy hace que ambas sean predecibles. Con esas bases claras, gestionar la consistencia de datos en Spring se convierte en una decisión consciente y no en un accidente.
