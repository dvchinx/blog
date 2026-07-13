---
titulo: "Observabilidad en microservicios: logging, métricas y trazabilidad distribuida"
seoTitulo: "Observabilidad en microservicios: los tres pilares para operar sistemas distribuidos"
fecha: "2026-07-14"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué es la observabilidad, por qué es imprescindible en arquitecturas de microservicios y cómo implementar sus tres pilares —logs, métricas y trazas distribuidas— para diagnosticar y entender tu sistema en producción."
imagenPortada: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Microservices", "Observability", "Distributed Systems", "Best Practices"]
categoria: "tech"
keywords: "observabilidad, microservicios, logging, métricas, trazabilidad distribuida, distributed tracing, OpenTelemetry, Prometheus, Grafana, Jaeger, logs estructurados, correlation ID, span, trace, observability pillars"
---

# Observabilidad en microservicios: logging, métricas y trazabilidad distribuida

En un monolito, cuando algo falla, el proceso de diagnóstico es relativamente directo: hay un único proceso, un único log, un único stack trace. Con microservicios, una sola operación de negocio puede cruzar diez servicios distintos, generar cientos de eventos y fallar en el octavo paso de una cadena que el equipo de turno nunca ha visto completa.

La **observabilidad** es la capacidad de entender el estado interno de un sistema a partir de sus señales externas. No se trata únicamente de monitorear que los servicios estén vivos; se trata de poder responder preguntas sobre el comportamiento del sistema sin necesidad de añadir instrumentación nueva cada vez que aparece una pregunta nueva.

En la práctica, la observabilidad descansa sobre tres pilares complementarios: **logs**, **métricas** y **trazas distribuidas**. Cada uno responde preguntas distintas y juntos forman la base de cualquier estrategia seria de operación de sistemas distribuidos.

## Por qué el monitoreo tradicional no es suficiente

El monitoreo clásico —verificar que un servicio responde en el puerto 80, que la CPU está por debajo del 80%, que el tiempo de respuesta promedio es menor de 200 ms— parte de la suposición de que ya sabes qué puede salir mal y puedes definir umbrales para cada cosa. Funcionaba razonablemente bien cuando la arquitectura era simple y los fallos eran predecibles.

Los sistemas distribuidos modernos son **complejos en el sentido técnico del término**: las interacciones entre componentes producen comportamientos emergentes que no se pueden predecir a partir del comportamiento de cada componente por separado. Un fallo de red intermitente entre el servicio A y la base de datos puede manifestarse como latencia elevada en el servicio C, que no tiene relación directa con A pero depende de B, que sí depende de A. Un sistema de alertas basado en umbrales puede no disparar nada hasta que el problema ya afecta a los usuarios.

La observabilidad cambia la pregunta: en lugar de "¿está el sistema dentro de los parámetros esperados?", te permite preguntar "¿qué está haciendo exactamente el sistema ahora mismo?". La diferencia parece sutil pero tiene consecuencias enormes en la capacidad del equipo para diagnosticar incidentes en producción.

## El primer pilar: logging estructurado

Los logs son la señal más antigua y universal. Todo sistema genera algún tipo de registro. El problema es que los logs escritos como texto libre —"Error procesando pedido 12345: null pointer en línea 87"— son difíciles de procesar a escala. Buscar patrones en millones de líneas de texto libre requiere expresiones regulares frágiles y búsquedas lentas.

El **logging estructurado** resuelve esto escribiendo cada evento como un documento con campos bien definidos, habitualmente en formato JSON:

```json
{
  "timestamp": "2026-07-13T10:23:45.123Z",
  "level": "ERROR",
  "service": "order-service",
  "traceId": "4bf92f3577b34da6",
  "spanId": "00f067aa0ba902b7",
  "userId": "usr_9812",
  "orderId": "ord_7654",
  "event": "payment_failed",
  "reason": "insufficient_funds",
  "durationMs": 342
}
```

