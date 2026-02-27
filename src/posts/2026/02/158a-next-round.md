---
titulo: "158A - Next Round"
fecha: "2026-02-27"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "VK Cup 2012 Qualification Round 1"
imagenPortada: "https://i.imgur.com/PYYiXRA.png?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo"]
categoria: "coding"
---

# A. Next Round

> time limit per test: 3 second

> memory limit per test: 256 megabytes

"Contestant who earns a score equal to or greater than the k-th place finisher's score will advance to the next round, as long as the contestant earns a positive score..." — an excerpt from contest rules.

A total of n participants took part in the contest (n ≥ k), and you already know their scores. Calculate how many participants will advance to the next round.

### Input

The first line of the input contains two integers n and k (1 ≤ k ≤ n ≤ 50) separated by a single space.

The second line contains n space-separated integers a1, a2, ..., an (0 ≤ ai ≤ 100), where ai is the score earned by the participant who got the i-th place. The given sequence is non-increasing (that is, for all i from 1 to n - 1 the following condition is fulfilled: ai ≥ ai + 1).

### Output
Output the number of participants who advance to the next round.

### Example 1

| Input                 |
|-----------------------|
| 8 5                   | 
| 10 9 8 7 7 7 5 5      |   

| Output  |
|---------|
| 6       |

### Example 2

| Input                 |
|-----------------------|
| 4 2                   | 
| 0 0 0 0               |   

| Output  |
|---------|
| 0       |

### Note

In the first example the participant on the 5th place earned 7 points. As the participant on the 6th place also earned 7 points, there are 6 advancers.

In the second example nobody got a positive score.

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
# Leer n (participantes) y k (posición límite)
n, k = map(int, input().split())
    
# Leer las puntuaciones como una lista de enteros
scores = list(map(int, input().split()))
    
# Obtener la puntuación del k-ésimo participante (índice k-1 porque las listas empiezan en 0)
kth_score = scores[k - 1]
    
advancers = 0
    
# Contar cuántos avanzan
for score in scores:
    # Deben tener un puntaje positivo y al menos igual al k-ésimo lugar
    if score > 0 and score >= kth_score:
        advancers += 1
    else:
        # Como la lista ya está ordenada de forma no creciente, 
        # si uno no cumple, los demás tampoco lo harán
        break
            
print(advancers)
```

</details>

<br/>

>  You are welcome to share your solution in another programming language