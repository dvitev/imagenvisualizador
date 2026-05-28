import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import debounce from '../utils/debounce.js'
import styles from './FolderSearch.module.css'

function FolderSearch({ folders, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [filtered, setFiltered] = useState(folders)
  const inputRef = useRef(null)

  // M14: Debounced filter para no bloquear el UI con 50K+ carpetas
  const debouncedFilter = useMemo(
    () => debounce((value) => {
      const lower = value.toLowerCase()
      setFiltered(
        folders.filter(folder =>
          folder.displayName.toLowerCase().includes(lower) ||
          folder.path.toLowerCase().includes(lower)
        )
      )
    }, 200),
    [folders]
  )

  // Cleanup debounce al desmontar
  useEffect(() => {
    return () => debouncedFilter.cancel()
  }, [debouncedFilter])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = useCallback((e) => {
    const value = e.target.value
    setQuery(value)          // Input responde al instante (UX fluida)
    debouncedFilter(value)    // Filtro pesado con debounce 200ms
  }, [debouncedFilter])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Buscar carpeta</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.searchBox}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" style={{ color: '#666', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nombre de carpeta..."
            value={query}
            onChange={handleChange}
          />
        </div>

        <div className={styles.results}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ color: '#555', marginBottom: '16px' }}>
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p>No se encontraron carpetas</p>
            </div>
          ) : (
            filtered.map(folder => (
              <button
                key={folder.path}
                className={styles.result}
                onClick={() => onSelect(folder.path)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="22" height="22" style={{ color: '#fbbf24', flexShrink: 0 }}>
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
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
          {query && <span> &middot; {filtered.length} encontradas</span>}
        </div>
      </div>
    </div>
  )
}

export default FolderSearch
