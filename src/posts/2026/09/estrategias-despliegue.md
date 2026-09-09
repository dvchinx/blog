---
titulo: "Estrategias de despliegue: Blue-Green, Canary y Rolling Releases"
seoTitulo: "Estrategias de despliegue: Blue-Green, Canary Release y Rolling Update explicados"
fecha: "2026-09-09"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende las tres estrategias de despliegue más usadas en producción: Blue-Green, Canary Release y Rolling Update. Cuándo usar cada una, sus ventajas, riesgos y cómo se implementan en la práctica."
imagenPortada: "https://i.imgur.com/aT6bEUW.png?w=800&h=500&fit=crop"
etiquetas: ["DevOps", "Deployment", "Blue-Green", "Canary Release", "CI/CD", "Architecture"]
categoria: "tech"
keywords: "blue-green deployment, canary release, rolling update, estrategias de despliegue, zero downtime deployment, despliegue sin tiempo de inactividad, CI/CD, DevOps, kubernetes deployment strategies, feature flags deployment, producción segura"
---

# Estrategias de despliegue: Blue-Green, Canary y Rolling Releases

Desplegar software en producción es, paradójicamente, uno de los momentos de más riesgo en el ciclo de vida de una aplicación. Es el instante en que el código que funcionaba perfectamente en staging encuentra condiciones reales: datos reales, tráfico real, usuarios reales que hacen cosas inesperadas.

Durante muchos años la respuesta habitual fue el despliegue en ventana de mantenimiento: apagar la aplicación en horas de baja actividad, subir la nueva versión y rezar. Esta estrategia tiene dos problemas obvios. Primero, implica tiempo de inactividad planificado. Segundo, si algo sale mal a las 3 de la madrugada, el rollback es manual y lento.

Las estrategias modernas de despliegue atacan ambos problemas. El objetivo es llevar nueva versiones a producción con **cero tiempo de inactividad** y con la capacidad de revertir de forma rápida o incluso gradual si algo falla. Las tres más extendidas son Blue-Green Deployment, Canary Release y Rolling Update. Cada una tiene sus propias ventajas, complejidades y casos de uso ideales.

## Blue-Green Deployment

La idea del Blue-Green es simple: mantener siempre dos entornos de producción idénticos, llamados convencionalmente **blue** y **green**. En cualquier momento, solo uno de ellos recibe tráfico real. El otro está en espera, listo para ser activado.

El flujo de un despliegue es el siguiente:

1. El entorno **blue** está activo y recibe todo el tráfico de usuarios.
2. Se despliega la nueva versión en el entorno **green**, que no recibe tráfico todavía.
3. Se ejecutan pruebas de aceptación y smoke tests contra el entorno green.
4. Se redirige el tráfico de blue a green (normalmente cambiando la configuración del load balancer o del DNS).
5. El entorno blue queda en espera. Si aparece algún problema, revertir es tan rápido como volver a cambiar el puntero del load balancer.

```
Antes del despliegue:
  ┌─────────────┐
  │  Users      │
  └──────┬──────┘
         │
  ┌──────▼──────┐      ┌─────────────┐
  │  BLUE (v1)  │      │ GREEN (idle)│
  │  [activo]   │      │             │
  └─────────────┘      └─────────────┘

Tras el switch:
  ┌─────────────┐
  │  Users      │
  └──────┬──────┘
         │
  ┌─────────────┐      ┌──────────────┐
  │  BLUE (v1)  │      │ GREEN (v2)   │
  │  [en espera]│      │ [activo]     │
  └─────────────┘      └──────────────┘
```

### Ventajas

El rollback es instantáneo: si la versión nueva tiene un problema crítico, bastacon redirigir el tráfico de vuelta al entorno anterior. No hay que hacer un nuevo despliegue ni revertir commits.

El entorno inactivo sirve también como staging de producción. Se pueden ejecutar pruebas completas contra la nueva versión en el mismo hardware y con acceso a los mismos datos sin afectar a los usuarios.

El cambio de tráfico es atómico. No hay un período en que parte de los usuarios vea la versión nueva y otra parte la antigua, lo que simplifica el razonamiento sobre el comportamiento del sistema durante el despliegue.

### Desafíos

El coste es el principal inconveniente: mantener dos entornos de producción implica el doble de infraestructura al menos durante el período de transición. En sistemas grandes esto puede ser significativo.

El manejo de la **base de datos** es el reto más complejo. Si el despliegue incluye migraciones de esquema incompatibles con la versión anterior, el rollback ya no es tan simple como cambiar el load balancer. La estrategia habitual es usar migraciones compatibles hacia atrás: añadir columnas sin eliminar las viejas, mantener compatibilidad durante al menos un ciclo de despliegue, y eliminar lo obsoleto en el despliegue siguiente.

## Canary Release

