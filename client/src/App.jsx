import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { VirtuosoGrid } from 'react-virtuoso'
import FolderCard from './components/FolderCard.jsx'
import ReaderView from './components/ReaderView.jsx'
import Breadcrumb from './components/Breadcrumb.jsx'
import FolderSearch from './components/FolderSearch.jsx'
import ContinueReading from './components/ContinueReading.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initTheme, saveProgress, getFolderProgress } from './utils/storage.js'
import styles from './App.module.css'

const fetchStructure = async () => {
  const response = await fetch('/api/structure')
  if (!response.ok) {
    throw new Error('Failed to fetch structure')
  }
  return response.json()
}

function App() {
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [readerIndex, setReaderIndex] = useState(null)
  const [lastSavedIndex, setLastSavedIndex] = useState(null)

  useEffect(() => {
    initTheme()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { data: structure, isLoading, error } = useQuery({
    queryKey: ['structure'],
    queryFn: fetchStructure
  })

  const folders = useMemo(() => {
    if (!structure) return []
    return structure.map((folder) => ({
      name: folder.folder,
      displayName: folder.folder.split(/[/\\]/).pop(),
      path: folder.folder.replace(/\\/g, '/'),
      imageCount: folder.images.length,
      images: folder.images.map((img) => ({
        ...img,
        folder: folder.folder
      }))
    }))
  }, [structure])

  const currentImages = useMemo(() => {
    if (!selectedFolder || !structure) return []
    
    const normalizedSelected = selectedFolder.replace(/\\/g, '/')
    const folderData = structure.find((f) => f.folder.replace(/\\/g, '/') === normalizedSelected)
    if (!folderData) return []
    
    return folderData.images.map((img) => ({
      ...img,
      folder: selectedFolder
    }))
  }, [selectedFolder, structure])

  useEffect(() => {
    if (selectedFolder) {
      const progress = getFolderProgress(selectedFolder)
      if (progress && progress.lastIndex >= 0) {
        setLastSavedIndex(progress.lastIndex)
      } else {
        setLastSavedIndex(null)
      }
    }
  }, [selectedFolder])

  const handleFolderClick = useCallback((folderPath) => {
    setSelectedFolder(folderPath)
  }, [])

  const handleImageClick = useCallback((imageIndex) => {
    setReaderIndex(imageIndex)
  }, [])

  const handleReaderClose = useCallback(() => {
    setReaderIndex(null)
  }, [])

  const handleNavigateChapter = useCallback((folderPath, direction) => {
    setSelectedFolder(folderPath)
    setReaderIndex(direction > 0 ? 0 : -1)
  }, [])

  const handleSearchSelect = useCallback((folderPath) => {
    setSelectedFolder(folderPath)
    setShowSearch(false)
  }, [])

  const handleContinueSelect = useCallback((folderPath) => {
    setSelectedFolder(folderPath)
    const progress = getFolderProgress(folderPath)
    if (progress) {
      setReaderIndex(Math.min(progress.lastIndex, currentImages.length - 1))
    }
  }, [currentImages.length])

  const handleProgressUpdate = useCallback((folderPath, index, total) => {
    saveProgress(folderPath, index, total)
  }, [])

  const renderFolderItem = useCallback(
    (index, folder) => {
      return (
        <FolderCard
          folder={folder}
          onClick={() => handleFolderClick(folder.path)}
        />
      )
    },
    [handleFolderClick]
  )

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Escaneando imágenes...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Reintentar</button>
      </div>
    )
  }

  if (!structure || structure.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <h2>No se encontraron imágenes</h2>
        <p>Verifica que la carpeta configurada contenga imágenes válidas</p>
      </div>
    )
  }

  const showFolders = !selectedFolder

  if (readerIndex !== null) {
    return (
      <ErrorBoundary>
        <ReaderView
          images={currentImages}
          initialIndex={readerIndex}
          onClose={handleReaderClose}
          folders={folders}
          currentFolder={selectedFolder}
          onNavigateChapter={handleNavigateChapter}
          onProgressUpdate={handleProgressUpdate}
        />
      </ErrorBoundary>
    )
  }

  return (
    <div className={styles.app}>
      <Breadcrumb
        folders={folders}
        selectedFolder={selectedFolder}
        onBack={showFolders ? null : () => setSelectedFolder(null)}
        onSearch={() => setShowSearch(true)}
        imageCount={showFolders ? folders.reduce((sum, f) => sum + f.imageCount, 0) : currentImages.length}
      />
      
      {showFolders && (
        <ContinueReading 
          folders={folders}
          onSelect={handleContinueSelect}
        />
      )}
      
      {showFolders ? (
        <VirtuosoGrid
          style={{ height: 'calc(100% - 60px)' }}
          data={folders}
          itemContent={renderFolderItem}
          overscan={200}
          components={{
            List: React.forwardRef((props, ref) => (
              <div
                {...props}
                ref={ref}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '16px',
                  padding: '16px',
                  ...props.style
                }}
              />
            ))
          }}
        />
      ) : (
        <>
          {lastSavedIndex !== null && lastSavedIndex > 0 && lastSavedIndex < currentImages.length - 1 && (
            <div className={styles.resumeBanner}>
              <span>📖 Última vez en la página {lastSavedIndex + 1}</span>
              <button onClick={() => setReaderIndex(lastSavedIndex)}>
                Continuar
              </button>
            </div>
          )}
          
          <VirtuosoGrid
            style={{ height: 'calc(100% - 60px)' }}
            data={currentImages}
            itemContent={(index, item) => (
              <div
                style={{
                  padding: '8px',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  margin: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                onClick={() => handleImageClick(index)}
              >
                <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: '4px' }}>
                  <img
                    src={`/api/thumb/${encodeURIComponent(item.relativePath)}`}
                    alt={item.fileName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.src = `/api/image/${encodeURIComponent(item.relativePath)}`
                    }}
                  />
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-muted)', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  textAlign: 'center'
                }}>
                  {item.fileName}
                </div>
              </div>
            )}
            overscan={500}
          />
        </>
      )}

      {showSearch && (
        <FolderSearch
          folders={folders}
          onSelect={handleSearchSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}

export default App
