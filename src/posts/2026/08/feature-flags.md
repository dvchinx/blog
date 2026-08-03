---
titulo: "Feature Flags: despliegue continuo sin riesgo en producción"
seoTitulo: "Feature Flags: qué son, cómo funcionan y cuándo usarlos en producción"
fecha: "2026-08-04"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende qué son los feature flags, los patrones principales para usarlos, cómo evitar los antipatrones más comunes y qué herramientas existen para gestionarlos en proyectos reales."
imagenPortada: "https://i.imgur.com/xE9hwAk.png?w=800&h=600&fit=crop"
etiquetas: ["Architecture", "DevOps", "Best Practices", "Feature Flags", "CI/CD"]
categoria: "tech"
keywords: "feature flags, feature toggles, feature switches, despliegue continuo, CI/CD, trunk-based development, canary release, A/B testing, LaunchDarkly, Unleash, kill switch, dark launch, progressive delivery"
---

# Feature Flags: despliegue continuo sin riesgo en producción

Imagina poder desplegar código a producción sin activar la funcionalidad que ese código implementa. Poder habilitar una nueva característica solo para el equipo interno primero, luego para el 5 % de los usuarios, y si todo va bien, para el 100 %. O poder desactivar una función en segundos, sin revertir nada ni hacer un nuevo despliegue, cuando algo falla en producción.

Eso es lo que hacen los **feature flags** —también llamados feature toggles o feature switches—. Son condiciones booleanas en el código que controlan si una funcionalidad está activa o no, y cuyo valor se puede cambiar en tiempo de ejecución sin tocar el binario desplegado.

Es una técnica que parece simple pero que, bien aplicada, cambia fundamentalmente la relación entre el equipo de desarrollo y producción: el despliegue deja de ser un momento de tensión para convertirse en un evento rutinario y reversible.

## El problema que resuelven

El flujo tradicional de desarrollo agrupa trabajo en ramas de larga duración. Una feature branch acumula cambios durante días o semanas, y el momento de hacer merge e integrar todo en la rama principal se convierte en una operación de alto riesgo: conflictos acumulados, comportamientos inesperados por la interacción de cambios paralelos y un despliegue que activa todo a la vez sin posibilidad de revertir de forma selectiva.

El modelo alternativo —**trunk-based development**— propone integrar pequeños cambios a la rama principal con frecuencia, idealmente varias veces al día. El problema obvio es: ¿cómo integras código de una funcionalidad que todavía no está terminada? Si fusionas a producción la mitad de una pantalla de checkout nueva, los usuarios verán algo incompleto.

Los feature flags resuelven exactamente esa tensión. Puedes integrar el código de la nueva funcionalidad en la rama principal, envolverlo en un flag desactivado y desplegarlo con total seguridad. El código llega a producción, pero la funcionalidad permanece invisible para los usuarios hasta que decidas activarla.

## Los cuatro patrones principales

Pete Hodgson, en su artículo de referencia en Martin Fowler's bliki, identifica cuatro arquetipos de feature flag según su propósito y el tiempo que deben vivir en el código.

### Release toggles

Son los más comunes. Permiten desplegar código incompleto sin exponerlo a los usuarios. Tienen una vida corta: una vez que la funcionalidad está lista y validada, el flag se elimina y el código que estaba condicionado queda como el camino normal.

```python
if feature_flags.is_enabled("new_checkout_flow", user):
    return render_new_checkout(cart)
else:
    return render_legacy_checkout(cart)
```

Este patrón es la piedra angular del trunk-based development. Permite que todo el equipo integre trabajo en la rama principal sin pisarse los unos a los otros, aunque cada uno esté en una fase distinta de desarrollo.

### Experiment toggles (A/B testing)

Comparan el comportamiento de dos variantes de una funcionalidad para medir cuál produce mejores resultados. A diferencia de los release toggles, no son tan urgentes de eliminar: pueden vivir semanas o meses mientras se recopilan datos estadísticamente significativos.

```python
variant = feature_flags.get_variant("checkout_button_color", user)

if variant == "blue":
    button_color = "#1a73e8"
elif variant == "green":
    button_color = "#34a853"
else:
    button_color = "#757575"  # control
```

La asignación del usuario a una variante debe ser determinista (el mismo usuario siempre ve la misma variante) y el porcentaje de usuarios en cada grupo debe mantenerse estable durante el experimento para que los datos sean comparables.

### Ops toggles (kill switches)

Son interruptores de emergencia para funcionalidades de riesgo operativo. Permiten desactivar en segundos una feature que está degradando el rendimiento del sistema, sin necesidad de revertir el despliegue.

