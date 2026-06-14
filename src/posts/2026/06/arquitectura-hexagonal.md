---
titulo: "Arquitectura Hexagonal: Ports and Adapters en la práctica"
seoTitulo: "Arquitectura Hexagonal explicada: Ports and Adapters con ejemplos en Java paso a paso"
fecha: "2026-06-15"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es la Arquitectura Hexagonal (Ports and Adapters), por qué separa la lógica de negocio de los detalles técnicos y cómo implementarla en Java con un ejemplo concreto."
imagenPortada: "https://images.unsplash.com/photo-1626285094816-39f688104ce0?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Hexagonal", "Clean Architecture", "Java", "Backend", "Best Practices"]
categoria: "tech"
keywords: "arquitectura hexagonal, ports and adapters, clean architecture, arquitectura limpia, dominio, aplicación Java, hexagonal architecture Java, inversión de dependencias, diseño de software"
---

# Arquitectura Hexagonal: Ports and Adapters

La Arquitectura Hexagonal, también conocida como *Ports and Adapters*, fue propuesta por Alistair Cockburn en 2005. Su premisa central es simple: **el núcleo de la aplicación —la lógica de negocio— no debe depender de nada externo**. Las bases de datos, las APIs REST, los sistemas de mensajería y cualquier otro detalle técnico deben ser intercambiables sin tocar el dominio.

A pesar de que el nombre "hexagonal" puede sonar arbitrario, el hexágono solo representa visualmente que hay múltiples puntos de entrada y salida en una aplicación, todos tratados de la misma manera: como adaptadores que conectan el mundo exterior con el núcleo.

## El problema que resuelve

En una arquitectura tradicional por capas, la dirección de dependencias fluye de la UI hacia la base de datos: la presentación depende de la lógica de negocio, y la lógica de negocio depende de la capa de datos. Esto genera un problema conocido: si quieres probar la lógica de negocio, necesitas la base de datos. Si quieres cambiar PostgreSQL por MongoDB, tienes que tocar código de negocio.

La Arquitectura Hexagonal invierte ese flujo. El dominio no depende de nada. Los detalles técnicos dependen del dominio. Esta inversión es exactamente el quinto principio SOLID (Dependency Inversion) aplicado de forma sistemática a toda la arquitectura.

## Las tres capas

La arquitectura se organiza en tres anillos concéntricos. Las dependencias solo pueden ir de afuera hacia adentro, nunca al revés.

**Dominio (núcleo)**: contiene las entidades, los objetos de valor y las reglas de negocio. No importa ninguna librería externa. Es el código más estable de la aplicación.

**Aplicación**: contiene los casos de uso, que orquestan las operaciones del dominio. Define los puertos: interfaces que describen qué necesita el dominio del mundo exterior (puertos de salida) y qué operaciones ofrece al mundo exterior (puertos de entrada).

**Infraestructura (adaptadores)**: contiene las implementaciones concretas de los puertos. Aquí viven los repositorios de base de datos, los controladores REST, los clientes de APIs externas, los consumidores de mensajes.

## Puertos y adaptadores

Un **puerto** es una interfaz Java que define un contrato. Hay dos tipos:

- **Puertos de entrada** (*driving ports*): definen cómo el mundo exterior puede invocar a la aplicación. Por ejemplo, la interfaz `OrdenService` con el método `crearOrden()`. El adaptador de entrada que la implementa puede ser un controlador REST, un consumer de Kafka o un job de Quartz.

- **Puertos de salida** (*driven ports*): definen qué necesita la aplicación del mundo exterior. Por ejemplo, la interfaz `OrdenRepository` con el método `guardar()`. El adaptador de salida que la implementa puede ser un repositorio JPA, un cliente S3 o un mock en los tests.

La clave es que las interfaces viven en la capa de aplicación, no en la de infraestructura. Esto hace que el dominio y los casos de uso no sepan nada de JPA, JDBC ni Spring.

## Ejemplo: sistema de órdenes

Veamos cómo se estructura un caso de uso concreto: crear una orden de compra.

### El dominio

Las entidades del dominio son POJOs con lógica de negocio. No tienen anotaciones de JPA ni de Spring:

