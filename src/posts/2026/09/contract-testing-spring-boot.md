---
titulo: "Contract Testing en Spring Boot: pruebas de contrato entre microservicios"
seoTitulo: "Contract Testing en Spring Boot: qué es y cómo implementarlo"
fecha: "2026-09-31"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Qué es el contract testing, cómo funcionan los contratos consumer-driven y cómo implementarlos en Spring Boot con Spring Cloud Contract y Pact, paso a paso."
imagenPortada: "https://i.imgur.com/GIwZZEc.png"
etiquetas: ["Spring Boot", "Testing", "Microservicios", "Contract Testing", "Spring Cloud", "Java"]
categoria: "tech"
keywords: "contract testing spring boot, contract testing, qué es contract testing, pruebas de contrato microservicios, consumer-driven contract testing, spring cloud contract, pact, pact jvm, pact vs spring cloud contract, pact broker, can-i-deploy, contract testing vs pruebas de integración, stub runner, stubs wiremock, contract testing kafka"
---

# Contract Testing en Spring Boot: pruebas de contrato entre microservicios

El **contract testing en Spring Boot** resuelve un problema que casi todos los equipos de microservicios descubren por las malas: cada servicio pasa sus tests en verde, el pipeline despliega sin quejarse y, aun así, producción se rompe porque el servicio de pagos renombró un campo del JSON que el servicio de pedidos seguía leyendo. Los tests unitarios del proveedor no lo detectan porque el proveedor no sabe quién lo consume. Los tests del consumidor tampoco, porque usan un mock escrito a mano que refleja cómo *era* la API hace tres meses, no cómo es hoy.

La respuesta tradicional es una batería de pruebas end-to-end que levanta todos los servicios en un entorno compartido. Funciona, pero es lenta, frágil y cara: basta con que un servicio no relacionado esté caído para que el pipeline entero se ponga en rojo, y cuando falla nadie sabe a ciencia cierta qué integración se rompió. Las **pruebas de contrato** proponen algo más quirúrgico: verificar, por pares y de forma aislada, que cada consumidor y cada proveedor siguen cumpliendo el acuerdo que los une, sin necesidad de desplegar nada.

## El problema: mocks que mienten y E2E que no escalan

En el artículo sobre [testing en Spring Boot con JUnit 5 y Mockito](/2026/06/testing-spring-boot) vimos cómo aislar una clase de sus dependencias con mocks. Esa técnica es imprescindible, pero tiene un punto ciego cuando la dependencia es otro servicio: el mock es una **suposición** del consumidor sobre el comportamiento del proveedor. Nadie comprueba que esa suposición siga siendo cierta. Si el proveedor cambia, el mock no se entera, y el test sigue pasando mientras la integración real ya está rota.

Las pruebas de integración con [Testcontainers](/2026/07/spring-testcontainers) cierran parte del hueco para la infraestructura —bases de datos, brokers, cachés—, pero no para otros microservicios de tu organización. Levantar la imagen real del servicio de pagos, con su base de datos, sus dependencias y sus datos de prueba, dentro del test del servicio de pedidos escala mal en cuanto hay más de tres o cuatro servicios.

Las pruebas end-to-end sí ejercitan las integraciones reales, pero arrastran problemas estructurales:

- **Son lentas**: requieren desplegar todos los servicios implicados y esperar a que estén sanos.
- **Son frágiles**: un fallo de red, un servicio no relacionado en mantenimiento o datos compartidos corruptos producen falsos negativos.
- **Localizan mal el fallo**: un test que recorre cinco servicios y falla no dice cuál de las cuatro integraciones es la culpable.
- **Acoplan los despliegues**: si todos los equipos dependen del mismo entorno de integración, ese entorno se convierte en un cuello de botella.

![Comparación entre pruebas end-to-end en un entorno compartido con Pedidos, Pagos, Inventario y Envíos interconectados, frente a contract testing verificando cada par de servicios de forma aislada mediante un contrato](/diagrams/2026/09/contract-testing-spring-boot/pruebas-end-to-end-vs-contract-testing.png)

