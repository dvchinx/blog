---
titulo: "Keycloak con Spring Boot: protege tu API con OAuth2, OpenID Connect y roles"
seoTitulo: "Keycloak Spring Boot 4: protege tu API con OAuth2 y roles"
fecha: "2026-10-27"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Guía de Keycloak con Spring Boot 4: realm en Docker, tu API como OAuth2 Resource Server, roles de realm y de cliente, audiencia y tests con Testcontainers."
imagenPortada: "https://i.imgur.com/kDlkhN8.png"
etiquetas: ["Spring Boot", "Spring Security", "Keycloak", "OAuth2", "Microservicios", "Java", "Backend"]
categoria: "tech"
keywords: "keycloak spring boot, keycloak con spring boot, keycloak spring boot 4, qué es keycloak, spring security keycloak, oauth2 resource server spring boot, spring-boot-starter-security-oauth2-resource-server, keycloak jwt spring boot, roles keycloak spring boot, realm roles vs client roles keycloak, keycloak docker compose, importar realm keycloak, keycloak audience mapper, invalid issuer keycloak docker, testcontainers keycloak, token relay spring boot, client credentials keycloak spring boot, keycloak vs spring authorization server, openid connect spring boot"
---

# Keycloak con Spring Boot: protege tu API con OAuth2, OpenID Connect y roles

En el artículo sobre [autenticación con Spring Security y JWT](/2026/05/spring-security-jwt) construimos todo a mano: un endpoint de login, un servicio que firma tokens, un filtro que los valida. Funciona, pero en cuanto el sistema crece aparecen las preguntas incómodas. ¿Quién gestiona las contraseñas y su recuperación? ¿Cómo se añade un segundo factor? ¿Qué pasa cuando hay tres frontends y doce microservicios que necesitan saber quién es el usuario? **Keycloak con Spring Boot** responde a todas ellas sacando la identidad de tus servicios: Keycloak emite los tokens y tu API solo tiene que validarlos.

La teoría es sencilla; los detalles no. Casi todos los tutoriales se quedan en "añade `issuer-uri` y listo", y luego llega el `401` sin mensaje porque el `iss` no coincide dentro de Docker, los roles no aparecen porque Keycloak los guarda en un claim que Spring no lee, o el token de otra aplicación del mismo realm entra sin problemas porque nadie valida la audiencia. En esta guía montamos un realm reproducible con Docker Compose, configuramos una API de **Spring Boot 4** como *OAuth2 Resource Server*, mapeamos roles de realm y de cliente, validamos la audiencia, probamos todo con Testcontainers y vemos cómo propagar la identidad entre microservicios.

## ¿Qué es Keycloak?

**Keycloak** es un servidor de identidad y acceso de código abierto (licencia Apache 2.0, proyecto de la CNCF) que implementa **OpenID Connect**, **OAuth 2.0** y SAML. Centraliza el login, los usuarios, los roles y la emisión de tokens, de modo que tus aplicaciones delegan la autenticación y solo validan tokens firmados.

Además del login con usuario y contraseña, trae de serie lo que nadie quiere programar: registro, recuperación de contraseña, verificación de correo, segundo factor (OTP, WebAuthn), login con Google o GitHub, federación con LDAP o Active Directory y una consola de administración. Sus conceptos básicos son pocos:

- **Realm**: un espacio aislado de usuarios, roles y clientes. Normalmente uno por producto o por entorno (`tienda`, `tienda-staging`).
- **Client**: cada aplicación que interactúa con Keycloak. Puede ser **pública** (una SPA o una app móvil, que no pueden guardar un secreto) o **confidencial** (un backend con `client_secret`).
- **Roles**: de **realm** (globales, como `cliente`) o de **cliente** (propios de una aplicación, como el rol `admin` de `pedidos-api`).
- **Tokens**: el *access token* (un JWT que tu API valida), el *ID token* (para que el frontend sepa quién es el usuario) y el *refresh token*.

### El papel de tu API: Resource Server

En OAuth2, tu API Spring Boot no inicia el login ni muestra formularios. Es un **Resource Server**: recibe peticiones con la cabecera `Authorization: Bearer <token>`, comprueba la firma del JWT con las claves públicas de Keycloak y decide si deja pasar la petición. No hay sesión, no hay contraseñas y no hay llamada a Keycloak por cada petición: las claves públicas (JWKS) se descargan una vez y se cachean.

