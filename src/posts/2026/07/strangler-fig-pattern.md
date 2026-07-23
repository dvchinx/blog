---
titulo: "Strangler Fig Pattern: migrando monolitos a microservicios sin reescribir todo"
seoTitulo: "Strangler Fig Pattern: cómo migrar un monolito a microservicios de forma incremental y segura"
fecha: "2026-07-24"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende cómo el patrón Strangler Fig permite migrar un monolito legado a microservicios de forma gradual, sin reescrituras totales ni interrupciones del servicio, con ejemplos prácticos y estrategias de enrutamiento."
imagenPortada: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Microservices", "Migration", "Strangler Fig", "Best Practices"]
categoria: "tech"
keywords: "strangler fig pattern, migración monolito microservicios, strangler fig, refactoring incremental, modernización de aplicaciones, migración gradual, API gateway, enrutamiento, legacy systems, Martin Fowler, arquitectura software"
---

# Strangler Fig Pattern: migrando monolitos a microservicios sin reescribir todo

La deuda técnica acumulada en un sistema legado llega a un punto en que el equipo empieza a hablar de "reescribirlo todo desde cero". Es una conversación seductora: imaginar un sistema limpio, sin el peso de decisiones antiguas, con la tecnología correcta. En la práctica, esa reescritura total es una de las apuestas más arriesgadas que puede hacer una organización. Años de lógica de negocio implícita, casos borde acumulados, integraciones no documentadas y comportamientos sutiles que nadie recuerda por qué existen — todo eso puede perderse en el proceso.

El **Strangler Fig Pattern** propone una estrategia diferente: migrar el sistema legado de forma **incremental**, pieza por pieza, hasta que el nuevo sistema ha sustituido completamente al antiguo sin que el usuario haya notado ninguna interrupción. El nombre viene de la higuera estranguladora (*Ficus aurea*), una planta tropical que crece sobre un árbol huésped, lo envuelve lentamente durante años y eventualmente lo reemplaza cuando el árbol original muere. El nuevo sistema crece alrededor del legado hasta reemplazarlo.

Martin Fowler describió este patrón en 2004, pero su relevancia ha crecido enormemente en la era de los microservicios, donde el camino más común no es construir microservicios desde cero sino extraerlos de monolitos existentes.

## El problema que resuelve

Imagina una aplicación de comercio electrónico construida hace ocho años como un monolito. Gestiona pedidos, inventario, usuarios, pagos y logística en un único proceso desplegable. Con el tiempo, el equipo ha crecido, el código se ha enredado y cada cambio en una parte del sistema crea efectos inesperados en otras. Desplegar un cambio pequeño requiere testear el sistema completo.

La organización quiere migrar a microservicios, pero el monolito procesa decenas de miles de pedidos al día. Apagarlo por semanas para reescribirlo no es una opción. Tampoco lo es mantener dos sistemas completos en paralelo indefinidamente.

El Strangler Fig Pattern resuelve esto definiendo una forma de coexistencia controlada: el monolito sigue funcionando, pero gradualmente va cediendo responsabilidades al nuevo sistema de microservicios, hasta que ya no es necesario.

## Los tres pasos del patrón

### 1. Identificar y aislar

El primer paso es identificar qué parte del sistema vas a extraer primero. No es arbitrario: hay criterios que hacen a un módulo mejor candidato para ser el primero en migrarse.

Los mejores candidatos iniciales son:
- Funcionalidades con **límites claros** y poca dependencia de otros módulos del monolito.
- Funcionalidades que **cambian con frecuencia** y donde la deuda técnica es más dolorosa.
- Funcionalidades con **carga de tráfico predecible** y baja complejidad de estado.
- Módulos que el negocio quiere **escalar independientemente**.

Los peores candidatos iniciales son módulos con muchas dependencias bidireccionales al resto del sistema, lógica compartida con difíciles de desacoplar, o estado compartido que sería costoso sincronizar.

La elección del primer módulo importa mucho: si la primera migración es un desastre, el equipo perderá confianza en la estrategia. Si es un éxito, establece el patrón y la confianza para continuar.

### 2. Interceptar el tráfico con una fachada

Una vez elegido el módulo, se introduce una **fachada** — normalmente un API Gateway o un proxy inverso — que se sitúa delante del monolito y del nuevo servicio. En este punto, el 100 % del tráfico sigue pasando al monolito; la fachada es transparente.

