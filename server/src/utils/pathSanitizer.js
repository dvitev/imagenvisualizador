import path from 'path'

// Conjunto de caracteres Unicode que visual o funcionalmente se asemejan a puntos (.)
const DOT_LIKE_CHARS = /[\u2025\u2026\uFF0E\uFF61\u3002\u2E2F\u2E3C]/g

/**
 * Decodifica URI de forma segura sin lanzar excepción.
 * Express ya decodifica req.params automáticamente con decodeURIComponent,
 * así que esto es solo para capturar doble-encoding malicioso (%252e%252e%252f).
 * Si falla la decodificación (ej: % suelto en el nombre del archivo),
 * devuelve el string original sin decodificar.
 */
function safeDecodeURI(str) {
  try {
    // Solo decodificar si hay secuencias %xx potenciales
    if (!/%[0-9a-fA-F]{2}/.test(str)) {
      return str
    }
    const decoded = decodeURIComponent(str)
    // Verificar que la decodificación fue exitosa y el string cambió
    return decoded
  } catch {
    // Si hay un % inválido (ej: parte del nombre del archivo),
    // devolver el string original sin modificar
    return str
  }
}

/**
 * Sanitiza un path solicitado para prevenir path traversal.
 *
 * NOTA: Express ya decodifica req.params con decodeURIComponent, por lo que
 * requestedPath llega completamente decodificado. safeDecodeURI maneja
 * casos de doble-encoding malicioso sin romper paths con % literales.
 */
export function sanitizePath(requestedPath, baseDir) {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return path.resolve(baseDir)
  }

  const trimmedPath = requestedPath.trim()
  if (trimmedPath === '') {
    return path.resolve(baseDir)
  }

  // 1. Decodificar URI de forma segura (double-encoding, % literales)
  let normalizedPath = safeDecodeURI(trimmedPath)

  // 2. Normalizar Unicode a NFC
  normalizedPath = normalizedPath.normalize('NFC')

  // 3. Rechazar caracteres de control (null bytes, etc.)
  if (/[\x00-\x1f]/.test(normalizedPath)) {
    return null
  }

  // 4. Rechazar caracteres peligrosos en nombres de archivo
  //    Incluye ~ (home directory en Unix) y caracteres de control
  if (/[<>"|?*~]/.test(normalizedPath)) {
    return null
  }

  // 5. Detectar path traversal con caracteres Unicode similares a puntos
  //    Reemplazar puntos Unicode (NO el ASCII . que es válido en paths)
  //    por puntos ASCII y verificar si hay ..
  const asciiDotsPath = normalizedPath.replace(DOT_LIKE_CHARS, '.')
  const segments = asciiDotsPath.split(/[/\\]/)
  for (const segment of segments) {
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

  // 8. Verificar que no contenga segmentos de solo puntos
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