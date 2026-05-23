---
titulo: "CCPL R11 - D. Dominoes Magic Squares"
seoTitulo: "Solución de D. Dominoes Magic Squares (UVa 13296) | CCPL R11 | C++"
fecha: "2026-05-24"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio D - CCPL R11 2025"
imagenPortada: "https://i.imgur.com/aa8uVzn.png?w=1000&h=500&fit=crop"
etiquetas: ["CCPL", "C++", "UVa", "Backtracking", "Poda"]
categoria: "coding"
keywords: "CCPL, UVa, C++, Programación competitiva, Backtracking, Poda, Domino Tiling, Magic Square, Exact Cover"
---

# D. Dominoes Magic Squares — Ejercicio y Solución

> Problema original: [UVa - Dominoes Magic Squares](https://vjudge.net/problem/UVA-13296) | [Enunciado en PDF](https://onlinejudge.org/external/132/13296.pdf) 

Si buscas la solución de **D. Dominoes Magic Squares** de **VJudge**, aquí encontrarás una explicación clara y un código en **C++** para resolver el problema de la forma más eficiente.

> time limit per test: 3000 ms | memory limit per test: 1024 mB

A domino set is a collection of tiles of the form
[a | b]

with integer labels a and b satisfying 0 ≤ a, b ≤ 6. Both [a | b] and [b | a] are descriptions of the same domino tile. A complete domino set has exactly 28 tiles and the sum of all its labels is 168.

A magic square is a square of integer numbers whose rows, columns, and diagonals have the same sum. Since domino tiles can be seen as planar objects of 2 unit squares, they can be used to build magic squares. For instance, the set of domino tiles

[1 | 4] , [5 | 2] , [4 | 4] , [2 | 3] , [5 | 4] , [5 | 3] , [1 | 3] , [3 | 3]

can be arranged into a magic square of side 4 units with rows, columns, and diagonals adding up to 13:

| 4 | 4 | 2 | 3 |

| 3 | 3 | 2 | 5 |

| 1 | 3 | 5 | 4 |

| 5 | 3 | 4 | 1 |

However, it is impossible to build a 4 × 4 magic square with the following set of titles adding up to 15 in rows, columns, and diagonals:

[6 | 5] , [2 | 4] , [2 | 2] , [5 | 5] , [5 | 4] , [5 | 1] , [2 | 3] , [3 | 6] .

Assume you are given 8 domino tiles: can you arrange them into a 4 × 4 magic square?

### Input

The input consists of several test cases. A test case comprises 8 consecutive lines of input, each one containing two blank-separated integers a and b, 0 ≤ a,b ≤ 6, representing the tile [a | b]. You can assume that a test case does not contain repeated dominoes. 

The input must be read from standard input.

### Output

For each test case, output one line with the unique character ‘Y’ if a magic square can be built with the given domino tiles and ‘N’ otherwise. The output must be written to standard output.

### Example

| INPUT  | 
|--------|
| 1 4 |
| 5 2 | 
| 4 4 | 
| 2 3 |
| 5 4 | 
| 5 3 | 
| 1 3 | 
| 3 3 |
| 6 5 | 
| 2 4 | 
| 2 2 | 
| 5 4 | 
| 5 5 | 
| 5 1 | 
| 2 3 | 
| 3 6 |

| OUTPUT |
|--------|
| Y |
| N |

---

## Resumen rápido

- Generar todos los recubrimientos posibles de un tablero 4×4 con 8 dominós.
- Probar cada recubrimiento asignando una ficha y una orientación a cada par de celdas.
- Mantener sumas parciales por filas, columnas y diagonales para podar estados imposibles.
- Verificar si alguna configuración completa logra que todas las líneas tengan la misma suma.
- Si existe una configuración válida, responder `Y`; en caso contrario, responder `N`.

## Idea de la solución

La clave está en notar que el tablero es muy pequeño: solo tiene 16 celdas y se usan exactamente 8 dominós. Eso permite resolver el problema con una búsqueda completa bien podada.

La estrategia es:

1. Calcular la suma total de los 16 números. Si no es múltiplo de 4, no puede existir un cuadrado mágico.
2. Obtener la suma objetivo de cada fila, columna y diagonal: `target = total / 4`.
3. Generar todas las formas de cubrir el tablero 4×4 con 8 dominós.
4. Para cada recubrimiento, probar recursivamente qué dominó va en cada par de celdas y en qué orientación.
5. Después de colocar cada número, actualizar las sumas parciales de filas, columnas y diagonales.
6. Si alguna suma excede el objetivo o ya no puede alcanzarlo con las celdas restantes, retroceder de inmediato.
7. Si logramos llenar todo el tablero cumpliendo las restricciones, la respuesta es afirmativa.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>C++ / CPP / C / ... (Con comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

// Representa una ficha de dominó
struct Domino {
    int a, b;
};

// Guarda todas las posibles formas de cubrir un tablero 4x4 usando 8 dominós
vector<vector<pair<int,int>>> tilings;

// Genera todas las formas posibles de colocar dominós en un tablero 4x4
void generateTilings(vector<int>& used, vector<pair<int,int>>& cur) {

    // Busca la primera celda libre
    int p = -1;
    for (int i = 0; i < 16; ++i) {
        if (!used[i]) {
            p = i;
            break;
        }
    }

    // Si no quedan celdas libres, se encontró un recubrimiento completo
    if (p == -1) {
        tilings.push_back(cur);
        return;
    }

    int r = p / 4;
    int c = p % 4;

    // Intentar colocar dominó horizontal
    if (c < 3 && !used[p + 1]) {
        used[p] = used[p + 1] = 1;

        cur.push_back({p, p + 1});

        generateTilings(used, cur);

        cur.pop_back();

        used[p] = used[p + 1] = 0;
    }

    // Intentar colocar dominó vertical
    if (r < 3 && !used[p + 4]) {
        used[p] = used[p + 4] = 1;

        cur.push_back({p, p + 4});

        generateTilings(used, cur);

        cur.pop_back();

        used[p] = used[p + 4] = 0;
    }
}

// Suma objetivo que debe tener cada fila, columna y diagonal
int target;

// Variables para controlar sumas parciales
int rowSum[4], rowCnt[4];
int colSum[4], colCnt[4];
int diagSum[2], diagCnt[2];

// Verifica si una línea aún puede alcanzar la suma objetivo
bool feasible(int sum, int cnt) {

    // Si ya excede la suma objetivo
    if (sum > target)
        return false;

    // Aún llenando con 6's no alcanza
    if (sum + 6 * (4 - cnt) < target)
        return false;

    // Si ya está completa debe ser exactamente igual
    if (cnt == 4 && sum != target)
        return false;

    return true;
}

// Coloca un valor en una celda y valida restricciones
bool placeCell(int pos, int val) {

    int r = pos / 4;
    int c = pos % 4;

    rowSum[r] += val;
    rowCnt[r]++;

    colSum[c] += val;
    colCnt[c]++;

    bool ok = true;

    // Validar fila y columna
    ok &= feasible(rowSum[r], rowCnt[r]);
    ok &= feasible(colSum[c], colCnt[c]);

    // Validar diagonal principal
    if (r == c) {
        diagSum[0] += val;
        diagCnt[0]++;

        ok &= feasible(diagSum[0], diagCnt[0]);
    }

    // Validar diagonal secundaria
    if (r + c == 3) {
        diagSum[1] += val;
        diagCnt[1]++;

        ok &= feasible(diagSum[1], diagCnt[1]);
    }

    // Si no sirve, revertir cambios
    if (!ok) {

        rowSum[r] -= val;
        rowCnt[r]--;

        colSum[c] -= val;
        colCnt[c]--;

        if (r == c) {
            diagSum[0] -= val;
            diagCnt[0]--;
        }

        if (r + c == 3) {
            diagSum[1] -= val;
            diagCnt[1]--;
        }
    }

    return ok;
}

// Elimina un valor previamente colocado
void removeCell(int pos, int val) {

    int r = pos / 4;
    int c = pos % 4;

    rowSum[r] -= val;
    rowCnt[r]--;

    colSum[c] -= val;
    colCnt[c]--;

    if (r == c) {
        diagSum[0] -= val;
        diagCnt[0]--;
    }

    if (r + c == 3) {
        diagSum[1] -= val;
        diagCnt[1]--;
    }
}

// Backtracking principal
bool dfs(const vector<pair<int,int>>& tiling,
         const vector<Domino>& dominos,
         vector<int>& used,
         int idx) {

    // Si ya se colocaron los 8 dominós
    if (idx == 8)
        return true;

    auto cells = tiling[idx];

    int u = cells.first;
    int v = cells.second;

    // Probar cada dominó no usado
    for (int i = 0; i < 8; ++i) {

        if (used[i])
            continue;

        used[i] = 1;

        // Probar ambas orientaciones
        for (int rot = 0; rot < 2; ++rot) {

            int x = (rot == 0 ? dominos[i].a : dominos[i].b);
            int y = (rot == 0 ? dominos[i].b : dominos[i].a);

            // Colocar primera celda
            if (placeCell(u, x)) {

                // Colocar segunda celda
                if (placeCell(v, y)) {

                    // Continuar recursión
                    if (dfs(tiling, dominos, used, idx + 1))
                        return true;

                    // Backtrack
                    removeCell(v, y);
                }

                removeCell(u, x);
            }

            // Evita repetir si ambos números son iguales
            if (dominos[i].a == dominos[i].b)
                break;
        }

        used[i] = 0;
    }

    return false;
}

int main() {

    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Generar todos los recubrimientos posibles del tablero
    vector<int> used(16, 0);
    vector<pair<int,int>> cur;

    generateTilings(used, cur);

    while (true) {

        vector<Domino> dominos(8);

        // Leer primera ficha
        if (!(cin >> dominos[0].a >> dominos[0].b))
            break;

        int total = dominos[0].a + dominos[0].b;

        // Leer restantes fichas
        for (int i = 1; i < 8; ++i) {
            cin >> dominos[i].a >> dominos[i].b;

            total += dominos[i].a + dominos[i].b;
        }

        // La suma total debe dividirse entre 4
        if (total % 4 != 0) {
            cout << "N\n";
            continue;
        }

        target = total / 4;

        bool possible = false;

        // Probar cada forma de cubrir el tablero
        for (const auto& tiling : tilings) {

            memset(rowSum, 0, sizeof(rowSum));
            memset(rowCnt, 0, sizeof(rowCnt));

            memset(colSum, 0, sizeof(colSum));
            memset(colCnt, 0, sizeof(colCnt));

            memset(diagSum, 0, sizeof(diagSum));
            memset(diagCnt, 0, sizeof(diagCnt));

            vector<int> usedDomino(8, 0);

            // Ejecutar backtracking
            if (dfs(tiling, dominos, usedDomino, 0)) {
                possible = true;
                break;
            }
        }

        cout << (possible ? 'Y' : 'N') << '\n';
    }

    return 0;
}
```
</details>

<details>
<summary>C++ / CPP / C / ... (Sin comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

struct Domino {
    int a, b;
};

vector<vector<pair<int,int>>> tilings;

void generateTilings(vector<int>& used, vector<pair<int,int>>& cur) {
    int p = -1;
    for (int i = 0; i < 16; ++i) {
        if (!used[i]) {
            p = i;
            break;
        }
    }

    if (p == -1) {
        tilings.push_back(cur);
        return;
    }

    int r = p / 4;
    int c = p % 4;

    if (c < 3 && !used[p + 1]) {
        used[p] = used[p + 1] = 1;
        cur.push_back({p, p + 1});
        generateTilings(used, cur);
        cur.pop_back();
        used[p] = used[p + 1] = 0;
    }

    if (r < 3 && !used[p + 4]) {
        used[p] = used[p + 4] = 1;
        cur.push_back({p, p + 4});
        generateTilings(used, cur);
        cur.pop_back();
        used[p] = used[p + 4] = 0;
    }
}

int target;
int rowSum[4], rowCnt[4];
int colSum[4], colCnt[4];
int diagSum[2], diagCnt[2];

bool feasible(int sum, int cnt) {
    if (sum > target) return false;
    if (sum + 6 * (4 - cnt) < target) return false;
    if (cnt == 4 && sum != target) return false;
    return true;
}

bool placeCell(int pos, int val) {
    int r = pos / 4;
    int c = pos % 4;

    rowSum[r] += val;
    rowCnt[r]++;

    colSum[c] += val;
    colCnt[c]++;

    bool ok = true;

    ok &= feasible(rowSum[r], rowCnt[r]);
    ok &= feasible(colSum[c], colCnt[c]);

    if (r == c) {
        diagSum[0] += val;
        diagCnt[0]++;
        ok &= feasible(diagSum[0], diagCnt[0]);
    }

    if (r + c == 3) {
        diagSum[1] += val;
        diagCnt[1]++;
        ok &= feasible(diagSum[1], diagCnt[1]);
    }

    if (!ok) {
        rowSum[r] -= val;
        rowCnt[r]--;

        colSum[c] -= val;
        colCnt[c]--;

        if (r == c) {
            diagSum[0] -= val;
            diagCnt[0]--;
        }

        if (r + c == 3) {
            diagSum[1] -= val;
            diagCnt[1]--;
        }
    }

    return ok;
}

void removeCell(int pos, int val) {
    int r = pos / 4;
    int c = pos % 4;

    rowSum[r] -= val;
    rowCnt[r]--;

    colSum[c] -= val;
    colCnt[c]--;

    if (r == c) {
        diagSum[0] -= val;
        diagCnt[0]--;
    }

    if (r + c == 3) {
        diagSum[1] -= val;
        diagCnt[1]--;
    }
}

bool dfs(const vector<pair<int,int>>& tiling,
         const vector<Domino>& dominos,
         vector<int>& used,
         int idx) {

    if (idx == 8) return true;

    auto cells = tiling[idx];
    int u = cells.first;
    int v = cells.second;

    for (int i = 0; i < 8; ++i) {
        if (used[i]) continue;

        used[i] = 1;

        for (int rot = 0; rot < 2; ++rot) {
            int x = (rot == 0 ? dominos[i].a : dominos[i].b);
            int y = (rot == 0 ? dominos[i].b : dominos[i].a);

            if (placeCell(u, x)) {
                if (placeCell(v, y)) {
                    if (dfs(tiling, dominos, used, idx + 1))
                        return true;

                    removeCell(v, y);
                }

                removeCell(u, x);
            }

            if (dominos[i].a == dominos[i].b)
                break;
        }

        used[i] = 0;
    }

    return false;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    vector<int> used(16, 0);
    vector<pair<int,int>> cur;
    generateTilings(used, cur);

    while (true) {
        vector<Domino> dominos(8);

        if (!(cin >> dominos[0].a >> dominos[0].b))
            break;

        int total = dominos[0].a + dominos[0].b;

        for (int i = 1; i < 8; ++i) {
            cin >> dominos[i].a >> dominos[i].b;
            total += dominos[i].a + dominos[i].b;
        }

        if (total % 4 != 0) {
            cout << "N\n";
            continue;
        }

        target = total / 4;

        bool possible = false;

        for (const auto& tiling : tilings) {
            memset(rowSum, 0, sizeof(rowSum));
            memset(rowCnt, 0, sizeof(rowCnt));
            memset(colSum, 0, sizeof(colSum));
            memset(colCnt, 0, sizeof(colCnt));
            memset(diagSum, 0, sizeof(diagSum));
            memset(diagCnt, 0, sizeof(diagCnt));

            vector<int> usedDomino(8, 0);

            if (dfs(tiling, dominos, usedDomino, 0)) {
                possible = true;
                break;
            }
        }

        cout << (possible ? 'Y' : 'N') << '\n';
    }

    return 0;
}
```
</details>