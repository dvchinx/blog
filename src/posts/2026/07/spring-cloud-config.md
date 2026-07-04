---
titulo: "Spring Cloud Config: configuración centralizada para microservicios"
seoTitulo: "Spring Cloud Config: guía práctica de configuración centralizada en Spring Boot"
fecha: "2026-07-05"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Spring Cloud Config Server y Config Client para gestionar la configuración de múltiples microservicios desde un repositorio Git centralizado, con soporte para perfiles, refresco en caliente y propiedades cifradas."
imagenPortada: "https://i.imgur.com/qVzfPJp.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Cloud", "Microservicios", "Java", "Backend", "Configuración"]
categoria: "tech"
keywords: "Spring Cloud Config, Config Server, Config Client, configuración centralizada microservicios, Spring Boot configuración, @RefreshScope, Git backend Config, propiedades cifradas Spring Cloud, spring.cloud.config, perfiles Spring Cloud"
---

# Spring Cloud Config: configuración centralizada para microservicios

Cuando tienes un solo servicio, un `application.yml` alcanza. Cuando tienes diez microservicios desplegados en tres entornos distintos, mantener la configuración sincronizada se vuelve un problema real: valores duplicados, secretos sueltos en repositorios de código, cambios que requieren redeploy y propiedades que divergen silenciosamente entre instancias.

Spring Cloud Config resuelve ese problema con dos piezas: un **Config Server** que actúa como fuente única de verdad de la configuración, y un **Config Client** integrado en cada microservicio que consulta al servidor al arrancar. El backend por defecto es un repositorio Git, lo que da historial de cambios, revisiones y rollback sin esfuerzo extra.

## Arquitectura general

```
┌──────────────────────────────────────┐
│           Config Server              │
│  (Spring Boot + spring-cloud-config) │
│            puerto 8888               │
└──────────────┬───────────────────────┘
               │  lee
               ▼
        Git Repository
   (application.yml, order-service.yml,
    order-service-prod.yml, ...)
               
   ┌───────────────┐   ┌───────────────┐
   │ order-service │   │  user-service │
   │  (cliente)    │   │  (cliente)    │
   └───────┬───────┘   └───────┬───────┘
           │                   │
           └──── consultan ────┘
                    al arrancar
```

Cada microservicio consulta al Config Server al iniciar, especificando su nombre de aplicación y el perfil activo. El servidor devuelve las propiedades del repositorio Git correspondientes. Desde ese momento el servicio opera con esa configuración, como si las propiedades estuvieran en su propio `application.yml`.

## Config Server

### Dependencias

Crea un nuevo proyecto Spring Boot (puede ser el más pequeño posible) y agrega:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-config-server</artifactId>
</dependency>
```

El BOM de Spring Cloud se declara en la sección `dependencyManagement`:

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

### Habilitar el servidor

Una sola anotación activa el servidor:

```java
@SpringBootApplication
@EnableConfigServer
public class ConfigServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConfigServerApplication.class, args);
    }
}
```

### Configuración del repositorio Git

En `application.yml` del Config Server:

```yaml
server:
  port: 8888

spring:
  application:
    name: config-server
  cloud:
    config:
      server:
        git:
          uri: https://github.com/tuusuario/config-repo
          default-label: main
          search-paths: "{application}"   # busca en subdirectorio por nombre de servicio
          clone-on-start: true            # clona el repo al arrancar, no en la primera petición
```

La propiedad `uri` apunta al repositorio Git que contiene los archivos de configuración. Con `clone-on-start: true`, el servidor falla al arrancar si el repositorio no es accesible, lo que es preferible a descubrirlo en la primera petición en producción.

Para repositorios privados, usa un token de acceso personal:

```yaml
spring:
  cloud:
    config:
      server:
        git:
          uri: https://github.com/tuusuario/config-repo
          username: git
          password: ${GIT_TOKEN}   # variable de entorno, nunca en texto plano
```

## Repositorio de configuración

El repositorio Git tiene una convención de nombres simple. Spring Cloud Config busca archivos en este orden de prioridad (de mayor a menor):

1. `{application}-{profile}.yml`
2. `{application}.yml`
3. `application-{profile}.yml`
4. `application.yml`

Donde `{application}` es el nombre del microservicio y `{profile}` es el perfil activo (`dev`, `prod`, etc.).

Una estructura típica:

```
config-repo/
├── application.yml              # propiedades compartidas por todos los servicios
├── order-service.yml            # propiedades de order-service (todos los perfiles)
├── order-service-dev.yml        # propiedades de order-service en desarrollo
├── order-service-prod.yml       # propiedades de order-service en producción
├── user-service.yml
└── user-service-prod.yml
```

### application.yml (compartido)

```yaml
# Propiedades comunes a todos los microservicios
management:
  endpoints:
    web:
      exposure:
        include: health,info,refresh
  endpoint:
    health:
      show-details: always

logging:
  level:
    root: INFO
```

### order-service.yml

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/orders
    username: orders_user

order:
  max-items-per-cart: 50
  currency: COP
```

### order-service-prod.yml

```yaml
spring:
  datasource:
    url: jdbc:postgresql://db.internal:5432/orders_prod
    username: orders_prod_user
    password: ${DB_PASSWORD}   # inyectado como variable de entorno en el pod

logging:
  level:
    root: WARN
    com.example: INFO
```

## Config Client

Cada microservicio que quiera consumir configuración del servidor necesita el starter de cliente:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-config</artifactId>
</dependency>
```

Y en su `application.yml` (o `bootstrap.yml` en proyectos más antiguos):

```yaml
spring:
  application:
    name: order-service     # debe coincidir con el nombre de los archivos en el repo
  config:
    import: optional:configserver:http://localhost:8888

  profiles:
    active: dev             # determina qué archivo {name}-{profile}.yml se carga
