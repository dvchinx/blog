---
titulo: "gRPC y Protocol Buffers: comunicación eficiente entre microservicios"
seoTitulo: "gRPC y Protocol Buffers: qué son, cómo funcionan y cuándo usarlos en microservicios"
fecha: "2026-09-19"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es gRPC, cómo funcionan los Protocol Buffers, los cuatro tipos de streaming que ofrece, y cuándo tiene sentido usarlo en lugar de REST en arquitecturas de microservicios."
imagenPortada: "https://i.imgur.com/0gGKtzp.png?w=800&h=500&fit=crop"
etiquetas: ["gRPC", "Protocol Buffers", "Microservices", "APIs", "Architecture", "Backend"]
categoria: "tech"
keywords: "gRPC, protocol buffers, protobuf, microservicios, gRPC vs REST, streaming gRPC, comunicación entre servicios, RPC, HTTP/2, service mesh, IDL, código generado, gRPC Java, gRPC Spring Boot, definición de servicios"
---

# gRPC y Protocol Buffers: comunicación eficiente entre microservicios

Cuando se diseña una arquitectura de microservicios, una de las primeras decisiones que hay que tomar es cómo se van a comunicar los servicios entre sí. REST sobre HTTP/JSON es la respuesta habitual, y tiene sentido: es ubicuo, legible, fácil de depurar con cualquier cliente HTTP y prácticamente universal. Sin embargo, REST tiene costes que en sistemas de alta escala o en comunicación interna entre servicios pueden volverse relevantes: la serialización y deserialización de JSON es costosa en CPU, los mensajes son verbosos y HTTP/1.1 no fue diseñado para el modelo de comunicación bidireccional y de alta frecuencia que muchos sistemas modernos necesitan.

**gRPC** es el framework de Remote Procedure Call (RPC) de Google, publicado como open source en 2016. Resuelve exactamente esos problemas: usa HTTP/2 como transporte, **Protocol Buffers** como formato de serialización binaria, y genera código cliente y servidor en múltiples lenguajes a partir de una única definición de interfaz. El resultado es una comunicación entre servicios más rápida, más compacta y fuertemente tipada.

## Protocol Buffers: el lenguaje de definición de interfaces

Antes de entrar en gRPC, hay que entender Protocol Buffers (Protobuf), porque son la pieza central que hace posible todo lo demás.

Protobuf es un lenguaje de definición de interfaces (IDL, Interface Definition Language) y un formato de serialización binaria. La idea es simple: defines la estructura de tus mensajes y servicios en un archivo `.proto`, y el compilador `protoc` genera código en el lenguaje de tu elección —Java, Python, Go, C++, Rust, entre otros— que implementa la serialización, la deserialización y los stubs de cliente y servidor.

```proto
syntax = "proto3";

package inventario;

option java_package = "com.ejemplo.inventario";
option java_outer_classname = "InventarioProto";

// Mensaje para representar un producto
message Producto {
  string id = 1;
  string nombre = 2;
  double precio = 3;
  int32 stock = 4;
  repeated string etiquetas = 5;
}

// Mensaje de solicitud para buscar productos
message BusquedaRequest {
  string termino = 1;
  int32 limite = 2;
}

// Mensaje de respuesta con lista de productos
message BusquedaResponse {
  repeated Producto productos = 1;
  int32 total = 2;
}
```

Cada campo tiene un nombre, un tipo y un **número de campo** (el `= 1`, `= 2`, etc.). Ese número es lo que Protobuf usa en la codificación binaria para identificar el campo, no el nombre. Esto tiene una implicación importante para la compatibilidad hacia atrás: si añades campos nuevos con números nuevos o eliminas campos existentes, el sistema sigue siendo compatible. Si cambias el número de un campo existente, rompes la compatibilidad binaria.

La diferencia de tamaño respecto a JSON es significativa. Un mensaje JSON que ocupa 200 bytes puede representarse en Protobuf en 50-80 bytes. Esto no solo reduce el ancho de banda: la serialización binaria es mucho más rápida que el parseo de texto JSON, lo que en sistemas con millones de mensajes por segundo se traduce en menos CPU y menor latencia.

## Definición de servicios en gRPC