![Flujo OAuth2 y OpenID Connect con Keycloak y Spring Boot: el cliente obtiene un access token JWT de Keycloak con Authorization Code y PKCE, lo envía como Bearer a la API Spring Boot, que valida firma, issuer, audiencia y expiración con las claves JWKS en caché](/diagrams/2026/10/keycloak-spring-boot/flujo-oauth2-openid-connect-keycloak-spring-boot.png)

Una aclaración antes de seguir: si encuentras tutoriales con `keycloak-spring-boot-starter` o `KeycloakWebSecurityConfigurerAdapter`, ignóralos. Los **adaptadores de Keycloak para Spring están deprecados** desde hace años y no funcionan con Spring Boot 3 ni 4. La integración correcta es la estándar de Spring Security, que funciona con cualquier proveedor OpenID Connect; Keycloak solo aporta algunos detalles propios, como el formato de sus roles.

## Paso 1: Keycloak en Docker con un realm reproducible

El error más común al empezar es configurar el realm a mano en la consola. Funciona el primer día y es imposible de reproducir el segundo. Keycloak puede **importar un realm desde un JSON** al arrancar, así que lo versionamos junto al código:

```yaml
# compose.yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:26.8.1
    command: start-dev --import-realm
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      # Fija la URL pública: el claim "iss" será siempre http://localhost:8080/...
      KC_HOSTNAME: http://localhost:8080
      # Permite que otros contenedores lleguen por http://keycloak:8080
      KC_HOSTNAME_BACKCHANNEL_DYNAMIC: "true"
    ports:
      - "8080:8080"
    volumes:
      # Todo JSON de esta carpeta se importa al arrancar
      - ./keycloak:/opt/keycloak/data/import
```

`start-dev` usa una base de datos embebida y desactiva HTTPS: perfecto en local, **nunca en producción**. Las variables `KC_BOOTSTRAP_ADMIN_*` crean el administrador temporal desde Keycloak 26 (antes eran `KEYCLOAK_ADMIN`).

Ahora el realm, en `keycloak/realm-tienda.json`. Es una versión reducida pero completa: dos roles, tres clientes y un usuario de prueba.

```json
{
  "realm": "tienda",
  "enabled": true,
  "roles": {
    "realm": [{ "name": "cliente" }],
    "client": {
      "pedidos-api": [{ "name": "admin" }]
    }
  },
  "clients": [
    {
      "clientId": "tienda-web",
      "publicClient": true,
      "standardFlowEnabled": true,
      "directAccessGrantsEnabled": false,
      "redirectUris": ["http://localhost:5173/*"],
      "webOrigins": ["http://localhost:5173"],
      "attributes": { "pkce.code.challenge.method": "S256" },
      "protocolMappers": [
        {
          "name": "audiencia-pedidos-api",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "config": {
            "included.client.audience": "pedidos-api",
            "access.token.claim": "true",
            "id.token.claim": "false"
          }
        }
      ]
    },
    {
      "clientId": "pedidos-api",
      "publicClient": false,
      "standardFlowEnabled": false,
      "serviceAccountsEnabled": true,
      "secret": "cambiar-en-cada-entorno"
    },
    {
      "clientId": "pedidos-worker",
      "publicClient": false,
      "standardFlowEnabled": false,
      "serviceAccountsEnabled": true,
      "secret": "secreto-de-pruebas",
      "protocolMappers": [
        {
          "name": "audiencia-pedidos-api",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "config": {
            "included.client.audience": "pedidos-api",
            "access.token.claim": "true"
          }
        }
      ]
    }
  ],
  "users": [
    {
      "username": "ana",
      "enabled": true,
      "email": "ana@example.com",
      "emailVerified": true,
      "firstName": "Ana",
      "lastName": "Pérez",
      "credentials": [{ "type": "password", "value": "ana123", "temporary": false }],
      "realmRoles": ["cliente"],
      "clientRoles": { "pedidos-api": ["admin"] }
    },
    {
      "username": "service-account-pedidos-worker",
      "enabled": true,
      "serviceAccountClientId": "pedidos-worker",
      "clientRoles": { "pedidos-api": ["admin"] }
    }
  ]
}
```

