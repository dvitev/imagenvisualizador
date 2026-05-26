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
      // Simular null byte injection
      expect(sanitizePath('image.jpg\0../../../etc/passwd', BASE_DIR)).toBeNull()
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
      // El path resuelto debe comenzar con BASE_DIR
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

    it('should reject paths with drive letters on Windows', () => {
      // C: en medio del path debe ser tratado como segmento normal
      const result = sanitizePath('folder/C:/image.jpg', BASE_DIR)
      // El resultado debe estar dentro de BASE_DIR
      expect(result.startsWith(BASE_DIR)).toBe(true)
    })
  })
})
