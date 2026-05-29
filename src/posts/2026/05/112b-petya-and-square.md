---
titulo: "Codeforces 112B - Petya and Square"
seoTitulo: "Solución de 112B. Petya and Square (CodeForces) en Python"
fecha: "2026-05-25"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Beta Round 85 (Div 2 Only)"
imagenPortada: "https://i.imgur.com/AHkk8Dq.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "1200 elo", "Matemáticas", "Implementación"]
categoria: "coding"
keywords: "Codeforces, Petya, 112B CodeForces, Algoritmos, Programación competitiva, Square, Resolución de problemas"
---

# B. Petya and Square

> time limit per test: 2 second

> memory limit per test: 256 megabytes

Little Petya loves playing with squares. Mum bought him a square 2n × 2n in size. Petya marked a cell inside the square and now he is solving the following task.

The task is to draw a broken line that would go along the grid lines and that would cut the square into two equal parts. The cutting line should not have any common points with the marked cell and the resulting two parts should be equal up to rotation.

Petya wants to determine whether it is possible to cut the square in the required manner given the sizes of the square side and the coordinates of the marked cell. Help him.

### Input

The first line contains three space-separated integers 2n, x and y (2 ≤ 2n ≤ 100, 1 ≤ x, y ≤ 2n), representing the length of a square's side and the coordinates of the marked cell. It is guaranteed that 2n is even.

The coordinates of the marked cell are represented by a pair of numbers x y, where x represents the number of the row and y represents the number of the column. The rows and columns are numbered by consecutive integers from 1 to 2n. The rows are numbered from top to bottom and the columns are numbered from the left to the right.

### Output
If the square is possible to cut, print "YES", otherwise print "NO" (without the quotes).

### Example 1

| Input   |
|---------|
| 4 1 1   |

| Output  |
|---------|
| YES     |

### Example 2

| Input   |
|---------|
| 2 2 2   |

| Output  |
|---------|
| NO      |

## Resumen rápido

Dado un tablero de **2n × 2n**, determina si se puede trazar una línea de corte —siguiendo las líneas de la cuadrícula— que divida el tablero en dos partes iguales por rotación, **sin tocar** la celda marcada.

La respuesta es **NO** únicamente si la celda marcada coincide con una de las **4 celdas centrales** del tablero. En cualquier otro caso la respuesta es **YES**.

## Idea de la solución

Todo tablero par de tamaño **2n × 2n** tiene exactamente un centro compuesto por un bloque de 2 × 2 celdas. Cualquier línea de corte válida (que produzca dos mitades iguales bajo rotación de 180°) **debe cruzar obligatoriamente ese bloque central**.

Por lo tanto:

- Si la celda marcada **está** dentro del bloque central → es **imposible** trazar la línea sin tocarla → **NO**.
- Si la celda marcada **está fuera** del bloque central → siempre existe al menos un camino de corte que la evita → **YES**.

El bloque central ocupa las celdas `(c, c)`, `(c, c+1)`, `(c+1, c)` y `(c+1, c+1)`, donde `c = n // 2` (la mitad del lado del tablero).

### Solucion

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
n, x, y = map(int, input().split())

c = n // 2

if (x == c or x == c + 1) and (y == c or y == c + 1):
    print("NO")
else:
    print("YES")
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
# Leer entrada:
# n -> tamaño total del tablero
# x, y -> coordenadas de la celda marcada
n, x, y = map(int, input().split())

# Obtener la posición central.
# Como el tablero tiene tamaño par, existen 4 celdas centrales.
c = n // 2

# Verificar si la celda marcada está dentro
# del bloque central de 2x2.
#
# Las celdas prohibidas son:
# (c, c)
# (c, c+1)
# (c+1, c)
# (c+1, c+1)
if (x == c or x == c + 1) and (y == c or y == c + 1):
    print("NO")
else:
    # En cualquier otra posición sí es posible
    # construir el cuadrado correctamente.
    print("YES")
```
</details>