Un caso típico: una nueva integración con un proveedor externo que está respondiendo lento y añadiendo latencia a cada solicitud. Con un ops toggle, el equipo de operaciones puede desactivar esa integración instantáneamente mientras el proveedor resuelve su problema, sin tocar una sola línea de código.

```python
if feature_flags.is_enabled("external_recommendations"):
    products = recommendations_service.get(user_id)
else:
    products = local_fallback_recommendations(user_id)
```

Estos flags suelen tener una vida más larga que los release toggles porque el riesgo operativo que mitigan puede persistir.

### Permission toggles

Controlan el acceso a funcionalidades según atributos del usuario: plan de suscripción, rol, segmento o país. Son los más longevos porque reflejan lógica de negocio permanente.

```python
if feature_flags.is_enabled("advanced_analytics", user):
    return full_analytics_dashboard()
else:
    return basic_analytics_dashboard()
```

La diferencia con el control de acceso basado en roles tradicional es que los permission toggles suelen poder modificarse en tiempo real desde un panel de administración, sin requerir un nuevo despliegue para cambiar quién tiene acceso a qué.

## Dark launching: cargar sin mostrar

Una variante especialmente poderosa de los release toggles es el **dark launch** o "despliegue oscuro". La idea es ejecutar el nuevo código en segundo plano —por ejemplo, llamar a la nueva implementación de un algoritmo o a un nuevo endpoint— sin usar su resultado en la respuesta al usuario. En cambio, el sistema sigue devolviendo el resultado del código antiguo.

Esto permite medir el rendimiento y los errores del nuevo código con tráfico real de producción antes de que ningún usuario lo experimente. Es la forma más segura de validar que una nueva implementación tiene el comportamiento esperado bajo carga real.

```python
def get_product_price(product_id: str, user: User) -> float:
    legacy_price = legacy_pricing_engine.calculate(product_id, user)

    if feature_flags.is_enabled("new_pricing_engine_shadow"):
        try:
            new_price = new_pricing_engine.calculate(product_id, user)
            if legacy_price != new_price:
                logger.warning(
                    "Pricing mismatch: legacy=%s new=%s product=%s",
                    legacy_price, new_price, product_id
                )
        except Exception as e:
            metrics.increment("new_pricing_engine.errors")
            logger.error("New pricing engine failed", exc_info=e)

    return legacy_price  # siempre devuelve el resultado legacy
```

## Despliegue progresivo (percentage rollout)

Los flags no tienen por qué ser binarios. Un sistema de feature flags maduro permite activar una funcionalidad para un porcentaje creciente de usuarios, aumentando gradualmente la exposición a medida que se gana confianza.

```
Día 1: 1% de usuarios → monitorizar métricas y errores
Día 2: 10% de usuarios → todo normal
Día 3: 50% de usuarios → estable
Día 4: 100% de usuarios → flag eliminado
```

La asignación por porcentaje debe ser estable: el mismo usuario debe caer siempre en el mismo bucket (dentro o fuera del grupo de prueba). Esto se consigue hasheando el identificador del usuario con la clave del flag, en lugar de asignar al azar en cada solicitud.

```python
import hashlib

def is_user_in_rollout(user_id: str, flag_key: str, percentage: int) -> bool:
    hash_input = f"{flag_key}:{user_id}"
    hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
    bucket = hash_value % 100
    return bucket < percentage
```

## Antipatrones: cómo los feature flags se convierten en deuda técnica

Los feature flags son herramientas poderosas, pero también pueden convertirse en uno de los mayores focos de deuda técnica si no se gestionan bien.

**Flags zombie.** El antipatrón más común: flags que debían ser temporales pero siguen en el código meses o años después de que su funcionalidad fue activada al 100 %. El código acumula condiciones que ya nunca son falsas, lo que dificulta la lectura y el mantenimiento.

La solución es tratar la eliminación del flag como parte de la tarea de desarrollo. Cuando se activa una funcionalidad al 100 %, se crea inmediatamente un ticket para limpiar el código condicional. Algunos equipos usan fechas de expiración en los metadatos del flag para recibir alertas cuando un flag lleva demasiado tiempo sin usarse.

**Flags anidados.** Condiciones del estilo `if flag_a && flag_b && !flag_c` son difíciles de razonar y de probar. El número de combinaciones posibles crece exponencialmente. Si te encuentras anidando flags, probablemente la abstracción del flag no es la correcta para ese problema.

**Flags sin tests.** Cada rama de un flag debe estar cubierta por tests. No solo el camino habilitado, también el deshabilitado. Si solo testeas el código del flag activado, el día que lo elimines y borres la rama antigua no tendrás cobertura para detectar regresiones.

