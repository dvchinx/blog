---
titulo: "Codeforces vs AtCoder vs Kattis: cuál elegir para empezar en programación competitiva"
seoTitulo: "Codeforces vs AtCoder vs Kattis: ¿cuál elegir para empezar?"
fecha: "2026-11-28"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Codeforces vs AtCoder vs Kattis: diferencias en concursos, rating y juez, cuál elegir según tu objetivo y una ruta semanal para combinar las tres plataformas."
imagenPortada: "https://i.imgur.com/A5e3dHd.jpeg"
etiquetas: ["Programación Competitiva", "Codeforces", "AtCoder", "Kattis", "ICPC", "Guía"]
categoria: "coding"
keywords: "codeforces vs atcoder, atcoder vs codeforces, codeforces vs atcoder vs kattis, kattis, mejor plataforma programación competitiva, cuál plataforma elegir programación competitiva, atcoder beginner contest, abc atcoder, rating atcoder, rating codeforces, colores atcoder, kattis icpc, kattis puntos dificultad, juez en línea, programación competitiva para principiantes, dónde practicar programación competitiva"
---

# Codeforces vs AtCoder vs Kattis: cuál elegir para empezar en programación competitiva

Cuando decides tomarte en serio la programación competitiva aparece una duda que se repite en foros, grupos de estudio y semilleros universitarios: **Codeforces vs AtCoder**, ¿dónde practico? Y si además te estás preparando para la ICPC, alguien de tu universidad seguramente te habrá mencionado **Kattis**. Las tres son jueces en línea gratuitos con miles de problemas, pero no se parecen tanto como parece: cambian el formato de los concursos, cómo se calcula el rating, qué te dice el juez cuando te equivocas e incluso cómo se lee la entrada.

Elegir mal no es grave, pero sí cuesta tiempo. Hay quien pasa meses en Codeforces frustrado porque los problemas fáciles de una Div. 2 ya exigen trucos, cuando un AtCoder Beginner Contest le habría enseñado los fundamentos de forma más ordenada. Y hay equipos que llegan a la regional de la ICPC sin haber resuelto nunca un problema con entrada "hasta fin de archivo". En esta guía comparamos las tres plataformas punto por punto, con datos verificados a noviembre de 2026, te decimos **cuál elegir según tu objetivo** y te proponemos una ruta semanal para combinarlas. Si estás empezando desde cero, complementa con la [guía para empezar en programación competitiva](/2026/07/guia-inicio-programacion-competitiva).

## Codeforces vs AtCoder vs Kattis: diferencias en un vistazo

**Codeforces es la plataforma de concursos más activa, ideal para entrenar velocidad y subir rating; AtCoder ofrece concursos semanales muy bien calibrados, ideales para aprender fundamentos; Kattis es un gran archivo de problemas estilo ICPC donde sumas puntos según la dificultad de lo que resuelves.** Las tres son gratuitas y admiten C++, Python y Java.

![Comparativa de Codeforces vs AtCoder vs Kattis: rondas y rating de Codeforces, concursos ABC semanales de AtCoder y archivo de problemas estilo ICPC de Kattis](/diagrams/2026/11/codeforces-vs-atcoder-vs-kattis/comparativa-codeforces-atcoder-kattis.webp)

| Aspecto | Codeforces | AtCoder | Kattis |
|---------|------------|---------|--------|
| Origen | Rusia, creada por Mike Mirzayanov (2009) | Japón | KTH, Suecia (en uso desde 2005) |
| Concurso de referencia para empezar | Div. 4 (rating < 1400) y Div. 3 (< 1600) | AtCoder Beginner Contest (ABC), rated de 0 a 1999 | No tiene concursos con rating |
| Frecuencia | Varias rondas por semana | Un ABC casi cada sábado | Concursos creados por universidades y usuarios |
| Cómo mides tu progreso | Rating tipo Elo y colores (Newbie → Legendary Grandmaster) | Rating y colores (gris → rojo) | Puntaje = suma de la dificultad de los problemas resueltos |
| Feedback del juez | Pretests durante la ronda, system tests al final | Feedback completo durante el concurso | Se detiene en el primer caso que falla |
| Estilo de problemas | Ad hoc, constructivos, mucha variedad | Enunciados limpios, temas clásicos muy bien graduados | Estilo ICPC, enunciados largos con historia |
| Ideal para | Velocidad, volumen de práctica y rating | Aprender fundamentos con progresión ordenada | Preparar la ICPC y entrenar en equipo |

