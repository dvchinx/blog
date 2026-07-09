---
titulo: "Spring Cloud Eureka: descubrimiento de servicios"
seoTitulo: "Spring Cloud Eureka: guía de service discovery y registro con Spring Boot"
fecha: "2026-07-10"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a implementar descubrimiento de servicios con Spring Cloud Eureka: configura el Eureka Server, registra microservicios como clientes, implementa balanceo de carga con Spring Cloud LoadBalancer y entiende cómo integrarlo con Spring Cloud Gateway."
imagenPortada: "https://i.imgur.com/Ozk7rO6.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Cloud", "Microservicios", "Java", "Backend", "Eureka"]
categoria: "tech"
keywords: "Spring Cloud Eureka, service discovery, registro de servicios, Eureka Server, Eureka Client, balanceo de carga, Spring Cloud LoadBalancer, microservicios Java, Netflix Eureka, Spring Boot service registry, descubrimiento dinámico"
---

# Spring Cloud Eureka: descubrimiento de servicios en microservicios

En una arquitectura de microservicios, cada servicio necesita comunicarse con otros. El problema es que en un entorno dinámico —donde los servicios escalan horizontal­mente, se reinician o se mueven entre nodos— no puedes codificar direcciones IP fijas. Necesitas un mecanismo que permita a los servicios encontrarse entre sí sin conocer de antemano su ubicación.

Eso es exactamente lo que hace **Spring Cloud Eureka**: proporciona un registro central donde cada servicio publica su nombre y su dirección, y donde cualquier otro servicio puede consultar esa información para establecer comunicación.

## ¿Por qué necesitas un registro de servicios?

Imagina tres instancias del `order-service` arrancando en puertos aleatorios en distintos nodos. El `payment-service` necesita llamar al `order-service`. Sin service discovery, el `payment-service` tendría que conocer de antemano las URLs de las tres instancias, actualizarlas cuando cambian y gestionar él solo el balanceo de carga.

Con Eureka:

1. Cada instancia del `order-service` se registra en Eureka al arrancar.
2. Cuando el `payment-service` necesita llamar al `order-service`, consulta a Eureka y obtiene la lista de instancias disponibles.
3. Spring Cloud LoadBalancer elige una instancia y realiza la llamada.
4. Si una instancia muere, Eureka la elimina del registro tras detectar que dejó de enviar heartbeats.

```
                    ┌─────────────────────┐
                    │    Eureka Server    │
                    │  (Service Registry) │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │ registra           │ consulta            │ registra
          ▼                    ▼                     ▼
  order-service:8081    payment-service:8082   user-service:8083
  order-service:8084    (llama a order-service usando Eureka)
  order-service:8085
```

## Eureka Server: el registro central

El Eureka Server es una aplicación Spring Boot dedicada a mantener el registro de servicios. Lo creas con una dependencia y una anotación.

### Dependencias

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-server</artifactId>
</dependency>
```

Con el BOM de Spring Cloud en `dependencyManagement`:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2023.0.3</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

### Clase principal

Añade `@EnableEurekaServer` a la clase de arranque:

```java
@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
```

### Configuración

```yaml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  client:
    # El servidor no debe registrarse a sí mismo ni buscar otros registros
    register-with-eureka: false
    fetch-registry: false
  server:
    # Tiempo de espera antes de expulsar instancias sin heartbeat (en ms)
    eviction-interval-timer-in-ms: 5000
    # Umbral de renovación para el modo de autopreservación
    renewal-percent-threshold: 0.85
```

Con esto el servidor arranca en el puerto 8761. Puedes abrir `http://localhost:8761` en el navegador para ver el dashboard de Eureka, que muestra todos los servicios registrados y su estado.

### Modo de autopreservación

Eureka entra en **modo de autopreservación** cuando detecta que un número inusualmente alto de instancias ha dejado de enviar heartbeats. En lugar de expulsarlas inmediatamente (asumiendo que podrían ser problemas de red temporales), mantiene las entradas en el registro durante un tiempo adicional.

En desarrollo esto puede resultar confuso porque servicios muertos siguen apareciendo. Puedes desactivarlo en local:

```yaml
eureka:
  server:
    enable-self-preservation: false   # solo para desarrollo
```

En producción es recomendable dejarlo activado para evitar que fluctuaciones de red provoquen la eliminación masiva de instancias válidas.

## Eureka Client: registrar un microservicio

Cada microservicio que quiera participar en el registro —ya sea para publicar su propia dirección o para descubrir otros servicios— necesita la dependencia del cliente.

### Dependencias

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

### Configuración

```yaml
server:
  port: 8081

spring:
  application:
    name: order-service   # nombre con el que se registra en Eureka

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
    # Intervalo de refresco del registro local (por defecto 30 s)
    registry-fetch-interval-seconds: 10
  instance:
    # Intervalo entre heartbeats (por defecto 30 s)
    lease-renewal-interval-in-seconds: 10
    # Tiempo máximo sin heartbeat antes de ser expulsado (por defecto 90 s)
    lease-expiration-duration-in-seconds: 30
    # Usar IP en lugar de hostname (útil en entornos Docker/Kubernetes)
    prefer-ip-address: true
```

