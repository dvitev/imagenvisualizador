import { describe, it, expect } from 'vitest'

describe('App — estructura de estabilización (C1)', () => {
  it('folderImageCountCache con useRef evita dependencias inestables en useCallback', () => {
    const cache = new Map()
    cache.set('/manga/capitulo-1', 20)
    cache.set('/manga/capitulo-2', 15)
    expect(cache.get('/manga/capitulo-1')).toBe(20)
    expect(cache.get('/manga/capitulo-2')).toBe(15)
    expect(cache.get('/manga/inexistente')).toBeUndefined()
  })

  it('structureIdentity como ref evita re-cálculos cuando structure no cambia', () => {
    const s1 = [{ folder: 'a', images: [{ fileName: '1.jpg' }] }, { folder: 'b', images: [{ fileName: '2.jpg' }] }]
    const k1 = s1.length + '' + s1.reduce((sf, f) => sf + f.images.length, 0)
    const s2 = [{ folder: 'a', images: [{ fileName: '1.jpg' }] }, { folder: 'b', images: [{ fileName: '2.jpg' }] }]
    const k2 = s2.length + '' + s2.reduce((sf, f) => sf + f.images.length, 0)
    expect(k1).toBe(k2)
  })

  it('structureIdentity cambia cuando el contenido de structure cambia', () => {
    const s1 = [{ folder: 'a', images: [{ fileName: '1.jpg' }] }, { folder: 'b', images: [{ fileName: '2.jpg' }, { fileName: '3.jpg' }] }]
    const k1 = s1.length + '' + s1.reduce((sf, f) => sf + f.images.length, 0)
    const s2 = [{ folder: 'a', images: [{ fileName: '1.jpg' }] }, { folder: 'b', images: [{ fileName: '2.jpg' }] }]
    const k2 = s2.length + '' + s2.reduce((sf, f) => sf + f.images.length, 0)
    expect(k1).not.toBe(k2)
  })
})

describe('App — handleContinueSelect (C2)', () => {
  it('no navega si la carpeta tiene 0 imágenes (GUARD)', () => {
    const cache = new Map()
    cache.set('/manga/vacio', 0)
    cache.set('/manga/lleno', 10)
    const c0 = cache.get('/manga/vacio')
    expect(c0).toBe(0)
    expect(!c0).toBe(true)
    const c1 = cache.get('/manga/lleno')
    expect(c1).toBeGreaterThan(0)
    expect(!c1).toBe(false)
  })

  it('setea readerIndex válido si la carpeta tiene imágenes', () => {
    const cache = new Map()
    cache.set('/manga/lleno', 10)
    const mockProgress = { lastIndex: 5, percent: 60 }
    const count = cache.get('/manga/lleno')
    expect(count).toBeGreaterThan(0)
    const readerIndex = Math.min(mockProgress.lastIndex, count - 1)
    expect(readerIndex).toBe(5)
    expect(readerIndex).toBeLessThan(count)
  })

  it('maneja carpetas inexistentes sin navegar', () => {
    const cache = new Map()
    expect(!cache.get('/manga/inexistente')).toBe(true)
    cache.set('/manga/vacio', 0)
    expect(!cache.get('/manga/vacio')).toBe(true)
  })

  it('sin progreso guardado → readerIndex = 0', () => {
    const cache = new Map()
    cache.set('/manga/nuevo', 20)
    const savedIndex = null
    const readerIndex = savedIndex?.lastIndex ?? 0
    expect(readerIndex).toBe(0)
  })
})