La definición de servicios en gRPC se hace también en el archivo `.proto`, añadiendo un bloque `service`:

```proto
syntax = "proto3";

package inventario;

import "google/protobuf/empty.proto";

service InventarioService {
  // Llamada unaria: una petición, una respuesta
  rpc BuscarProductos(BusquedaRequest) returns (BusquedaResponse);

  // Server streaming: una petición, múltiples respuestas
  rpc StreamProductosActualizados(FiltroRequest) returns (stream Producto);

  // Client streaming: múltiples peticiones, una respuesta
  rpc ImportarProductos(stream Producto) returns (ImportacionResponse);

  // Bidirectional streaming: múltiples peticiones y respuestas
  rpc SincronizarInventario(stream SincronRequest) returns (stream SincronResponse);
}

message FiltroRequest {
  string categoria = 1;
}

message ImportacionResponse {
  int32 importados = 1;
  int32 errores = 2;
}

message SincronRequest {
  string producto_id = 1;
  int32 delta_stock = 2;
}

message SincronResponse {
  string producto_id = 1;
  int32 stock_actual = 2;
  bool ok = 3;
}
```

Una vez ejecutado `protoc` con el plugin de gRPC, el compilador genera el código boilerplate: las clases de los mensajes con sus métodos de serialización, y los stubs del servicio —el código que el servidor debe implementar y el cliente puede usar. El desarrollador solo escribe la lógica de negocio real.

## Los cuatro tipos de comunicación

Esta es una de las diferencias más importantes de gRPC respecto a REST: soporta cuatro modos de comunicación distintos, todos sobre la misma conexión HTTP/2.

Los siguientes ejemplos usan Spring Boot con `grpc-spring-boot-starter`, que integra los stubs generados por Protobuf en el ciclo de vida de Spring mediante la anotación `@GrpcClient`.

### Llamada unaria

El modelo clásico: el cliente envía una petición, el servidor procesa y devuelve una respuesta. Es el equivalente directo de una llamada a API REST.

```java
@Service
public class InventarioClientService {

    @GrpcClient("inventario-service")
    private InventarioServiceGrpc.InventarioServiceBlockingStub stub;

    public List<Producto> buscarProductos(String termino) {
        BusquedaRequest request = BusquedaRequest.newBuilder()
                .setTermino(termino)
                .setLimite(20)
                .build();

        BusquedaResponse response = stub.buscarProductos(request);
        return response.getProductosList();
    }
}
```

### Server streaming

El cliente envía una petición y el servidor devuelve un flujo de respuestas. Útil para suscripciones a eventos, transferencia de grandes volúmenes de datos, o notificaciones en tiempo real.

```java
@Service
public class InventarioClientService {

    private static final Logger log = LoggerFactory.getLogger(InventarioClientService.class);

    @GrpcClient("inventario-service")
    private InventarioServiceGrpc.InventarioServiceBlockingStub stub;

    public void escucharActualizaciones(String categoria) {
        FiltroRequest request = FiltroRequest.newBuilder()
                .setCategoria(categoria)
                .build();

        // El servidor va enviando productos uno a uno
        Iterator<Producto> productos = stub.streamProductosActualizados(request);
        productos.forEachRemaining(producto ->
                log.info("Actualización: {} → stock {}", producto.getNombre(), producto.getStock()));
    }
}
```

### Client streaming

El cliente envía múltiples mensajes en un flujo y el servidor responde una sola vez al finalizar. El caso típico es la carga masiva de datos. A diferencia del stub bloqueante, el client streaming requiere el stub asíncrono y un `StreamObserver`.

```java
@Service
public class InventarioClientService {

    private static final Logger log = LoggerFactory.getLogger(InventarioClientService.class);

    @GrpcClient("inventario-service")
    private InventarioServiceGrpc.InventarioServiceStub asyncStub;

    public void importarProductos(List<Producto> productos) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(1);

        StreamObserver<ImportacionResponse> responseObserver = new StreamObserver<>() {
            @Override
            public void onNext(ImportacionResponse response) {
                log.info("Importados: {}, errores: {}", response.getImportados(), response.getErrores());
            }

            @Override
            public void onError(Throwable t) {
                log.error("Error al importar productos", t);
                latch.countDown();
            }

            @Override
            public void onCompleted() {
                latch.countDown();
            }
        };

        StreamObserver<Producto> requestObserver = asyncStub.importarProductos(responseObserver);

        productos.forEach(requestObserver::onNext);

        requestObserver.onCompleted();
        latch.await();
    }
}
```

