---
titulo: "API Versioning: cómo evolucionar tus APIs REST sin romper a tus clientes"
seoTitulo: "API Versioning: estrategias para versionar APIs REST y mantener compatibilidad hacia atrás"
fecha: "2026-07-29"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende las principales estrategias de versionado de APIs REST —URI, cabecera, query param y media type—, cuándo introducir una nueva versión y cómo gestionar la deprecación sin romper a tus clientes existentes."
imagenPortada: "https://i.imgur.com/QmXu2Nb.png?w=800&h=500&fit=crop"
etiquetas: ["API Design", "REST", "Best Practices", "Architecture", "Software"]
categoria: "tech"
keywords: "api versioning, versionado de APIs REST, URI versioning, header versioning, media type versioning, backward compatibility, API evolution, deprecación API, versionar API Spring Boot, semantic versioning API"
---

# API Versioning: cómo evolucionar tus APIs REST sin romper a tus clientes

Una API pública es un contrato. Cuando la publicas, los clientes —otras aplicaciones, equipos, terceros— construyen sobre ella y asumen que se comportará de la misma manera indefinidamente. El problema es que los sistemas cambian: los modelos de negocio evolucionan, aparecen nuevos requisitos, se descubren errores de diseño. En algún momento necesitas modificar la API de formas que romperían ese contrato.

El versionado de APIs es la respuesta a ese problema: te permite introducir cambios que rompen la compatibilidad sin desconectar a los clientes que ya existen. Pero hay varias formas de implementarlo, y la elección importa más de lo que parece.

## Qué es un cambio que rompe la compatibilidad

Antes de hablar de estrategias, conviene tener claro qué es exactamente lo que queremos evitar. Un **breaking change** es cualquier modificación que hace que un cliente existente deje de funcionar sin cambios en su código:

- Eliminar un campo de la respuesta que el cliente utiliza.
- Cambiar el tipo de un campo (de `string` a `number`, por ejemplo).
- Cambiar el nombre de un endpoint.
- Modificar la semántica de un parámetro existente.
- Hacer obligatorio un campo que antes era opcional.

Por el contrario, hay cambios que generalmente son seguros sin necesidad de una nueva versión:

- Agregar nuevos campos opcionales a la respuesta.
- Agregar nuevos endpoints.
- Agregar nuevos valores opcionales en los request bodies.
- Mejorar mensajes de error sin cambiar los códigos HTTP.

La regla general es que los clientes bien diseñados ignoran los campos que no conocen y no dependen del orden. Si tus clientes siguen esa convención, puedes agregar sin versionar. Pero cuando necesitas modificar o eliminar, el versionado entra en juego.

## Las cuatro estrategias principales

### 1. URI Versioning

La forma más común y visible. El número de versión forma parte de la URL:

```
GET /api/v1/usuarios/42
GET /api/v2/usuarios/42
```

Es el enfoque más explícito y fácil de entender. Los desarrolladores saben exactamente qué versión están usando con solo mirar la URL. Es fácil de enrutar en el servidor y de documentar. Los logs y métricas distinguen automáticamente el tráfico por versión.

```java
@RestController
@RequestMapping("/api/v1/usuarios")
public class UsuarioControllerV1 {

    @GetMapping("/{id}")
    public UsuarioDtoV1 obtener(@PathVariable Long id) {
        Usuario usuario = usuarioService.buscarPorId(id);
        return new UsuarioDtoV1(usuario.getId(), usuario.getNombre());
    }
}

@RestController
@RequestMapping("/api/v2/usuarios")
public class UsuarioControllerV2 {

    @GetMapping("/{id}")
    public UsuarioDtoV2 obtener(@PathVariable Long id) {
        Usuario usuario = usuarioService.buscarPorId(id);
        return new UsuarioDtoV2(
            usuario.getId(),
            usuario.getNombreCompleto(),  // campo renombrado y expandido
            usuario.getEmail()            // nuevo campo
        );
    }
}
```

La desventaja más citada es que, en sentido estricto, la URI debería identificar el recurso, no su versión. `/api/v1/usuarios/42` y `/api/v2/usuarios/42` representan el mismo recurso (el usuario 42), y tener dos URLs diferentes para el mismo recurso contradice los principios REST puros.

En la práctica, este argumento importa menos que la claridad. La mayoría de las APIs más usadas del mundo usan URI versioning: Stripe, GitHub, Twitter.

### 2. Header Versioning

El número de versión viaja en una cabecera HTTP personalizada:

```http
GET /api/usuarios/42 HTTP/1.1
X-API-Version: 2
```

Esto mantiene las URIs limpias y el recurso identificado por una sola URL. Los clientes indican la versión que soportan mediante la cabecera.