```

La propiedad `spring.config.import` es la forma moderna (Spring Boot 2.4+) de declarar el Config Server. El prefijo `optional:` hace que el servicio arranque aunque el Config Server no esté disponible —útil en desarrollo—; quítalo en producción para que el fallo sea explícito.

Con esa configuración, al arrancar `order-service` con perfil `dev`, el cliente consultará:

```
GET http://localhost:8888/order-service/dev
```

Y el servidor responderá con las propiedades combinadas de `application.yml`, `order-service.yml` y `order-service-dev.yml`, en ese orden de prioridad.

### Usar las propiedades

Las propiedades del Config Server se inyectan exactamente igual que cualquier propiedad local:

```java
@Service
public class OrderService {

    @Value("${order.max-items-per-cart}")
    private int maxItemsPerCart;

    @Value("${order.currency}")
    private String currency;

    // ...
}
```

O con `@ConfigurationProperties` para agrupar propiedades relacionadas:

```java
@ConfigurationProperties(prefix = "order")
@Component
public class OrderProperties {

    private int maxItemsPerCart;
    private String currency;

    // getters y setters
}
```

## Refresco en caliente con @RefreshScope

Por defecto, las propiedades se leen una vez al arrancar. Si cambias un valor en el repositorio Git, el servicio no lo verá hasta que reinicies.

`@RefreshScope` resuelve eso: marca un bean para que se recree cuando se invoca el endpoint `/actuator/refresh`. Con Spring Boot Actuator en el classpath (que ya está si usas el starter web), el endpoint queda disponible automáticamente cuando lo expones en la configuración compartida (`management.endpoints.web.exposure.include: refresh`).

```java
@Service
@RefreshScope   // el bean se recreará al llamar /actuator/refresh
public class PricingService {

    @Value("${pricing.discount-rate:0.0}")
    private double discountRate;

    public double applyDiscount(double price) {
        return price * (1 - discountRate);
    }
}
```

Para refrescar la configuración:

```bash
curl -X POST http://localhost:8080/actuator/refresh
```

El endpoint devuelve la lista de propiedades que cambiaron:

```json
["pricing.discount-rate"]
```

En un entorno con múltiples instancias del mismo servicio necesitas llamar a `/actuator/refresh` en cada instancia. Para automatizar eso en escala, Spring Cloud Bus (con Kafka o RabbitMQ como transporte) permite hacer broadcast del evento de refresco a todas las instancias con una sola llamada.

## Propiedades cifradas

Guardar contraseñas en texto plano en el repositorio Git, aunque sea privado, es una mala práctica. Spring Cloud Config incluye soporte para cifrado y descifrado de propiedades.

### Configuración de la clave

Agrega en el `application.yml` del Config Server (o como variable de entorno):

```yaml
encrypt:
  key: ${ENCRYPT_KEY}   # clave simétrica; en producción usa RSA con keystore
```

Para producción, usa cifrado asimétrico con un keystore JKS:

```yaml
encrypt:
  key-store:
    location: classpath:config-server.jks
    password: ${KEYSTORE_PASSWORD}
    alias: config-key
    secret: ${KEY_PASSWORD}
```

### Cifrar y descifrar

El Config Server expone endpoints para cifrar y descifrar valores:

```bash
# Cifrar un valor
curl -X POST http://localhost:8888/encrypt -d 'mi-contraseña-secreta'
# Responde: AQB3mXt7...==

# Descifrar (útil para verificar)
curl -X POST http://localhost:8888/decrypt -d 'AQB3mXt7...=='
```

En el repositorio Git almacenas el valor cifrado con el prefijo `{cipher}`:

```yaml
# order-service-prod.yml
spring:
  datasource:
    password: '{cipher}AQB3mXt7...=='
```

El Config Server descifra automáticamente cualquier valor con ese prefijo antes de enviarlo al cliente. El microservicio recibe la contraseña en texto plano a través de HTTPS —nunca ve la clave de cifrado.

## Verificar la configuración desde el servidor

El Config Server expone un endpoint REST que puedes consultar directamente para depurar qué propiedades recibirá un servicio:

```bash
# Propiedades de order-service con perfil dev
curl http://localhost:8888/order-service/dev

# Propiedades de order-service con perfil prod
curl http://localhost:8888/order-service/prod

# El archivo YAML tal como está en el repo (sin combinar)
curl http://localhost:8888/order-service-prod.yml
```

La respuesta JSON del primer formato incluye todas las fuentes consultadas y el valor final de cada propiedad, lo que facilita entender qué archivo "gana" en caso de conflicto.

## Resumen

Spring Cloud Config centraliza la configuración en un repositorio Git, elimina los valores duplicados entre servicios y permite cambios sin redeploy gracias a `@RefreshScope`. Los puntos clave son:

- **Config Server**: proyecto Spring Boot con `@EnableConfigServer` que apunta a un repo Git.
- **Config Client**: declara `spring.config.import` apuntando al servidor; recibe las propiedades al arrancar.
- **Convención de nombres**: `{aplicación}-{perfil}.yml` determina qué archivo se sirve.
- **Refresco en caliente**: `@RefreshScope` + `POST /actuator/refresh` actualiza beans sin reiniciar.
- **Cifrado**: valores con prefijo `{cipher}` se descifran en el servidor antes de enviarse al cliente.

Para entornos grandes, el siguiente paso natural es agregar **Spring Cloud Bus** para propagar el refresco a todas las instancias simultáneamente, y un registro de servicios como **Eureka** o **Consul** para que los clientes descubran el Config Server dinámicamente en lugar de apuntar a una URL fija.
