---
titulo: "Codeforces 1352A - Sum of Round Numbers"
seoTitulo: "Solución 1352A Sum of Round Numbers (CodeForces) en Python — Descomposición posicional"
fecha: "2026-07-30"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Educational Round 96 (Rated, Div. 2)"
imagenPortada: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo", "Math", "Greedy"]
categoria: "coding"
keywords: "Codeforces 1352A, Sum of Round Numbers, números redondos, descomposición de dígitos, notación posicional, programación competitiva, Python, matemáticas"
---

# 1352 A. Sum of Round Numbers

> Problema original: [Codeforces 1352A - Sum of Round Numbers](https://codeforces.com/problemset/problem/1352/A)

Si buscas la solución de **1352A. Sum of Round Numbers** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

A positive integer is called *round* if it has exactly one non-zero digit. In particular, all numbers from 1 to 9 are round. For example, the following numbers are round: 4000, 1, 9, 800, 90. The following numbers are NOT round: 110, 707, 222, 1001.

You are given a positive integer n. Represent it as a sum of round numbers using the **minimum** number of summands.

### Input

The first line contains one integer t (1 ≤ t ≤ 10^4) — the number of test cases.

Each test case consists of a single line containing one integer n (1 ≤ n ≤ 10^9).

### Output

For each test case, in the first line print k — the minimum number of summands. In the second line print k integers — the summands themselves. If there are multiple solutions, print any of them.

### Examples

| Input | Output |
|-------|--------|
| 5 | 2 |
| 5009 | 5000 9 |
| 7 | 1 |
| 9876 | 7 |
| 10000 | 4 |
| 10 | 800 70 6 9000 |
| | 1 |
| | 10000 |
| | 1 |
| | 10 |

## Resumen rápido

Cada dígito no nulo de `n` determina exactamente un sumando redondo. Para el número `5765`, sus cuatro dígitos no nulos (5, 7, 6, 5) en sus respectivas posiciones posicionales producen directamente `5000 + 700 + 60 + 5`. Esta descomposición es siempre la mínima: el número de sumandos es igual a la cantidad de dígitos no nulos de `n`, y no se puede hacer con menos.

## Idea de la solución

### Números redondos y notación posicional

Todo entero positivo `n` puede escribirse en base 10 como:

```
n = d_{k} × 10^k + d_{k-1} × 10^{k-1} + ... + d_1 × 10 + d_0
```

donde cada `d_i ∈ {0, 1, ..., 9}` es un dígito. Cada término `d_i × 10^i` con `d_i ≠ 0` tiene exactamente un dígito no nulo, por lo que es, por definición, un número redondo.

La descomposición por dígitos nos da directamente todos los sumandos: ignoramos los dígitos nulos y por cada dígito `d_i ≠ 0` producimos el número redondo `d_i × 10^i`.

### ¿Por qué esta solución es mínima?

Supongamos que `n` tiene `m` dígitos no nulos (en posiciones `p_1, p_2, ..., p_m`). Queremos demostrar que necesitamos al menos `m` sumandos redondos.

Observa que cualquier número redondo actúa sobre una única posición posicional: contribuye `c × 10^j` para algún `c ∈ {1,...,9}` y `j ≥ 0`. Para que la suma total tenga el dígito correcto en la posición `p_i`, los sumandos que contribuyen a esa posición deben sumar exactamente `d_{p_i}` (módulo 10, con posible acarreo). Dado que necesitamos cubrir `m` posiciones distintas con dígitos no nulos, se requieren al menos `m` sumandos. La descomposición por dígitos usa exactamente `m`, por lo que es óptima.

### Ejemplo paso a paso

Sea `n = 5765`.

| Posición | Dígito | Número redondo |
|----------|--------|----------------|
| 3        | 5      | 5000           |
| 2        | 7      | 700            |
| 1        | 6      | 60             |
| 0        | 5      | 5              |

Verificación: 5000 + 700 + 60 + 5 = **5765** ✓. Cuatro dígitos no nulos → cuatro sumandos mínimos.

Caso especial `n = 10000`: un único dígito no nulo (el `1` en la posición 4) → un solo sumando `10000`. Resultado: k=1.

### Algoritmo

1. Convertir `n` a cadena de caracteres para extraer sus dígitos.
2. Calcular la longitud `L` de la cadena (número de dígitos).
3. Recorrer cada dígito de izquierda a derecha: si `d ≠ '0'`, agregar `int(d) × 10^(L-1-i)` a la lista de sumandos.
4. Imprimir el tamaño de la lista y sus elementos.

### Complejidad

- **Tiempo**: O(log n) por caso de prueba — `n ≤ 10^9` tiene a lo sumo 10 dígitos, así que el recorrido es de longitud fija.
- **Espacio**: O(log n) — se almacenan como máximo 10 sumandos por caso.
- Con hasta `t = 10^4` casos de prueba, la solución total es O(t · log n) ≈ 10^5 operaciones, muy por debajo del límite.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    s = str(n)
    L = len(s)
    result = []
    for i, d in enumerate(s):
        if d != '0':
            result.append(int(d) * (10 ** (L - 1 - i)))
    print(len(result))
    print(*result)

t = int(input())
for _ in range(t):
    solve()
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys
input = sys.stdin.readline

def solve():
    n = int(input())
    s = str(n)       # Representación del número como cadena de dígitos
    L = len(s)       # Número total de dígitos
    result = []

    for i, d in enumerate(s):
        if d != '0':
            # La posición posicional (desde la derecha) del dígito i-ésimo es (L-1-i).
            # El número redondo correspondiente es d × 10^(L-1-i).
            result.append(int(d) * (10 ** (L - 1 - i)))

    print(len(result))   # k: número mínimo de sumandos
    print(*result)       # Los k sumandos separados por espacios

t = int(input())
for _ in range(t):
    solve()
```

</details>

<br/>

> You are welcome to share your solution in another programming language