El nombre viene de la práctica histórica de los mineros que llevaban canarios a las minas para detectar gases tóxicos. La idea es exponer la nueva versión a un subconjunto pequeño de usuarios primero, observar su comportamiento, y expandir gradualmente si todo va bien.

```
Fase inicial (5% del tráfico):
  ┌─────────────┐
  │  100 Users  │
  └──────┬──────┘
         │
  ┌──────┴──────────────────────────┐
  │           Load Balancer          │
  └──────┬─────────────┬────────────┘
         │ 95%          │ 5%
  ┌──────▼──────┐  ┌───▼──────────┐
  │   v1        │  │   v2 (canary)│
  └─────────────┘  └──────────────┘

Fase final (100% del tráfico tras validación):
  ┌─────────────┐
  │  100 Users  │
  └──────┬──────┘
         │
  ┌──────▼──────────────────────────┐
  │           Load Balancer          │
  └──────┬──────────────────────────┘
         │ 100%
  ┌──────▼──────┐
  │     v2      │
  └─────────────┘
```

El proceso típico de un Canary Release:

1. Desplegar la nueva versión en un subconjunto de instancias (por ejemplo, el 5% de los pods en Kubernetes).
2. Monitorizar métricas clave: tasa de errores, latencia, tasa de conversión, logs de excepciones.
3. Si las métricas son correctas, aumentar gradualmente el porcentaje: 5% → 25% → 50% → 100%.
4. Si aparece una anomalía, retirar el canary sin afectar al resto de usuarios.

### Cómo se segmenta el tráfico

Hay varias formas de decidir qué usuarios reciben la versión canary:

**Por porcentaje aleatorio**: el load balancer distribuye el tráfico en proporción. Simple y sin estado, pero no garantiza consistencia: un mismo usuario puede ver la versión nueva en una petición y la vieja en la siguiente.

**Por usuario o segmento**: se dirige a usuarios específicos (por id, por región, por tipo de cuenta) a la versión canary. Requiere más lógica en el enrutamiento pero proporciona una experiencia consistente y permite elegir usuarios representativos o usuarios internos primero.

**Por cabecera o cookie**: el cliente puede ser forzado a la versión canary mediante una cabecera o cookie específica. Útil para QA y para el equipo de desarrollo que quiere verificar el comportamiento en producción antes de ampliar el porcentaje.

### Ventajas

Es la estrategia que minimiza el radio de impacto de un problema. Un bug crítico que afecte al 5% de los usuarios es mucho más manejable que uno que afecta al 100%.

Permite validar hipótesis sobre el comportamiento del usuario en producción real antes de un rollout completo. Si el objetivo del despliegue es una mejora de rendimiento, se puede medir el impacto real comparando métricas entre los grupos.

### Desafíos

Requiere infraestructura de monitorización madura. Para que el Canary Release sea útil, hay que saber con certeza que las métricas que se están monitorizando son representativas y que las alertas están bien calibradas.

Gestionar múltiples versiones simultáneas en producción añade complejidad operativa. Las APIs internas entre servicios deben ser compatibles con todas las versiones desplegadas al mismo tiempo.

La base de datos sigue siendo el punto más delicado, por las mismas razones que en Blue-Green.

## Rolling Update

El Rolling Update despliega la nueva versión de forma incremental, reemplazando instancias de la versión antigua una a una (o en pequeños lotes) por instancias de la nueva versión.

```
Estado inicial:  [v1] [v1] [v1] [v1] [v1] [v1]

Paso 1:          [v2] [v1] [v1] [v1] [v1] [v1]
Paso 2:          [v2] [v2] [v1] [v1] [v1] [v1]
Paso 3:          [v2] [v2] [v2] [v1] [v1] [v1]
...
Final:           [v2] [v2] [v2] [v2] [v2] [v2]
```

Es la estrategia por defecto en Kubernetes para los Deployments, donde se puede configurar con dos parámetros clave:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # instancias extras permitidas durante el despliegue
    maxUnavailable: 0  # instancias que pueden estar no disponibles durante el proceso
