# Blog Personal - Jesús Flórez

Blog estático construido con React, Vite y Markdown, desplegado en `blog.jesusflorez.cloud`.

## 🚀 Características

- ✅ **Posts en Markdown**: Escribe contenido en archivos `.md` con metadata
- ✅ **Rutas dinámicas**: `/año/mes/slug-del-post`
- ✅ **Búsqueda**: Busca posts por título, descripción o contenido
- ✅ **Paginación**: 9 posts por página
- ✅ **Diseño responsivo**: Optimizado para móvil y escritorio
- ✅ **Syntax highlighting**: Para bloques de código
- ✅ **Docker ready**: Dockerfile y nginx configurados

## 📁 Estructura del Proyecto

```
blog/
├── public/
│   └── vite.svg
├── src/
│   ├── posts/              # Carpeta de posts organizados por fecha
│   │   └── 2026/
│   │       └── 01/
│   │           ├── introduccion-tdd.md
│   │           ├── react-hooks-guia.md
│   │           └── microservicios-spring-boot.md
│   ├── components/         # Componentes React
│   │   ├── Header.jsx
│   │   ├── Footer.jsx
│   │   ├── PostList.jsx   # Lista de posts con paginación
│   │   └── PostView.jsx   # Vista individual de post
│   ├── utils/
│   │   └── postsLoader.js # Cargador de posts desde Markdown
│   ├── styles/            # Estilos CSS
│   ├── App.jsx
│   └── main.jsx
├── Dockerfile
├── nginx.conf
└── package.json
```

## 📝 Crear un Nuevo Post

### 1. Estructura de carpetas

Los posts deben estar en: `src/posts/YYYY/MM/nombre-del-post.md`

Ejemplo: `src/posts/2026/01/mi-primer-post.md`

### 2. Formato del post

Cada post debe comenzar con metadata en formato YAML (frontmatter):

```markdown
---
titulo: "Título del Post"
fecha: "2026-01-12"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpg"
descripcion: "Descripción breve del post que aparece en la lista"
imagenPortada: "https://images.unsplash.com/photo-example?w=800"
etiquetas: ["React", "JavaScript", "Tutorial"]
---

# Contenido del Post

Tu contenido en Markdown aquí...

## Sección

- Lista de items
- Otro item

\`\`\`javascript
// Código de ejemplo
console.log('Hello World');
\`\`\`
```

### 3. Campos de metadata

- **titulo** (requerido): Título principal del post
- **fecha** (requerido): Fecha en formato `YYYY-MM-DD`
- **nombreAutor** (requerido): Nombre del autor
- **fotoAutor** (opcional): Ruta a la foto del autor (ej: `/authors/jesus-florez.jpg`)
  - Sube tus fotos de autor a `public/authors/`
  - Formato recomendado: 200x200px, JPG/PNG/WebP
  - Peso máximo recomendado: 100KB
- **descripcion** (opcional): Resumen que aparece en la lista de posts
- **imagenPortada** (opcional): URL de la imagen de portada del post
- **etiquetas** (opcional): Array de etiquetas (ej: `["React", "JavaScript"]`)

### 4. URL del post

La URL se genera automáticamente basada en la estructura de carpetas:

```
src/posts/2026/01/mi-post.md
→ blog.jesusflorez.cloud/2026/01/mi-post
```

## 🛠️ Desarrollo Local

### Instalar dependencias

```bash
npm install
```

### Ejecutar en desarrollo

```bash
npm run dev
```

El blog estará disponible en `http://localhost:5173`

### Build de producción

```bash
npm run build
```

Los archivos compilados estarán en `dist/`

## 📚 Tecnologías

- **React 18**: Librería de UI
- **Vite**: Build tool y dev server
- **React Router**: Navegación y rutas dinámicas
- **React Markdown**: Renderizado de Markdown a HTML
- **remark-gfm**: Soporte para GitHub Flavored Markdown
- **gray-matter**: Parser de frontmatter YAML
- **Docker**: Containerización
- **Nginx**: Web server en producción

## 📄 Licencia

© 2026 Jesús Flórez. Todos los derechos reservados.
