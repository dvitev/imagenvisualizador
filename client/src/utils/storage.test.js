import { describe, it, expect } from 'vitest'
import { getProgress, saveProgress, getFolderProgress, getContinueReading, getTheme, setTheme } from '../storage.js'

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getProgress / saveProgress', () => {
    it('should return empty object when no progress saved', () => {
      expect(getProgress()).toEqual({})
    })

    it('should save and retrieve progress', () => {
      saveProgress('test-folder', 5, 20)
      const progress = getFolderProgress('test-folder')
      
      expect(progress).toBeDefined()
      expect(progress.lastIndex).toBe(5)
      expect(progress.totalImages).toBe(20)
      expect(progress.percent).toBe(30)
      expect(progress.timestamp).toBeDefined()
    })

    it('should calculate correct percentage', () => {
      saveProgress('folder-1', 9, 10)
      const progress = getFolderProgress('folder-1')
      expect(progress.percent).toBe(100)
    })

    it('should handle multiple folders', () => {
      saveProgress('folder-1', 5, 10)
      saveProgress('folder-2', 3, 20)
      
      expect(getFolderProgress('folder-1').percent).toBe(60)
      expect(getFolderProgress('folder-2').percent).toBe(20)
    })
  })

  describe('getContinueReading', () => {
    it('should return empty array when no progress', () => {
      const folders = [
        { path: 'f1', displayName: 'Folder 1' },
        { path: 'f2', displayName: 'Folder 2' }
      ]
      expect(getContinueReading(folders)).toEqual([])
    })

    it('should return folders sorted by timestamp', () => {
      const folders = [
        { path: 'f1', displayName: 'Folder 1' },
        { path: 'f2', displayName: 'Folder 2' },
        { path: 'f3', displayName: 'Folder 3' }
      ]

      saveProgress('f1', 5, 10)
      saveProgress('f2', 3, 10)
      saveProgress('f3', 8, 10)

      const result = getContinueReading(folders)
      expect(result.length).toBe(3)
      expect(result[0].path).toBe('f3')
      expect(result[2].path).toBe('f1')
    })

    it('should limit results to specified limit', () => {
      const folders = Array.from({ length: 10 }, (_, i) => ({
        path: `f${i}`,
        displayName: `Folder ${i}`
      }))

      folders.forEach(f => saveProgress(f.path, 5, 10))

      const result = getContinueReading(folders, 5)
      expect(result.length).toBe(5)
    })
  })

  describe('getTheme / setTheme', () => {
    it('should return dark as default theme', () => {
      expect(getTheme()).toBe('dark')
    })

    it('should save and retrieve theme', () => {
      setTheme('light')
      expect(getTheme()).toBe('light')
    })

    it('should toggle between themes', () => {
      setTheme('dark')
      expect(getTheme()).toBe('dark')
      
      setTheme('light')
      expect(getTheme()).toBe('light')
    })
  })
})
