---
titulo: "Saga Pattern: coordinando transacciones distribuidas en microservicios"
seoTitulo: "Saga Pattern: qué es, cómo funciona y cuándo usarlo en microservicios"
fecha: "2026-07-11"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende cómo el patrón Saga resuelve el problema de las transacciones distribuidas en microservicios, con ejemplos de coreografía y orquestación, transacciones compensatorias y consejos para implementarlo correctamente."
imagenPortada: "https://i.imgur.com/BYhduRM.png?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Microservices", "Distributed Systems", "Saga Pattern", "Best Practices"]
categoria: "tech"
keywords: "saga pattern, transacciones distribuidas, microservicios, coreografía, orquestación, compensating transactions, eventual consistency, distributed transactions, saga choreography, saga orchestration, arquitectura microservicios"
---

# Saga Pattern: coordinando transacciones distribuidas en microservicios

Uno de los problemas más difíciles que aparecen al dividir un sistema en microservicios es el de las **transacciones que cruzan múltiples servicios**. En una arquitectura monolítica, una operación que modifica varias tablas puede envolverse en una única transacción ACID y confiar en que la base de datos deshará todo si algo falla. En microservicios, cada servicio tiene su propia base de datos y no existe ningún coordinador de transacciones compartido que pueda garantizar atomicidad entre ellos.

El protocolo clásico para transacciones distribuidas —Two-Phase Commit (2PC)— existe como solución técnica, pero introduce un coordinador centralizado que se convierte en un cuello de botella y en un punto único de fallo. En la práctica, 2PC es frágil, lento y difícilmente compatible con la escala horizontal que buscan los microservicios.

El **Saga Pattern** es la alternativa más adoptada. En lugar de una transacción distribuida atómica, descompone la operación en una secuencia de transacciones locales, cada una dentro de un único servicio. Si algún paso falla, la saga ejecuta **transacciones compensatorias** para deshacer los pasos anteriores que sí tuvieron éxito.

## El problema que resuelve

Considera un sistema de comercio electrónico con tres servicios independientes: `OrderService`, `InventoryService` y `PaymentService`. Cuando un usuario realiza una compra, el flujo ideal sería:

1. `OrderService` crea el pedido en estado "pendiente".
2. `InventoryService` reserva el stock del producto.
3. `PaymentService` cobra al cliente.
4. `OrderService` actualiza el pedido a "confirmado".

¿Qué ocurre si el pago falla en el paso 3? El pedido ya fue creado y el stock ya fue reservado. Sin mecanismo de coordinación, el sistema queda en un estado inconsistente: un pedido que nunca se completará y stock que aparece como reservado pero en realidad está libre.

Una saga resuelve esto definiendo de antemano qué acción compensatoria ejecutar si cada paso falla. Si el pago falla, la saga ejecuta "liberar stock" en `InventoryService` y "cancelar pedido" en `OrderService`. El sistema vuelve a un estado coherente, aunque no instantáneamente.

Este "no instantáneamente" es clave. Las sagas no ofrecen aislamiento transaccional: durante la ejecución de la saga, otros procesos pueden leer estados intermedios. El modelo de consistencia que ofrecen es **consistencia eventual**, no las garantías ACID de una transacción clásica.

## Las dos variantes: coreografía y orquestación

Existen dos formas de coordinar los pasos de una saga, y la elección entre ellas define cuánto acoplamiento y cuánta visibilidad tendrás sobre el flujo.

### Coreografía (Choreography)

En la coreografía, no existe ningún coordinador central. Cada servicio publica un evento cuando completa su paso, y los servicios interesados reaccionan a ese evento para ejecutar el suyo propio. La coordinación emerge del comportamiento colectivo, no de una entidad central que dicta qué hacer a continuación.

```
OrderService          InventoryService       PaymentService
     |                       |                      |
     |-- OrderCreated ------->|                      |
     |                       |-- StockReserved ----->|
     |                       |                      |
     |<--- OrderConfirmed ---|<-- PaymentCompleted --|
```

Si el pago falla:

```
OrderService          InventoryService       PaymentService
     |                       |                      |
     |-- OrderCreated ------->|                      |
     |                       |-- StockReserved ----->|
     |                       |                      |
     |                       |<-- PaymentFailed -----|
     |<-- StockReleased -----|
     |
  (cancela pedido)
```

La coreografía tiene ventajas claras: los servicios están débilmente acoplados, no hay coordinador que pueda fallar y el sistema escala bien. Pero tiene una desventaja importante: **es difícil entender el flujo completo**. Para saber qué ocurre cuando un usuario hace un pedido, hay que leer el código de tres o más servicios y reconstruir mentalmente la secuencia de eventos. Rastrear un fallo en producción puede ser complicado.

La coreografía funciona bien para flujos simples con pocos pasos, o cuando la autonomía de los servicios es la prioridad más alta.

### Orquestación (Orchestration)

En la orquestación, existe un componente central —el **orquestador** o **saga coordinator**— que conoce todos los pasos del flujo y es responsable de ejecutarlos en orden, llamar a los siguientes pasos y, si algo falla, ejecutar las compensaciones necesarias.

