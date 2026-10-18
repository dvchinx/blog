import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, matchPath } from 'react-router-dom'
import App from './App.jsx'
import { PostView } from './routes'
import { loadPost } from './utils/postsLoader'
import './styles/index.css'

// El HTML prerenderizado sigue visible hasta que React monta. En un artículo
// se cargan antes el chunk de PostView y el markdown, para que el primer render
// ya sea el post completo (sin pantalla de carga ni salto de layout).
async function preloadInitialRoute() {
  const match = matchPath('/:year/:month/:slug', window.location.pathname)
  if (!match) return

  const { year, month, slug } = match.params
  await Promise.all([PostView.preload(), loadPost(year, month, slug)])
}

function render() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )

  // Precarga en segundo plano para que abrir un artículo desde la portada sea inmediato
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000))
  idle(() => PostView.preload().catch(() => {}))
}

preloadInitialRoute()
  .catch((error) => console.error('Error preloading route:', error))
  .finally(render)
