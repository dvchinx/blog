---
titulo: "WebSocket en Spring Boot: tiempo real con STOMP, seguridad JWT y escalado con RabbitMQ"
seoTitulo: "WebSocket en Spring Boot: STOMP, JWT y escalado"
fecha: "2026-11-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "WebSocket en Spring Boot 4 con STOMP: notificaciones y chat en tiempo real, autenticación con JWT, broker relay con RabbitMQ para escalar y pruebas."
imagenPortada: "https://i.imgur.com/wAiNU8D.png"
etiquetas: ["Spring Boot", "Microservicios", "Mensajería", "RabbitMQ", "Spring Security", "Java", "Backend"]
categoria: "tech"
keywords: "websocket spring boot, websockets en spring boot, spring boot websocket stomp, stomp spring boot, qué es stomp, websocket vs sse, websocket vs http polling, @messagemapping spring, simpmessagingtemplate, websocket jwt spring security, @enablewebsocketsecurity csrf, broker relay rabbitmq stomp, escalar websocket varias instancias, websocket kubernetes, notificaciones en tiempo real spring boot, chat spring boot websocket, sockjs spring boot, stompjs cliente, spring boot 4 websocket"
---

# WebSocket en Spring Boot: tiempo real con STOMP, seguridad JWT y escalado con RabbitMQ

Tarde o temprano, alguien pide que la pantalla "se actualice sola": el estado de un pedido que cambia sin pulsar F5, una notificación que aparece al instante, un tablero que refleja lo que hace el resto del equipo, un chat. Con HTTP clásico la única forma es preguntar al servidor una y otra vez si hay algo nuevo, y casi siempre la respuesta es que no. Montar **WebSocket en Spring Boot** resuelve esa conversación de raíz: una sola conexión abierta por la que el servidor empuja datos cuando ocurren, y por la que el cliente también puede hablar.

El "hola mundo" es corto y está en todas partes; lo que casi ningún tutorial cubre es lo que pasa después. Cómo autenticar la conexión con el mismo JWT que usa tu API REST, por qué `@EnableWebSocketSecurity` rechaza tus conexiones con un error de CSRF que no esperabas, por qué los mensajes dejan de llegar en cuanto despliegas una segunda réplica, o qué hace el Ingress con una conexión que lleva una hora abierta. En esta guía construimos un servicio de notificaciones y chat con **Spring Boot 4.1 y STOMP**, lo protegemos con JWT, lo escalamos con RabbitMQ como broker relay y lo probamos con un test de integración real.

## ¿Qué es WebSocket?

**WebSocket** es un protocolo, definido en el [RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455), que mantiene una conexión TCP abierta y **bidireccional** entre cliente y servidor. Empieza como una petición HTTP normal con la cabecera `Upgrade: websocket`; si el servidor acepta, responde `101 Switching Protocols` y, a partir de ahí, ambos extremos intercambian mensajes (frames) cuando quieran, sin cabeceras HTTP por mensaje.

La diferencia con HTTP no es la velocidad de cada mensaje, sino **quién inicia la conversación**. En HTTP el cliente pregunta y el servidor responde; en WebSocket el servidor puede enviar datos en el momento en que se producen. Eso elimina las peticiones vacías del *polling* y reduce la latencia a lo que tarda un paquete en viajar.

## WebSocket vs HTTP polling vs SSE: ¿cuál necesitas?

![Comparación de HTTP polling, Server-Sent Events y WebSocket: peticiones repetidas, flujo de eventos del servidor al cliente y conexión bidireccional única](/diagrams/2026/11/websocket-spring-boot/websocket-vs-sse-vs-http-polling.png)

Antes de abrir sockets conviene descartar las alternativas más simples, porque WebSocket tiene un coste operativo real (conexiones de larga duración, balanceadores, estado por conexión):

| Criterio | HTTP polling | Server-Sent Events (SSE) | WebSocket |
|---|---|---|---|
| Dirección | Cliente → servidor (preguntando) | Solo servidor → cliente | Bidireccional |
| Conexión | Una petición por consulta | Una conexión HTTP larga | Una conexión TCP larga tras el *upgrade* |
| Latencia | La del intervalo de sondeo | Inmediata | Inmediata |
| Reconexión | No aplica | Automática en el navegador | La implementas tú (o la librería cliente) |
| Proxies y firewalls | Sin problemas | Sin problemas (es HTTP) | Requiere soporte de `Upgrade` |
| En Spring | `@GetMapping` | `SseEmitter` o `Flux` | `spring-boot-starter-websocket` |
| Caso típico | Datos que cambian cada minutos | Notificaciones, progreso, feeds | Chat, colaboración, juegos, trading |