```
  Cliente
     |
     ▼
┌─────────┐
│  Proxy  │
└────┬────┘
     |
     ▼
┌──────────┐
│ Monolito │  ← todo el tráfico
└──────────┘
```

La fachada es el punto de control que permite redirigir tráfico sin que el cliente lo note. Su rol es enrutar peticiones basándose en rutas, cabeceras, o cualquier criterio que el equipo defina.

### 3. Migrar y redirigir gradualmente

Con la fachada en su lugar, el equipo construye el nuevo servicio. Cuando está listo y testeado, la fachada empieza a dirigir tráfico al nuevo servicio en lugar del monolito para ese módulo específico:

```
  Cliente
     |
     ▼
┌──────────────┐
│    Proxy     │
└──┬───────┬───┘
   |       |
   ▼       ▼
┌─────┐  ┌────────────────┐
│ Mon.│  │ Nuevo servicio │
└─────┘  └────────────────┘
    ↑           ↑
 resto      módulo migrado
```

El monolito sigue recibiendo el tráfico de los módulos no migrados. El nuevo servicio recibe solo el tráfico del módulo que acaba de migrar. Este proceso se repite módulo por módulo.

Con el tiempo, el monolito va encogiendo hasta que ya no tiene responsabilidades activas y puede ser apagado definitivamente:

```
  Cliente
     |
     ▼
┌──────────────┐
│    Proxy     │
└──┬───────┬───┘
   |       |
   ▼       ▼
┌────────┐ ┌────────────────┐
│Serv. A │ │    Serv. B     │
└────────┘ └────────────────┘
        (monolito retirado)
```

## Implementación práctica

### La fachada: opciones de implementación

La elección de la fachada depende de la infraestructura existente y la complejidad de enrutamiento necesaria.

**Nginx como proxy inverso simple**

Para enrutamientos basados en rutas URL, Nginx es suficiente y muy eficiente:

```nginx
server {
    listen 80;

    # El nuevo servicio de usuarios maneja /api/users
    location /api/users {
        proxy_pass http://user-service:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # El nuevo servicio de inventario maneja /api/inventory
    location /api/inventory {
        proxy_pass http://inventory-service:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Todo lo demás sigue yendo al monolito
    location / {
        proxy_pass http://monolith:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Cada vez que se migra un módulo, se añade una nueva regla `location` en Nginx y el tráfico de esa ruta deja de llegar al monolito.

**Spring Cloud Gateway con enrutamiento dinámico**

Cuando el enrutamiento necesita lógica más sofisticada —cabeceras, predicados personalizados, filtros, transformaciones de request/response— un API Gateway programable como Spring Cloud Gateway ofrece más control:

```java
@Configuration
public class GatewayConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
            // Módulo migrado: usuarios → nuevo servicio
            .route("user-service", r -> r
                .path("/api/users/**")
                .filters(f -> f
                    .stripPrefix(0)
                    .addRequestHeader("X-Migrated", "true"))
                .uri("http://user-service:8080"))

            // Módulo migrado: inventario → nuevo servicio
            .route("inventory-service", r -> r
                .path("/api/inventory/**")
                .uri("http://inventory-service:8081"))

            // Todo lo demás → monolito legado
            .route("monolith", r -> r
                .path("/**")
                .uri("http://monolith:8000"))
            .build();
    }
}
```

### Enrutamiento por feature flag

Una variante muy útil es usar feature flags para controlar qué porcentaje del tráfico va al nuevo servicio. Esto permite hacer un despliegue gradual (10 % del tráfico al nuevo servicio, luego 50 %, luego 100 %) y revertir instantáneamente si se detectan problemas:

```java
@Component
public class RoutingFilter implements GlobalFilter, Ordered {

    private final FeatureFlagService featureFlags;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        if (path.startsWith("/api/orders")) {
            // Usamos el nuevo servicio solo si el feature flag está activo
            // para este request (p. ej. basado en el userId del token)
            String userId = extractUserId(exchange);
            if (featureFlags.isEnabled("new-order-service", userId)) {
                ServerHttpRequest newRequest = exchange.getRequest().mutate()
                    .uri(URI.create("http://order-service:8082" + path))
                    .build();
                return chain.filter(exchange.mutate().request(newRequest).build());
            }
        }

