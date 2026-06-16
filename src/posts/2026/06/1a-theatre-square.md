---
titulo: "Codeforces 1A - Theatre Square"
seoTitulo: "Solución de 1A. Theatre Square (CodeForces) en Python"
fecha: "2026-06-17"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "El problema más icónico de CodeForces — pavimentar una plaza con losas cuadradas."
imagenPortada: "https://i.imgur.com/WMSC9wH.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "1000 elo", "Matemáticas", "Implementación"]
categoria: "coding"
keywords: "Codeforces 1A, Theatre Square, losas, plaza, ceil, techo, matemáticas, programación competitiva, Python, solución"
---

# 1A. Theatre Square

> Problema original: [Codeforces 1A - Theatre Square](https://codeforces.com/problemset/problem/1/A)

Si buscas la solución de **1A. Theatre Square** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

Theatre Square in the capital city of Berland has a rectangular shape with the size n × m metres. On the occasion of the city's anniversary, Berland decided to pave it with square granite flagstones. Each flagstone is of the size a × a.

What is the least number of flagstones needed to pave the whole square? It's allowed to cover the surface larger than the Theatre Square, but only by the sides of the flagstones.

Note that the sides of flagstones should be parallel to the sides of the Square.

### Input

The input contains a single line of three positive integers n, m and a (1 ≤ n, m, a ≤ 10⁹).

### Output

Output the least number of flagstones needed to pave the whole square.

### Example

| Input | Output |
|-------|--------|
| 6 6 4 | 4      |

## Resumen rápido

Dada una plaza rectangular de n × m metros, cubrir toda su superficie usando losas cuadradas de a × a. Se puede exceder el borde, pero no dejar ningún espacio sin cubrir. Minimizar la cantidad de losas usadas.

## Idea de la solución

La clave es pensar dimensión por dimensión: ¿cuántas losas necesito para cubrir un segmento de longitud **n** usando losas de ancho **a**?

La respuesta es simplemente `⌈n/a⌉` — la división entera hacia arriba (techo). Si n no es divisible exactamente por a, la última fila de losas sobresaldrá un poco, pero eso está permitido por el enunciado.

Lo mismo aplica para la dimensión m. El total de losas es:

```
cantidad = ⌈n/a⌉ × ⌈m/a⌉
```

En Python, la división con techo se puede calcular de dos formas equivalentes:

```python
import math
math.ceil(n / a)   # usando flotantes — riesgo de pérdida de precisión para n muy grande

(n + a - 1) // a   # usando solo enteros — siempre exacto
```

Para valores de hasta 10⁹, la versión de enteros es la más segura.

### Verificación con el ejemplo

n = 6, m = 6, a = 4:

- Losas en la dimensión n: ⌈6/4⌉ = 2
- Losas en la dimensión m: ⌈6/4⌉ = 2
- Total: 2 × 2 = **4** ✓

Las 4 losas de 4×4 cubren un área de 8×8, mayor que los 6×6 de la plaza, pero es la mínima configuración posible.

### Complejidad

| | Valor |
|---|---|
| Tiempo | O(1) |
| Espacio | O(1) |

No hay bucles: la respuesta se calcula con dos operaciones aritméticas.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 (Sin comentarios)</summary>

```python
n, m, a = map(int, input().split())
print(((n + a - 1) // a) * ((m + a - 1) // a))
```
</details>

<details>
<summary>Python3 (Con comentarios)</summary>

```python
n, m, a = map(int, input().split())

# -----------------------------------------------
# Calculamos cuántas losas caben en cada dimensión.
# La división con techo sin flotantes es: (x + a - 1) // a
# Esto equivale a math.ceil(x / a) pero es exacto
# para enteros grandes (hasta 10^9).
# -----------------------------------------------
filas = (n + a - 1) // a   # losas necesarias para cubrir la altura n
cols  = (m + a - 1) // a   # losas necesarias para cubrir el ancho m

print(filas * cols)
```
</details>