El resto del artículo explica cada fila, porque los detalles son los que determinan qué plataforma te conviene.

## Codeforces: la plataforma para entrenar velocidad y subir rating

Codeforces es, de lejos, la comunidad más grande: más de un millón y medio de usuarios registrados, rondas varias veces por semana y un *problemset* con miles de problemas etiquetados por tema y dificultad (de 800 a 3500). Si ya has leído la [ruta para llegar a 1000 de rating en Codeforces](/2026/11/ruta-1000-rating-codeforces), conoces el sistema de colores y divisiones.

### Tipos de rondas en Codeforces

- **Div. 4**: rated para participantes con menos de 1400. Muchos problemas accesibles; perfecta para tus primeros concursos.
- **Div. 3**: rated para menos de 1600. Empieza fácil pero los últimos problemas ya piden ideas de 1600–1900.
- **Div. 2**: la ronda "estándar" para casi todo el mundo por debajo de 1900–2100.
- **Div. 1**: para los niveles altos; a menudo se celebra en paralelo con una Div. 2.
- **Educational Rounds**: con reglas ICPC extendidas, pensadas para practicar temas clásicos.

### Cómo se juzga un envío en Codeforces

Aquí está la diferencia más importante con AtCoder. En una ronda clásica, durante el concurso tu código solo se evalúa contra un conjunto pequeño de **pretests**. Ver "Pretests passed" no significa que tu solución sea correcta: al terminar la ronda se ejecutan los **system tests** completos, y un problema que creías resuelto puede caer. Además, existen los **hacks**: otros participantes pueden leer tu código y proponer un caso que lo rompa. En las rondas Educational, Div. 3 y Div. 4 hay una **fase de hacking abierto de 12 horas** después del concurso, y las soluciones se vuelven a juzgar con los hacks exitosos.

La puntuación también varía. En las rondas clásicas cada problema vale menos a medida que pasa el tiempo y cada envío rechazado resta puntos; en las Educational, Div. 3 y Div. 4 se usa el estilo ICPC, donde cuenta el número de problemas y la penalización es de **10 minutos por envío incorrecto**.

### Lo bueno y lo malo de Codeforces

Lo mejor de Codeforces es el volumen: siempre hay una ronda cerca, cada problema tiene editorial y comentarios, y el filtro por tags del problemset te permite practicar un tema concreto. Lo menos amable para un principiante es que muchas rondas empiezan muy temprano en Latinoamérica, los problemas ad hoc y constructivos pueden resultar desconcertantes al principio, y el sistema de pretests castiga a quien no piensa en los casos borde.

En el código se nota otra particularidad: casi todos los problemas recientes traen **varios casos de prueba en la misma entrada**, así que tu plantilla debe leer un `t` primero.

```cpp
#include <bits/stdc++.h>
using namespace std;

// Plantilla típica de Codeforces: varios casos en una sola entrada
void solve() {
    int n;
    cin >> n;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    cout << *max_element(a.begin(), a.end()) << '\n';
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    cin >> t;              // número de casos de prueba
    while (t--) solve();   // reinicia todo dentro de solve()
}
```

## AtCoder: concursos semanales para aprender fundamentos

AtCoder es la plataforma japonesa que muchos competidores de alto nivel recomiendan para aprender bien. Su gran fortaleza es la calidad: los problemas son cortos, sin historias innecesarias, y la dificultad sube de forma muy regular dentro de cada concurso.

