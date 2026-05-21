import path from 'path'

export function sanitizePath(requestedPath, baseDir) {
  const normalizedPath = path.normalize(requestedPath)
  
  if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
    return null
  }
  
  const fullPath = path.join(baseDir, normalizedPath)
  const resolvedPath = path.resolve(fullPath)
  const resolvedBase = path.resolve(baseDir)
  
  if (!resolvedPath.startsWith(resolvedBase)) {
    return null
  }
  
  return resolvedPath
}