Cada campo es indexable. Puedes consultar "todos los errores del usuario `usr_9812` en los últimos 30 minutos" con una query simple en cualquier sistema de gestión de logs (Elasticsearch, Loki, CloudWatch Logs). Lo que antes requería un script ad hoc ahora es una búsqueda instantánea.

### Correlation ID: el hilo que une los logs de múltiples servicios

La técnica más importante para que los logs sean útiles en arquitecturas distribuidas es el **Correlation ID** (también llamado Trace ID o Request ID). Es un identificador único que se genera al inicio de cada operación —generalmente en el API Gateway o en el primer servicio que recibe la solicitud— y se propaga a todos los servicios involucrados en esa operación, habitualmente a través de cabeceras HTTP:

```
X-Correlation-Id: 4bf92f3577b34da6
```

Cada servicio extrae ese ID del contexto de la solicitud entrante y lo incluye en todos los logs que genera mientras procesa esa solicitud. El resultado es que, dado un ID de correlación, puedes recuperar todos los logs de todos los servicios que participaron en esa operación y reconstruir exactamente qué ocurrió, en qué orden y dónde falló.

Sin Correlation ID, la única alternativa es buscar por timestamps aproximados y cruzar logs manualmente, un proceso lento y propenso a errores cuando los relojes de los servidores no están perfectamente sincronizados.

### Niveles de log y lo que significan en producción

Un error común es usar `ERROR` o `WARN` para cualquier situación inesperada. En producción, donde el volumen de logs puede ser enorme, la disciplina en el uso de niveles marca la diferencia entre un sistema fácil de operar y uno en el que nadie revisa las alertas porque hay demasiado ruido:

- **ERROR**: algo salió mal y requiere atención humana. Si generas un ERROR, debería haber una alerta que lo notifique al equipo de turno.
- **WARN**: algo inesperado ocurrió pero el sistema se recuperó. Vale la pena revisarlo, pero no es urgente.
- **INFO**: eventos normales del ciclo de vida del sistema: "servicio iniciado", "conexión establecida", "pedido procesado".
- **DEBUG**: información detallada útil para desarrollo y troubleshooting, nunca en producción a alto volumen.

## El segundo pilar: métricas

Las métricas son **mediciones numéricas agregadas a lo largo del tiempo**. Mientras que un log describe un evento específico ("el pedido 7654 falló a las 10:23:45"), una métrica describe el comportamiento del sistema a nivel estadístico: "en el último minuto, el servicio de pedidos procesó 1.247 solicitudes con una tasa de error del 0,3% y un percentil 99 de latencia de 487 ms".

Las métricas son la base de los dashboards y las alertas. Son mucho más eficientes en almacenamiento y procesamiento que los logs porque agregan información: en lugar de guardar cada solicitud individualmente, guardas contadores, histogramas y gauges que resumen el comportamiento.

### Las cuatro señales doradas

Google popularizó en su libro *Site Reliability Engineering* el concepto de las **cuatro señales doradas**: las cuatro métricas que, si las monitorizas correctamente, te dan una imagen completa del estado de salud de cualquier servicio:

**Latencia**: el tiempo que tarda el servicio en responder. Importa la distribución completa, no solo el promedio. Un promedio de 100 ms puede esconder un percentil 99 de 2 segundos que está afectando a uno de cada cien usuarios. Medir latencia con percentiles (p50, p95, p99) es imprescindible.

**Tráfico**: el volumen de solicitudes que el servicio está procesando, medido en solicitudes por segundo. El tráfico contextualiza el resto de métricas: una tasa de error del 1% tiene un significado muy diferente con 100 solicitudes/s que con 10.000 solicitudes/s.

**Errores**: la tasa de solicitudes que fallan, ya sea con errores explícitos (HTTP 5xx) o implícitos (respuestas HTTP 200 con contenido incorrecto). Separar errores del cliente (HTTP 4xx) de errores del servidor (HTTP 5xx) ayuda a distinguir bugs de clientes abusivos.

