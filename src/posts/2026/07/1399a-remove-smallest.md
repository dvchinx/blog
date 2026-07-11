---
titulo: "Codeforces 1399A - Remove Smallest"
seoTitulo: "Solución de 1399A. Remove Smallest (CodeForces) en Python — Greedy y Ordenamiento"
fecha: "2026-07-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 665 (Div. 2)"
imagenPortada: "https://images.unsplash.com/photo-1509475826633-fed577a2c71b?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo", "Greedy", "Sorting"]
categoria: "coding"
keywords: "Codeforces 1399A, Remove Smallest, greedy, sorting, ordenamiento, programación competitiva, Python, diferencia absoluta, eliminar elementos"
---

# 1399 A. Remove Smallest

> Problema original: [Codeforces 1399A - Remove Smallest](https://codeforces.com/problemset/problem/1399/A)

Si buscas la solución de **1399A. Remove Smallest** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

You are given an array a consisting of n positive integers (not necessarily distinct).

You can perform the following operation any number of times (possibly zero):

- Choose two elements of the array (not necessarily at adjacent positions). Let's say you choose element aᵢ and aⱼ where i ≠ j and |aᵢ − aⱼ| ≤ 1.
- Remove the element with the smaller value (if both values are equal, remove either one). In other words, remove min(aᵢ, aⱼ) from the array.

Is it possible to make the array consist of only one element?

### Input

The first line contains a single integer t (1 ≤ t ≤ 100) — the number of test cases.

Each test case consists of two lines:
- The first line contains a single integer n (1 ≤ n ≤ 100) — the length of the array.
- The second line contains n integers a₁, a₂, ..., aₙ (1 ≤ aᵢ ≤ 100) — the elements of the array.

### Output

For each test case, print **YES** if it is possible to make the array consist of only one element, or **NO** otherwise.

### Examples

| Input | Output |
|-------|--------|
|5 | YES |
| 3 | YES |
| 1 2 2 | NO |
| 4 | NO |
| 5 5 5 5 | YES |
| 3 |
| 1 2 4 |
| 4 |
| 1 3 4 4 |
| 1 |
| 100 |

In the first test case of the example, we can perform the following sequence of moves:

1. choose i=1 and j=3 and remove ai (so a becomes [2;2] );
2. choose i=1 and j=2 and remove aj (so a becomes [2]).
   
In the second test case of the example, we can choose any possible i and j any move and it doesn't matter which element we remove.

In the third test case of the example, there is no way to get rid of 2 and 4.


## Resumen rápido

Dada una lista de enteros, podemos eliminar un elemento si existe otro con diferencia absoluta ≤ 1. ¿Es posible dejar solo un elemento?

La clave está en **ordenar el arreglo** y verificar si algún par de elementos adyacentes (en el arreglo ordenado) tiene diferencia > 1. Si existe tal brecha, la respuesta es **NO**; de lo contrario es **YES**.

## Idea de la solución

### Observación principal

Si ordenamos el arreglo, pensemos en qué ocurre cuando hay una "brecha" entre dos grupos: por ejemplo, `[1, 2, 3, 7, 8, 9]`. El valor 3 y el 7 tienen diferencia 4, por lo que **nunca pueden compararse directamente** entre sí.

Dentro del grupo `[1, 2, 3]` podemos eliminar todos menos uno (por ejemplo, quedarnos con 3). Dentro del grupo `[7, 8, 9]` podemos hacer lo mismo y quedarnos con 7. Pero ahora tenemos `[3, 7]` y **ya no podemos operar** porque |7 − 3| = 4 > 1. El arreglo nunca se reducirá a un solo elemento.

### ¿Por qué ordenar y revisar adyacentes es suficiente?

Después de ordenar, si `sorted[i+1] − sorted[i] > 1` para algún índice i, entonces:

- Todos los elementos en `sorted[0..i]` son ≤ `sorted[i]`
- Todos los elementos en `sorted[i+1..n-1]` son ≥ `sorted[i+1]`
- La diferencia mínima entre cualquier elemento del grupo inferior y cualquier elemento del grupo superior es `sorted[i+1] − sorted[i] > 1`

Es decir, **los dos grupos están completamente aislados**: ningún elemento de un grupo puede operar con ningún elemento del otro. Ambos grupos tienen al menos un elemento, por lo que el arreglo final tendrá al menos 2 elementos. Respuesta: NO.

Por otro lado, si todas las diferencias adyacentes son ≤ 1, siempre podemos reducir el arreglo a un elemento. La estrategia es sencilla: recorrer de menor a mayor, eliminando cada elemento (como el mínimo) al compararlo con su sucesor de valor.

### Algoritmo

1. Ordenar el arreglo.
2. Recorrer pares adyacentes. Si `sorted[i+1] − sorted[i] > 1` para algún i, imprimir **NO**.
3. Si no se encontró ninguna brecha, imprimir **YES**.

### Complejidad

- **Tiempo**: O(n log n) por el ordenamiento; O(n) por el recorrido lineal.
- **Espacio**: O(n) para almacenar el arreglo ordenado.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
t = int(input())
for _ in range(t):
    n = int(input())
    a = sorted(map(int, input().split()))
    ok = True
    for i in range(n - 1):
        if a[i + 1] - a[i] > 1:
            ok = False
            break
    print("YES" if ok else "NO")
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
t = int(input())
for _ in range(t):
    n = int(input())
    # Ordenamos para poder comparar elementos "vecinos" en valor
    a = sorted(map(int, input().split()))

    ok = True
    for i in range(n - 1):
        # Si dos elementos consecutivos (en el orden) difieren en más de 1,
        # existe una brecha insalvable: ningún elemento del grupo inferior
        # podrá jamás ser comparado con ninguno del grupo superior.
        if a[i + 1] - a[i] > 1:
            ok = False
            break

    print("YES" if ok else "NO")
```

</details>

<br/>

> You are welcome to share your solution in another programming language
