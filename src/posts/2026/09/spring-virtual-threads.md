---
titulo: "Virtual Threads en Spring Boot: concurrencia sin el coste de los hilos de plataforma"
seoTitulo: "Virtual Threads en Spring Boot 3.2+ — concurrencia con Project Loom, configuración y trampas comunes"
fecha: "2026-09-24"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Cómo activar y aprovechar los Virtual Threads de Java 21 (Project Loom) en Spring Boot 3.2+: configuración, impacto en Tomcat y en pools JDBC, el problema del pinning con synchronized, y cuándo NO usarlos."
imagenPortada: "https://i.imgur.com/pNfhKCT.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Java 21", "Virtual Threads", "Project Loom", "Concurrencia", "Backend"]
categoria: "tech"
keywords: "virtual threads spring boot, project loom spring, spring boot virtual threads configuracion, virtual threads java 21, spring.threads.virtual.enabled, pinning virtual threads synchronized, virtual threads vs platform threads, spring boot concurrencia java 21, virtual threads tomcat, cuando no usar virtual threads"
---

# Virtual Threads en Spring Boot: concurrencia sin el coste de los hilos de plataforma

Durante años, el techo de la concurrencia en aplicaciones Spring basadas en el modelo "thread-per-request" fue el propio sistema operativo. Cada hilo de plataforma reserva megas de stack, y el planificador del SO empieza a sufrir mucho antes de llegar a los miles de hilos concurrentes. La respuesta habitual fue programación reactiva con WebFlux: más rendimiento bajo carga, a cambio de un modelo de programación más difícil de escribir, depurar y razonar.

Los **Virtual Threads**, introducidos como característica estable en Java 21 bajo Project Loom, cambian esa ecuación. Son hilos gestionados por la JVM, no por el sistema operativo: extremadamente ligeros (se pueden crear millones), y que se "desmontan" del hilo de plataforma subyacente (el *carrier thread*) cada vez que bloquean en una operación de I/O, liberándolo para atender otra tarea. El resultado es que el código bloqueante de siempre —el que ya sabes escribir— puede escalar como si fuera reactivo, sin serlo.

Spring Boot 3.2 integró soporte de primera clase para Virtual Threads. Este artículo cubre cómo activarlos, qué cambia por debajo, y las trampas que hay que conocer antes de llevarlos a producción.

## Requisitos

- **Java 21** o superior (LTS). Los Virtual Threads son una característica final desde JEP 444, incluida en JDK 21.
- **Spring Boot 3.2+**.

```xml
<properties>
    <java.version>21</java.version>
</properties>
```

## Activarlos: una sola propiedad

Spring Boot expone un único flag que activa Virtual Threads en todos los puntos donde el framework gestiona hilos por ti: el conector de Tomcat (o Jetty/Undertow), el `TaskExecutor` por defecto, `@Async`, y los listeners de `@Scheduled` y de mensajería (Kafka, RabbitMQ).

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true
```

Con esto, cada petición HTTP que llega al servidor embebido se ejecuta en un Virtual Thread nuevo en lugar de tomar un hilo prestado de un pool fijo. No hace falta tocar controladores, servicios ni repositorios: el modelo de programación imperativo de siempre sigue funcionando igual.

## Qué cambia realmente por debajo

Sin Virtual Threads, Tomcat atiende peticiones con un pool acotado (por defecto 200 hilos de plataforma). Si una petición se bloquea 300 ms esperando una respuesta de un servicio externo, ese hilo del pool queda ocupado —inutilizable para otra petición— durante esos 300 ms. Bajo carga alta con dependencias lentas, el pool se agota y las peticiones nuevas hacen cola.

Con Virtual Threads, cada petición recibe su propio hilo virtual, prácticamente sin coste de creación. Cuando ese hilo bloquea en una llamada de red o en I/O de disco, la JVM lo desmonta del carrier thread (un hilo de plataforma real) y libera ese carrier para ejecutar otro Virtual Thread. Cuando la operación de I/O termina, el Virtual Thread se remonta en cualquier carrier disponible para continuar. Todo esto es transparente: el código no sabe que fue desmontado y remontado.

```java
@RestController
@RequiredArgsConstructor
public class PedidoController {