Tres decisiones de este JSON que los tutoriales suelen saltarse:

- **`tienda-web` es público y usa PKCE.** Una SPA no puede guardar un secreto, así que usa *Authorization Code* con PKCE. El *password grant* (`directAccessGrantsEnabled`) queda desactivado: OAuth 2.1 lo elimina y enseñarlo en ejemplos con `curl` es una mala costumbre.
- **El *audience mapper*.** Por defecto Keycloak no pone a tu API en el claim `aud` del token. El mapper `oidc-audience-mapper` añade `pedidos-api` a la audiencia de los tokens emitidos para `tienda-web` y `pedidos-worker`. Sin él, la validación de audiencia que configuraremos después rechazaría todos los tokens.
- **Roles de cliente para lo específico.** `cliente` es un rol de realm porque tiene sentido en todo el producto; `admin` es un rol del cliente `pedidos-api` porque "ser administrador" significa algo distinto en cada aplicación.

Arranca con `docker compose up -d` y comprueba que el realm existe abriendo `http://localhost:8080/realms/tienda/.well-known/openid-configuration`. Ese documento de descubrimiento es lo que Spring Boot leerá para encontrar las claves públicas.

## Paso 2: Spring Boot 4 como OAuth2 Resource Server

### Dependencias

En Spring Boot 4 los starters de OAuth2 se renombraron con el prefijo `security`. El antiguo `spring-boot-starter-oauth2-resource-server` sigue existiendo como alias deprecado, pero en un proyecto nuevo usa el nombre actual:

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-webmvc</artifactId>
    </dependency>
    <!-- Spring Security + validación de JWT (Nimbus) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-security-oauth2-resource-server</artifactId>
    </dependency>
</dependencies>
```

### Configuración mínima

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          # Debe coincidir EXACTAMENTE con el claim "iss" de los tokens
          issuer-uri: http://localhost:8080/realms/tienda
          # Rechaza tokens emitidos para otras aplicaciones del realm
          audiences: pedidos-api

app:
  keycloak:
    client-id: pedidos-api   # de qué cliente leer los roles (ver más abajo)
```

Con `issuer-uri`, Spring Security descubre el endpoint JWKS de Keycloak y valida en cada token la **firma**, el **emisor** (`iss`), la **expiración** (`exp` y `nbf`, con 60 segundos de margen por defecto) y, gracias a `audiences`, la **audiencia** (`aud`). Un detalle útil de la [documentación de Resource Server de Spring Security](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html): ese descubrimiento es **perezoso**, ocurre con la primera petición que trae un JWT. Tu API arranca aunque Keycloak todavía no esté disponible, algo muy práctico en Kubernetes.

### La cadena de seguridad

```java
@Configuration
@EnableMethodSecurity   // habilita @PreAuthorize en los servicios y controladores
class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            KeycloakJwtConverter keycloakJwtConverter) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/productos/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("admin")
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                // Sustituye el conversor por defecto, que solo entiende el claim "scope"
                .jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakJwtConverter)))
            // API sin sesión: cada petición trae su token
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // Sin cookies de sesión no hay CSRF que proteger
            .csrf(csrf -> csrf.disable());
        return http.build();
    }
}
```

Fíjate en lo que ya no está respecto al artículo de JWT manual: no hay filtro propio, no hay servicio que firme tokens, no hay endpoint de login ni `PasswordEncoder`. Todo eso vive ahora en Keycloak.

## Roles de Keycloak en Spring Security: realm roles vs client roles

Aquí está el primer "¿por qué me da 403 si el usuario tiene el rol?". Spring Security, por defecto, convierte el claim `scope` en authorities `SCOPE_...`. Pero Keycloak no pone los roles ahí, sino en dos claims anidados con su propio formato:

```json
{
  "iss": "http://localhost:8080/realms/tienda",
  "aud": ["pedidos-api", "account"],
  "preferred_username": "ana",
  "scope": "openid profile email",
  "realm_access": { "roles": ["cliente", "default-roles-tienda"] },
  "resource_access": {
    "pedidos-api": { "roles": ["admin"] },
    "account": { "roles": ["manage-account"] }
  }
}
```