```
                    SagaOrchestrator
                          |
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
   OrderService   InventoryService   PaymentService
```

El orquestador llama directamente a cada servicio (via API o mensajes) y toma decisiones basadas en el resultado de cada paso:

```
SagaOrchestrator:
  1. → OrderService.createOrder()       [éxito]
  2. → InventoryService.reserveStock()  [éxito]
  3. → PaymentService.charge()          [falla]
  4. → InventoryService.releaseStock()  [compensación]
  5. → OrderService.cancelOrder()       [compensación]
```

La orquestación tiene la ventaja de que el flujo completo vive en un solo lugar: el orquestador. Es fácil de entender, de testear y de depurar. La desventaja es que el orquestador concentra lógica y conocimiento, lo que puede convertirlo en un "God Service" que sabe demasiado sobre los demás servicios.

La orquestación funciona mejor para flujos complejos con muchos pasos, lógica condicional o necesidad de visibilidad centralizada. Es también la variante más común cuando se usa un motor de sagas como Temporal o Axon Framework.

## Transacciones compensatorias

El concepto central de las sagas es que cada paso tiene una **transacción compensatoria** que lo deshace semánticamente. La palabra clave es "semánticamente": no se trata de deshacer a nivel de base de datos (como haría un ROLLBACK), sino de ejecutar una acción de negocio que revierta el efecto observable.

| Paso                          | Compensación                      |
|-------------------------------|-----------------------------------|
| Crear pedido en "pendiente"   | Cancelar pedido                   |
| Reservar stock                | Liberar stock                     |
| Cobrar al cliente             | Reembolsar al cliente             |
| Enviar email de confirmación  | *(no compensable — se envió ya)*  |

Este último punto es importante: **no todos los pasos son compensables**. Enviar un email ya no se puede deshacer. Para estos casos, la estrategia es ejecutar la acción tarde en el flujo (cuando el riesgo de cancelación es bajo) o aceptar que la compensación es una acción correctiva diferente (enviar un segundo email de disculpa o cancelación).

Un buen diseño de saga identifica de antemano qué pasos son compensables y qué hacer cuando no lo son.

## Implementación práctica

Veamos cómo se implementaría la saga de pedido con la variante de orquestación en Java, sin frameworks externos, para ilustrar la lógica central:

```java
public class OrderSaga {

    private final OrderService orderService;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;

    public void execute(OrderRequest request) {
        String orderId = null;
        boolean stockReserved = false;

        try {
            // Paso 1: crear pedido
            orderId = orderService.createOrder(request);

            // Paso 2: reservar stock
            inventoryService.reserveStock(request.getProductId(), request.getQuantity());
            stockReserved = true;

            // Paso 3: cobrar
            paymentService.charge(request.getCustomerId(), request.getAmount());

            // Paso 4: confirmar pedido
            orderService.confirmOrder(orderId);

        } catch (PaymentException e) {
            // Compensaciones si el pago falla
            if (stockReserved) {
                inventoryService.releaseStock(request.getProductId(), request.getQuantity());
            }
            if (orderId != null) {
                orderService.cancelOrder(orderId);
            }
            throw new SagaException("Pedido cancelado por fallo en el pago", e);

        } catch (InventoryException e) {
            // Compensación si no hay stock
            if (orderId != null) {
                orderService.cancelOrder(orderId);
            }
            throw new SagaException("Pedido cancelado por falta de stock", e);
        }
    }
}
```

Este ejemplo es síncrono y simplificado. En producción, los pasos suelen ser asíncronos (mensajes en Kafka o RabbitMQ) y el estado de la saga se persiste en una base de datos para poder retomarlo si el orquestador falla a mitad del flujo.

Para implementaciones serias se recomienda usar un motor de sagas dedicado como **Temporal**, **Axon Framework**, o el soporte de sagas en **Apache Camel**. Estos frameworks gestionan automáticamente la persistencia del estado, los reintentos y el historial de ejecución.

Con Axon Framework, el mismo flujo se expresa como una clase de saga con manejadores de eventos:

```java
@Saga
public class OrderSaga {

    @Inject
    private transient CommandGateway commandGateway;

    private String orderId;

    @StartSaga
    @SagaEventHandler(associationProperty = "orderId")
    public void handle(OrderCreatedEvent event) {
        this.orderId = event.getOrderId();
        commandGateway.send(new ReserveStockCommand(event.getProductId(), event.getQuantity()));
    }

    @SagaEventHandler(associationProperty = "orderId")
    public void handle(StockReservedEvent event) {
        commandGateway.send(new ChargePaymentCommand(event.getCustomerId(), event.getAmount()));
    }

    @SagaEventHandler(associationProperty = "orderId")
    public void handle(PaymentFailedEvent event) {
        commandGateway.send(new ReleaseStockCommand(event.getProductId(), event.getQuantity()));
        commandGateway.send(new CancelOrderCommand(orderId));
    }

    @EndSaga
    @SagaEventHandler(associationProperty = "orderId")
    public void handle(PaymentCompletedEvent event) {
        commandGateway.send(new ConfirmOrderCommand(orderId));
    }
}
```