    private final PedidoService pedidoService;
    private final InventarioClient inventarioClient; // cliente HTTP bloqueante (RestClient)

    @GetMapping("/pedidos/{id}")
    public PedidoResponse obtener(@PathVariable Long id) {
        // Esta llamada bloquea el hilo... pero si es un Virtual Thread,
        // el carrier subyacente queda libre mientras espera la respuesta.
        DisponibilidadDTO disponibilidad = inventarioClient.consultarDisponibilidad(id);
        return pedidoService.enriquecerConDisponibilidad(id, disponibilidad);
    }
}
```

No se necesita reescribir este código con `Mono`/`Flux`. Es el mismo código bloqueante, con la misma legibilidad de siempre y una escalabilidad de I/O comparable a la de un stack reactivo.

## Verificar que está activo

Una forma simple de confirmar que una petición se está ejecutando en un Virtual Thread:

```java
@GetMapping("/debug/hilo")
public String hiloActual() {
    return Thread.currentThread().toString();
}
```

El nombre del hilo en un entorno con Virtual Threads activos tiene el formato `VirtualThread[#123]/runnable@ForkJoinPool-1-worker-N`, en contraste con el `http-nio-8080-exec-N` habitual de un pool de Tomcat clásico.

## `@Async` y `TaskExecutor`

Al activar `spring.threads.virtual.enabled`, el `TaskExecutor` que Spring usa por defecto para `@Async` pasa a ser un `SimpleAsyncTaskExecutor` respaldado por Virtual Threads, en lugar de un `ThreadPoolTaskExecutor` con un pool acotado:

```java
@Service
public class NotificacionService {

    @Async
    public CompletableFuture<Void> enviarEmailBienvenida(String email) {
        emailClient.enviar(email, "Bienvenida"); // llamada bloqueante
        return CompletableFuture.completedFuture(null);
    }
}
```

Esto significa que ya no hay que dimensionar manualmente el tamaño de un pool de hilos para tareas asíncronas: cada invocación de `@Async` obtiene su propio Virtual Thread, y la limitación pasa a ser el recurso externo (por ejemplo, el número de conexiones que tu proveedor de email admite en paralelo), no el pool de hilos de la aplicación.

## El problema del *pinning*: `synchronized` y hilos nativos

Este es el punto que más sorprende en producción. Un Virtual Thread **no puede desmontarse** de su carrier thread mientras ejecuta dentro de un bloque `synchronized`, o mientras está dentro de una llamada nativa (JNI). Si ese código bloqueante llama a I/O dentro del bloque `synchronized`, el carrier queda **pinned** (fijado): no se libera, y se pierde el beneficio de los Virtual Threads en ese tramo de código.

```java
// Problemático con Virtual Threads: el carrier queda "pinned"
// durante toda la llamada de red, porque está dentro de synchronized.
public synchronized DisponibilidadDTO consultarConCache(Long id) {
    if (cache.containsKey(id)) {
        return cache.get(id);
    }
    DisponibilidadDTO resultado = inventarioClient.consultarDisponibilidad(id); // I/O bloqueante
    cache.put(id, resultado);
    return resultado;
}
```

La solución es reemplazar `synchronized` por `java.util.concurrent.locks.ReentrantLock`, que sí permite que el Virtual Thread se desmonte mientras espera el lock o mientras el código protegido por el lock hace I/O:

```java
private final ReentrantLock lock = new ReentrantLock();

public DisponibilidadDTO consultarConCache(Long id) {
    lock.lock();
    try {
        if (cache.containsKey(id)) {
            return cache.get(id);
        }
        DisponibilidadDTO resultado = inventarioClient.consultarDisponibilidad(id);
        cache.put(id, resultado);
        return resultado;
    } finally {
        lock.unlock();
    }
}
```

Desde Java 24 la JVM elimina el pinning en la mayoría de los casos de `synchronized`, pero mientras el proyecto siga en Java 21 LTS conviene auditar el código en busca de bloques `synchronized` que envuelvan I/O, especialmente en librerías de terceros que no se pueden modificar.

Para detectar pinning en tiempo de ejecución, la JVM admite un flag de diagnóstico:

```bash
java -Djdk.tracePinnedThreads=full -jar mi-aplicacion.jar
```

Esto imprime la traza de stack cada vez que un Virtual Thread queda pinned durante una operación de bloqueo, señalando exactamente la línea responsable.

## Pools de conexión: JDBC no es el cuello de botella que era

Un malentendido común es pensar que Virtual Threads eliminan la necesidad de dimensionar el pool de conexiones JDBC (HikariCP). No es así: el número de conexiones sigue limitado por la base de datos y por HikariCP, y ese límite sigue siendo el techo real de paralelismo para las consultas SQL, con o sin Virtual Threads.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20   # el techo real de queries concurrentes a la BD
```

Donde Virtual Threads sí ayudan es a que **miles de peticiones puedan esperar turno para una conexión JDBC sin agotar el pool de hilos del servidor**. Antes, si 200 peticiones esperaban una conexión de un pool de 20, el pool de hilos de Tomcat (también acotado) podía saturarse igual. Con Virtual Threads, esas 200 peticiones esperan cómodamente —cada una en su propio hilo virtual, casi gratis— hasta que una conexión queda libre.

## Cuándo NO conviene activarlos

Virtual Threads no son una mejora universal. No conviene activarlos, o hay que evaluarlos con cuidado, cuando:

- **La carga es CPU-bound**, no I/O-bound. Si el cuello de botella es cómputo puro (serialización pesada, criptografía, procesamiento de imágenes), Virtual Threads no ayudan: el número de carriers sigue limitado por los núcleos de CPU disponibles, igual que con hilos de plataforma.
- **El código depende fuertemente de `ThreadLocal`** con lógica de negocio ligada a la identidad del hilo, asumiendo que el número de hilos es acotado (por ejemplo, pools de objetos costosos reutilizados por hilo). Con millones de Virtual Threads posibles, ese patrón dimensiona mal o se vuelve contraproducente.
- **Hay código heredado con `synchronized` extenso** alrededor de I/O que no se puede refactorizar a corto plazo: el pinning anula buena parte del beneficio.
- **La aplicación ya usa WebFlux** y el equipo domina bien el modelo reactivo: no hay necesidad de mezclar ambos modelos en el mismo servicio.

## Virtual Threads no son WebFlux con menos código

Es tentador presentar Virtual Threads como "todo lo bueno de reactivo sin la curva de aprendizaje de `Mono`/`Flux`", pero la comparación tiene matices. WebFlux ofrece control explícito sobre backpressure, operadores de composición y transformación de streams asíncronos, y un modelo de programación que, aunque más difícil, hace visible el flujo de datos asíncrono en el propio tipo (`Mono<T>`, `Flux<T>`). Virtual Threads resuelven el problema de **escalabilidad de hilos bloqueados en I/O**, que era una de las motivaciones principales para adoptar reactivo, pero no sustituyen las otras capacidades de WebFlux si el proyecto ya las necesita.

Para la inmensa mayoría de aplicaciones CRUD y de orquestación de servicios —el caso de uso más común en Spring Boot— Virtual Threads permiten mantener el modelo imperativo de siempre y obtener la escalabilidad de I/O que antes exigía saltar a reactivo.

## Conclusión

Activar Virtual Threads en Spring Boot 3.2+ es, en el caso común, una única línea de configuración con un impacto medible en la capacidad de la aplicación para manejar peticiones concurrentes con dependencias de I/O lentas. El código no cambia, el modelo de programación no cambia, y el equipo no necesita aprender un paradigma nuevo.

La parte que sí exige atención es la migración de `synchronized` a `ReentrantLock` en las rutas calientes que combinan bloqueo y I/O, y entender que el pool de conexiones a la base de datos sigue siendo, como siempre, el límite real de paralelismo hacia la capa de persistencia. Con esas dos salvedades cubiertas, Virtual Threads son hoy la forma más sencilla de escalar una aplicación Spring Boot tradicional sin reescribirla.
