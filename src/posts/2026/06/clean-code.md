---
titulo: "Clean Code: principios para escribir código que se entiende"
seoTitulo: "Clean Code: principios y técnicas para escribir código limpio y mantenible"
fecha: "2026-06-23"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende los principios de Clean Code: cómo nombrar bien, escribir funciones cortas, eliminar comentarios innecesarios y estructurar el código para que sea fácil de leer y mantener."
imagenPortada: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&h=500&fit=crop"
etiquetas: ["Clean Code", "Best Practices", "Architecture", "Software", "Programming"]
categoria: "tech"
keywords: "clean code, código limpio, Robert C Martin, buenas prácticas de programación, nombrar variables, funciones cortas, refactoring, código mantenible, deuda técnica"
---

# Clean Code: principios para escribir código que se entiende

Escribir código que funciona es solo la mitad del trabajo. La otra mitad es escribir código que otra persona, o tú mismo en seis meses, pueda entender sin necesitar una reunión de dos horas para explicarlo.

Robert C. Martin popularizó el concepto en su libro *Clean Code* (2008), pero los principios que describe existían antes y siguen siendo tan relevantes como cuando los escribió. No son reglas absolutas, sino guías que ayudan a tomar mejores decisiones cuando el código empieza a crecer.

## ¿Por qué importa el código limpio?

El código se lee muchas más veces de las que se escribe. Un estudio clásico en la industria estima que por cada línea que se escribe, se leen entre cinco y diez. Si el código es difícil de entender, cada lectura cuesta tiempo, y ese tiempo acumulado es lo que se conoce como deuda técnica.

El código sucio no es necesariamente incorrecto. Puede funcionar perfectamente. El problema es que cuando algo cambia, y siempre cambia algo, modificarlo se vuelve peligroso. Nadie sabe bien qué toca qué, los nombres no dicen lo que hacen, las funciones tienen efectos secundarios ocultos. Lo que debería ser un cambio de dos líneas se convierte en una tarde de arqueología.

Clean Code no es un conjunto de reglas para hacer el código perfectamente elegante. Es una forma de reducir la fricción que aparece cuando el software evoluciona.

## Nombres que comunican intención

El nombre de una variable, función o clase debería responder a tres preguntas sin necesidad de un comentario: qué es, para qué existe y cómo se usa.

Un nombre como `d` no dice nada. `elapsedTimeInDays` dice exactamente lo que representa. La diferencia parece pequeña, pero cuando hay docenas de variables en un módulo, los nombres claros hacen que el código sea casi autoexplicativo.

Algunos principios concretos:

**Evitar abreviaciones ambiguas**. `usr` puede ser `user`, `username` o `user_role` dependiendo del contexto. Escribe la palabra completa.

**Usar nombres pronunciables**. Si no puedes leer el nombre en voz alta sin titubear, probablemente sea una mala elección. `genymdhms` es mucho peor que `generationTimestamp`.

**Usar nombres que se puedan buscar**. Si usas la constante `7` en el código, buscarla en el repositorio devuelve cientos de resultados. Si la llamas `MAX_RETRY_ATTEMPTS`, la búsqueda es precisa.

**Las clases deben ser sustantivos, las funciones verbos**. `CustomerReport`, `OrderProcessor`, `calculateDiscount()`, `sendEmail()`. Esta convención simple hace que el código fluya de forma más natural al leerlo.

```python
# Mal
def proc(d, u, s):
    if s == 1:
        d["usr"] = u
    return d

# Bien
def add_user_to_session(session: dict, username: str, is_active: bool) -> dict:
    if is_active:
        session["user"] = username
    return session
```

## Funciones pequeñas con un solo propósito

La regla más citada de Clean Code es que las funciones deben hacer una sola cosa. Pero ¿qué es "una sola cosa"? Una heurística útil: si puedes extraer un bloque de código de una función y ponerle un nombre significativo sin que suene redundante, esa función probablemente está haciendo más de una cosa.

Las funciones cortas tienen varias ventajas:

- Son más fáciles de leer de un vistazo.
- Son más fáciles de nombrar bien.
- Son más fáciles de probar de forma unitaria.
- Cuando algo falla, el error queda localizado.

Una función que tiene más de veinte líneas debería revisarse. No porque exista un límite mágico, sino porque a partir de cierto tamaño se vuelve difícil mantener en mente lo que hace mientras se lee.

```python
# Mal: una función que hace demasiado
def process_order(order):
    # Validar
    if not order.get("items"):
        raise ValueError("Order has no items")
    if order.get("total") <= 0:
        raise ValueError("Invalid total")

    # Aplicar descuento
    if order.get("customer_type") == "premium":
        order["total"] *= 0.9

    # Guardar en base de datos
    db.save(order)

    # Enviar confirmación
    email_service.send_confirmation(order["customer_email"], order["id"])

    return order

# Bien: responsabilidades separadas
def validate_order(order: dict) -> None:
    if not order.get("items"):
        raise ValueError("Order has no items")
    if order.get("total", 0) <= 0:
        raise ValueError("Invalid total")

def apply_discount(order: dict) -> dict:
    if order.get("customer_type") == "premium":
        order["total"] *= 0.9
    return order

def process_order(order: dict) -> dict:
    validate_order(order)
    order = apply_discount(order)
    db.save(order)
    email_service.send_confirmation(order["customer_email"], order["id"])
    return order
```