- **`realm_access.roles`**: los roles de realm, válidos en todo el realm.
- **`resource_access.<cliente>.roles`**: los roles de cada cliente, agrupados por `clientId`.

Necesitamos un conversor que lea ambos. Y aquí está el error que comete la mayoría de guías: leer los roles de **todos** los clientes de `resource_access`. Si otra aplicación del realm tiene un rol `admin`, tu API lo aceptaría como propio. La regla correcta es leer los roles de realm y **solo los del cliente de tu API**.

![Conversión de roles de Keycloak a authorities de Spring Security: los realm roles y los client roles de pedidos-api del JWT se convierten en ROLE_cliente y ROLE_admin, mientras los roles de otras aplicaciones del realm se ignoran](/diagrams/2026/10/keycloak-spring-boot/roles-keycloak-realm-client-authorities-spring-security.png)

```java
@Component
class KeycloakJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    // Conserva también los scopes estándar (SCOPE_openid, SCOPE_email...)
    private final JwtGrantedAuthoritiesConverter scopesConverter = new JwtGrantedAuthoritiesConverter();
    private final String clientId;

    KeycloakJwtConverter(@Value("${app.keycloak.client-id}") String clientId) {
        this.clientId = clientId;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Set<GrantedAuthority> authorities = new HashSet<>(scopesConverter.convert(jwt));
        authorities.addAll(realmRoles(jwt));
        authorities.addAll(clientRoles(jwt));
        // El "name" del Authentication será el username legible, no el UUID del claim "sub"
        return new JwtAuthenticationToken(jwt, authorities, jwt.getClaimAsString("preferred_username"));
    }

    private Set<GrantedAuthority> realmRoles(Jwt jwt) {
        return rolesFrom(jwt.getClaimAsMap("realm_access"));
    }

    private Set<GrantedAuthority> clientRoles(Jwt jwt) {
        Map<String, Object> resourceAccess = jwt.getClaimAsMap("resource_access");
        if (resourceAccess == null) {
            return Set.of();
        }
        // Solo los roles de NUESTRO cliente: los de otras apps del realm no cuentan
        return resourceAccess.get(clientId) instanceof Map<?, ?> client
                ? rolesFrom(client)
                : Set.of();
    }

    private Set<GrantedAuthority> rolesFrom(Map<?, ?> access) {
        if (access == null || !(access.get("roles") instanceof Collection<?> roles)) {
            return Set.of();
        }
        // hasRole("admin") busca la authority "ROLE_admin"
        return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toSet());
    }
}
```

Si dos clientes distintos definen roles con el mismo nombre que un rol de realm, este conversor los fusiona en la misma authority. Si eso te preocupa, usa prefijos distintos (`ROLE_` para el realm y, por ejemplo, `PEDIDOS_` para el cliente) y comprueba con `hasAuthority`.

### Autorización en los controladores

Con las authorities en su sitio, el resto es Spring Security de siempre. Para reglas de grano fino, `@PreAuthorize` y el propio `Jwt`:

```java
@RestController
@RequestMapping("/api")
class PedidosController {

    private final PedidoService pedidoService;

    PedidosController(PedidoService pedidoService) {
        this.pedidoService = pedidoService;
    }

    // Cualquier usuario autenticado con el rol de realm "cliente"
    @GetMapping("/pedidos/mios")
    @PreAuthorize("hasRole('cliente')")
    List<PedidoDto> misPedidos(@AuthenticationPrincipal Jwt jwt) {
        // "sub" es el identificador estable del usuario en Keycloak: úsalo como clave,
        // no el username ni el email, que pueden cambiar
        return pedidoService.buscarPorUsuario(jwt.getSubject());
    }

    // Solo el rol de cliente "admin" de pedidos-api
    @DeleteMapping("/admin/pedidos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void cancelar(@PathVariable long id, Authentication auth) {
        pedidoService.cancelar(id, auth.getName()); // preferred_username, para auditoría
    }
}
```

Las respuestas por defecto son correctas pero secas: `401` con la cabecera `WWW-Authenticate: Bearer error="invalid_token"` cuando el token falla, y `403` cuando falta el rol. Si tus errores siguen el formato `ProblemDetail`, como vimos en el [manejo de excepciones con @ControllerAdvice](/2026/06/spring-exception-handling), configura un `AuthenticationEntryPoint` y un `AccessDeniedHandler` propios en `oauth2ResourceServer` y `exceptionHandling` para devolver el mismo formato.

