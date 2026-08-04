---
titulo: "Migraciones de base de datos con Flyway en Spring Boot"
seoTitulo: "Flyway con Spring Boot: guía completa de migraciones de base de datos"
fecha: "2026-08-05"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a gestionar el esquema de base de datos con Flyway en Spring Boot: convenciones de nomenclatura, migraciones repetibles, baseline para bases existentes, callbacks y estrategias para equipos y producción."
imagenPortada: "https://i.imgur.com/DT0u7nj.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Flyway", "Base de datos", "Migraciones", "Java", "PostgreSQL"]
categoria: "tech"
keywords: "flyway spring boot, migraciones base de datos spring, flyway postgresql spring boot, database migrations java, flyway configuration spring boot, flyway repair, flyway baseline, flyway callbacks, control de versiones esquema base de datos, spring boot flyway versioning"
---

# Migraciones de base de datos con Flyway en Spring Boot

El código vive en Git y su historial es inviolable. El esquema de la base de datos, en cambio, suele evolucionar a golpe de scripts SQL ejecutados a mano, anotaciones en wikis internas y convenciones que cada desarrollador interpreta a su manera. El resultado predecible es que el entorno de un compañero tiene una columna que el tuyo no tiene, que la migración de staging a producción requiere un checklist manual y que nadie sabe exactamente cuándo se añadió ese índice que ahora todo el mundo da por sentado.

**Flyway** resuelve esto aplicando al esquema de la base de datos la misma disciplina que Git aplica al código: cada cambio estructural es un archivo versionado, ordenado, revisable y reproducible en cualquier entorno. Cuando Spring Boot arranca, Flyway compara el historial de migraciones ejecutadas con los archivos disponibles y aplica automáticamente las que faltan. Sin scripts manuales, sin preguntas sobre el estado actual del esquema.

## ¿Por qué Flyway y no Liquibase?

Ambas herramientas resuelven el mismo problema. Flyway apuesta por SQL puro: cada migración es un archivo `.sql` estándar que cualquier desarrollador puede leer, revisar en un PR y ejecutar directamente en el cliente de base de datos si hace falta. Liquibase usa un formato de changeset (XML, YAML o JSON) que abstrae el SQL y permite operaciones de rollback declarativas, a costa de una mayor curva de aprendizaje.

La preferencia suele depender del equipo. Si el equipo está cómodo con SQL y quiere trazabilidad directa, Flyway es la elección natural. Si se necesita independencia de base de datos o rollback automático declarativo, Liquibase tiene más herramientas para eso. En proyectos Spring Boot con PostgreSQL o MySQL, Flyway es la opción más frecuente por su simplicidad.

## Configuración en Spring Boot

Añade la dependencia en `pom.xml`:

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- Para PostgreSQL, también necesitas el driver -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

Si usas MySQL o MariaDB en lugar de PostgreSQL, añade además el módulo específico de Flyway a partir de la versión 9:

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

