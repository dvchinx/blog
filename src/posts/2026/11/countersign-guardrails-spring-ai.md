---
titulo: "Countersign: guardrails para agentes de Spring AI con políticas, aprobación humana y recibos firmados"
seoTitulo: "Guardrails en Spring AI: Countersign para agentes Java"
fecha: "2026-11-26"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Guardrails para agentes de Spring AI con Countersign: políticas fail-closed, aprobación humana y recibos firmados para cada llamada a herramientas y MCP."
imagenPortada: "https://i.imgur.com/v4ofOL5.png"
etiquetas: ["Spring AI", "Spring Boot", "Inteligencia Artificial", "Seguridad IA", "Open Source", "Java", "Backend"]
categoria: "tech"
keywords: "guardrails spring ai, guardrails para agentes de ia, guardrails agentes ia java, countersign, countersign spring boot starter, aprobación humana spring ai, human in the loop spring ai, tool calling seguro spring ai, políticas para herramientas de agentes, auditoría de agentes de ia, recibos firmados ed25519, cadena de hashes auditoría, herramientas mcp seguridad java, requiresapproval spring ai, fail-closed agentes ia, spring ai tool call confirmation, excessive agency owasp llm"
---

# Countersign: guardrails para agentes de Spring AI con políticas, aprobación humana y recibos firmados

Cuando escribí la [guía de Spring AI con Spring Boot](/2026/10/spring-ai-spring-boot) terminé la sección de *tool calling* con una advertencia: una herramienta que mueve dinero o borra datos debería exigir confirmación humana. Era fácil de escribir y difícil de aplicar. Spring AI te da `@Tool`, `ToolContext` y un bucle de herramientas muy cómodo, pero en la versión 2.0 no trae un sitio donde decir "esta llamada no", "esta llamada solo si alguien la aprueba" o "quiero poder demostrar dentro de seis meses quién autorizó esto". Los **guardrails en Spring AI** acababan siendo `if` repartidos por cada método `@Tool`, sin cubrir las herramientas MCP (que no son tu código) y sin un registro fiable de lo que pasó.

Por eso construí **Countersign**, una librería *open source* que acabo de publicar en Maven Central con la versión `0.1.0`. Pone una "contrafirma" a cada acción del agente: el modelo **propone** una llamada a una herramienta y Countersign **decide**, contra políticas declarativas, si se ejecuta, se rechaza o espera a que una persona la apruebe, y deja un **recibo firmado con Ed25519 y encadenado por hash** antes de que se ejecute nada. En este artículo explico el problema que resuelve, cómo funciona por dentro, cómo añadirlo a un proyecto con un starter de Spring Boot, en qué se diferencia de la confirmación nativa que llegó en Spring AI 2.1 y cuándo no te hace falta.

![Demo de Countersign en una terminal: Alice pide al agente bancario una transferencia de 5.000 dólares, la llamada queda esperando aprobación, operaciones la aprueba, la petición de borrar la tabla de transacciones se rechaza y la cadena de recibos se verifica como válida](/diagrams/2026/11/countersign-guardrails-spring-ai/demo-agente-bancario-countersign.gif)

## El problema: el modelo elige qué ejecutar

En el *tool calling*, el modelo nunca ejecuta nada por sí mismo: responde "quiero llamar a `payments_transfer` con `amount=5000`" y es tu aplicación quien ejecuta el método. Eso suena tranquilizador hasta que te das cuenta de que **los argumentos los escribe el modelo**, y el modelo obedece al texto que tiene delante, incluido el que un atacante coló en un correo, un PDF o la respuesta de una API (*prompt injection*). OWASP lo recoge como **Excessive Agency** en su [Top 10 para aplicaciones con LLM](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/): darle a un agente más permisos, más herramientas o más autonomía de la que necesita.

No es un riesgo teórico. En el [cierre de octubre](/2026/10/noticias-ia-cierre-octubre-2026) repasamos el informe del AISI británico sobre un agente de frontera que, durante una evaluación, envió un *pull request* malicioso a un proyecto público de GitHub y creó identidades falsas para presionar al mantenedor, que se negó a aceptarlo. Si eso le pasa a un laboratorio con equipos de seguridad dedicados, tu agente de soporte con acceso a la base de datos también puede equivocarse.

Las soluciones habituales tienen huecos claros:

- **Filtros de prompt y de respuesta**: miran el texto, no la acción. Un `DROP TABLE` bien redactado pasa sin problema.
- **Un `if` dentro de cada `@Tool`**: funciona para tu código, pero no para las herramientas que llegan de un servidor MCP, se olvida en la herramienta nueva y mezcla seguridad con lógica de negocio.
- **Un sidecar de guardrails en Python**: otro servicio que desplegar, otra latencia, y muchas veces un LLM decidiendo si otro LLM puede hacer algo.
- **Logs**: dicen qué pasó, pero cualquiera con acceso a la base de datos puede editarlos. No sirven como prueba.