Axon persiste automáticamente el estado de la saga entre eventos y garantiza que cada manejador se ejecuta exactamente una vez, incluso si el proceso se reinicia.

## Idempotencia: el requisito no negociable

En sistemas distribuidos, los mensajes pueden entregarse más de una vez. Un servicio puede procesar el mismo evento dos veces por un problema de red, un reinicio o un timeout. Por eso, **cada paso de una saga debe ser idempotente**: ejecutarlo múltiples veces con el mismo input debe producir el mismo resultado que ejecutarlo una sola vez.

La forma más común de garantizar idempotencia es usar un identificador único por operación y verificar si ya fue procesada antes de ejecutarla:

```java
public void reserveStock(String sagaId, String productId, int quantity) {
    if (reservationRepository.existsBySagaId(sagaId)) {
        log.info("Stock ya reservado para saga {}, ignorando duplicado", sagaId);
        return;
    }

    // ejecutar la reserva
    Reservation reservation = new Reservation(sagaId, productId, quantity);
    reservationRepository.save(reservation);
    inventoryRepository.decrementStock(productId, quantity);
}
```

Sin idempotencia, un reintento automático puede cobrar al cliente dos veces o reservar el doble del stock.

## Aislamiento y anomalías

Las sagas no ofrecen el aislamiento de una transacción ACID. Durante la ejecución de la saga, los datos intermedios son visibles a otras operaciones concurrentes, lo que puede producir anomalías:

**Lectura sucia (dirty read):** un proceso lee el pedido en estado "pendiente" mientras la saga aún está en curso y el pedido podría cancelarse.

**Lecturas no repetibles:** un proceso lee el stock disponible, otro ejecuta una saga que lo reserva, el primero vuelve a leer y obtiene un valor diferente.

**Saga perdida (lost update):** dos sagas modifican el mismo registro concurrentemente y una sobreescribe los cambios de la otra.

Para mitigar estas anomalías, se usan técnicas como:

- **Semantic locks**: marcar registros como "en proceso" durante la saga para que otras operaciones los ignoren o fallen con un error explícito.
- **Versioning optimista**: incluir un número de versión en los registros y rechazar actualizaciones que no coincidan con la versión esperada.
- **Ordenar sagas por prioridad**: en sistemas con alta concurrencia, puede ser necesario serializar ciertas sagas mediante colas.

## Cuándo usar el patrón Saga

El Saga Pattern es la herramienta correcta cuando:

- La operación afecta a datos en múltiples servicios con bases de datos independientes.
- La consistencia eventual es aceptable (la mayoría de los casos de negocio lo toleran).
- Quieres evitar el acoplamiento rígido de 2PC o bases de datos compartidas.
- Los pasos del flujo son claramente identificables y sus compensaciones están bien definidas.

No es la herramienta correcta cuando:

- Necesitas aislamiento transaccional estricto (financiero, contable con auditoría regulatoria).
- Los pasos del flujo son tan cortos que mantenerlos en una única base de datos sería más sencillo.
- Las compensaciones son imposibles de implementar para todos los pasos del flujo.

## Buenas prácticas

**Define las compensaciones antes de implementar los pasos.** Si no puedes definir una compensación razonable para un paso, la saga puede no ser la solución adecuada para ese flujo.

**Persiste el estado de la saga.** Si el orquestador o el evento broker falla a mitad del flujo, necesitas poder retomar la saga desde donde quedó. El estado debe vivir en una base de datos, no solo en memoria.

**Diseña para la idempotencia desde el inicio.** Retomarlo después es mucho más costoso que diseñarlo así desde el principio.

**Usa timeouts y dead-letter queues.** Una saga que espera indefinidamente por una respuesta que nunca llegará bloquea recursos. Define tiempos máximos de espera y rutas de compensación para los casos de timeout.

**Distingue entre fallos transitorios y permanentes.** Un fallo de red transitorio merece un reintento; un "saldo insuficiente" es un error de negocio que debe ejecutar la compensación inmediatamente.

**Monitoriza el estado de tus sagas.** Necesitas visibilidad sobre cuántas sagas están en curso, cuántas han fallado y cuántas han ejecutado compensaciones. Sin métricas y trazas distribuidas, depurar fallos en producción es casi imposible.

## Conclusión

El Saga Pattern reemplaza la ilusión de atomicidad distribuida por algo más honesto y más robusto: una secuencia de pasos locales con compensaciones bien definidas. Acepta que los sistemas distribuidos son inherentemente parciales y asíncronos, y diseña alrededor de esa realidad en lugar de intentar ocultarla.

La elección entre coreografía y orquestación es principalmente una cuestión de complejidad y visibilidad: la coreografía desacopla servicios a costa de perder visibilidad del flujo global; la orquestación centraliza la lógica y gana visibilidad a costa de más acoplamiento en el orquestador. En la práctica, la orquestación suele ser más fácil de mantener a medida que el número de pasos crece.

Lo que no es opcional es la idempotencia: en sistemas distribuidos, un mensaje puede llegar dos veces. Diseñar cada paso para tolerarlo es el requisito mínimo para que una saga funcione de forma confiable en producción.
