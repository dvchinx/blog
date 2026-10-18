import { lazy } from 'react'
import { reloadOnStaleChunk } from './utils/staleChunk'

/**
 * React.lazy con `preload()`. Si el módulo ya está cargado, devuelve un
 * thenable síncrono: React lo resuelve en el mismo render, sin pasar por el
 * fallback de Suspense — así el HTML prerenderizado se reemplaza directamente
 * por el contenido final, sin parpadeo de "Cargando…".
 */
function lazyWithPreload(factory) {
  let loaded = null
  const preload = () => factory().then((module) => (loaded = module))

  const Component = lazy(() =>
    loaded ? { then: (resolve) => resolve(loaded) } : reloadOnStaleChunk(preload)
  )
  Component.preload = preload
  return Component
}

// PostView arrastra react-markdown, rehype-raw y el resaltador: la portada no
// los necesita.
export const PostView = lazyWithPreload(() => import('./components/PostView'))
