---
titulo: "Codeforces 362E - Petya and Pipes"
seoTitulo: "Solución de 362E. Petya and Pipes (CodeForces) en Python"
fecha: "2026-06-11"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 212 (Div 2)"
imagenPortada: "https://i.imgur.com/NLAiXiQ.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "2300 Elo", "Flujo de Costo Mínimo", "MCMF", "Grafos", "SPFA"]
categoria: "coding"
keywords: "Codeforces 362E, Petya and Pipes, flujo de costo mínimo, MCMF, flujo máximo, SPFA, grafos, Python"
---

# 362 E. Petya and Pipes

> Problema original: [Codeforces 362 E - Petya and Pipes](https://codeforces.com/problemset/problem/362/E)

Si buscas la solución de **362 E. Petya and Pipes** de **CodeForces**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 second |
> memory limit per test: 256 megabytes

A little boy Petya dreams of growing up and becoming the Head Berland Plumber. He is thinking of the problems he will have to solve in the future. Unfortunately, Petya is too inexperienced, so you are about to solve one of such problems for Petya, the one he's the most interested in.

The Berland capital has n water tanks numbered from 1 to n. These tanks are connected by unidirectional pipes in some manner. Any pair of water tanks is connected by at most one pipe in each direction. Each pipe has a strictly positive integer width. Width determines the number of liters of water per a unit of time this pipe can transport. The water goes to the city from the main water tank (its number is 1). The water must go through some pipe path and get to the sewer tank with cleaning system (its number is n).

Petya wants to increase the width of some subset of pipes by at most k units in total so that the width of each pipe remains integer. Help him determine the maximum amount of water that can be transmitted per a unit of time from the main tank to the sewer tank after such operation is completed.

### Input

The first line contains two space-separated integers n and k (2 ≤ n ≤ 50, 0 ≤ k ≤ 1000). Then follow n lines, each line contains n integers separated by single spaces. The i + 1-th row and j-th column contain number cij — the width of the pipe that goes from tank i to tank j (0 ≤ cij ≤ 106, cii = 0). If cij = 0, then there is no pipe from tank i to tank j.

### Output
Print a single integer — the maximum amount of water that can be transmitted from the main tank to the sewer tank per a unit of time.

### Example 1

| Input   |
|---------|
| 5 7 |
| 0 1 0 2 0 |
| 0 0 4 10 0 |
| 0 0 0 0 5 |
| 0 0 0 0 10 |
| 0 0 0 0 0 |

| Output  |
|---------|
| 10       |

### Example 2

| Input   |
|---------|
| 5 10 |
| 0 1 0 0 0 |
| 0 0 2 0 0 |
| 0 0 0 3 0 |
| 0 0 0 0 4 |
| 100 0 0 0 0 |

| Output  |
|---------|
| 5      |

## Resumen rápido

Dado un grafo dirigido de `n` tanques conectados por tuberías con capacidades enteras, se pueden incrementar las capacidades de las tuberías existentes en a lo sumo `k` unidades en total. El objetivo es **maximizar el flujo** del nodo `1` al nodo `n` tras la operación.

El problema es un clásico de **Flujo de Costo Mínimo (MCMF)**: la capacidad original de cada tubería está disponible sin costo, y cualquier unidad adicional cuesta `1`. Se quiere el mayor flujo posible gastando a lo sumo `k` unidades de presupuesto.

## Idea de la solución

La reducción a MCMF es directa:

1. **Modelado del grafo de flujo**: por cada tubería `(u, v)` con capacidad `c > 0`, se agregan dos aristas al grafo de flujo:
   - Arista con capacidad `c` y costo `0` — representa el ancho original de la tubería (gratis de usar).
   - Arista con capacidad `∞` y costo `1` — representa unidades extra que se pueden comprar con el presupuesto `k`.

2. **Fase 1 — flujo gratuito**: se augmenta el flujo usando solo aristas de costo `0` (SPFA ignorando aristas con costo). Esto obtiene el flujo máximo sin gastar nada del presupuesto.

3. **Fase 2 — flujo con presupuesto**: se augmenta el flujo usando el camino de menor costo (SPFA normal), restando el costo de cada augmentación al presupuesto `k`. Si el siguiente camino costaría más de lo que queda en el presupuesto, se detiene.

4. **Respuesta**: la suma del flujo acumulado en ambas fases.

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys
from collections import deque

input = sys.stdin.readline

MAXV = 100
INF = int(1e9)

V = K = 0

E = 0
edges = [None] * (MAXV * MAXV * 10)
head = [-1] * MAXV
flow = [0] * MAXV
from_ = [0] * MAXV
cost = [0] * MAXV
inQueue = [False] * MAXV


def add_edge(u, v, cap, w):
    global E
    edges[E] = [u, v, cap, w, head[u]]
    head[u] = E
    E += 1
    edges[E] = [v, u, 0, -w, head[v]]
    head[v] = E
    E += 1


def augment(source, sink, useExtra):
    Q = deque()

    for i in range(V):
        cost[i] = INF
        inQueue[i] = False

    cost[source] = 0
    flow[source] = 1 if useExtra else INF
    from_[source] = -1

    Q.append(source)

    while Q:
        u = Q.popleft()
        inQueue[u] = False

        e = head[u]
        while e != -1:
            if edges[e][2] > 0:
                if not useExtra and edges[e][3] != 0:
                    e = edges[e][4]
                    continue

                v = edges[e][1]
                w = edges[e][3]

                if cost[u] + w < cost[v]:
                    cost[v] = cost[u] + w
                    flow[v] = min(flow[u], edges[e][2])
                    from_[v] = e

                    if not inQueue[v]:
                        Q.append(v)
                        inQueue[v] = True

            e = edges[e][4]

    if cost[sink] == INF:
        return (0, 0)

    e = from_[sink]
    while e != -1:
        edges[e][2] -= flow[sink]
        edges[e ^ 1][2] += flow[sink]
        e = from_[edges[e][0]]

    return (cost[sink], flow[sink])


def main():
    global V, K

    data = sys.stdin.read().split()
    idx = 0

    V = int(data[idx]); idx += 1
    K = int(data[idx]); idx += 1

    for i in range(V):
        head[i] = -1

    for u in range(V):
        for v in range(V):
            cap = int(data[idx]); idx += 1
            if cap != 0:
                add_edge(u, v, cap, 0)
                if u != v:
                    add_edge(u, v, INF, 1)

    totalCost = 0
    totalFlow = 0

    while True:
        w = augment(0, V - 1, False)
        f = w[1]
        if f == 0:
            break
        totalFlow += f

    while True:
        w = augment(0, V - 1, True)
        c = w[0]
        f = w[1]

        if f == 0:
            break

        if totalCost + c * f > K:
            break

        totalCost += c * f
        totalFlow += f

    print(totalFlow)


if __name__ == "__main__":
    main()
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys
from collections import deque

input = sys.stdin.readline

MAXV = 100
INF = int(1e9)

V = K = 0

# Edge structure as list: [u, v, cap, w, sibl]
E = 0
edges = [None] * (MAXV * MAXV * 10)
head = [-1] * MAXV
flow = [0] * MAXV
from_ = [0] * MAXV
cost = [0] * MAXV
inQueue = [False] * MAXV


def add_edge(u, v, cap, w):
    global E
    edges[E] = [u, v, cap, w, head[u]]
    head[u] = E
    E += 1
    edges[E] = [v, u, 0, -w, head[v]]
    head[v] = E
    E += 1


def augment(source, sink, useExtra):
    Q = deque()

    for i in range(V):
        cost[i] = INF
        inQueue[i] = False

    cost[source] = 0
    flow[source] = 1 if useExtra else INF
    from_[source] = -1

    Q.append(source)

    while Q:
        u = Q.popleft()
        inQueue[u] = False

        e = head[u]
        while e != -1:
            if edges[e][2] > 0:  # cap > 0
                if not useExtra and edges[e][3] != 0:  # w != 0
                    e = edges[e][4]
                    continue

                v = edges[e][1]
                w = edges[e][3]

                if cost[u] + w < cost[v]:
                    cost[v] = cost[u] + w
                    flow[v] = min(flow[u], edges[e][2])
                    from_[v] = e

                    if not inQueue[v]:
                        Q.append(v)
                        inQueue[v] = True

            e = edges[e][4]  # sibl

    if cost[sink] == INF:
        return (0, 0)

    # reflow
    e = from_[sink]
    while e != -1:
        edges[e][2] -= flow[sink]      # cap -= flow[sink]
        edges[e ^ 1][2] += flow[sink]  # sibling cap += flow[sink]
        e = from_[edges[e][0]]         # from[edges[e].u]

    return (cost[sink], flow[sink])


def main():
    global V, K

    data = sys.stdin.read().split()
    idx = 0

    V = int(data[idx]); idx += 1
    K = int(data[idx]); idx += 1

    for i in range(V):
        head[i] = -1

    for u in range(V):
        for v in range(V):
            cap = int(data[idx]); idx += 1
            if cap != 0:
                add_edge(u, v, cap, 0)
                if u != v:
                    add_edge(u, v, INF, 1)

    totalCost = 0
    totalFlow = 0

    # First phase: augment with zero-cost edges only
    while True:
        w = augment(0, V - 1, False)
        f = w[1]
        if f == 0:
            break
        totalFlow += f

    # Second phase: augment with extra cost edges
    while True:
        w = augment(0, V - 1, True)
        c = w[0]
        f = w[1]

        if f == 0:
            break

        if totalCost + c * f > K:
            break

        totalCost += c * f
        totalFlow += f

    print(totalFlow)


if __name__ == "__main__":
    main()
```
</details>