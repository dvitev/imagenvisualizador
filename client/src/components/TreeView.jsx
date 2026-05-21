import { useState, useCallback } from 'react'
import styles from './TreeView.module.css'

function TreeView({ tree, onSelect, level = 0 }) {
  const [expanded, setExpanded] = useState(() => {
    const shouldExpand = level < 2
    return shouldExpand
  })

  const handleClick = useCallback(() => {
    if (tree.type === 'folder') {
      setExpanded(!expanded)
    } else {
      onSelect(tree.path)
    }
  }, [tree, expanded, onSelect])

  if (tree.type === 'image') {
    return null
  }

  const hasChildren = tree.children && tree.children.length > 0
  const hasImages = tree.totalImages > 0

  return (
    <div className={styles.node} style={{ paddingLeft: `${level * 16}px` }}>
      <button
        className={`${styles.button} ${tree.type === 'folder' ? styles.folder : ''}`}
        onClick={handleClick}
      >
        <span className={styles.icon}>
          {tree.type === 'folder' && (
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className={`${styles.chevron} ${expanded ? styles.expanded : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
          
          {tree.type === 'folder' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </span>
        
        <span className={styles.name}>{tree.name}</span>
        
        {hasImages && (
          <span className={styles.count}>{tree.totalImages}</span>
        )}
      </button>
      
      {expanded && hasChildren && (
        <div className={styles.children}>
          {tree.children
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
              return a.name.localeCompare(b.name)
            })
            .map((child) => (
              <TreeView
                key={child.path || child.name}
                tree={child}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default TreeView
