---
titulo: "71A - Way too long words"
fecha: "2026-02-15"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces Beta Round 65 (Div 2)"
imagenPortada: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=500&fit=crop"
etiquetas: ["CodeForces", "800 elo"]
categoria: "coding"
---

# A. Way too long words

> time limit per test: 1 second

> memory limit per test: 256 megabytes

Sometimes some words like "localization" or "internationalization" are so long that writing them many times in one text is quite tiresome.

Let's consider a word too long, if its length is strictly more than 10 characters. All too long words should be replaced with a special abbreviation.

This abbreviation is made like this: we write down the first and the last letter of a word and between them we write the number of letters between the first and the last letters. That number is in decimal system and doesn't contain any leading zeroes.

Thus, "localization" will be spelt as "l10n", and "internationalization» will be spelt as "i18n".

You are suggested to automatize the process of changing the words with abbreviations. At that all too long words should be replaced by the abbreviation and the words that are not too long should not undergo any changes.

### Input

The first line contains an integer n (1 ≤ n ≤ 100). Each of the following n lines contains one word. All the words consist of lowercase Latin letters and possess the lengths of from 1 to 100 characters.

### Output
Print n lines. The i-th line should contain the result of replacing of the i-th word from the input data.

| Input                 |
|-----------------------|
| 4                     | 
| word                  |   
| localization          |      
| internationalization  |
| pneumonoultramicroscopicsilicovolcanoconiosis |

| Output  |
|---------|
| word    | 
| l10n    |   
| i18n    |      
| p43s    |

### Solution

Try to solve it on your own before looking at the solution.

<details>
<summary>Python3 / Python2 / PyPy / ...</summary>

```
n = int(input())
outp = []
 
while(n>0):
    entry = str(input())
    lenEntry = len(entry)
    if len(entry) >= 11:
        outp.append(entry[0] + str(lenEntry-2) + entry[lenEntry-1])
    else:
        outp.append(entry)
    n-=1
 
for x in outp:
    print(x)
```

</details>

<br/>

>  You are welcome to share your solution in another programming language