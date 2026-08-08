---
titulo: "Kattis - Reversed Binary Numbers"
seoTitulo: "Kattis Reversed Binary Numbers — solución en Python: invertir representación binaria"
fecha: "2026-08-09"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Dificultad: 2.0 Fácil"
imagenPortada: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&h=500&fit=crop"
etiquetas: ["Kattis", "Math", "Strings", "Binary"]
categoria: "coding"
keywords: "Kattis reversed binary numbers, invertir representación binaria, binary reversal, programación competitiva, Python, kattis fácil, binario decimal"
---

# Reversed Binary Numbers

> Problema original: [Kattis — Reversed Binary Numbers](https://open.kattis.com/problems/reversebinary)

Si buscas la solución de **Reversed Binary Numbers** de **Kattis**, aquí encontrarás una explicación clara y un código en **Python** para resolver el problema de la forma más eficiente.

> time limit per test: 1 s |
> memory limit per test: 1024 mB

Write a program that takes a decimal integer n, reverses its binary representation and converts the result back to decimal.

### Input

The input contains a single integer n (1 ≤ n ≤ 1,000,000,000).

### Output

Print the decimal value of the binary reversal of n.

### Examples

| Input | Output |
|-------|--------|
| 13    | 11     |
| 4     | 1      |

**Ejemplo 1:** 13 en binario es `1101`. Al invertirlo obtenemos `1011`, que en decimal es **11**.

**Ejemplo 2:** 4 en binario es `100`. Al invertirlo obtenemos `001`, que equivale a `1` en decimal (los ceros a la izquierda no cuentan).

## Observación clave

El problema se reduce a tres pasos:

1. Convertir `n` a su representación binaria (sin el prefijo `0b` de Python).
2. Invertir la cadena de bits.
3. Interpretar la cadena invertida como un número en base 2 y convertirla a decimal.

El único detalle a tener en cuenta es que al invertir, los ceros que estaban al final del número original pasan a ser ceros al inicio de la cadena invertida — ceros a la izquierda que no cambian el valor final. Python maneja esto automáticamente con `int(cadena, 2)`.

### Ejemplo paso a paso

Para `n = 13`:

| Paso | Operación | Resultado |
|------|-----------|-----------|
| 1 | Binario de 13 | `1101` |
| 2 | Invertir cadena | `1011` |
| 3 | `1011` en decimal | `11` |

Para `n = 4`:

| Paso | Operación | Resultado |
|------|-----------|-----------|
| 1 | Binario de 4 | `100` |
| 2 | Invertir cadena | `001` |
| 3 | `001` en decimal | `1` |

### ¿Por qué `int('001', 2) == 1`?

Cuando Python convierte una cadena binaria a entero, ignora los ceros a la izquierda, igual que al escribir `007` en decimal — el valor sigue siendo 7. Esto resuelve el caso borde de forma natural sin ningún tratamiento especial.

### Complejidad

- **Tiempo**: O(log n) — el número de bits de `n` es `floor(log₂(n)) + 1`, y todas las operaciones (conversión, inversión, re-conversión) son lineales en ese número de bits.
- **Espacio**: O(log n) — para almacenar la cadena de bits.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>Python3 / Python2 / PyPy / ... (Sin comentarios)</summary>

```python
n = int(input())
print(int(bin(n)[2:][::-1], 2))
```

</details>

<details>
<summary>Python3 / Python2 / PyPy / ... (Con comentarios)</summary>

```python
n = int(input())

# bin(n) devuelve una cadena como '0b1101'; con [2:] eliminamos el prefijo '0b'
binary_str = bin(n)[2:]

# Invertimos la cadena de bits: '1101' -> '1011'
reversed_str = binary_str[::-1]

# int(cadena, 2) interpreta la cadena como número en base 2 y lo convierte a decimal.
# Los ceros a la izquierda ('001' -> 1) se manejan automáticamente.
print(int(reversed_str, 2))
```

</details>

<br/>

> You are welcome to share your solution in another programming language
