---
titulo: "Codeforces 111D - Petya and Coloring"
seoTitulo: "Solución de 111D. Petya and Coloring (CodeForces) en Python"
fecha: "2026-06-03"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Beta Round 85 (Div 1 Only)"
imagenPortada: "https://i.imgur.com/0qbo0AW.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "2300-2400 Elo", "DP", "Combinatoria", "Inclusión-Exclusión"]
categoria: "coding"
keywords: "Codeforces 111D, Petya and Coloring, Programación Dinámica, Combinatoria, Principio de Inclusión-Exclusión, Algoritmos, Programación competitiva, Resolución de problemas"
---

# 111 D. Petya and Coloring

> Problema original: [Codeforces 111D - Petya and Coloring](https://codeforces.com/problemset/problem/111/D)

Si buscas la solución de **111 D. Petya and Coloring** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 5 second |
> memory limit per test: 256 megabytes

Little Petya loves counting. He wants to count the number of ways to paint a rectangular checkered board of size n × m (n rows, m columns) in k colors. Besides, the coloring should have the following property: for any vertical line that passes along the grid lines and divides the board in two non-empty parts the number of distinct colors in both these parts should be the same. Help Petya to count these colorings.

### Input

The first line contains space-separated integers n, m and k (1 ≤ n, m ≤ 1000, 1 ≤ k ≤ 106) — the board's vertical and horizontal sizes and the number of colors respectively.

### Output
Print the answer to the problem. As the answer can be quite a large number, you should print it modulo 10^9 + 7 (1000000007).

### Example 1

| Input   |
|---------|
| 2 2 1   |

| Output  |
|---------|
| 1       |

### Example 2

| Input   |
|---------|
| 2 2 2   |

| Output  |
|---------|
| 8       |

### Example 3

| Input   |
|---------|
| 3 2 2   |

| Output  |
|---------|
| 40      |

## Resumen rápido

El problema pide contar el número de formas de colorear un tablero de `n x m` con `k` colores, de modo que para cualquier corte vertical, el conjunto de colores a la izquierda sea idéntico al de la derecha.

La condición clave implica que el conjunto de colores en la primera columna, la última columna y las columnas intermedias (si `m > 2`) debe ser el mismo. La solución utiliza **programación dinámica** y el **principio de inclusión-exclusión** para contar las formas de colorear una columna con un número exacto de colores, y luego combina los resultados con **combinatoria** para obtener la respuesta final.

## Idea de la solución

La condición del problema es que para cualquier división vertical, el conjunto de colores en la parte izquierda es igual al conjunto de colores en la parte derecha. Esto se simplifica a dos condiciones:
1.  El conjunto de colores de la primera columna (`C_1`) debe ser igual al conjunto de colores de las columnas `2` a `m`.
2.  El conjunto de colores de las columnas `1` a `m-1` debe ser igual al conjunto de colores de la última columna (`C_m`).

De estas dos condiciones, se deduce que `C_1` y `C_m` deben tener el mismo conjunto de colores. Además, si `m > 2`, todas las columnas intermedias (`2` a `m-1`) solo pueden usar colores que estén presentes tanto en `C_1` como en `C_m`.

La estrategia es:
1.  **Calcular `dp[i]`**: Número de formas de colorear una columna de `n` celdas usando **exactamente** `i` colores distintos. Esto se hace con el principio de inclusión-exclusión.
2.  **Iterar sobre los colores comunes**: Se itera sobre el número de colores `i` que serán comunes a la primera y última columna, y sobre el número de colores `j` que serán exclusivos para cada una de ellas.
3.  **Combinar los resultados**:
    *   Se eligen los colores para cada grupo (`C(k, i)`, `C(k-i, j)`, etc.).
    *   Se calcula el número de formas de colorear la primera y última columna usando `dp[i+j]`.
    *   Se calcula el número de formas de colorear las `m-2` columnas intermedias, que solo pueden usar los `i` colores comunes.
    *   Se suma todo, módulo `10^9 + 7`.

Se manejan los casos `m=1` y `m=2` por separado, ya que la lógica de las columnas intermedias no aplica.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
MOD = 1000000007

n, m, k = map(int, input().split())

def mod_pow(a, b):
    return pow(a, b, MOD)

MAXK = k

fact = [1] * (MAXK + 1)
for i in range(1, MAXK + 1):
    fact[i] = fact[i - 1] * i % MOD

inv_fact = [1] * (MAXK + 1)
inv_fact[MAXK] = pow(fact[MAXK], MOD - 2, MOD)
for i in range(MAXK, 0, -1):
    inv_fact[i - 1] = inv_fact[i] * i % MOD

def C(nr, r):
    if r < 0 or r > nr:
        return 0
    return fact[nr] * inv_fact[r] % MOD * inv_fact[nr - r] % MOD

if m == 1:
    print(pow(k, n, MOD))
    exit()

limit = min(n, k)

dp = [0] * (limit + 1)

for i in range(1, limit + 1):
    dp[i] = pow(i, n, MOD)
    for j in range(1, i):
        dp[i] = (dp[i] - C(i, j) * dp[j]) % MOD

ans = 0

if m == 2:
    for i in range(1, limit + 1):
        cur = dp[i] * dp[i] % MOD
        cur = cur * C(k, i) % MOD
        cur = cur * C(k, i) % MOD
        ans = (ans + cur) % MOD
else:
    exp_mid = n * (m - 2)

    for i in range(1, limit + 1):
        mid = pow(i, exp_mid, MOD)

        max_j = min(n - i, (k - i) // 2)

        for j in range(max_j + 1):
            t = i + j

            cur = dp[t] * dp[t] % MOD
            cur = cur * C(k, i) % MOD
            cur = cur * C(k - i, j) % MOD
            cur = cur * C(k - i - j, j) % MOD
            cur = cur * mid % MOD

            ans = (ans + cur) % MOD

print(ans)
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
MOD = 1000000007

# n = filas
# m = columnas
# k = colores disponibles
n, m, k = map(int, input().split())


# Potencia modular
def mod_pow(a, b):
    return pow(a, b, MOD)


MAXK = k

# ----------------------------
# Precalcular factoriales
# ----------------------------
fact = [1] * (MAXK + 1)
for i in range(1, MAXK + 1):
    fact[i] = fact[i - 1] * i % MOD

# ----------------------------
# Precalcular factoriales inversos
# usando Fermat:
# a^(MOD-2) ≡ a^(-1) (mod MOD)
# ----------------------------
inv_fact = [1] * (MAXK + 1)
inv_fact[MAXK] = pow(fact[MAXK], MOD - 2, MOD)

for i in range(MAXK, 0, -1):
    inv_fact[i - 1] = inv_fact[i] * i % MOD


# ----------------------------
# Combinación C(n, r) módulo MOD
# ----------------------------
def C(nr, r):
    if r < 0 or r > nr:
        return 0

    return (
        fact[nr]
        * inv_fact[r] % MOD
        * inv_fact[nr - r] % MOD
    )


# Caso especial:
# Si solo existe una columna,
# cualquier coloración es válida.
if m == 1:
    print(pow(k, n, MOD))
    exit()


# No pueden utilizarse más de n colores
# en una columna de n celdas.
limit = min(n, k)

# ---------------------------------------------------
# dp[i] = número de formas de colorear una columna
# usando exactamente i colores distintos.
#
# Se calcula mediante inversión binomial:
#
# dp[i] = i^n
#         - Σ C(i,j) * dp[j]
#
# donde j < i.
# ---------------------------------------------------
dp = [0] * (limit + 1)

for i in range(1, limit + 1):
    dp[i] = pow(i, n, MOD)

    for j in range(1, i):
        dp[i] = (dp[i] - C(i, j) * dp[j]) % MOD

ans = 0

# ---------------------------------------------------
# Caso m = 2
#
# Fórmula:
#
# Σ dp[i]^2 * C(k,i)^2
#
# Elegimos i colores para la primera columna
# y los mismos i para la segunda.
# ---------------------------------------------------
if m == 2:

    for i in range(1, limit + 1):
        cur = dp[i] * dp[i] % MOD

        cur = cur * C(k, i) % MOD
        cur = cur * C(k, i) % MOD

        ans = (ans + cur) % MOD

# ---------------------------------------------------
# Caso general m > 2
#
# Fórmula derivada de la editorial:
#
# Σ Σ
# dp[i+j]^2
# * C(k,i)
# * C(k-i,j)
# * C(k-i-j,j)
# * i^(n(m-2))
# ---------------------------------------------------
else:

    exp_mid = n * (m - 2)

    for i in range(1, limit + 1):

        # Contribución de las columnas intermedias
        mid = pow(i, exp_mid, MOD)

        # Restricción de colores disponibles
        max_j = min(n - i, (k - i) // 2)

        for j in range(max_j + 1):

            t = i + j

            cur = dp[t] * dp[t] % MOD

            cur = cur * C(k, i) % MOD
            cur = cur * C(k - i, j) % MOD
            cur = cur * C(k - i - j, j) % MOD

            cur = cur * mid % MOD

            ans = (ans + cur) % MOD

print(ans)
```
</details>