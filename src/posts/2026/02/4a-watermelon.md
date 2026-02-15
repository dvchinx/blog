---
titulo: "4A - Watermelon"
fecha: "2026-02-13"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Beta Round 4 (Div. 2 Only)"
imagenPortada: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo"]
categoria: "coding"
---

# A. Watermelon

> time limit per test: 1 second

> memory limit per test: 64 megabytes

One hot summer day Pete and his friend Billy decided to buy a watermelon. They chose the biggest and the ripest one, in their opinion. After that the watermelon was weighed, and the scales showed w kilos. They rushed home, dying of thirst, and decided to divide the berry, however they faced a hard problem.

Pete and Billy are great fans of even numbers, that's why they want to divide the watermelon in such a way that each of the two parts weighs even number of kilos, at the same time it is not obligatory that the parts are equal. The boys are extremely tired and want to start their meal as soon as possible, that's why you should help them and find out, if they can divide the watermelon in the way they want. For sure, each of them should get a part of positive weight.

### Input

The first (and the only) input line contains integer number w (1 ≤ w ≤ 100) — the weight of the watermelon bought by the boys.

### Output
Print YES, if the boys can divide the watermelon into two parts, each of them weighing even number of kilos; and NO in the opposite case.

| Input  | Output |
|--------|--------|
| 8      | YES    |
| 0      | NO     |
| 9      | NO     |

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
w = int(input().strip())

# La sandía puede dividirse en dos partes pares y positivas
if w > 2 and w % 2 == 0:
    print("YES")
else:
    print("NO")
```

</details>

<br/>

>  You are welcome to share your solution in another programming language