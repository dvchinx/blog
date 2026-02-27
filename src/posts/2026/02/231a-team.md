---
titulo: "231A - Team"
fecha: "2026-02-20"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Round 143 (Div 2)"
imagenPortada: "https://i.imgur.com/IIWAVGY.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo"]
categoria: "coding"
---

# A. Team

> time limit per test: 2 second

> memory limit per test: 256 megabytes

One day three best friends Petya, Vasya and Tonya decided to form a team and take part in programming contests. Participants are usually offered several problems during programming contests. Long before the start the friends decided that they will implement a problem if at least two of them are sure about the solution. Otherwise, the friends won't write the problem's solution.

This contest offers n problems to the participants. For each problem we know, which friend is sure about the solution. Help the friends find the number of problems for which they will write a solution.

### Input

The first input line contains a single integer n (1 ≤ n ≤ 1000) — the number of problems in the contest. Then n lines contain three integers each, each integer is either 0 or 1. If the first number in the line equals 1, then Petya is sure about the problem's solution, otherwise he isn't sure. The second number shows Vasya's view on the solution, the third number shows Tonya's view. The numbers on the lines are separated by spaces.

### Output
Print a single integer — the number of problems the friends will implement on the contest.

### Example 1

| Input                 |
|-----------------------|
| 3                     | 
| 1 1 0                 |   
| 1 1 1                 |      
| 1 0 0                 |

| Output  |
|---------|
| 2       |

### Example 2

| Input                 |
|-----------------------|
| 2                     | 
| 1 0 0                 |   
| 0 1 1                 |      

| Output  |
|---------|
| 1       |

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
import sys

input = sys.stdin.readline

n = int(input())
count = 0

for _ in range(n):
    if sum(map(int, input().split())) >= 2:
        count += 1

print(count)
```

</details>

<br/>

>  You are welcome to share your solution in another programming language