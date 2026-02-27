---
titulo: "282A - Bit++"
fecha: "2026-02-24"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 173 (Div 2)"
imagenPortada: "https://i.imgur.com/V41Ezdq.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo"]
categoria: "coding"
---

# A. Bit++

> time limit per test: 1 second

> memory limit per test: 256 megabytes

The classic programming language of Bitland is Bit++. This language is so peculiar and complicated.

The language is that peculiar as it has exactly one variable, called x. Also, there are two operations:

* Operation ++ increases the value of variable x by 1.
* Operation -- decreases the value of variable x by 1.

A statement in language Bit++ is a sequence, consisting of exactly one operation and one variable x. The statement is written without spaces, that is, it can only contain characters "+", "-", "X". Executing a statement means applying the operation it contains.

A programme in Bit++ is a sequence of statements, each of them needs to be executed. Executing a programme means executing all the statements it contains.

You're given a programme in language Bit++. The initial value of x is 0. Execute the programme and find its final value (the value of the variable when this programme is executed).

### Input

The first line contains a single integer n (1 ≤ n ≤ 150) — the number of statements in the programme.

Next n lines contain a statement each. Each statement contains exactly one operation (++ or --) and exactly one variable x (denoted as letter «X»). Thus, there are no empty statements. The operation and the variable can be written in any order.

### Output
Print a single integer — the final value of x.

### Example 1

| Input                 |
|-----------------------|
| 1                     | 
| ++X                   |   

| Output  |
|---------|
| 1       |

### Example 2

| Input                 |
|-----------------------|
| 2                     | 
| X++                   |
| --X                   |

| Output  |
|---------|
| 0       |

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
# Leer número de instrucciones
n = int(input().strip())

# Valor inicial
x = 0

# Procesar cada instrucción
for _ in range(n):
    statement = input().strip()
    if "++" in statement:
        x += 1
    else:
        x -= 1

# Imprimir resultado final
print(x)
```

</details>

<br/>

>  You are welcome to share your solution in another programming language