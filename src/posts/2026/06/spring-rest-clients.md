---
titulo: "Spring REST Clients: RestTemplate, WebClient y RestClient"
seoTitulo: "Spring REST Clients: guía práctica de RestTemplate, WebClient y RestClient en Spring Boot"
fecha: "2026-06-18"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a consumir APIs REST en Spring Boot con RestTemplate, WebClient reactivo y el nuevo RestClient de Spring 6.1. Cuándo usar cada uno, configuración, manejo de errores y buenas prácticas."
imagenPortada: "https://i.imgur.com/wCQ8A4K.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "REST", "WebClient", "RestTemplate", "RestClient", "Java", "Backend", "HTTP"]
categoria: "tech"
keywords: "Spring RestTemplate, Spring WebClient, RestClient Spring 6.1, consumir API REST Spring Boot, HTTP client Spring, WebClient reactor, RestTemplate vs WebClient, Spring HTTP interface"
---

# Spring REST Clients: RestTemplate, WebClient y RestClient

Consumir APIs externas es una tarea cotidiana en cualquier aplicación backend. Spring ofrece tres clientes HTTP con características y filosofías distintas: el veterano `RestTemplate`, el reactivo `WebClient` y el moderno `RestClient` introducido en Spring 6.1. Entender cuándo y cómo usar cada uno evita código frágil y dependencias innecesarias.

## El ecosistema de clientes HTTP en Spring

| Cliente | Desde | Modelo | Estado |
|---|---|---|---|
| `RestTemplate` | Spring 3.0 | Síncrono/bloqueante | En mantenimiento |
| `WebClient` | Spring 5.0 | Reactivo/no bloqueante | Activo |
| `RestClient` | Spring 6.1 / Boot 3.2 | Síncrono, API fluida | Activo (recomendado) |

La recomendación actual de Spring es usar `RestClient` para proyectos síncronos nuevos, `WebClient` para proyectos reactivos con Project Reactor, y `RestTemplate` solo en código legacy.

## RestTemplate

Aunque está en modo mantenimiento, `RestTemplate` sigue siendo común en bases de código existentes. Su API es imperativa y directa:

### Configuración con bean

```java
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(10))
                .build();
    }
}
```

Usar `RestTemplateBuilder` en lugar de `new RestTemplate()` permite que Spring Boot aplique los auto-configuradores (métricas, tracing, etc.) automáticamente.

### Operaciones básicas

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final RestTemplate restTemplate;
    private static final String BASE_URL = "https://api.example.com";

    // GET -> objeto
    public UserDto getUser(Long id) {
        return restTemplate.getForObject(BASE_URL + "/users/{id}", UserDto.class, id);
    }

    // GET -> ResponseEntity (para acceder a headers y status)
    public ResponseEntity<UserDto> getUserWithHeaders(Long id) {
        return restTemplate.getForEntity(BASE_URL + "/users/{id}", UserDto.class, id);
    }

    // GET -> lista (requiere array y conversión)
    public List<UserDto> getAllUsers() {
        UserDto[] users = restTemplate.getForObject(BASE_URL + "/users", UserDto[].class);
        return users != null ? Arrays.asList(users) : Collections.emptyList();
    }

    // POST
    public UserDto createUser(CreateUserRequest request) {
        return restTemplate.postForObject(BASE_URL + "/users", request, UserDto.class);
    }

    // PUT
    public void updateUser(Long id, UpdateUserRequest request) {
        restTemplate.put(BASE_URL + "/users/{id}", request, id);
    }

    // DELETE
    public void deleteUser(Long id) {
        restTemplate.delete(BASE_URL + "/users/{id}", id);
    }
}
```

### Manejo de errores en RestTemplate

Por defecto `RestTemplate` lanza `HttpClientErrorException` (4xx) o `HttpServerErrorException` (5xx). Puedes centralizar el manejo con un `ResponseErrorHandler` personalizado:

```java
@Component
public class CustomErrorHandler implements ResponseErrorHandler {

