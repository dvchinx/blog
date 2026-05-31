---
titulo: "Autenticación con Spring Security y JWT"
seoTitulo: "Spring Security JWT: autenticación stateless en Spring Boot paso a paso"
fecha: "2026-06-01"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a implementar autenticación stateless en Spring Boot usando Spring Security y JSON Web Tokens. Desde la configuración básica hasta el filtro de validación."
imagenPortada: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Security", "JWT", "Java", "Backend"]
categoria: "tech"
keywords: "Spring Security JWT, autenticación JWT Spring Boot, JSON Web Token Java, stateless authentication, Spring Boot security, filtro JWT, Bearer token Spring"
---

# Autenticación con Spring Security y JWT

La autenticación es una de las partes más críticas de cualquier API. Spring Security ofrece una base sólida para proteger endpoints, y cuando se combina con JSON Web Tokens (JWT), permite implementar autenticación stateless sin necesidad de sesiones en el servidor.

Este artículo cubre el flujo completo: desde la configuración de Spring Security hasta el filtro que valida tokens en cada solicitud.

## ¿Qué es JWT?

Un JSON Web Token es una cadena codificada en Base64 compuesta por tres partes separadas por puntos:

- **Header**: algoritmo de firma y tipo de token.
- **Payload**: claims, es decir, información del usuario como ID, rol y fecha de expiración.
- **Signature**: firma generada con una clave secreta para verificar la integridad.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJzdWIiOiJ1c2VyMSIsInJvbGUiOiJVU0VSIiwiZXhwIjoxNzE3MTgwMDAwfQ
.hK9Yx4OaT8mI1nF3LpJvRtKqXwZbQcMnAdUeVsGjHfE
```

El servidor no almacena el token. En cada solicitud, el cliente lo envía en el header `Authorization: Bearer <token>`, y el servidor lo valida con la clave secreta.

## Dependencias

Agrega estas dependencias en tu `pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.5</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.5</version>
    <scope>runtime</scope>
</dependency>
```

## Servicio de JWT

La clase `JwtService` centraliza la generación y validación de tokens:

```java
@Service
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration:86400000}")
    private long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
    }

    public String generateToken(UserDetails userDetails) {
        return Jwts.builder()
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        Claims claims = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        return claimsResolver.apply(claims);
    }
}
```

Agrega la clave secreta en `application.yml`:

```yaml
jwt:
  secret: 404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970
  expiration: 86400000  # 24 horas en milisegundos
```

La clave debe ser suficientemente larga para HMAC-SHA256 (al menos 256 bits, es decir 32 bytes en Base64).

## Filtro de autenticación

El filtro intercepta cada solicitud, extrae el token del header y, si es válido, establece el contexto de seguridad:

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = authHeader.substring(7);
        String username = jwtService.extractUsername(token);

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = userDetailsService.loadUserByUsername(username);

            if (jwtService.isTokenValid(token, userDetails)) {
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
```

## Configuración de Spring Security

Con Spring Security 6, la configuración se hace vía `SecurityFilterChain` en lugar de extender `WebSecurityConfigurerAdapter`:

```java
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final UserDetailsService userDetailsService;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .anyRequest().authenticated()
            )
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            .authenticationProvider(authenticationProvider())
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

Los puntos clave de esta configuración son:

- **CSRF deshabilitado**: las APIs stateless no usan cookies de sesión, así que CSRF no aplica.
- **SessionCreationPolicy.STATELESS**: Spring no crea ni usa sesiones HTTP.
- **addFilterBefore**: el filtro JWT se ejecuta antes del filtro de autenticación estándar.

## Endpoint de login

El controlador de autenticación recibe credenciales y devuelve un token:

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getUsername(),
                        request.getPassword()
                )
        );

        UserDetails user = userDetailsService.loadUserByUsername(request.getUsername());
        String token = jwtService.generateToken(user);

        return ResponseEntity.ok(new AuthResponse(token));
    }
}
```

Con los records de Java:

```java
public record LoginRequest(String username, String password) {}
public record AuthResponse(String token) {}
```

## Flujo completo

El flujo de autenticación es el siguiente:

1. El cliente envía `POST /api/auth/login` con usuario y contraseña.
2. El servidor valida las credenciales con `AuthenticationManager`.
3. Si son correctas, genera un JWT y lo devuelve al cliente.
4. En las solicitudes siguientes, el cliente incluye el token en el header `Authorization: Bearer <token>`.
5. El `JwtAuthenticationFilter` valida el token y establece el contexto de seguridad.
6. Spring Security permite o deniega el acceso según la configuración de rutas.

## Manejo de errores

Por defecto, Spring Security devuelve un 403 genérico cuando el token es inválido o expiró. Para personalizar la respuesta, implementa `AuthenticationEntryPoint`:

```java
@Component
public class JwtAuthEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthAuthenticationException authException
    ) throws IOException {
        response.setContentType("application/json");
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.getWriter().write("{\"error\": \"Token inválido o expirado\"}");
    }
}
```

Luego regístrala en `SecurityConfig`:

```java
http.exceptionHandling(ex -> ex.authenticationEntryPoint(authEntryPoint));
```

## Buenas prácticas

1. **Nunca expongas la clave secreta en el código fuente**. Usa variables de entorno o un gestor de secretos como AWS Secrets Manager o Vault.
2. **Define tiempos de expiración cortos** para los access tokens y usa refresh tokens para renovarlos.
3. **No almacenes información sensible en el payload** del JWT, ya que es decodificable por cualquiera.
4. **Usa HTTPS siempre**. Un token interceptado en texto plano compromete la cuenta completa.
5. **Valida el algoritmo explícitamente** en el parser para evitar el ataque de algoritmo `none`.
6. **Registra intentos fallidos** para detectar ataques de fuerza bruta.

## Conclusión

Spring Security y JWT forman una combinación robusta para APIs stateless. La configuración inicial requiere varias piezas —el servicio de tokens, el filtro, el proveedor de autenticación— pero una vez ensambladas, el flujo es claro y extensible.

El esquema que vimos aquí cubre el 80% de los casos reales: login con usuario y contraseña, generación de token y validación por filtro en cada solicitud. A partir de ahí, puedes extenderlo con roles, refresh tokens o autenticación OAuth2 según las necesidades del proyecto.
