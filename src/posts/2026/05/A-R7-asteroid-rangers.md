---
titulo: "CCPL R7 - A. Asteroid Rangers"
fecha: "2026-05-15"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio A - CCPL R7 2025"
imagenPortada: "https://i.imgur.com/Ou7N1uO.png?w=1000&h=500&fit=crop"
etiquetas: ["CCPL"]
categoria: "coding"
keywords: "CCPL, Codeforces, Algoritmos, Programación competitiva, Asteroid Rangers, Estructura de datos"
---

# A. Asteroid Rangers

> time limit per test: 500 ms

> memory limit per test: 256 mB

The year is 2112 and humankind has conquered the solar system. The Space Ranger Corps have set
up bases on any hunk of rock that is even remotely inhabitable. Your job as a member of the Asteroid
Communications Ministry is to make sure that all of the Space Ranger asteroid bases can communicate
with one another as cheaply as possible. You could set up direct communication links from each base
to every other base, but that would be prohibitively expensive. Instead, you want to set up the minimum
number of links so that everyone can send messages to everyone else, potentially relayed by one or more
bases. The cost of any link is directly proportional to the distance between the two bases it connects, so
this doesn’t seem that hard of a problem.

There is one small difficulty, however. Asteroids have a tendency to move about, so two bases that are
currently very close may not be so in the future. Therefore as time goes on, you must be willing to
switch your communication links so that you always have the cheapest relay system in place. Switching
these links takes time and money, so you are interested in knowing how many times you will have to
perform such a switch.

A few assumptions make your task easier. Each asteroid is considered a single point. Asteroids always
move linearly with a fixed velocity. No asteroids ever collide with other asteroids. Also, any relay system
that becomes optimal at a time t ≥ 0 will be uniquely optimal for any time s satisfying t < s < t+10^−6.
The initial optimal relay system will be unique.

### Input

Each test case starts with a line containing an integer n (2 ≤ n ≤ 50) indicating the number of asteroid
bases. Following this are n lines, each containing six integers x, y, z, vx, vy, vz . The first three specify
the initial location of an asteroid (−150 ≤ x, y, z ≤ 150), and the last three specify the x, y, and z
components of that asteroid’s velocity in space units per time unit (−100 ≤ vx, vy, vz ≤ 100).

### Output

For each test case, display a single line containing the case number and the number of times that the
relay system needs to be set up or modified.

### Example             

| Input  | 
|--------|
| 3     |
| 0 0 0 0 0 0    | 
| 5 0 0 0 0 0    | 
| 10 1 0 -1 0 0    | 
| 4    | 
| 0 0 0 1 0 0    | 
| 0 1 0 0 -1 0    | 
| 1 1 1 3 1 1 |
| -1 -1 2 1 -1 -1 |

| Output |
|--------|
| Case 1: 3 |
| Case 2: 3 |

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```python
import sys
from math import inf

EPS = 1e-9

case = 1

while True:
    line = sys.stdin.readline()
    if not line:
        break

    n = int(line)
    pts = []
    vel = []

    for _ in range(n):
        x, y, z, vx, vy, vz = map(int, sys.stdin.readline().split())
        pts.append((x, y, z))
        vel.append((vx, vy, vz))

    # Distancia^2 entre i,j:
    # d(t)^2 = at^2 + bt + c
    edges = []

    for i in range(n):
        xi, yi, zi = pts[i]
        vxi, vyi, vzi = vel[i]

        for j in range(i + 1, n):
            xj, yj, zj = pts[j]
            vxj, vyj, vzj = vel[j]

            dx = xi - xj
            dy = yi - yj
            dz = zi - zj

            dvx = vxi - vxj
            dvy = vyi - vyj
            dvz = vzi - vzj

            a = dvx * dvx + dvy * dvy + dvz * dvz
            b = 2 * (dx * dvx + dy * dvy + dz * dvz)
            c = dx * dx + dy * dy + dz * dz

            edges.append((i, j, a, b, c))

    def weight(e, t):
        _, _, a, b, c = e
        return (a * t + b) * t + c

    # Kruskal para obtener el MST en tiempo t
    def mst(t):
        order = sorted(
            range(len(edges)),
            key=lambda k: weight(edges[k], t)
        )

        parent = list(range(n))
        rank = [0] * n

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        used = []

        for idx in order:
            u, v, *_ = edges[idx]

            fu = find(u)
            fv = find(v)

            if fu != fv:
                used.append(idx)

                if rank[fu] < rank[fv]:
                    parent[fu] = fv
                elif rank[fu] > rank[fv]:
                    parent[fv] = fu
                else:
                    parent[fv] = fu
                    rank[fu] += 1

                if len(used) == n - 1:
                    break

        return tuple(sorted(used))

    # Buscar todos los tiempos donde dos aristas cambian orden
    times = {0.0}

    m = len(edges)

    for i in range(m):
        _, _, a1, b1, c1 = edges[i]

        for j in range(i + 1, m):
            _, _, a2, b2, c2 = edges[j]

            A = a1 - a2
            B = b1 - b2
            C = c1 - c2

            if abs(A) < EPS:
                if abs(B) < EPS:
                    continue

                t = -C / B

                if t >= 0:
                    times.add(t)

            else:
                D = B * B - 4 * A * C

                if D < -EPS:
                    continue

                if D < 0:
                    D = 0

                sq = D ** 0.5

                t1 = (-B - sq) / (2 * A)
                t2 = (-B + sq) / (2 * A)

                if t1 >= 0:
                    times.add(t1)

                if t2 >= 0:
                    times.add(t2)

    times = sorted(times)

    # Evaluar MST entre eventos
    ans = 0
    last = None

    test_points = []

    for t in times:
        test_points.append(max(0.0, t))

    for i in range(len(times) - 1):
        mid = (times[i] + times[i + 1]) * 0.5
        if mid >= 0:
            test_points.append(mid)

    test_points = sorted(set(test_points))

    for t in test_points:
        cur = mst(t)

        if cur != last:
            ans += 1
            last = cur

    print(f"Case {case}: {ans}")
    case += 1
```

</details>