        return chain.filter(exchange);
    }

    @Override
    public int getOrder() {
        return -1; // Ejecutar antes de otros filtros
    }
}
```

### El problema de los datos compartidos

El mayor desafío del Strangler Fig Pattern no suele ser el enrutamiento sino los **datos compartidos**. El monolito tiene una única base de datos donde todos los módulos leen y escriben. Al extraer un módulo como microservicio, ese servicio necesita sus propios datos, pero el monolito puede seguir necesitando acceso a esos mismos datos durante el período de transición.

Existen varias estrategias para gestionar esta coexistencia:

**Base de datos compartida temporalmente**

La estrategia más pragmática a corto plazo: el nuevo servicio y el monolito acceden a la misma base de datos durante la migración. No es ideal desde el punto de vista de la autonomía de los microservicios, pero permite que la migración avance sin resolver todos los problemas de sincronización de datos a la vez.

```
┌────────────────┐     ┌──────────────────┐
│    Monolito    │     │  Nuevo servicio  │
└───────┬────────┘     └────────┬─────────┘
        |                       |
        └──────────┬────────────┘
                   ▼
           ┌───────────────┐
           │  DB compartida│
           └───────────────┘
```

Esta fase debe ser temporal. El objetivo es tener el servicio funcionando en producción para validar el enrutamiento y el comportamiento antes de abordar la separación de datos.

**Sincronización mediante eventos**

Una vez que el nuevo servicio está en producción con la DB compartida, el siguiente paso es crear una base de datos propia para el servicio y sincronizar los datos via eventos:

1. El nuevo servicio escribe en su propia base de datos y publica un evento en un broker (Kafka, RabbitMQ).
2. El monolito consume esos eventos y actualiza su propia base de datos.
3. Durante un período de transición, ambas bases de datos son fuentes de verdad para diferentes consumidores.
4. Cuando el monolito ya no necesita esos datos (porque su módulo correspondiente también ha sido migrado), se corta la sincronización.

**Patrón Branch by Abstraction**

Para el código del monolito que llama al módulo que se está migrando, se puede introducir una abstracción que permita cambiar la implementación sin tocar el código llamador:

```java
// Interfaz compartida
public interface OrderRepository {
    Order findById(String orderId);
    void save(Order order);
}

// Implementación legada (acceso directo a DB monolítica)
@Repository
@ConditionalOnProperty(name = "feature.order-service", havingValue = "false")
public class LegacyOrderRepository implements OrderRepository {
    @Autowired
    private JdbcTemplate jdbc;

    @Override
    public Order findById(String orderId) {
        // consulta directa a la DB del monolito
        return jdbc.queryForObject("SELECT * FROM orders WHERE id = ?",
            this::mapRow, orderId);
    }
}

// Implementación nueva (llamada al microservicio vía HTTP)
@Repository
@ConditionalOnProperty(name = "feature.order-service", havingValue = "true")
public class RemoteOrderRepository implements OrderRepository {
    @Autowired
    private OrderServiceClient orderServiceClient;

    @Override
    public Order findById(String orderId) {
        return orderServiceClient.getOrder(orderId);
    }
}
```

Con esta estructura, cambiar entre la implementación legada y la nueva es tan simple como cambiar un valor de configuración, sin tocar ningún otro código del monolito.

## Gestión del riesgo: pruebas en paralelo

Una técnica valiosa durante la migración es **ejecutar ambas implementaciones en paralelo** y comparar sus resultados. El tráfico real llega al sistema legado (que sigue siendo la fuente de verdad), pero también se envía al nuevo servicio. Si los resultados difieren, se registra la discrepancia y se investiga sin impactar al usuario.

Esta técnica, a veces llamada **shadow mode** o **dark launch**, permite ganar confianza en el nuevo servicio con tráfico de producción real antes de dirigirle tráfico con efecto real:

```java
@Service
public class HybridOrderService {

    private final LegacyOrderService legacy;
    private final NewOrderService newService;
    private final boolean shadowMode;

