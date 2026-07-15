---
titulo: "Codeforces 474B - Worms"
seoTitulo: "Solución de 474B. Worms (CodeForces) en Python — Sumas Prefijas y Búsqueda Binaria"
fecha: "2026-07-16"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 271 (Div. 2)"
imagenPortada: "https://i.imgur.com/Ad0ybZX.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "1200 elo", "Binary Search", "Prefix Sums"]
categoria: "coding"
keywords: "Codeforces 474B, Worms, binary search, prefix sums, sumas prefijas, búsqueda binaria, programación competitiva, Python, bisect"
---

# 474 B. Worms

> Problema original: [Codeforces 474B - Worms](https://codeforces.com/problemset/problem/474/B)

Si buscas la solución de **474B. Worms** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

There are w types of worms. All worms of type i are sequentially numbered starting right after the last worm of type i − 1. There are a_i worms of type i.

Given q queries, for each query k find which type the k-th worm (in global order) belongs to.

### Input

The first line contains two integers w and q (1 ≤ w, q ≤ 10^5).

The second line contains w integers a_1, a_2, ..., a_w (1 ≤ a_i ≤ 10^5), where a_i is the number of worms of type i.

The next q lines each contain a single integer k (1 ≤ k ≤ a_1 + a_2 + ... + a_w).

### Output

For each query, print on a separate line the type of the k-th worm.

### Examples

| Input | Output |
|-------|--------|
| 5 | 1 |
| 2 7 3 4 9 | 5 |
| 3 | 3 |
| 1 25 11 |

### Note

The worms with labels from [1, 2] are in the first pile.

The worms with labels from [3, 9] are in the second pile.

The worms with labels from [10, 12] are in the third pile.

The worms with labels from [13, 16] are in the fourth pile.

The worms with labels from [17, 25] are in the fifth pile.

## Resumen rápido

Tenemos w tipos de gusanos dispuestos en secuencia global. El tipo i ocupa el rango `[prefix[i-1]+1, prefix[i]]`, donde `prefix[i] = a[1] + ... + a[i]`. Para cada consulta k debemos encontrar en qué rango cae.

La suma total puede llegar hasta 10^10, por lo que recorrer tipo por tipo en cada consulta daría TLE. La solución eficiente es construir el arreglo de **sumas prefijas** y aplicar **búsqueda binaria** para responder cada consulta en O(log w).

## Idea de la solución

### Construcción de sumas prefijas

Definimos `prefix[i] = a[1] + a[2] + ... + a[i]`, con `prefix[0] = 0` implícito.

Los gusanos de tipo i ocupan las posiciones desde `prefix[i-1]+1` hasta `prefix[i]`. Para saber el tipo del gusano k, necesitamos el menor índice i tal que `prefix[i] >= k`.

### ¿Por qué funciona la búsqueda binaria?

El arreglo `prefix` es **estrictamente creciente** porque cada a[i] ≥ 1. Eso habilita búsqueda binaria directamente sobre él: el índice que buscamos es el primero donde el valor prefijo supera o iguala a k.

Python ofrece `bisect.bisect_left(arr, x)`, que devuelve el menor índice i tal que `arr[i] >= x`. Aplicado sobre `prefix`:

```
tipo = bisect_left(prefix, k) + 1   # +1 para pasar de índice 0-based a tipo 1-based
```

Verificación con el ejemplo (`prefix = [1, 3, 6]`):
- k=1: `bisect_left([1,3,6], 1)` = 0 → tipo **1** ✓
- k=2: `bisect_left([1,3,6], 2)` = 1 → tipo **2** ✓
- k=3: `bisect_left([1,3,6], 3)` = 1 → tipo **2** ✓
- k=4: `bisect_left([1,3,6], 4)` = 2 → tipo **3** ✓
- k=6: `bisect_left([1,3,6], 6)` = 2 → tipo **3** ✓

### Algoritmo

1. Leer w, q y el arreglo a[].
2. Construir el arreglo `prefix` de sumas acumuladas (longitud w).
3. Para cada consulta k, hacer `bisect_left(prefix, k) + 1` y emitir el resultado.

### Complejidad

- **Tiempo**: O(w + q·log w) — O(w) para construir prefix, O(log w) por cada una de las q consultas.
- **Espacio**: O(w) para el arreglo de sumas prefijas.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys
from bisect import bisect_left

def main():
    data = sys.stdin.read().split()
    idx = 0

    w = int(data[idx]); idx += 1

    prefix = []
    s = 0
    for i in range(w):
        s += int(data[idx + i])
        prefix.append(s)
    idx += w

    q = int(data[idx]); idx += 1

    out = []
    for i in range(q):
        k = int(data[idx + i])
        out.append(str(bisect_left(prefix, k) + 1))

    print('\n'.join(out))

main()
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys
from bisect import bisect_left

def main():
    # Leemos todo el input de una vez y separamos por espacios/saltos de línea.
    # Esto evita problemas si los queries vienen en una o varias líneas.
    data = sys.stdin.read().split()
    idx = 0

    # El formato real es: w (solo) → array de w elementos → q (solo) → q queries.
    w = int(data[idx]); idx += 1

    # Construimos el arreglo de sumas prefijas.
    # prefix[i] acumula el total de gusanos de los tipos 1..i+1.
    prefix = []
    s = 0
    for i in range(w):
        s += int(data[idx + i])
        prefix.append(s)
    idx += w

    q = int(data[idx]); idx += 1

    out = []
    for i in range(q):
        k = int(data[idx + i])
        # bisect_left devuelve el menor índice j tal que prefix[j] >= k,
        # es decir, el primer tipo cuyo rango acumulado alcanza la posición k.
        # Sumamos 1 para convertir el índice 0-based al número de tipo 1-based.
        out.append(str(bisect_left(prefix, k) + 1))

    print('\n'.join(out))

main()
```

</details>

<br/>

> You are welcome to share your solution in another programming language