**Lógica de negocio en el sistema de flags.** Un flag debe ser una condición simple: habilitado/deshabilitado, porcentaje, lista de usuarios. Si el sistema de flags empieza a contener lógica compleja —"activo si el usuario tiene más de 30 días registrado Y su país es España Y no es fin de semana"—, esa lógica debería estar en el dominio de la aplicación, no en el sistema de flags.

## Herramientas para gestionar feature flags

Implementar un sistema de feature flags desde cero es posible pero costoso. Para la mayoría de equipos, tiene más sentido usar una solución existente.

**LaunchDarkly** es el estándar de la industria. Ofrece SDKs para casi todos los lenguajes, targeting avanzado, experimentos A/B integrados y un panel de control en tiempo real. Es de pago, con precios orientados a empresas.

**Unleash** es la alternativa open source más madura. Tiene todos los patrones principales implementados, incluye un servidor de administración con interfaz web y tiene SDKs oficiales para Java, Python, Node, Go y otros lenguajes. Se puede autoalojar o usar su versión en la nube.

**GrowthBook** está más orientado a experimentos A/B con análisis estadístico integrado. Es open source y especialmente popular en equipos de producto que quieren combinar despliegue progresivo con análisis de resultados.

Para proyectos pequeños o equipos que empiezan, una implementación simple basada en variables de entorno o una tabla en base de datos puede ser suficiente. La complejidad del sistema de flags debe escalar con la complejidad del equipo y del producto.

```python
# Implementación mínima con base de datos
class SimpleFeatureFlags:
    def __init__(self, db):
        self._db = db
        self._cache = {}

    def is_enabled(self, flag_key: str, user=None) -> bool:
        if flag_key not in self._cache:
            row = self._db.query(
                "SELECT enabled, rollout_percentage FROM feature_flags WHERE key = %s",
                (flag_key,)
            ).fetchone()
            self._cache[flag_key] = row

        flag = self._cache.get(flag_key)
        if not flag or not flag["enabled"]:
            return False

        if flag["rollout_percentage"] < 100 and user:
            return is_user_in_rollout(user.id, flag_key, flag["rollout_percentage"])

        return True
```

## Feature flags y el ciclo de despliegue

La adopción de feature flags transforma el proceso de despliegue de tres formas concretas.

Primero, **separa el despliegue de la activación**. Desplegar código y activar una funcionalidad son dos decisiones independientes que pueden tomarse en momentos distintos. El equipo de ingeniería controla cuándo llega el código a producción; el equipo de producto controla cuándo se activa para los usuarios. Esto reduce la coordinación necesaria entre equipos para hacer releases.

Segundo, **reduce el tamaño del riesgo**. En lugar de un despliegue mensual que cambia decenas de cosas a la vez, hay despliegues diarios o continuos con cambios pequeños. Si algo falla, el conjunto de cambios a investigar es mucho menor y la reversión —desactivar el flag— es inmediata.

Tercero, **habilita la validación en producción**. Probar en producción con un subconjunto controlado de usuarios reales es cualitativamente distinto a las pruebas en entornos de staging. El tráfico, los datos y los comportamientos de producción revelan problemas que los entornos de prueba no reproducen. Los feature flags hacen que esa validación sea segura y controlada.

## Cuándo no usarlos

Los feature flags no son la respuesta a todos los problemas de despliegue.

Los **cambios de esquema de base de datos** son el caso más claro donde los flags no ayudan directamente. Añadir una columna nullable o crear una nueva tabla es seguro y puede desplegarse sin flag. Pero cambiar el tipo de una columna o eliminar una columna requiere una secuencia de migraciones cuidadosamente coordinada con los despliegues, independientemente de si hay flags de por medio.

Las **interfaces de red** entre servicios también requieren atención especial. Si dos microservicios se comunican y cambias el contrato de la API, necesitas un proceso de versionado o un despliegue coordinado, no solo un flag.

Y por supuesto, un flag no sustituye a los tests. Un flag desactivado no es una forma de esconder código sin probar. El código detrás de un flag desactivado sigue necesitando cobertura de tests para garantizar que funcionará cuando se active.

## Conclusión

Los feature flags son uno de esos patrones que, una vez adoptados, es difícil imaginar cómo se trabajaba sin ellos. Permiten integrar continuamente, desplegar con confianza y validar con datos reales antes de comprometerse al 100 % con un cambio.

Como toda herramienta, tienen un coste: añaden complejidad al código, requieren un sistema de gestión y generan deuda técnica si no se eliminan a tiempo. Pero para equipos que apuntan a despliegues frecuentes y seguros, ese coste está ampliamente justificado por la reducción del riesgo y la velocidad que aportan.

El primer paso no tiene que ser instalar LaunchDarkly. Puede ser tan simple como una variable de entorno que controla si una nueva pantalla está activa. Lo importante es empezar a pensar en el despliegue y la activación como dos momentos distintos.
