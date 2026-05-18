---
titulo: "CCPL R11 - A. Document Analyzer"
seoTitulo: "Solución de A. Document Analyzer (UVa 11860) | CCPL R11 | Python"
fecha: "2026-05-18"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio A - CCPL R11 2025"
imagenPortada: "https://i.imgur.com/OEH9VDX.png?w=1000&h=500&fit=crop"
etiquetas: ["CCPL", "UVa", "Sliding Window"]
categoria: "coding"
keywords: "CCPL, UVa, Algoritmos, Sliding Window, Ventana deslizante, Document Analyzer"
---

# A. Document Analyzer — Ejercicio y Solución

> Problema original: [UVa 11860 - Document Analyzer](https://onlinejudge.org/index.php?option=com_onlinejudge&Itemid=8&page=show_problem&problem=2960) | [Enunciado en PDF](https://onlinejudge.org/external/118/11860.pdf) 

Si buscas la solución de **A. Document Analyzer** de **UVa 11860**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 5000 ms | memory limit per test: 256 mB

### Contexto

Trabajas en una empresa líder en desarrollo de software. Como eres un excelente programador, la mayoría de las tareas críticas se te asignan. Te gustan los retos y te entusiasma resolverlos.

Recientemente, tu empresa está desarrollando un proyecto llamado Analizador de Documentos. En este proyecto, te han asignado una tarea, por supuesto, crítica. La tarea consiste en analizar un documento que contiene letras minúsculas, números y signos de puntuación. Debes separar las palabras. Las palabras son secuencias consecutivas de letras minúsculas.

Después de listar las palabras, en el mismo orden en que aparecen en el documento, debes numerarlas del 1 al n. Luego, debes encontrar el rango p y q (p ≤ q) tal que todos los tipos de palabras se encuentren entre p y q (inclusive). Si hay varias soluciones, debes encontrar aquella donde la diferencia entre p y q sea mínima. Si aún así hay un empate, debes encontrar la solución donde p sea mínimo.

Dado que tienes otras tareas pendientes, debes resolver esta en un plazo de 5 horas.

### Input

La primera línea de entrada contendrá T (≤ 20), que indica el número de documentos.

Cada documento estará representado por una o más líneas, cada una con un máximo de 150 caracteres. Un documento contendrá letras minúsculas, números o signos de puntuación. La última línea contendrá la palabra «END», que, por supuesto, no forma parte del documento. Se puede asumir que un documento contendrá entre 1 y 10⁵ palabras (inclusive).

### Output

Para cada documento, imprima primero el número de documento. A continuación, imprima las letras p y q como se describe anteriormente. Para ver el formato exacto, consulte los ejemplos.

### Ejemplo

| INPUT  | 
|--------|
| 3     |
| 1. a case is a case |
| 2. case is not a case~ | 
| END | 
| a b c d e |
| END |
| a@#$a^%a a a |
| b b----b b++12b | 
| END |

| OUTPUT |
|--------|
| Document 1: 6 9 | 
| Document 2: 1 5 | 
| Document 3: 5 6 |

---

## Resumen rápido

- Extraemos solo las palabras formadas por letras minúsculas.
- Asignamos un identificador a cada palabra distinta.
- Aplicamos una ventana deslizante para encontrar el tramo mínimo que contiene todas las palabras únicas.
- Elegimos el intervalo más corto; si hay empate, el de menor posición inicial.

## Idea de la solución

El objetivo es encontrar el intervalo mínimo de palabras consecutivas que contenga todas las palabras distintas del documento. Ese patrón encaja perfectamente con la técnica de **two pointers** o **sliding window**.

La estrategia es:

1. Leer todo el documento y separar las palabras con una expresión regular.
2. Comprimir cada palabra a un entero para contar más rápido.
3. Mover el extremo derecho de la ventana hasta cubrir todas las palabras distintas.
4. Reducir el extremo izquierdo mientras la ventana siga siendo válida.
5. Guardar la mejor ventana encontrada.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys
import re
from collections import defaultdict

# Lectura rápida de entrada
input = sys.stdin.readline

# Regex precompilado:
# Extrae únicamente secuencias de letras minúsculas [a-z]
# Esto evita recompilar el patrón muchas veces.
pattern = re.compile(r"[a-z]+")

# Número de casos
t = int(input())

for tc in range(1, t + 1):

    # Aquí almacenaremos todas las palabras del documento
    words = []

    # Leemos líneas hasta encontrar END
    while True:
        line = input().rstrip('\n')

        if line == "END":
            break

        # Extraemos todas las palabras válidas de la línea
        # y las agregamos al arreglo principal
        words.extend(pattern.findall(line))

    # ---------------------------------------------------------
    # COMPRESIÓN DE PALABRAS A IDs ENTEROS
    # ---------------------------------------------------------
    #
    # En vez de trabajar con strings durante todo el algoritmo,
    # convertimos cada palabra distinta a un entero.
    #
    # Esto reduce:
    # - uso de memoria
    # - costo de comparaciones
    # - tiempo del sliding window
    #
    # Ejemplo:
    # "hola" -> 0
    # "mundo" -> 1
    # "python" -> 2
    #
    # arr contendrá la secuencia de IDs.
    # ---------------------------------------------------------

    ids = {}
    arr = []

    for w in words:
        if w not in ids:
            ids[w] = len(ids)

        arr.append(ids[w])

    # Cantidad total de palabras distintas
    total = len(ids)

    # ---------------------------------------------------------
    # SLIDING WINDOW / TWO POINTERS
    # ---------------------------------------------------------
    #
    # Queremos encontrar el subarreglo mínimo que contenga
    # TODAS las palabras distintas del documento.
    #
    # left  -> inicio de ventana
    # right -> fin de ventana
    #
    # freq[x] = frecuencia del ID x dentro de la ventana actual
    #
    # formed = cantidad de palabras distintas presentes
    #          actualmente en la ventana
    # ---------------------------------------------------------

    freq = defaultdict(int)

    formed = 0
    left = 0

    # Inicialmente la mejor respuesta es todo el arreglo
    best_l = 0
    best_r = len(arr) - 1

    # Expandimos la ventana moviendo right
    for right, x in enumerate(arr):

        freq[x] += 1

        # Si apareció por primera vez en la ventana,
        # incrementamos formed
        if freq[x] == 1:
            formed += 1

        # -----------------------------------------------------
        # Si ya tenemos todas las palabras distintas,
        # intentamos ACHICAR la ventana desde la izquierda.
        #
        # Esta es la parte clave de la optimización:
        #
        # Cada puntero se mueve como máximo N veces,
        # por lo que la complejidad total es O(N).
        # -----------------------------------------------------

        while formed == total:

            # Actualizamos mejor respuesta si esta ventana
            # es más pequeña
            if right - left < best_r - best_l:
                best_l = left
                best_r = right

            # Quitamos elemento izquierdo
            y = arr[left]
            freq[y] -= 1

            # Si una palabra desaparece completamente
            # de la ventana, dejamos de tener solución válida
            if freq[y] == 0:
                formed -= 1

            left += 1

    # El problema usa índices desde 1
    print(f"Document {tc}: {best_l + 1} {best_r + 1}")
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys
import re
from collections import defaultdict

input = sys.stdin.readline
pattern = re.compile(r"[a-z]+")

t = int(input())

for tc in range(1, t + 1):

    words = []

    while True:
        line = input().rstrip('\n')

        if line == "END":
            break

        words.extend(pattern.findall(line))

    ids = {}; arr = []

    for w in words:
        if w not in ids:
            ids[w] = len(ids)

        arr.append(ids[w])

    total = len(ids)

    freq = defaultdict(int)
    formed = 0; left = 0
    best_l = 0; best_r = len(arr) - 1

    for right, x in enumerate(arr):

        freq[x] += 1

        if freq[x] == 1:
            formed += 1

        while formed == total:

            if right - left < best_r - best_l:
                best_l = left
                best_r = right

            y = arr[left]
            freq[y] -= 1

            if freq[y] == 0:
                formed -= 1

            left += 1

    print(f"Document {tc}: {best_l + 1} {best_r + 1}")
```
</details>