## ¿Qué son los guardrails para agentes de IA?

Los **guardrails para agentes de IA** son controles que se aplican en tiempo de ejecución sobre lo que un agente puede hacer, no solo sobre lo que dice. Deciden, antes de que una herramienta se ejecute, si la llamada está permitida, debe bloquearse o necesita aprobación humana, y dejan constancia verificable de cada decisión para auditarla después.

La distinción importante es **texto frente a acciones**. Un filtro de contenido evita que el modelo diga algo inapropiado; un guardrail de herramientas evita que el modelo **haga** algo inapropiado. Countersign se centra en lo segundo, así que se usa junto a un filtro de contenido, no en lugar de uno. La idea es la misma que la de Spring Security con los endpoints: igual que no confías en que el frontend oculte un botón, no confías en que el modelo no llame a una herramienta peligrosa.

## Qué es Countersign

**Countersign** es un conjunto de módulos Java con licencia Apache 2.0 que añade guardrails a las llamadas a herramientas de Spring AI: métodos `@Tool`, `ToolCallback` y herramientas MCP. Sus principios de diseño definen su comportamiento:

1. **Fail-closed.** Por defecto, todo lo que ninguna política permite se deniega. Si falla la evaluación de políticas, la aprobación o la firma del recibo, la llamada también se deniega (y con `countersign.audit.strict`, también si el recibo no se puede guardar). Nunca se ejecuta una herramienta en silencio después de un error.
2. **Determinista.** La misma llamada con las mismas políticas da la misma decisión. No hay ningún LLM en el camino de decisión.
3. **Privado por defecto.** Los recibos guardan un hash con clave (HMAC-SHA256) de los argumentos, nunca los valores en crudo.
4. **Sin sorpresas.** Sin políticas, el único efecto es la decisión por defecto (`deny`), y el log de arranque lo dice.
5. **Núcleo sin frameworks.** `countersign-core` solo depende del JDK, JSpecify y una librería JSON; un test de ArchUnit lo garantiza.

La `0.1.0` está construida y probada sobre **Java 21, Spring Boot 4.1.2 y Spring AI 2.0.2**. Es una versión *pre-alpha*: la API puede cambiar antes de la `1.0`, y cada cambio incompatible aparecerá en el CHANGELOG del repositorio.

## Cómo funciona una llamada a herramienta con Countersign

Cada vez que el modelo propone una llamada, Countersign la intercepta **justo donde se ejecuta la herramienta** y sigue cinco pasos:

1. **Construye** un `ToolInvocation`: nombre de la herramienta, argumentos parseados de forma estricta, el usuario en cuyo nombre actúa el agente (*principal*) y el id de conversación.
2. **Evalúa** la invocación contra las políticas, en orden de prioridad. Gana la primera que coincide; si ninguna coincide, se aplica la decisión por defecto. Si la decisión es `REQUIRE_APPROVAL`, espera a que una persona responda o venza el plazo.
3. **Registra** un recibo con la decisión, las políticas que coincidieron, quién aprobó, el HMAC de los argumentos, el hash del recibo anterior y una firma Ed25519.
4. **Publica** el recibo en un `AuditSink` y la decisión en Micrometer.
5. **Aplica** la decisión: si la llamada está permitida o aprobada, ejecuta la herramienta; si no, devuelve un rechazo.

El orden es deliberado: el recibo se firma **antes** de que la herramienta se ejecute. Si la firma falla, la herramienta no corre.

![Diagrama del flujo de una llamada a herramienta con Countersign: el agente LLM propone payments_transfer, el motor de políticas decide ALLOW, REQUIRE_APPROVAL o DENY, la aprobación humana puede ejecutar o rechazar la llamada, y todos los caminos generan un recibo firmado con Ed25519 que va al AuditSink y a Micrometer](/diagrams/2026/11/countersign-guardrails-spring-ai/flujo-llamada-herramienta-countersign-spring-ai.webp)

*Todos los caminos terminan en un recibo firmado. En las llamadas que se ejecutan, ese recibo se firma y se guarda antes de ejecutar la herramienta.*

Cuando una llamada se rechaza, el modelo **no recibe un stack trace**. Recibe un JSON pequeño que puede explicarle al usuario:

```json
{
  "decision":"DENY",
  "invocationId":"…",
  "reason":"Destructive SQL is not allowed from agents",
  "status":"REFUSED",
  "tool":"db_query"
}
```

Ese detalle importa más de lo que parece. Si la herramienta lanzara una excepción, muchos modelos reintentan con argumentos ligeramente distintos hasta que algo pasa. Un rechazo estructurado, con motivo, cierra la puerta y le da al modelo algo que contar: "no he hecho eso porque la política no permite SQL destructivo desde agentes".

