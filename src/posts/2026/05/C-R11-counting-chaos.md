---
titulo: "CCPL R11 - C. Counting Chaos"
seoTitulo: "Solución de C. Couting Chaos (UVa 11309) | CCPL R11 | Python"
fecha: "2026-05-21"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio C - CCPL R11 2025"
imagenPortada: "https://i.imgur.com/TN5kzeQ.png?w=1000&h=500&fit=crop"
etiquetas: ["CCPL", "UVa", "Precomputation", "Binary Search"]
categoria: "coding"
keywords: "CCPL, UVa 11309, Counting Chaos, tiempos palíndromos, precomputación, búsqueda binaria, Python"
---

# C. Counting Chaos — Ejercicio y Solución

> Problema original: [UVa 11309 - Counting Chaos](https://onlinejudge.org/index.php?option=com_onlinejudge&Itemid=8&page=show_problem&problem=2284) | [Enunciado en PDF](https://onlinejudge.org/external/113/11309.pdf)

Si buscas la solución de **C. Counting Chaos** de **UVa 11309**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 5000 ms | memory limit per test: 256 mB

### Contexto

Wolfgang Puck’s rival, Emeril Lagasse (“BAM!”), recently set the world culinary record in the category of smallest souffl´e measuring in at a mere 2 cm! Wolfgang, not to be outdone, decided that he would set a culinary record of his own: the most symmetric marble cake in the world. This is clearly not an easy feat!

As we all know from Wolfgang’s bestselling biography, he is a very superstitious chef. In his attempts to create the symmetric cake, he has vowed to remove the cake from the oven only at a palindromic time, i.e., a time that reads the same when read from left-to-right as right-to-left. 

Not including the current time, when is the next opportunity for Wolfgang
to remove his cake?

### Input

On the first line of the input you are given n, the number of attempts Wolfgang makes to make his
symmetric cake. The following n lines contain a string formatted as ‘HH:MM’ indicating the current
time on a twenty-four hour clock. (So 0 ≤ HH ≤ 23 and 0 ≤ MM ≤ 59 and ‘00:00’ follows “23:59”).

### Output

For each attempt, output a string indicating the next palindromic time (not including the current time) on a single line formatted as ‘HH:MM’. When determining if HH : MM is palindromic, ignore all
leading zeroes in HH. If HH is zero then ignore all leading zeroes in MM.

### Ejemplo

| INPUT  | 
|--------|
| 3     |
| 00:00 |
| 23:30 |
| 14:59 |

| OUTPUT  | 
|--------|
| 00:01 |
| 23:32 |
| 15:51 |

---

## Resumen rápido

- Solo hay 1440 horarios posibles en un día, así que conviene precalcular los que son palíndromos.
- Guardamos esos horarios en una lista ordenada.
- Para cada consulta, buscamos el primer horario palíndromo estrictamente mayor que el actual.
- Si el horario actual ya es palíndromo, saltamos al siguiente.
- Si no hay uno más adelante, la respuesta vuelve a ser 00:00.

## Idea de la solución

La clave está en que el espacio de búsqueda es muy pequeño: en un día solo existen 24 × 60 = 1440 minutos. Eso permite resolver cada caso de forma muy eficiente con **precomputación + búsqueda binaria**.

La estrategia es:

1. Revisar todos los minutos del día y guardar solo los que forman un horario palíndromo.
2. Mantener esa lista ordenada de forma natural.
3. Para cada hora dada, usar `bisect_left` para encontrar el primer palíndromo que no sea menor que la hora actual.
4. Si el encontrado coincide con la hora de entrada, avanzar uno más porque el problema pide el siguiente horario.
5. Si se agota la lista, el siguiente horario palíndromo es `00:00`.

Con esto, el costo de construir la respuesta es mínimo y cada consulta se resuelve en tiempo logarítmico sobre una lista diminuta.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys
from bisect import bisect_left


# ------------------------------------------------------------
# Verifica si una hora (h:m) es palíndroma.
#
# La lógica es exactamente la misma del código C++ original.
# No se usa el formato "HHMM", sino una construcción manual
# para imitar el comportamiento del autor.
# ------------------------------------------------------------
def is_palindrome(h, m):

    # Guardará la parte invertida
    s_reverse = ""

    # Caso especial cuando la hora es 0
    # Ejemplo:
    # 00:00 -> palíndromo
    # 00:11 -> palíndromo
    if h == 0:

        mm = m

        # Construimos el número invertido de los minutos
        while mm:
            s_reverse += chr(mm % 10 + ord('0'))
            mm //= 10

        # Invertimos nuevamente
        s = s_reverse[::-1]

        return s == s_reverse

    # --------------------------------------------------------
    # Invertimos la hora
    #
    # Ejemplo:
    # 12 -> "21"
    # --------------------------------------------------------
    hh = h

    while hh:
        s_reverse += chr(hh % 10 + ord('0'))
        hh //= 10

    # --------------------------------------------------------
    # Construimos los minutos
    # --------------------------------------------------------
    mm = m
    m_aux = m
    s = ""

    while mm:
        s += chr(mm % 10 + ord('0'))
        mm //= 10

    # Si los minutos tienen un solo dígito,
    # agregamos el 0 faltante.
    #
    # Ejemplo:
    # 5 -> "50"
    if m_aux < 10:
        s += "0"

    # Concatenamos:
    # minutos + hora invertida
    s += s_reverse

    # Verificamos si es palíndromo
    s_reverse = s
    s = s[::-1]

    return s == s_reverse


# ------------------------------------------------------------
# Imprime la hora en formato HH:MM
# ------------------------------------------------------------
def print_time(t):
    h, m = t
    return f"{h:02d}:{m:02d}"


# ------------------------------------------------------------
# Precalculamos TODOS los tiempos palíndromos del día.
#
# Solo existen 24 * 60 = 1440 tiempos posibles,
# así que esto es extremadamente eficiente.
# ------------------------------------------------------------
palindromic_times = []

h = 0
m = 0

while h < 24:

    # Si es palíndromo, lo guardamos
    if is_palindrome(h, m):
        palindromic_times.append((h, m))

    # Avanzamos un minuto
    m += 1

    # Si llegamos a 60 minutos,
    # avanzamos una hora
    if m == 60:
        h += 1
        m = 0


# Lectura rápida
input = sys.stdin.readline

n = int(input())

for _ in range(n):

    # Leemos tiempo HH:MM
    line = input().strip()

    h = int(line[:2])
    m = int(line[3:])

    current_time = (h, m)

    # --------------------------------------------------------
    # Buscamos el primer tiempo palíndromo
    # >= al tiempo actual
    #
    # bisect_left hace búsqueda binaria:
    # complejidad O(log n)
    # --------------------------------------------------------
    i = bisect_left(palindromic_times, current_time)

    # Si el tiempo actual ya es palíndromo,
    # debemos devolver el SIGUIENTE.
    if i < len(palindromic_times) and palindromic_times[i] == current_time:
        i += 1

    # Si no existe siguiente,
    # el próximo es 00:00
    if i == len(palindromic_times):
        print("00:00")
    else:
        print(print_time(palindromic_times[i]))
```
</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys
from bisect import bisect_left

def is_palindrome(h, m):
    s_reverse = ""

    if h == 0:
        mm = m

        while mm:
            s_reverse += chr(mm % 10 + ord('0'))
            mm //= 10

        s = s_reverse[::-1]

        return s == s_reverse

    hh = h

    while hh:
        s_reverse += chr(hh % 10 + ord('0'))
        hh //= 10

    mm = m
    m_aux = m
    s = ""

    while mm:
        s += chr(mm % 10 + ord('0'))
        mm //= 10

    if m_aux < 10:
        s += "0"

    s += s_reverse

    s_reverse = s
    s = s[::-1]

    return s == s_reverse


def print_time(t):
    h, m = t
    return f"{h:02d}:{m:02d}"


palindromic_times = []

h = 0
m = 0

while h < 24:
    if is_palindrome(h, m):
        palindromic_times.append((h, m))

    m += 1

    if m == 60:
        h += 1
        m = 0


input = sys.stdin.readline

n = int(input())

for _ in range(n):
    line = input().strip()

    h = int(line[:2])
    m = int(line[3:])

    time = (h, m)

    i = bisect_left(palindromic_times, time)

    if i < len(palindromic_times) and palindromic_times[i] == time:
        i += 1

    if i == len(palindromic_times):
        print("00:00")
    else:
        print(print_time(palindromic_times[i]))
```
</details>