## Comentarios: menos es más

Los comentarios tienen mala fama en la cultura de Clean Code, y por una razón válida: la mayoría no deberían existir.

Un comentario que explica qué hace el código es una señal de que el código no se explica solo. La solución correcta no es escribir el comentario, sino reescribir el código hasta que no lo necesite.

```python
# Mal: el comentario explica lo que ya dice el código
# Obtener el usuario por ID
user = get_user(user_id)

# Mal: comentario que miente (el código fue cambiado, el comentario no)
# Aplica un descuento del 10%
discount = order.total * 0.15
```

Hay casos donde los comentarios son válidos:

- **Explicar el porqué, no el qué**. Si hay una decisión de negocio no obvia detrás de una línea de código, un comentario que explique el razonamiento es valioso.
- **Advertencias sobre consecuencias no obvias**. Si modificar algo rompe algo más en un lugar inesperado, documentarlo es útil.
- **TODO marcados con seguimiento**. Mientras estén vinculados a una tarea real, son aceptables temporalmente.

```python
# Bien: explica el porqué de una decisión no obvia
# Se usa SHA-256 en lugar de MD5 por requerimiento de cumplimiento PCI-DSS
token = hashlib.sha256(raw_token.encode()).hexdigest()
```

## Evitar números y cadenas mágicas

Un número o texto literal en medio del código, sin nombre ni contexto, es lo que se llama una "constante mágica". Es difícil de entender y peligroso de modificar.

```python
# Mal
if retries > 3:
    raise Exception("Too many retries")

time.sleep(30)

# Bien
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 30

if retries > MAX_RETRIES:
    raise Exception("Too many retries")

time.sleep(RETRY_DELAY_SECONDS)
```

Cuando el valor necesita cambiar, hay un solo lugar donde hacerlo, y el nombre deja claro para qué se usa.

## Manejo de errores sin contaminar la lógica

Un patrón frecuente en código poco limpio es entremezclar la lógica de negocio con el manejo de errores hasta que se vuelven indistinguibles. Esto reduce la legibilidad de ambas partes.

Una práctica más clara es separar el camino feliz del manejo de errores. En lenguajes que usan excepciones, esto se logra dejando que las excepciones se propaguen y manejarlas en un nivel superior, no capturándolas en cada función.

```python
# Mal: la lógica de negocio y el manejo de errores están mezclados
def get_user_report(user_id):
    try:
        user = db.find_user(user_id)
        if user is None:
            return None
        try:
            orders = db.get_orders(user_id)
            if not orders:
                return {"user": user, "orders": []}
            return {"user": user, "orders": orders}
        except Exception:
            return None
    except Exception:
        return None

# Bien: la lógica de negocio es clara, los errores se manejan afuera
def get_user_report(user_id: int) -> dict:
    user = db.find_user(user_id)
    orders = db.get_orders(user_id)
    return {"user": user, "orders": orders}
```

## La regla del Boy Scout

El movimiento scout tiene una regla: deja el campamento más limpio de lo que lo encontraste. Aplicada al código, significa que cada vez que tocas un módulo, deberías dejarlo un poco mejor que como estaba.

No hace falta hacer una refactorización completa en cada commit. Pero si encuentras una variable con un nombre confuso mientras modificas una función, renómbrala. Si una función tiene un bloque que puede extraerse con un nombre claro, extráelo.

Este hábito distribuido a lo largo del equipo y del tiempo previene la acumulación de deuda técnica de forma natural, sin necesidad de sprints dedicados a limpiar.

## Estructura y formato consistente

El código debería tener un estilo uniforme: indentación consistente, líneas de longitud razonable, espacio entre bloques lógicos. No porque sea estéticamente agradable, sino porque el cerebro aprende a escanear código formateado y cualquier irregularidad rompe ese ritmo.

Lo más práctico es dejar que las herramientas se encarguen de esto: formatters como `black` en Python, `prettier` en JavaScript, o `google-java-format` en Java. Configurarlos una vez y dejar que corran automáticamente evita debates interminables sobre estilos y mantiene la consistencia sin esfuerzo.

## Cuándo no aplicar Clean Code

Clean Code tiene un costo. Refactorizar, nombrar bien, extraer funciones: todo toma tiempo. En un prototipo que se va a tirar, en un script de migración que corre una vez, o en una prueba de concepto que puede vivir un día, ese costo no siempre vale la pena.

El juicio sobre cuándo aplicar estos principios es parte de la habilidad. El problema es que la mayoría del código que "solo vamos a usar un momento" termina viviendo años en producción.

Como regla práctica: si el código va a ser leído por alguien más, si va a estar en un sistema que escala, o si va a necesitar mantenimiento, vale la pena escribirlo con cuidado desde el principio.

## Conclusión

Clean Code no es un conjunto de reglas perfectas. Es una actitud hacia el código: tratar el código que dejas como algo que alguien, incluido tú mismo, va a tener que entender después.

Los principios son simples: nombres claros, funciones pequeñas, comentarios solo cuando agregan algo que el código no puede decir, separación de responsabilidades, consistencia. Lo difícil es el hábito. Aplicarlos requiere práctica y un poco de disciplina en cada decisión pequeña.

La buena noticia es que no hay que hacer todo perfecto de una vez. Empezar por nombrar mejor las cosas ya marca una diferencia visible en cuestión de días.