    @Override
    public boolean hasError(ClientHttpResponse response) throws IOException {
        return response.getStatusCode().isError();
    }

    @Override
    public void handleError(ClientHttpResponse response) throws IOException {
        HttpStatusCode status = response.getStatusCode();
        if (status.is4xxClientError()) {
            throw new ExternalApiClientException("Error del cliente: " + status);
        }
        if (status.is5xxServerError()) {
            throw new ExternalApiServerException("Error del servidor externo: " + status);
        }
    }
}

// Registro en el bean:
@Bean
public RestTemplate restTemplate(RestTemplateBuilder builder, CustomErrorHandler errorHandler) {
    return builder
            .errorHandler(errorHandler)
            .build();
}
```

---

## RestClient

`RestClient` es el sucesor directo de `RestTemplate`. Ofrece una API fluida similar a `WebClient` pero síncrona, sin la complejidad del modelo reactivo. Disponible desde Spring Boot 3.2.

### Creación

```java
@Configuration
public class RestClientConfig {

    @Bean
    public RestClient userApiClient() {
        return RestClient.builder()
                .baseUrl("https://api.example.com")
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .requestInterceptor((request, body, execution) -> {
                    request.getHeaders().add("X-Api-Key", "secret-key");
                    return execution.execute(request, body);
                })
                .build();
    }
}
```

### Operaciones con la API fluida

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final RestClient userApiClient;

    // GET -> objeto
    public UserDto getUser(Long id) {
        return userApiClient.get()
                .uri("/users/{id}", id)
                .retrieve()
                .body(UserDto.class);
    }

    // GET -> lista con ParameterizedTypeReference
    public List<UserDto> getAllUsers() {
        return userApiClient.get()
                .uri("/users")
                .retrieve()
                .body(new ParameterizedTypeReference<List<UserDto>>() {});
    }

    // GET -> ResponseEntity completa
    public ResponseEntity<UserDto> getUserWithResponse(Long id) {
        return userApiClient.get()
                .uri("/users/{id}", id)
                .retrieve()
                .toEntity(UserDto.class);
    }

    // POST
    public UserDto createUser(CreateUserRequest request) {
        return userApiClient.post()
                .uri("/users")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(UserDto.class);
    }

    // PUT
    public UserDto updateUser(Long id, UpdateUserRequest request) {
        return userApiClient.put()
                .uri("/users/{id}", id)
                .body(request)
                .retrieve()
                .body(UserDto.class);
    }

    // DELETE
    public void deleteUser(Long id) {
        userApiClient.delete()
                .uri("/users/{id}", id)
                .retrieve()
                .toBodilessEntity();
    }
}
```

### Manejo de errores en RestClient

`RestClient` usa `onStatus` para manejar errores de forma expresiva:

```java
public UserDto getUser(Long id) {
    return userApiClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, (request, response) -> {
                throw new UserNotFoundException("Usuario no encontrado: " + id);
            })
            .onStatus(HttpStatusCode::is5xxServerError, (request, response) -> {
                throw new ExternalServiceException("Error en servicio externo");
            })
            .body(UserDto.class);
}
```

También puedes registrar manejadores de error por defecto al construir el cliente para no repetirlos en cada llamada:

```java
@Bean
public RestClient userApiClient() {
    return RestClient.builder()
            .baseUrl("https://api.example.com")
            .defaultStatusHandler(HttpStatusCode::is4xxClientError,
                    (req, res) -> { throw new ExternalApiClientException(res.getStatusCode().toString()); })
            .defaultStatusHandler(HttpStatusCode::is5xxServerError,
                    (req, res) -> { throw new ExternalApiServerException(res.getStatusCode().toString()); })
            .build();
}
```

---

## WebClient

`WebClient` es el cliente HTTP del stack reactivo de Spring (Project Reactor). Es no bloqueante: las operaciones retornan `Mono<T>` o `Flux<T>` en lugar de valores directos.

### Cuándo usar WebClient