La regla práctica: si solo el servidor necesita empujar datos (notificaciones, el progreso de un proceso, un feed), **SSE es más sencillo** y viaja por HTTP normal; ya lo vimos con `Flux` en [Spring WebFlux](/2026/06/spring-webflux). Elige **WebSocket** cuando el cliente también envía mensajes con frecuencia, cuando necesitas datos binarios o cuando la latencia en ambos sentidos importa.

## ¿Qué es STOMP y por qué usarlo con WebSocket?

WebSocket solo transporta mensajes: no dice a quién van, qué formato tienen ni cómo suscribirse a algo. Si lo usas "en crudo" con un `WebSocketHandler`, tendrás que inventar tu propio mini protocolo (`{"tipo":"suscribir","canal":"sala-1"}`) y tu propio enrutamiento.

**STOMP** (Simple Text Oriented Messaging Protocol) es un protocolo de mensajería sencillo que viaja encima de WebSocket y aporta exactamente eso: comandos (`CONNECT`, `SUBSCRIBE`, `SEND`, `MESSAGE`), destinos con forma de ruta (`/topic/sala-1`) y cabeceras. Spring lo soporta de primera clase, y a cambio obtienes un modelo de programación igual al de Spring MVC: métodos anotados con `@MessageMapping`, un `SimpMessagingTemplate` para enviar desde cualquier parte y la posibilidad de enchufar un broker real como RabbitMQ sin cambiar el código de negocio.

Usa WebSocket crudo para casos muy específicos (un protocolo binario propio, un único flujo de datos por conexión). Para casi todo lo demás, **Spring Boot con WebSocket y STOMP** te ahorra semanas.

## Cómo fluyen los mensajes STOMP en Spring

![Flujo de mensajes STOMP en Spring Boot: el cliente envía a /app, el método @MessageMapping procesa y publica en /topic a través del broker, que reparte el mensaje a todos los suscriptores](/diagrams/2026/11/websocket-spring-boot/flujo-mensajes-stomp-spring-boot.png)

Hay dos tipos de destino y conviene tenerlos claros desde el principio:

- **Destinos de aplicación** (prefijo `/app`): los mensajes que el cliente envía ahí llegan a tus métodos `@MessageMapping`. Es el equivalente a un endpoint REST.
- **Destinos del broker** (prefijos `/topic` y `/queue`): el broker los reparte a todos los clientes suscritos. Por convención, `/topic` es publicación a muchos y `/queue` es para un usuario concreto.

Internamente, Spring conecta tres canales: `clientInboundChannel` (lo que llega de los clientes), `brokerChannel` (lo que la aplicación publica) y `clientOutboundChannel` (lo que sale hacia los clientes). Saberlo es útil porque es ahí donde se enchufan los interceptores de seguridad y donde se ajusta el rendimiento.

## Paso 1: configurar WebSocket con STOMP en Spring Boot

La dependencia es el starter de siempre. En Spring Boot 4 su autoconfiguración vive en el nuevo módulo `spring-boot-websocket`, pero el nombre del starter no cambia:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

La configuración de STOMP se declara con `@EnableWebSocketMessageBroker`:

```java
@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final TaskScheduler heartbeatScheduler;

    WebSocketConfig(@Lazy TaskScheduler heartbeatScheduler) {
        this.heartbeatScheduler = heartbeatScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                // Nunca "*" en producción: cualquier web podría abrir sockets en nombre del usuario
                .setAllowedOriginPatterns("https://app.miempresa.com", "http://localhost:5173");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Lo que el cliente envía a /app/** llega a los @MessageMapping
        registry.setApplicationDestinationPrefixes("/app");
        // Broker en memoria para /topic (difusión) y /queue (por usuario)
        registry.enableSimpleBroker("/topic", "/queue")
                // Latidos cada 10 s en ambos sentidos: detectan conexiones muertas
                .setHeartbeatValue(new long[] {10_000, 10_000})
                .setTaskScheduler(heartbeatScheduler);
        // Prefijo de los destinos privados: /user/queue/notificaciones
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
                .setMessageSizeLimit(64 * 1024)        // tamaño máximo de un mensaje entrante
                .setSendBufferSizeLimit(512 * 1024)    // buffer por sesión para clientes lentos
                .setSendTimeLimit(10_000);             // tras 10 s sin poder enviar, se cierra la sesión
    }
}
```

