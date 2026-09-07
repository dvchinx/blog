---
titulo: "Monolitos modulares con Spring Modulith"
seoTitulo: "Spring Modulith: monolito modular en Spring Boot — módulos, eventos y tests de arquitectura"
fecha: "2026-09-08"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a estructurar aplicaciones Spring Boot como monolitos modulares con Spring Modulith: definición de módulos, comunicación mediante eventos, enforcement de dependencias y tests de arquitectura automatizados."
imagenPortada: "https://i.imgur.com/EsMz4Hg.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Modulith", "Java", "Arquitectura", "Monolito Modular", "Backend"]
categoria: "tech"
keywords: "spring modulith, monolito modular spring boot, spring modulith módulos, spring modulith eventos, spring modulith testing, arquitectura modular java, spring modulith ApplicationModuleTest, spring modulith dependencias entre módulos, spring modulith vs microservicios, spring boot modular monolith"
---

# Monolitos modulares con Spring Modulith

La narrativa habitual en arquitectura de software presenta los microservicios como el destino natural de cualquier aplicación seria y el monolito como algo a superar. La realidad del día a día cuenta otra historia: equipos pequeños que no pueden asumir la complejidad operativa de decenas de servicios desplegados por separado, aplicaciones donde la latencia de red entre servicios es un problema real, o dominios de negocio que aún no están lo suficientemente estables como para trazar fronteras duraderas entre servicios.

El **monolito modular** es la alternativa pragmática: una única unidad de despliegue con fronteras internas bien definidas, enforced por código, no solo por convención. **Spring Modulith** lleva esa idea al ecosistema de Spring Boot. Proporciona las herramientas para declarar módulos, restringir qué puede ver cada uno, comunicarlos mediante eventos con persistencia transaccional y verificar automáticamente en los tests que las reglas de dependencia se cumplen.

## ¿Qué es Spring Modulith?

Spring Modulith es un proyecto de Spring que parte de la estructura de paquetes de una aplicación Spring Boot para inferir sus módulos. Cada subpaquete inmediato del paquete raíz de la aplicación se trata como un módulo independiente. El framework:

- **Hace visibles** las dependencias entre módulos y detecta ciclos.
- **Restringe el acceso**: solo las clases en el paquete raíz de un módulo forman su API pública; todo lo que está en subpaquetes internos es invisible para otros módulos.
- **Facilita la comunicación asíncrona** entre módulos mediante `ApplicationEventPublisher`, con opción de persistir los eventos para garantizar entrega at-least-once.
- **Genera documentación** automática del grafo de módulos.
- **Permite tests de módulo** aislados: levanta solo el contexto de Spring del módulo bajo prueba.

## Dependencia

Añade el BOM de Spring Modulith y las dependencias necesarias:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.experimental</groupId>
            <artifactId>spring-modulith-bom</artifactId>
            <version>1.2.4</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <!-- Núcleo: detección de módulos y API de eventos -->
    <dependency>
        <groupId>org.springframework.experimental</groupId>
        <artifactId>spring-modulith-core</artifactId>
    </dependency>

    <!-- Tests de arquitectura -->
    <dependency>
        <groupId>org.springframework.experimental</groupId>
        <artifactId>spring-modulith-test</artifactId>
        <scope>test</scope>
    </dependency>

    <!-- Eventos con persistencia (requiere Spring Data JPA) -->
    <dependency>
        <groupId>org.springframework.experimental</groupId>
        <artifactId>spring-modulith-events-jpa</artifactId>
    </dependency>

    <!-- Documentación del grafo de módulos (opcional) -->
    <dependency>
        <groupId>org.springframework.experimental</groupId>
        <artifactId>spring-modulith-docs</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

## Estructura de paquetes

Spring Modulith toma el paquete de la clase anotada con `@SpringBootApplication` como raíz. Cada subpaquete inmediato es un módulo:

```
com.ejemplo.tienda/
├── TiendaApplication.java          ← raíz de la aplicación
│
├── pedidos/                        ← módulo Pedidos
│   ├── PedidosService.java         ← API pública
│   ├── PedidoController.java       ← API pública
│   └── internal/                   ← paquete interno (invisible desde fuera)
│       ├── PedidoRepository.java
│       └── PedidoMapper.java
│
├── inventario/                     ← módulo Inventario
│   ├── InventarioService.java      ← API pública
│   └── internal/
│       ├── ProductoRepository.java
│       └── StockCalculator.java
│
└── notificaciones/                 ← módulo Notificaciones
    ├── NotificacionService.java
    └── internal/
        └── EmailSender.java
```