### Dónde intercepta: el `ToolCallingManager`

Countersign no envuelve la lista de herramientas que se le envía al modelo, sino el punto donde se ejecutan. Un `BeanPostProcessor` decora los beans `ToolCallingManager` y `ToolCallbackResolver` de Spring AI con `GuardedToolCallingManager` y `GuardedToolCallbackResolver`. El resultado es que quedan protegidas **todas** las herramientas que ejecute un `ChatClient` creado desde el `ChatClient.Builder` autoconfigurado, se hayan registrado como se hayan registrado: `.tools(...)`, `defaultTools(...)`, `ToolCallbackProvider`s (incluidos los clientes MCP) o la resolución por nombre.

![Diagrama de arquitectura de Countersign en Spring AI: el ChatClient pasa por GuardedToolCallingManager, que envuelve el ToolCallingManager y protege métodos @Tool, ToolCallback y herramientas MCP; a la derecha, los puertos ApprovalGateway, AuditSink, ReceiptSigner y DecisionListener, y debajo countersign-core en Java puro](/diagrams/2026/11/countersign-guardrails-spring-ai/arquitectura-countersign-toolcallingmanager.webp)

La consecuencia de diseño es importante: **una herramienta que nunca se le ofreció al modelo, o una que lo engañaron para llamar, igual tiene que pasar por el motor de políticas**. Si construyes tú el cliente con `ChatClient.create(model)`, tiene su propio gestor de herramientas; en ese caso lo envuelves con `GuardedToolCallingManager.guard(...)` o, mejor, inyectas el `ChatClient.Builder`.

## Cómo añadir guardrails a un agente de Spring AI

### 1. Añade el starter

```xml
<dependency>
  <groupId>io.github.dvchinx</groupId>
  <artifactId>countersign-spring-boot-starter</artifactId>
  <version>0.1.0</version>
</dependency>
```

Es la única dependencia obligatoria. Al arrancar verás una línea en el log con las políticas cargadas, la decisión por defecto, el *stream* de recibos y el destino de auditoría.

### 2. Escribe las políticas en `application.yml`

Este es el ejemplo completo del agente bancario que viene en el repositorio. Fíjate en que no hay una sola línea de Countersign en las herramientas: todas las reglas viven en configuración.

```yaml
spring:
  threads:
    virtual:
      enabled: true          # una petición puede esperar minutos a un humano

countersign:
  default-decision: deny     # fail-closed: lo que ninguna política permite, se rechaza
  approval:
    timeout: 60s             # menor que cualquier timeout HTTP delante de /chat
  policies:
    - id: no-destructive-sql
      tools: ["db_*"]
      when: "#args['query'] matches '(?i).*\\b(drop|truncate|delete)\\b.*'"
      decision: deny
      reason: "Destructive SQL is not allowed from agents"
    - id: sql-reads
      tools: ["db_*"]
      when: "#args['query'] matches '(?is)\\s*select\\b.*'"
      decision: allow
    - id: transfers-need-approval
      tools: ["payments_transfer"]
      when: "#args['amount'] > 1000"
      decision: require-approval
      reason: "Transfers above $1,000 need a second person"
    - id: everyday-banking
      tools: ["accounts_balance", "payments_transfer"]
      decision: allow
```

Cada política tiene un `id` (que acaba en el recibo), uno o varios **globs** de nombres de herramienta (`db_*`), una condición opcional `when` y una decisión. El orden importa: gana la primera que coincide, y puedes forzarlo con `priority` (número más bajo, antes). Por eso `no-destructive-sql` va antes que `sql-reads`, y `transfers-need-approval` antes que `everyday-banking`. Un `UPDATE accounts SET balance = 0` no coincide con ninguna política y cae en el `deny` por defecto.

Las condiciones se escriben en **SpEL aislado**: un `SimpleEvaluationContext` de solo lectura, sin referencias a tipos, sin constructores, sin acceso a beans ni llamadas a métodos arbitrarios. Puedes usar `#args`, `#tool`, `#principal` y `#conversationId`. Y una política rota (sin herramientas, con SpEL inválido o con un `id` duplicado) **detiene la aplicación al arrancar** con un mensaje que nombra la propiedad. Una errata nunca deja una herramienta sin proteger en silencio.

Un detalle práctico: OpenAI y Anthropic solo aceptan nombres de herramienta con letras, dígitos, `_` y `-`, hasta 64 caracteres. Llama a tus herramientas `payments_transfer`, no `payments.transfer`. Countersign acepta cualquier nombre (algunos servidores MCP usan puntos), pero el modelo no.

### 3. Tus herramientas no cambian

