import { useEffect, useState, useRef, useMemo, useCallback } from 'react'

const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * Hook para manejo de memoria de imágenes individuales con IntersectionObserver.
 */
export function useImageMemoryManagement(src, options = {}) {
  const { threshold = 0.1, rootMargin = '200px', unloadDelay = 100 } = options

  const [displaySrc, setDisplaySrc] = useState(PLACEHOLDER_SRC)
  const [isInViewport, setIsInViewport] = useState(false)
  const imgRef = useRef(null)
  const unloadTimeoutRef = useRef(null)
  const originalSrcRef = useRef(src)

  useEffect(() => { originalSrcRef.current = src }, [src])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        clearTimeout(unloadTimeoutRef.current)
        setIsInViewport(true)
        setDisplaySrc(originalSrcRef.current)
      } else {
        setIsInViewport(false)
        unloadTimeoutRef.current = setTimeout(() => {
          if (imgRef.current) {
            imgRef.current.src = PLACEHOLDER_SRC
            setDisplaySrc(PLACEHOLDER_SRC)
          }
        }, unloadDelay)
      }
    }, { threshold, rootMargin })

    observer.observe(img)
    return () => { observer.disconnect(); clearTimeout(unloadTimeoutRef.current) }
  }, [threshold, rootMargin, unloadDelay])

  return { imgRef, displaySrc, isLoaded: displaySrc !== PLACEHOLDER_SRC, isInViewport }
}

// P3: Un solo IntersectionObserver global para TODAS las imágenes virtualizadas
// en lugar de crear un observer por cada imagen (evita 500+ observers)
const globalObserver = (() => {
  if (typeof IntersectionObserver === 'undefined') return null

  const elementMap = new Map() // element → { index, onIntersect, onLeave }
  let observer = null

  // Singleton: se crea bajo demanda
  function getObserver() {
    if (observer) return observer
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const data = elementMap.get(entry.target)
        if (!data) return

        if (entry.isIntersecting) {
          data.onIntersect?.(entry.target)
        } else {
          data.onLeave?.(entry.target)
        }
      })
    }, { threshold: 0.01, rootMargin: '150px' })
    return observer
  }

  return {
    observe(element, callbacks) {
      elementMap.set(element, callbacks)
      getObserver().observe(element)
    },
    unobserve(element) {
      elementMap.delete(element)
      observer?.unobserve(element)
    },
    disconnect() {
      elementMap.clear()
      observer?.disconnect()
      observer = null
    }
  }
})()

export function useViewportImageManager(imageCount, options = {}) {
  const { preloadRange = 3, unloadDelay = 100 } = options

  const [visibleIndices, setVisibleIndices] = useState(new Set())
  const imageRefs = useRef([])
  const containerRef = useRef(null)

  useEffect(() => {
    return () => globalObserver.disconnect()
  }, [])

  const setImageRef = useCallback((index) => (el) => {
    const prevRef = imageRefs.current[index]
    if (prevRef) globalObserver.unobserve(prevRef)

    imageRefs.current[index] = el
    if (!el) return

    const img = el.querySelector('img')
    if (img && img.dataset.realSrc) {
      img.src = img.dataset.realSrc
    }

    globalObserver.observe(el, {
      onIntersect: () => {
        setVisibleIndices(prev => { const next = new Set(prev); next.add(index); return next })
        const imgEl = el.querySelector('img')
        if (imgEl && imgEl.dataset.realSrc && imgEl.src === PLACEHOLDER_SRC) {
          imgEl.src = imgEl.dataset.realSrc
        }
      },
      onLeave: () => {
        setTimeout(() => {
          const imgEl = el.querySelector('img')
          if (imgEl && imgEl.src !== PLACEHOLDER_SRC) {
            imgEl.dataset.realSrc = imgEl.src
            imgEl.src = PLACEHOLDER_SRC
          }
          setVisibleIndices(prev => { const next = new Set(prev); next.delete(index); return next })
        }, unloadDelay)
      }
    })
  }, [unloadDelay])

  return { containerRef, setImageRef, imageRefs, visibleIndices, isImageVisible: (i) => visibleIndices.has(i) }
}
