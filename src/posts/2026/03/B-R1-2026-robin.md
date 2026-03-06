---
titulo: "B - Round Robin Scheduling"
fecha: "2026-03-06"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Ejercicio B - CCPL R1 2026"
imagenPortada: "https://i.imgur.com/xrcKuDA.png?w=800&h=500&fit=crop"
etiquetas: ["CCPL"]
categoria: "coding"
---

# B. Round Robin Scheduling

> time limit per test: 305 ms

> memory limit per test: 1572864 kB

A computer processor is given N tasks to perform (1 ≤ N ≤ 50,000). The i-th task requires
Ti seconds of processing time (1 ≤ Ti ≤ 1,000,000,000). The processor runs the tasks as
follows: each task is run in order, from 1 to N, for 1 second, and then the processor repeats
this again starting from task 1. Once a task has been completed, it will not be run in later
iterations. Determine, for each task, the total running time elapsed once the task has been
completed.


### Input

The first line of the input contains the integer N, and the next N lines contain the integers
T1 through TN.


### Output
Output N lines, the i-th of which contains an integer representing the time elapsed when
task i has been processed.

### Example

#### Input                 

```
5
8
1
3
3
8
```

#### Output  
```
22
2
11
12
23
```

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
n = int(input())
tasks = []
for i in range(n):
    tasks.append(int(input()))

# Create list of (time_needed, original_index)
indexed_tasks = [(tasks[i], i) for i in range(n)]
indexed_tasks.sort()

completion_time = [0] * n
elapsed_time = 0
prev_rounds = 0
i = 0

while i < n:
    time_needed = indexed_tasks[i][0]
    
    # Get all active tasks' original indices, sorted
    active_tasks_original = sorted([indexed_tasks[k][1] for k in range(i, n)])
    num_active = len(active_tasks_original)
    
    # Number of additional rounds this batch needs
    rounds_for_this_batch = time_needed - prev_rounds
    
    # Add time for complete rounds before the final round
    elapsed_time += (rounds_for_this_batch - 1) * num_active
    
    # Find all tasks that complete at this time
    batch_indices = []
    j = i
    while j < n and indexed_tasks[j][0] == time_needed:
        batch_indices.append(indexed_tasks[j][1])
        j += 1
    
    # Assign completion times based on position in the current round
    for orig_idx in batch_indices:
        position = active_tasks_original.index(orig_idx)
        completion_time[orig_idx] = elapsed_time + position + 1
    
    # Update elapsed time after processing this round
    elapsed_time += num_active
    prev_rounds = time_needed
    i = j

for time in completion_time:
    print(time)

```

</details>

<br/>

>  You are welcome to share your solution in another programming language