Tres detalles que suelen faltar en los ejemplos:

- **`setAllowedOriginPatterns`**. Los navegadores no aplican la política del mismo origen a WebSocket. Si permites cualquier origen y autenticas con cookies, una web maliciosa puede abrir un socket con la sesión del usuario. Spring restringe por defecto al mismo origen; si tu frontend vive en otro dominio, enuméralo explícitamente.
- **Los latidos (heartbeats)**. Una conexión cuyo cliente se quedó sin batería no envía ningún `close`; sin latidos, el servidor la mantiene abierta indefinidamente. El broker simple solo los envía si le das un `TaskScheduler`; Spring Boot ya autoconfigura uno y el `@Lazy` evita una dependencia circular durante el arranque.
- **Los límites de transporte**. Un cliente lento que no consume mensajes hace crecer el buffer de su sesión. `setSendTimeLimit` y `setSendBufferSizeLimit` cortan esa sesión antes de que se coma la memoria del pod.

¿Y SockJS? Era el *fallback* para navegadores y proxies que no soportaban WebSocket. Hoy todos los navegadores lo soportan y SockJS añade peso al cliente y complica la depuración; actívalo con `.withSockJS()` solo si tienes clientes detrás de proxies corporativos que eliminan la cabecera `Upgrade`.

## Paso 2: controladores con @MessageMapping y SimpMessagingTemplate

Un chat por salas y unas notificaciones privadas cubren los dos patrones que vas a usar el 90 % del tiempo:

```java
public record MensajeChat(String sala, String texto) {}
public record MensajePublicado(String sala, String autor, String texto, Instant enviadoEn) {}

@Controller
class ChatController {

    private final ModeracionService moderacion;

    ChatController(ModeracionService moderacion) {
        this.moderacion = moderacion;
    }

    // El cliente envía a /app/chat.{sala}; el resultado se publica en /topic/chat.{sala}
    @MessageMapping("/chat.{sala}")
    @SendTo("/topic/chat.{sala}")
    MensajePublicado enviar(@DestinationVariable String sala,
                            @Payload @Valid MensajeChat mensaje,
                            Principal usuario) {
        // El autor sale del usuario autenticado, nunca del payload
        String texto = moderacion.limpiar(mensaje.texto());
        return new MensajePublicado(sala, usuario.getName(), texto, Instant.now());
    }

    // Los errores de este controlador vuelven SOLO al usuario que envió el mensaje
    @MessageExceptionHandler
    @SendToUser(destinations = "/queue/errores", broadcast = false)
    String error(Exception e) {
        return e.getMessage();
    }
}
```

El método se parece mucho a un controlador REST: `@DestinationVariable` es el `@PathVariable` de STOMP, `@Payload` deserializa el JSON con Jackson y `Principal` es el usuario autenticado de la conexión. Para que `@Valid` funcione en mensajes basta con tener la dependencia de validación, igual que en la [validación con Spring Boot](/2026/06/spring-boot-validation).

Las notificaciones, en cambio, no nacen de un mensaje del cliente: nacen de algo que ocurre en el backend (un pedido que cambia de estado, un pago confirmado). Para eso está `SimpMessagingTemplate`, que puedes inyectar en cualquier bean:

```java
@Component
class NotificadorPedidos {

    private final SimpMessagingTemplate mensajeria;

    NotificadorPedidos(SimpMessagingTemplate mensajeria) {
        this.mensajeria = mensajeria;
    }

    // Se ejecuta solo si la transacción que cambió el pedido llegó a confirmarse
    @TransactionalEventListener
    void alCambiarEstado(PedidoActualizado evento) {
        // Llega a /user/queue/pedidos de TODAS las sesiones abiertas de ese usuario
        mensajeria.convertAndSendToUser(
                evento.clienteId(),
                "/queue/pedidos",
                new EstadoPedido(evento.pedidoId(), evento.estado()));
    }
}
```