### AtCoder Beginner Contest (ABC): el concurso para empezar

El **AtCoder Beginner Contest** es rated para participantes de 0 a 1999 y se celebra casi todos los sábados a las 21:00 de Japón (las 7:00 a. m. en Colombia, Perú o Ecuador; ajusta según tu zona horaria). Por ejemplo, el [ABC 465](https://atcoder.jp/contests/abc465) duró **100 minutos** y tuvo siete problemas, de la A a la G, con puntajes de 100, 200, 300, 400, 450, 525 y 625. La clasificación se ordena por puntos y, en caso de empate, por el tiempo más una **penalización de 5 minutos por cada envío incorrecto**.

Lo que más diferencia a AtCoder de Codeforces es que el concurso es de **feedback completo**: tu código se evalúa contra todos los casos de prueba durante el concurso. Si ves AC, está aceptado y no te lo van a quitar. No hay hacks ni system tests que te den sorpresas al día siguiente.

### ARC, AGC y AHC: los siguientes escalones

- **AtCoder Regular Contest (ARC)**: desde 2026 tiene tres variantes, según el [anuncio oficial de cambios del ARC](https://atcoder.jp/posts/2026ARC_en): ARC-- (rated 800–2399, 120 minutos), ARC (1200–2799, 120 minutos) y ARC++ (1600–2999, 150 minutos).
- **AtCoder Grand Contest (AGC)**: los concursos más difíciles, para el nivel más alto.
- **AtCoder Heuristic Contest (AHC)**: problemas de optimización sin solución exacta, donde gana quien obtiene mejor puntuación. Es un mundo distinto y muy interesante si te gusta la optimización aplicada.

### El rating de AtCoder y sus colores

AtCoder usa colores por rango: gris (0–399), marrón (400–799), verde (800–1199), cian (1200–1599), azul (1600–1999), amarillo (2000–2399), naranja (2400–2799) y rojo (2800 o más). Dos detalles confunden a los principiantes:

1. **El rating visible empieza bajo y sube en tus primeros concursos.** AtCoder aplica una corrección a las cuentas con pocas participaciones, así que los primeros resultados no reflejan todavía tu nivel real.
2. **Las escalas no son comparables con Codeforces.** Un verde en AtCoder no equivale a un verde en Codeforces. La comunidad suele considerar el rating de AtCoder más "exigente": un usuario con cierto rating en Codeforces normalmente tiene un número más bajo en AtCoder.

Además, desde el ABC 430, el rating interno provisional con el que empieza un usuario nuevo pasó de 800 a 1200, según el [aviso oficial de AtCoder](https://atcoder.jp/posts/1592). La razón es que el valor anterior llevaba seis años sin actualizarse y ya no reflejaba el nivel real de quienes llegan a la plataforma.

### Lo bueno y lo malo de AtCoder

A favor de AtCoder: problemas sin trampas de lectura, una progresión que enseña (los primeros problemas de un ABC son de implementación pura; el D y el E introducen técnicas clásicas como BFS, DP o búsqueda binaria), editoriales oficiales y la **AtCoder Library**, una biblioteca oficial en C++ con estructuras como union-find o segment tree. En contra: solo hay un ABC por semana, la comunidad hispanohablante es pequeña y los problemas difíciles pueden ser muy matemáticos.

La entrada suele ser un **único caso** por archivo, lo que simplifica la plantilla:

```cpp
#include <bits/stdc++.h>
using namespace std;

// Plantilla típica de AtCoder: un único caso por entrada
int main() {
    int n;
    long long k;
    cin >> n >> k;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;

    long long suma = accumulate(a.begin(), a.end(), 0LL);
    cout << (suma >= k ? "Yes" : "No") << '\n'; // AtCoder suele pedir "Yes"/"No", no "YES"/"NO"
}
```

Fíjate en el último comentario: AtCoder suele pedir exactamente `Yes` y `No`, mientras que Codeforces casi siempre acepta cualquier combinación de mayúsculas. Es un Wrong Answer tonto que casi todos hemos sufrido al cambiar de plataforma.

## Kattis: el archivo de problemas estilo ICPC

Kattis nació en el KTH Royal Institute of Technology de Suecia y se usa desde 2005 para evaluar ejercicios de programación. Desde entonces se ha usado para organizar la **ICPC World Finals** y algunas regionales, y hoy muchas universidades la usan en sus cursos y entrenamientos. Su archivo público, [open.kattis.com](https://open.kattis.com/), tiene miles de problemas, muchos de ellos tomados de concursos ICPC reales.

### Cómo funciona el puntaje de Kattis

Kattis no tiene concursos con rating. En su lugar, cada problema tiene una **dificultad estimada** (un número que suele ir de 1 a 10 aproximadamente) y se etiqueta como *trivial*, *easy*, *medium* o *hard*. Según la [explicación oficial del ranking](https://open.kattis.com/info/ranklist), tu puntaje es simplemente **la suma de las dificultades de los problemas que has resuelto**, y resolver el mismo problema dos veces no suma. Como las dificultades se recalculan con un sistema tipo Elo, tu puntaje puede subir o bajar un poco sin que hagas nada.

Lo interesante es que existen rankings por **país** y por **universidad**, así que cada problema que resuelves también suma a tu institución. Para un semillero o un club de programación es una motivación muy concreta.

### Por qué Kattis es clave si vas a la ICPC

El juez de Kattis está diseñado al estilo de los sistemas ICPC: ejecuta los casos de prueba en orden y **se detiene en el primero que falla**, sin decirte qué caso era. Es exactamente lo que vivirás en una regional. Además, los enunciados son más largos y con historia, como en [Kattis Ants](/2026/07/kattis-ants) o [Kattis Bela](/2026/08/kattis-bela), y entrenan una habilidad que Codeforces y AtCoder trabajan poco: extraer el problema real de un texto de una página.

Otra diferencia práctica es la entrada. En muchos problemas de Kattis tienes que leer **hasta el final del archivo**, sin que te digan cuántos casos hay:

```cpp
#include <bits/stdc++.h>
using namespace std;

// Lectura hasta fin de archivo (EOF), habitual en Kattis y en la ICPC
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    while (cin >> a >> b) {          // termina cuando ya no hay más datos
        cout << llabs(a - b) << '\n';
    }
}
```

Si nunca has escrito un `while (cin >> ...)`, practícalo antes de tu primera regional: es uno de los errores más comunes de los equipos que solo han entrenado en Codeforces.

### Lo bueno y lo malo de Kattis

A favor: problemas estilo ICPC, posibilidad de crear concursos privados para tu equipo, rankings por universidad y un archivo enorme con dificultad estimada para elegir bien qué resolver. En contra: no hay rondas semanales con rating, la mayoría de problemas no tienen editorial oficial y la comunidad de discusión es mucho más pequeña que la de Codeforces.

## Cómo se juzga un envío en cada plataforma

La diferencia más subestimada entre las tres plataformas es el **feedback del juez**. Cambia por completo cómo debes trabajar durante un concurso.

![Diagrama de cómo se juzga un envío en Codeforces (pretests, hacks y system tests), AtCoder (feedback completo con penalización de 5 minutos) y Kattis (se detiene en el primer caso fallido)](/diagrams/2026/11/codeforces-vs-atcoder-vs-kattis/como-se-juzga-envio-codeforces-atcoder-kattis.webp)

- **En Codeforces**, "Pretests passed" es una promesa, no una garantía. Antes de pasar al siguiente problema, piensa en los casos borde (n = 1, valores máximos, desbordamiento) porque los system tests y los hacks los van a probar.
- **En AtCoder**, un AC es definitivo. Puedes avanzar con tranquilidad, pero cada envío incorrecto te cuesta 5 minutos de penalización, así que conviene probar tu código con los ejemplos antes de enviarlo.
- **En Kattis**, el veredicto te dice que fallaste, pero no dónde. Entrena a generar tus propios casos de prueba y a razonar la corrección antes de enviar, igual que en la ICPC.

## AtCoder vs Codeforces: ¿cuál es mejor para principiantes?

Si tuviera que dar una sola respuesta: **empieza con el ABC de AtCoder para aprender y usa las Div. 3 y Div. 4 de Codeforces para ganar velocidad**. No son excluyentes, y combinarlas es lo que más rápido te hace progresar.

AtCoder es mejor para principiantes en tres cosas: los problemas A–C del ABC son exactamente el nivel inicial, sin trampas de lectura; el feedback completo evita la frustración de perder un problema por un system test, y la progresión de dificultad dentro de cada concurso te enseña qué tema viene después. Codeforces gana en volumen y en ritmo: hay más rondas, más problemas por nivel, más editoriales y más gente comentando cada solución.

La comparación de dificultad más citada en la comunidad es aproximada, pero útil: el ABC está pensado como un concurso educativo para quienes están por debajo de 2000 en AtCoder (que equivale aproximadamente a los azules de Codeforces y niveles inferiores), mientras que ARC y AGC apuntan a niveles mucho más altos. En la práctica, los primeros problemas de un ABC se sienten como los A–B de una Div. 3, y los D–E, como los problemas intermedios de una Div. 2.

## ¿Cuál elegir según tu objetivo?

![Árbol de decisión para elegir plataforma de programación competitiva: AtCoder para aprender desde cero, Codeforces para subir rating y velocidad, Kattis para preparar la ICPC, y una ruta combinada semanal](/diagrams/2026/11/codeforces-vs-atcoder-vs-kattis/elegir-plataforma-programacion-competitiva.webp)

**Si estás empezando desde cero**, elige AtCoder. Resuelve los problemas A, B y C de los ABC antiguos (están todos disponibles para practicar) y participa en el ABC de cada sábado. Cuando resuelvas el C con soltura, ya estás listo para las rondas de Codeforces.

**Si quieres subir rating y velocidad**, Codeforces es tu casa. Participa en todas las Div. 3 y Div. 4 que puedas, practica en el problemset filtrando entre 100 y 200 puntos por encima de tu nivel y haz *upsolving* de cada ronda. Problemas clásicos como [4A - Watermelon](/2026/02/4a-watermelon) son el punto de partida.

**Si te preparas para la ICPC**, Kattis es imprescindible, pero no suficiente por sí sola. Úsala para entrenar en equipo con concursos privados de 5 horas, acostúmbrate a los enunciados largos y a leer hasta fin de archivo, y complementa con Codeforces para mantener el ritmo individual.

**Si te preparas para entrevistas técnicas**, cualquiera de las tres te sirve para la parte algorítmica, aunque los problemas de AtCoder son los que más se parecen en limpieza al formato de una entrevista. Eso sí, ninguna sustituye la práctica de explicar tu solución en voz alta.

## Una ruta semanal que combina las tres plataformas

Esta es la rutina que recomiendo a quien quiere progresar en serio sin quemarse, con unas 6–8 horas a la semana:

| Día | Plataforma | Actividad |
|-----|-----------|-----------|
| Lunes | Codeforces | Upsolving del concurso del fin de semana |
| Martes | Codeforces | 2–3 problemas del problemset en tu rango objetivo |
| Miércoles | Codeforces | Div. 3 / Div. 4 o Educational en vivo (o virtual) |
| Jueves | Kattis | 2 problemas *easy*/*medium*, uno con lectura hasta EOF |
| Viernes | AtCoder | Problemas D de ABC antiguos |
| Sábado | AtCoder | ABC en vivo y lectura de la editorial |
| Domingo | Kattis | Concurso en equipo (si te preparas para la ICPC) o descanso |

La clave no es seguir la tabla al pie de la letra, sino el principio: **AtCoder para aprender técnicas, Codeforces para ganar ritmo y Kattis para el formato ICPC**. Lleva un registro de la idea que te faltó en cada problema que no resolviste: es lo que más acelera el progreso en cualquier plataforma.

## Errores comunes al cambiar de plataforma

- **Imprimir `YES` en AtCoder** cuando el enunciado pide `Yes`. Lee siempre el formato de salida exacto.
- **Olvidar el `t` de casos en Codeforces** o, al revés, leer un `t` que no existe en Kattis o AtCoder.
- **Confiar en "Pretests passed"** y no revisar desbordamientos: en Codeforces los system tests y los hacks te los van a encontrar.
- **Comparar ratings entre plataformas**: un 1200 en AtCoder y un 1200 en Codeforces no significan lo mismo.
- **Practicar solo en Codeforces antes de la ICPC** y llegar sin experiencia en enunciados largos, entrada hasta EOF ni concursos de cinco horas en equipo.

## Preguntas frecuentes

### ¿Es mejor Codeforces o AtCoder para principiantes?

AtCoder suele ser mejor para dar los primeros pasos, porque el ABC tiene problemas iniciales muy bien graduados y feedback completo durante el concurso. Codeforces es mejor para ganar velocidad y volumen de práctica cuando ya dominas lo básico. Lo ideal es combinarlas.

### ¿Es más difícil AtCoder que Codeforces?

Los problemas iniciales de AtCoder son más accesibles, pero su escala de rating es más exigente: la misma persona suele tener un rating más bajo en AtCoder que en Codeforces. Los ARC y AGC son concursos de nivel alto, a menudo con un fuerte componente matemático.

### ¿Kattis tiene rating?

No tiene concursos con rating. Tu puntaje en Kattis es la suma de las dificultades estimadas de los problemas que has resuelto, y existen rankings de usuarios, universidades y países. Como las dificultades se recalculan con el tiempo, tu puntaje puede variar ligeramente.

### ¿Qué plataforma usar para prepararse para la ICPC?

Kattis es la más cercana al formato ICPC: juez que se detiene en el primer caso fallido, enunciados largos y problemas de concursos reales. Combínala con Codeforces para el entrenamiento individual y con simulacros de cinco horas en equipo.

### ¿A qué hora son los concursos de AtCoder en Latinoamérica?

Los ABC suelen empezar los sábados a las 21:00 de Japón, que corresponden a las 7:00 a. m. en Colombia, Perú o Ecuador y a las 6:00 a. m. en Ciudad de México. Comprueba siempre la hora en la página del concurso, que la muestra en tu zona horaria local.

### ¿Puedo usar Python en las tres plataformas?

Sí, las tres aceptan Python, C++ y Java, entre otros. Para los primeros niveles Python es suficiente, pero en problemas exigentes C++ te ahorra muchos Time Limit Exceeded, sobre todo en Codeforces y en Kattis.

## Conclusión

En el debate de Codeforces vs AtCoder vs Kattis no hay una ganadora absoluta, porque cada plataforma resuelve un problema distinto. AtCoder es la mejor escuela de fundamentos, con concursos semanales limpios y feedback completo. Codeforces es el gimnasio donde ganas velocidad, volumen y rating. Kattis es el campo de entrenamiento para la ICPC, con su juez estricto y sus enunciados largos.

Si estás empezando, no pierdas semanas decidiendo: crea cuenta en AtCoder y en Codeforces hoy mismo, participa en el próximo ABC del sábado y en la próxima Div. 3 o Div. 4, y añade Kattis cuando empieces a entrenar con tu equipo. La plataforma importa menos que la constancia; lo que de verdad te hace avanzar es resolver, fallar, leer la editorial y volver a intentarlo cada semana.
