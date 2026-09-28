---
titulo: "Backend for Frontend (BFF): un backend a la medida de cada cliente"
seoTitulo: "Backend for Frontend (BFF) Pattern: qué es, cuándo usarlo y cómo implementarlo"
fecha: "2026-09-29"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Qué es el patrón Backend for Frontend (BFF), por qué surge cuando web, móvil y partners consumen la misma API de microservicios, en qué se diferencia de un API Gateway genérico y cómo implementarlo con ejemplos prácticos."
imagenPortada: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Microservices", "API Design", "BFF Pattern", "Best Practices"]
categoria: "tech"
keywords: "backend for frontend, bff pattern, api gateway vs bff, arquitectura microservicios, mobile backend, agregación de apis, graphql bff, spring boot bff, netflix bff, sam newman, over-fetching, under-fetching"
---

# Backend for Frontend (BFF): un backend a la medida de cada cliente

Un equipo que construye una API de microservicios suele empezar con una premisa razonable: exponer una sola capa de API, genérica y reutilizable, que sirva tanto a la aplicación web como a la app móvil como a los partners externos. Es una decisión que parece maximizar el reuso. En la práctica, a medida que la web necesita listados densos con diez campos por fila y la app móvil necesita respuestas mínimas para no gastar batería ni datos del usuario, esa API única empieza a acumular parámetros condicionales, flags de "modo móvil" y endpoints que nadie recuerda para quién se diseñaron originalmente.

El **patrón Backend for Frontend (BFF)**, popularizado por Sam Newman a partir de la experiencia de SoundCloud, propone lo contrario: en vez de una API genérica que intenta servir a todos los clientes, cada tipo de cliente —web, iOS, Android, un partner externo— tiene su propia capa de backend, diseñada exclusivamente para las necesidades de ese cliente. La lógica de negocio sigue viviendo en los microservicios; el BFF solo se encarga de darle a cada cliente exactamente la forma de datos que necesita.

## El problema: una API, demasiados clientes

Imagina un sistema de streaming con tres servicios de dominio: `CatalogService`, `UserService` y `RecommendationService`. La pantalla de inicio de la app móvil necesita, para cada elemento del catálogo, el título, la miniatura y si el usuario ya lo empezó a ver. La pantalla equivalente en la web necesita además la sinopsis completa, el reparto, valoraciones y contenido relacionado, porque hay más espacio en pantalla y el usuario espera más contexto antes de hacer clic.

Si existe una única API compartida, hay dos caminos, y ambos son malos:

**Sobre-fetching (over-fetching):** la API siempre devuelve el payload completo —sinopsis, reparto, valoraciones incluidos— y el cliente móvil descarta lo que no necesita. En una red 4G con datos limitados, esto se traduce en tiempos de carga más largos y consumo de batería innecesario para procesar y descartar JSON que nunca se muestra.

**Bajo-fetching (under-fetching):** la API devuelve solo lo mínimo, y el cliente web tiene que hacer varias llamadas adicionales —una para el reparto, otra para las valoraciones, otra para contenido relacionado— para ensamblar la pantalla completa. Esto multiplica el número de round-trips y empeora la latencia percibida, especialmente en conexiones con alta variabilidad.

La respuesta habitual a este problema es meter parámetros condicionales en la API compartida: `?fields=basic`, `?platform=mobile`, `?include=synopsis,cast,ratings`. Funciona durante un tiempo, pero el endpoint se convierte en un árbol de decisiones difícil de testear, y cada cliente nuevo —una smart TV, un asistente de voz— añade otra rama condicional. El acoplamiento no desaparece: simplemente se traslada del código del cliente al código del servidor compartido, donde es más difícil de razonar porque mezcla las necesidades de audiencias completamente distintas.

## Qué es un BFF

Un BFF es una capa de backend delgada, propiedad del equipo que construye el cliente correspondiente, que se sitúa entre ese cliente y los microservicios de dominio. Su responsabilidad no es contener lógica de negocio —esa sigue viviendo en `CatalogService`, `UserService` y `RecommendationService`— sino **agregar, transformar y dar forma** a los datos de esos servicios exactamente como los necesita su cliente.