Con solo añadir la dependencia y configurar el `defaultZone`, el servicio se registra automáticamente en Eureka al arrancar. No necesitas ninguna anotación adicional en Spring Boot 3.x; `@EnableDiscoveryClient` es opcional y ya está habilitado por defecto cuando la dependencia está en el classpath.

### ¿Qué información publica el cliente?

Al registrarse, el cliente envía:

- **Service ID**: el valor de `spring.application.name` (en mayúsculas en el registro).
- **Instance ID**: identificador único de la instancia (por defecto `hostname:app-name:port`).
- **Host y puerto**: la dirección donde escucha el servicio.
- **URL de health check**: por defecto `/actuator/health` si Actuator está en el classpath.
- **Metadatos**: pares clave-valor personalizados que otros servicios pueden leer.

Puedes personalizar el instance ID para que sea más legible en entornos Docker:

```yaml
eureka:
  instance:
    instance-id: ${spring.application.name}:${random.value}
```

## Llamadas entre servicios con balanceo de carga

Una vez que los servicios están registrados, necesitas un cliente HTTP que consulte Eureka y distribuya las peticiones entre las instancias disponibles.

### Spring Cloud LoadBalancer

Spring Cloud LoadBalancer es el cliente de balanceo de carga recomendado (reemplaza al deprecado Ribbon). Viene incluido en la dependencia de Eureka Client desde Spring Cloud 2020.x en adelante.

Agrega `WebClient` o `RestClient` con soporte de load balancing:

```xml
<!-- Para proyectos reactivos -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>

<!-- LoadBalancer (incluido con eureka-client, pero explícito aquí) -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-loadbalancer</artifactId>
</dependency>
```

### Configurar WebClient con balanceo

```java
@Configuration
public class WebClientConfig {

    @Bean
    @LoadBalanced   // activa la resolución de nombres a través de Eureka
    public WebClient.Builder loadBalancedWebClientBuilder() {
        return WebClient.builder();
    }
}
```

La anotación `@LoadBalanced` intercepta las peticiones y reemplaza el nombre del servicio (por ejemplo `order-service`) con la URL real de una instancia elegida por el LoadBalancer.

### Usar el cliente en un servicio

```java
@Service
public class PaymentService {

    private final WebClient webClient;

    public PaymentService(WebClient.Builder webClientBuilder) {
        // Usar el nombre del servicio tal como aparece en Eureka
        this.webClient = webClientBuilder.baseUrl("http://order-service").build();
    }

    public Mono<OrderDto> getOrder(Long orderId) {
        return webClient
            .get()
            .uri("/orders/{id}", orderId)
            .retrieve()
            .bodyToMono(OrderDto.class);
    }
}
```

Cuando se ejecuta `webClient.get().uri("/orders/123")`, Spring Cloud LoadBalancer consulta el registro de Eureka, obtiene la lista de instancias activas de `order-service` y elige una usando la estrategia configurada (round-robin por defecto). La petición se reenvía a `http://IP:PUERTO/orders/123`.

### RestClient con balanceo (Spring Boot 3.2+)

Si prefieres el cliente síncrono moderno:

```java
@Configuration
public class RestClientConfig {

    @Bean
    @LoadBalanced
    public RestClient.Builder loadBalancedRestClientBuilder() {
        return RestClient.builder();
    }
}
```

```java
@Service
public class PaymentService {

    private final RestClient restClient;

    public PaymentService(RestClient.Builder builder) {
        this.restClient = builder.baseUrl("http://order-service").build();
    }

    public OrderDto getOrder(Long orderId) {
        return restClient
            .get()
            .uri("/orders/{id}", orderId)
            .retrieve()
            .body(OrderDto.class);
    }
}
```

### Cambiar la estrategia de balanceo

Por defecto el LoadBalancer usa **round-robin**. Puedes cambiarlo por **random** de forma global o por servicio:

```java
@Configuration
@LoadBalancerClient(name = "order-service", configuration = RandomLoadBalancerConfig.class)
public class LoadBalancerConfig {}

public class RandomLoadBalancerConfig {

    @Bean
    public ReactorLoadBalancer<ServiceInstance> randomLoadBalancer(
            Environment environment,
            LoadBalancerClientFactory loadBalancerClientFactory) {

        String name = environment.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
        return new RandomLoadBalancer(
            loadBalancerClientFactory.getLazyProvider(name, ServiceInstanceListSupplier.class),
            name
        );
    }
}
```

## Alta disponibilidad: clúster de Eureka

En producción, un solo Eureka Server es un punto único de fallo. La solución es ejecutar múltiples instancias que se repliquen entre sí.

Con dos nodos (`eureka1` y `eureka2`), cada uno apunta al otro como peer:

**application-eureka1.yml:**

```yaml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  instance:
    hostname: eureka1
  client:
    register-with-eureka: true    # sí se registra, pero con sus peers
    fetch-registry: true
    service-url:
      defaultZone: http://eureka2:8762/eureka/
```

**application-eureka2.yml:**