Úsalo cuando tu aplicación sea reactiva de extremo a extremo (controladores con `Mono`/`Flux`, repositorios reactivos). Usarlo en un contexto síncrono y bloquear con `.block()` elimina los beneficios reactivos y puede causar deadlocks en ciertos schedulers.

### Dependencia

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-webflux</artifactId>
</dependency>
```

### Configuración

```java
@Configuration
public class WebClientConfig {

    @Bean
    public WebClient userApiClient(WebClient.Builder builder) {
        return builder
                .baseUrl("https://api.example.com")
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .codecs(config -> config.defaultCodecs().maxInMemorySize(2 * 1024 * 1024)) // 2 MB
                .build();
    }
}
```

Inyectar `WebClient.Builder` (no `WebClient` directamente) permite que Spring Boot aplique la auto-configuración de métricas y observabilidad.

### Operaciones reactivas

```java
@Service
@RequiredArgsConstructor
public class UserService {

    private final WebClient userApiClient;

    // GET -> Mono (0 o 1 elemento)
    public Mono<UserDto> getUser(Long id) {
        return userApiClient.get()
                .uri("/users/{id}", id)
                .retrieve()
                .bodyToMono(UserDto.class);
    }

    // GET -> Flux (0 o N elementos)
    public Flux<UserDto> getAllUsers() {
        return userApiClient.get()
                .uri("/users")
                .retrieve()
                .bodyToFlux(UserDto.class);
    }

    // POST
    public Mono<UserDto> createUser(CreateUserRequest request) {
        return userApiClient.post()
                .uri("/users")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(UserDto.class);
    }

    // Llamadas en paralelo y combinación de resultados
    public Mono<UserProfileDto> getUserProfile(Long userId) {
        Mono<UserDto> user = getUser(userId);
        Mono<List<OrderDto>> orders = userApiClient.get()
                .uri("/users/{id}/orders", userId)
                .retrieve()
                .bodyToFlux(OrderDto.class)
                .collectList();

        return Mono.zip(user, orders)
                .map(tuple -> new UserProfileDto(tuple.getT1(), tuple.getT2()));
    }
}
```

### Manejo de errores en WebClient

```java
public Mono<UserDto> getUser(Long id) {
    return userApiClient.get()
            .uri("/users/{id}", id)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError,
                    response -> Mono.error(new UserNotFoundException("Usuario: " + id)))
            .onStatus(HttpStatusCode::is5xxServerError,
                    response -> response.bodyToMono(String.class)
                            .flatMap(body -> Mono.error(new ExternalServiceException(body))))
            .bodyToMono(UserDto.class)
            .retryWhen(Retry.backoff(3, Duration.ofMillis(500))
                    .filter(ex -> ex instanceof ExternalServiceException));
}
```

El operador `retryWhen` de Reactor añade reintentos con backoff exponencial para errores transitorios, algo muy sencillo de implementar con WebClient y complicado con clientes síncronos.

---

## HTTP Interface: clientes declarativos

Spring 6 introdujo las **HTTP Interfaces**, que permiten definir clientes REST como interfaces Java con anotaciones, similar a Feign:

```java
// 1. Define la interfaz
@HttpExchange("/users")
public interface UserApiClient {

    @GetExchange("/{id}")
    UserDto getUser(@PathVariable Long id);

    @GetExchange
    List<UserDto> getAllUsers();

    @PostExchange
    UserDto createUser(@RequestBody CreateUserRequest request);

    @PutExchange("/{id}")
    UserDto updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request);

    @DeleteExchange("/{id}")
    void deleteUser(@PathVariable Long id);
}

// 2. Registra el cliente como bean (usando RestClient internamente)
@Configuration
public class HttpClientConfig {

    @Bean
    public UserApiClient userApiClient(RestClient.Builder builder) {
        RestClient restClient = builder
                .baseUrl("https://api.example.com")
                .build();

        RestClientAdapter adapter = RestClientAdapter.create(restClient);
        HttpServiceProxyFactory factory = HttpServiceProxyFactory.builderFor(adapter).build();
        return factory.createClient(UserApiClient.class);
    }
}

