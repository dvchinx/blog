---
titulo: "Patrones de Diseño en Java: Builder, Factory Method y Strategy"
seoTitulo: "Patrones de Diseño en Java: Builder, Factory Method y Strategy explicados con ejemplos"
fecha: "2026-06-04"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a aplicar tres patrones de diseño esenciales en Java: Builder para construcción de objetos complejos, Factory Method para delegar la creación, y Strategy para comportamientos intercambiables."
imagenPortada: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop"
etiquetas: ["Java", "Patrones de Diseño", "Design Patterns", "Backend", "POO"]
categoria: "tech"
keywords: "patrones de diseño Java, Builder pattern Java, Factory Method Java, Strategy pattern Java, design patterns Java, programación orientada a objetos, patrones GOF"
---

# Patrones de Diseño en Java: Builder, Factory Method y Strategy

Los patrones de diseño son soluciones probadas a problemas recurrentes en el diseño de software. No son código para copiar, sino plantillas conceptuales que guían cómo estructurar las relaciones entre clases y objetos.

Este artículo cubre tres de los patrones más usados en el ecosistema Java: **Builder**, **Factory Method** y **Strategy**. Los tres pertenecen al catálogo original del libro *Design Patterns* (GoF, 1994) y siguen siendo relevantes en cualquier base de código Java moderna.

## Builder

### El problema

Cuando un objeto tiene muchos campos opcionales, el constructor se convierte en un problema:

```java
// Constructor con 7 parámetros — ¿cuál es cuál?
User user = new User("Jesús", "Flórez", "jesus@mail.com", null, null, true, "es");
```

Una alternativa es el patrón _telescoping constructor_ (varios constructores con distintas firmas), pero se vuelve inmanejable a partir de 4-5 parámetros.

### La solución

El patrón Builder separa la construcción del objeto de su representación, exponiendo métodos con nombre para cada campo:

```java
public class User {

    private final String firstName;
    private final String lastName;
    private final String email;
    private final String phone;
    private final String avatarUrl;
    private final boolean active;
    private final String locale;

    private User(Builder builder) {
        this.firstName  = builder.firstName;
        this.lastName   = builder.lastName;
        this.email      = builder.email;
        this.phone      = builder.phone;
        this.avatarUrl  = builder.avatarUrl;
        this.active     = builder.active;
        this.locale     = builder.locale;
    }

    public static class Builder {
        // Campos obligatorios
        private final String firstName;
        private final String email;

        // Campos opcionales con valores por defecto
        private String lastName  = "";
        private String phone     = null;
        private String avatarUrl = null;
        private boolean active   = true;
        private String locale    = "es";

        public Builder(String firstName, String email) {
            this.firstName = firstName;
            this.email     = email;
        }

        public Builder lastName(String val)   { lastName  = val; return this; }
        public Builder phone(String val)      { phone     = val; return this; }
        public Builder avatarUrl(String val)  { avatarUrl = val; return this; }
        public Builder active(boolean val)    { active    = val; return this; }
        public Builder locale(String val)     { locale    = val; return this; }

        public User build() {
            return new User(this);
        }
    }
}
```

Ahora la construcción es legible y los campos opcionales quedan explícitos:

```java
User user = new User.Builder("Jesús", "jesus@mail.com")
        .lastName("Flórez")
        .locale("es")
        .active(true)
        .build();
```

### Cuándo usarlo

- Objetos con más de 4 parámetros de construcción, especialmente si son del mismo tipo.
- Cuando varios campos son opcionales y tienen valores por defecto razonables.
- Cuando quieres que el objeto sea inmutable (`final` en todos los campos) pero la construcción sea flexible.

En proyectos Spring Boot, Lombok hace esto automático con `@Builder`:

```java
@Builder
@Getter
public class User {
    private final String firstName;
    private final String email;
    @Builder.Default private final boolean active = true;
    @Builder.Default private final String locale  = "es";
}
```

---

## Factory Method

### El problema