### Streaming bidireccional

Ambos extremos envían flujos de mensajes de forma independiente. Es el modo más potente y también el más complejo: permite implementar protocolos conversacionales, sincronización de estado en tiempo real, o cualquier caso donde el cliente y el servidor necesiten intercambiar mensajes de forma asíncrona.

Este modo es donde gRPC supera claramente a REST y WebSockets para la comunicación entre servicios: HTTP/2 multiplexing permite múltiples streams bidireccionales sobre una sola conexión TCP, con control de flujo y priorización integrados.

## HTTP/2 como ventaja estructural

La elección de HTTP/2 como transporte no es un detalle de implementación; es lo que hace posibles los cuatro modos de comunicación y gran parte de las ventajas de rendimiento de gRPC.

HTTP/1.1 es un protocolo de petición-respuesta serial: cada conexión solo puede manejar una solicitud a la vez (salvo con pipelining, que tiene problemas de bloqueo). Para lograr paralelismo, los clientes HTTP/1.1 abren múltiples conexiones TCP, lo que añade latencia y sobrecarga.

HTTP/2 introduce el concepto de **streams multiplexados**: múltiples peticiones y respuestas independientes pueden viajar sobre la misma conexión TCP simultáneamente, sin bloquearse entre sí. Además, comprime las cabeceras (HPACK) y permite al servidor hacer push de recursos al cliente sin que este los haya solicitado. Para la comunicación entre microservicios, esto significa que una sola conexión persistente puede manejar cientos de llamadas concurrentes, eliminando la latencia de establecimiento de conexión en cada llamada.

```
HTTP/1.1 (múltiples conexiones TCP):
  Cliente → [TCP conn 1] → Servidor: GET /productos
  Cliente → [TCP conn 2] → Servidor: GET /inventario
  Cliente → [TCP conn 3] → Servidor: POST /pedido

gRPC/HTTP/2 (una sola conexión, múltiples streams):
  Cliente → [TCP conn] → Servidor
              ├── Stream 1: BuscarProductos
              ├── Stream 2: ObtenerInventario
              └── Stream 3: CrearPedido
```

## gRPC vs REST: cuándo usar cada uno

La pregunta no es cuál es mejor en términos absolutos, sino cuál encaja mejor según el contexto.

**gRPC es la mejor opción** cuando la comunicación es entre servicios internos y la eficiencia importa: payloads compactos, baja latencia, alta frecuencia de llamadas. También cuando se necesita streaming bidireccional genuino —para chat, sincronización de estado, telemetría en tiempo real— o cuando el contrato entre servicios debe ser fuertemente tipado y generado de forma automática para evitar discrepancias.

La generación de código a partir del `.proto` es una ventaja para equipos grandes o entornos poliglotas: el contrato es la fuente de verdad, y cualquier cambio en él obliga a regenerar y recompilar los clientes, lo que detecta incompatibilidades en tiempo de compilación en lugar de en producción.

**REST sigue siendo la mejor opción** para APIs públicas expuestas a clientes externos: navegadores, aplicaciones móviles o terceros que no controlas. La razón es pragmática: cualquier herramienta puede consumir una API REST con HTTP y JSON. gRPC requiere que el cliente entienda el protocolo y tenga acceso al archivo `.proto` o al registro de esquemas. Aunque gRPC-Web extiende gRPC parcialmente a navegadores, sigue siendo más complejo que REST para ese caso de uso.

REST también gana en depuración y observabilidad básica: cualquier herramienta —curl, Postman, un navegador— puede inspeccionar mensajes JSON. Los mensajes Protobuf binarios requieren herramientas específicas como `grpc_cli` o Postman con soporte gRPC para leerlos.

En la práctica, muchas arquitecturas usan ambos: REST en el edge (la frontera con clientes externos y el API Gateway) y gRPC para la comunicación interna entre microservicios.

