---
titulo: "Domain-Driven Design: modelar el software desde el negocio"
seoTitulo: "Domain-Driven Design (DDD): conceptos clave, bounded contexts y entidades explicados"
fecha: "2026-06-29"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es Domain-Driven Design, por qué pone el negocio en el centro del diseño y cómo sus conceptos clave — entidades, agregados, repositorios y bounded contexts — se traducen en código más expresivo y mantenible."
imagenPortada: "https://i.imgur.com/Y7Fi4Yg.png?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "DDD", "Domain-Driven Design", "Best Practices", "Software"]
categoria: "tech"
keywords: "Domain-Driven Design, DDD, bounded context, entidades, value objects, agregados, repositorios DDD, lenguaje ubicuo, modelo de dominio, arquitectura software, diseño guiado por dominio"
---

# Domain-Driven Design: modelar el software desde el negocio

Cuando un sistema crece, uno de los problemas más comunes no es técnico: es que el código y el negocio hablan idiomas distintos. Los desarrolladores tienen su vocabulario — entidades, tablas, DTOs, servicios — y el negocio tiene el suyo — pedidos, clientes, contratos, renovaciones. La distancia entre los dos mundos se traduce en malentendidos, bugs que nadie entiende y sistemas que resuelven problemas distintos a los que el negocio realmente tiene.

Domain-Driven Design (DDD), popularizado por Eric Evans en su libro de 2003, propone una forma de cerrar esa brecha: **hacer que el código refleje el modelo conceptual del negocio**, no al revés. No es un framework ni una librería. Es una forma de pensar el diseño de software centrada en el dominio que resuelve.

## El lenguaje ubicuo

El primer principio de DDD es quizás el más importante y el menos técnico: **todos los que trabajan en el sistema deben hablar el mismo idioma**. Desarrolladores, analistas, product owners y usuarios del negocio.

Ese idioma se llama *lenguaje ubicuo* (ubiquitous language). Cuando el negocio habla de "renovación de contrato", el código también debe tener una clase `RenovacionContrato`, no una función `updateRecord()`. Cuando el negocio dice "un pedido se cancela", el código debe tener un método `cancelar()` en el objeto `Pedido`, no `setStatus("CANCELLED")`.

El beneficio no es estético. Cuando el código usa el mismo vocabulario que el negocio, las conversaciones con stakeholders se vuelven más productivas, los requisitos se traducen directamente en código y los bugs son más fáciles de localizar porque todos entienden qué hace cada parte del sistema.

## Entidades y Value Objects

DDD distingue dos tipos fundamentales de objetos en el modelo de dominio.

**Las entidades** son objetos con identidad propia que persiste en el tiempo. Dos entidades son distintas aunque tengan los mismos atributos, porque lo que las diferencia es su identidad, no su estado. Un `Cliente` con id `42` es diferente de otro `Cliente` con id `43`, aunque tengan el mismo nombre y correo.

```java
public class Cliente {
    private final ClienteId id;
    private String nombre;
    private Email email;

    public Cliente(ClienteId id, String nombre, Email email) {
        this.id = id;
        this.nombre = nombre;
        this.email = email;
    }

    public void actualizarEmail(Email nuevoEmail) {
        // aquí pueden ir reglas de negocio: validar, emitir evento, etc.
        this.email = nuevoEmail;
    }

    public ClienteId getId() { return id; }
}
```

**Los value objects** son objetos sin identidad propia: lo que importa es su valor, no quiénes son. Dos instancias de `Email` con el mismo string son equivalentes e intercambiables. Son inmutables por definición.

```java
public final class Email {
    private final String valor;

    public Email(String valor) {
        if (valor == null || !valor.contains("@")) {
            throw new IllegalArgumentException("Email inválido: " + valor);
        }
        this.valor = valor.toLowerCase();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Email)) return false;
        return valor.equals(((Email) o).valor);
    }

    @Override
    public int hashCode() { return valor.hashCode(); }

    @Override
    public String toString() { return valor; }
}
```

Usar value objects en lugar de tipos primitivos (un `String` para el email, un `double` para el precio) tiene una ventaja concreta: **la validación vive donde corresponde**, en el tipo mismo. No hay que verificar en cada capa si el email tiene formato correcto; si el objeto `Email` existe, ya es válido.

## Agregados: consistencia dentro de un límite