```

Con `maxUnavailable: 0`, Kubernetes nunca baja por debajo de la capacidad nominal: levanta primero la nueva instancia, espera a que esté lista (readiness probe), y solo entonces elimina una instancia de la versión anterior. Con `maxSurge: 1`, puede haber temporalmente una instancia extra, lo que acelera el proceso.

### Ventajas

Es la estrategia más económica en recursos: no requiere duplicar el entorno como Blue-Green. En cada momento solo hay un número limitado de instancias extra.

El despliegue gradual proporciona cierta detección temprana de problemas. Si una instancia nueva empieza a fallar los health checks, Kubernetes detiene el rollout automáticamente.

### Desafíos

Durante el despliegue, **ambas versiones coexisten en producción**. Esto significa que una petición de usuario puede ser atendida por la versión antigua o la nueva dependiendo de la instancia que responda. Si hay cambios incompatibles en el comportamiento o en el formato de las respuestas, esto puede causar inconsistencias visibles.

El rollback no es instantáneo. Deshacer un Rolling Update implica iniciar otro rolling update en sentido inverso, lo que lleva tiempo proporcional al número de instancias.

## Comparativa y cuándo usar cada estrategia

| | Blue-Green | Canary | Rolling Update |
|---|---|---|---|
| **Coste de infraestructura** | Alto (doble entorno) | Medio | Bajo |
| **Velocidad de rollback** | Inmediato | Rápido | Lento |
| **Versiones simultáneas** | No | Sí, controlado | Sí, todo el rollout |
| **Complejidad** | Media | Alta | Baja |
| **Riesgo en caso de bug** | Todo o nada al hacer switch | Mínimo (% pequeño) | Depende del progreso |

**Blue-Green** es la opción ideal cuando el rollback rápido es la prioridad absoluta, cuando el sistema tiene pocas instancias y el coste de duplicar no es prohibitivo, o cuando el cambio es lo suficientemente significativo como para querer un período de validación completo antes de exponerlo a todos los usuarios.

**Canary Release** es la mejor opción para cambios de alto riesgo o cuando se quieren medir métricas de impacto real antes del rollout completo. Requiere una plataforma de monitorización y enrutamiento de tráfico más sofisticada.

**Rolling Update** es la opción más práctica para el día a día: despliegues frecuentes de cambios incrementales donde la compatibilidad entre versiones está garantizada y la velocidad de rollback no es crítica. Es el punto de partida correcto para la mayoría de equipos.

## El problema común: las migraciones de base de datos

Las tres estrategias tienen un denominador común: la dificultad de gestionar cambios de esquema de base de datos que deben convivir con varias versiones del código al mismo tiempo.

La solución estándar es seguir el principio de **expand-contract**:

1. **Expand**: la migración añade la nueva columna/tabla/índice sin eliminar lo antiguo. La versión nueva escribe en ambos sitios; la versión antigua sigue leyendo del sitio original sin romperse.
2. **Contrato en producción**: una vez que el rollout es completo y la versión antigua ya no está en producción, ambas versiones conviven brevemente.
3. **Contract**: en el siguiente despliegue se elimina el código de compatibilidad y los elementos de esquema obsoletos.

```sql
-- Fase expand: añadir nueva columna manteniendo la antigua
ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(255);

-- Código de la nueva versión: escribe en ambas columnas durante la transición
UPDATE usuarios SET
  nombre = CONCAT(first_name, ' ', last_name),
  nombre_completo = CONCAT(first_name, ' ', last_name);

-- Fase contract (despliegue posterior): eliminar columna antigua
ALTER TABLE usuarios DROP COLUMN nombre;
```

Este patrón aplica igual tanto si se usa Blue-Green como Canary o Rolling Update. La diferencia es que en Blue-Green la ventana de coexistencia es más corta y controlada.

## Automatización: el rol del pipeline de CI/CD

Ninguna de estas estrategias funciona bien si depende de pasos manuales. El pipeline de CI/CD es el que debe orquestar el proceso de despliegue, incluyendo:

- Ejecutar las pruebas antes de iniciar el despliegue.
- Aplicar las migraciones de base de datos antes de activar la nueva versión.
- Configurar el enrutamiento de tráfico (porcentaje de canary, switch de load balancer).
- Monitorizar métricas durante el período de canary y escalar o revertir automáticamente.
- Notificar al equipo del resultado.

En Kubernetes, herramientas como **Argo Rollouts** o **Flagger** añaden capacidades de Canary Release y Blue-Green sobre los Deployments estándar, con análisis automático de métricas y decisión de avanzar o revertir basada en Prometheus o Datadog.

```yaml
# Ejemplo con Argo Rollouts - Canary con análisis automático
apiVersion: argoproj.io/v1alpha1
kind: Rollout
spec:
  strategy:
    canary:
      steps:
      - setWeight: 5
      - pause: {duration: 10m}
      - analysis:
          templates:
          - templateName: success-rate
      - setWeight: 50
      - pause: {duration: 5m}
      - setWeight: 100
```

## Elegir la estrategia correcta no es permanente

La estrategia de despliegue no es una decisión que se toma una vez para siempre. Un equipo puede empezar con Rolling Updates por su simplicidad, adoptar Canary Releases a medida que la plataforma de monitorización madura, y usar Blue-Green para cambios especialmente críticos.

Lo que sí es permanente es el objetivo: llevar software a producción de forma segura, rápida y con capacidad de reacción ante lo inesperado. Las estrategias son el medio; la capacidad de desplegar con confianza es el fin.
