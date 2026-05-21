import React from 'react'
import styles from './Breadcrumb.module.css'

function Breadcrumb({ folders, selectedFolder, onBack, onSearch, imageCount = 0 }) {
  if (!selectedFolder) {
    return (
      <div className={styles.container}>
        <span className={styles.root}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>Raíz</span>
        </span>
        <span className={styles.summary}>
          {folders.length} {folders.length === 1 ? 'carpeta' : 'carpetas'}
          {' '}• {imageCount} {imageCount === 1 ? 'imagen' : 'imágenes'}
        </span>
        <button className={styles.searchBtn} onClick={onSearch} title="Buscar carpeta (Ctrl+F)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </div>
    )
  }

  const parts = selectedFolder.split(/[/\\]/)
  const breadcrumbs = []
  let accumulatedPath = ''
  
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) accumulatedPath += '/'
    accumulatedPath += parts[i]
    breadcrumbs.push({
      name: parts[i],
      path: accumulatedPath,
      isLast: i === parts.length - 1
    })
  }

  return (
    <div className={styles.container}>
      {onBack && (
        <button
          className={styles.backButton}
          onClick={onBack}
          aria-label="Volver a carpetas"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            <path d="M9 10l-2 2 2 2" />
          </svg>
        </button>
      )}
      
      <nav className={styles.nav}>
        <button
          className={styles.item}
          onClick={onBack}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            <span className={styles.separator}>/</span>
            {crumb.isLast ? (
              <span className={`${styles.item} ${styles.current}`} title={crumb.name}>
                {crumb.name}
              </span>
            ) : (
              <button
                className={styles.item}
                onClick={() => onBack && onBack(crumb.path)}
              >
                {crumb.name}
              </button>
            )}
          </React.Fragment>
        ))}
      </nav>
      
      <span className={styles.count}>
        {imageCount} {imageCount === 1 ? 'imagen' : 'imágenes'}
      </span>
    </div>
  )
}

export default Breadcrumb
