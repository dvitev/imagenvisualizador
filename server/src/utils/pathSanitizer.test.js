import { describe, it, expect } from 'vitest'
import { sanitizePath } from './pathSanitizer.js'

describe('pathSanitizer', () => {
  const BASE_DIR = process.platform === 'win32' ? 'C:\\images' : '/images'

  describe('Security - Path Traversal Prevention', () => {
    it('should block path traversal with ..', () => {
      expect(sanitizePath('../etc/passwd', BASE_DIR)).toBeNull()
    })

    it('should block multiple parent directory references', () => {
      expect(sanitizePath('../../etc/passwd', BASE_DIR)).toBeNull()
      expect(sanitizePath('folder/../../../etc/passwd', BASE_DIR)).toBeNull()
    })

    it('should block absolute paths', () => {
      const absolutePath = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd'
      expect(sanitizePath(absolutePath, BASE_DIR)).toBeNull()
    })

    it('should block paths that escape base directory', () => {
      expect(sanitizePath('..\\..\\etc\\passwd', BASE_DIR)).toBeNull()
    })

    it('should block double-encoded path traversal attempts', () => {
      const decoded = decodeURIComponent('%2e%2e%2f%2e%2e%2fetc%2fpasswd')
      expect(sanitizePath(decoded, BASE_DIR)).toBeNull()
    })

    it('should block paths with null bytes', () => {
      expect(sanitizePath('image.jpg\0../../../etc/passwd', BASE_DIR)).toBeNull()
    })

    // 🔒 NUEVOS TESTS DE SEGURIDAD
    it('should block unicode character U+2025 (‥) path traversal', () => {
      // U+2025 (‥) es visualmente similar a ".." pero no es detectado por startsWith
      expect(sanitizePath('\u2025\u2025/etc/passwd', BASE_DIR)).toBeNull()
    })

    it('should block unicode character U+FF0E (．) path traversal', () => {
      // U+FF0E (．) es un punto full-width que puede eludir filtros
      expect(sanitizePath('\uFF0E\uFF0E/etc/passwd', BASE_DIR)).toBeNull()
    })

    it('should block control characters in path', () => {
      expect(sanitizePath('image.jpg\x01/etc/passwd', BASE_DIR)).toBeNull()
      expect(sanitizePath('image.jpg\x1f/image', BASE_DIR)).toBeNull()
    })

    it('should block dangerous filesystem characters', () => {
      expect(sanitizePath('image<>bad.jpg', BASE_DIR)).toBeNull()
      expect(sanitizePath('image|bad.jpg', BASE_DIR)).toBeNull()
      expect(sanitizePath('~/etc/passwd', BASE_DIR)).toBeNull()
    })

    it('should handle paths with literal percent sign (safeDecodeURI)', () => {
      // Nombres de archivo con % no seguido de hex valido deben funcionar
      const result = sanitizePath('100%calidad.jpg', BASE_DIR)
      expect(result).not.toBeNull()
      expect(result).toContain('100%calidad.jpg')
    })

    it('should block tilde character (~) for home directory', () => {
      expect(sanitizePath('~/etc/passwd', BASE_DIR)).toBeNull()
      expect(sanitizePath('subdir/~/image.jpg', BASE_DIR)).toBeNull()
    })

    it('should block URI-encoded Unicode traversal attempts', () => {
      // Simular URI encoding de caracteres Unicode peligrosos
      const decoded = decodeURIComponent('%E2%80%A5%E2%80%A5/etc/passwd') // ‥‥
      expect(sanitizePath(decoded, BASE_DIR)).toBeNull()
    })
  })

  describe('Valid Paths', () => {
    it('should allow valid relative paths', () => {
      const result = sanitizePath('folder/image.jpg', BASE_DIR)
      expect(result).toContain('image.jpg')
    })

    it('should normalize paths with mixed separators', () => {
      const result = sanitizePath('folder/subfolder\\image.jpg', BASE_DIR)
      expect(result).toContain('image.jpg')
    })

    it('should handle empty paths', () => {
      const result = sanitizePath('', BASE_DIR)
      expect(result).toBe(BASE_DIR)
    })

    it('should handle root-level files', () => {
      const result = sanitizePath('image.jpg', BASE_DIR)
      expect(result).toContain('image.jpg')
    })

    it('should return a path within BASE_DIR', () => {
      const result = sanitizePath('subdir/image.jpg', BASE_DIR)
      expect(result.startsWith(BASE_DIR)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle paths with special characters', () => {
      const result = sanitizePath('folder with spaces/image.jpg', BASE_DIR)
      expect(result).toContain('image.jpg')
    })

    it('should handle unicode characters in paths', () => {
      const result = sanitizePath('日本語/画像.jpg', BASE_DIR)
      expect(result).toContain('画像.jpg')
    })

    it('should handle very long paths', () => {
      const longPath = 'a/'.repeat(100) + 'image.jpg'
      const result = sanitizePath(longPath, BASE_DIR)
      expect(result).toContain('image.jpg')
    })

    it('should handle URI-encoded valid paths', () => {
      const validEncoded = decodeURIComponent('folder%2Fimage.jpg')
      const result = sanitizePath(validEncoded, BASE_DIR)
      expect(result).toContain('image.jpg')
    })

    it('should reject paths with drive letters on Windows', () => {
      const result = sanitizePath('folder/C:/image.jpg', BASE_DIR)
      expect(result.startsWith(BASE_DIR)).toBe(true)
    })

    it('should handle filenames with dots', () => {
      const result = sanitizePath('folder/image.v2.1.jpg', BASE_DIR)
      expect(result).toContain('image.v2.1.jpg')
    })
  })
})