Supón que tienes un sistema que procesa pagos. Hoy soporta tarjeta de crédito y PSE. El código que crea el procesador de pago está mezclado con la lógica de negocio:

```java
public class PaymentService {

    public void processPayment(String method, BigDecimal amount) {
        if (method.equals("CARD")) {
            CardProcessor processor = new CardProcessor();
            processor.charge(amount);
        } else if (method.equals("PSE")) {
            PseProcessor processor = new PseProcessor(bankCode);
            processor.charge(amount);
        }
        // Añadir Nequi implica tocar este método
    }
}
```

Cada nueva forma de pago obliga a modificar `PaymentService`, violando el principio Open/Closed.

### La solución

Factory Method define un método abstracto para crear objetos, dejando que las subclases decidan qué clase concreta instanciar:

```java
// Abstracción del producto
public interface PaymentProcessor {
    void charge(BigDecimal amount);
    void refund(BigDecimal amount);
}

// Implementaciones concretas
public class CardProcessor implements PaymentProcessor {
    @Override
    public void charge(BigDecimal amount) {
        System.out.println("Cargando " + amount + " a tarjeta");
    }

    @Override
    public void refund(BigDecimal amount) {
        System.out.println("Reembolsando " + amount + " a tarjeta");
    }
}

public class PseProcessor implements PaymentProcessor {
    @Override
    public void charge(BigDecimal amount) {
        System.out.println("Iniciando débito PSE por " + amount);
    }

    @Override
    public void refund(BigDecimal amount) {
        System.out.println("Reversando débito PSE por " + amount);
    }
}

// La factory
public class PaymentProcessorFactory {

    public static PaymentProcessor create(String method) {
        return switch (method.toUpperCase()) {
            case "CARD"  -> new CardProcessor();
            case "PSE"   -> new PseProcessor();
            case "NEQUI" -> new NequiProcessor();
            default      -> throw new IllegalArgumentException("Método de pago no soportado: " + method);
        };
    }
}
```

El servicio de negocio ya no conoce las clases concretas:

```java
public class PaymentService {

    public void processPayment(String method, BigDecimal amount) {
        PaymentProcessor processor = PaymentProcessorFactory.create(method);
        processor.charge(amount);
    }
}
```

Añadir un nuevo método de pago solo requiere crear una clase nueva y actualizar la factory — `PaymentService` no cambia.

### En Spring Boot con inyección de dependencias

Spring permite una variante más elegante donde los procesadores son beans:

```java
@Component("CARD")
public class CardProcessor implements PaymentProcessor { ... }

@Component("PSE")
public class PseProcessor implements PaymentProcessor { ... }

@Service
public class PaymentService {

    private final Map<String, PaymentProcessor> processors;

    // Spring inyecta todos los beans de tipo PaymentProcessor con su nombre como clave
    public PaymentService(Map<String, PaymentProcessor> processors) {
        this.processors = processors;
    }

    public void processPayment(String method, BigDecimal amount) {
        PaymentProcessor processor = processors.get(method.toUpperCase());
        if (processor == null) {
            throw new IllegalArgumentException("Método de pago no soportado: " + method);
        }
        processor.charge(amount);
    }
}
```

### Cuándo usarlo

- Cuando el tipo exacto del objeto a crear depende de una condición en tiempo de ejecución.
- Cuando quieres centralizar la lógica de creación de objetos relacionados.
- Cuando añadir nuevos tipos no debe requerir cambios en el código cliente.

---

## Strategy

### El problema

Tienes un sistema de e-commerce con distintas estrategias de descuento: para clientes nuevos, para clientes VIP, para descuentos por volumen. El código con condicionales crece sin control:

```java
public BigDecimal calculateTotal(Cart cart, String customerType) {
    BigDecimal total = cart.subtotal();

    if (customerType.equals("NEW")) {
        total = total.multiply(BigDecimal.valueOf(0.90)); // 10% off
    } else if (customerType.equals("VIP")) {
        total = total.multiply(BigDecimal.valueOf(0.80)); // 20% off
    } else if (customerType.equals("BULK") && cart.itemCount() > 10) {
        total = total.multiply(BigDecimal.valueOf(0.85)); // 15% off
    }

    return total;
}
```

