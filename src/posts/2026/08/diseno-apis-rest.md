---
titulo: "Diseño de APIs REST: principios y convenciones que todo equipo debería seguir"
seoTitulo: "Diseño de APIs REST: guía de principios, convenciones y buenas prácticas"
fecha: "2026-08-06"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende los principios fundamentales del diseño de APIs REST: cómo nombrar recursos, elegir métodos HTTP correctamente, usar códigos de estado, paginar resultados y manejar errores de forma consistente."
imagenPortada: "https://i.imgur.com/VBbdPRV.png?w=800&h=500&fit=crop"
etiquetas: ["REST", "API Design", "Best Practices", "Architecture", "Backend"]
categoria: "tech"
keywords: "diseño REST API, REST principles, API conventions, HTTP methods, status codes, paginación API, URI design, API best practices, RESTful design, API error handling, HATEOAS, idempotencia HTTP"
---

# Diseño de APIs REST: principios y convenciones que todo equipo debería seguir

Una API es un contrato. Una vez que la publicas, los clientes empiezan a depender de ella y cambiarla se vuelve costoso. Por eso, el diseño inicial importa mucho más de lo que parece cuando estás en el sprint uno y solo hay un frontend consumiendo tus endpoints.

REST (Representational State Transfer) no es un estándar formal sino un conjunto de principios arquitecturales descrito por Roy Fielding en su tesis doctoral del año 2000. Lo que la industria llama "API REST" en la práctica es una interpretación pragmática de esos principios sobre HTTP. Hay margen de interpretación, y por eso abundan las APIs que se llaman REST pero que no comparten convenciones básicas entre sí.

Este artículo recoge los principios y convenciones más importantes: los que reducen fricción, facilitan la integración y hacen que la API sea predecible para quien la consume.

## Todo gira alrededor de los recursos

El concepto central de REST es el **recurso**: cualquier entidad del dominio que tenga identidad propia y sobre la que se pueda realizar operaciones. Un usuario, un pedido, una factura, un producto. Los recursos se identifican con URIs y se representan en los cuerpos de las respuestas (habitualmente en JSON).

El error más común al diseñar una API REST es modelarla como una colección de acciones en lugar de una colección de recursos. El resultado son URIs que describen operaciones:

```
POST /crearUsuario
POST /desactivarCuenta
GET  /obtenerPedidosDeUsuario
POST /cancelarPedido
```

Esto es diseño orientado a procedimientos transportado sobre HTTP. No es REST. El enfoque correcto es identificar los recursos y usar los métodos HTTP para expresar qué operación se realiza sobre ellos:

```
POST   /usuarios
PATCH  /usuarios/{id}
GET    /usuarios/{id}/pedidos
DELETE /pedidos/{id}
```

La misma intención, pero ahora la estructura es coherente y predecible. Alguien que no ha visto tu API antes puede adivinar cómo cancelar un pedido porque el patrón es consistente.

## Convenciones para los URIs

Las URIs son la superficie visible de tu API. Unas convenciones claras hacen que sean fáciles de recordar y de explorar.

**Usa sustantivos en plural para los recursos**. `/usuarios` en lugar de `/usuario`. Esto es consistente independientemente de si la operación devuelve uno o varios registros: `GET /usuarios` devuelve la lista, `GET /usuarios/42` devuelve el usuario con id 42.

**Usa minúsculas y guiones para separar palabras**. `/pedidos-activos` es más legible que `/pedidosActivos` o `/PedidosActivos`. Algunos servidores tratan las URIs de forma case-sensitive, y la uniformidad evita errores difíciles de depurar.

**Expresa las relaciones con jerarquías limitadas**. Si un recurso pertenece a otro, puedes anidarlos:

```
GET /usuarios/{userId}/pedidos          # pedidos de un usuario
GET /usuarios/{userId}/pedidos/{id}     # pedido específico de un usuario
```

Pero no profundices más de dos o tres niveles. URIs como `/usuarios/42/pedidos/7/items/3/comentarios` son difíciles de leer y de manejar. A partir de cierta profundidad, considera si el recurso anidado merece una URI propia en el nivel raíz.

**No incluyas acciones en la URI**. Si te encuentras escribiendo `/usuarios/42/activar`, la señal es que ese "activar" debería ser un cambio de estado representado con PATCH:

```bash
PATCH /usuarios/42
Content-Type: application/json

{ "estado": "activo" }
```

