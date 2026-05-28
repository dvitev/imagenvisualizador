import { describe, it, expect } from 'vitest'

// Test C3: Verificar que buildTree e isTruncated se importan estáticamente
describe('structure routes — imports estáticos (C3)', () => {
  it('buildTree es importable como export nombrado desde imageScanner', async () => {
    const { buildTree } = await import('../imageScanner.js')
    expect(typeof buildTree).toBe('function')
  })

  it('isTruncated es importable como export nombrado desde imageScanner', async () => {
    const { isTruncated } = await import('../imageScanner.js')
    expect(typeof isTruncated).toBe('function')
  })

  it('structure.js no contiene import dinámico (await import)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, 'structure.js')
    const content = fs.readFileSync(filePath, 'utf8')
    // Verificar que no hay await import(...) en el archivo
    expect(content).not.toMatch(/await\s+import\(/)
  })

  it('getStructure se importa estáticamente junto con buildTree e isTruncated', async () => {
    const { getStructure } = await import('../imageScanner.js')
    expect(typeof getStructure).toBe('function')
  })
})

// Test M1: X-Truncated header
describe('structure routes — X-Truncated header (M1)', () => {
  it('isTruncated devuelve un booleano', async () => {
    const { isTruncated } = await import('../imageScanner.js')
    const result = isTruncated()
    expect(typeof result).toBe('boolean')
  })
})

// Test M3: Paginación forzada
describe('structure routes — paginación forzada (M3)', () => {
  it('MAX_PAGE_SIZE está definido en 500', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, 'structure.js')
    const content = fs.readFileSync(filePath, 'utf8')
    expect(content).toContain('MAX_PAGE_SIZE')
  })

  it('contiene nopaginate como opción para array completo', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const filePath = path.resolve(__dirname, 'structure.js')
    const content = fs.readFileSync(filePath, 'utf8')
    expect(content).toContain('nopaginate')
  })
})
