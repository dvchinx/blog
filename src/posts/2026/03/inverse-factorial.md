---
titulo: "Inverse Factorial"
fecha: "2026-03-23"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "CCPL R2 2026 (Kattis)"
imagenPortada: "https://i.imgur.com/GBn69X9.png?w=800&h=500&fit=crop"
etiquetas: ["CCPL", "Kattis"]
categoria: "coding"
---

# Inverse Factorial

> time limit per test: 1 s

> memory limit per test: 1024 mB

A factorial n! of a positive integer n is defined as the product of
all positive integers smaller than or equal to n. For example,

21! = 1 ⋅ 2 ⋅ 3 ⋅ … ⋅ 21 = 51 090 942 171 709 440 000.

It is straightforward to calculate the factorial of a small integer,
and you have probably done it many times before. In this
problem, however, your task is reversed. You are given the value
of n! and you have to find the value of .

### Input

The input contains the factorial n! of a positive integer n. The number 
of digits of n! is at most 10^6.

### Output
The value of n

### Example 1

#### Input                 

```
120
```

#### Output  
```
5
```

### Example 2

#### Input                 

```
51090942171709440000
```

#### Output  
```
22
```

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
import math
import sys

SMALL_FACTORIALS = { "1": 1, "2": 2, "6": 3, "24": 4,
    "120": 5, "720": 6, "5040": 7, "40320": 8,}

def inverse_factorial(value_str: str) -> int:
    if value_str in SMALL_FACTORIALS:
        return SMALL_FACTORIALS[value_str]

    target_digits = len(value_str)
    n = 1
    log_sum = 0.0

    while int(log_sum) + 1 < target_digits:
        n += 1
        log_sum += math.log10(n)

    return n

for line in sys.stdin:
    entry = line.strip()
    if not entry:
        continue

    if not entry.isdigit():
        continue

    print(inverse_factorial(entry))
```

</details>

<br/>

>  You are welcome to share your solution in another programming language