## Métodos HTTP: úsalos correctamente

HTTP define una semántica clara para cada método. Respetarla hace que la API sea predecible y permite que intermediarios (cachés, proxies, gateways) funcionen correctamente.

**GET** recupera recursos. Debe ser seguro (no produce efectos secundarios) e idempotente (llamarlo varias veces produce el mismo resultado). Nunca uses GET para modificar estado.

**POST** crea un nuevo recurso en la colección indicada. No es idempotente: dos llamadas iguales crean dos recursos diferentes.

```bash
POST /pedidos
Content-Type: application/json

{
  "clienteId": "42",
  "items": [{ "productoId": "8", "cantidad": 2 }]
}
```

La respuesta incluye el recurso creado y su URI en la cabecera `Location`:

```
HTTP/1.1 201 Created
Location: /pedidos/99
```

**PUT** reemplaza un recurso completo. El cliente envía la representación completa del recurso y el servidor la sustituye. Es idempotente: llamarlo varias veces con el mismo body produce el mismo resultado.

**PATCH** aplica una modificación parcial. Solo se envían los campos que cambian. Es el método apropiado para actualizar el estado de un recurso sin conocer ni enviar su representación completa.

```bash
PATCH /pedidos/99
Content-Type: application/json

{ "estado": "cancelado" }
```

**DELETE** elimina el recurso identificado. También es idempotente: eliminar algo que ya no existe debería devolver 404, o 204 si prefieres no distinguir entre "nunca existió" y "ya fue borrado".

La idempotencia de PUT, PATCH y DELETE tiene implicaciones prácticas importantes: permite que los clientes reintenten solicitudes de red sin miedo a duplicar efectos, algo crítico en sistemas distribuidos donde los timeouts son inevitables.

## Códigos de estado HTTP

Los códigos de estado son parte del protocolo y transmiten información a cualquier intermediario que procese la respuesta. Usarlos correctamente es la diferencia entre una API que se integra bien y una que requiere que cada cliente analice el body para entender qué pasó.

Los grupos más relevantes:

**2xx — Éxito**
- `200 OK`: la solicitud fue procesada correctamente y hay cuerpo en la respuesta.
- `201 Created`: un nuevo recurso fue creado (respuesta a POST exitoso).
- `204 No Content`: la solicitud fue procesada correctamente pero no hay cuerpo (respuesta típica de DELETE o PATCH cuando no se devuelve el recurso actualizado).

**4xx — Error del cliente**
- `400 Bad Request`: la solicitud tiene formato incorrecto o datos inválidos.
- `401 Unauthorized`: el cliente no está autenticado (el nombre es confuso pero es el estándar).
- `403 Forbidden`: el cliente está autenticado pero no tiene permisos para ese recurso.
- `404 Not Found`: el recurso no existe.
- `409 Conflict`: la operación no puede completarse por un conflicto de estado (por ejemplo, intentar crear un usuario con un email que ya existe).
- `422 Unprocessable Entity`: la solicitud está bien formada pero los datos no pasan validación de negocio.
- `429 Too Many Requests`: el cliente ha superado el límite de solicitudes.

**5xx — Error del servidor**
- `500 Internal Server Error`: algo inesperado falló en el servidor.
- `503 Service Unavailable`: el servidor no puede atender solicitudes temporalmente (útil para señalizar sobrecarga o mantenimiento).

El error más habitual es devolver siempre `200 OK` con un campo `success: false` en el body. Eso rompe la semántica de HTTP, complica el logging y obliga a cada cliente a implementar su propia lógica de detección de errores.

## Manejo de errores consistente

Las respuestas de error deben tener una estructura predecible. RFC 9457 (Problem Details for HTTP APIs) define un formato estándar que la industria ha adoptado ampliamente:

```json
{
  "type": "https://api.ejemplo.com/errores/validacion",
  "title": "Error de validación",
  "status": 422,
  "detail": "El campo 'email' no tiene un formato válido.",
  "instance": "/pedidos/nueva-solicitud",
  "errors": [
    {
      "campo": "email",
      "mensaje": "Debe ser una dirección de correo electrónico válida"
    },
    {
      "campo": "cantidad",
      "mensaje": "Debe ser un número entero positivo"
    }
  ]
}
```

