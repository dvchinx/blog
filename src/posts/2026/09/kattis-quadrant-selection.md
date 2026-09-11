---
titulo: "Kattis - Quadrant Selection"
seoTitulo: "Kattis Quadrant Selection — solución en C++: determinar el cuadrante de un punto"
fecha: "2026-09-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Dificultad: 1.1 Fácil"
imagenPortada: "https://i.imgur.com/qVt4pWP.png?w=800&h=500&fit=crop"
etiquetas: ["Kattis", "Math", "Geometry", "Conditionals"]
categoria: "coding"
keywords: "Kattis Quadrant Selection, cuadrante cartesiano, plano cartesiano, determinación de cuadrante, programación competitiva, C++, kattis fácil, Q1 Q2 Q3 Q4"
---

# Quadrant Selection

> Problema original: [Kattis — Quadrant Selection](https://open.kattis.com/problems/quadrant)

Si buscas la solución de **Quadrant Selection** de **Kattis**, aquí encontrarás una explicación clara y un código en **C++** para resolver el problema de la forma más eficiente.

> time limit per test: 1 s |
> memory limit per test: 1024 mB

Dado un punto (x, y) en el plano cartesiano donde ninguna de las dos coordenadas es cero, determina en cuál de los cuatro cuadrantes se encuentra el punto.

### Input

La entrada contiene una única línea con dos enteros x e y separados por espacio, donde x ≠ 0 e y ≠ 0.

### Output

Imprime el cuadrante en el que se encuentra el punto: `Q1`, `Q2`, `Q3` o `Q4`.

### Examples

| Input  | Output |
|--------|--------|
| 2 3    | 1      |
| -1 7   | 2      |
| -4 -5  | 3      |
| 3 -2   | 4      |

## Observación clave

Los cuatro cuadrantes del plano cartesiano se definen exclusivamente por el **signo** de las coordenadas:

| Cuadrante | x    | y    |
|-----------|------|------|
| Q1        | > 0  | > 0  |
| Q2        | < 0  | > 0  |
| Q3        | < 0  | < 0  |
| Q4        | > 0  | < 0  |

Como el enunciado garantiza que x ≠ 0 e y ≠ 0, no existe ningún caso borde: cada punto cae exactamente en uno de los cuatro cuadrantes. Basta verificar el signo de cada coordenada para dar la respuesta.

### Estrategia de implementación

Existen varias formas equivalentes de implementarlo en C++:

1. **Cuatro condiciones explícitas (`if-else if`)**: la más legible y directa.
2. **Indexado con aritmética de booleanos**: construimos un índice a partir de `x > 0` e `y > 0` y buscamos en un arreglo predefinido.
3. **Expresión con operadores ternarios anidados**: una sola línea que concatena el número de cuadrante directamente.

Todas tienen la misma complejidad O(1), pero el enfoque con arreglo indexado es el más interesante, ya que aprovecha que en C++ los booleanos `true`/`false` se convierten implícitamente a `1`/`0` al usarse en aritmética.

### Ejemplo paso a paso

Para la entrada `(-4, -5)`:

| Verificación           | Resultado |
|------------------------|-----------|
| x = -4 → negativo      | x < 0     |
| y = -5 → negativo      | y < 0     |
| Ambas negativas        | **Q3**    |

Para la entrada `(3, -2)`:

| Verificación              | Resultado |
|---------------------------|-----------|
| x = 3 → positivo          | x > 0     |
| y = -2 → negativo         | y < 0     |
| x positivo, y negativo    | **Q4**    |

### ¿Por qué el indexado por booleanos es elegante aquí?

La expresión `x > 0` en C++ evalúa a `true` o `false`, y al convertirse a entero da `1` o `0`. Combinando `(x > 0)` e `(y > 0)` podemos construir un índice de 2 bits (0 a 3) que cubre exactamente las cuatro combinaciones posibles y buscarlo directamente en un arreglo, evitando cadenas de `if-else if`:

```cpp
string cuadrantes[2][2] = {
    {"3", "2"},  // y < 0 : x < 0 -> Q3, x > 0 -> Q4 (fila y>0=false)
    {"4", "1"},  // y > 0 : x < 0 -> Q2, x > 0 -> Q1 (fila y>0=true)
};
```

Para no complicar la lectura del arreglo, en la solución final se prefiere indexarlo directamente como `cuadrantes[y > 0][x > 0]`, de modo que cada celda es una transcripción directa de la tabla de cuadrantes.

### Complejidad

- **Tiempo**: O(1) — una única comparación de signos, independiente del valor de las coordenadas.
- **Espacio**: O(1) — el arreglo tiene exactamente cuatro entradas fijas; no crece con la entrada.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>C++ (Sin comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int x, y;
    cin >> x >> y;

    string cuadrantes[2][2] = {
        {"3", "4"},
        {"2", "1"}
    };

    cout << cuadrantes[y > 0][x > 0] << "\n";
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
    int x, y;
    cin >> x >> y;

    // Tabla indexada por (y > 0, x > 0):
    // fila 0 (y < 0): columna 0 (x < 0) -> Q3, columna 1 (x > 0) -> Q4
    // fila 1 (y > 0): columna 0 (x < 0) -> Q2, columna 1 (x > 0) -> Q1
    string cuadrantes[2][2] = {
        {"3", "4"},
        {"2", "1"}
    };

    // x > 0 y y > 0 se convierten implícitamente a 1 o 0,
    // sirviendo como índices del arreglo.
    // La garantía x != 0 e y != 0 asegura que el índice siempre es válido.
    cout << cuadrantes[y > 0][x > 0] << "\n";
    return 0;
}
```

</details>

<br/>

> You are welcome to share your solution in another programming language
