import { useState, useEffect, useCallback } from 'react'
import styles from './FolderCard.module.css'
import { getFolderProgress } from '../utils/storage.js'

function FolderCard({ folder, onClick }) {
  const [progress, setProgress] = useState(null)

  useEffect(() => {
    const folderProgress = getFolderProgress(folder.path)
    setProgress(folderProgress)
  }, [folder.path])

  const getStatusIcon = () => {
    if (!progress) return null
    
    if (progress.percent === 100) {
      return (
        <div className={styles.completed} title="Completado">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )
    }
    
    return (
      <div className={styles.progressBadge} title={`En progreso: ${progress.percent}%`}>
        <span>{progress.percent}%</span>
      </div>
    )
  }

  return (
    <div className={styles.container} onClick={onClick}>
      <div className={styles.icon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      
      {getStatusIcon()}
      
      <div className={styles.info}>
        <span className={styles.name} title={folder.displayName}>
          {folder.displayName}
        </span>
        <span className={styles.count}>
          {folder.imageCount} {folder.imageCount === 1 ? 'imagen' : 'imágenes'}
        </span>
        
        {progress && progress.percent < 100 && (
          <div className={styles.miniProgress}>
            <div 
              className={styles.miniProgressBar}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default FolderCard
