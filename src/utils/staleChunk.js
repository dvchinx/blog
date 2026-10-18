/**
 * Cada despliegue reemplaza los chunks con hash: una pestaña abierta antes del
 * despliegue que navega a un post pediría un chunk que ya no existe y mostraría
 * un error. En ese caso se recarga la URL de destino una sola vez, lo que trae
 * el HTML prerenderizado nuevo con referencias a los chunks actuales.
 */
export async function reloadOnStaleChunk(load, targetPath = window.location.pathname) {
  const key = `chunk-reload:${targetPath}`
  try {
    const result = await load()
    try {
      sessionStorage.removeItem(key)
    } catch {
      // sin sessionStorage no hay nada que limpiar
    }
    return result
  } catch (error) {
    let alreadyReloaded = true
    try {
      alreadyReloaded = sessionStorage.getItem(key) === '1'
      if (!alreadyReloaded) sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage no disponible: no arriesgar un bucle de recargas
    }

    if (alreadyReloaded) throw error

    window.location.assign(targetPath)
    return new Promise(() => {}) // la página se está recargando
  }
}