```java
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

    @GetMapping("/{id}")
    public ResponseEntity<?> obtener(
        @PathVariable Long id,
        @RequestHeader(value = "X-API-Version", defaultValue = "1") String version
    ) {
        Usuario usuario = usuarioService.buscarPorId(id);

        return switch (version) {
            case "2" -> ResponseEntity.ok(new UsuarioDtoV2(usuario));
            default  -> ResponseEntity.ok(new UsuarioDtoV1(usuario));
        };
    }
}
```

El problema del header versioning es la visibilidad: la versión no aparece en la URL, así que los logs, las herramientas de caché y los proxies no la ven por defecto. Los desarrolladores tampoco pueden probar distintas versiones simplemente pegando una URL en el navegador. Requiere configuración adicional en herramientas como CDNs o API Gateways para enrutar correctamente por versión.

### 3. Query Parameter Versioning

La versión se pasa como parámetro de consulta:

```
GET /api/usuarios/42?version=2
GET /api/usuarios/42?api-version=2
```

Es fácil de entender y de probar desde el navegador o cualquier cliente HTTP. Sin embargo, los parámetros de query están pensados para filtrar o paginar recursos, no para seleccionar qué contrato se está usando. Puede interferir con el caché HTTP, que por defecto trata URLs con distinto query string como recursos distintos.

```java
@GetMapping("/api/usuarios/{id}")
public ResponseEntity<?> obtener(
    @PathVariable Long id,
    @RequestParam(value = "version", defaultValue = "1") String version
) {
    // ...
}
```

Es una solución funcional para APIs internas o privadas donde la limpieza del contrato importa menos que la conveniencia.

### 4. Media Type Versioning (Content Negotiation)

El enfoque más "RESTful" en teoría. El cliente negocia el tipo de contenido que quiere recibir, incluyendo la versión en el header `Accept`:

```http
GET /api/usuarios/42 HTTP/1.1
Accept: application/vnd.miempresa.api+json;version=2
```

El servidor responde con el tipo de contenido acordado:

```http
Content-Type: application/vnd.miempresa.api+json;version=2
```

```java
@GetMapping(
    value = "/api/usuarios/{id}",
    produces = "application/vnd.miempresa.api+json;version=2"
)
public UsuarioDtoV2 obtenerV2(@PathVariable Long id) {
    return new UsuarioDtoV2(usuarioService.buscarPorId(id));
}

@GetMapping(
    value = "/api/usuarios/{id}",
    produces = "application/vnd.miempresa.api+json;version=1"
)
public UsuarioDtoV1 obtenerV1(@PathVariable Long id) {
    return new UsuarioDtoV1(usuarioService.buscarPorId(id));
}
```

Es el enfoque más correcto desde la perspectiva REST y es el que usan algunas APIs sofisticadas como la de GitHub (que soporta ambos: URI y media type). Pero es el más difícil de implementar, documentar y depurar. La mayoría de los desarrolladores no están familiarizados con él y los errores de negociación de contenido pueden ser frustrantes de diagnosticar.

## Cómo elegir

No hay una respuesta universal, pero hay factores que guían la decisión:

**Usa URI versioning si:** tienes una API pública o de terceros donde la claridad y la facilidad de uso son la prioridad. Es el estándar de facto y el que menos fricción genera.

**Usa header versioning si:** quieres mantener URIs limpias y tienes control sobre los clientes (ej. una API interna consumida por tu propio frontend o servicios propios). Requiere algo más de disciplina en el equipo.

**Evita query param versioning en APIs públicas.** Funciona, pero no transmite seriedad en el diseño.

**Reserva media type versioning para APIs donde REST puro es una restricción de diseño explícita,** y el equipo está dispuesto a asumir la complejidad extra.

La consistencia importa más que el enfoque perfecto. Elegir un solo mecanismo y aplicarlo uniformemente en toda la API es mejor que mezclar estrategias.

## Cuándo introducir una nueva versión

El versionado tiene un costo: mantener múltiples versiones en paralelo implica más código, más tests, más documentación y más superficie de mantenimiento. Introducir versiones innecesariamente es tan problemático como no versionar cuando se debe.

La pregunta correcta es: **¿este cambio rompe a algún cliente existente?** Si la respuesta es no, no necesitas versionar. Agrega el nuevo campo, publica el cambio y listo.

Si la respuesta es sí, considera primero si puedes diseñar el cambio de otra forma que sea compatible hacia atrás. Muchas veces lo que parece un breaking change tiene una solución que preserva la compatibilidad:

- ¿Necesitas renombrar un campo? Agrega el campo nuevo y mantén el antiguo con el valor igual durante un período de transición.
- ¿Necesitas cambiar el tipo de un campo? Evalúa si el nuevo tipo puede ser un superconjunto del anterior (ej. de `number` a `string` puede ser transparente si los clientes manejan la conversión).
- ¿Necesitas eliminar un campo? Primero márcalo como deprecado, documenta el reemplazo y dale tiempo a los clientes para migrar.

