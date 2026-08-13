---
titulo: "Kattis - Jolly Jumpers"
seoTitulo: "Kattis Jolly Jumpers — solución en Python: verificar diferencias consecutivas completas"
fecha: "2026-08-14"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Dificultad: 2.5 Media"
imagenPortada: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&h=500&fit=crop"
etiquetas: ["Kattis", "Sets", "Math", "Sorting"]
categoria: "coding"
keywords: "Kattis jolly jumpers, jolly jumpers solución Python, diferencias consecutivas, programación competitiva, sets Python, verificar secuencia, kattis media"
---

# Jolly Jumpers

> Problema original: [Kattis — Jolly Jumpers](https://open.kattis.com/problems/jollyjumpers)

Si buscas la solución de **Jolly Jumpers** de **Kattis**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 s |
> memory limit per test: 1024 mB

A sequence of n > 1 integers is called a **jolly jumper** if the absolute differences between successive elements take on all values 1 through n − 1. For instance, the sequence:

```
1 4 2 3
```

is a jolly jumper, because the absolute differences are `|4-1| = 3`, `|2-4| = 2`, `|3-2| = 1` — que son exactamente los valores {1, 2, 3}, es decir, todos los enteros del 1 al n−1 = 3.

### Input

Cada línea de entrada contiene un entero n seguido de n enteros que conforman la secuencia. La entrada termina con EOF.

### Output

Por cada línea de entrada, imprime `"Jolly"` si la secuencia es un jolly jumper, o `"Not jolly"` en caso contrario.

### Examples

| Input | Output |
|-------|--------|
| 4 1 4 2 3 | Jolly |
| 5 1 4 2 -1 6 | Not jolly |

**Ejemplo 1:** diferencias `|4-1|=3`, `|2-4|=2`, `|3-2|=1` → conjunto `{1, 2, 3}` = `{1, ..., 3}` ✓

**Ejemplo 2:** diferencias `|4-1|=3`, `|2-4|=2`, `|-1-2|=3`, `|6-(-1)|=7` → conjunto `{2, 3, 7}` ≠ `{1, 2, 3, 4}` ✗

## Observación clave

La condición de "jolly jumper" se puede reformular de forma directa:

> Calcula las diferencias absolutas entre elementos consecutivos. Si el **conjunto** de esas diferencias es exactamente `{1, 2, ..., n−1}`, la secuencia es jolly.

Hay dos formas equivalentes de verificar esto:

1. Guardar las diferencias en un `set` y compararlo con `set(range(1, n))`.
2. Guardar las diferencias en un `set` y verificar que su tamaño sea `n−1` y que el máximo sea `n−1` y el mínimo sea `1` (válido solo si no hay duplicados, lo que garantiza que están todos los valores).

La primera forma es más directa y Clara.

### Caso borde: n = 1

Una secuencia de un solo elemento no tiene diferencias consecutivas. Por convención, se considera jolly (no hay ninguna condición que violar).

### Ejemplo paso a paso

Para `4 1 4 2 3`:

| Paso | Par | Diferencia absoluta |
|------|-----|---------------------|
| 1 | (1, 4) | `|4 − 1| = 3` |
| 2 | (4, 2) | `|2 − 4| = 2` |
| 3 | (2, 3) | `|3 − 2| = 1` |

Conjunto resultante: `{1, 2, 3}`
Conjunto esperado: `{1, 2, 3}` (para n=4, valores del 1 al 3)
→ **Jolly** ✓

Para `5 1 4 2 -1 6`:

| Paso | Par | Diferencia absoluta |
|------|-----|---------------------|
| 1 | (1, 4) | `|4 − 1| = 3` |
| 2 | (4, 2) | `|2 − 4| = 2` |
| 3 | (2, -1) | `|-1 − 2| = 3` |
| 4 | (-1, 6) | `|6 − (-1)| = 7` |

Conjunto resultante: `{2, 3, 7}`
Conjunto esperado: `{1, 2, 3, 4}` (para n=5, valores del 1 al 4)
→ **Not jolly** ✗ (falta el 1 y el 4, y sobra el 7)

### Complejidad

- **Tiempo**: O(n) por caso de prueba — recorremos la secuencia una vez para calcular las diferencias y comparamos dos conjuntos de tamaño n−1.
- **Espacio**: O(n) — para almacenar el conjunto de diferencias.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys

for line in sys.stdin:
    nums = list(map(int, line.split()))
    n = nums[0]
    if n == 1:
        print("Jolly")
        continue
    seq = nums[1:]
    diffs = {abs(seq[i] - seq[i - 1]) for i in range(1, n)}
    print("Jolly" if diffs == set(range(1, n)) else "Not jolly")
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys

# Leemos toda la entrada línea por línea hasta EOF
for line in sys.stdin:
    nums = list(map(int, line.split()))
    n = nums[0]        # primer número: tamaño de la secuencia

    # Caso especial: secuencia de un solo elemento, trivialmente jolly
    if n == 1:
        print("Jolly")
        continue

    seq = nums[1:]     # los siguientes n enteros son la secuencia

    # Calculamos el conjunto de diferencias absolutas entre elementos consecutivos
    # Usamos set comprehension para obtener automáticamente valores únicos
    diffs = {abs(seq[i] - seq[i - 1]) for i in range(1, n)}

    # Comparamos con el conjunto esperado {1, 2, ..., n-1}
    # set(range(1, n)) genera exactamente {1, 2, ..., n-1}
    if diffs == set(range(1, n)):
        print("Jolly")
    else:
        print("Not jolly")
```

</details>

<br/>

> You are welcome to share your solution in another programming language