Combinarlo con `@TransactionalEventListener`, como vimos en [Spring Events](/2026/07/spring-events), evita un error clásico: notificar al usuario de un cambio que luego hace *rollback*. El nombre que pasas a `convertAndSendToUser` debe coincidir con `Principal.getName()` de la conexión; si autenticas con JWT, normalmente es el `sub` del token.

## Paso 3: el cliente en el navegador con @stomp/stompjs

En el frontend, la librería de referencia es `@stomp/stompjs`, que gestiona la reconexión y los latidos:

```javascript
import { Client } from '@stomp/stompjs';

const cliente = new Client({
  brokerURL: 'wss://api.miempresa.com/ws',
  // Se reevalúa en cada reconexión: así siempre viaja un token vigente
  beforeConnect: async () => {
    cliente.connectHeaders = { Authorization: `Bearer ${await obtenerToken()}` };
  },
  reconnectDelay: 5000,
  heartbeatIncoming: 10000,
  heartbeatOutgoing: 10000,
});

cliente.onConnect = () => {
  cliente.subscribe('/topic/chat.general', (frame) => pintarMensaje(JSON.parse(frame.body)));
  cliente.subscribe('/user/queue/pedidos', (frame) => mostrarAviso(JSON.parse(frame.body)));
  cliente.subscribe('/user/queue/errores', (frame) => console.warn(frame.body));
};

cliente.activate();

function enviar(texto) {
  cliente.publish({
    destination: '/app/chat.general',
    body: JSON.stringify({ sala: 'general', texto }),
  });
}
```

Fíjate en que el token viaja en las **cabeceras del frame `CONNECT`**, no en la URL. La API WebSocket del navegador no permite añadir cabeceras al *handshake* HTTP, y un token en la *query string* acaba en los logs del balanceador y del servidor. Las cabeceras STOMP no tienen ese problema.

## Paso 4: autenticación WebSocket con JWT y Spring Security

Aquí es donde la mayoría de proyectos se atascan. Si tu API REST ya valida JWT (por ejemplo, de Keycloak, como en [Keycloak con Spring Boot](/2026/10/keycloak-spring-boot)), lo natural es reutilizar el mismo `JwtDecoder` para autenticar el `CONNECT`. Lo hacemos con un `ChannelInterceptor`:

```java
@Configuration
@Order(Ordered.HIGHEST_PRECEDENCE + 99) // antes que los interceptores de Spring Security
class StompAuthConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtDecoder jwtDecoder;
    private final JwtAuthenticationConverter converter = new JwtAuthenticationConverter();

    StompAuthConfig(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String header = accessor.getFirstNativeHeader("Authorization");
                    if (header == null || !header.startsWith("Bearer ")) {
                        throw new BadCredentialsException("Falta el token");
                    }
                    // Valida firma, emisor y expiración igual que la API REST
                    Jwt jwt = jwtDecoder.decode(header.substring(7));
                    // Spring asocia este usuario a todos los mensajes de la sesión
                    accessor.setUser(converter.convert(jwt));
                }
                return message;
            }
        });
    }
}
```

Solo hace falta autenticar el `CONNECT`: Spring guarda el usuario en la sesión WebSocket y lo asocia a cada mensaje posterior, tal y como describe la [documentación de autenticación por token de Spring](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/authentication-token-based.html). El `@Order` es obligatorio cuando además usas la autorización de Spring Security: si el interceptor de autorización se ejecuta antes, verá un usuario anónimo.

### La trampa de @EnableWebSocketSecurity y el CSRF