![Cliente Web y Cliente Móvil, cada uno con su propio BFF, consumiendo los mismos servicios de Catálogo, Usuarios y Recomendaciones](/diagrams/2026/09/backend-for-frontend-bff/bff-topologia.png)

Con este diseño, `BFF-Web` puede hacer tres llamadas en paralelo a `CatalogService`, `UserService` y `RecommendationService`, combinar las respuestas en un único payload rico pensado para la pantalla de inicio web, y devolverlo en una sola llamada HTTP. `BFF-Móvil` hace exactamente lo mismo, pero solicita menos campos a cada servicio y descarta todo lo que la app móvil no va a renderizar. Ninguno de los dos backends "sabe" nada del otro cliente; cada equipo evoluciona el suyo a su propio ritmo.

## BFF no es lo mismo que un API Gateway

Es fácil confundir un BFF con un API Gateway genérico —del que ya hablamos en el artículo sobre el [Strangler Fig Pattern](/2026/07/strangler-fig-pattern)— porque ambos se sitúan entre los clientes y los servicios internos. La diferencia está en la propiedad y el propósito:

Un **API Gateway** es una pieza de infraestructura compartida, propiedad del equipo de plataforma, cuya responsabilidad es transversal a todos los clientes: enrutamiento, autenticación, rate limiting, terminación TLS, logging centralizado. No conoce las particularidades de ningún cliente en concreto; trata a la app web y a la app móvil de forma idéntica.

Un **BFF** es específico de un cliente, propiedad del equipo que construye ese cliente, y su responsabilidad es funcional: agregar datos de varios servicios, transformarlos, adaptarlos al modelo de vista de una pantalla concreta. Un BFF conoce íntimamente las necesidades de su cliente porque lo diseñó el mismo equipo.

En arquitecturas maduras, ambos coexisten: el API Gateway está delante de todo el tráfico y resuelve las preocupaciones transversales; cada BFF vive detrás del gateway y resuelve las preocupaciones específicas de su cliente.

![Cliente Web y Cliente Móvil pasan primero por el API Gateway (auth, rate limiting, TLS) y luego se bifurcan hacia BFF Web y BFF Móvil, que convergen en los microservicios de dominio](/diagrams/2026/09/backend-for-frontend-bff/bff-gateway-layering.png)

## Quién es dueño del BFF

Una decisión de diseño clave es qué equipo mantiene cada BFF. La recomendación de Newman, y la que mejor funciona en la práctica, es que **el mismo equipo que construye el cliente sea dueño de su BFF**. El equipo de la app móvil no solo escribe Kotlin y Swift; también escribe y despliega `BFF-Móvil`. Esto elimina el cuello de botella clásico donde el equipo de frontend depende de un equipo de backend compartido para añadir un campo nuevo a una respuesta.

Esta propiedad conjunta tiene una consecuencia importante: el BFF no necesita ser "elegante" desde el punto de vista de un backend puro. Puede tener endpoints muy específicos, con nombres como `GET /home-screen` o `GET /checkout-summary`, que no pretenden ser recursos RESTful genéricos sino que representan exactamente una pantalla o un flujo de la aplicación cliente. Esta especificidad es una característica, no un defecto: es lo que hace que el cliente pueda hacer una sola llamada y recibir exactamente lo que va a renderizar.

## Implementación con Spring Boot

Veamos cómo se vería `BFF-Móvil` para la pantalla de inicio del ejemplo anterior, agregando datos de tres servicios de dominio con llamadas en paralelo:

