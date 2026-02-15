import { useEffect, useRef } from 'react'
import '../styles/AnimatedBackground.css'

function AnimatedBackground() {
  const backgroundRef = useRef(null)
  const layers = useRef([])

  useEffect(() => {
    console.log('AnimatedBackground mounted - mouse tracking active')
    
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e
      const { innerWidth, innerHeight } = window
      
      // Normalizar posición del mouse (-1 a 1)
      const xPercent = (clientX / innerWidth - 0.5) * 2
      const yPercent = (clientY / innerHeight - 0.5) * 2

      layers.current.forEach((layer, index) => {
        if (layer) {
          const speed = (index + 1) * 25 // Aumentar velocidad para ser más notorio
          const x = xPercent * speed
          const y = yPercent * speed
          
          layer.style.transform = `translate(${x}px, ${y}px)`
        }
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      console.log('AnimatedBackground unmounted - removing mouse listener')
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <div className="animated-background" ref={backgroundRef}>
      {/* Capa 1 - Blanca */}
      <div 
        className="bg-layer bg-layer-1" 
        ref={el => layers.current[0] = el}
      >
        <div className="blur-circle white-circle circle-1"></div>
        <div className="blur-circle white-circle circle-2"></div>
      </div>
      
      {/* Capa 2 - Gris */}
      <div 
        className="bg-layer bg-layer-2" 
        ref={el => layers.current[1] = el}
      >
        <div className="blur-circle gray-circle circle-3"></div>
        <div className="blur-circle gray-circle circle-4"></div>
      </div>
      
      {/* Capa 3 - Negra */}
      <div 
        className="bg-layer bg-layer-3" 
        ref={el => layers.current[2] = el}
      >
        <div className="blur-circle black-circle circle-5"></div>
        <div className="blur-circle black-circle circle-6"></div>
      </div>
      
      {/* Capa 4 - Blanca secundaria */}
      <div 
        className="bg-layer bg-layer-4" 
        ref={el => layers.current[3] = el}
      >
        <div className="blur-circle white-circle circle-7"></div>
      </div>
    </div>
  )
}

export default AnimatedBackground