### La solución

El patrón Strategy encapsula cada algoritmo en su propia clase e intercambia la implementación en tiempo de ejecución:

```java
// La interfaz de estrategia
@FunctionalInterface
public interface DiscountStrategy {
    BigDecimal apply(BigDecimal subtotal, int itemCount);
}

// Implementaciones concretas
public class NewCustomerDiscount implements DiscountStrategy {
    @Override
    public BigDecimal apply(BigDecimal subtotal, int itemCount) {
        return subtotal.multiply(BigDecimal.valueOf(0.90));
    }
}

public class VipDiscount implements DiscountStrategy {
    @Override
    public BigDecimal apply(BigDecimal subtotal, int itemCount) {
        return subtotal.multiply(BigDecimal.valueOf(0.80));
    }
}

public class BulkDiscount implements DiscountStrategy {
    private static final int BULK_THRESHOLD = 10;

    @Override
    public BigDecimal apply(BigDecimal subtotal, int itemCount) {
        if (itemCount > BULK_THRESHOLD) {
            return subtotal.multiply(BigDecimal.valueOf(0.85));
        }
        return subtotal;
    }
}

// Sin descuento
public class NoDiscount implements DiscountStrategy {
    @Override
    public BigDecimal apply(BigDecimal subtotal, int itemCount) {
        return subtotal;
    }
}
```

El contexto delega el cálculo a la estrategia recibida:

```java
public class PricingService {

    private static final Map<String, DiscountStrategy> STRATEGIES = Map.of(
        "NEW",  new NewCustomerDiscount(),
        "VIP",  new VipDiscount(),
        "BULK", new BulkDiscount()
    );

    public BigDecimal calculateTotal(Cart cart, String customerType) {
        DiscountStrategy strategy = STRATEGIES.getOrDefault(customerType, new NoDiscount());
        return strategy.apply(cart.subtotal(), cart.itemCount());
    }
}
```

### Con lambdas (Java 8+)

Como `DiscountStrategy` es una interfaz funcional (`@FunctionalInterface`), puedes definir estrategias inline sin crear clases:

```java
DiscountStrategy tenPercent  = (subtotal, count) -> subtotal.multiply(BigDecimal.valueOf(0.90));
DiscountStrategy freeShipping = (subtotal, count) -> subtotal; // sin descuento en precio

// O pasarla directamente:
pricingService.calculateTotal(cart, (subtotal, count) -> subtotal.multiply(BigDecimal.valueOf(0.95)));
```

### Cuándo usarlo

- Cuando tienes múltiples variantes de un algoritmo que cambian en tiempo de ejecución.
- Cuando quieres eliminar condicionales que crecen cada vez que se añade una variante nueva.
- Cuando el comportamiento de una clase debe ser configurable desde el exterior.

---

## Comparativa rápida

| Patrón | Categoría GoF | Resuelve |
|---|---|---|
| **Builder** | Creacional | Construcción de objetos complejos con muchos parámetros opcionales |
| **Factory Method** | Creacional | Delegación de la creación de objetos a una clase especializada |
| **Strategy** | Comportamiento | Encapsulación de algoritmos intercambiables en tiempo de ejecución |

## Conclusión

Los tres patrones atacan problemas distintos pero comparten la misma idea raíz: **aislar la variación**. Builder aísla la complejidad de la construcción. Factory Method aísla la lógica de creación. Strategy aísla el algoritmo del contexto que lo usa.

El error más común al aprender patrones es aplicarlos en exceso. Un objeto con tres campos no necesita Builder; dos variantes de un algoritmo no justifican Strategy. Úsalos cuando el problema que resuelven ya esté presente — no como prevención de problemas hipotéticos.