```java
@RestController
@RequestMapping("/mobile-bff")
public class MobileHomeController {

    private final CatalogClient catalogClient;
    private final UserClient userClient;
    private final RecommendationClient recommendationClient;

    public MobileHomeController(CatalogClient catalogClient,
                                 UserClient userClient,
                                 RecommendationClient recommendationClient) {
        this.catalogClient = catalogClient;
        this.userClient = userClient;
        this.recommendationClient = recommendationClient;
    }

    @GetMapping("/home")
    public MobileHomeResponse getHome(@RequestHeader("X-User-Id") String userId) {

        CompletableFuture<List<CatalogItem>> catalogFuture =
                CompletableFuture.supplyAsync(() -> catalogClient.getFeatured());

        CompletableFuture<UserProfile> profileFuture =
                CompletableFuture.supplyAsync(() -> userClient.getProfile(userId));

        CompletableFuture<List<String>> recommendedIdsFuture =
                CompletableFuture.supplyAsync(() -> recommendationClient.getForUser(userId));

        CompletableFuture.allOf(catalogFuture, profileFuture, recommendedIdsFuture).join();

        return MobileHomeResponse.builder()
                .items(toMobileCards(catalogFuture.join(), profileFuture.join()))
                .recommendedIds(recommendedIdsFuture.join())
                .build();
    }

    private List<MobileCard> toMobileCards(List<CatalogItem> items, UserProfile profile) {
        // Solo título, miniatura y progreso de visionado: nada de sinopsis,
        // reparto ni valoraciones, que el cliente móvil no muestra en esta pantalla.
        return items.stream()
                .map(item -> new MobileCard(
                        item.getId(),
                        item.getTitle(),
                        item.getThumbnailUrl(),
                        profile.getWatchProgressFor(item.getId())))
                .toList();
    }
}
```

El `BFF-Web` equivalente llamaría a los mismos tres servicios pero construiría un `WebHomeResponse` con sinopsis, reparto y contenido relacionado incluidos, porque la pantalla web tiene espacio y presupuesto de red para mostrarlo. Ambos BFF son proyectos Spring Boot independientes, desplegables por separado, cada uno con su propio ciclo de release.

## GraphQL como alternativa dentro del BFF

Una variante cada vez más común es que el BFF no exponga REST sino un endpoint **GraphQL**, del que hablamos con más detalle en el artículo sobre [Spring GraphQL](/2026/09/spring-graphql). En lugar de que el equipo de backend anticipe cada combinación de campos que un cliente pueda necesitar, el cliente declara exactamente qué campos quiere en la query, y el resolver del BFF se encarga de ir a buscar esos campos a los servicios de dominio correspondientes.

Esto reduce aún más el over-fetching y el under-fetching, porque la forma de la respuesta ya no la decide el backend de antemano: la decide la query que envía el cliente en cada petición. El trade-off es que GraphQL introduce su propia complejidad operativa —resolución N+1, control de profundidad de queries, caching menos trivial que con HTTP— que conviene sopesar frente a la simplicidad de un BFF REST con endpoints fijos por pantalla.

## Riesgos y contrapartidas

El BFF no es gratis. Introducirlo cambia varios aspectos del sistema que conviene tener en cuenta antes de adoptarlo:

**Duplicación de código entre BFFs.** Si `BFF-Web` y `BFF-Móvil` agregan datos de los mismos tres servicios, es probable que compartan buena parte de la lógica de orquestación. La forma correcta de resolver esto no es fusionar los BFF de nuevo —eso reintroduce el problema original— sino extraer esa lógica común a una librería compartida o a un servicio de agregación interno que ambos BFF consuman.

**Más servicios que desplegar y monitorizar.** Cada BFF es un despliegue adicional, con su propio pipeline de CI/CD, sus propias métricas y sus propias alertas. En un sistema con cinco tipos de cliente, eso son cinco servicios más que operar. Para equipos pequeños, esta sobrecarga operativa puede no compensar el beneficio si el número de clientes distintos es bajo.

**Riesgo de fuga de lógica de negocio.** La tentación de meter reglas de negocio directamente en el BFF —porque "es más rápido" que tocar el microservicio de dominio— es real y constante. Si no se vigila, el BFF deja de ser una capa de agregación y se convierte en un segundo lugar donde vive la misma lógica de negocio, con el riesgo de que ambas copias diverjan.