```
┌──────────────────────────────────────────────────────────┐
│                     Clientes externos                     │
│         (navegador, móvil, partners, terceros)           │
└─────────────────────────┬────────────────────────────────┘
                          │ REST / HTTP/JSON
                ┌─────────▼─────────┐
                │    API Gateway     │
                └──┬─────┬──────┬───┘
                   │     │      │
              gRPC │  gRPC    gRPC
                   │     │      │
          ┌────────▼─┐ ┌─▼──────┐ ┌▼─────────┐
          │ Servicio │ │Servicio│ │ Servicio  │
          │  Pedidos │ │Catalog │ │Inventario │
          └──────────┘ └────────┘ └──────────┘
```

## Observabilidad y depuración

El precio de la eficiencia binaria es que los mensajes no son legibles directamente. La solución estándar es usar **interceptores** de gRPC para añadir logging, métricas y trazabilidad distribuida de forma transversal, sin mezclarlos con la lógica del servicio. Con `grpc-spring-boot-starter`, la anotación `@GrpcGlobalServerInterceptor` registra el interceptor automáticamente en todos los servicios expuestos.

```java
@Slf4j
@GrpcGlobalServerInterceptor
public class LoggingInterceptor implements ServerInterceptor {

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        long start = System.currentTimeMillis();
        String method = call.getMethodDescriptor().getFullMethodName();
        log.info("[gRPC] Llamada recibida: {}", method);

        ServerCall<ReqT, RespT> wrappedCall = new ForwardingServerCall.SimpleForwardingServerCall<>(call) {
            @Override
            public void close(Status status, Metadata trailers) {
                long elapsed = System.currentTimeMillis() - start;
                if (status.isOk()) {
                    log.info("[gRPC] {} completado en {}ms", method, elapsed);
                } else {
                    log.warn("[gRPC] {} falló: {}", method, status.getDescription());
                }
                super.close(status, trailers);
            }
        };

        return next.startCall(wrappedCall, headers);
    }
}
```

Para trazabilidad distribuida, los interceptores de gRPC pueden propagar contexto de OpenTelemetry o W3C TraceContext como metadata en las cabeceras de la llamada, de la misma forma que los filtros HTTP en REST propagan cabeceras de trazabilidad.

## El contrato como fuente de verdad

Uno de los beneficios más subestimados de gRPC es lo que ocurre cuando el contrato cambia. Con REST y JSON, un campo añadido o renombrado puede pasar desapercibido en los tests y manifestarse en producción. Con gRPC, cualquier cambio incompatible en el `.proto` hace que el código que depende del campo antiguo no compile.

La práctica recomendada es versionar los servicios en el nombre del paquete del `.proto` y gestionar los archivos `.proto` en un repositorio compartido o en un schema registry. Equipos con muchos servicios usan herramientas como **Buf** para validar automáticamente la compatibilidad hacia atrás de los cambios en los archivos `.proto` y evitar roturas accidentales.

```bash
# Buf verifica que los cambios en el .proto no rompan la compatibilidad
buf breaking --against '.git#branch=main'
```

Este nivel de disciplina en el contrato, combinado con la generación de código, convierte gRPC en una herramienta especialmente adecuada para organizaciones con muchos equipos trabajando sobre los mismos servicios.

## Por dónde empezar

Si ya tienes una arquitectura de microservicios basada en REST y quieres evaluar gRPC, el mejor punto de partida no es migrar todo a la vez. Elige un par de servicios internos que se comuniquen frecuentemente y que tengan payloads relativamente bien definidos. Implementa el servicio gRPC en paralelo al REST, mide la latencia y el consumo de recursos, y decide si el resultado justifica la migración.

La curva de aprendizaje de gRPC está principalmente en Protobuf y en el toolchain de generación de código, no en el framework en sí. Una vez que el pipeline de compilación está configurado y el primer servicio está funcionando, añadir nuevos métodos o mensajes es rápido y natural.

gRPC no reemplaza a REST en todos los contextos, pero para la comunicación interna en sistemas distribuidos de alta escala es difícil ignorar las ventajas: eficiencia de serialización, HTTP/2 multiplexado, streaming nativo y contratos fuertemente tipados generados automáticamente. Cuando REST empieza a mostrar su coste en latencia o en ancho de banda, gRPC suele ser la siguiente conversación.
