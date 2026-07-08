---
titulo: "Los doce factores de una aplicación cloud-native"
seoTitulo: "Los 12 factores (12-Factor App): guía para aplicaciones cloud-native modernas"
fecha: "2026-07-09"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Entiende la metodología 12-Factor App: doce principios para construir aplicaciones modernas escalables, portátiles y fáciles de mantener en cualquier entorno cloud."
imagenPortada: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=500&fit=crop"
etiquetas: ["Architecture", "Cloud", "Best Practices", "DevOps", "12-Factor"]
categoria: "tech"
keywords: "12 factor app, twelve-factor, cloud native, aplicaciones distribuidas, best practices, arquitectura cloud, devops, escalabilidad, heroku, Adam Wiggins, configuración, microservicios"
---

# Los doce factores de una aplicación cloud-native

Cuando Heroku publicó la metodología **12-Factor App** en 2011, el mundo del desarrollo de software estaba justo en el punto de inflexión entre los servidores físicos y la computación en la nube. Sus autores —entre ellos Adam Wiggins— habían desplegado y observado cientos de aplicaciones en producción y destilaron en doce principios los patrones que separaban las apps que escalaban bien y eran fáciles de operar de las que se convertían en una pesadilla de mantenimiento.

Más de una década después, esos doce factores siguen siendo la referencia más práctica para construir aplicaciones cloud-native. No son dogmas ni reglas absolutas, sino una guía que ayuda a tomar decisiones de diseño consistentes desde el inicio del proyecto.

## I. Codebase: un repositorio, múltiples despliegues

El primer factor dice que una aplicación debe tener exactamente **un repositorio de código fuente** rastreado en control de versiones. De ese único repositorio se generan todos los despliegues: desarrollo, staging y producción.

Si tienes múltiples aplicaciones que comparten código, ese código compartido debe extraerse a una biblioteca e incluirse como dependencia. Tener una base de código por aplicación permite correlacionar qué versión está en producción y qué commit introdujo un bug, algo imposible cuando el mismo repositorio da pie a aplicaciones distintas.

## II. Dependencies: declarar y aislar dependencias

Una aplicación doce-factor **declara todas sus dependencias de forma explícita** en un archivo de manifiesto y jamás asume que una dependencia estará preinstalada en el sistema operativo del servidor.

En Java esto se consigue con Maven o Gradle; en Python con `requirements.txt` o `pyproject.toml`; en Node con `package.json`. El objetivo es que cualquier desarrollador pueda clonar el repositorio, instalar las dependencias con un solo comando y tener el entorno listo para correr la aplicación. Sin pasos manuales. Sin documentación de instalación de diez páginas.

El aislamiento también protege contra problemas de "funciona en mi máquina": si las dependencias están declaradas con versiones fijas, el comportamiento es reproducible en cualquier entorno.

## III. Config: configuración en el entorno, no en el código

La configuración que varía entre entornos (credenciales de base de datos, URLs de servicios externos, claves de API) debe estar en **variables de entorno**, nunca en el código fuente ni en archivos de configuración versionados.

Una prueba sencilla para saber si estás cumpliendo este factor: ¿podrías publicar tu repositorio como código abierto ahora mismo sin exponer ningún secreto? Si la respuesta es no, hay configuración que no debería estar en el código.

```yaml
# application.yml con Spring Boot
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASSWORD}
```

Las variables de entorno son independientes del lenguaje, del framework y del sistema operativo. Son el contrato más universal entre la aplicación y su entorno de despliegue.

## IV. Backing services: los servicios externos como recursos adjuntos

Las bases de datos, los sistemas de caché, los brokers de mensajes y cualquier otro servicio que la aplicación consume deben tratarse como **recursos adjuntos**: accesibles a través de una URL o conjunto de credenciales almacenadas en la configuración.

La consecuencia práctica es que cambiar de una base de datos PostgreSQL local a una instancia gestionada en AWS RDS no debería requerir cambiar ni una línea de código, solo actualizar la variable de entorno con la nueva URL de conexión. La aplicación no distingue si el servicio externo es local o remoto, propio o de terceros.

Este principio también facilita el desarrollo local: un desarrollador puede usar un contenedor Docker con PostgreSQL y la aplicación se comporta exactamente igual que en producción.

## V. Build, release, run: separar las etapas de construcción y ejecución