Lo siguiente es autorizar por destino: quién puede suscribirse a qué. Spring Security 7 lo hace con `@EnableWebSocketSecurity` y un `AuthorizationManager<Message<?>>`. Pero la anotación **exige un token CSRF en cada `CONNECT`** y, según la [documentación de seguridad WebSocket de Spring Security](https://docs.spring.io/spring-security/reference/servlet/integrations/websocket.html), todavía no permite desactivarlo. Pensado para aplicaciones con sesión y cookies tiene sentido; para un cliente SPA que se autentica con un JWT en la cabecera, solo produce conexiones rechazadas con `Could not verify the provided CSRF token`.

Como el JWT viaja en una cabecera que una web ajena no puede leer ni falsificar, el CSRF no aporta nada en este escenario. La solución documentada es montar los interceptores a mano, sin el de CSRF:

```java
@Configuration
class StompAuthorizationConfig implements WebSocketMessageBrokerConfigurer {

    private final ApplicationContext context;

    StompAuthorizationConfig(ApplicationContext context) {
        this.context = context;
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        AuthorizationManager<Message<?>> reglas = MessageMatcherDelegatingAuthorizationManager.builder()
                .nullDestMatcher().authenticated()                       // CONNECT, DISCONNECT, latidos
                .simpSubscribeDestMatchers("/user/queue/**").authenticated()
                .simpSubscribeDestMatchers("/topic/chat.*").hasRole("CHAT")
                .simpDestMatchers("/app/**").hasRole("CHAT")
                .anyMessage().denyAll()                                  // todo lo demás, fuera
                .build();

        AuthorizationChannelInterceptor autorizacion = new AuthorizationChannelInterceptor(reglas);
        autorizacion.setAuthorizationEventPublisher(new SpringAuthorizationEventPublisher(context));
        // Primero el contexto de seguridad, luego la autorización
        registration.interceptors(new SecurityContextChannelInterceptor(), autorizacion);
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        // Permite @AuthenticationPrincipal Jwt jwt en los métodos @MessageMapping
        resolvers.add(new AuthenticationPrincipalArgumentResolver());
    }
}
```

El `anyMessage().denyAll()` final es la pieza más importante: sin él, un destino que olvidaste listar queda abierto a cualquiera. Y recuerda la otra cara: con una sesión de cookies (sin JWT) sí debes usar `@EnableWebSocketSecurity` y enviar el token CSRF en el `CONNECT`.

Un último matiz de seguridad: **el JWT se valida al conectar, no en cada mensaje**. Una conexión abierta sigue viva aunque el token caduque diez minutos después. Si necesitas cortar el acceso al revocar un usuario, guarda la expiración en los atributos de sesión y cierra las sesiones vencidas desde un `@Scheduled`, o fuerza la reconexión periódica desde el cliente.

## Paso 5: escalar WebSocket a varias instancias con RabbitMQ

El broker simple funciona en memoria, y esa es su limitación: **solo conoce las conexiones de su propia instancia**. Con dos réplicas detrás de un balanceador, el usuario A conectado a la instancia 1 nunca recibirá el mensaje que el usuario B publicó en la instancia 2. Funciona en local, falla en producción y suele descubrirse el día que escalas.

![Escalar WebSocket en Spring Boot con broker relay: varias instancias detrás de un balanceador conectadas por STOMP al puerto 61613 de RabbitMQ, que reparte cada mensaje a todas](/diagrams/2026/11/websocket-spring-boot/escalar-websocket-broker-relay-rabbitmq.png)

La solución es el **broker relay**: cada instancia reenvía las suscripciones y los mensajes a un broker STOMP externo (RabbitMQ o ActiveMQ), que se encarga de repartirlos a todas. Si ya usas RabbitMQ con [Spring AMQP](/2026/07/spring-amqp-rabbitmq), solo hay que activar su plugin STOMP:

```bash
# Habilita STOMP en RabbitMQ (escucha en el puerto 61613)
rabbitmq-plugins enable rabbitmq_stomp

# O con Docker, usando una imagen con el plugin activado
docker run -d --name rabbitmq -p 5672:5672 -p 61613:61613 -p 15672:15672 \
  rabbitmq:4-management \
  sh -c "rabbitmq-plugins enable --offline rabbitmq_stomp && rabbitmq-server"
```

El relay usa Reactor Netty para la conexión TCP con el broker, así que añade la dependencia (su versión la gestiona Spring Boot):

```xml
<dependency>
    <groupId>io.projectreactor.netty</groupId>
    <artifactId>reactor-netty</artifactId>
</dependency>
```

Y en la configuración, cambia `enableSimpleBroker` por `enableStompBrokerRelay`:

```java
@Override
public void configureMessageBroker(MessageBrokerRegistry registry) {
    registry.setApplicationDestinationPrefixes("/app");
    registry.setUserDestinationPrefix("/user");
    registry.enableStompBrokerRelay("/topic", "/queue")
            .setRelayHost(props.host())
            .setRelayPort(61613)
            // Conexión "de sistema" compartida para lo que publica el servidor
            .setSystemLogin(props.usuario())
            .setSystemPasscode(props.password())
            // Credenciales de las conexiones de cada cliente (sustituyen a las que envíe el navegador)
            .setClientLogin(props.usuario())
            .setClientPasscode(props.password())
            // Imprescindibles con varias instancias para que convertAndSendToUser
            // encuentre al usuario aunque esté conectado a otra réplica
            .setUserDestinationBroadcast("/topic/unresolved-user-destination")
            .setUserRegistryBroadcast("/topic/simp-user-registry");
}
```

Las dos últimas líneas son las que casi nadie menciona. Sin ellas, `/topic` funciona entre instancias, pero las notificaciones privadas (`/user/queue/...`) siguen perdiéndose: la instancia que publica no sabe en qué réplica está conectado el usuario. Con el *broadcast*, los mensajes que no puede resolver localmente se difunden a las demás, y cada instancia comparte su registro de usuarios.

Dos avisos sobre RabbitMQ como broker STOMP. Primero, usa **puntos** en los nombres de destino (`/topic/chat.general`, no `/topic/chat/general`): RabbitMQ los traduce a *routing keys* de un exchange `amq.topic`, donde la barra no funciona como separador jerárquico. Segundo, el relay convierte RabbitMQ en una dependencia crítica del tiempo real: si cae, Spring publica un `BrokerAvailabilityEvent` que puedes escuchar para marcar el servicio como degradado en los *health checks* de [Spring Boot Actuator](/2026/06/spring-boot-actuator).

## Paso 6: WebSocket en Kubernetes y detrás de un proxy

Las conexiones de larga duración rompen varias suposiciones de la infraestructura pensada para peticiones cortas. Si despliegas como en [Spring Boot en Kubernetes](/2026/10/spring-boot-kubernetes), revisa estos puntos:

- **El proxy debe propagar el `Upgrade`.** En NGINX, la configuración mínima es:

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # Por defecto NGINX corta a los 60 s sin tráfico; los latidos de 10 s lo evitan,
    # pero un margen mayor protege ante clientes lentos
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

- **Timeouts de inactividad del balanceador.** Los balanceadores de nube también cierran conexiones inactivas (a menudo a los 60 s). Los latidos STOMP de 10 s mantienen la conexión con tráfico y evitan esos cortes silenciosos.
- **Sesiones pegajosas solo si usas SockJS.** Con WebSocket puro, la conexión ya está "pegada" a un pod mientras dura. SockJS, en cambio, usa varias peticiones HTTP en sus transportes de *fallback* y necesita afinidad de sesión.
- **Despliegues y reconexiones en masa.** Cuando un pod se apaga, todos sus clientes se reconectan a la vez a los pods restantes. Usa un `reconnectDelay` con algo de aleatoriedad en el cliente, un `preStop` que dé tiempo a cerrar y un despliegue gradual para no provocar picos.
- **Muchas conexiones, pocos hilos.** Una conexión abierta no ocupa un hilo mientras está inactiva, pero los canales de entrada y salida sí usan pools. Con Java 21 o superior, activar `spring.threads.virtual.enabled=true`, como vimos en [Virtual Threads en Spring Boot](/2026/09/spring-virtual-threads), simplifica el dimensionado; evita igualmente las llamadas bloqueantes largas dentro de los `@MessageMapping`.

Y si el orden importa (por ejemplo, actualizaciones de estado de un mismo pedido), activa `registry.setPreservePublishOrder(true)`: por defecto, los mensajes de una misma sesión salen por un pool de hilos y pueden llegar desordenados.

## Paso 7: probar WebSocket con un test de integración

Los WebSockets se prueban mejor de extremo a extremo: levantar la aplicación en un puerto aleatorio y conectar un cliente STOMP de Java real. Spring incluye `WebSocketStompClient`:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ChatWebSocketIT {

    @LocalServerPort int puerto;
    @Autowired TokenDePrueba tokens; // genera JWT firmados con la clave de test

    @Test
    void unMensajeEnviadoLlegaATodosLosSuscriptores() throws Exception {
        WebSocketStompClient cliente = new WebSocketStompClient(new StandardWebSocketClient());
        cliente.setMessageConverter(new JacksonJsonMessageConverter());

        StompHeaders connect = new StompHeaders();
        connect.add("Authorization", "Bearer " + tokens.conRol("CHAT", "ana"));

        StompSession sesion = cliente
                .connectAsync("ws://localhost:" + puerto + "/ws",
                        new WebSocketHttpHeaders(), connect, new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS);

        BlockingQueue<MensajePublicado> recibidos = new LinkedBlockingQueue<>();
        sesion.subscribe("/topic/chat.general", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return MensajePublicado.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                recibidos.add((MensajePublicado) payload);
            }
        });

        sesion.send("/app/chat.general", new MensajeChat("general", "hola"));

        MensajePublicado mensaje = recibidos.poll(5, TimeUnit.SECONDS);
        assertThat(mensaje).isNotNull();
        assertThat(mensaje.autor()).isEqualTo("ana"); // sale del JWT, no del payload
    }

    @Test
    void sinTokenLaConexionSeRechaza() {
        WebSocketStompClient cliente = new WebSocketStompClient(new StandardWebSocketClient());
        assertThatThrownBy(() -> cliente
                .connectAsync("ws://localhost:" + puerto + "/ws", new StompSessionHandlerAdapter() {})
                .get(5, TimeUnit.SECONDS))
                .isInstanceOf(ExecutionException.class);
    }
}
```

`JacksonJsonMessageConverter` es el conversor basado en Jackson 3 que trae Spring Framework 7; si sigues en Spring Boot 3, usa `MappingJackson2MessageConverter`. Para probar el broker relay, levanta RabbitMQ con [Testcontainers](/2026/07/spring-testcontainers) y conecta dos clientes a dos contextos distintos: es la única forma fiable de verificar que los mensajes cruzan instancias.

## Riesgos y trade-offs de WebSocket

- **Estado en el servidor.** Cada conexión es estado vivo en un pod concreto. Desplegar, escalar a cero o mover pods tiene un coste visible para los usuarios (reconexiones), algo que no ocurre con una API REST sin estado.
- **Mensajes perdidos durante la reconexión.** STOMP sobre un broker simple no guarda nada: lo que se publica mientras el cliente está reconectando se pierde. Si cada evento importa, trata el WebSocket como un aviso y que el cliente recupere el estado completo por REST al reconectar.
- **El broker como punto crítico.** Con relay, RabbitMQ pasa a estar en la ruta de cada mensaje en tiempo real. Necesita alta disponibilidad, monitorización y alertas propias.
- **Observabilidad más difícil.** No hay códigos de estado HTTP por mensaje ni trazas automáticas por frame. Registra los eventos `SessionConnectedEvent` y `SessionDisconnectEvent`, exporta el número de sesiones activas como métrica y revisa las estadísticas que Spring publica en el log (`WebSocketMessageBrokerStats`).
- **Seguridad por conexión, no por petición.** La autorización se decide al conectar y al suscribirse; los permisos revocados no afectan a conexiones ya abiertas si no lo gestionas explícitamente.

## ¿Cuándo usar WebSocket en Spring Boot y cuándo no?

**Usa WebSocket** cuando hay comunicación frecuente en ambos sentidos y la latencia se nota: chats, edición colaborativa, tableros compartidos, juegos, cotizaciones o paneles operativos donde varios usuarios actúan sobre los mismos datos. También cuando necesitas suscripciones dinámicas a muchos canales distintos sobre una sola conexión.

**Probablemente no lo necesitas** si solo el servidor empuja datos (SSE es más simple y viaja por HTTP), si las actualizaciones llegan cada varios minutos (un *polling* con caché HTTP es suficiente y no tiene estado), o si lo que quieres es comunicación entre microservicios: para eso son mejores Kafka, RabbitMQ con AMQP o [gRPC con streaming](/2026/09/grpc-protocol-buffers). Y si ya expones una API GraphQL, las *subscriptions* de [Spring GraphQL](/2026/09/spring-graphql) te dan tiempo real sobre WebSocket sin un segundo protocolo.

## Buenas prácticas

1. **Usa STOMP salvo que tengas una razón concreta** para un protocolo propio sobre WebSocket crudo.
2. **Restringe los orígenes permitidos** y nunca uses `*` con autenticación por cookies.
3. **Autentica en el `CONNECT` con el mismo JWT de tu API**, enviado en cabeceras STOMP y nunca en la URL.
4. **Autoriza por destino** con `AuthorizationManager` y termina siempre con `anyMessage().denyAll()`.
5. **Toma la identidad del `Principal`**, nunca de un campo del mensaje que el cliente pueda falsificar.
6. **Activa latidos** en servidor y cliente, y limita tamaño de mensaje, buffer y tiempo de envío.
7. **Pasa a broker relay antes de tener dos réplicas**, con el *broadcast* de destinos de usuario configurado.
8. **Diseña para la reconexión**: el cliente debe reconectar con espera aleatoria y recuperar el estado por REST.
9. **No bloquees en los `@MessageMapping`**: delega el trabajo pesado y publica el resultado con `SimpMessagingTemplate`.
10. **Mide sesiones activas, reconexiones y mensajes por segundo**, y prueba con un cliente STOMP real en el pipeline.

## Preguntas frecuentes

### ¿Qué diferencia hay entre WebSocket y STOMP?

WebSocket es el protocolo de transporte: abre una conexión bidireccional y mueve mensajes, sin definir su formato ni su destino. STOMP es un protocolo de mensajería que viaja encima de WebSocket y añade comandos (`SUBSCRIBE`, `SEND`), destinos y cabeceras. En Spring Boot, STOMP es lo que permite usar `@MessageMapping`, suscripciones por tema y un broker externo.

### ¿Cuándo usar WebSocket y cuándo Server-Sent Events?

Usa SSE cuando solo el servidor necesita enviar datos al cliente, como notificaciones o el progreso de una tarea: es más sencillo, viaja por HTTP estándar y el navegador reconecta solo. Usa WebSocket cuando el cliente también envía mensajes con frecuencia, como en un chat o una herramienta colaborativa, o cuando necesitas datos binarios.

### ¿Cómo autenticar un WebSocket con JWT en Spring Boot?

Envía el token en la cabecera `Authorization` del frame STOMP `CONNECT` y valídalo en un `ChannelInterceptor` registrado en `configureClientInboundChannel`, usando el `JwtDecoder` de tu API. Si el token es válido, asigna el usuario con `accessor.setUser(...)` y Spring lo asociará a todos los mensajes de la sesión. Ordena ese interceptor antes de los de Spring Security.

### ¿Por qué @EnableWebSocketSecurity rechaza mi conexión con un error de CSRF?

Porque, por defecto, exige un token CSRF en cada `CONNECT` y en Spring Security 7 no se puede desactivar desde la anotación. Es correcto para aplicaciones con sesión basada en cookies, pero si te autenticas con un JWT en cabecera no aporta protección: registra a mano `SecurityContextChannelInterceptor` y `AuthorizationChannelInterceptor` con tus reglas, sin el interceptor de CSRF.

### ¿Cómo escalar WebSocket con varias instancias de Spring Boot?

Sustituye el broker simple en memoria por un broker relay con `enableStompBrokerRelay`, apuntando a RabbitMQ con el plugin STOMP o a ActiveMQ. El broker reparte los mensajes a todas las instancias. Para que los mensajes privados a un usuario también crucen réplicas, configura `setUserDestinationBroadcast` y `setUserRegistryBroadcast`.

### ¿Sigue siendo necesario SockJS?

En la mayoría de los casos, no: todos los navegadores modernos soportan WebSocket. SockJS solo tiene sentido si tus usuarios están detrás de proxies o firewalls corporativos que bloquean el *upgrade* de WebSocket. Añade peso al cliente, complica la depuración y, en varias réplicas, obliga a usar sesiones pegajosas.

## Conclusión

Configurar WebSocket en Spring Boot lleva diez minutos; dejarlo listo para producción lleva más, y casi todo el trabajo está fuera del controlador. Con STOMP obtienes un modelo de programación familiar (`@MessageMapping`, `SimpMessagingTemplate`, destinos por tema y por usuario), pero la seguridad, el escalado y la infraestructura son los que deciden si el tiempo real funciona el día que tienes miles de conexiones y tres réplicas.

Si te quedas con lo esencial: confirma primero que no te basta con SSE, autentica el `CONNECT` con el JWT de tu API y autoriza cada destino con un `denyAll` al final, cuidado con el CSRF de `@EnableWebSocketSecurity` si usas tokens, activa latidos y límites de transporte, cambia al broker relay con RabbitMQ antes de escalar (con el *broadcast* de usuarios configurado) y diseña el cliente para reconectar y recuperar el estado. Con esas piezas, la pantalla que "se actualiza sola" deja de ser una demo y se convierte en una funcionalidad en la que puedes confiar.
