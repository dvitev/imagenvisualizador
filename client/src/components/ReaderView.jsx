import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { useGesture } from '@use-gesture/react'
import styles from './ReaderView.module.css'
import debounce from '../utils/debounce.js'
import { useViewportImageManager } from '../hooks/useImageMemory.js'

const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function ReaderView({ 
  images, 
  onClose, 
  initialIndex = 0,
  folders = [],
  currentFolder = null,
  onNavigateChapter,
  onProgressUpdate
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [loadedImages, setLoadedImages] = useState(new Set())
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [showUI, setShowUI] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [readMode, setReadMode] = useState('scroll')
  const [doublePageMode, setDoublePageMode] = useState(false)
  const [zoomEnabled, setZoomEnabled] = useState(true)
  const containerRef = useRef(null)
  const imageRefs = useRef([])
  const uiTimeoutRef = useRef(null)
  const progressRef = useRef(null)

  const {
    containerRef: scrollContainerRef,
    setImageRef,
    imageRefs: managedImageRefs,
    visibleIndices
  } = useViewportImageManager(images.length, { preloadRange: 3, unloadDelay: 100 })

  const speeds = useMemo(() => [
    { label: 'Lenta', px: 40 },
    { label: 'Normal', px: 80 },
    { label: 'Rápida', px: 160 }
  ], [])

  const currentImage = images[currentIndex]
  const isLandscape = currentImage?.width > currentImage?.height

  const preloadImages = useCallback((index) => {
    const range = readMode === 'paginated' ? 2 : 2
    for (let i = Math.max(0, index - range); i <= Math.min(images.length - 1, index + range); i++) {
      if (!loadedImages.has(i)) {
        const img = new Image()
        img.src = `/api/image/${encodeURIComponent(images[i].relativePath)}`
        img.onload = () => {
          setLoadedImages(prev => new Set([...prev, i]))
        }
      }
    }
  }, [images, loadedImages, readMode])

  useEffect(() => {
    preloadImages(currentIndex)
  }, [currentIndex, preloadImages])

  useEffect(() => {
    const visible = Array.from(visibleIndices)
    const toPreload = visible.flatMap(idx => 
      Array.from({ length: 2 }, (_, i) => idx + i).filter(i => i >= 0 && i < images.length)
    )
    
    toPreload.forEach(idx => {
      if (!loadedImages.has(idx)) {
        const img = new Image()
        img.src = `/api/image/${encodeURIComponent(images[idx].relativePath)}`
        img.onload = () => setLoadedImages(prev => new Set([...prev, idx]))
      }
    })
  }, [visibleIndices, images, loadedImages])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {})
        } else {
          onClose()
        }
      }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      if (e.key === 'Home') scrollToTop()
      if (e.key === 'End') scrollToBottom()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (readMode === 'paginated') {
          goToPage(currentIndex + 1)
        }
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (readMode === 'paginated') {
          goToPage(currentIndex - 1)
        }
      }
      if (e.key === 'd') setDoublePageMode(prev => !prev)
      if (e.key === 's') setReadMode(prev => prev === 'scroll' ? 'paginated' : 'scroll')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, isFullscreen, onClose, readMode, currentIndex])

  useEffect(() => {
    if (isPlaying && readMode === 'scroll') {
      const scrollInterval = setInterval(() => {
        window.scrollBy({ top: speeds[speed].px, behavior: 'smooth' })
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 10) {
          setIsPlaying(false)
        }
      }, 100)
      return () => clearInterval(scrollInterval)
    }
  }, [isPlaying, speed, speeds, readMode])

  useEffect(() => {
    if (isFullscreen) {
      const handleMouseMove = () => {
        setShowUI(true)
        clearTimeout(uiTimeoutRef.current)
        uiTimeoutRef.current = setTimeout(() => setShowUI(false), 3000)
      }
      document.addEventListener('mousemove', handleMouseMove)
      uiTimeoutRef.current = setTimeout(() => setShowUI(false), 3000)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        clearTimeout(uiTimeoutRef.current)
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    if (readMode === 'scroll') {
      const handleScroll = () => {
        const scrollPosition = window.scrollY + window.innerHeight / 2
        
        const visibleArray = Array.from(visibleIndices)
        if (visibleArray.length > 0) {
          const currentIndexInView = visibleArray.reduce((prev, curr) => 
            Math.abs(curr - currentIndex) < Math.abs(prev - currentIndex) ? prev : curr
          , visibleArray[0])
          
          if (currentIndexInView !== undefined && currentIndexInView !== currentIndex) {
            setCurrentIndex(currentIndexInView)
          }
        }
      }

      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [images, readMode, visibleIndices, currentIndex])

  useEffect(() => {
    if (readMode === 'scroll' && onProgressUpdate && currentFolder) {
      const debouncedSave = debounce(() => {
        onProgressUpdate(currentFolder, currentIndex, images.length)
      }, 1000)
      
      debouncedSave()
      
      return () => {
        if (debouncedSave.cancel) {
          debouncedSave.cancel()
        }
      }
    }
  }, [currentIndex, readMode, onProgressUpdate, currentFolder, images.length])

  const bindGestures = useGesture(
    {
      onSwipe: ({ direction: [x] }) => {
        if (readMode === 'paginated') {
          if (x > 0) {
            goToPage(currentIndex - 1)
          } else if (x < 0) {
            goToPage(currentIndex + 1)
          }
        }
      }
    },
    {
      eventOptions: { passive: true },
      swipe: { distance: 100 }
    }
  )

  const togglePlay = () => setIsPlaying(!isPlaying)

  const toggleSpeed = () => setSpeed((speed + 1) % speeds.length)

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const scrollToTop = () => {
    if (readMode === 'scroll') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (progressRef.current) {
      progressRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setCurrentIndex(0)
  }

  const scrollToBottom = () => {
    if (readMode === 'scroll') {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    } else if (progressRef.current) {
      progressRef.current.scrollTo({ top: progressRef.current.scrollHeight, behavior: 'smooth' })
    }
    setCurrentIndex(images.length - 1)
  }

  const goToPage = (index) => {
    const clamped = Math.max(0, Math.min(images.length - 1, index))
    setCurrentIndex(clamped)
    
    if (readMode === 'scroll') {
      imageRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleReadMode = () => {
    setReadMode(prev => prev === 'scroll' ? 'paginated' : 'scroll')
  }

  const toggleDoublePage = () => {
    setDoublePageMode(prev => !prev)
  }

  const toggleZoom = () => {
    setZoomEnabled(prev => !prev)
  }

  const handleZoomReset = (ref) => {
    if (ref) {
      ref.resetTransform(0)
    }
  }

  const currentIndexInFolder = images.findIndex((img, idx) => idx === currentIndex)
  const isLastPage = currentIndex === images.length - 1
  const isFirstPage = currentIndex === 0

  const currentFolderIndex = folders.findIndex(f => f.path === currentFolder)
  const prevFolder = currentFolderIndex > 0 ? folders[currentFolderIndex - 1] : null
  const nextFolder = currentFolderIndex < folders.length - 1 ? folders[currentFolderIndex + 1] : null

  const handlePrevChapter = () => {
    if (prevFolder) {
      onNavigateChapter?.(prevFolder.path, -1)
    }
  }

  const handleNextChapter = () => {
    if (nextFolder) {
      onNavigateChapter?.(nextFolder.path, 1)
    }
  }

  const renderImage = (index) => {
    const image = images[index]
    const isCurrentOrAdjacent = Math.abs(index - currentIndex) <= 2
    const isLoaded = loadedImages.has(index)
    const isVisible = visibleIndices.has(index)

    if (!isCurrentOrAdjacent && readMode === 'paginated') {
      return null
    }

    const imageSrc = isLoaded 
      ? `/api/image/${encodeURIComponent(image.relativePath)}`
      : PLACEHOLDER_SRC

    return (
      <div
        key={image.relativePath}
        className={`${styles.imageWrap} ${readMode === 'paginated' && index === currentIndex ? styles.active : ''}`}
        ref={setImageRef(index)}
        data-index={index}
        id={`page-${index}`}
      >
        <img
          src={imageSrc}
          data-real-src={isLoaded ? `/api/image/${encodeURIComponent(image.relativePath)}` : undefined}
          alt={`${image.fileName} - Página ${index + 1}`}
          className={`${styles.image} ${isLoaded ? styles.loaded : ''}`}
          loading="lazy"
          decoding="async"
          style={{
            contentVisibility: isVisible ? 'auto' : 'hidden',
            contain: 'layout style paint'
          }}
        />
        {!isLoaded && <div className={styles.skeleton} />}
        
        {readMode === 'paginated' && (
          <div className={styles.pageNumber}>
            {index + 1} / {images.length}
          </div>
        )}
      </div>
    )
  }

  const renderPaginatedView = () => {
    if (doublePageMode && currentIndex % 2 === 0 && currentIndex + 1 < images.length) {
      return (
        <div className={styles.doublePageContainer}>
          {renderImage(currentIndex)}
          {renderImage(currentIndex + 1)}
        </div>
      )
    }
    return renderImage(currentIndex)
  }

  return (
    <div 
      className={`${styles.readerWrap} ${readMode === 'paginated' ? styles.paginated : ''}`} 
      ref={containerRef}
      {...(readMode === 'paginated' ? bindGestures() : {})}
    >
      <nav className={`${styles.topBar} ${showUI || !isFullscreen ? styles.visible : ''}`}>
        <button className={styles.backBtn} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Volver</span>
        </button>
        
        <div className={styles.modeButtons}>
          <button 
            className={`${styles.modeBtn} ${readMode === 'scroll' ? styles.active : ''}`}
            onClick={toggleReadMode}
            title="Modo scroll (S)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 3v18M18 3v18M6 9h12M6 15h12" />
            </svg>
          </button>
          
          <button 
            className={`${styles.modeBtn} ${doublePageMode ? styles.active : ''}`}
            onClick={toggleDoublePage}
            title="Doble página (D)"
            disabled={readMode !== 'paginated'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h8a2 2 0 012 2v14a2 2 0 00-2 2H2a2 2 0 01-2-2V5a2 2 0 012-2z" />
              <path d="M22 3h-8a2 2 0 00-2 2v14a2 2 0 012 2h8a2 2 0 002-2V5a2 2 0 00-2-2z" />
            </svg>
          </button>
          
          <button 
            className={`${styles.modeBtn} ${zoomEnabled ? styles.active : ''}`}
            onClick={toggleZoom}
            title="Zoom (Z)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
            </svg>
          </button>
        </div>
        
        <div className={styles.title}>
          {currentImage?.folder || 'Visor'}
        </div>
        
        <div className={styles.right}>
          <button className={styles.iconBtn} onClick={scrollToTop}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <div className={styles.counter}>
            <strong>{currentIndex + 1}</strong> / {images.length}
          </div>
          <button className={styles.iconBtn} onClick={scrollToBottom}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </nav>

      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill} 
          style={{ width: `${((currentIndex + 1) / images.length) * 100}%` }}
        />
      </div>

      {readMode === 'scroll' ? (
        <div className={styles.imagesContainer} ref={scrollContainerRef}>
          {images.map((_, index) => renderImage(index))}
        </div>
      ) : (
        <div className={styles.paginatedContainer} ref={progressRef}>
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={3}
            limitToBounds={false}
            disabled={!zoomEnabled}
            doubleClick={{ disabled: !zoomEnabled }}
            pinch={{ disabled: !zoomEnabled }}
          >
            {({ resetTransform, ...rest }) => (
              <>
                <TransformComponent>
                  <div className={styles.paginatedContent}>
                    {renderPaginatedView()}
                  </div>
                </TransformComponent>
                
                {zoomEnabled && (
                  <div className={styles.zoomControls}>
                    <button 
                      className={styles.zoomBtn}
                      onClick={() => handleZoomReset(rest)}
                      title="Reset zoom"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 12h18M12 3v18" />
                      </svg>
                    </button>
                  </div>
                )}
              </>
            )}
          </TransformWrapper>
        </div>
      )}

      {readMode === 'scroll' && (isLastPage || isFirstPage) && (
        <div className={styles.chapterNav}>
          {prevFolder && (
            <button className={styles.chapterBtn} onClick={handlePrevChapter}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Capítulo Anterior</span>
            </button>
          )}
          
          {nextFolder && (
            <button className={`${styles.chapterBtn} ${styles.next}`} onClick={handleNextChapter}>
              <span>Siguiente Capítulo</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}

      <nav className={`${styles.bottomBar} ${showUI || !isFullscreen ? styles.visible : ''}`}>
        <button className={styles.bbBtn} onClick={scrollToTop} title="Ir al inicio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          </svg>
        </button>

        <button 
          className={`${styles.bbBtn} ${isPlaying ? styles.active : ''}`} 
          onClick={togglePlay}
          title={isPlaying ? 'Pausar (Espacio)' : 'Scroll automático (Espacio)'}
          disabled={readMode === 'paginated'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>

        <button className={styles.speedBtn} onClick={toggleSpeed} title="Cambiar velocidad">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width: '16px', height: '16px'}}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>{speeds[speed].label}</span>
        </button>

        <div className={styles.divider} />

        <button className={styles.bbBtn} onClick={toggleFullscreen} title="Pantalla completa (F)">
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 01-2 2H3m13.5 0h2.5v2.5M3 16v3a2 2 0 002 2h3m13-3v-3a2 2 0 00-2-2h-3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          )}
        </button>

        <div className={styles.divider} />

        <button className={styles.bbBtn} onClick={scrollToBottom} title="Ir al final">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 5l7 7-7 7M9 5l-7 7 7 7" />
          </svg>
        </button>
      </nav>
    </div>
  )
}

export default ReaderView