Spring Boot detecta Flyway en el classpath y lo autoconfigura sin que hagas nada más. Con la configuración de datasource estándar en `application.yml`, Flyway ya funciona:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mi_app
    username: postgres
    password: secret
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: false
```

La propiedad `locations` indica dónde buscar los scripts de migración. El valor por defecto (`classpath:db/migration`) es suficiente para la mayoría de proyectos; solo necesitas especificarlo si usas otra ruta.

## Convención de nomenclatura

Flyway ordena y ejecuta los scripts según su nombre. El formato estándar es:

```
V{versión}__{descripción}.sql
```

- La `V` mayúscula es el prefijo de las migraciones versionadas.
- La versión puede ser un número entero (`V1`, `V2`) o con puntos (`V1.0`, `V1.1.2`). Flyway los ordena numericamente, no lexicográficamente.
- Los **dos guiones bajos** (`__`) separan la versión de la descripción. Es un doble guion bajo, no uno.
- La descripción usa guiones bajos como separador de palabras: `crear_tabla_usuarios`.

Ejemplos reales de una carpeta `src/main/resources/db/migration`:

```
V1__crear_schema_inicial.sql
V2__agregar_tabla_pedidos.sql
V3__indice_pedidos_cliente_id.sql
V4__agregar_columna_estado_usuario.sql
V5__renombrar_columna_precio_total.sql
```

Un error común es pensar que Flyway ejecuta los scripts en orden de creación del archivo. No lo hace: el orden depende exclusivamente del número de versión. `V10` se ejecuta después de `V9`, no después de `V1`.

### La tabla `flyway_schema_history`

Cuando Flyway ejecuta una migración por primera vez, registra el evento en la tabla `flyway_schema_history` (o `schema_version` en versiones antiguas). Esta tabla almacena la versión, la descripción, el checksum del archivo, la fecha de ejecución y si fue exitosa o falló.

En cada arranque de la aplicación, Flyway recalcula el checksum de cada script y lo compara con el almacenado. Si detecta que un archivo ya ejecutado fue modificado, lanza una excepción y detiene el arranque. Esto garantiza que el historial sea inmutable: nunca debes editar una migración ya aplicada en ningún entorno.

## Escribir una migración

```sql
-- V1__crear_schema_inicial.sql
CREATE TABLE usuarios (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE pedidos (
    id          BIGSERIAL PRIMARY KEY,
    usuario_id  BIGINT       NOT NULL REFERENCES usuarios(id),
    total       NUMERIC(12,2) NOT NULL CHECK (total >= 0),
    estado      VARCHAR(20)  NOT NULL DEFAULT 'PENDIENTE',
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pedidos_usuario_id ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_estado     ON pedidos(estado);
```

Cada migración debería ser atómica y autocontenida: si falla a mitad, la base de datos no debería quedar en un estado inconsistente. Para eso, envuelve las operaciones destructivas o complejas en una transacción explícita cuando el motor lo permita.

```sql
-- V4__agregar_columna_estado_usuario.sql
BEGIN;

ALTER TABLE usuarios ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';
UPDATE usuarios SET estado = 'INACTIVO' WHERE activo = FALSE;
ALTER TABLE usuarios DROP COLUMN activo;

COMMIT;
```

## Migraciones repetibles

Además de las migraciones versionadas (`V`), Flyway soporta **migraciones repetibles** con el prefijo `R`:

```
R__vista_resumen_pedidos.sql
R__funciones_utilitarias.sql
```

Las migraciones repetibles no tienen versión. Flyway las vuelve a ejecutar cada vez que su contenido cambia (es decir, cuando el checksum difiere del almacenado). Son perfectas para objetos que se pueden recrear de forma idempotente: vistas, funciones almacenadas, sinónimos o datos de referencia.

```sql
-- R__vista_resumen_pedidos.sql
-- Esta vista se recreará automáticamente si cambia su definición
CREATE OR REPLACE VIEW vista_resumen_pedidos AS
SELECT
    u.email,
    COUNT(p.id)        AS total_pedidos,
    SUM(p.total)       AS monto_total,
    MAX(p.creado_en)   AS ultimo_pedido
FROM usuarios u
LEFT JOIN pedidos p ON p.usuario_id = u.id
GROUP BY u.id, u.email;
```

Las migraciones repetibles se ejecutan siempre después de todas las versionadas, por lo que pueden referirse de forma segura a tablas y columnas creadas en cualquier migración `V`.

## Baseline: incorporar una base de datos existente

Si el proyecto ya tiene una base de datos en producción con esquema establecido y quieres empezar a usar Flyway sin perder los datos existentes, necesitas establecer un **baseline**.

El baseline le dice a Flyway: "todo lo que existe hasta esta versión ya está aplicado; empieza a rastrear desde aquí".

```yaml
spring:
  flyway:
    baseline-on-migrate: true
    baseline-version: "1"        # Marca la versión de baseline
    baseline-description: "<<Flyway Baseline>>"
```

Con esta configuración, la primera vez que Flyway encuentra una base de datos sin la tabla `flyway_schema_history`, inserta una fila de baseline marcando la versión especificada como ya ejecutada. Las migraciones con versión mayor a la del baseline se aplican normalmente; las anteriores o iguales se ignoran.

El flujo típico al introducir Flyway en un proyecto existente es:

1. Crear `V1__schema_inicial.sql` que refleje el estado actual del esquema (es el "baseline documental").
2. Configurar `baseline-on-migrate: true` y `baseline-version: "1"`.
3. En el entorno existente (producción), Flyway crea el baseline sin ejecutar `V1` (porque marca esa versión como ya aplicada).
4. En entornos nuevos (CI, máquinas nuevas de desarrollo), Flyway ejecuta `V1` normalmente y construye el esquema desde cero.
5. A partir de `V2`, todas las migraciones se ejecutan en todos los entornos de la misma forma.

Una vez que todos los entornos tienen la tabla de historial, cambia `baseline-on-migrate` a `false` para que Flyway no intente aplicar el baseline en arranques normales.

## Callbacks

Flyway permite ejecutar lógica SQL antes y después de eventos del ciclo de migración mediante callbacks. Los nombres de archivo siguen el patrón `{evento}.sql`:

```
db/migration/
├── V1__crear_schema_inicial.sql
├── beforeMigrate.sql          ← Se ejecuta antes de cada ciclo de migración
└── afterEachMigrate.sql       ← Se ejecuta después de cada script individual
```

Los eventos más útiles son:

- `beforeMigrate` — Preparaciones globales antes de iniciar las migraciones.
- `afterMigrate` — Limpieza o notificaciones tras completar todas las migraciones.
- `beforeEachMigrate` / `afterEachMigrate` — Antes y después de cada script individual.
- `afterMigrateError` — Se ejecuta si alguna migración falla; útil para alertas o logs de auditoría.

También puedes implementar callbacks en Java si necesitas lógica que no puede expresarse en SQL:

```java
@Component
public class MigracionCallback implements Callback {

    private static final Logger log = LoggerFactory.getLogger(MigracionCallback.class);

    @Override
    public boolean supports(Event event, Context context) {
        return event == Event.AFTER_MIGRATE;
    }

    @Override
    public boolean canHandleInTransaction(Event event, Context context) {
        return true;
    }

    @Override
    public void handle(Event event, Context context) {
        log.info("Migraciones completadas. Esquema actualizado.");
        // Aquí podrías invalidar cachés, enviar métricas, etc.
    }

    @Override
    public String getCallbackName() {
        return "MigracionCallback";
    }
}
```

Spring Boot registra automáticamente los beans que implementan `Callback`, por lo que solo necesitas declararlo como `@Component`.

## Configuración por entorno

En desarrollo es útil tener datos de prueba que se cargan automáticamente. En producción eso sería un error grave. La forma correcta de separar este comportamiento es con ubicaciones distintas por perfil:

```yaml
# application.yml (configuración base)
spring:
  flyway:
    locations: classpath:db/migration

---
# application-dev.yml (solo en perfil dev)
spring:
  flyway:
    locations:
      - classpath:db/migration
      - classpath:db/testdata
```

La carpeta `db/testdata` puede contener scripts que insertan datos de prueba con el prefijo `R` (para que se puedan recargar) o con versiones altas como `V1000__datos_prueba.sql`:

```sql
-- db/testdata/R__datos_iniciales_dev.sql
TRUNCATE TABLE pedidos, usuarios RESTART IDENTITY CASCADE;

INSERT INTO usuarios (email, nombre) VALUES
    ('ana@ejemplo.com', 'Ana García'),
    ('carlos@ejemplo.com', 'Carlos López');

INSERT INTO pedidos (usuario_id, total, estado) VALUES
    (1, 149.99, 'COMPLETADO'),
    (1, 59.50, 'PENDIENTE'),
    (2, 299.00, 'COMPLETADO');
```

## Trabajo en equipo y resolución de conflictos

En un equipo de varios desarrolladores es habitual que dos personas creen migraciones con la misma versión en ramas diferentes. Cuando ambas ramas se fusionan, Flyway detecta el conflicto al arrancar porque hay dos archivos con el mismo número de versión.

La estrategia para evitar esto depende del tamaño del equipo:

**Numeración secuencial con comunicación**: la forma más simple. Un canal de equipo o una issue de GitHub actúa como registro del próximo número disponible. Funciona bien en equipos pequeños.

**Timestamps como versión**: en lugar de enteros incrementales, usa timestamps:

```
V20260804123000__agregar_tabla_notificaciones.sql
V20260804154512__indice_notificaciones_usuario.sql
```

Los timestamps son prácticamente imposibles de colisionar entre desarrolladores que trabajan en paralelo. El riesgo es que el listado de migraciones es más difícil de leer.

**Flyway Teams y resolución automática**: Flyway Teams (la edición comercial) incluye detección automática de conflictos en el pipeline de CI y herramientas para renumerar migraciones antes de fusionar.

Si el conflicto ya ocurrió y ambas migraciones están en el historial, necesitas `flyway repair`:

```bash
# Elimina las entradas fallidas del historial para que Flyway pueda reintentar
./mvnw flyway:repair
```

`repair` elimina de `flyway_schema_history` las filas con estado de error y recalcula los checksums. Es el comando de recuperación para situaciones donde una migración falló a mitad y dejó la tabla de historial en un estado inconsistente.

## Validación en el arranque

Por defecto, Flyway valida que todos los scripts en disco coincidan con el historial almacenado. Si alguien editó por error un script ya aplicado, el arranque falla con un mensaje claro:

```
Flyway validation error:
Migration checksum mismatch for migration V3__indice_pedidos_cliente_id.sql
-> Applied to database : 123456789
-> Resolved locally    : 987654321
```

Este comportamiento es el esperado y no debes desactivarlo en producción. Si necesitas deshabilitar la validación puntualmente durante el desarrollo:

```yaml
spring:
  flyway:
    validate-on-migrate: false   # Solo para entornos de desarrollo si es estrictamente necesario
```

## Mejores prácticas

**Trata las migraciones como código de producción.** Cada script debe ser revisado en pull request igual que cualquier otro cambio de código. Los errores en migraciones son más costosos de revertir que los errores en código de aplicación.

**Una migración, un propósito.** Evita combinar varias operaciones no relacionadas en el mismo script. Si un día necesitas revertir solo una parte del cambio, te resultará imposible.

**Nunca modifiques una migración ya aplicada.** Si cometiste un error, crea una nueva migración que lo corrija. Editar un script existente rompe el checksum y bloquea todos los entornos donde ya fue ejecutado.

**Testea las migraciones en un entorno limpio.** La CI debe incluir un job que construye el esquema desde cero (sin baseline) para verificar que la secuencia completa de migraciones funciona de principio a fin. Es la única forma de detectar dependencias ocultas entre scripts.

**Cuidado con las operaciones que bloquean tablas en producción.** `ALTER TABLE ADD COLUMN NOT NULL` sin valor por defecto, `CREATE INDEX` sin `CONCURRENTLY`, o `TRUNCATE` en tablas grandes pueden provocar bloqueos prolongados en producción. Conoce el comportamiento de tu motor antes de aplicar cambios que afecten a tablas con tráfico activo.

```sql
-- En PostgreSQL, crear índices sin bloquear escrituras
CREATE INDEX CONCURRENTLY idx_pedidos_creado_en ON pedidos(creado_en);
```

**Incluye la carpeta de migraciones en revisiones de seguridad.** Los scripts SQL tienen acceso directo al esquema. Un script malicioso o con un error de permisos puede comprometer datos de producción. Trata `db/migration` con el mismo nivel de escrutinio que el código de acceso a datos.

## Conclusión

Flyway convierte el esquema de la base de datos en un ciudadano de primera clase del control de versiones. Cada cambio estructural queda registrado, ordenado y es reproducible en cualquier entorno con un simple arranque de la aplicación. La integración con Spring Boot es casi transparente: añadir la dependencia es suficiente para que el ciclo de migración se active automáticamente en cada despliegue.

El costo de adoptar Flyway es bajo —unos minutos de configuración inicial y el hábito de crear un script `.sql` por cada cambio de esquema—. El beneficio es eliminar una categoría completa de errores de entorno: el clásico "funciona en local pero no en staging porque falta una columna" desaparece cuando el esquema se despliega junto con el código que lo usa.