```java
public class Orden {

    private final OrdenId id;
    private final ClienteId clienteId;
    private final List<LineaOrden> lineas;
    private EstadoOrden estado;

    public Orden(OrdenId id, ClienteId clienteId, List<LineaOrden> lineas) {
        if (lineas == null || lineas.isEmpty()) {
            throw new IllegalArgumentException("Una orden debe tener al menos una línea");
        }
        this.id         = id;
        this.clienteId  = clienteId;
        this.lineas     = List.copyOf(lineas);
        this.estado     = EstadoOrden.PENDIENTE;
    }

    public BigDecimal calcularTotal() {
        return lineas.stream()
                .map(LineaOrden::subtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public void confirmar() {
        if (this.estado != EstadoOrden.PENDIENTE) {
            throw new IllegalStateException("Solo se pueden confirmar órdenes pendientes");
        }
        this.estado = EstadoOrden.CONFIRMADA;
    }

    // getters...
}
```

La regla de negocio —que una orden necesita al menos una línea— vive aquí, no en el servicio ni en el controlador.

### Los puertos de salida

La aplicación define las interfaces que necesita del mundo exterior:

```java
// Puerto de salida: persistencia
public interface OrdenRepository {
    void guardar(Orden orden);
    Optional<Orden> buscarPorId(OrdenId id);
}

// Puerto de salida: notificaciones
public interface NotificacionService {
    void notificarConfirmacion(Orden orden);
}
```

### El caso de uso (puerto de entrada)

El caso de uso define la operación y sus dependencias a través de los puertos de salida:

```java
public class CrearOrdenUseCase {

    private final OrdenRepository ordenRepository;
    private final NotificacionService notificacionService;

    public CrearOrdenUseCase(OrdenRepository ordenRepository,
                             NotificacionService notificacionService) {
        this.ordenRepository      = ordenRepository;
        this.notificacionService  = notificacionService;
    }

    public OrdenId ejecutar(CrearOrdenCommand command) {
        OrdenId id = OrdenId.nuevo();

        List<LineaOrden> lineas = command.items().stream()
                .map(item -> new LineaOrden(item.productoId(), item.cantidad(), item.precioUnitario()))
                .toList();

        Orden orden = new Orden(id, command.clienteId(), lineas);
        orden.confirmar();

        ordenRepository.guardar(orden);
        notificacionService.notificarConfirmacion(orden);

        return id;
    }
}
```

Este caso de uso no conoce JPA, no conoce Spring, no conoce HTTP. Si quisieras ejecutarlo desde un test, una CLI o un worker, cambias solo el adaptador de entrada.

### El adaptador de salida: repositorio JPA

Ahora la infraestructura implementa los puertos. El adaptador de persistencia convierte la entidad de dominio a una entidad JPA y viceversa:

```java
@Component
public class OrdenRepositoryAdapter implements OrdenRepository {

    private final OrdenJpaRepository jpaRepository;
    private final OrdenMapper mapper;

    public OrdenRepositoryAdapter(OrdenJpaRepository jpaRepository, OrdenMapper mapper) {
        this.jpaRepository = jpaRepository;
        this.mapper        = mapper;
    }

    @Override
    public void guardar(Orden orden) {
        OrdenEntity entity = mapper.toEntity(orden);
        jpaRepository.save(entity);
    }

    @Override
    public Optional<Orden> buscarPorId(OrdenId id) {
        return jpaRepository.findById(id.valor())
                .map(mapper::toDomain);
    }
}
```

El `OrdenMapper` convierte entre `Orden` (dominio) y `OrdenEntity` (JPA). La entidad JPA sí tiene las anotaciones `@Entity`, `@Table`, `@Column`, pero el dominio no las ve.

### El adaptador de entrada: controlador REST

```java
@RestController
@RequestMapping("/ordenes")
public class OrdenController {

    private final CrearOrdenUseCase crearOrdenUseCase;

    public OrdenController(CrearOrdenUseCase crearOrdenUseCase) {
        this.crearOrdenUseCase = crearOrdenUseCase;
    }

    @PostMapping
    public ResponseEntity<Map<String, String>> crear(@RequestBody @Valid CrearOrdenRequest request) {
        CrearOrdenCommand command = new CrearOrdenCommand(
                new ClienteId(request.clienteId()),
                request.items()
        );

        OrdenId id = crearOrdenUseCase.ejecutar(command);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("id", id.valor().toString()));
    }
}
```

El controlador solo transforma HTTP a comandos y llama al caso de uso. No tiene lógica de negocio.

## Estructura de paquetes recomendada