```java
@Component
public class BankTools {

    @Tool(name = "payments_transfer",
          description = "Transfer money from one of the customer's accounts to another account or a payee")
    public String transfer(
            @ToolParam(description = "Account to debit: checking or savings") String from,
            @ToolParam(description = "Account id or payee name to credit") String to,
            @ToolParam(description = "Amount in dollars") BigDecimal amount) {
        // Lógica real: descuenta, abona y registra la transacción
    }

    @Tool(name = "db_query", description = "Run a SQL statement against the bank database")
    public String query(@ToolParam(description = "One SQL statement") String query) {
        // Ejecuta lo que le llegue: lo que impide un DROP TABLE es la política, no la herramienta
    }
}
```

Lo único que añade el agente es **quién** está pidiendo la acción y en qué conversación, a través del `ToolContext`. Es el mismo principio que en el artículo de Spring AI: la identidad nunca es un parámetro que el modelo pueda inventar.

```java
@Service
public class BankingAgent {

    private final ChatClient chat;
    private final BankTools tools;

    BankingAgent(ChatClient.Builder chat, BankTools tools) {
        this.chat = chat.build();   // el builder autoconfigurado ya viene protegido
        this.tools = tools;
    }

    public String chat(String user, String conversationId, String message) {
        return chat.prompt()
                .user(message)
                .tools(tools)
                .toolContext(Map.of(
                        GuardedToolCallback.PRINCIPAL_KEY, user,              // acaba en el recibo y en #principal
                        GuardedToolCallback.CONVERSATION_ID_KEY, conversationId))
                .call()
                .content();
    }
}
```

En una aplicación real, `user` sale del token del usuario autenticado (por ejemplo, el `sub` de un JWT emitido por [Keycloak con Spring Boot](/2026/10/keycloak-spring-boot)), nunca de un parámetro de la petición.

### La regla en el código: `@RequiresApproval`

Hay reglas que no deberían depender de un fichero de configuración. Para eso está `@RequiresApproval`:

```java
@Tool(name = "payments_transfer", description = "Transfer money between accounts")
@RequiresApproval(reason = "Moves real money")
public TransferResult transfer(String from, String to, BigDecimal amount) { ... }
```

La anotación se convierte en una **política obligatoria**, que solo puede hacer una decisión más estricta: un `allow` configurado no puede saltarse la aprobación, y un `deny` configurado sigue ganando. Countersign la encuentra al arrancar escaneando los paquetes de tu aplicación, así que funciona también con objetos que no son beans (`.tools(new BankTools())`). Y si la pones en un método sin `@Tool`, la aplicación no arranca, en lugar de no hacer nada.

## Aprobación humana (human in the loop) en Spring AI

Una llamada `require-approval` espera la respuesta de un bean `ApprovalGateway`, como mucho `countersign.approval.timeout` (dos minutos por defecto). Si nadie responde, si la respuesta es un rechazo o si no se puede obtener, la llamada se deniega. Sin ningún gateway configurado, se deniega al momento y el arranque te avisa.

Para una pantalla de aprobación dentro de tu propia aplicación basta con el gateway en memoria:

```java
@Bean
InMemoryApprovalGateway approvals() {
    return new InMemoryApprovalGateway();
}
```

Y un controlador que lo exponga. Este fragmento está adaptado del ejemplo bancario (allí la identidad llega en una cabecera `X-User` para que la demo no necesite login) e incluye una regla de **cuatro ojos**: quien pidió la acción no puede aprobarla. `PendingApproval` es un simple `record` con la herramienta, los argumentos, el motivo y el plazo.

```java
@GetMapping("/approvals")
List<PendingApproval> pending() {
    return approvals.pending().stream().map(PendingApproval::of).toList();
}

@PostMapping("/approvals/{invocationId}/approve")
ResponseEntity<String> approve(@PathVariable String invocationId, Principal approver) {
    ApprovalRequest request = approvals.pending().stream()
            .filter(p -> p.invocation().id().equals(invocationId))
            .findFirst().orElse(null);
    if (request == null) {
        return ResponseEntity.notFound().build();
    }
    // Cuatro ojos: quien pidió la acción al agente no puede aprobarla
    if (approver.getName().equals(request.invocation().principal())) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("You cannot answer your own request");
    }
    approvals.approve(invocationId, approver.getName());   // el recibo nombra a quien aprobó
    return ResponseEntity.ok("approved");
}
```

El `ApprovalRequest` contiene los argumentos en crudo, porque nadie puede juzgar "transferir a ACME" sin ver el importe. Pero esos argumentos solo se muestran a quien aprueba: el recibo guarda su HMAC, no los valores.

Si prefieres aprobar desde Slack, Teams o el correo, implementas el puerto, que es una interfaz funcional:

