import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './Lightbox.module.css'

const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function Lightbox({ items, currentIndex, onClose, onNavigate }) {
  const [loadedImages, setLoadedImages] = useState(new Set([currentIndex]))
  const [isZoomed, setIsZoomed] = useState(false)
  const imgRef = useRef(null)
  const currentImage = items[currentIndex]

  const preloadAdjacent = useCallback(() => {
    const indicesToPreload = []
    
    if (currentIndex > 0) indicesToPreload.push(currentIndex - 1)
    if (currentIndex < items.length - 1) indicesToPreload.push(currentIndex + 1)
    
    indicesToPreload.forEach((index) => {
      if (!loadedImages.has(index)) {
        const img = new Image()
        img.src = `/api/image/${encodeURIComponent(items[index].relativePath)}`
        img.onload = () => {
          setLoadedImages((prev) => new Set([...prev, index]))
        }
      }
    })
  }, [currentIndex, items, loadedImages])

  useEffect(() => {
    preloadAdjacent()
  }, [preloadAdjacent])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        onNavigate(-1)
      } else if (e.key === 'ArrowRight') {
        onNavigate(1)
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setIsZoomed((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, onNavigate])

  const imageSrc = loadedImages.has(currentIndex)
    ? `/api/image/${encodeURIComponent(currentImage.relativePath)}`
    : PLACEHOLDER_SRC

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // M9: swipe down para cerrar en móvil
  const touchStartY = useRef(null)
  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY }
  const handleTouchEnd = (e) => {
    if (!touchStartY.current) return
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 100) onClose() // swipe down > 100px = cerrar
    touchStartY.current = null
  }

  const handleImageClick = () => {
    setIsZoomed((prev) => !prev)
  }

  const canNavigateLeft = currentIndex > 0
  const canNavigateRight = currentIndex < items.length - 1

  return (
    <div className={styles.overlay} onClick={handleBackdropClick} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={styles.container}>
        <div
          className={`${styles.imageWrapper} ${isZoomed ? styles.zoomed : ''}`}
          onClick={handleImageClick}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt={currentImage.fileName}
            className={styles.image}
            loading="eager"
            decoding="async"
          />
        </div>

        <div className={styles.header}>
          <div className={styles.info}>
            <span className={styles.filename}>{currentImage.fileName}</span>
            <span className={styles.position}>
              {currentIndex + 1} / {items.length}
            </span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {canNavigateLeft && (
          <button
            className={`${styles.navButton} ${styles.left}`}
            onClick={() => onNavigate(-1)}
            aria-label="Anterior"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}

        {canNavigateRight && (
          <button
            className={`${styles.navButton} ${styles.right}`}
            onClick={() => onNavigate(1)}
            aria-label="Siguiente"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        <div className={styles.hint}>
          <span>Click para zoom</span>
          <span>•</span>
          <span>Flechas para navegar</span>
          <span>•</span>
          <span>ESC para cerrar</span>
        </div>
      </div>
    </div>
  )
}

export default Lightbox
