---
titulo: "CCPL R11 - B. Cordon Bleu"
seoTitulo: "Solución de B. Cordon Blue (UVa 11860) | CCPL R11 | Python"
fecha: "2026-05-20"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio B - CCPL R11 2025"
imagenPortada: "https://i.imgur.com/S8lf6cc.png?w=1000&h=500&fit=crop"
etiquetas: ["CCPL", "C++", "Kattis", "Hungarian Algorithm"]
categoria: "coding"
keywords: "CCPL, Kattis, C++, Algoritmos, Hungarian Algorithm, Bipartite Matching, Distancia Manhattan, Optimización"
---

# B. Cordon Bleu — Ejercicio y Solución

> Problema original: [Kattis - Cordon Bleu](https://open.kattis.com/problems/cordonbleu) | [Enunciado en PDF](https://open.kattis.com/problems/cordonbleu/statement-pdf) 

Si buscas la solución de **B. Cordon Bleu** de **Kattis**, aquí encontrarás una explicación clara y un código en **C++** para resolver el problema de la forma más eficiente.

> time limit per test: 4000 ms | memory limit per test: 1024 mB

A Parisian entrepreneur has just opened a new restaurant “Au bon cordon bleu”, named after a famous French recipe. However, no one has any idea of which wine would be appropriate with such a dish. The entrepreneur plans to sample many different wines in order to build the wine menu.

The various bottles of wine he plans to taste can be obtained from different wine merchants located in or around Paris. Being a very sensitive product, high-quality wine can only be transported by highly trained couriers on motorbikes. Therefore, those couriers are very expensive.

A courier can be used for the transportation of several wine bottles, but can transport only one bottle at a time. All couriers get paid at the same fixed rate: one euro per kilometer. The distance function used is the Manhattan distance (also known as taxicab metric) of every individual segment of the trip: the distance from a point (x1, y1) to a point (x2, y2) is |x1-x2| + |y1-y2|.

A courier in charge of transporting a single wine bottle will get paid as many euros as the sum of the following two (Manhattan) distances: from her base to the wine merchant place, and from the wine merchant place to the restaurant.

Consider a more complex example: a courier in charge of transporting two wine bottles, one after the other. The amount paid will be the sum of the following distances: from his base to the location of the first bottle, then to the restaurant, then to the location of the second bottle, then to the restaurant.

Help the entrepreneur minimize the costs of hiring the couriers. Given a set of Cartesian coordinates corresponding to available couriers, a set of Cartesian coordinates corresponding to the locations of the precious wine bottles they need to collect, and the location of the restaurant, compute the smallest number of kilometers that the couriers will be paid for. There is no obligation to use all available couriers, and bottles can be collected in an arbitrary order.

### Input

The input comprises several lines, each consisting of integers separated with single spaces:

* The first line consists of the number N of wine bottles to collect and the number M of available couriers.
* The N following lines consist of the coordinates of each bottle as two integers x and y.
* The M following lines consist of the coordinates of each courier’s base as two integers x and y.
* The last line contains the coordinates of the restaurant as two integers x and y.

Limits

* 1 ≤ N ≤ 1000;
* 1 ≤ M ≤ 1000;
* All coordinates (x, y) verify -1000 ≤ x ≤ 1000 and -1000 ≤ y ≤ 1000

Notes

There might be more than one item at the same initial location. For example, it would be possible for two bottles, ten couriers, and the restaurant to share the same starting position.

### Output

A single integer: the smallest number of euros that needs to be paid to collect all bottles

### Example

On this example, only one courier (C2) is used to retrieve the two bottles B1 and B2, and bring them to the restaurant R by performing the moves labeled 1 to 4 in succession. The total number of kilometers is 5. This is one of the optimal solutions.

| INPUT  | 
|--------|
| 2 2 |
| 1 0 |
| 0 -1 |
| -1 1 |
| 2 -1 |
| 0 0 |

| OUTPUT |
|--------|
| 5 |

---

## Resumen rápido

- Construir una matriz de costos por botella.
- Para cada courier real, el costo de asignación es `dist(courier, botella) + dist(botella, restaurante)`.
- Para las columnas ficticias, el costo es `2 × distancia_manhattan(botella, restaurante)`.
- Resolver la asignación mínima con el **Hungarian Algorithm** rectangular.
- Sumar los costos elegidos para obtener la respuesta final.

## Idea de la solución

El problema se modela como una **asignación mínima bipartita**: cada botella debe quedar asociada a una opción de transporte, ya sea un courier real o una opción ficticia que representa el recorrido directo al restaurante.

La estrategia es:

1. Para cada botella, calculamos su distancia al restaurante.
2. Si se asigna a un courier real, el costo es `dist(courier, botella) + dist(botella, restaurante)`.
3. Si se asigna a una columna ficticia, el costo es el traslado directo ida y vuelta: `2 × dist(botella, restaurante)`.
4. Como hay más columnas que filas, completamos la matriz con `n - 1` couriers ficticios y aplicamos **Hungarian Algorithm** rectangular.
5. El algoritmo devuelve la combinación de costo mínimo y ese valor es la respuesta.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>C++ / CPP / C / ... (Con comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

/*
------------------------------------------------------------
CORDON BLEU - KATTIS
------------------------------------------------------------

Idea principal:
----------------

Cada botella debe terminar en el restaurante.

Normalmente una botella cuesta:

    restaurante -> botella -> restaurante

Costo:

    2 * dist(botella, restaurante)

Pero si un courier empieza desde su posición inicial
y recoge primero una botella:

    courier -> botella -> restaurante

Costo:

    dist(courier, botella)
    + dist(botella, restaurante)

------------------------------------------------------------

Modelado:
----------

Problema de assignment mínimo.

Filas:
    botellas

Columnas:
    - couriers reales
    - couriers ficticios

Los couriers ficticios representan:
    "recoger normalmente desde restaurante"

Cantidad de columnas:
    m + n - 1

------------------------------------------------------------

Algoritmo:
-----------

Hungarian rectangular
(complejidad O(n^2 * m))

------------------------------------------------------------
*/

static const long long INF = (1LL << 60);

/*
------------------------------------------------------------
Distancia Manhattan
------------------------------------------------------------
*/
inline long long dist(
    int x1, int y1,
    int x2, int y2
) {
    return abs(x1 - x2) + abs(y1 - y2);
}

int main() {

    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    /*
    --------------------------------------------------------
    Entrada
    --------------------------------------------------------
    */

    int n, m;
    cin >> n >> m;

    // botellas
    vector<pair<int,int>> bottles(n);

    // couriers
    vector<pair<int,int>> couriers(m);

    for (auto &p : bottles)
        cin >> p.first >> p.second;

    for (auto &p : couriers)
        cin >> p.first >> p.second;

    // restaurante
    int rx, ry;
    cin >> rx >> ry;

    /*
    --------------------------------------------------------
    Total de columnas
    --------------------------------------------------------

    m couriers reales
    n-1 couriers ficticios

    Total:
        m + n - 1
    --------------------------------------------------------
    */

    int W = m + n - 1;

    /*
    --------------------------------------------------------
    Matriz de costos

    a[i][j] =
        costo de asignar botella i
        al worker j
    --------------------------------------------------------
    */

    vector<vector<long long>> a(
        n,
        vector<long long>(W)
    );

    /*
    --------------------------------------------------------
    Construcción de costos
    --------------------------------------------------------
    */

    for (int i = 0; i < n; ++i) {

        auto [bx, by] = bottles[i];

        // distancia botella -> restaurante
        long long drest =
            dist(bx, by, rx, ry);

        /*
        ----------------------------------------------------
        Couriers reales
        ----------------------------------------------------

        costo:

            courier -> botella
            + botella -> restaurante
        ----------------------------------------------------
        */

        for (int j = 0; j < m; ++j) {

            auto [cx, cy] = couriers[j];

            a[i][j] =
                dist(bx, by, cx, cy)
                + drest;
        }

        /*
        ----------------------------------------------------
        Couriers ficticios
        ----------------------------------------------------

        Representan:

            restaurante -> botella -> restaurante

        costo:
            2 * dist(botella, restaurante)
        ----------------------------------------------------
        */

        long long normal = 2LL * drest;

        for (int j = m; j < W; ++j)
            a[i][j] = normal;
    }

    /*
    --------------------------------------------------------
    HUNGARIAN RECTANGULAR
    --------------------------------------------------------

    u:
        potenciales de filas

    v:
        potenciales de columnas

    p:
        matching actual

    way:
        reconstrucción de camino augmentante
    --------------------------------------------------------
    */

    vector<long long> u(n + 1), v(W + 1);

    vector<int> p(W + 1);
    vector<int> way(W + 1);

    /*
    --------------------------------------------------------
    Procesamos fila por fila
    --------------------------------------------------------
    */

    for (int i = 1; i <= n; ++i) {

        // empezamos augmentación
        p[0] = i;

        // minv[j]:
        // mejor costo reducido encontrado
        vector<long long> minv(W + 1, INF);

        // columnas usadas
        vector<char> used(W + 1, false);

        int j0 = 0;

        /*
        ----------------------------------------------------
        Encontrar camino augmentante
        ----------------------------------------------------
        */

        do {

            used[j0] = true;

            // fila actual
            int i0 = p[j0];

            long long delta = INF;
            int j1 = 0;

            /*
            ------------------------------------------------
            Relajación sobre columnas
            ------------------------------------------------
            */

            for (int j = 1; j <= W; ++j) {

                if (!used[j]) {

                    /*
                    ----------------------------------------
                    costo reducido
                    ----------------------------------------
                    */

                    long long cur =
                        a[i0 - 1][j - 1]
                        - u[i0]
                        - v[j];

                    /*
                    ----------------------------------------
                    mejoramos mínimo
                    ----------------------------------------
                    */

                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }

                    /*
                    ----------------------------------------
                    mejor siguiente columna
                    ----------------------------------------
                    */

                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }

            /*
            ------------------------------------------------
            Actualización de potenciales
            ------------------------------------------------
            */

            for (int j = 0; j <= W; ++j) {

                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                }
                else {
                    minv[j] -= delta;
                }
            }

            j0 = j1;

        } while (p[j0] != 0);

        /*
        ----------------------------------------------------
        Reconstrucción del matching
        ----------------------------------------------------
        */

        do {

            int j1 = way[j0];

            p[j0] = p[j1];

            j0 = j1;

        } while (j0);
    }

    /*
    --------------------------------------------------------
    Calcular respuesta final
    --------------------------------------------------------
    */

    long long ans = 0;

    for (int j = 1; j <= W; ++j) {

        if (p[j]) {

            ans += a[p[j] - 1][j - 1];
        }
    }

    cout << ans << '\n';

    return 0;
}
```
</details>

<details>
<summary>C++ / CPP / C / ... (Sin comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

static const long long INF = (1LL << 60);

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;

    vector<pair<int,int>> bottles(n);
    vector<pair<int,int>> couriers(m);

    for (auto &p : bottles)
        cin >> p.first >> p.second;

    for (auto &p : couriers)
        cin >> p.first >> p.second;

    int rx, ry;
    cin >> rx >> ry;

    int W = m + n - 1;

    vector<vector<long long>> a(n, vector<long long>(W));

    for (int i = 0; i < n; ++i) {

        auto [bx, by] = bottles[i];

        long long drest =
            abs(bx - rx) + abs(by - ry);

        for (int j = 0; j < m; ++j) {

            auto [cx, cy] = couriers[j];

            a[i][j] =
                abs(bx - cx)
                + abs(by - cy)
                + drest;
        }

        long long normal = 2LL * drest;

        for (int j = m; j < W; ++j)
            a[i][j] = normal;
    }

    // Hungarian rectangular
    vector<long long> u(n + 1), v(W + 1);
    vector<int> p(W + 1), way(W + 1);

    for (int i = 1; i <= n; ++i) {

        p[0] = i;

        vector<long long> minv(W + 1, INF);
        vector<char> used(W + 1, false);

        int j0 = 0;

        do {
            used[j0] = true;

            int i0 = p[j0];

            long long delta = INF;
            int j1 = 0;

            for (int j = 1; j <= W; ++j) {

                if (!used[j]) {

                    long long cur =
                        a[i0 - 1][j - 1]
                        - u[i0]
                        - v[j];

                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }

                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }

            for (int j = 0; j <= W; ++j) {

                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }

            j0 = j1;

        } while (p[j0] != 0);

        do {

            int j1 = way[j0];

            p[j0] = p[j1];

            j0 = j1;

        } while (j0);
    }

    long long ans = 0;

    for (int j = 1; j <= W; ++j)
        if (p[j])
            ans += a[p[j] - 1][j - 1];

    cout << ans << '\n';
}
```
</details>