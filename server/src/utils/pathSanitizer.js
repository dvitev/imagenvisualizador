import path from 'path'

// Conjunto de caracteres Unicode que visual o funcionalmente se asemejan a puntos (.)
// U+002E = . (punto ASCII)
// U+2025 = ‥ (punto doble)
// U+2026 = … (elipsis)
// U+FF0E = ． (punto full-width)
// U+FF61 = ｡ (punto medio-width)
// U+3002 = 。 (punto ideográfico)
// U+2E2F = ⸯ (punto vertical)
// U+2E3C = ⸼ (punto estenográfico)
const DOT_LIKE_CHARS = /[\u002E\u2025\u2026\uFF0E\uFF61\u3002\u2E2F\u2E3C]/g

/**
 * Sanitiza un path solicitado para prevenir path traversal.
 * - Normaliza Unicode (NFC) para colapsar caracteres compuestos
 * - Decodifica URI encoding
 * - Rechaza caracteres de control (0x00-0x1F) y peligrosos (<, >, ", |, ?, *)
 * - Detecta path traversal usando caracteres Unicode similares a puntos
 * - Verifica que el path resuelto esté dentro del directorio base
 */
export function sanitizePath(requestedPath, baseDir) {
  // Si el path está vacío o no es string, devolver el directorio base
  if (!requestedPath || typeof requestedPath !== 'string') {
    return path.resolve(baseDir)
  }

  const trimmedPath = requestedPath.trim()

  // Si después de trim está vacío, devolver el directorio base
  if (trimmedPath === '') {
    return path.resolve(baseDir)
  }

  // 1. Decodificar URI (previene doble-encoding)
  let normalizedPath = decodeURIComponent(trimmedPath)

  // 2. Normalizar Unicode a NFC
  normalizedPath = normalizedPath.normalize('NFC')

  // 3. Rechazar caracteres de control (null bytes, etc.)
  if (/[\x00-\x1f]/.test(normalizedPath)) {
    return null
  }

  // 4. Rechazar caracteres peligrosos en nombres de archivo
  if (/[<>"|?*]/.test(normalizedPath)) {
    return null
  }

  // 5. Detectar path traversal con caracteres Unicode similares a puntos
  //    Reemplazar puntos Unicode por puntos ASCII y verificar si hay ..
  const asciiDotsPath = normalizedPath.replace(DOT_LIKE_CHARS, '.')
  // Verificar segmentos que sean SOLO puntos
  const segments = asciiDotsPath.split(/[/\\]/)
  for (const segment of segments) {
    // Si un segmento consiste solo de puntos y tiene al menos 2, es traversal
    if (/^\.+$/.test(segment) && segment.length >= 2) {
      return null
    }
  }

  // 6. Normalizar separadores de path del SO
  normalizedPath = path.normalize(normalizedPath)

  // 7. Rechazar intentos de path traversal (después de normalize)
  if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
    return null
  }

  // 8. Verificar que no contenga segmentos de solo puntos (después de normalize)
  const normalizedSegments = normalizedPath.split(/[/\\]/)
  for (const segment of normalizedSegments) {
    if (/^\.{2,}$/.test(segment)) {
      return null
    }
  }

  // 9. Resolver contra el directorio base
  const fullPath = path.join(baseDir, normalizedPath)
  const resolvedPath = path.resolve(fullPath)
  const resolvedBase = path.resolve(baseDir)

  // 10. Verificar que esté dentro del directorio base
  if (!resolvedPath.startsWith(resolvedBase)) {
    return null
  }

  return resolvedPath
}