La regla es simple: **solo las clases en el paquete raíz del módulo son accesibles desde otros módulos**. Cualquier clase en un subpaquete (como `internal/`) es efectivamente privada para ese módulo. Spring Modulith valida esto automáticamente en los tests de arquitectura.

## Verificación de la arquitectura

El test más básico y más valioso de Spring Modulith verifica que la estructura de módulos es válida: sin dependencias circulares, sin acceso a clases internas de otros módulos.

```java
@Test
void verificarEstructuraDeModulos() {
    ApplicationModules modules = ApplicationModules.of(TiendaApplication.class);
    modules.verify();
}
```

`modules.verify()` lanza una excepción con un mensaje descriptivo si detecta alguna violación. Este test debe correr en cada PR; convierte las reglas de modularidad en una restricción técnica, no en un acuerdo verbal.

Para ver el estado actual de los módulos sin que el test falle:

```java
@Test
void imprimirModulos() {
    ApplicationModules modules = ApplicationModules.of(TiendaApplication.class);
    modules.forEach(System.out::println);
}
```

El output muestra cada módulo, sus clases públicas, sus dependencias directas y las referencias a APIs de otros módulos.

## Comunicación entre módulos mediante eventos

La dependencia directa entre módulos es la fuente más común de acoplamiento. Si `PedidosService` llama directamente a `InventarioService`, ambos módulos quedan acoplados en tiempo de compilación: un cambio en la firma de `InventarioService` rompe el módulo de pedidos.

Spring Modulith recomienda comunicar módulos mediante eventos de dominio publicados con el `ApplicationEventPublisher` estándar de Spring:

```java
// En el módulo pedidos
@Service
@RequiredArgsConstructor
public class PedidosService {

    private final PedidoRepository pedidoRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Pedido crearPedido(CrearPedidoRequest request) {
        Pedido pedido = new Pedido(request.productoId(), request.cantidad(), request.clienteId());
        pedidoRepository.save(pedido);

        // Publicar evento de dominio — el módulo de inventario reaccionará
        eventPublisher.publishEvent(new PedidoCreado(pedido.getId(), pedido.getProductoId(), pedido.getCantidad()));

        return pedido;
    }
}
```

```java
// Evento de dominio — puede vivir en el paquete raíz de 'pedidos'
public record PedidoCreado(Long pedidoId, Long productoId, int cantidad) {}
```

```java
// En el módulo inventario — escucha el evento sin importar nada de 'pedidos'
@Component
@Slf4j
public class InventarioEventListener {

    private final InventarioService inventarioService;

    @ApplicationModuleListener
    public void onPedidoCreado(PedidoCreado evento) {
        log.info("Reservando {} unidades del producto {} para pedido {}",
                evento.cantidad(), evento.productoId(), evento.pedidoId());
        inventarioService.reservarStock(evento.productoId(), evento.cantidad());
    }
}
```

`@ApplicationModuleListener` es un meta-anotación de Spring Modulith que combina `@EventListener`, `@Transactional(propagation = REQUIRES_NEW)` y `@Async`. Garantiza que el listener se ejecuta en su propia transacción, separada de la del publicador.

## Eventos con persistencia transaccional

El problema con los eventos en memoria es que si la aplicación falla entre que el evento se publica y el listener lo procesa, el evento se pierde. Spring Modulith resuelve esto con la **Event Publication Registry**: los eventos se persisten en la misma transacción que los datos de negocio, y se marcan como completados solo cuando el listener termina con éxito.

Para activarlo, basta con incluir `spring-modulith-events-jpa` en el classpath (ya añadido en las dependencias de arriba) y asegurarse de que los listeners están anotados con `@ApplicationModuleListener`. Spring Modulith crea automáticamente una tabla `EVENT_PUBLICATION` donde registra cada publicación pendiente.

```yaml
# application.yml — configuración del repositorio de eventos
spring:
  modulith:
    events:
      completion-mode: archive   # 'delete' elimina los eventos completados; 'archive' los conserva
      republication-interval: PT1M  # reintenta eventos no completados cada minuto
```

Con esta configuración, si el listener de inventario falla, Spring Modulith reintentará el evento automáticamente. Es **exactly-once-like** dentro de una misma JVM con almacenamiento JPA: el evento no se pierde aunque la aplicación se reinicie entre la publicación y el procesamiento.

## Tests de módulo aislados