**Latencia añadida por un salto de red extra.** El cliente ya no habla directamente con los microservicios; habla con el BFF, que a su vez habla con los microservicios. Si el BFF hace sus llamadas de forma secuencial en lugar de paralela, la latencia percibida por el cliente puede empeorar en lugar de mejorar.

## Cuándo usar el patrón BFF

El BFF tiene sentido cuando:

- Existen dos o más tipos de cliente (web, móvil, partners) con necesidades de datos claramente distintas.
- Los equipos de frontend y backend están organizados de forma que cada equipo de cliente puede razonablemente mantener su propio BFF.
- El over-fetching o under-fetching de una API compartida ya es un problema medible: tiempos de carga móviles altos, o llamadas múltiples desde la web para ensamblar una sola pantalla.
- Los distintos clientes necesitan evolucionar a ritmos diferentes sin bloquearse mutuamente en el mismo endpoint compartido.

No conviene adoptarlo cuando:

- Solo existe un tipo de cliente, o todos los clientes consumen prácticamente los mismos datos con la misma forma.
- El equipo es demasiado pequeño para mantener servicios adicionales sin que se conviertan en deuda técnica abandonada.
- El problema real es la falta de un API Gateway para preocupaciones transversales (auth, rate limiting), no la forma de los datos — en ese caso, un Gateway genérico resuelve el problema sin la complejidad adicional de un backend por cliente.

## Buenas prácticas

**Mantén el BFF sin estado y sin lógica de negocio.** Su trabajo es agregar y transformar, no decidir. Las reglas de negocio —qué constituye un pedido válido, cómo se calcula un descuento— pertenecen a los microservicios de dominio.

**Haz las llamadas a servicios downstream en paralelo.** Como en el ejemplo con `CompletableFuture`, si el BFF necesita datos de tres servicios independientes, pedirlos de forma secuencial multiplica la latencia por el número de llamadas. Pedirlos en paralelo la limita a la más lenta de las tres.

**Aplica resiliencia igual que en cualquier otro cliente de servicios.** Un BFF que llama a tres servicios downstream necesita los mismos patrones de timeout, retry y circuit breaking que cubrimos en el artículo sobre [Spring Cloud Circuit Breaker con Resilience4j](/2026/07/spring-circuit-breaker-resilience4j). Si `RecommendationService` está caído, el BFF debería poder devolver la pantalla de inicio sin recomendaciones en lugar de fallar por completo.

**Versiona el BFF junto con su cliente, no por separado.** Como el BFF existe exclusivamente para un cliente, tiene sentido que ambos evolucionen y se desplieguen de forma coordinada, en lugar de tratar al BFF como una API pública con su propio ciclo de versionado independiente.

**No repliques el BFF para cada micro-variación de cliente.** Un BFF por plataforma (web, iOS, Android) suele ser el nivel de granularidad correcto. Crear un BFF distinto para cada versión de la app o cada región geográfica normalmente añade más complejidad operativa de la que resuelve.

## Conclusión

El patrón Backend for Frontend nace de aceptar una realidad incómoda: distintos clientes tienen necesidades de datos genuinamente distintas, y forzarlos a compartir una única API genérica traslada esa diferencia a parámetros condicionales y ramas de código difíciles de mantener. Un BFF por cliente, mantenido por el mismo equipo que construye ese cliente, permite que cada capa de presentación reciba exactamente los datos que necesita, con la forma que necesita, sin negociar con las necesidades de los demás clientes.

La contrapartida es operativa: más servicios que desplegar, cierta duplicación de lógica de agregación entre BFFs, y la disciplina constante de no dejar que la lógica de negocio se filtre desde los microservicios de dominio hacia la capa de agregación. Para sistemas con un único tipo de cliente, esa contrapartida rara vez compensa. Para sistemas con web, móvil y partners consumiendo la misma plataforma de microservicios, el BFF suele ser la diferencia entre una API que todos odian mantener y tres backends pequeños que cada equipo entiende y controla.
