---
titulo: "Kattis - Bela"
seoTitulo: "Kattis Bela — solución en C++: puntaje de cartas con tabla de consulta"
fecha: "2026-08-29"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Dificultad: 1.9 · Fácil"
imagenPortada: "https://images.unsplash.com/photo-1607637508975-bf0090d7a0b4?w=800&h=500&fit=crop"
etiquetas: ["Kattis", "Implementation", "Strings", "C++"]
categoria: "coding"
keywords: "Kattis bela, kattis bela solución C++, card game scoring, tabla de puntuación cartas, programación competitiva C++, unordered_map C++, lookup table, kattis fácil"
---

# Bela

> Problema original: [Kattis — Bela](https://open.kattis.com/problems/bela)

Si buscas la solución de **Bela** de **Kattis**, aquí encontrarás una explicación clara y un código en **C++** para resolver el problema de la forma más eficiente.

> time limit per test: 1 s |
> memory limit per test: 1024 MB

Mirko observa a unos pensionados jugando Belote y debe calcular el total de puntos de la partida. Se jugaron **N manos** (cada mano tiene exactamente 4 cartas) con el palo dominante **B**.

El valor de cada carta depende de si su palo es el dominante o no:

| Valor | Dominante | No dominante |
|-------|-----------|--------------|
| A (As) | 11 | 11 |
| K (Rey) | 4 | 4 |
| Q (Reina) | 3 | 3 |
| J (Jota) | **20** | 2 |
| T (Diez) | 10 | 10 |
| 9 (Nueve) | **14** | 0 |
| 8 (Ocho) | 0 | 0 |
| 7 (Siete) | 0 | 0 |

Los valores de J y 9 cambian drásticamente según si el palo es dominante — ahí está la trampa del problema.

### Input

La primera línea contiene `N` (1 ≤ N ≤ 100) y el palo dominante `B` (`S`, `H`, `D` o `C`). Las siguientes `4N` líneas contienen cada una una carta: el primer carácter es el valor (`A`, `K`, `Q`, `J`, `T`, `9`, `8`, `7`) y el segundo es el palo (`S`, `H`, `D`, `C`).

### Output

Una sola línea con el total de puntos.

### Examples

| Input | Output |
|-------|--------|
| 2 S | 60 |
| TH | |
| 9C | |
| KS | |
| QS | |
| JS | |
| TD | |
| AD | |
| JH | |

**Ejemplo:** N=2 manos (8 cartas), palo dominante = Spades (`S`).

## Observación clave

`N` es el número de **manos**, no de cartas. Hay que leer **4·N cartas** en total. Confundir esto y leer solo N cartas es el error más frecuente en este problema.

Una vez aclarado el conteo, la solución es pura implementación: dos tablas de consulta (trump y no-trump) indexadas por el carácter del valor de la carta. Por cada carta se elige la tabla correcta según el palo y se acumula la puntuación.

### Ejemplo paso a paso

Para `2 S` → 2 manos → 8 cartas, palo dominante Spades:

| Carta | Valor | Palo | ¿Dominante? | Puntos |
|-------|-------|------|-------------|--------|
| TH | T | H | No | 10 |
| 9C | 9 | C | No | 0 |
| KS | K | S | **Sí** | 4 |
| QS | Q | S | **Sí** | 3 |
| JS | J | S | **Sí** | **20** |
| TD | T | D | No | 10 |
| AD | A | D | No | 11 |
| JH | J | H | No | 2 |
| **Total** | | | | **60** |

### ¿Por qué usar tabla en lugar de `if`/`switch`?

Con 8 valores y 2 categorías, una cadena de `if-else` tiene 16 ramas. Una tabla de consulta define cada puntuación una sola vez y el acceso es O(1). `unordered_map<char, int>` cumple eso con código limpio y legible.

Alternativa aún más rápida en competencias: un array de 128 posiciones indexado por el código ASCII del carácter del valor — acceso directo a memoria, sin overhead de hash.

### Complejidad

- **Tiempo**: O(N) — una consulta a tabla por carta, 4N cartas en total.
- **Espacio**: O(1) — tablas de tamaño fijo.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>C++ (Sin comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    unordered_map<char, int> trump_pts = {
        {'J', 20}, {'9', 14}, {'A', 11}, {'T', 10},
        {'K',  4}, {'Q',  3}, {'8',  0}, {'7',  0}
    };
    unordered_map<char, int> other_pts = {
        {'A', 11}, {'T', 10}, {'K', 4}, {'Q', 3},
        {'J',  2}, {'9',  0}, {'8', 0}, {'7', 0}
    };

    int n; char b;
    cin >> n >> b;

    int total = 0;
    for (int i = 0; i < 4 * n; i++) {
        string card;
        cin >> card;
        total += (card[1] == b) ? trump_pts[card[0]] : other_pts[card[0]];
    }

    cout << total << "\n";
    return 0;
}
```

</details>

<details>
<summary>C++ (Con comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // Puntuación cuando la carta es del palo dominante (trump)
    // J y 9 valen mucho más que en palo normal
    unordered_map<char, int> trump_pts = {
        {'J', 20}, {'9', 14}, {'A', 11}, {'T', 10},
        {'K',  4}, {'Q',  3}, {'8',  0}, {'7',  0}
    };

    // Puntuación cuando la carta NO es del palo dominante
    // J baja de 20 a 2, y 9 baja de 14 a 0
    unordered_map<char, int> other_pts = {
        {'A', 11}, {'T', 10}, {'K', 4}, {'Q', 3},
        {'J',  2}, {'9',  0}, {'8', 0}, {'7', 0}
    };

    int n; char b;
    cin >> n >> b;   // n = número de manos (no de cartas), b = palo dominante

    int total = 0;
    // Hay 4 cartas por mano → leer 4*n cartas en total
    for (int i = 0; i < 4 * n; i++) {
        string card;
        cin >> card;

        char val  = card[0];  // valor: A, K, Q, J, T, 9, 8, 7
        char suit = card[1];  // palo:  S, H, D, C

        // Elegimos la tabla según si el palo de la carta coincide con el dominante
        if (suit == b) {
            total += trump_pts[val];
        } else {
            total += other_pts[val];
        }
    }

    cout << total << "\n";
    return 0;
}
```

</details>

<br/>

> You are welcome to share your solution in another programming language
