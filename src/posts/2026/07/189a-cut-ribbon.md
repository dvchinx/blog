---
titulo: "Codeforces 189A - Cut Ribbon"
seoTitulo: "Solución de 189A. Cut Ribbon (CodeForces) en Python — Programación Dinámica"
fecha: "2026-07-08"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 119 (Div. 2)"
imagenPortada: "https://i.imgur.com/65CUoV3.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "1600 elo", "DP", "Knapsack"]
categoria: "coding"
keywords: "Codeforces 189A, Cut Ribbon, programación dinámica, knapsack ilimitado, unbounded knapsack, Python, programación competitiva, DP, maximizar piezas"
---

# 189 A. Cut Ribbon

> Problema original: [Codeforces 189A - Cut Ribbon](https://codeforces.com/problemset/problem/189/A)

Si buscas la solución de **189A. Cut Ribbon** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

Polycarpus has a ribbon, its length is n. He wants to cut the ribbon in a way that fulfils the following two conditions:

1. After the cutting each ribbon piece should have length a, b or c.
2. After the cutting the number of ribbon pieces should be maximum.

Help Polycarpus and find the number of ribbon pieces after the required cutting.

### Input

The first line contains four space-separated integers n, a, b and c (1 ≤ n, a, b, c ≤ 4000) — the length of the original ribbon and the acceptable lengths of the ribbon pieces after the cutting, correspondingly. The numbers a, b and c can coincide.

### Output

Print a single number — the maximum possible number of ribbon pieces. It is guaranteed that at least one correct ribbon cutting exists.

### Examples

| Input       | Output |
|-------------|--------|
| 5 5 3 2     | 2      |
| 7 5 5 2     | 2      |

**Ejemplo 1**: n=5, piezas {5,3,2}. La mejor opción es 3+2 = 2 piezas (mejor que una sola de tamaño 5).

## Resumen rápido

Dado un número n y tres tamaños de corte a, b, c, se busca la máxima cantidad de piezas con las que se puede cubrir exactamente la longitud n. Es un problema clásico de **knapsack ilimitado** (unbounded knapsack): cada tamaño de pieza se puede usar tantas veces como se quiera, y la función objetivo es maximizar el número de piezas usadas en lugar de un valor.

La solución usa programación dinámica en O(n) con una tabla de estados de tamaño n+1.

## Idea de la solución

### Modelado como knapsack ilimitado

Definimos `dp[i]` como el **número máximo de piezas** para cubrir exactamente una longitud `i`. Si es imposible cubrir exactamente `i` con alguna combinación de {a, b, c}, guardamos `−∞` para marcar ese estado como inválido.

**Caso base:** `dp[0] = 0` (cubrir longitud 0 requiere 0 piezas).

**Transición:** para cada longitud `i` de 1 a n, intentamos añadir cada uno de los tres tamaños de pieza:

```
dp[i] = max(dp[i − a] + 1,  si i ≥ a y dp[i − a] ≠ −∞
             dp[i − b] + 1,  si i ≥ b y dp[i − b] ≠ −∞
             dp[i − c] + 1)  si i ≥ c y dp[i − c] ≠ −∞
```

Si ninguna transición es válida, `dp[i]` permanece en `−∞`.

La respuesta final es `dp[n]`.

### ¿Por qué funciona?

La transición `dp[i] = dp[i − x] + 1` representa: "la mejor forma de cubrir `i` termina con una pieza de tamaño `x`, y antes de colocarla ya teníamos cubiertos `i − x` con el máximo de piezas posible". Como cada pieza se puede repetir (knapsack ilimitado), no hay restricción sobre cuántas veces se usa cada tamaño.

### Complejidad

- **Tiempo**: O(n · 3) = **O(n)** — para cada longitud evaluamos tres transiciones.
- **Espacio**: **O(n)** — tabla dp de tamaño n+1.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
n, a, b, c = map(int, input().split())

NEG_INF = float('-inf')
dp = [NEG_INF] * (n + 1)
dp[0] = 0

for i in range(1, n + 1):
    for piece in (a, b, c):
        if i >= piece and dp[i - piece] != NEG_INF:
            dp[i] = max(dp[i], dp[i - piece] + 1)

print(dp[n])
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
n, a, b, c = map(int, input().split())

# Usamos -inf para marcar longitudes que no se pueden cubrir exactamente
NEG_INF = float('-inf')
dp = [NEG_INF] * (n + 1)

# Caso base: cubrir longitud 0 no requiere ninguna pieza
dp[0] = 0

for i in range(1, n + 1):
    # Intentamos añadir cada tipo de pieza al subproblema anterior
    for piece in (a, b, c):
        # Solo si la pieza cabe y el estado anterior es alcanzable
        if i >= piece and dp[i - piece] != NEG_INF:
            dp[i] = max(dp[i], dp[i - piece] + 1)

# dp[n] es el máximo de piezas para cubrir exactamente n
print(dp[n])
```

</details>

<br/>

> You are welcome to share your solution in another programming language
