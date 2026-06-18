---
titulo: "Codeforces 489B - BerSU Ball"
seoTitulo: "Solución de 489B. BerSU Ball (CodeForces) en Python"
fecha: "2026-06-19"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 277.5 (Div 2)"
imagenPortada: "https://i.imgur.com/ActbvTT.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "1200 Elo", "Greedy", "Dos punteros", "Ordenamiento"]
categoria: "coding"
keywords: "Codeforces 489B, BerSU Ball, greedy, dos punteros, two pointers, ordenamiento, Algoritmos, Programación competitiva, Resolución de problemas"
---

# 489 B. BerSU Ball

> Problema original: [Codeforces 489B - BerSU Ball](https://codeforces.com/problemset/problem/489/B)

Si buscas la solución de **489 B. BerSU Ball** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 seconds | memory limit per test: 256 megabytes

The Berland State University is hosting a ballroom dance in celebration of its 100500-th anniversary! n boys and m girls are already busy rehearsing waltz, minuet, polonaise and quadrille moves.

We know that several boy&girl pairs are going to be invited to the ball. However, the partners' dancing skill in each pair must differ by at most one.

For each boy, we know his dancing skills. Similarly, for each girl we know her dancing skills. Write a code that can determine the largest possible number of pairs that can be formed from n boys and m girls.

### Input

The first line contains a single integer n (1 ≤ n ≤ 200000) — the number of boys.

The second line contains n space-separated real numbers — the dancing skills of the boys.

The third line contains a single integer m (1 ≤ m ≤ 200000) — the number of girls.

The fourth line contains m space-separated real numbers — the dancing skills of the girls.

### Output

Print a single integer — the required maximum possible number of pairs.

### Example 1

| Input |
|-------|
| 4 |
| 1 4 6 2 |
| 5 |
| 5 1 5 7 9 |


| Output |
|--------|
| 3 |

### Example 2

| Input |
|-------|
| 4 |
| 1 2 3 4 |
| 4 |
| 10 11 12 13 |


| Output |
|--------|
| 0 |

### Example 3

| Input |
|-------|
| 5 |
| 1 1 1 1 1 |
| 3 |
| 1 2 3 |


| Output |
|--------|
| 2 |

## Resumen rápido

Dado `n` chicos y `m` chicas, cada uno con una habilidad de baile (número real), encontrar el **máximo número de parejas** (chico, chica) tal que la diferencia absoluta de sus habilidades sea como máximo `1`. Cada persona puede pertenecer a una sola pareja.

La solución usa **greedy** con **dos punteros** sobre los arreglos ordenados, logrando O(n log n + m log m) en total.

## Idea de la solución

La clave está en demostrar que el **emparejamiento óptimo también es monótono** cuando las listas están ordenadas: si el chico `i` puede bailar con la chica `j`, entonces nunca conviene "cruzar" parejas, es decir, no hay razón para emparejar a `i` con `j' > j` y a `i' < i` con `j`.

Con esto, la estrategia es:

1. **Ordenar** los arreglos de habilidades de chicos y chicas por separado.
2. **Usar dos punteros** `i` (sobre chicos) y `j` (sobre chicas):
   - Si `|boys[i] - girls[j]| <= 1`: se puede formar pareja — emparejamos, avanzamos ambos punteros y sumamos 1 al contador.
   - Si `boys[i] < girls[j] - 1`: el chico `i` tiene habilidad demasiado baja para la chica `j` **y para todas las siguientes** (pues el arreglo está ordenado) — avanzamos `i`.
   - Si `boys[i] > girls[j] + 1`: la chica `j` tiene habilidad demasiado baja para el chico `i` **y para todos los siguientes** — avanzamos `j`.
3. Terminamos cuando alguno de los dos punteros llega al final de su arreglo.

**¿Por qué es correcto?** En cada paso descartamos a la persona con la habilidad más baja que ya no puede emparejarse con nadie en el lado opuesto. Esto es óptimo: esa persona tampoco podría contribuir a ninguna pareja futura.

**Complejidad**: O(n log n + m log m) por el ordenamiento; O(n + m) para los dos punteros.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
n = int(input())
boys = list(map(float, input().split()))
m = int(input())
girls = list(map(float, input().split()))

boys.sort()
girls.sort()

i = j = ans = 0

while i < n and j < m:
    if abs(boys[i] - girls[j]) <= 1:
        ans += 1
        i += 1
        j += 1
    elif boys[i] < girls[j] - 1:
        i += 1
    else:
        j += 1

print(ans)
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
# Leer número de chicos y sus habilidades de baile
n = int(input())
boys = list(map(float, input().split()))

# Leer número de chicas y sus habilidades de baile
m = int(input())
girls = list(map(float, input().split()))

# Ordenar ambas listas para aplicar el greedy con dos punteros.
# El orden garantiza que el emparejamiento óptimo sea monótono.
boys.sort()
girls.sort()

# i: puntero sobre chicos
# j: puntero sobre chicas
# ans: contador de parejas formadas
i = j = ans = 0

while i < n and j < m:

    if abs(boys[i] - girls[j]) <= 1:
        # Diferencia dentro del rango permitido: forman pareja.
        # Ambos quedan "usados", avanzamos los dos punteros.
        ans += 1
        i += 1
        j += 1

    elif boys[i] < girls[j] - 1:
        # El chico i tiene habilidad demasiado baja:
        # no puede bailar con la chica j ni con ninguna posterior
        # (que tiene habilidad >= girls[j]).
        # Descartamos al chico i.
        i += 1

    else:
        # boys[i] > girls[j] + 1
        # La chica j tiene habilidad demasiado baja:
        # no puede bailar con el chico i ni con ningún posterior
        # (que tiene habilidad >= boys[i]).
        # Descartamos a la chica j.
        j += 1

print(ans)
```
</details>