```java
public interface ApprovalGateway {
    CompletionStage<ApprovalDecision> request(ApprovalRequest request);
}
```

Devuelves un `CompletableFuture` que completas con `ApprovalDecision.approved("bob")` o `ApprovalDecision.rejected("bob", "Beneficiario desconocido")` cuando llegue la respuesta. Countersign se encarga del plazo y de denegar si vence.

### Por qué la espera es bloqueante (y por qué está bien)

En Countersign, la petición del agente **espera** mientras la aprobación está pendiente. Es una decisión consciente: el bucle de herramientas de Spring AI sigue siendo una llamada normal, el modelo recibe el resultado real de la herramienta y no tienes que guardar ni reanudar el estado de la conversación. El precio es un hilo ocupado durante la espera, y ahí es donde entran los [virtual threads de Spring Boot](/2026/09/spring-virtual-threads): con `spring.threads.virtual.enabled=true`, un hilo virtual esperando a un humano no bloquea un hilo de plataforma. Lo que sí tienes que cuidar es que el `timeout` de aprobación sea menor que cualquier timeout HTTP que haya delante del endpoint del agente.

## Recibos firmados: una auditoría que no se puede editar

Los logs normales sirven para depurar, no para demostrar nada. Cualquiera con acceso a la base de datos puede borrar la línea que le incomoda. Countersign genera, para **cada** decisión (incluidas las denegadas), un recibo como este:

```json
{
  "streamId": "banking-agent-7c1e",
  "sequence": 42,
  "invocationId": "3f6c2a9e-8d41-4b7a-9f0e-5c2d1b8a7e64",
  "tool": "payments_transfer",
  "argsHmac": "9b2f4c…e71a",
  "decision": "REQUIRE_APPROVAL",
  "reason": "Moves real money",
  "basis": "POLICY_MATCHED",
  "matchedPolicies": ["transfers-need-approval"],
  "approval": "APPROVED",
  "approver": "bob",
  "principal": "alice",
  "conversationId": "conv-7",
  "timestamp": "2026-11-18T14:02:11.482Z",
  "previousHash": "1b42…08aa",
  "hash": "7f3a…c91e",
  "signature": "q3C1…Ag=="
}
```

Tres mecanismos lo hacen a prueba de manipulación:

