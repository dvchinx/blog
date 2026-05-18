---
titulo: "CCPL R4 - B. Bytelandian Gold Coins"
fecha: "2026-05-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio B - CCPL R4 2026"
imagenPortada: "https://i.imgur.com/TZe28SI.png?w=1000&h=500&fit=crop"
etiquetas: ["CCPL"]
categoria: "coding"
keywords: "CCPL, Codeforces, Algoritmos, Programación competitiva, Bytelandian Gold Coins"
---

# B. Bytelandian Gold Coins

> time limit per test: 500 ms

> memory limit per test: 256 mB

In Byteland they have a very strange monetary system.

Each Bytelandian gold coin has an integer number written on it. A coin n can be exchanged in a bank into three coins: n/2, n/3 and n/4. But these numbers are all rounded down (the banks have to make a profit).

You can also sell Bytelandian coins for American dollars. The exchange rate is 1:1. But you can not buy Bytelandian coins.

You have one gold coin. What is the maximum amount of American dollars you can get for it?

### Input

The input will contain several test cases (not more than 10). Each test case is a single line with a number n, 0 ≤ n ≤ 1 000 000 000. It is the number written on your coin.


### Output
For each test case output a single line, containing the maximum amount of American dollars you can make.

### Example             

| Input  | 
|--------|
| 12     |
| 2      | 

| Output |
|--------|
| 13     | 
| 2      |

You can change 12 into 6, 4 and 3, and then change these into $6+$4+$3 = $13. If you try changing the coin 2 into 3 smaller coins, you will get 1, 0 and 0, and later you can get no more than $1 out of them. It is better just to change the 2 coin directly into $2.

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```python
# O(ammount of unique states).

import sys

# Dictionary to store already computed results
memo = {0: 0}


def max_dollars(n):
    # If it has already been computed, return it directly
    if n in memo:
        return memo[n]

    # Best option:
    # keep the coin or exchange it
    memo[n] = max(
        n,
        max_dollars(n // 2) +
        max_dollars(n // 3) +
        max_dollars(n // 4)
    )

    return memo[n]


# Read all test cases until EOF
for line in sys.stdin:
    n = int(line.strip())
    print(max_dollars(n))
```

</details>

<br/>

>  You are welcome to share your solution in another programming language