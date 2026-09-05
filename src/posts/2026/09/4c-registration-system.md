---
titulo: "Codeforces 4C - Registration System"
seoTitulo: "Codeforces 4C Registration System — solución en C++: detectar usuarios duplicados con hash map"
fecha: "2026-09-05"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Dificultad: 1300 Media"
imagenPortada: "https://i.imgur.com/szwOx0d.png?w=800&h=500&fit=crop"
etiquetas: ["Codeforces", "HashMap", "Strings", "Implementation"]
categoria: "coding"
keywords: "Codeforces 4C, registration system, solución C++, sistema de registro, diccionario, hash map, nombres de usuario duplicados, programación competitiva"
---

# Registration System

> Problema original: [Codeforces 4C — Registration System](https://codeforces.com/problemset/problem/4/C)

Si buscas la solución de **Registration System** de **Codeforces**, aquí encontrarás una explicación clara y un código en **C++** para resolver el problema de la forma más eficiente.

> time limit per test: 5 s |
> memory limit per test: 64 mB

Un sistema de registro recibe n solicitudes de nombres de usuario. Las reglas son simples:

- Si el nombre **no ha sido registrado antes**, se acepta tal como está → imprimir `OK`.
- Si el nombre **ya fue registrado**, se rechaza y se asigna automáticamente el sufijo numérico correspondiente: `nombre1`, `nombre2`, `nombre3`... donde el número indica cuántas veces ese nombre base ya había aparecido.

### Input

La primera línea contiene un entero n (1 ≤ n ≤ 10^5). Las siguientes n líneas contienen una cadena de entre 1 y 32 caracteres (solo letras minúsculas del inglés).

### Output

Para cada solicitud, imprime en una línea `OK` si el nombre fue aceptado, o `nombre<k>` si era un duplicado, donde k es el número de veces que ese nombre base ya había aparecido antes.

### Examples

| Input | Output |
|-------|--------|
| 4 | OK |
| abacaba | OK |
| acaba | abacaba1 |
| abacaba | OK |
| acab | |

**Ejemplo:** `"abacaba"` aparece por primera vez → `OK`. `"acaba"` es nuevo → `OK`. `"abacaba"` aparece por segunda vez → `abacaba1` (ya había 1 registro previo). `"acab"` es nuevo → `OK`.

## Observación clave

El problema se reduce a mantener un **conteo** de cuántas veces ha aparecido cada nombre hasta el momento actual.

- Si el conteo es 0 (primera aparición): imprimir `OK` y registrar `conteo = 1`.
- Si el conteo es k ≥ 1: imprimir `nombre + str(k)` y actualizar `conteo = k + 1`.

La estructura ideal es un `unordered_map<string, int>` (hash map): las operaciones de consulta y actualización son O(1) amortizado, lo que nos permite manejar n = 10^5 solicitudes sin problemas.

### Caso borde: el sufijo no genera ambigüedad

Los nombres solo contienen letras minúsculas, por lo que un nombre original nunca puede terminar en dígitos. Esto significa que `"abacaba1"` siempre es inequívocamente el primer duplicado de `"abacaba"`, nunca un nombre original con ese formato.

### Ejemplo paso a paso

Para la entrada `abacaba, acaba, abacaba, acab`:

| Paso | Nombre | Estado del conteo | Salida | Conteo actualizado |
|------|--------|--------------------|--------|--------------------|
| 1 | abacaba | 0 (no existe) | `OK` | `{"abacaba": 1}` |
| 2 | acaba | 0 (no existe) | `OK` | `{"abacaba": 1, "acaba": 1}` |
| 3 | abacaba | 1 | `abacaba1` | `{"abacaba": 2, "acaba": 1}` |
| 4 | acab | 0 (no existe) | `OK` | `{"abacaba": 2, "acaba": 1, "acab": 1}` |

Nótese que el sufijo `k` es el valor del conteo **antes** de incrementarlo: en el paso 3, el conteo era 1, entonces el sufijo es `1`, y luego se actualiza a 2.

### Complejidad

- **Tiempo**: O(n) — cada nombre se procesa en O(1) amortizado gracias al hash map.
- **Espacio**: O(n) — en el peor caso, todos los nombres son distintos y el diccionario almacena n entradas.

### Nota de rendimiento

Con n hasta 10^5, usar `std::endl` dentro del bucle puede ser lento en C++ porque fuerza un flush del buffer en cada llamada. Es preferible usar `'\n'` y acumular la salida en un `std::ostringstream` (o un `string`) para hacer una única escritura al final. Además, `std::ios::sync_with_stdio(false)` junto con `std::cin.tie(nullptr)` desacopla los streams de C++ de los de C y desvincula `cin` de `cout`, reduciendo significativamente el tiempo de entrada/salida.

### Solución

Intenta resolver el ejercicio por tu cuenta antes de ver la solución.

<details>
<summary>C++ (Sin comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    unordered_map<string, int> count;
    ostringstream out;

    for (int i = 0; i < n; i++) {
        string name;
        cin >> name;
        auto it = count.find(name);
        if (it == count.end()) {
            count[name] = 1;
            out << "OK\n";
        } else {
            out << name << it->second << "\n";
            it->second++;
        }
    }
    cout << out.str();
    return 0;
}
```

</details>

<details>
<summary>C++ (Con comentarios)</summary>

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    // Desacopla cin/cout de los streams de C y evita el flush automático de cin en cada operación
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    unordered_map<string, int> count; // nombre → número de veces que ya apareció
    ostringstream out;                // acumulamos resultados para una única escritura al final

    for (int i = 0; i < n; i++) {
        string name;
        cin >> name;

        auto it = count.find(name);
        if (it == count.end()) {
            // Primera aparición: aceptamos y registramos con conteo inicial 1
            count[name] = 1;
            out << "OK\n";
        } else {
            // Duplicado: el sufijo es el conteo actual (cuántas veces ya apareció)
            out << name << it->second << "\n";
            it->second++; // incrementamos para la próxima aparición
        }
    }

    // Una única escritura evita el overhead de n llamadas a cout con std::endl
    cout << out.str();
    return 0;
}
```

</details>

<br/>

> You are welcome to share your solution in another programming language