    public OrderResult processOrder(OrderRequest request) {
        // El legado siempre procesa y devuelve el resultado
        OrderResult legacyResult = legacy.processOrder(request);

        if (shadowMode) {
            // El nuevo servicio también procesa, pero en background
            CompletableFuture.runAsync(() -> {
                try {
                    OrderResult newResult = newService.processOrder(request);
                    if (!legacyResult.equals(newResult)) {
                        log.warn("Divergencia detectada para orderId={}: legacy={}, new={}",
                            request.getOrderId(), legacyResult, newResult);
                        metrics.increment("order.shadow.divergence");
                    }
                } catch (Exception e) {
                    log.error("Error en shadow mode para orderId={}", request.getOrderId(), e);
                    metrics.increment("order.shadow.error");
                }
            });
        }

        return legacyResult;
    }
}
```

## Cuándo no usar este patrón

El Strangler Fig Pattern no es siempre la respuesta correcta. Hay situaciones donde otras estrategias son más adecuadas:

**El sistema legado es tan frágil que añadir una fachada es peligroso.** Si el monolito no tiene tests, los cambios para añadir puntos de integración pueden introducir regresiones graves. En ese caso, puede ser necesario estabilizar el sistema antes de comenzar la migración.

**El sistema es pequeño.** Si el monolito tiene 50.000 líneas de código y un solo equipo, una reescritura controlada puede ser más eficiente que mantener dos sistemas durante un año.

**El negocio no puede tolerar dos sistemas en paralelo.** Mantener el monolito y los microservicios simultáneamente tiene un coste operativo real: dos sistemas que monitorizar, dos pipelines de CI/CD, potenciales inconsistencias de datos durante la transición. Si la organización no tiene capacidad para ese coste, la migración gradual puede prolongarse indefinidamente sin terminar.

**Los dominios del monolito están demasiado entrelazados.** Si extraer cualquier módulo requiere cambiar la mitad del monolito, el coste de la extracción puede superar al de una reescritura dirigida.

## Orden de migración: qué extraer primero

La secuencia de migración importa. Algunas heurísticas útiles:

**Empieza por los módulos más autónomos.** Los candidatos ideales son los que tienen pocas llamadas hacia adentro del monolito y muchas llamadas desde afuera. Los módulos de autenticación/autorización suelen ser buenos candidatos tempranos.

**Sigue por los módulos con mayor necesidad de escalar.** Si el módulo de búsqueda necesita escalar de forma independiente del resto, es un candidato prioritario aunque tenga algunas dependencias internas.

**Deja los módulos más acoplados para el final.** El core del negocio — en un e-commerce, el motor de pedidos — suele ser el más difícil de extraer. Extraerlo cuando ya has ganado experiencia con migraciones más sencillas reduce el riesgo.

**Considera el valor de negocio.** Un módulo que el negocio quiere cambiar frecuentemente es mejor candidato que uno estable que no se modifica desde hace dos años.

## Señales de éxito

A lo largo de la migración, conviene medir algunas métricas que indican si el proceso va en la dirección correcta:

- **Porcentaje de tráfico manejado por el nuevo sistema**: debería crecer consistentemente.
- **Líneas de código activas en el monolito**: debería decrecer con cada módulo migrado.
- **Tiempo de despliegue**: a medida que los microservicios son independientes, los deploys de cada módulo deberían hacerse más cortos y frecuentes.
- **Número de incidentes relacionados con la migración**: debería estabilizarse o decrecer con el tiempo. Un pico sostenido es señal de que el ritmo de migración es demasiado agresivo.

## Conclusión

El Strangler Fig Pattern resuelve uno de los problemas más comunes en la industria del software: qué hacer con un sistema legado que ya no puede evolucionar al ritmo que el negocio requiere. La clave de su éxito está en que no exige una apuesta de todo o nada. En lugar de parar el mundo para reescribir el sistema, permite que el equipo migre gradualmente, aprenda del proceso, valide cada paso con tráfico real y ajuste el rumbo antes de continuar.

La fachada de enrutamiento es el componente central del patrón, pero el trabajo difícil no es técnico sino estratégico: decidir qué extraer primero, gestionar los datos durante la coexistencia y mantener la disciplina para no añadir funcionalidad nueva al monolito una vez que la migración ha comenzado.

La higuera estranguladora no mata al árbol huésped con un golpe. Lo rodea poco a poco, aprovechando su estructura como soporte mientras crece, hasta que el árbol original ya no es necesario. Es exactamente la metáfora correcta para cualquier migración seria de sistemas legados.
