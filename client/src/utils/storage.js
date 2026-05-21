const PROGRESS_KEY = 'manga-reader-progress'
const THEME_KEY = 'manga-reader-theme'

export function getProgress() {
  try {
    const data = localStorage.getItem(PROGRESS_KEY)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.error('Error reading progress:', error)
    return {}
  }
}

export function saveProgress(folderPath, lastIndex, totalImages) {
  try {
    const progress = getProgress()
    progress[folderPath] = {
      lastIndex,
      totalImages,
      timestamp: Date.now(),
      percent: Math.round(((lastIndex + 1) / totalImages) * 100)
    }
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch (error) {
    console.error('Error saving progress:', error)
  }
}

export function getFolderProgress(folderPath) {
  const progress = getProgress()
  return progress[folderPath] || null
}

export function removeProgress(folderPath) {
  try {
    const progress = getProgress()
    delete progress[folderPath]
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch (error) {
    console.error('Error removing progress:', error)
  }
}

export function getContinueReading(folders = [], limit = 5) {
  const progress = getProgress()
  
  const withProgress = folders
    .map((folder) => {
      const folderProgress = progress[folder.path]
      if (!folderProgress) return null
      
      return {
        ...folder,
        progress: folderProgress
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.progress.timestamp - a.progress.timestamp)
  
  return withProgress.slice(0, limit)
}

export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark'
  } catch (error) {
    return 'dark'
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.setAttribute('data-theme', theme)
  } catch (error) {
    console.error('Error setting theme:', error)
  }
}

export function initTheme() {
  const theme = getTheme()
  document.documentElement.setAttribute('data-theme', theme)
  return theme
}