Uno de los beneficios más prácticos de Spring Modulith es poder levantar solo el contexto de un módulo en los tests, sin el peso de arrancar toda la aplicación:

```java
@ApplicationModuleTest
class PedidosModuleTest {

    @Autowired
    PedidosService pedidosService;

    @MockitoBean
    ApplicationEventPublisher eventPublisher;

    @Test
    void crearPedidoPublicaEvento() {
        // Arrange
        CrearPedidoRequest request = new CrearPedidoRequest(1L, 3, 42L);

        // Act
        Pedido pedido = pedidosService.crearPedido(request);

        // Assert
        assertThat(pedido.getId()).isNotNull();
        verify(eventPublisher).publishEvent(
            argThat(e -> e instanceof PedidoCreado pc && pc.productoId().equals(1L))
        );
    }
}
```

`@ApplicationModuleTest` arranca solo los beans del módulo `pedidos`. Las dependencias de otros módulos se resuelven como mocks automáticamente, a menos que se indique lo contrario con `mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES`.

Esto reduce significativamente el tiempo de arranque de los tests y obliga a definir con claridad cuál es la interfaz pública de cada módulo.

## Módulos con acceso explícito entre sí

Hay casos donde un módulo necesita exponer más de una clase pública pero no quiere darle acceso irrestricto a todos los módulos. Spring Modulith permite declarar qué módulos pueden acceder a determinadas partes de la API mediante la anotación `@NamedInterface` y `@ApplicationModule`:

```java
// En el paquete raíz del módulo inventario
@ApplicationModule(
    allowedDependencies = "pedidos"  // solo 'pedidos' puede importar de 'inventario'
)
package com.ejemplo.tienda.inventario;

import org.springframework.modulith.ApplicationModule;
```

O al contrario, si un módulo solo quiere exponer parte de su API a módulos concretos:

```java
@NamedInterface("consultas")  // expone este paquete como interfaz nombrada
package com.ejemplo.tienda.inventario.consultas;

import org.springframework.modulith.NamedInterface;
```

Otros módulos que quieran usar esa interfaz nombrada la declaran explícitamente:

```java
@ApplicationModule(allowedDependencies = "inventario::consultas")
package com.ejemplo.tienda.pedidos;
```

## Generación de documentación

Spring Modulith puede generar un diagrama del grafo de módulos en formato PlantUML o AsciiDoc con una sola llamada:

```java
@Test
void generarDocumentacion() throws Exception {
    new Documenter(ApplicationModules.of(TiendaApplication.class))
        .writeModulesAsPlantUml()
        .writeIndividualModulesAsPlantUml();
}
```

Los archivos se generan en `target/spring-modulith-docs/`. Son especialmente útiles en onboarding: el diagrama muestra de un vistazo qué módulos existen y cómo se relacionan, sin necesidad de leer el código.

## ¿Cuándo usar Spring Modulith?

Spring Modulith no es la respuesta a todos los problemas de arquitectura. Es la herramienta adecuada cuando:

- El equipo es pequeño y no puede asumir la complejidad operativa de microservicios (múltiples despliegues, service mesh, observabilidad distribuida, etc.).
- El dominio de negocio aún está evolucionando y las fronteras entre contextos no son estables.
- Hay requisitos de consistencia transaccional entre operaciones que en microservicios requerirían sagas complejas.
- El rendimiento de llamadas entre servicios es una preocupación real.

La ventaja estratégica es que una aplicación bien estructurada con Spring Modulith puede **evolucionar hacia microservicios** cuando sea necesario: los módulos ya están aislados, los eventos ya son el canal de comunicación, y las fronteras ya están definidas y verificadas. Extraer un módulo a un servicio independiente se convierte en una decisión táctica, no en una refactorización mayor.

## Conclusión

Spring Modulith aporta disciplina técnica al monolito. En lugar de confiar en acuerdos del equipo para respetar las fronteras entre módulos, las convierte en restricciones verificadas automáticamente en cada ejecución de tests. Los eventos de dominio con persistencia transaccional ofrecen comunicación asíncrona fiable sin introducir un broker de mensajes externo.

El resultado es una aplicación que conserva la simplicidad operativa del monolito —un único artefacto desplegable, transacciones locales, sin latencia de red entre módulos— pero con la claridad estructural que habitualmente se asocia a los microservicios. Para equipos que sienten el peso del acoplamiento interno pero no están listos para la complejidad de los microservicios, Spring Modulith es el punto de equilibrio.
