import { useState, useEffect, useCallback } from 'react'
import { getContinueReading, getProgress } from '../utils/storage.js'
import styles from './ContinueReading.module.css'

function ContinueReading({ folders, onSelect }) {
  const [continueList, setContinueList] = useState([])
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const list = getContinueReading(folders, 5)
    setContinueList(list)
  }, [folders])

  const handleSelect = useCallback((folderPath) => {
    onSelect(folderPath)
  }, [onSelect])

  if (continueList.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      <button 
        className={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles.title}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2a3 3 0 00-3 3V7a4 4 0 014-4z" />
            <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7a3 3 0 013 3V7a4 4 0 00-4-4z" />
          </svg>
          <span>📖 Continuar leyendo</span>
        </div>
        <svg 
          className={`${styles.chevron} ${isExpanded ? styles.expanded : ''}`}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div className={styles.list}>
          {continueList.map((folder) => (
            <button
              key={folder.path}
              className={styles.item}
              onClick={() => handleSelect(folder.path)}
            >
              <div className={styles.info}>
                <span className={styles.name}>{folder.displayName}</span>
                <div className={styles.progress}>
                  <div 
                    className={styles.progressBar}
                    style={{ width: `${folder.progress.percent}%` }}
                  />
                </div>
                <span className={styles.percent}>{folder.progress.percent}%</span>
              </div>
              <span className={styles.status}>
                {folder.progress.percent === 100 ? '✓' : '→'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ContinueReading