El ciclo de vida de una aplicación tiene tres etapas claramente diferenciadas que no deben mezclarse.

La etapa de **build** transforma el código fuente en un artefacto ejecutable: compila el código, resuelve dependencias, genera binarios. La etapa de **release** combina ese artefacto con la configuración del entorno y produce una versión lista para desplegar. La etapa de **run** ejecuta la aplicación en el entorno de destino.

```
código fuente → [build] → artefacto → [release] → versión 
= artefacto + config → [run] → proceso
```

Una de las consecuencias clave es que **no se puede modificar código en producción**. Si necesitas un cambio, generas un nuevo build, una nueva release y despliegas esa versión. Cada release tiene un identificador único (un timestamp, un número de versión) que permite hacer rollback en segundos si algo sale mal.

## VI. Processes: la aplicación como procesos sin estado

Los procesos de la aplicación deben ser **stateless** (sin estado) y **share-nothing** (sin estado compartido entre procesos). El estado persistente vive en los backing services, no en memoria o en el sistema de archivos del proceso.

Esto significa que no debes guardar información de sesión en memoria local si tienes más de una instancia de la aplicación. La próxima solicitud del mismo usuario puede llegar a un proceso diferente. La solución es delegar el estado a un servicio externo como Redis.

El sistema de archivos local tampoco es un almacenamiento confiable: en muchos entornos cloud los procesos pueden reiniciarse o migrar a otro nodo y perder cualquier archivo escrito localmente. Para archivos persistentes, usa un servicio de almacenamiento como S3.

```java
// MAL: estado en memoria, roto con múltiples instancias
private Map<String, UserSession> sessions = new HashMap<>();

// BIEN: estado en Redis
@Autowired
private RedisTemplate<String, UserSession> redisTemplate;
```

## VII. Port binding: exportar servicios a través de puertos

La aplicación debe ser **autocontenida** y exponer sus servicios a través de un puerto declarado en la configuración, sin depender de un servidor de aplicaciones externo inyectado en el entorno de despliegue.

En el mundo Java esto equivale a usar el servidor embebido de Spring Boot (Tomcat, Netty) en lugar de desplegar un WAR en un Tomcat externo. La aplicación arranca, escucha en el puerto que se le indica por variable de entorno y atiende las solicitudes directamente.

```
SERVER_PORT=8080 java -jar my-app.jar
```

Este principio convierte cada aplicación en un componente que puede enrutarse, cargarse detrás de un proxy inverso o componerse con otras aplicaciones de manera uniforme, independientemente de su stack tecnológico.

## VIII. Concurrency: escalar mediante procesos

Las aplicaciones doce-factor escalan **horizontalmente** añadiendo más instancias del proceso, no verticalmente dandole más recursos a una sola instancia. Para ello, los procesos deben diseñarse pensando en que habrá múltiples corriendo en paralelo.

La idea de fondo es el modelo de procesos de Unix: cada tipo de trabajo se asigna a un tipo de proceso. Los procesos web atienden solicitudes HTTP; los procesos worker procesan tareas en segundo plano; los procesos clock ejecutan tareas programadas.

```
web: java -jar app.jar --server.port=${PORT}
worker: java -jar app.jar --spring.profiles.active=worker
```

Cuando la carga aumenta, añades más procesos web. Cuando hay una cola de tareas acumulada, añades más workers. Cada tipo de proceso escala de forma independiente y proporcional a la demanda.

## IX. Disposability: procesos rápidos de iniciar y detener

Los procesos deben **arrancar rápido** (en segundos) y **apagarse limpiamente** cuando reciben la señal `SIGTERM`. La combinación de ambas propiedades permite despliegues sin interrupciones, escalado elástico y recuperación rápida ante fallos.

Un apagado limpio implica que el proceso deja de aceptar nuevas solicitudes, termina de procesar las que ya están en curso y libera los recursos que tiene abiertos (conexiones a base de datos, locks, archivos). Para los workers que procesan mensajes de una cola, significa devolver el mensaje sin procesar a la cola para que otro proceso lo retome.

En Spring Boot, el apagado elegante se activa con:

```yaml
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s
```

## X. Dev/prod parity: reducir la brecha entre entornos

La metodología original identifica tres tipos de brecha entre desarrollo y producción: la brecha de tiempo (el código tarda semanas en llegar a producción), la brecha de personal (los developers no participan en el despliegue) y la **brecha de herramientas** (el developer usa SQLite en local y PostgreSQL en producción).

