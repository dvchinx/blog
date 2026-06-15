---
titulo: "Codeforces 1352B - Same Parity Summands"
seoTitulo: "Solución de 1352B. Same Parity Summands (CodeForces) en Python"
fecha: "2026-06-16"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 643 (Div. 2)"
imagenPortada: "https://i.imgur.com/WGyd0Cl.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "1200 elo", "Matemáticas", "Greedy"]
categoria: "coding"
keywords: "Codeforces 1352B, Same Parity Summands, paridad, greedy, matemáticas, programación competitiva, Python, resolución de problemas"
---

# B. Same Parity Summands

> Problema original: [Codeforces 1352B - Same Parity Summands](https://codeforces.com/problemset/problem/1352/B)

Si buscas la solución de **1352B. Same Parity Summands** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

You are given two positive integers n (1 ≤ n ≤ 10⁹) and k (1 ≤ k ≤ 100). Represent the number n as the sum of k positive integers of the same parity (have the same remainder when divided by 2).

In other words, find a₁, a₂, …, aₖ such that all aᵢ > 0, n = a₁ + a₂ + … + aₖ and either all aᵢ are even or all aᵢ are odd at the same time.

If such a representation does not exist, report it.

### Input

The first line contains an integer t (1 ≤ t ≤ 1000) — the number of test cases. Each test case is two positive integers n and k on one line.

### Output

For each test case print:
- **YES** and the required values aᵢ, if the answer exists;
- **NO** if the answer does not exist.

### Example

| Input |
|-------|
| 8     |
| 10 3  |
| 100 4 |
| 8 7   |
| 97 2  |
| 8 8   |
| 3 10  |
| 5 3   |
| 1000000000 9 |

| Output |
|--------|
| YES    |
| 4 2 4  |
| YES    |
| 55 5 5 35 |
| NO     |
| NO     |
| YES    |
| 1 1 1 1 1 1 1 1 |
| NO     |
| YES    |
| 3 1 1  |
| YES    |
| 111111110 111111110 ... 111111120 |

## Resumen rápido

Dado n y k, construir k enteros positivos con la misma paridad (todos impares o todos pares) cuya suma sea exactamente n. Si no es posible, imprimir -1.

La clave es intentar dos estrategias **greedy** de forma independiente: primero "todos impares" y luego "todos pares". Basta con que una de las dos funcione.

## Idea de la solución

### Estrategia 1 — todos impares

La suma mínima usando k impares positivos es k (k copias del 1). La idea es fijar k−1 valores en 1 y asignar al último lo que falte:

`último = n − (k − 1)`

Para que esta construcción sea válida, `último` debe ser **impar** y **≥ 1**:

- **≥ 1** → n ≥ k
- **impar** → n − k + 1 es impar → n − k es par → **n ≡ k (mod 2)**

### Estrategia 2 — todos pares

La suma mínima usando k pares positivos es 2k (k copias del 2). Fijamos k−1 valores en 2 y el último recibe el resto:

`último = n − 2(k − 1)`

Para que sea válida, `último` debe ser **par** y **≥ 2**:

- **≥ 2** → n ≥ 2k
- **par** → n − 2k + 2 es par → n es par (pues 2k − 2 siempre es par) → **n es par**

Si ninguna de las dos estrategias aplica, la respuesta es **−1**.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
t = int(input())
for _ in range(t):
    n, k = map(int, input().split())

    if n >= k and (n - k) % 2 == 0:
        last = n - (k - 1)
        print("YES")
        print(*([1] * (k - 1) + [last]))
    elif n >= 2 * k and n % 2 == 0:
        last = n - 2 * (k - 1)
        print("YES")
        print(*([2] * (k - 1) + [last]))
    else:
        print("NO")
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
t = int(input())
for _ in range(t):
    n, k = map(int, input().split())

    # -----------------------------------------------
    # Estrategia 1: todos impares.
    # Usamos k-1 unos (impar mínimo) y el último
    # recibe el resto: último = n - (k - 1).
    #
    # Condiciones para que sea válido:
    #   - último ≥ 1  →  n ≥ k
    #   - último impar →  n ≡ k (mod 2)
    # -----------------------------------------------
    if n >= k and (n - k) % 2 == 0:
        last = n - (k - 1)
        print("YES")
        print(*([1] * (k - 1) + [last]))

    # -----------------------------------------------
    # Estrategia 2: todos pares.
    # Usamos k-1 doses (par mínimo) y el último
    # recibe el resto: último = n - 2(k - 1).
    #
    # Condiciones para que sea válido:
    #   - último ≥ 2  →  n ≥ 2k
    #   - último par  →  n es par
    # -----------------------------------------------
    elif n >= 2 * k and n % 2 == 0:
        last = n - 2 * (k - 1)
        print("YES")
        print(*([2] * (k - 1) + [last]))

    # -----------------------------------------------
    # Ninguna estrategia es viable.
    # -----------------------------------------------
    else:
        print("NO")
```
</details>
