import { useEffect, useState, useRef } from 'react'

const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export function useImageMemoryManagement(src, options = {}) {
  const {
    threshold = 0.1,
    rootMargin = '200px',
    unloadDelay = 100
  } = options

  const [displaySrc, setDisplaySrc] = useState(PLACEHOLDER_SRC)
  const [isInViewport, setIsInViewport] = useState(false)
  const imgRef = useRef(null)
  const unloadTimeoutRef = useRef(null)
  const originalSrcRef = useRef(src)

  useEffect(() => {
    originalSrcRef.current = src
  }, [src])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        
        if (entry.isIntersecting) {
          if (unloadTimeoutRef.current) {
            clearTimeout(unloadTimeoutRef.current)
            unloadTimeoutRef.current = null
          }
          
          setIsInViewport(true)
          setDisplaySrc(originalSrcRef.current)
        } else {
          setIsInViewport(false)
          
          unloadTimeoutRef.current = setTimeout(() => {
            if (imgRef.current) {
              imgRef.current.src = PLACEHOLDER_SRC
              setDisplaySrc(PLACEHOLDER_SRC)
              
              if (img.complete) {
                img.removeAttribute('src')
                img.src = PLACEHOLDER_SRC
              }
            }
          }, unloadDelay)
        }
      },
      {
        threshold,
        rootMargin
      }
    )

    observer.observe(img)

    return () => {
      observer.disconnect()
      if (unloadTimeoutRef.current) {
        clearTimeout(unloadTimeoutRef.current)
      }
    }
  }, [threshold, rootMargin, unloadDelay])

  return {
    imgRef,
    displaySrc,
    isLoaded: displaySrc !== PLACEHOLDER_SRC && displaySrc !== '',
    isInViewport
  }
}

export function useViewportImageManager(imageCount, options = {}) {
  const {
    preloadRange = 3,
    unloadDelay = 100
  } = options

  const [visibleIndices, setVisibleIndices] = useState(new Set())
  const imageRefs = useRef([])
  const observersRef = useRef(new Map())
  const containerRef = useRef(null)

  useEffect(() => {
    return () => {
      observersRef.current.forEach((observer) => {
        if (observer && typeof observer.disconnect === 'function') {
          observer.disconnect()
        }
      })
      observersRef.current.clear()
    }
  }, [])

  const setImageRef = (index) => (el) => {
    const oldObserver = observersRef.current.get(index)
    if (oldObserver && typeof oldObserver.disconnect === 'function') {
      oldObserver.disconnect()
      observersRef.current.delete(index)
    }

    imageRefs.current[index] = el
    
    if (!el) {
      return
    }

    const img = el.querySelector('img')
    if (img && img.dataset.realSrc) {
      img.src = img.dataset.realSrc
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        const element = entry.target
        const imgElement = element.querySelector('img')
        
        if (!imgElement) return

        if (entry.isIntersecting) {
          setVisibleIndices(prev => {
            const next = new Set(prev)
            next.add(index)
            return next
          })

          const realSrc = imgElement.dataset.realSrc
          if (realSrc && imgElement.src === PLACEHOLDER_SRC) {
            imgElement.src = realSrc
          }
        } else {
          setTimeout(() => {
            if (imgElement && imgElement.src !== PLACEHOLDER_SRC) {
              imgElement.dataset.realSrc = imgElement.src
              imgElement.src = PLACEHOLDER_SRC
            }
            
            setVisibleIndices(prev => {
              const next = new Set(prev)
              next.delete(index)
              return next
            })
          }, unloadDelay)
        }
      },
      {
        threshold: 0.01,
        rootMargin: '150px'
      }
    )
    
    observer.observe(el)
    observersRef.current.set(index, observer)
  }

  return {
    containerRef,
    setImageRef,
    imageRefs,
    visibleIndices,
    isImageVisible: (index) => visibleIndices.has(index)
  }
}
