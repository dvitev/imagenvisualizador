import React, { useState, useRef, useEffect } from 'react'
import styles from './FolderSearch.module.css'

function FolderSearch({ folders, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = folders.filter(folder =>
    folder.displayName.toLowerCase().includes(query.toLowerCase()) ||
    folder.path.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Buscar carpeta</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>
        
        <div className={styles.searchBox}>
          <i className="fa fa-search"></i>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nombre de carpeta..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.results}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <i className="fa fa-folder-open"></i>
              <p>No se encontraron carpetas</p>
            </div>
          ) : (
            filtered.map(folder => (
              <button
                key={folder.path}
                className={styles.result}
                onClick={() => onSelect(folder.path)}
              >
                <i className="fa fa-folder"></i>
                <div className={styles.info}>
                  <span className={styles.name}>{folder.displayName}</span>
                  <span className={styles.path}>{folder.path}</span>
                </div>
                <span className={styles.count}>{folder.imageCount}</span>
              </button>
            ))
          )}
        </div>

        <div className={styles.footer}>
          {folders.length} carpetas totales
          {query && <span> • {filtered.length} encontradas</span>}
        </div>
      </div>
    </div>
  )
}

export default FolderSearch