En la mayoría de los sistemas hay grupos de entidades y value objects que deben tratarse como una unidad a efectos de consistencia. DDD llama a esto **agregados**.

Un agregado tiene una raíz — la entidad principal — y un conjunto de objetos asociados. La regla fundamental es que **solo se puede acceder a los objetos internos del agregado a través de su raíz**. Nada externo puede modificar directamente las líneas de un pedido; tiene que pasar por el `Pedido`.

```java
public class Pedido {
    private final PedidoId id;
    private final ClienteId clienteId;
    private List<LineaPedido> lineas;
    private EstadoPedido estado;

    public void agregarProducto(ProductoId productoId, int cantidad, Dinero precioUnitario) {
        if (estado != EstadoPedido.BORRADOR) {
            throw new IllegalStateException("Solo se pueden agregar productos a pedidos en borrador");
        }
        lineas.add(new LineaPedido(productoId, cantidad, precioUnitario));
    }

    public void confirmar() {
        if (lineas.isEmpty()) {
            throw new IllegalStateException("No se puede confirmar un pedido sin productos");
        }
        this.estado = EstadoPedido.CONFIRMADO;
    }

    public Dinero calcularTotal() {
        return lineas.stream()
            .map(LineaPedido::subtotal)
            .reduce(Dinero.CERO, Dinero::sumar);
    }
}
```

El agregado `Pedido` protege sus invariantes. No importa quién llame a `confirmar()`: si el pedido no tiene líneas, la operación falla. La lógica de negocio vive en el dominio, no en un servicio externo ni en un controlador.

## Bounded Contexts: dividir el problema grande

En sistemas complejos, el mismo concepto puede tener significados distintos en distintas partes del negocio. Un `Cliente` para el equipo de ventas (con historial de oportunidades y estado del CRM) es muy distinto de un `Cliente` para el equipo de facturación (con métodos de pago, RUC y dirección fiscal).

DDD resuelve esto con los **bounded contexts**: límites explícitos dentro de los cuales un modelo particular es válido y coherente. Dentro de cada bounded context, el lenguaje ubicuo tiene un significado preciso. Entre bounded contexts, la misma palabra puede representar cosas distintas.

Esto no es un problema: es la realidad del negocio modelada correctamente. Lo importante es hacer los límites explícitos y definir cómo los contextos se comunican entre sí — típicamente mediante eventos de dominio, APIs o mensajería.

## Repositorios

Los repositorios son la abstracción que permite trabajar con agregados sin pensar en la base de datos. Desde la perspectiva del dominio, un repositorio es una colección de objetos: puedes guardar un agregado y recuperarlo por su identidad, sin que el dominio sepa si hay una base de datos PostgreSQL, un archivo JSON o un caché de Redis detrás.

```java
public interface PedidoRepository {
    void guardar(Pedido pedido);
    Optional<Pedido> buscarPorId(PedidoId id);
    List<Pedido> buscarPorCliente(ClienteId clienteId);
}
```

La implementación concreta vive en la capa de infraestructura — fuera del dominio. Este es exactamente el mismo principio que usa la arquitectura hexagonal con los puertos y adaptadores.

## Cuándo usar DDD

DDD no es la respuesta correcta para todos los proyectos. Su valor aparece cuando el dominio es complejo: muchas reglas de negocio, términos específicos del sector, lógica que cambia con frecuencia y stakeholders del negocio con los que hay que hablar constantemente.

Para un CRUD simple, aplicar DDD completo es sobreespecificación. Pero incluso en proyectos pequeños, algunos de sus conceptos son útiles: el lenguaje ubicuo hace que el código sea más fácil de leer, y los value objects eliminan clases enteras de bugs relacionados con validación y comparación.

La conexión con otros patrones que ya hemos visto en el blog es directa: la arquitectura hexagonal define cómo separar el dominio de la infraestructura; CQRS define cómo separar las lecturas de las escrituras; DDD define cómo estructurar el dominio mismo. Los tres se complementan bien cuando el problema lo amerita.

## El modelo de dominio como corazón del sistema

Lo que DDD propone, en última instancia, es que el software más valioso no es el que usa las tecnologías más modernas sino el que captura con precisión el conocimiento del negocio. Un sistema cuyo código refleja fielmente cómo piensa el negocio es un sistema que puede evolucionar a medida que el negocio evoluciona, sin que cada cambio sea una expedición arqueológica.

El dominio primero. La infraestructura, después.