## ¿Qué es el contract testing?

El **contract testing** es una técnica de pruebas que verifica que dos servicios que se comunican —un consumidor y un proveedor— cumplen un acuerdo explícito sobre peticiones y respuestas, llamado contrato. Cada lado se prueba por separado contra ese contrato: el consumidor contra un stub generado a partir de él y el proveedor ejecutando las interacciones que el contrato describe.

La clave está en que **el contrato es un artefacto compartido y verificable**, no una suposición implícita en un mock. Si el proveedor cambia algo que rompe el contrato, su propio build falla antes de desplegar. Si el consumidor empieza a depender de un campo nuevo, el contrato lo refleja y el proveedor se entera en su siguiente verificación.

Un contrato describe, para cada interacción:

- La **petición** que hace el consumidor: método HTTP, ruta, cabeceras, cuerpo (o el mensaje publicado en un topic, si la comunicación es asíncrona).
- La **respuesta** que espera: código de estado, cabeceras y la forma del cuerpo, normalmente con *matchers* (por tipo o por expresión regular) en lugar de valores exactos.
- Opcionalmente, el **estado del proveedor** necesario para que la interacción tenga sentido: "existe el pedido 42", "el cliente no tiene saldo".

Es importante entender qué **no** es: el contract testing no verifica la lógica de negocio del proveedor ni reemplaza sus tests funcionales. Verifica la *forma* de la comunicación. Si el servicio de pagos calcula mal un impuesto pero devuelve un JSON con la estructura acordada, el contrato pasará. Esa responsabilidad sigue siendo de los tests del propio proveedor.

## Consumer-driven contract testing: quién escribe el contrato

Existen dos enfoques según quién define el contrato:

**Provider-driven:** el proveedor publica su especificación (por ejemplo, un documento OpenAPI generado con Springdoc) y los consumidores se adaptan. Es sencillo, pero no dice nada sobre qué partes de la API usa realmente cada consumidor, así que el proveedor no puede saber si eliminar un campo romperá a alguien.

