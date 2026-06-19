---
titulo: "Patrones de Diseño en Java: Observer, Decorator y Adapter"
seoTitulo: "Patrones de Diseño en Java: Observer, Decorator y Adapter con ejemplos prácticos"
fecha: "2026-06-20"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a aplicar tres patrones de diseño fundamentales en Java: Observer para notificaciones reactivas, Decorator para extender comportamiento sin herencia, y Adapter para integrar interfaces incompatibles."
imagenPortada: "https://i.imgur.com/HLLPAvl.png?w=800&h=500&fit=crop"
etiquetas: ["Java", "Patrones de Diseño", "Design Patterns", "Backend", "POO"]
categoria: "tech"
keywords: "patrones de diseño Java, Observer pattern Java, Decorator pattern Java, Adapter pattern Java, design patterns Java, programación orientada a objetos, patrones GOF, patrones de comportamiento, patrones estructurales"
---

# Patrones de Diseño en Java: Observer, Decorator y Adapter

Este artículo continúa la exploración de los patrones del catálogo GoF (*Design Patterns*, 1994) con tres patrones que aparecen con frecuencia en aplicaciones Java reales: **Observer**, **Decorator** y **Adapter**. Los tres pertenecen a categorías distintas del catálogo (comportamiento y estructura), y cada uno resuelve un problema diferente de diseño.

## Observer

### El problema

Tienes un objeto cuyo estado cambia con frecuencia y varios objetos que necesitan reaccionar a esos cambios. La solución ingenua es que el objeto central llame directamente a cada interesado:

```java
public class OrderService {

    private EmailService emailService = new EmailService();
    private InventoryService inventoryService = new InventoryService();
    private AuditService auditService = new AuditService();

    public void placeOrder(Order order) {
        // lógica de negocio...
        emailService.sendConfirmation(order);
        inventoryService.reserve(order);
        auditService.log(order);
    }
}
```

El problema es evidente: `OrderService` conoce y depende de todos sus consumidores. Añadir un nuevo servicio (por ejemplo, `FraudDetectionService`) obliga a modificar `OrderService`, violando el principio Open/Closed.

### La solución

El patrón Observer define una relación de suscripción: el **sujeto** (o publicador) mantiene una lista de **observadores** y los notifica cuando su estado cambia. Los observadores se registran y desregistran en tiempo de ejecución.

```java
// Interfaz del observador
public interface OrderObserver {
    void onOrderPlaced(Order order);
}

// El sujeto
public class OrderService {

    private final List<OrderObserver> observers = new ArrayList<>();

    public void subscribe(OrderObserver observer) {
        observers.add(observer);
    }

    public void unsubscribe(OrderObserver observer) {
        observers.remove(observer);
    }

    public void placeOrder(Order order) {
        // lógica de negocio...
        notifyObservers(order);
    }

    private void notifyObservers(Order order) {
        for (OrderObserver observer : observers) {
            observer.onOrderPlaced(order);
        }
    }
}
```

Los observadores concretos son independientes entre sí:

```java
public class EmailNotificationObserver implements OrderObserver {
    @Override
    public void onOrderPlaced(Order order) {
        System.out.println("Enviando confirmación a " + order.customerEmail());
    }
}

public class InventoryObserver implements OrderObserver {
    @Override
    public void onOrderPlaced(Order order) {
        System.out.println("Reservando stock para pedido " + order.id());
    }
}

public class AuditObserver implements OrderObserver {
    @Override
    public void onOrderPlaced(Order order) {
        System.out.println("Registrando auditoría del pedido " + order.id());
    }
}
```

El ensamblaje ocurre en la capa de configuración:

```java
OrderService orderService = new OrderService();
orderService.subscribe(new EmailNotificationObserver());
orderService.subscribe(new InventoryObserver());
orderService.subscribe(new AuditObserver());

orderService.placeOrder(new Order("ORD-001", "cliente@mail.com"));
```

Añadir `FraudDetectionObserver` no toca `OrderService` ni ningún otro observador.

### En el ecosistema Java y Spring

Java incluye `java.util.Observer` y `java.util.Observable` desde sus primeras versiones (aunque están deprecados en Java 9+). En la práctica moderna:

- **Spring Events**: `ApplicationEventPublisher` + `@EventListener` son la implementación preferida en Spring Boot.
- **Reactive Streams**: RxJava y Project Reactor generalizan Observer con soporte para backpressure y operadores funcionales.
- **PropertyChangeListener** en JavaBeans sigue este patrón para propiedades observables.

