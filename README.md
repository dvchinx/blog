# Blog Personal - Jesús Flórez

[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/dvchinx/blog)

Blog estático personal construido con React, Vite y Markdown. El proyecto está diseñado para ser simple, rápido y fácil de mantener, con un sistema de posts basados en archivos Markdown y un despliegue containerizado con Docker.

## 🚀 Características

-   **Posts en Markdown**: El contenido se escribe en archivos `.md` con metadatos en formato frontmatter.
-   **Rutas Dinámicas**: URLs generadas automáticamente a partir de la estructura de carpetas (`/año/mes/slug-del-post`).
-   **Categorías y Búsqueda**: Filtra posts por categoría (Tecnología vs. Ejercicios) y busca posts por título, descripción o contenido.
-   **Paginación**: Navegación por páginas con 9 posts por página.
-   **Diseño Responsivo**: Optimizado para una experiencia de usuario fluida en dispositivos móviles y de escritorio.
-   **Syntax Highlighting**: Resaltado de sintaxis para bloques de código en los artículos.
-   **Despliegue con Docker**: Incluye `Dockerfile` y configuración de `nginx` para un despliegue rápido y consistente.

## 🛠️ Tecnologías Utilizadas

-   **Frontend**: React 19, Vite
-   **Enrutamiento**: React Router
-   **Renderizado de Markdown**: React Markdown, Remark GFM, Rehype Raw
-   **Manejo de Metadatos**: Gray-matter
-   **Containerización**: Docker, Nginx

## 📁 Estructura del Proyecto

```
dvchinx-blog/
├── dist/                   # Archivos de producción (generados)
├── public/
│   └── authors/            # Fotos de los autores
├── src/
│   ├── components/         # Componentes de React (Header, Footer, PostList, etc.)
│   ├── posts/              # Contenido del blog en formato Markdown
│   │   └── 2026/
│   │       └── 01/
│   │           └── introduccion-tdd.md
│   ├── styles/             # Hojas de estilo CSS
│   ├── utils/              # Lógica para cargar y procesar posts
│   ├── App.jsx             # Componente principal y enrutamiento
│   └── main.jsx            # Punto de entrada de la aplicación
├── Dockerfile              # Definición del contenedor para producción
├── nginx.conf              # Configuración de Nginx
└── package.json            # Dependencias y scripts del proyecto
```

## 📝 Crear un Nuevo Post

Para añadir un nuevo artículo al blog, sigue estos pasos:

### 1. Estructura de Carpetas

Crea un nuevo archivo Markdown dentro de la carpeta `src/posts/` siguiendo la estructura `YYYY/MM/nombre-del-post.md`.

**Ejemplo**: `src/posts/2026/02/mi-nuevo-articulo.md`

### 2. Formato del Post (Frontmatter)

Cada archivo debe comenzar con una sección de metadatos en formato YAML (frontmatter).

```markdown
---
titulo: "Título del Post"
fecha: "2026-02-20"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Una descripción breve que aparecerá en la lista de posts."
imagenPortada: "https://.../imagen.jpg"
etiquetas: ["React", "JavaScript", "Guía"]
categoria: "tech" # "tech" para tecnología o "coding" para ejercicios
---

# Contenido del Post

Aquí va el contenido de tu artículo en formato Markdown...

## Subtítulo

-   Lista de puntos.
-   Otro punto.

\`\`\`javascript
// Ejemplo de bloque de código
function helloWorld() {
  console.log("Hello, World!");
}
\`\`\`
```

### 3. Campos de Metadatos

-   `titulo` (requerido): Título principal del post.
-   `fecha` (requerido): Fecha de publicación en formato `YYYY-MM-DD`.
-   `nombreAutor` (requerido): Nombre completo del autor.
-   `fotoAutor` (opcional): Ruta a la foto del autor en `public/authors/`.
-   `descripcion` (opcional): Resumen breve para la vista de lista de posts.
-   `imagenPortada` (opcional): URL de una imagen de portada para el artículo.
-   `etiquetas` (opcional): Una lista de etiquetas relevantes.
-   `categoria` (requerido): Define el tipo de post. Usa `"tech"` para artículos de tecnología o `"coding"` para ejercicios de programación. Esto afecta el estilo y el filtrado.

## 💻 Desarrollo Local

### Requisitos

-   Node.js (versión 20 o superior)
-   npm

### Pasos

1.  **Clona el repositorio:**
    ```bash
    git clone https://github.com/dvchinx/blog.git
    cd blog
    ```

2.  **Instala las dependencias:**
    ```bash
    npm install
    ```

3.  **Ejecuta el servidor de desarrollo:**
    ```bash
    npm run dev
    ```
    La aplicación estará disponible en `http://localhost:5173`.

### Otros Scripts

-   **Construir para producción:**
    ```bash
    npm run build
    ```
    Los archivos estáticos se generarán en la carpeta `dist/`.

-   **Ejecutar linter:**
    ```bash
    npm run lint
    ```

## 🐳 Despliegue con Docker

El proyecto está listo para ser desplegado usando Docker.

1.  **Construye la imagen de Docker:**
    ```bash
    docker build -t dvchinx/blog .
    ```

2.  **Ejecuta el contenedor:**
    ```bash
    docker run -d -p 8080:80 --name mi-blog dvchinx/blog
    ```
    El blog estará accesible en `http://localhost:8080`.

El `Dockerfile` utiliza una compilación multifase para crear una imagen de producción ligera basada en Nginx, y el archivo `nginx.conf` está configurado para servir los archivos estáticos y soportar el enrutamiento del lado del cliente de React Router.

## 📄 Licencia

2026 Jesús Flórez.