La brecha de herramientas es la más peligrosa porque introduce comportamientos distintos que solo aparecen en producción. La solución es usar las mismas tecnologías en todos los entornos, y Docker lo hace trivial: puedes correr PostgreSQL, Redis y Kafka localmente con un `docker-compose.yml` en segundos.

```yaml
# docker-compose.yml para desarrollo
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: secret
  redis:
    image: redis:7-alpine
```

## XI. Logs: tratar los logs como flujos de eventos

La aplicación no debe preocuparse por el enrutamiento ni el almacenamiento de sus logs. Su única responsabilidad es **escribir eventos en stdout**, sin buffers, como un flujo continuo ordenado cronológicamente.

El entorno de ejecución es quien se encarga de capturar ese flujo y enviarlo donde corresponda: un archivo, un sistema de aggregation de logs como Elasticsearch, o una herramienta de observabilidad como Datadog. La aplicación no sabe ni le importa a dónde van sus logs.

Esta separación de responsabilidades permite cambiar de herramienta de logs sin tocar el código y facilita la correlación de eventos entre múltiples instancias de la misma aplicación.

```java
// Solo escribe en stdout/stderr vía el framework de logging
log.info("Order {} processed in {}ms", orderId, elapsed);
log.error("Payment failed for order {}", orderId, exception);
```

## XII. Admin processes: las tareas administrativas como procesos de una sola vez

Las tareas de administración puntual —migraciones de base de datos, scripts de limpieza, comandos de consola interactiva— deben ejecutarse como **procesos de una sola vez** en el mismo entorno que la aplicación, usando el mismo código y la misma configuración.

No deben ser scripts sueltos que dependen de herramientas locales ni procesos que se ejecutan en una máquina especial. Deben versionarse con el código y ejecutarse contra el release concreto que está en producción.

```bash
# Migración de base de datos como proceso admin
docker run --env-file .env.production my-app:v1.5.2 java -jar app.jar migrate
```

En el ecosistema Spring Boot, Flyway y Liquibase integran las migraciones directamente en el arranque de la aplicación, garantizando que siempre se ejecutan antes de que la aplicación atienda solicitudes.

## Los doce factores como sistema

Los factores no son una lista de verificación que se aplican de forma independiente. Son un sistema: cada factor habilita o refuerza a los demás.

Un proceso stateless (VI) solo funciona si la configuración está en el entorno (III) y el estado persiste en backing services (IV). El escalado horizontal (VIII) solo es posible si los procesos se inician y detienen rápido (IX). La paridad dev/prod (X) simplifica detectar problemas antes de que lleguen a producción.

| Factor | Qué resuelve |
|--------|-------------|
| I. Codebase | Trazabilidad del código en producción |
| II. Dependencies | Reproducibilidad del entorno |
| III. Config | Secretos fuera del código |
| IV. Backing services | Portabilidad de infraestructura |
| V. Build, release, run | Despliegues reproducibles y reversibles |
| VI. Processes | Escalado horizontal sin estado compartido |
| VII. Port binding | Autocontención del servicio |
| VIII. Concurrency | Escalado proporcional por tipo de trabajo |
| IX. Disposability | Despliegues y recuperación rápidos |
| X. Dev/prod parity | Menos sorpresas en producción |
| XI. Logs | Observabilidad sin acoplamiento |
| XII. Admin processes | Tareas administrativas seguras y trazables |

## Cuándo aplicarlos y cuándo no

La metodología fue diseñada pensando en aplicaciones web y de servicios, desplegadas en entornos cloud. No todos los factores aplican con la misma intensidad a todos los proyectos: una herramienta de línea de comandos, un script de análisis de datos o un sistema embebido tienen contextos muy distintos.

Tampoco es necesario implementarlos todos al mismo tiempo desde el inicio. En un proyecto nuevo, los más críticos de adoptar desde el primer día son los de configuración (III), dependencias (II), codebase (I) y paridad de entornos (X). Los relacionados con el proceso de despliegue y la operación en producción (V, IX, XI) van ganando relevancia conforme el proyecto madura y se despliega con regularidad.

Lo que sí conviene recordar es que estos factores se pagan al principio con algo de disciplina y se cobran con creces más tarde, cuando necesitas escalar, depurar un incidente en producción o incorporar a un desarrollador nuevo al equipo en un día en lugar de una semana.