// 3. Inyecta y usa como cualquier bean
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserApiClient userApiClient;

    public UserDto getUser(Long id) {
        return userApiClient.getUser(id);  // completamente declarativo
    }
}
```

Las HTTP Interfaces son especialmente útiles cuando consumes varias APIs externas con muchos endpoints: reducen el boilerplate al mínimo y centralizan la definición del contrato.

---

## Configuración de timeouts y connection pool

Para entornos de producción, configura siempre timeouts explícitos. Con `RestClient` o `RestTemplate` basados en `HttpComponentsClientHttpRequestFactory` (Apache HttpClient):

```java
@Bean
public RestClient restClient() {
    RequestConfig requestConfig = RequestConfig.custom()
            .setConnectTimeout(Timeout.ofSeconds(5))
            .setResponseTimeout(Timeout.ofSeconds(10))
            .build();

    PoolingHttpClientConnectionManager connectionManager =
            new PoolingHttpClientConnectionManager();
    connectionManager.setMaxTotal(100);
    connectionManager.setDefaultMaxPerRoute(20);

    CloseableHttpClient httpClient = HttpClients.custom()
            .setDefaultRequestConfig(requestConfig)
            .setConnectionManager(connectionManager)
            .build();

    ClientHttpRequestFactory factory =
            new HttpComponentsClientHttpRequestFactory(httpClient);

    return RestClient.builder()
            .baseUrl("https://api.example.com")
            .requestFactory(factory)
            .build();
}
```

Para `WebClient`, la configuración va en el cliente Netty subyacente:

```java
@Bean
public WebClient webClient(WebClient.Builder builder) {
    HttpClient httpClient = HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
            .responseTimeout(Duration.ofSeconds(10))
            .doOnConnected(conn -> conn
                    .addHandlerLast(new ReadTimeoutHandler(10))
                    .addHandlerLast(new WriteTimeoutHandler(5)));

    return builder
            .baseUrl("https://api.example.com")
            .clientConnector(new ReactorClientHttpConnector(httpClient))
            .build();
}
```

---

## Buenas prácticas

1. **Prefiere `RestClient` sobre `RestTemplate`** en proyectos nuevos con Spring Boot 3.2+. La API fluida es más legible y expresiva.
2. **Usa `WebClient` solo si tu stack es reactivo**. Mezclar bloqueante y no bloqueante en el mismo hilo puede causar problemas difíciles de diagnosticar.
3. **Define los clientes como beans con `baseUrl` fija** en lugar de construirlos inline. Facilita la configuración de timeouts, interceptores y manejo de errores compartido.
4. **Configura timeouts siempre**. Un cliente HTTP sin timeout puede bloquear threads indefinidamente ante una API externa que no responde.
5. **Maneja los errores HTTP explícitamente** con `onStatus` en lugar de dejar que se propaguen como excepciones genéricas.
6. **Valida el contrato en tests con WireMock** en lugar de llamar servicios reales en los tests de integración. Hace los tests deterministas y rápidos.
7. **Usa HTTP Interfaces** cuando consumas APIs con muchos endpoints: el código resultante es más limpio y fácil de mantener que llamadas manuales en métodos de servicio.

## Conclusión

Spring ofrece tres opciones sólidas para consumir APIs REST. `RestClient` es la elección natural para nuevos proyectos síncronos: su API fluida reduce el boilerplate y su manejo de errores con `onStatus` es más expresivo que el de `RestTemplate`. `WebClient` sigue siendo la opción correcta para arquitecturas reactivas donde el no-bloqueo aporta valor real. Y las HTTP Interfaces, disponibles desde Spring 6, añaden una capa declarativa útil cuando el número de endpoints crece.

En todos los casos, los patrones son los mismos: define el cliente como bean, configura timeouts y el pool de conexiones, centraliza el manejo de errores y valida el comportamiento con mocks en los tests.
