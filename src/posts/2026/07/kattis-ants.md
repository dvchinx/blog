---
titulo: "Kattis - Ants"
seoTitulo: "Kattis Ants — solución en Python: el truco de las hormigas que se atraviesan"
fecha: "2026-07-31"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Dificultad: 2.1 Fácil"
imagenPortada: "https://i.imgur.com/v3rMluG.png?w=800&h=600&fit=crop"
etiquetas: ["Kattis", "Greedy", "Math"]
categoria: "coding"
keywords: "Kattis ants, hormigas poste, minimum maximum time ants, ants pole problem, programación competitiva, Python, greedy, truco hormigasa"
---

# Ants

> Problema original: [Kattis — Ants](https://open.kattis.com/problems/ants)

Si buscas la solución de **Ants** de **Kattis**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 s |
> memory limit per test: 1024 mB

N ants are walking on a pole of length L cm. Each ant walks at exactly 1 cm/s. When two ants meet, they reverse direction (they are so tiny that we can think of them as points). When an ant reaches either end of the pole, it falls off.

Given the initial positions of the ants on the pole (but **not** their directions), find the minimum and maximum time it takes for all ants to fall off the pole.

### Input

The first line of input contains the number of test cases t (1 ≤ t ≤ 10). Each test case starts with a line containing L (1 ≤ L ≤ 1,000,000), the length of the pole. The next line contains n (0 ≤ n ≤ 100,000), the number of ants. The following n lines each contain an integer p (0 ≤ p ≤ L), the position of an ant on the pole.

### Output

For each test case, output a single line with two integers: the minimum and maximum time (in seconds) until all ants have fallen off the pole.

### Example

| Input | Output |
|-------|--------|
| 2 | 4 8 |
| 10 3 | 38 207 |
| 2 6 7
| 214 7
| 11 12 7 13
| 176 23 191

## Observación clave

Si dos hormigas chocan y se dan la vuelta, es **matemáticamente equivalente** a que se atraviesan entre sí. Las posiciones que ocupan las hormigas en cualquier instante `t` son exactamente las mismas bajo ambas interpretaciones. Por tanto, podemos ignorar las colisiones y tratar cada hormiga como si se moviera independientemente en línea recta hasta caer del poste.

Lo único que desconocemos es la **dirección inicial** de cada hormiga. Dependiendo de la dirección asignada, una hormiga en la posición `p` cae en tiempo `p` (si va a la izquierda) o en tiempo `L − p` (si va a la derecha).

- **Tiempo mínimo**: queremos que la última hormiga caiga lo antes posible. La mejor estrategia es enviar cada hormiga hacia su extremo más cercano. El tiempo de caída de cada hormiga es `min(p, L − p)`, y la respuesta es el máximo de estos valores.
- **Tiempo máximo**: queremos que la última hormiga tarde lo más posible. Enviamos cada hormiga hacia su extremo más lejano. El tiempo de caída es `max(p, L − p)`, y la respuesta es el máximo.

### Complejidad

- **Tiempo**: O(n) por caso de prueba.
- **Espacio**: O(1) extra.

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
import sys

data = sys.stdin.buffer.read().split()
idx = 0
t = int(data[idx]); idx += 1
out = []
for _ in range(t):
    l = int(data[idx]); n = int(data[idx+1]); idx += 2
    positions = data[idx:idx+n]
    idx += n
    earliest = 0
    latest = 0
    for p_bytes in positions:
        p = int(p_bytes)
        near = p if p < l - p else l - p
        far = l - p if p < l - p else p
        if near > earliest:
            earliest = near
        if far > latest:
            latest = far
    out.append(f"{earliest} {latest}")
print("\n".join(out))
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
import sys

# Leemos toda la entrada de una vez y la dividimos en tokens (más rápido que input() en bucles grandes)
data = sys.stdin.buffer.read().split()
idx = 0  # puntero para recorrer los tokens

# Primer token: número de casos de prueba
t = int(data[idx]); idx += 1

out = []  # aquí acumulamos las líneas de salida

for _ in range(t):
    # Leemos la longitud del poste (l) y el número de hormigas (n)
    l = int(data[idx]); n = int(data[idx + 1]); idx += 2

    # Tomamos los siguientes n tokens: las posiciones de las hormigas
    positions = data[idx:idx + n]
    idx += n

    earliest = 0  # tiempo mínimo para que TODAS caigan (peor caso entre las mejores direcciones)
    latest = 0    # tiempo máximo para que TODAS caigan (peor caso entre las peores direcciones)

    for p_bytes in positions:
        p = int(p_bytes)  # posición de la hormiga actual

        # Distancia al extremo más cercano y al más lejano
        # (equivalente a: near = min(p, l-p), far = max(p, l-p))
        near = p if p < l - p else l - p
        far = l - p if p < l - p else p

        # El tiempo "earliest" total es el máximo de los tiempos mínimos individuales,
        # porque el proceso termina solo cuando la ÚLTIMA hormiga cae
        if near > earliest:
            earliest = near

        # El tiempo "latest" total es el máximo de los tiempos máximos individuales
        if far > latest:
            latest = far

    # Guardamos el resultado de este caso como texto
    out.append(f"{earliest} {latest}")

# Imprimimos todos los resultados al final (mejor rendimiento que print() en cada iteración)
print("\n".join(out))
```

</details>

<br/>

> You are welcome to share your solution in another programming language
