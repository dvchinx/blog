---
titulo: "Tipos Primitivos vs Wrappers: Diferencias Clave"
seoTitulo: "Tipos primitivos vs wrappers en Java: diferencias y buenas prácticas"
fecha: "2026-03-08"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Comprende las diferencias fundamentales entre tipos primitivos y wrappers, y cuándo usar cada uno en tu código."
imagenPortada: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=500&fit=crop"
etiquetas: ["Programming", "Java", "Best Practices"]
categoria: "tech"
keywords: "tipos primitivos Java, wrappers, Integer vs int, autoboxing, buenas prácticas, rendimiento, programación Java"
---

# Tipos Primitivos vs Wrappers

En programación orientada a objetos, especialmente en lenguajes como Java, existen dos formas de representar valores básicos: tipos primitivos y sus clases wrapper equivalentes. Entender sus diferencias es fundamental para escribir código eficiente y evitar errores comunes.

## ¿Qué son los Tipos Primitivos?

Los tipos primitivos son los tipos de datos más básicos del lenguaje. No son objetos, sino valores simples almacenados directamente en memoria.

En Java, los 8 tipos primitivos son:

- **Enteros**: `byte`, `short`, `int`, `long`
- **Punto flotante**: `float`, `double`
- **Carácter**: `char`
- **Booleano**: `boolean`

## ¿Qué son los Wrappers?

Los wrappers (envoltorios) son clases que encapsulan tipos primitivos, convirtiéndolos en objetos. Esto permite usar primitivos donde se requieren objetos.

Cada primitivo tiene su wrapper correspondiente:
- `int` → `Integer`
- `double` → `Double`
- `boolean` → `Boolean`
- `char` → `Character`
- etc.

## Diferencias Clave

### 1. **Almacenamiento en Memoria**
- **Primitivos**: Almacenan el valor directamente (stack)
- **Wrappers**: Almacenan una referencia al objeto (heap)

### 2. **Valor Nulo**
- **Primitivos**: No pueden ser `null`, tienen valores por defecto
- **Wrappers**: Pueden ser `null`, útil para representar ausencia de valor

### 3. **Rendimiento**
- **Primitivos**: Más rápidos y eficientes en memoria
- **Wrappers**: Mayor overhead por ser objetos

### 4. **Comparación**
- **Primitivos**: Usar `==` para comparar valores
- **Wrappers**: Usar `.equals()` para comparar valores, `==` compara referencias

## Ejemplo Práctico

```java
// Tipos primitivos
int primitivo1 = 100;
int primitivo2 = 100;
System.out.println(primitivo1 == primitivo2); // true

// Wrappers
Integer wrapper1 = 100;
Integer wrapper2 = 100;
System.out.println(wrapper1 == wrapper2); // true (autoboxing cache)

Integer wrapper3 = 200;
Integer wrapper4 = 200;
System.out.println(wrapper3 == wrapper4); // false (fuera del cache)
System.out.println(wrapper3.equals(wrapper4)); // true

// Null con wrappers
Integer nullable = null;
// int noNullable = null; // Error de compilación

// Autoboxing y Unboxing
Integer autoboxed = 5; // autoboxing: int → Integer
int unboxed = autoboxed; // unboxing: Integer → int
```

## ¿Cuándo Usar Cada Uno?

**Usa primitivos cuando:**
- Necesitas máximo rendimiento
- Trabajas con cálculos intensivos
- No necesitas representar ausencia de valor

**Usa wrappers cuando:**
- Necesitas usar colecciones (List, Set, Map)
- Requieres representar valores nulos
- Trabajas con APIs que requieren objetos
- Necesitas métodos utilitarios (`parseInt()`, `valueOf()`, etc.)

## Conclusión

Aunque el autoboxing y unboxing automático facilitan el intercambio entre primitivos y wrappers, conocer sus diferencias es crucial para escribir código eficiente y evitar errores sutiles como **NullPointerException** o comparaciones incorrectas.

La regla general: usa primitivos por defecto, y wrappers solo cuando realmente los necesites.

¿Has tenido problemas con primitivos vs wrappers en tus proyectos?