Una forma limpia de organizar el proyecto en Java es la siguiente:

```
com.empresa.ordenes/
├── domain/
│   ├── Orden.java
│   ├── LineaOrden.java
│   ├── OrdenId.java
│   └── EstadoOrden.java
├── application/
│   ├── ports/
│   │   ├── input/
│   │   │   └── CrearOrdenUseCase.java
│   │   └── output/
│   │       ├── OrdenRepository.java
│   │       └── NotificacionService.java
│   └── commands/
│       └── CrearOrdenCommand.java
└── infrastructure/
    ├── persistence/
    │   ├── OrdenRepositoryAdapter.java
    │   ├── OrdenJpaRepository.java
    │   ├── OrdenEntity.java
    │   └── OrdenMapper.java
    ├── notification/
    │   └── EmailNotificacionAdapter.java
    └── rest/
        ├── OrdenController.java
        └── CrearOrdenRequest.java
```

Las capas nunca importan hacia adentro. `infrastructure` puede importar de `application` y `domain`. `application` solo puede importar de `domain`. `domain` no importa de ninguna otra capa.

## El beneficio real: testeabilidad

El mayor argumento para adoptar esta arquitectura no es la elegancia, sino la capacidad de probar la lógica de negocio de forma aislada:

```java
class CrearOrdenUseCaseTest {

    private OrdenRepository repositoryMock;
    private NotificacionService notificacionMock;
    private CrearOrdenUseCase useCase;

    @BeforeEach
    void setup() {
        repositoryMock   = mock(OrdenRepository.class);
        notificacionMock = mock(NotificacionService.class);
        useCase          = new CrearOrdenUseCase(repositoryMock, notificacionMock);
    }

    @Test
    void debeCrearOrdenYNotificar() {
        CrearOrdenCommand command = new CrearOrdenCommand(
                new ClienteId(UUID.randomUUID()),
                List.of(new ItemCommand("prod-1", 2, new BigDecimal("50.00")))
        );

        OrdenId id = useCase.ejecutar(command);

        assertNotNull(id);
        verify(repositoryMock).guardar(any(Orden.class));
        verify(notificacionMock).notificarConfirmacion(any(Orden.class));
    }

    @Test
    void debeFallarSiNoHayItems() {
        CrearOrdenCommand command = new CrearOrdenCommand(
                new ClienteId(UUID.randomUUID()),
                List.of()
        );

        assertThrows(IllegalArgumentException.class, () -> useCase.ejecutar(command));
    }
}
```

Sin base de datos. Sin Spring. Sin setup complejo. El test se ejecuta en milisegundos y valida la lógica de negocio de forma directa.

## Cuándo aplicarla

La Arquitectura Hexagonal tiene un costo de entrada: más clases, más capas, más mappers. No es la opción correcta para todos los proyectos.

Tiene sentido cuando la lógica de negocio es compleja y cambia con frecuencia, cuando el proyecto necesita ser probado exhaustivamente, cuando se anticipa un cambio de tecnología (cambiar la base de datos, agregar soporte para eventos, migrar de REST a gRPC), o cuando trabajan varios equipos en paralelo que necesitan fronteras claras.

En prototipos, MVPs o scripts de uso interno, el costo de la estructura formal rara vez se justifica.

## Diferencia con Clean Architecture

La *Clean Architecture* de Robert C. Martin y la Arquitectura Hexagonal de Cockburn comparten el mismo principio fundamental: el dominio no debe depender de detalles técnicos. Las diferencias son principalmente de terminología y de cuántas capas se definen explícitamente.

Clean Architecture agrega una separación adicional entre *entities* (reglas de negocio puras, sin estado de aplicación) y *use cases* (orquestación). La Arquitectura Hexagonal es más permisiva en esa distinción interna. En la práctica, ambas llevan a estructuras muy similares.

## Conclusión

La Arquitectura Hexagonal no es un patrón de diseño: es una forma de pensar el sistema. Su regla central, que los detalles técnicos dependen del negocio y no al revés, produce aplicaciones donde la lógica de negocio se puede probar sin levantar un servidor, cambiar la base de datos sin tocar los casos de uso, y agregar nuevos canales de entrada (REST, gRPC, eventos) sin duplicar lógica.

El esfuerzo inicial de establecer las capas y los puertos se recupera rápido en cualquier proyecto que vaya a crecer o que deba mantenerse a lo largo del tiempo.