```java
// Versión Spring Boot con eventos
@Component
public class OrderService {

    @Autowired
    private ApplicationEventPublisher publisher;

    public void placeOrder(Order order) {
        // lógica de negocio...
        publisher.publishEvent(new OrderPlacedEvent(this, order));
    }
}

@Component
public class EmailListener {

    @EventListener
    public void handle(OrderPlacedEvent event) {
        System.out.println("Email para pedido " + event.getOrder().id());
    }
}
```

### Cuándo usarlo

- Cuando un cambio en un objeto debe propagarse a un número variable de otros objetos.
- Cuando quieres desacoplar el publicador de sus consumidores.
- Cuando los consumidores pueden variar en tiempo de ejecución (agregar o quitar suscriptores dinámicamente).

---

## Decorator

### El problema

Necesitas agregar funcionalidad a un objeto sin modificar su clase ni crear una subclase para cada combinación posible. Si tienes un servicio de log y quieres versiones con timestamp, con filtrado y con cifrado, la herencia explota combinatoriamente:

```
LogService
├── TimestampLogService
├── FilteredLogService
├── EncryptedLogService
├── TimestampFilteredLogService
├── TimestampEncryptedLogService
├── FilteredEncryptedLogService
└── TimestampFilteredEncryptedLogService  // siete clases para tres funciones
```

### La solución

El patrón Decorator envuelve un objeto con otro que implementa la misma interfaz, añadiendo comportamiento antes o después de delegar al objeto envuelto:

```java
// Interfaz común
public interface LogService {
    void log(String message);
}

// Implementación base
public class ConsoleLogService implements LogService {
    @Override
    public void log(String message) {
        System.out.println(message);
    }
}

// Decorador abstracto (opcional pero útil)
public abstract class LogDecorator implements LogService {

    protected final LogService delegate;

    public LogDecorator(LogService delegate) {
        this.delegate = delegate;
    }

    @Override
    public void log(String message) {
        delegate.log(message);
    }
}

// Decorador de timestamp
public class TimestampDecorator extends LogDecorator {

    public TimestampDecorator(LogService delegate) {
        super(delegate);
    }

    @Override
    public void log(String message) {
        String timestamped = "[" + LocalDateTime.now() + "] " + message;
        delegate.log(timestamped);
    }
}

// Decorador de filtrado
public class FilterDecorator extends LogDecorator {

    private final String keyword;

    public FilterDecorator(LogService delegate, String keyword) {
        super(delegate);
        this.keyword = keyword;
    }

    @Override
    public void log(String message) {
        if (message.contains(keyword)) {
            delegate.log(message);
        }
    }
}

// Decorador de cifrado (simplificado)
public class EncryptionDecorator extends LogDecorator {

    public EncryptionDecorator(LogService delegate) {
        super(delegate);
    }

    @Override
    public void log(String message) {
        String encrypted = Base64.getEncoder().encodeToString(message.getBytes());
        delegate.log(encrypted);
    }
}
```

La composición reemplaza a la herencia múltiple:

```java
// Log con timestamp y filtrado, sin cifrado
LogService logger = new FilterDecorator(
    new TimestampDecorator(
        new ConsoleLogService()
    ),
    "ERROR"
);

logger.log("ERROR: fallo en conexión");  // se imprime con timestamp
logger.log("INFO: operación exitosa");   // filtrado — no se imprime
```

Cada combinación se construye en tiempo de ejecución con las capas que necesitas.

### Decorator en la biblioteca estándar

Java usa este patrón extensamente en `java.io`:

```java
// Cada clase envuelve a la anterior agregando capacidades
BufferedReader reader = new BufferedReader(
    new InputStreamReader(
        new FileInputStream("archivo.txt"),
        StandardCharsets.UTF_8
    )
);
```

`FileInputStream` lee bytes, `InputStreamReader` convierte a caracteres, `BufferedReader` agrega buffer y el método `readLine()`. Tres decoradores, cero subclases para cada combinación.

### Cuándo usarlo

- Cuando necesitas agregar responsabilidades a objetos individuales de forma dinámica.
- Cuando extender por herencia no es viable (clase `final`) o generaría una explosión de subclases.
- Cuando las responsabilidades adicionales pueden y deben combinarse en distinto orden.

---

## Adapter

### El problema