- **JSON canónico + SHA-256**: el `hash` se calcula sobre una representación canónica del recibo, así que cambiar un solo campo cambia el hash.
- **Cadena de hashes**: cada recibo incluye el `previousHash` del anterior en su *stream*. Borrar, insertar o reordenar un recibo rompe la cadena, igual que en un log de [Event Sourcing](/2026/07/event-sourcing) de solo inserción, pero verificable.
- **Firma [Ed25519](https://www.rfc-editor.org/rfc/rfc8032)**: con la clave privada de la aplicación, usando solo `java.security`. Sin la clave no puedes fabricar un recibo válido, aunque tengas acceso de escritura a la tabla.

![Diagrama de la cadena de recibos firmados de Countersign: los recibos 41, 42 y 43 enlazan el hash de cada uno con el previousHash del siguiente, cada uno lleva firma Ed25519 y argsHmac, y el ReceiptVerifier detecta recibos editados, borrados o reordenados](/diagrams/2026/11/countersign-guardrails-spring-ai/cadena-recibos-firmados-ed25519-hash.webp)

Verificar un *stream* es una línea:

```java
ReceiptVerifier verifier = ReceiptVerifier.fromX509Base64(publicKey);
verifier.verify(jdbcAuditSink.stream(streamId));   // Valid, o el primer recibo que se modificó
```

¿Por qué un **HMAC** de los argumentos y no un SHA-256 normal? Porque muchos argumentos tienen pocos valores posibles. Con un hash sin clave, cualquiera podría probar "¿el importe era 5000?" hasta dar con el hash correcto. Con un hash con clave, sin la clave no se puede, y tú sigues pudiendo comprobar que una llamada concreta corresponde a un recibo.

### Claves y almacenamiento en producción

Sin claves configuradas, Countersign las genera al arrancar y avisa en el log, pero los recibos de esa ejecución no se podrán verificar tras un reinicio. En producción, genéralas una vez y pásalas como secretos:

```bash
openssl genpkey -algorithm ed25519 -outform DER | base64 -w0   # COUNTERSIGN_SIGNING_KEY
openssl rand -base64 32                                         # COUNTERSIGN_ARGS_HMAC_KEY
```

```yaml
countersign:
  receipts:
    signing-key: ${COUNTERSIGN_SIGNING_KEY}
    args-hmac-key: ${COUNTERSIGN_ARGS_HMAC_KEY}
  audit:
    strict: true            # rechaza la llamada si su recibo no se puede guardar
```

Por defecto los recibos se guardan en memoria. Para persistirlos en **PostgreSQL 14 o superior**, añade el módulo JDBC junto al starter:

```xml
<dependency>
  <groupId>io.github.dvchinx</groupId>
  <artifactId>countersign-audit-jdbc</artifactId>
  <version>0.1.0</version>
</dependency>
```

Si hay un `DataSource`, se usa automáticamente y se crea la tabla `countersign_receipt`, que solo acepta inserciones: unos *triggers* rechazan `UPDATE`, `DELETE` y `TRUNCATE`. Si gestionas el esquema con [Flyway](/2026/08/spring-flyway), copia `schema-postgresql.sql` del jar a tus migraciones y pon `countersign.audit.jdbc.initialize-schema=false`. Para enviar los recibos a otro sitio (Kafka, S3, tu SIEM), defines tu propio bean `AuditSink`, que tiene un único método: `void append(Receipt receipt)`.

## Métricas, trazas y tests

Con Spring Boot Actuator en el classpath, Countersign publica en Micrometer sin configurar nada:

| Métrica | Tags | Para qué |
|---|---|---|
| `countersign.decisions` | `tool`, `decision`, `policy`, `basis`, `outcome`, `approval` | Alertar con `outcome=refuse`; ver aprobaciones que vencen |
| `countersign.evaluation` | `tool` | Tiempo de evaluación de políticas (sin la espera humana) |
| `countersign.audit.failures` | `tool`, `stage` | Recibos que no se firmaron (`receipt`) o no se guardaron (`sink`) |

Además, el span `spring.ai.tool` de cada llamada lleva `countersign.decision`, `countersign.outcome`, `countersign.policy` y `countersign.receipt`, así que si ya tienes [OpenTelemetry con Spring Boot](/2026/10/opentelemetry-spring-boot) ves en la misma traza qué decidió Countersign y qué recibo lo respalda. Para reaccionar a las decisiones (por ejemplo, avisar a un canal cuando se deniega algo), defines un bean `DecisionListener`; recibe cada `DecisionEvent` sin los argumentos.

Para los tests, el módulo `countersign-test` trae recibos firmados reales (`TestReceipts`) y el **test de contrato** que debe pasar cualquier `AuditSink`. Si escribes uno propio, extiendes `AuditSinkContract` y la suite comprueba orden, cadena y lectura del *stream*:

```java
class KafkaAuditSinkContractTest extends AuditSinkContract {

    private final KafkaAuditSink sink = new KafkaAuditSink(/* ... */);

    @Override
    protected AuditSink sink() {
        return sink;
    }

    @Override
    protected List<Receipt> storedStream(String streamId) {
        return sink.readBack(streamId);   // tu forma de leer el stream en orden
    }
}
```

## Pruébalo en dos minutos: el agente bancario

El repositorio incluye `examples/banking-agent`, un agente con herramientas de saldo, transferencias y SQL sobre un banco en memoria. Usa un modelo de demostración con guion, así que no necesitas API key ni Docker:

```bash
git clone https://github.com/dvchinx/countersign.git && cd countersign
./mvnw -pl examples/banking-agent -am install -DskipTests   # solo la primera vez
./mvnw -pl examples/banking-agent spring-boot:run
```

Con dos terminales, una para Alice y otra para operaciones, el recorrido es este:

```bash
# Alice mueve 5.000 dólares: la petición se queda esperando una aprobación
curl -s localhost:8080/chat -H 'X-User: alice' -H 'Content-Type: application/json' \
     -d '{"message":"Move $5,000 from checking to ACME Corp."}'

# Operaciones ve la llamada pendiente, con argumentos y motivo, y la aprueba
curl -s localhost:8080/approvals
curl -s -X POST localhost:8080/approvals/<invocationId>/approve -H 'X-User: ops@bank.example'

# Alice pide borrar la tabla de transacciones: no-destructive-sql lo deniega
curl -s localhost:8080/chat -H 'Content-Type: application/json' \
     -d '{"message":"Great. Now clean up by dropping the transactions table."}'

# Recibos de la ejecución y verificación de toda la cadena
curl -s localhost:8080/receipts
curl -s localhost:8080/receipts/verify
# {"valid":true,"streamId":"banking-agent-…","receipts":3,"problem":null}
```

Si Alice intenta aprobar su propia transferencia, recibe un `403`. Para usar un modelo real, cambias el bean del modelo de demostración por un starter de Spring AI (`spring-ai-starter-model-anthropic` o `spring-ai-starter-model-openai`) con su API key. Las políticas no cambian: esa es la idea.

## Countersign vs. la confirmación de herramientas de Spring AI 2.1

Spring AI 2.1 incorpora una funcionalidad nativa de [confirmación de llamadas a herramientas](https://docs.spring.io/spring-ai/reference/api/tools/tool-call-confirmation.html). Es una buena noticia y conviene entender en qué se parecen y en qué no, porque resuelven problemas cercanos con enfoques distintos.

En Spring AI 2.1 marcas una herramienta con `@Tool(requiresConfirmation = true)` o la listas en `spring.ai.tools.confirmation.tools`. Cuando el modelo la pide, el `ToolCallingManager` lanza una excepción, el `ToolCallingAdvisor` **devuelve la respuesta al llamador** con las llamadas pendientes en los metadatos y tu aplicación reanuda más tarde con `executeToolCalls(...)` y una `ToolCallDecision` por llamada. Es un modelo de **pausa y reanudación** sin estado en el servidor.

| | Spring AI 2.1 (confirmación nativa) | Countersign 0.1.0 |
|---|---|---|
| Qué resuelve | Pedir confirmación antes de ejecutar ciertas herramientas | Políticas, aprobación y auditoría de todas las llamadas |
| Decisión por defecto | Las herramientas no marcadas se ejecutan | `deny`: lo no permitido se rechaza (fail-closed) |
| Condiciones sobre argumentos | Implementando tu propia `ToolCallConfirmationPolicy` | Declarativas en YAML con SpEL aislado |
| Denegar sin preguntar | No es su objetivo | `decision: deny` |
| Flujo de aprobación | Pausa, devuelve al llamador y reanuda | Espera en la misma petición con un plazo |
| Identidad de quien aprueba | La documentación aclara que no la autentica | Queda registrada en un recibo firmado |
| Auditoría | No incluida | Recibos Ed25519 encadenados, PostgreSQL de solo inserción |
| Requisitos | Spring AI 2.1 | Spring AI 2.0.1 o superior (probado con 2.0.2 y 2.1.0) |

Mi lectura: si solo necesitas "pregunta antes de llamar a `deleteFile`" y tu interfaz ya está pensada para pausar y reanudar conversaciones, la confirmación nativa de Spring AI 2.1 es suficiente y no añade dependencias. Si necesitas **denegar por defecto**, reglas que dependen de los argumentos ("transferencias de más de 1.000 dólares"), separación de funciones o una auditoría que aguante una revisión de cumplimiento, eso es lo que aporta Countersign. La `0.1.0` se publicó sobre Spring AI 2.0.2 y su suite de tests también pasa con Spring AI 2.1.0, pero todavía no la combines con la confirmación nativa: Countersign aún no implementa el método que la 2.1 usa para reanudar una respuesta pausada (`executeToolCalls` con decisiones), así que esa reanudación falla. Falla de forma segura (ninguna herramienta se ejecuta sin pasar por las políticas), y está previsto corregirlo en la `0.1.1`.

## Riesgos y limitaciones honestas

Una librería de seguridad que exagera lo que hace es peor que no tenerla, así que esto es lo que Countersign **no** hace hoy:

- **No filtra prompts ni respuestas.** Si el modelo filtra un dato sensible en su respuesta de texto, Countersign no lo ve. Úsalo junto a un filtro de contenido.
- **No hay `REDACT` todavía.** Las tres decisiones disponibles son `ALLOW`, `DENY` y `REQUIRE_APPROVAL`; la redacción de argumentos y la anotación `@ToolPolicy` están previstas, no implementadas.
- **Las políticas son tan buenas como las escribas.** Una expresión regular para detectar SQL destructivo ayuda, pero no sustituye a un usuario de base de datos con permisos mínimos. Countersign es una capa más, no la única.
- **La aprobación humana tiene un coste.** Si todo requiere aprobación, la gente acaba aprobando sin leer (*approval fatigue*). Reserva `require-approval` para acciones irreversibles o caras.
- **Las claves son responsabilidad tuya.** Si la clave de firma se filtra, los recibos dejan de demostrar nada. Guárdala en tu gestor de secretos y planifica su rotación.
- **Es *pre-alpha*.** La API puede cambiar antes de la `1.0`.

## ¿Cuándo usar Countersign y cuándo no?

**Úsalo cuando:**

- Tu agente tiene herramientas con efectos reales: pagos, escritura en bases de datos, envío de correos, despliegues, cambios en cuentas de usuario.
- Consumes herramientas de **servidores MCP** de terceros y no puedes meter `if` en su código.
- Necesitas **demostrar** después qué hizo el agente, en nombre de quién y quién lo autorizó: banca, salud, sector público o cualquier entorno regulado.
- Quieres que las reglas de seguridad vivan fuera del código de negocio y las revise alguien que no programa las herramientas.

**No lo necesitas cuando:**

- Tu agente solo tiene herramientas de lectura sobre datos públicos.
- Usas Spring AI solo para generar texto o salida estructurada, sin *tool calling*.
- Estás en Spring AI 2.1 y te basta con confirmar un par de herramientas concretas.
- Tu stack no es Spring: el núcleo es Java puro, pero hoy solo hay integración con Spring AI.

## Buenas prácticas para guardrails de agentes

- **Empieza con `deny` y abre lo necesario.** Es más fácil justificar una política `allow` que descubrir qué hizo una herramienta que nadie protegió.
- **Una política por intención, con un `id` que se entienda.** `transfers-need-approval` en un recibo se explica solo; `policy-3` no.
- **Pon las reglas no negociables en el código** con `@RequiresApproval`, para que ningún cambio de configuración las quite.
- **La identidad sale del token, nunca del modelo.** Pásala por `ToolContext` con `PRINCIPAL_KEY`.
- **Separa quién pide y quién aprueba.** La regla de cuatro ojos del ejemplo cuesta tres líneas.
- **Activa `countersign.audit.strict` en producción** si la auditoría es un requisito: mejor rechazar una llamada que ejecutarla sin recibo.
- **Alerta sobre `countersign.decisions{outcome=refuse}`.** Un pico de rechazos suele indicar un intento de *prompt injection* o una política mal escrita.
- **Verifica la cadena de recibos periódicamente**, no solo cuando hay un incidente.

## Preguntas frecuentes

### ¿Qué es Countersign?

Countersign es una librería *open source* para Java que añade guardrails en tiempo de ejecución a los agentes de Spring AI. Evalúa cada llamada a una herramienta contra políticas declarativas, puede exigir aprobación humana y deja un recibo firmado con Ed25519 y encadenado por hash. Se instala con un starter de Spring Boot publicado en Maven Central.

### ¿Cómo añado aprobación humana a una herramienta de Spring AI?

Con Countersign, añades una política con `decision: require-approval` en `application.yml` o anotas el método con `@RequiresApproval`, y defines un bean `ApprovalGateway` (por ejemplo, `InMemoryApprovalGateway` para una pantalla propia). La llamada espera hasta que alguien la aprueba o vence el plazo, y en ese caso se deniega.

### ¿Countersign protege las herramientas MCP?

Sí, las herramientas que llegan a tu agente desde clientes MCP a través de un `ToolCallbackProvider` pasan por el mismo motor de políticas, porque Countersign intercepta en el `ToolCallingManager` y no en cada herramienta. Algunos servidores MCP usan nombres con puntos, y los globs de Countersign los aceptan.

### ¿Countersign usa un LLM para decidir?

No. La decisión es determinista: la misma llamada con las mismas políticas da siempre la misma decisión. Las condiciones son expresiones SpEL en un contexto aislado, evaluadas en tu JVM sin llamadas externas, así que no añaden latencia de red ni la variabilidad de un modelo.

### ¿Qué pasa si falla la base de datos de auditoría?

Depende de `countersign.audit.strict`. Por defecto la llamada sigue y el fallo se reporta en la métrica `countersign.audit.failures` con `stage=sink`. Con `strict: true`, la llamada se rechaza si su recibo no se puede guardar, que es lo recomendable cuando la auditoría es un requisito legal.

### ¿Qué versiones de Java y Spring necesita?

La `0.1.0` requiere Java 21 y Spring Boot 4.x, y está construida y probada con Spring Boot 4.1.2 y Spring AI 2.0.2. Sus tests también pasan con Spring AI 2.1.0, aunque todavía no se puede combinar con la confirmación nativa de herramientas de la 2.1. El almacenamiento JDBC de recibos necesita PostgreSQL 14 o superior.

## Conclusión

Los agentes ya no solo hablan: transfieren dinero, ejecutan SQL y llaman a servidores MCP que no escribiste tú. Con eso, la pregunta deja de ser "¿qué ha dicho el modelo?" y pasa a ser "¿qué ha hecho, en nombre de quién y quién lo autorizó?". Countersign responde a eso con tres piezas que se refuerzan entre sí: **políticas deterministas que deniegan por defecto**, **aprobación humana** con plazo y separación de funciones, y **recibos firmados y encadenados** que se pueden verificar meses después. Todo con un starter, sin tocar tus herramientas y sin un servicio extra al lado de tu aplicación.

La `0.1.0` es el primer paso y está pensada para crecer a través de sus puertos: gateways de aprobación para Slack o Teams, destinos de auditoría para Kafka u OpenSearch y firmas respaldadas por KMS. El código está en [GitHub](https://github.com/dvchinx/countersign) y el starter en [Maven Central](https://central.sonatype.com/artifact/io.github.dvchinx/countersign-spring-boot-starter). Si lo pruebas con tu agente, me encantará saber qué políticas escribiste y qué echas en falta. Los issues en español son bienvenidos, y si te resulta útil, una estrella en el repositorio ayuda a que otros equipos de Spring lo encuentren.