## El error más común: "invalid issuer" con Docker

Ahora el clásico. Todo funciona en local con `./mvnw spring-boot:run`, pero al meter la API en el mismo `compose.yaml` que Keycloak empiezan los `401`. El motivo: el navegador pide el token a `http://localhost:8080`, así que el token dice `"iss": "http://localhost:8080/realms/tienda"`. Pero dentro de la red de Docker la API solo llega a Keycloak como `http://keycloak:8080`. Si configuras `issuer-uri` con `keycloak:8080`, el emisor no coincide; si lo configuras con `localhost:8080`, la API no puede descargar las claves porque `localhost` dentro del contenedor es el propio contenedor.

La solución tiene dos partes. En Keycloak, fija la URL pública con `KC_HOSTNAME` (ya lo hicimos en el `compose.yaml`) para que el `iss` sea siempre el mismo venga de donde venga la petición. En la API, separa **quién emite** de **dónde están las claves**:

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          # Lo que dice el token: se valida contra el claim "iss"
          issuer-uri: http://localhost:8080/realms/tienda
          # Dónde descargar las claves desde dentro de la red de Docker
          jwk-set-uri: http://keycloak:8080/realms/tienda/protocol/openid-connect/certs
          audiences: pedidos-api
```

Cuando defines `jwk-set-uri`, Spring Security no hace el descubrimiento: descarga las claves de esa URL y sigue validando el `iss` contra `issuer-uri`. En Kubernetes el problema es idéntico (URL pública del Ingress frente a la URL interna del `Service`) y la solución también. En producción, lo ideal es que Keycloak tenga un único nombre público con HTTPS y que ese mismo nombre resuelva dentro del clúster.

## Tests: JWT simulado y Keycloak real con Testcontainers

### Tests de controlador sin Keycloak

Para probar reglas de autorización no necesitas un Keycloak. `spring-security-test` permite inyectar un JWT ya autenticado en MockMvc:

```java
@WebMvcTest(PedidosController.class)
@Import({SecurityConfig.class, KeycloakJwtConverter.class})
@TestPropertySource(properties = "app.keycloak.client-id=pedidos-api")
class PedidosControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean PedidoService pedidoService;
    @MockitoBean JwtDecoder jwtDecoder; // evita contactar con Keycloak al crear el contexto

    @Test
    void sinRolAdminDevuelve403() throws Exception {
        mockMvc.perform(delete("/api/admin/pedidos/42")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_cliente"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void conRolAdminCancela() throws Exception {
        mockMvc.perform(delete("/api/admin/pedidos/42")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_admin"))))
                .andExpect(status().isNoContent());
    }
}
```

Ojo con un detalle: `jwt().authorities(...)` **se salta tu conversor**. Estos tests prueban las reglas de acceso, no que los roles de Keycloak se lean bien. El conversor merece su propio test unitario, construyendo un `Jwt` con `Jwt.withTokenValue("t").header("alg", "none").claim("resource_access", ...)` y comprobando las authorities resultantes, incluido el caso en que otro cliente del realm tiene un rol con el mismo nombre.

### Test de integración con un Keycloak real

Los tests anteriores no detectan un `audience mapper` olvidado ni un `iss` mal configurado. Para eso está el módulo [testcontainers-keycloak](https://github.com/dasniko/testcontainers-keycloak), que en su versión 4.x ya usa Testcontainers 2 y Keycloak 26.8. Si ya leíste cómo usar [Testcontainers con Spring Boot](/2026/07/spring-testcontainers), el patrón te resultará familiar:

```xml
<dependency>
    <groupId>com.github.dasniko</groupId>
    <artifactId>testcontainers-keycloak</artifactId>
    <version>4.4.0</version>
    <scope>test</scope>
</dependency>
```

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class PedidosSecurityIT {

    // Importa el MISMO realm que usas en local: si el JSON se rompe, el test lo detecta
    @Container
    static KeycloakContainer keycloak = new KeycloakContainer("quay.io/keycloak/keycloak:26.8.1")
            .withRealmImportFile("/keycloak/realm-tienda.json");

    @DynamicPropertySource
    static void keycloakProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri",
                () -> keycloak.getAuthServerUrl() + "/realms/tienda");
    }

    @LocalServerPort int port;
    @MockitoBean PedidoService pedidoService;

    @Test
    void elServicioWorkerPuedeCancelarPedidos() {
        String token = tokenClientCredentials("pedidos-worker", "secreto-de-pruebas");

        ResponseEntity<Void> respuesta = RestClient.create("http://localhost:" + port)
                .delete().uri("/api/admin/pedidos/42")
                .headers(h -> h.setBearerAuth(token))
                .retrieve()
                .toBodilessEntity();

        assertThat(respuesta.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void sinTokenDevuelve401() {
        assertThatThrownBy(() -> RestClient.create("http://localhost:" + port)
                .get().uri("/api/pedidos/mios")
                .retrieve()
                .toBodilessEntity())
            .isInstanceOf(HttpClientErrorException.Unauthorized.class);
    }

    private String tokenClientCredentials(String clientId, String secret) {
        Map<?, ?> respuesta = RestClient.create()
                .post()
                .uri(keycloak.getAuthServerUrl() + "/realms/tienda/protocol/openid-connect/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body("grant_type=client_credentials&client_id=" + clientId + "&client_secret=" + secret)
                .retrieve()
                .body(Map.class);
        return (String) respuesta.get("access_token");
    }
}
```

Usamos *client credentials* con la cuenta de servicio de `pedidos-worker` en lugar del *password grant*: es un flujo que existe de verdad en producción y no obliga a habilitar en el realm algo que no quieres habilitar. El contenedor tarda unos segundos en arrancar, así que reutilízalo entre clases de test o agrupa estos tests en una fase de integración.

## Llamadas entre microservicios: token relay o client credentials

Cuando `pedidos-api` necesita llamar a `inventario-api`, hay dos preguntas distintas que se suelen confundir: ¿la llamada se hace **en nombre del usuario** o **en nombre del propio servicio**?

![Token relay vs client credentials con Keycloak: en el token relay pedidos-api reenvía el JWT del usuario a inventario-api, y con client credentials pedidos-api obtiene de Keycloak su propio token de servicio para llamar a inventario-api](/diagrams/2026/10/keycloak-spring-boot/token-relay-vs-client-credentials-keycloak.png)

**Token relay** (en nombre del usuario). `pedidos-api` reenvía el mismo token que recibió. `inventario-api` sabe quién es el usuario y puede aplicar sus propias reglas. Basta un interceptor sobre el `RestClient`, construido a partir del builder inyectado para no perder la trazabilidad, como vimos en los [clientes REST de Spring](/2026/06/spring-rest-clients):

```java
@Bean
RestClient inventarioRestClient(RestClient.Builder builder) {
    return builder
            .baseUrl("http://inventario-api")
            .requestInterceptor((request, body, execution) -> {
                // Reenvía el token de la petición entrante, si la hay
                if (SecurityContextHolder.getContext().getAuthentication()
                        instanceof JwtAuthenticationToken auth) {
                    request.getHeaders().setBearerAuth(auth.getToken().getTokenValue());
                }
                return execution.execute(request, body);
            })
            .build();
}
```

Para que funcione, el token del usuario debe incluir a `inventario-api` en su audiencia (otro *audience mapper* en `tienda-web`). Y cuidado con los procesos asíncronos: si el trabajo se hace en otro hilo o tras consumir un mensaje, no hay `SecurityContext` y el token podría haber caducado (los access tokens de Keycloak duran 5 minutos por defecto).

**Client credentials** (en nombre del servicio). Para tareas sin usuario, como un job nocturno o un consumidor de Kafka, el servicio se autentica con su propio `client_id` y secreto y obtiene un token de cuenta de servicio. Spring Security lo resuelve con el cliente OAuth2 y su `OAuth2ClientHttpRequestInterceptor`, que pide el token, lo cachea y lo renueva antes de que caduque:

```yaml
# Requiere spring-boot-starter-security-oauth2-client
spring:
  security:
    oauth2:
      client:
        registration:
          inventario:
            provider: keycloak
            client-id: pedidos-api
            client-secret: ${PEDIDOS_API_CLIENT_SECRET}
            authorization-grant-type: client_credentials
        provider:
          keycloak:
            issuer-uri: http://localhost:8080/realms/tienda
```

```java
@Bean
OAuth2AuthorizedClientManager authorizedClientManager(
        ClientRegistrationRepository registrations,
        OAuth2AuthorizedClientService clientService) {
    // Variante pensada para uso fuera de una petición HTTP (jobs, listeners)
    var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(registrations, clientService);
    manager.setAuthorizedClientProvider(OAuth2AuthorizedClientProviderBuilder.builder()
            .clientCredentials()
            .build());
    return manager;
}

@Bean
RestClient inventarioServiceClient(RestClient.Builder builder, OAuth2AuthorizedClientManager manager) {
    var interceptor = new OAuth2ClientHttpRequestInterceptor(manager);
    interceptor.setClientRegistrationIdResolver(request -> "inventario");
    // El "principal" del token es la propia aplicación, no un usuario
    interceptor.setPrincipalResolver(new RequestAttributePrincipalResolver());
    return builder.baseUrl("http://inventario-api").requestInterceptor(interceptor).build();
}
```

Al usarlo, añade `.attributes(RequestAttributePrincipalResolver.principal("pedidos-api"))` a cada petición. La [documentación de clientes autorizados de Spring Security](https://docs.spring.io/spring-security/reference/servlet/oauth2/client/authorized-clients.html) detalla el resto de opciones. Si tu arquitectura pasa por un [API Gateway con Spring Cloud Gateway](/2026/07/spring-cloud-gateway) o un [Backend for Frontend](/2026/09/backend-for-frontend-bff), lo habitual es que sea ese componente el que haga el login OIDC con el navegador y aplique el token relay hacia los servicios internos, de modo que el token nunca toque el JavaScript del navegador.

## Riesgos y trade-offs

Keycloak resuelve mucho, pero no es gratis en términos operativos:

- **Es una pieza crítica.** Si Keycloak cae, nadie puede iniciar sesión ni renovar tokens. Las APIs siguen validando los tokens existentes con las claves en caché, pero solo hasta que caducan. En producción necesitas varias réplicas, una base de datos PostgreSQL gestionada y monitorización propia.
- **Revocar no es inmediato.** Un JWT es válido hasta su `exp`, aunque el administrador desactive al usuario. Mantén los access tokens cortos (5–15 minutos) y, si necesitas revocación instantánea en operaciones sensibles, usa *token introspection* para esos endpoints concretos, asumiendo el coste de una llamada a Keycloak por petición.
- **Tokens grandes.** Cada rol, grupo y claim viaja en cada petición. Con decenas de roles por usuario las cabeceras crecen y algunos proxies empiezan a rechazarlas. Diseña pocos roles con significado y deja los permisos de grano fino a tu aplicación.
- **Configuración como código.** Un realm editado a mano en la consola deriva entre entornos. Versiona los JSON o usa herramientas como `keycloak-config-cli` o el provider de Terraform.
- **Actualizaciones frecuentes.** Keycloak publica versiones a menudo, muchas con correcciones de seguridad (la 26.8.1, de octubre de 2026, corrige más de veinte problemas). Planifica las actualizaciones como cualquier otra dependencia.

## ¿Cuándo usar Keycloak y cuándo no?

**Usa Keycloak** si tienes varias aplicaciones o microservicios que comparten usuarios, necesitas *single sign-on*, login social, segundo factor o federación con LDAP/Active Directory, o simplemente no quieres que tu equipo mantenga código de contraseñas. También si te importa no depender de un proveedor: tu API solo habla OpenID Connect estándar, así que mañana podrías cambiar a Auth0, Entra ID o Cognito tocando las propiedades.

**Probablemente no lo necesitas** si tienes una única aplicación con un login sencillo (Spring Security con sesión o el JWT del artículo anterior bastan), si ya usas un proveedor gestionado que tu empresa paga, o si no tienes capacidad para operar otra pieza con estado. Y si lo que necesitas es emitir tokens con lógica muy a medida embebida en tu propio código Java, **Spring Authorization Server** es una alternativa más ligera, a cambio de construir tú la gestión de usuarios, el registro y el segundo factor.

## Buenas prácticas

1. **Versiona el realm** (JSON, `keycloak-config-cli` o Terraform) y úsalo igual en local, en tests y en producción.
2. **Valida siempre la audiencia** con `audiences` y añade el *audience mapper* en Keycloak. Sin ello, cualquier token del realm vale para cualquier API.
3. **Lee solo los roles de tu cliente** en `resource_access`, nunca los de todos los clientes.
4. **Usa `sub` como identificador del usuario** en tu base de datos; el username y el email pueden cambiar.
5. **Authorization Code + PKCE para frontends, client credentials para servicios.** Nada de *password grant* ni de secretos en una SPA.
6. **Access tokens cortos** y refresh tokens gestionados por el frontend o, mejor, por un BFF.
7. **Separa `issuer-uri` y `jwk-set-uri`** cuando la URL pública y la interna de Keycloak no coincidan.
8. **Produce con `start`, no con `start-dev`**: HTTPS, PostgreSQL, varias réplicas y el admin temporal sustituido por cuentas reales.

## Preguntas frecuentes

### ¿Cómo integrar Keycloak con Spring Boot?

Configura tu aplicación como OAuth2 Resource Server con `spring-boot-starter-security-oauth2-resource-server` y apunta `spring.security.oauth2.resourceserver.jwt.issuer-uri` a la URL del realm de Keycloak. Spring Security descargará las claves públicas y validará los JWT. Después añade un conversor que lea los roles de los claims `realm_access` y `resource_access`.

### ¿Los adaptadores de Keycloak para Spring Boot siguen funcionando?

No. El `keycloak-spring-boot-starter` y el `KeycloakWebSecurityConfigurerAdapter` están deprecados y no son compatibles con Spring Boot 3 ni 4. La forma recomendada es usar el soporte estándar de OAuth2 y OpenID Connect de Spring Security, que funciona con Keycloak sin librerías específicas.

### ¿Qué diferencia hay entre realm roles y client roles en Keycloak?

Los realm roles son globales al realm y aparecen en el claim `realm_access.roles`; sirven para conceptos comunes a todo el producto, como "cliente". Los client roles pertenecen a una aplicación concreta y aparecen en `resource_access.<clientId>.roles`; sirven para permisos propios de esa aplicación, como el "admin" de una API.

### ¿Por qué Spring Boot devuelve 401 con un token válido de Keycloak?

Las causas más frecuentes son que el claim `iss` no coincide con `issuer-uri` (típico con Docker o Kubernetes, donde la URL interna y la pública difieren), que el token no incluye tu API en `aud` cuando validas audiencias, o que el token ha caducado. Revisa el token en jwt.io y la cabecera `WWW-Authenticate` de la respuesta.

### ¿Keycloak es gratis?

Sí. Keycloak es software libre con licencia Apache 2.0 y es un proyecto de la CNCF. No hay versión de pago del propio Keycloak; lo que existe es soporte comercial (por ejemplo, Red Hat build of Keycloak) y servicios gestionados de terceros. El coste real está en operarlo: infraestructura, base de datos, alta disponibilidad y actualizaciones.

### ¿Keycloak o Spring Authorization Server?

Keycloak es un producto completo listo para usar, con consola, gestión de usuarios, login social y segundo factor. Spring Authorization Server es un framework para construir tu propio servidor de autorización en Java, más flexible pero con mucho más trabajo. Para la mayoría de equipos, Keycloak es la opción más rápida y segura.

## Conclusión

Integrar Keycloak con Spring Boot es, en esencia, dejar de hacer cosas: tu API deja de guardar contraseñas, de firmar tokens y de implementar login, y se limita a validar JWT con una dependencia y tres propiedades. Lo que sí exige atención son los detalles que separan una demo de un sistema en producción: un realm reproducible, la audiencia validada, los roles leídos solo del cliente correcto, el emisor coherente dentro y fuera de Docker y unos tests que prueban contra un Keycloak real.

Si te quedas con lo esencial: versiona el realm en JSON, usa `spring-boot-starter-security-oauth2-resource-server` con `issuer-uri` y `audiences`, escribe un conversor que lea `realm_access` y solo tu cliente en `resource_access`, y cubre el conjunto con Testcontainers. A partir de ahí, decidir entre token relay y client credentials para hablar con otros servicios es cuestión de preguntarte, en cada llamada, en nombre de quién actúas.