```yaml
server:
  port: 8762

spring:
  application:
    name: eureka-server

eureka:
  instance:
    hostname: eureka2
  client:
    register-with-eureka: true
    fetch-registry: true
    service-url:
      defaultZone: http://eureka1:8761/eureka/
```

Los clientes se configuran apuntando a ambos nodos:

```yaml
eureka:
  client:
    service-url:
      defaultZone: http://eureka1:8761/eureka/,http://eureka2:8762/eureka/
```

Si un nodo cae, el otro sigue atendiendo registros y consultas. Los clientes tienen una caché local del registro, por lo que incluso si pierden conexión con Eureka temporalmente, pueden seguir resolviendo servicios durante un tiempo.

## Eureka con Spring Cloud Gateway

El artículo sobre [Spring Cloud Gateway](/2026/07/spring-cloud-gateway) explica cómo configurar el Gateway para enrutar a instancias descubiertas dinámicamente en Eureka usando el esquema `lb://`.

La combinación Gateway + Eureka elimina la necesidad de conocer puertos ni IPs: el Gateway consulta Eureka, obtiene instancias disponibles y las usa como destino de las rutas.

```yaml
# Dentro del Gateway
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service      # Eureka resuelve esto
          predicates:
            - Path=/api/orders/**
          filters:
            - StripPrefix=1
```

## Metadatos personalizados

Puedes añadir metadatos a cada instancia para que otros servicios tomen decisiones de enrutamiento basadas en ellos:

```yaml
eureka:
  instance:
    metadata-map:
      version: "2.1.0"
      region: "us-east"
      zone: "zone-a"
```

Y leer esos metadatos desde otro servicio:

```java
@Service
public class ServiceDiscoveryService {

    private final DiscoveryClient discoveryClient;

    public ServiceDiscoveryService(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public List<ServiceInstance> getInstancesByVersion(String serviceName, String version) {
        return discoveryClient.getInstances(serviceName)
            .stream()
            .filter(instance -> version.equals(instance.getMetadata().get("version")))
            .toList();
    }
}
```

Esto es útil para implementar canary deployments: enrutar solo un porcentaje del tráfico a instancias con la etiqueta `version: "2.1.0"`.

## Health checks con Actuator

Spring Boot Actuator expone un endpoint `/actuator/health` que Eureka puede usar para verificar el estado real de cada instancia, en lugar de depender solo del heartbeat.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Activa la integración en la configuración del cliente:

```yaml
eureka:
  client:
    healthcheck:
      enabled: true   # usa /actuator/health para reportar estado a Eureka

management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      show-details: always
```

Con esto, si la base de datos de tu servicio se desconecta y `/actuator/health` devuelve `DOWN`, Eureka marcará esa instancia como `OUT_OF_SERVICE` y dejará de enviarle tráfico hasta que se recupere, sin necesidad de reiniciar el servicio.

## Despliegue con Docker Compose

Un entorno local completo con Eureka Server y dos microservicios clientes:

```yaml
version: "3.8"

services:
  eureka-server:
    image: my-eureka-server:latest
    ports:
      - "8761:8761"
    environment:
      - SPRING_PROFILES_ACTIVE=default
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8761/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  order-service:
    image: my-order-service:latest
    environment:
      - EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://eureka-server:8761/eureka/
      - EUREKA_INSTANCE_PREFER_IP_ADDRESS=true
    depends_on:
      eureka-server:
        condition: service_healthy
    deploy:
      replicas: 2   # dos instancias para probar balanceo de carga

  payment-service:
    image: my-payment-service:latest
    environment:
      - EUREKA_CLIENT_SERVICEURL_DEFAULTZONE=http://eureka-server:8761/eureka/
      - EUREKA_INSTANCE_PREFER_IP_ADDRESS=true
    depends_on:
      eureka-server:
        condition: service_healthy
```

Con `prefer-ip-address: true`, las instancias se registran con su IP de contenedor en lugar del hostname, que en Docker puede no ser resolvible por otros contenedores.

## Resumen

Spring Cloud Eureka resuelve el problema del descubrimiento dinámico en arquitecturas de microservicios. Los conceptos clave son:

- **Eureka Server**: registro central donde los servicios publican su nombre y dirección. Uno o más nodos en clúster para alta disponibilidad.
- **Eureka Client**: cualquier microservicio que se registre en el servidor al arrancar y envíe heartbeats para mantenerse activo.
- **Spring Cloud LoadBalancer**: cliente HTTP que consulta Eureka para resolver nombres de servicios a instancias reales, con balanceo round-robin o random.
- **`@LoadBalanced`**: anotación que activa la resolución vía Eureka en `WebClient.Builder` o `RestClient.Builder`.
- **Health checks**: integración con Actuator para que Eureka refleje el estado real de la instancia, no solo si está viva.
- **Modo de autopreservación**: protección ante fluctuaciones de red que impide expulsar instancias masivamente cuando el problema puede ser transitorio.

La trinidad **Eureka + Spring Cloud Config + Spring Cloud Gateway** cubre los tres pilares de infraestructura para microservicios con Spring: descubrimiento, configuración centralizada y punto de entrada único.