Si después de explorar alternativas el breaking change es inevitable, entonces sí corresponde una nueva versión.

## Gestión de la deprecación

Lanzar una nueva versión no significa abandonar la anterior de inmediato. Los clientes necesitan tiempo para migrar. Una estrategia de deprecación responsable tiene tres partes:

**Comunicación anticipada.** Anunciar la deprecación con suficiente anticipación, con una fecha de fin de vida (sunset date) clara. GitHub usa el header `Sunset` en sus respuestas para comunicarlo de forma programática:

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 31 Jan 2027 23:59:59 GMT
Link: <https://api.miempresa.com/v2/usuarios>; rel="successor-version"
```

**Período de soporte paralelo.** Las versiones deprecadas deben seguir funcionando durante el período de transición. Un mínimo razonable para APIs públicas es 6-12 meses desde el anuncio de deprecación. Para APIs internas puede ser menor, pero nunca menos de lo que tarde el equipo más lento en migrar.

**Monitoreo de uso.** Antes de apagar una versión, verifica que nadie la esté usando todavía. Los métricas de uso por versión son imprescindibles para tomar esa decisión con datos, no con suposiciones.

```java
@GetMapping("/api/v1/usuarios/{id}")
public UsuarioDtoV1 obtenerV1(@PathVariable Long id, HttpServletResponse response) {
    // Advertir a los clientes de v1 en cada respuesta
    response.setHeader("Deprecation", "true");
    response.setHeader("Sunset", "Sat, 31 Jan 2027 23:59:59 GMT");
    response.setHeader("Link", "</api/v2/usuarios/" + id + ">; rel=\"successor-version\"");

    return new UsuarioDtoV1(usuarioService.buscarPorId(id));
}
```

## Organización del código con múltiples versiones

Mantener versiones en paralelo puede llevar rápidamente a duplicación de código si no se gestiona bien. Algunas prácticas que ayudan:

**Centraliza la lógica de negocio en los servicios.** Los servicios no saben nada de versiones. La versión solo afecta la capa de presentación (los DTOs y los controllers). Si la lógica de negocio cambia entre versiones, eso es una señal de que el dominio cambió y merece revisión más profunda.

```
src/
├── service/
│   └── UsuarioService.java          // sin versión, lógica central
├── controller/
│   ├── v1/
│   │   └── UsuarioControllerV1.java
│   └── v2/
│       └── UsuarioControllerV2.java
└── dto/
    ├── v1/
    │   └── UsuarioDtoV1.java
    └── v2/
        └── UsuarioDtoV2.java
```

**Considera la herencia de DTOs cuando los cambios son aditivos.** Si v2 agrega campos sobre v1, puede convenir que `UsuarioDtoV2` extienda `UsuarioDtoV1` para no duplicar los campos comunes. Pero esta práctica tiene límites: si las versiones divergen significativamente, la herencia se vuelve confusa. A menudo es más claro tener DTOs independientes.

**Usa mappers dedicados.** Una clase `UsuarioMapper` que convierte `Usuario` → `UsuarioDtoV1` y otra que convierte `Usuario` → `UsuarioDtoV2` mantiene la transformación explícita y testeable.

## Versionado semántico vs. versiones de API

Es importante no confundir el versionado semántico del artefacto (el `1.4.2` que va en el `pom.xml`) con el versionado de la API. Son cosas distintas.

El versionado semántico sigue la convención `MAJOR.MINOR.PATCH` y sirve para comunicar el tipo de cambio entre releases internos. El versionado de API es una promesa pública a los consumidores: esta versión del contrato seguirá funcionando tal como la documentamos.

Muchos equipos usan solo el número `MAJOR` en la API (`v1`, `v2`) y el semver completo en los releases internos. Un cambio de `1.3.0` a `1.4.0` (MINOR) no necesariamente produce una nueva versión de API, pero un cambio que rompe el contrato (MAJOR bump en semver) sí.

## Un contrato es una responsabilidad

Versionar bien una API requiere disciplina: hay que resistir la tentación de introducir breaking changes silenciosos "porque total los clientes van a actualizar pronto", y también hay que resistir el extremo opuesto de mantener versiones viejas indefinidamente porque da miedo apagarlas.

El equilibrio está en tratar el contrato de la API con la misma seriedad que cualquier otro compromiso formal: cumplirlo mientras esté vigente, comunicar los cambios con antelación y dar a los clientes el tiempo y las herramientas que necesitan para migrar. Esa es la diferencia entre una API que los equipos confían en usar y una que evitan por miedo a que cambie sin aviso.