**Saturación**: qué tan cerca está el servicio de su límite de capacidad. CPU al 95%, memoria al 90%, cola de mensajes con 50.000 elementos sin procesar —todos son indicadores de saturación. La saturación es predictiva: te avisa de problemas inminentes antes de que los errores o la latencia se disparen.

### El modelo de Prometheus

**Prometheus** es el estándar de facto para métricas en entornos cloud-native. Los servicios exponen un endpoint `/metrics` con sus métricas en formato texto; Prometheus lo consulta periódicamente y almacena los datos en una base de datos de series temporales. Grafana visualiza esos datos en dashboards.

```
# HELP http_requests_total Número total de solicitudes HTTP
# TYPE http_requests_total counter
http_requests_total{method="POST",endpoint="/orders",status="200"} 1247
http_requests_total{method="POST",endpoint="/orders",status="500"} 4

# HELP http_request_duration_seconds Latencia de las solicitudes HTTP
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 890
http_request_duration_seconds_bucket{le="0.5"} 1198
http_request_duration_seconds_bucket{le="1.0"} 1243
http_request_duration_seconds_bucket{le="+Inf"} 1247
```

Los cuatro tipos de métricas en Prometheus tienen propósitos distintos: los **counters** solo suben (solicitudes totales, errores totales); los **gauges** suben y bajan (memoria usada, conexiones activas); los **histogramas** miden distribuciones con buckets predefinidos (latencia, tamaño de respuesta); y los **summaries** calculan percentiles en el cliente.

## El tercer pilar: trazabilidad distribuida

Los logs te dicen qué ocurrió en cada servicio. Las métricas te dicen cómo se comporta el sistema en agregado. Pero ninguno de los dos te dice cómo se relacionan entre sí las operaciones que cruzan múltiples servicios. Para eso existe la **trazabilidad distribuida** (*distributed tracing*).

Una **traza** (*trace*) representa el camino completo de una solicitud a través del sistema, desde que entra por el API Gateway hasta que se devuelve la respuesta al cliente. Se compone de **spans**: unidades de trabajo individuales, cada una con su propio nombre, timestamps de inicio y fin, servicio que la ejecutó y relación jerárquica con el span padre.

```
Traza: crear-pedido (4bf92f3577b34da6)
│
├── api-gateway: validar-auth         (0ms - 12ms)
│
├── order-service: crear-pedido       (15ms - 180ms)
│   ├── db: INSERT orders             (16ms - 45ms)
│   └── inventory-service: reservar   (50ms - 140ms)
│       └── db: UPDATE stock          (52ms - 138ms)
│
└── payment-service: cobrar           (185ms - 342ms)
    ├── fraud-service: verificar       (186ms - 220ms)
    └── external-gateway: charge      (225ms - 340ms)
```

Esta visualización en cascada —habitual en herramientas como Jaeger, Zipkin o Tempo— responde en segundos preguntas que antes requerían horas de análisis: ¿Dónde está la latencia? ¿El `inventory-service` tarda porque la query de base de datos es lenta o porque hay algún problema de red? ¿El `fraud-service` es el cuello de botella?

### OpenTelemetry: el estándar unificado

Durante años, cada herramienta de observabilidad tenía su propio SDK, su propio protocolo y sus propias convenciones. Instrumentar una aplicación para Jaeger significaba usar el SDK de Jaeger; migrar a otra herramienta implicaba reescribir toda la instrumentación.

**OpenTelemetry** (OTel) resuelve este problema con un estándar abierto y vendor-neutral para la recolección de datos de observabilidad: logs, métricas y trazas bajo una única API. La promesa es simple: instrumentas tu aplicación una vez con las APIs de OpenTelemetry, y puedes enviar los datos a cualquier backend —Jaeger, Zipkin, Grafana Tempo, Datadog, Honeycomb— sin cambiar el código de la aplicación.

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider

tracer = trace.get_tracer("order-service")

