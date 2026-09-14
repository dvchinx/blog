---
titulo: "Codeforces 263A - Beautiful Matrix"
seoTitulo: "Codeforces 263A Beautiful Matrix — solución en C++: distancia Manhattan al centro"
fecha: "2026-09-15"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 161 (Div. 2)"
imagenPortada: "https://i.imgur.com/dJvgH6b.png?w=800&h=500&fit=crop"
etiquetas: ["Codeforces", "Math", "Implementation"]
categoria: "coding"
keywords: "Codeforces 263A, Beautiful Matrix, minimum swaps center, distancia Manhattan, programación competitiva C++, implementación, intercambios adyacentes"
---

# Beautiful Matrix

> Problema original: [Codeforces 263A — Beautiful Matrix](https://codeforces.com/problemset/problem/263/A)

Si buscas la solución de **Beautiful Matrix** de **Codeforces**, aquí encontrarás una explicación clara y un código en **C++** para resolver el problema de la forma más eficiente.

> time limit per test: 2 s |
> memory limit per test: 256 MB

Tienes una matriz de 5 × 5, formada por 24 ceros y un único número uno. Numeremos las filas de la matriz del 1 al 5 de arriba hacia abajo, y numeremos las columnas del 1 al 5 de izquierda a derecha. En un movimiento, puedes aplicar una de las siguientes dos transformaciones a la matriz:

1. Intercambiar dos filas vecinas de la matriz, es decir, las filas con índices i e i + 1 para algún entero i (1 ≤ i < 5).
2. Intercambiar dos columnas vecinas de la matriz, es decir, las columnas con índices j y j + 1 para algún entero j (1 ≤ j < 5).

Consideras que una matriz es "bonita" si el único número uno de la matriz se encuentra en su centro (en la celda que está en la intersección de la tercera fila y la tercera columna). Cuenta el número mínimo de movimientos necesarios para que la matriz sea bonita.

### Input

La entrada consiste en cinco líneas, cada una con cinco números enteros: el j-ésimo entero de la i-ésima línea representa el elemento de la matriz ubicado en la intersección de la fila i y la columna j. Se garantiza que la matriz está formada por 24 ceros y un único número uno.

### Output

Imprime un único entero: el número mínimo de movimientos necesarios para que la matriz sea bonita.

### Ejemplos

|     Entrada    |
|----------------|
| 0 0 0 0 0      |
| 0 0 0 0 1      |
| 0 0 0 0 0      |
| 0 0 0 0 0      |
| 0 0 0 0 0      |

| Salida |
|--------|
| 3      |

|     Entrada    |
|----------------|
| 0 0 0 0 0      |
| 0 0 0 0 0      |
| 0 1 0 0 0      |
| 0 0 0 0 0      |
| 0 0 0 0 0      |

| Salida |
|--------|
| 1      |

## Observación clave

Para mover un elemento desde una posición hasta otra en una cuadrícula usando únicamente intercambios de celdas adyacentes (como en el "puzzle deslizante"), el **número mínimo de intercambios es exactamente la distancia Manhattan** entre la posición actual y la destino.

La posición central de una matriz 5×5 en índice 0 es **(2, 2)**. Si el número 1 se encuentra en la fila `r` y la columna `c`, la respuesta es: `|r - 2| + |c - 2| `.

La razón es que podemos mover el número directamente hacia el centro por la ruta más corta: primero todas las celdas horizontalmente y luego verticalmente (o en cualquier orden), sin interferencias externas que incrementen el conteo.

### Ejemplo paso a paso

Para el segundo ejemplo, el número 1 se encuentra en la posición (2, 1) (fila 2, columna 1). El centro es (2, 2):

| Movimiento | Posición del 1 |
|-----------|----------------|
| Inicio | (2, 1) |
| Derecha | (2, 2) ✓ |

`distancia = |2 - 2| + |1 - 2| = 0 + 1 = 1`

Exactamente 1 intercambio, confirmando el resultado esperado.

Para ilustrar un caso con más movimientos, si el número 1 estuviera en la esquina (0, 0):

| Movimiento | Posición del 1 |
|-----------|----------------|
| Inicio | (0, 0) |
| Derecha | (0, 1) |
| Derecha | (0, 2) |
| Abajo | (1, 2) |
| Abajo | (2, 2) ✓ |

`distancia = |0 - 2| + |0 - 2| = 2 + 2 = 4`

Se necesitarían 4 intercambios.

### ¿Por qué no puede ser menor que la distancia Manhattan?

Cada intercambio mueve el elemento exactamente una celda en alguna dirección. Para reducir la distancia Manhattan en 1 con cada intercambio (el ritmo óptimo), nunca debemos dar pasos "de más". Si nos alejamos del centro aunque sea un paso, necesitamos uno extra para compensar. Por tanto, la distancia Manhattan es un límite inferior y también alcanzable.

### Complejidad

- **Tiempo**: O(25) = O(1) — la matriz tiene tamaño fijo.
- **Espacio**: O(1) extra.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>C++ (Sin comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int x;
    for (int r = 0; r < 5; r++) {
        for (int c = 0; c < 5; c++) {
            cin >> x;
            if (x == 1) {
                cout << abs(r - 2) + abs(c - 2) << "\n";
            }
        }
    }
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
    // Desacopla cin/cout de los streams de C para una entrada/salida más rápida
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int x;
    for (int r = 0; r < 5; r++) {
        for (int c = 0; c < 5; c++) {
            cin >> x;
            if (x == 1) {
                // La posición central en índice 0 es (2, 2)
                // La distancia Manhattan es el mínimo de intercambios necesarios
                cout << abs(r - 2) + abs(c - 2) << "\n";
                // No hace falta continuar: el 1 aparece exactamente una vez
            }
        }
    }
    return 0;
}
```

</details>

<br/>

> Eres bienvenido a compartir tu solución en otro lenguaje de programación.