**Consumer-driven (CDC):** cada consumidor declara exactamente qué interacciones necesita y qué campos lee. El proveedor verifica que satisface la unión de todos esos contratos. La idea, descrita por Ian Robinson en el artículo [Consumer-Driven Contracts](https://martinfowler.com/articles/consumerDrivenContracts.html) del sitio de Martin Fowler, tiene una consecuencia muy práctica: el proveedor puede eliminar o renombrar cualquier campo que **ningún** contrato use, con la certeza de que no romperá a nadie.

![Flujo de consumer-driven contract testing: el consumidor genera el contrato, lo publica en el Pact Broker, el proveedor lo descarga y publica el resultado de la verificación, y can-i-deploy decide si es seguro desplegar](/diagrams/2026/09/contract-testing-spring-boot/flujo-consumer-driven-contract-testing.png)

El flujo típico tiene cuatro pasos: el consumidor genera el contrato a partir de sus tests; lo publica en un lugar compartido (un broker o un repositorio); el proveedor lo descarga y lo verifica contra su implementación real; y, antes de cada despliegue, una comprobación automática confirma que la versión que se va a desplegar es compatible con las versiones que ya están en el entorno destino.

## Contract testing vs pruebas de integración y E2E

Las tres técnicas no compiten: ocupan niveles distintos de la estrategia de pruebas.

| Aspecto | Pruebas de integración | Contract testing | Pruebas end-to-end |
|---|---|---|---|
| Qué verifica | Tu servicio con su infraestructura real (BD, broker) | La forma de la comunicación entre dos servicios | Un flujo de negocio completo a través de varios servicios |
| Necesita desplegar otros servicios | No | No | Sí |
| Velocidad | Media | Alta | Baja |
| Localización del fallo | Precisa | Exacta (par consumidor–proveedor) | Difusa |
| Verifica lógica de negocio del otro servicio | No | No | Sí |

La recomendación habitual es sustituir la mayoría de pruebas E2E que solo existen para "comprobar que los servicios se entienden" por contratos, y conservar un puñado de E2E para los recorridos de negocio críticos (el checkout, el alta de cliente) que merecen verse funcionando de punta a punta.

## Implementación con Spring Cloud Contract

**Spring Cloud Contract** es la opción nativa del ecosistema Spring ([documentación oficial](https://docs.spring.io/spring-cloud-contract/reference/)). Sigue un modelo en el que los contratos viven en el repositorio del proveedor (aunque los consumidores pueden proponerlos mediante pull request) y, a partir de ellos, un plugin genera dos cosas: tests que verifican al proveedor y stubs de WireMock que usa el consumidor. En el momento de escribir este artículo, la línea 5.0.x es la que acompaña al release train Spring Cloud 2025.1 (Oakwood), basado en Spring Boot 4.0.

![Flujo de Spring Cloud Contract: el contrato YAML del proveedor pasa por el plugin de Maven, que genera tests que verifican el API y stubs WireMock; los stubs se publican en el repositorio Maven y el Stub Runner los sirve a los tests del consumidor](/diagrams/2026/09/contract-testing-spring-boot/flujo-spring-cloud-contract.png)

### Lado del proveedor: el contrato y el plugin

Supongamos que `payment-service` expone `GET /payments/{orderId}` y que `order-service` lo consume. En el proveedor añadimos el verificador y el plugin:

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-dependencies</artifactId>
            <version>2025.1.3</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-contract-verifier</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-contract-maven-plugin</artifactId>
            <version>${spring-cloud-contract.version}</version>
            <extensions>true</extensions>
            <configuration>
                <!-- Clase base de la que heredarán los tests generados -->
                <baseClassForTests>com.acme.payments.contract.ContractBase</baseClassForTests>
            </configuration>
        </plugin>
    </plugins>
</build>
```

Los contratos se colocan por defecto en `src/test/resources/contracts`. Se pueden escribir en Groovy, Kotlin, Java o YAML; YAML es el más legible para equipos que no quieren aprender un DSL:

```yaml
# src/test/resources/contracts/order-service/get_payment_by_order.yml
description: "order-service consulta el estado del pago de un pedido existente"
request:
  method: GET
  url: /payments/42
  headers:
    Accept: application/json
response:
  status: 200
  headers:
    Content-Type: application/json
  body:
    orderId: 42
    status: "APPROVED"
    amount: 149.90
    currency: "COP"
  matchers:
    body:
      # El consumidor solo exige que status sea uno de estos valores,
      # no un literal concreto
      - path: $.status
        type: by_regex
        value: "APPROVED|REJECTED|PENDING"
      - path: $.amount
        type: by_type
```

Organizar los contratos en subcarpetas por consumidor (`contracts/order-service/`, `contracts/billing-service/`) permite saber de un vistazo quién depende de qué, y es la base para aplicar el enfoque consumer-driven aunque los ficheros vivan en el repositorio del proveedor.

### La clase base

Los tests que genera el plugin heredan de la clase base configurada. Su única responsabilidad es preparar el contexto: registrar el controlador en RestAssured y fijar el estado que el contrato presupone. Aquí conviene mockear la capa de servicio o de repositorio, **no** el controlador, para que el test ejercite la serialización real:

```java
package com.acme.payments.contract;

import io.restassured.module.mockmvc.RestAssuredMockMvc;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;

import static org.mockito.BDDMockito.given;

@SpringBootTest
public abstract class ContractBase {

    @Autowired
    private WebApplicationContext context;

    // Mockeamos la lógica de negocio: el contrato verifica la forma del API,
    // no cómo se calcula el pago
    @MockitoBean
    private PaymentService paymentService;

    @BeforeEach
    void setup() {
        given(paymentService.findByOrderId(42L))
                .willReturn(new Payment(42L, PaymentStatus.APPROVED,
                        new BigDecimal("149.90"), "COP"));

        RestAssuredMockMvc.webAppContextSetup(context);
    }
}
```

Al ejecutar `./mvnw clean install`, el plugin genera en `target/generated-test-sources` una clase de test por carpeta de contratos, la ejecuta contra el controlador real y, si todo pasa, empaqueta los stubs de WireMock en un artefacto adicional con clasificador `stubs` (`payment-service-1.4.0-stubs.jar`). Si alguien renombra `status` a `paymentStatus` en el DTO, este build falla antes de llegar al repositorio.

### Lado del consumidor: Stub Runner

En `order-service` añadimos el Stub Runner y escribimos un test normal contra el cliente HTTP real, apuntando al puerto donde se sirven los stubs:

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-contract-stub-runner</artifactId>
    <scope>test</scope>
</dependency>
```

```java
@SpringBootTest(properties = "clients.payments.base-url=http://localhost:8090")
@AutoConfigureStubRunner(
        ids = "com.acme:payment-service:+:stubs:8090",
        stubsMode = StubRunnerProperties.StubsMode.LOCAL // REMOTE en CI
)
class PaymentClientContractTest {

    @Autowired
    private PaymentClient paymentClient; // el RestClient real de producción

    @Test
    void obtieneElEstadoDelPagoSegunElContrato() {
        PaymentView payment = paymentClient.getByOrderId(42L);

        assertThat(payment.orderId()).isEqualTo(42L);
        assertThat(payment.status()).isEqualTo("APPROVED");
    }
}
```

El `+` indica "la última versión disponible" de los stubs, y `LOCAL` los busca en el repositorio Maven local; en CI se usa `REMOTE` junto con `stubs.repositoryRoot` apuntando a tu Nexus o Artifactory. Lo valioso es que el cliente que se prueba es **el mismo** `RestClient` que va a producción —los que vimos en [Spring REST Clients](/2026/06/spring-rest-clients)—, con su deserialización y su manejo de errores reales, y que el stub no lo escribió el consumidor a mano: lo generó el proveedor a partir de un contrato que su propio build verificó.

## Implementación con Pact

**Pact** invierte el orden: el contrato no se escribe a mano, sino que **se genera ejecutando los tests del consumidor**. Es independiente del lenguaje (hay implementaciones para JVM, JavaScript, .NET, Go, Python, Rust…) y se apoya en un servidor central, el **Pact Broker** (o su versión gestionada, PactFlow), para compartir contratos y resultados de verificación.

### Test del consumidor con Pact JVM

```java
@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "payment-service")
class PaymentClientPactTest {

    @Pact(consumer = "order-service")
    V4Pact pagoAprobado(PactDslWithProvider builder) {
        return builder
                .given("existe un pago aprobado para el pedido 42") // estado del proveedor
                .uponReceiving("consulta del pago de un pedido")
                    .path("/payments/42")
                    .method("GET")
                .willRespondWith()
                    .status(200)
                    .body(new PactDslJsonBody()
                            .integerType("orderId", 42)
                            .stringMatcher("status", "APPROVED|REJECTED|PENDING", "APPROVED")
                            .decimalType("amount", 149.90)
                            .stringType("currency", "COP"))
                .toPact(V4Pact.class);
    }

    @Test
    void obtieneElPago(MockServer mockServer) {
        // El cliente real apunta al mock server que levanta Pact
        PaymentClient client = new PaymentClient(
                RestClient.builder().baseUrl(mockServer.getUrl()).build());

        PaymentView payment = client.getByOrderId(42L);

        assertThat(payment.status()).isEqualTo("APPROVED");
    }
}
```

Al pasar el test, Pact escribe el contrato en `target/pacts/order-service-payment-service.json`. Ese fichero se publica en el broker desde el pipeline del consumidor, etiquetado con la versión (normalmente el hash del commit) y la rama.

### Verificación en el proveedor

En `payment-service`, la verificación descarga del broker todos los contratos de sus consumidores y los reproduce contra la aplicación levantada:

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Provider("payment-service")
@PactBroker // URL y credenciales vía pactbroker.url / pactbroker.auth.token
class PaymentProviderPactTest {

    @LocalServerPort
    private int port;

    @MockitoBean
    private PaymentRepository paymentRepository;

    @BeforeEach
    void target(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    @TestTemplate
    @ExtendWith(PactVerificationSpringProvider.class)
    void verificarContratos(PactVerificationContext context) {
        context.verifyInteraction(); // un test por cada interacción de cada consumidor
    }

    // Prepara el estado declarado con given(...) en el consumidor
    @State("existe un pago aprobado para el pedido 42")
    void pagoAprobado() {
        given(paymentRepository.findByOrderId(42L))
                .willReturn(Optional.of(new PaymentEntity(42L, "APPROVED",
                        new BigDecimal("149.90"), "COP")));
    }
}
```

Las dependencias son `au.com.dius.pact.consumer:junit5` en el consumidor y `au.com.dius.pact.provider:junit5spring` en el proveedor; conviene fijar la versión más reciente de Pact JVM publicada en Maven Central y comprobar su compatibilidad con tu versión de Spring Boot antes de actualizar.

### can-i-deploy: el contrato como puerta de despliegue

La pieza que convierte a Pact en algo más que "otra forma de escribir tests" es [`can-i-deploy`](https://docs.pact.io/pact_broker/can_i_deploy). El broker mantiene una **matriz** de qué versión de cada consumidor ha sido verificada contra qué versión de cada proveedor, y en qué entornos está desplegada cada una. Antes de desplegar, el pipeline pregunta:

```bash
# ¿Es compatible esta versión de order-service con lo que ya hay en producción?
pact-broker can-i-deploy \
  --pacticipant order-service \
  --version "$GIT_COMMIT" \
  --to-environment production

# Si el comando devuelve 0, se despliega y se registra el despliegue
pact-broker record-deployment \
  --pacticipant order-service \
  --version "$GIT_COMMIT" \
  --environment production
```

Si el proveedor que hay en producción no ha verificado todavía el contrato de la nueva versión del consumidor, el comando devuelve un código distinto de cero y el pipeline se detiene. Esto encaja de forma natural con las [estrategias de despliegue](/2026/09/estrategias-despliegue) canary o blue-green: el contrato evita que una versión incompatible llegue siquiera a recibir el 5 % del tráfico.

## Pact vs Spring Cloud Contract: cuál elegir

La propia [documentación de Pact](https://docs.pact.io/getting_started/comparisons) resume bien la diferencia: Spring Cloud Contract encaja en ecosistemas JVM/Spring, mientras que Pact está pensado para arquitecturas políglotas y ciclos de release desacoplados.

| Criterio | Spring Cloud Contract | Pact |
|---|---|---|
| Quién escribe el contrato | Se escribe a mano (YAML/Groovy/Kotlin), normalmente en el repo del proveedor | Se genera desde los tests del consumidor |
| Lenguajes | JVM (otros vía Docker, sin soporte nativo) | JVM, JS, .NET, Go, Python, Rust… |
| Stubs para el consumidor | WireMock generado automáticamente, reutilizable en local | Mock server durante el test del consumidor |
| Distribución | Artefacto `-stubs.jar` en Nexus/Artifactory o repo Git | Pact Broker / PactFlow |
| Gate de despliegue | Hay que construirlo | `can-i-deploy` integrado |
| Mensajería | Soporte integrado (Kafka, RabbitMQ, Spring Cloud Stream) | Pact de mensajes (asíncrono) |

En la práctica: si todos tus servicios son Spring Boot y ya usas un repositorio Maven, Spring Cloud Contract tiene menos piezas móviles. Si tienes un frontend en TypeScript, un BFF en Node —como los de un Backend for Frontend— o servicios en otros lenguajes, Pact y su broker compensan la infraestructura adicional.

## Contract testing con mensajería: Kafka y RabbitMQ

Los contratos no se limitan a HTTP. En una arquitectura orientada a eventos, el "contrato" es el esquema del mensaje que un productor publica y un consumidor lee. Spring Cloud Contract permite describir mensajes con `input`/`outputMessage`:

```yaml
# El productor se compromete a publicar este evento cuando se aprueba un pago
label: pago_aprobado
input:
  triggeredBy: aprobarPago()   # método de la clase base que dispara la publicación
outputMessage:
  sentTo: payments.approved
  body:
    orderId: 42
    status: "APPROVED"
  headers:
    contentType: application/json
```

El test generado invoca `aprobarPago()` en la clase base y verifica que el mensaje publicado coincide; en el consumidor, `StubTrigger.trigger("pago_aprobado")` inyecta ese mismo mensaje para probar el listener. Con [Spring Kafka](/2026/06/spring-kafka) esto detecta un problema clásico: un productor que añade un campo obligatorio o cambia un tipo y rompe a consumidores que ni siquiera sabía que existían.

## Riesgos y contrapartidas

**Los contratos no prueban comportamiento.** Un contrato que pasa garantiza que el JSON tiene la forma esperada, no que el valor sea correcto. Confiar en ellos como única red de seguridad deja huecos en la lógica de negocio.

**Contratos demasiado estrictos.** Si el consumidor fija valores literales (`"amount": 149.90`) en lugar de matchers por tipo, cualquier cambio en los datos de prueba del proveedor rompe la verificación sin que haya una incompatibilidad real. Esto genera fatiga y los equipos acaban desactivando los tests.

**Estados del proveedor difíciles de preparar.** Cada `given("...")` exige que el proveedor sepa reproducir ese estado. Con decenas de consumidores, la lista de estados crece y hay que mantenerla como cualquier otro código de test.

**Coste organizativo.** El contract testing es tanto un proceso como una herramienta: requiere que los equipos acuerden cómo proponer cambios, quién revisa los contratos y qué pasa cuando una verificación falla. Sin ese acuerdo, se convierte en un paso más del pipeline que nadie mira.

**Infraestructura adicional.** Pact necesita un broker desplegado y mantenido (o pagar PactFlow); Spring Cloud Contract necesita un repositorio de artefactos accesible desde CI y disciplina de versionado de stubs.

## Cuándo usar contract testing y cuándo no

Tiene sentido cuando:

- Hay varios equipos que despliegan servicios de forma independiente y se comunican por HTTP o mensajería.
- Las pruebas E2E tardan demasiado, fallan de forma intermitente o bloquean los despliegues.
- Ya se han producido incidentes en producción por cambios incompatibles de API.
- Un proveedor tiene muchos consumidores y necesita saber qué puede cambiar sin romper a nadie.

No suele compensar cuando:

- Es un monolito o un monolito modular: las fronteras entre módulos se verifican mejor con tests de arquitectura dentro del mismo build.
- Un solo equipo mantiene consumidor y proveedor y los despliega siempre juntos.
- La API es pública y tiene consumidores desconocidos: ahí el contrato es la especificación OpenAPI y una política de versionado de APIs, porque no puedes pedir a terceros que publiquen contratos.

## Buenas prácticas

**Contrata solo lo que usas.** El consumidor debe declarar únicamente los campos que realmente lee. Cuanto más pequeño es el contrato, más libertad tiene el proveedor para evolucionar.

**Prefiere matchers a valores literales.** Usa `by_type`, `by_regex` o los `*Type` de Pact para expresar la forma de los datos, y reserva los valores exactos para lo que de verdad importa (un enum, un código de estado).

**Prueba el cliente real, no un wrapper.** El test del consumidor debe usar el mismo cliente HTTP y los mismos DTO que producción; si no, estás verificando un contrato que tu código real no respeta.

**Integra la verificación en el pipeline del proveedor.** Cada build del proveedor debe verificar los contratos vigentes de todos sus consumidores. En Pact, configura además un webhook para que un contrato nuevo dispare la verificación del proveedor sin esperar a su siguiente commit.

**Versiona con el commit y registra los despliegues.** Usar el hash de Git como versión y registrar cada despliegue es lo que permite a `can-i-deploy` responder con precisión.

**Mantén unas pocas pruebas E2E.** Los contratos reemplazan la mayoría de pruebas de "¿se entienden los servicios?", no los recorridos de negocio críticos.

## Preguntas frecuentes

### ¿Qué es contract testing en pocas palabras?

Es una técnica que verifica que dos servicios que se comunican cumplen un acuerdo explícito sobre peticiones y respuestas. Consumidor y proveedor se prueban por separado contra el mismo contrato, sin desplegar el otro servicio, y el build falla en cuanto alguno de los dos lo incumple.

### ¿En qué se diferencia el contract testing de las pruebas de integración?

Las pruebas de integración verifican tu servicio junto a su infraestructura real (base de datos, broker) o levantando otros servicios. El contract testing no despliega el otro servicio: verifica solo la forma de la comunicación mediante un contrato compartido, por lo que es más rápido, más estable y señala exactamente qué par de servicios se ha roto.

### ¿Pact o Spring Cloud Contract?

Si todo tu ecosistema es Spring Boot y ya usas un repositorio Maven, Spring Cloud Contract es más directo e incluye soporte integrado para mensajería. Si tienes consumidores en otros lenguajes, como un frontend en TypeScript, o quieres un gate de despliegue listo para usar, Pact con su broker y `can-i-deploy` suele ser mejor opción.

### ¿El contract testing reemplaza a las pruebas end-to-end?

No del todo. Sustituye la mayoría de pruebas E2E que solo comprueban que los servicios se entienden, que son las más lentas y frágiles. Conviene mantener unas pocas E2E para los flujos de negocio críticos, porque los contratos no verifican la lógica de negocio del proveedor.

### ¿Qué es un Pact Broker y es obligatorio?

Es un servidor que almacena los contratos, los resultados de verificación y qué versión está desplegada en cada entorno. Técnicamente se puede usar Pact compartiendo ficheros, pero sin broker se pierden `can-i-deploy`, los webhooks y la matriz de compatibilidad, que son precisamente lo que hace útil a Pact en un pipeline real.

### ¿Se puede hacer contract testing con Kafka o RabbitMQ?

Sí. Spring Cloud Contract describe mensajes con `outputMessage` y verifica que el productor publica exactamente ese mensaje, mientras que el consumidor recibe el mismo mensaje simulado para probar su listener. Pact ofrece el equivalente con sus pacts de mensajes asíncronos.

## Conclusión

El contract testing ataca el hueco que queda entre los tests unitarios con mocks, que no saben si el otro servicio ha cambiado, y las pruebas end-to-end, que lo saben pero demasiado tarde y a un coste muy alto. Convertir el acuerdo entre consumidor y proveedor en un artefacto verificable permite que cada equipo despliegue de forma independiente con la certeza de que no está rompiendo a nadie, y que cuando algo falle, el fallo aparezca en el build correcto con el nombre del par de servicios afectado.

Spring Cloud Contract es el camino natural en un ecosistema 100 % Spring: contratos en YAML, stubs de WireMock generados y soporte de mensajería integrado. Pact brilla en arquitecturas políglotas y aporta `can-i-deploy`, que convierte la compatibilidad en una puerta automática del pipeline. En ambos casos, el éxito depende menos de la herramienta que de la disciplina: contratos pequeños, matchers en lugar de literales, verificación en cada build del proveedor y un acuerdo claro entre equipos sobre cómo evolucionar las APIs.