Tienes dos interfaces que deberían colaborar pero no son compatibles. El código legado o de terceros expone una interfaz diferente a la que espera tu sistema.

Imagina que tu sistema procesa pagos con esta interfaz:

```java
public interface PaymentGateway {
    PaymentResult charge(String customerId, BigDecimal amount, String currency);
}
```

Pero el SDK de un proveedor externo expone:

```java
// SDK de tercero — no puedes modificar esta clase
public class StripeClient {

    public StripeCharge createCharge(
        String customer,
        long amountInCents,
        String currency,
        String description
    ) {
        // lógica interna de Stripe
        return new StripeCharge("ch_" + UUID.randomUUID(), "succeeded");
    }
}
```

Las firmas son completamente distintas. No puedes hacer que `StripeClient` implemente `PaymentGateway` sin modificar el SDK.

### La solución

El patrón Adapter crea una clase intermedia que implementa la interfaz esperada y traduce las llamadas hacia la interfaz incompatible:

```java
public class StripeAdapter implements PaymentGateway {

    private final StripeClient stripeClient;

    public StripeAdapter(StripeClient stripeClient) {
        this.stripeClient = stripeClient;
    }

    @Override
    public PaymentResult charge(String customerId, BigDecimal amount, String currency) {
        // Traducción: BigDecimal a centavos (long)
        long amountInCents = amount.multiply(BigDecimal.valueOf(100)).longValue();

        StripeCharge charge = stripeClient.createCharge(
            customerId,
            amountInCents,
            currency,
            "Cargo desde sistema principal"
        );

        // Traducción del resultado
        boolean success = "succeeded".equals(charge.status());
        return new PaymentResult(charge.id(), success);
    }
}
```

Tu sistema trabaja únicamente contra `PaymentGateway`. El adaptador absorbe todos los detalles de la integración:

```java
// En producción
PaymentGateway gateway = new StripeAdapter(new StripeClient());

// En tests
PaymentGateway gateway = new FakePaymentGateway(); // implementación falsa para tests

// El servicio de negocio no cambia en ningún caso
paymentService.processOrder(order, gateway);
```

Agregar un segundo proveedor (por ejemplo, PayU) es crear `PayuAdapter` — el resto del sistema no se toca.

### Adapter con interfaces funcionales

En Java moderno, cuando la interfaz objetivo tiene un único método (interfaz funcional), el adaptador puede ser un lambda o method reference:

```java
// Supón que tu interfaz espera un Runnable
Runnable task = legacyService::doWork;  // method reference como adapter
```

### Cuándo usarlo

- Cuando quieres usar una clase existente cuya interfaz no coincide con la que espera tu sistema.
- Cuando integras código de terceros o legado que no puedes modificar.
- Cuando quieres crear una capa de abstracción sobre múltiples implementaciones externas para poder intercambiarlas.

---

## Comparativa rápida

| Patrón | Categoría GoF | Resuelve |
|---|---|---|
| **Observer** | Comportamiento | Notificación desacoplada de cambios de estado a múltiples interesados |
| **Decorator** | Estructural | Extensión dinámica de comportamiento sin herencia |
| **Adapter** | Estructural | Compatibilidad entre interfaces incompatibles |

## Diferencia entre Decorator y Adapter

Los dos envuelven un objeto, pero con propósitos distintos:

- **Decorator** implementa la **misma interfaz** que el objeto que envuelve. Su objetivo es **agregar comportamiento**.
- **Adapter** implementa una **interfaz diferente** a la del objeto que envuelve. Su objetivo es **traducir** entre interfaces.

Si el envoltorio presenta la misma cara al mundo y añade algo, es un Decorator. Si presenta una cara diferente para hacer compatibles dos mundos que no se entienden, es un Adapter.

## Conclusión

Observer, Decorator y Adapter son tres herramientas con propósitos muy distintos pero que comparten un rasgo en común: **favorecen la composición sobre la herencia y el acoplamiento directo**.

Observer desacopla publicadores de suscriptores. Decorator desacopla el núcleo de un objeto de sus extensiones. Adapter desacopla tu sistema de los detalles de integración externa.

Como con cualquier patrón, el criterio para aplicarlos es que el problema que resuelven ya exista en el código, no anticipar problemas hipotéticos. Cuando veas un objeto que notifica a una lista fija de colaboradores directos, un servicio que necesita varias combinaciones de funcionalidad adicional, o una integración que obliga a modificar tu código central, es el momento de considerar estos tres patrones.