def create_order(user_id: str, items: list) -> dict:
    with tracer.start_as_current_span("create-order") as span:
        span.set_attribute("user.id", user_id)
        span.set_attribute("order.item_count", len(items))

        # El span hijo hereda el contexto automáticamente
        order = save_to_database(items)
        reserve_inventory(items)
        
        span.set_attribute("order.id", order["id"])
        return order
```

La propagación del contexto —pasar el `traceId` y el `spanId` entre servicios— ocurre automáticamente a través de cabeceras estándar (W3C Trace Context) cuando se usan los SDKs de OpenTelemetry. No hay que gestionar manualmente los identificadores.

## Cómo encajan los tres pilares

Logs, métricas y trazas no son redundantes: cada uno ilumina una dimensión diferente del sistema.

Cuando una alerta de métricas se dispara —"la tasa de error del `payment-service` ha superado el 5%"— el primer paso es ir a los logs para entender qué clase de error es. Si los logs muestran "connection timeout to external gateway", el problema es externo. Si muestran una excepción de validación, hay un bug en el código. Si los logs no dan suficiente contexto, las trazas distribuidas permiten ver qué ocurrió exactamente en los últimos pedidos fallidos: qué servicios involucraron, cuánto tardó cada paso, si hubo reintentos.

El flujo de diagnóstico típico en un incidente sigue este patrón:

1. **Métricas** disparan la alerta: "algo está mal".
2. **Logs** identifican qué tipo de error está ocurriendo.
3. **Trazas** muestran exactamente dónde y por qué.

Este flujo requiere que los tres pilares estén correlacionados. La práctica más importante es que los logs, métricas y trazas de la misma operación compartan el mismo `traceId`. OpenTelemetry facilita esto inyectando automáticamente el `traceId` activo en los logs cuando se usa junto con una librería de logging compatible.

## Señales de una estrategia de observabilidad madura

Una buena estrategia de observabilidad no es simplemente instalar Prometheus y Grafana. Algunas señales que indican que el equipo está en el camino correcto:

Los logs son estructurados y todos incluyen Correlation ID. Puedes buscar todos los eventos de una operación específica en segundos, sin importar cuántos servicios involucró.

Las alertas están basadas en señales de usuario, no en métricas de infraestructura. Una alerta por "latencia p99 > 1 segundo en el endpoint de checkout" es más valiosa que una alerta por "CPU > 80%", porque la primera afecta directamente a los usuarios.

Existe un dashboard operacional por servicio con las cuatro señales doradas, y cada equipo lo revisa activamente durante los despliegues.

Las trazas distribuidas cubren los caminos críticos del sistema —checkout, registro, autenticación— y se pueden consultar fácilmente ante un incidente.

El equipo practica **fire drills**: simulaciones periódicas de incidentes donde alguien introduce un fallo controlado y el resto del equipo tiene que diagnosticarlo usando únicamente las herramientas de observabilidad disponibles. No hay mejor forma de descubrir los huecos en la estrategia que intentar diagnosticar un problema real con las herramientas existentes.

## La observabilidad no es un proyecto, es una práctica

El error más común es tratar la observabilidad como un proyecto de infraestructura con un inicio y un fin: "instalamos Grafana, configuramos Prometheus y listo". La observabilidad es una práctica continua que evoluciona con el sistema.

Cada vez que aparece un bug difícil de diagnosticar, vale la pregunta: "¿qué log o métrica nos habría permitido encontrar esto más rápido?". Cada vez que se añade una funcionalidad nueva, vale preguntarse: "¿cómo sabremos si esto está funcionando correctamente en producción?". La instrumentación es parte del código de producción, no un añadido posterior.

Los sistemas distribuidos son, por definición, más difíciles de entender que los monolitos. La observabilidad no elimina esa complejidad, pero sí la hace manejable: convierte las preguntas sobre el estado del sistema en algo que se puede responder con datos, no con suposiciones.