El campo `type` es una URI que identifica el tipo de error. `title` es una descripción humana corta. `detail` explica el error específico de esta instancia. El array `errors` es una extensión útil para errores de validación con múltiples campos.

Lo fundamental es la consistencia: todos los errores de la API deben tener la misma estructura. El cliente no debería tener que manejar casos especiales por endpoint.

## Paginación, filtrado y ordenamiento

Una colección que puede tener miles de registros nunca debería devolverse completa sin limitación. Las tres operaciones principales sobre colecciones se expresan como query parameters:

**Paginación basada en offset** (la más común):

```
GET /productos?page=2&size=20
```

La respuesta incluye metadatos de paginación en el body o en cabeceras:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "size": 20,
    "totalElements": 347,
    "totalPages": 18
  }
}
```

**Paginación basada en cursor** (más eficiente para conjuntos grandes o que cambian con frecuencia):

```
GET /eventos?after=cursor_opaco_base64&limit=50
```

El cursor apunta a un registro específico en lugar de a una posición numérica. Es más estable: si se insertan registros mientras el cliente está paginando, no se saltan ni se repiten elementos.

**Filtrado** con query parameters descriptivos:

```
GET /pedidos?estado=pendiente&clienteId=42&desde=2026-01-01
```

**Ordenamiento** con un parámetro `sort` que acepta el nombre del campo y opcionalmente la dirección:

```
GET /productos?sort=precio,asc
GET /productos?sort=fechaCreacion,desc
```

## Un ejemplo integrado

Para ilustrar cómo se combinan estos principios, aquí está la API de un módulo de pedidos con los endpoints principales:

```
# Listar pedidos con filtros y paginación
GET /pedidos?estado=activo&clienteId=42&page=0&size=10&sort=fecha,desc

# Crear un pedido
POST /pedidos

# Obtener un pedido específico
GET /pedidos/{id}

# Actualizar el estado de un pedido
PATCH /pedidos/{id}

# Cancelar (eliminar lógicamente) un pedido
DELETE /pedidos/{id}

# Listar los items de un pedido
GET /pedidos/{id}/items

# Agregar un item al pedido
POST /pedidos/{id}/items

# Eliminar un item específico del pedido
DELETE /pedidos/{id}/items/{itemId}
```

Los URIs son consistentes, los métodos expresan la intención y cualquier desarrollador nuevo puede entender la estructura sin documentación adicional.

## Versionado

El versionado de APIs es un tema que merece artículo propio —y lo tiene en este blog—, pero el principio fundamental es: versiona desde el primer día, aunque solo tengas una versión. La convención más extendida es incluir la versión en la URI:

```
GET /v1/pedidos
GET /v2/pedidos
```

Cuando necesites hacer cambios incompatibles, introduces una nueva versión y mantienes la anterior el tiempo necesario para que los clientes migren. Nunca hagas cambios que rompan la compatibilidad en una versión existente.

## Lo que no hace falta implementar desde el principio

HATEOAS (Hypermedia As The Engine Of Application State) es el nivel más avanzado de REST: las respuestas incluyen enlaces a las operaciones disponibles desde el recurso actual, de modo que el cliente puede navegar la API sin conocer los URIs de antemano. En la práctica, muy pocas APIs lo implementan de forma completa porque añade complejidad y los clientes modernos raramente lo aprovechan.

```json
{
  "id": 99,
  "estado": "pendiente",
  "_links": {
    "self": { "href": "/pedidos/99" },
    "cancelar": { "href": "/pedidos/99", "method": "DELETE" },
    "items": { "href": "/pedidos/99/items" }
  }
}
```

Si tu API es pública o tiene muchos consumidores distintos, puede valer la pena considerarlo. Para APIs internas con clientes conocidos, el retorno suele no justificar la inversión.

## La consistencia es más importante que la perfección

Hay debates legítimos sobre muchas de las convenciones descritas aquí: si la paginación va en el body o en cabeceras, si los errores de validación deben ser 400 o 422, si los recursos eliminados deben devolver 204 o 404. Lo que no tiene debate es que la inconsistencia dentro de una misma API es siempre un problema.

Decide las convenciones con el equipo, documéntalas y aplícalas de forma uniforme. Un desarrollador que aprende cómo funciona un endpoint debería poder predecir cómo funciona cualquier otro. Esa predictibilidad, más que cualquier decisión técnica particular, es lo que hace que una API sea fácil de usar.
