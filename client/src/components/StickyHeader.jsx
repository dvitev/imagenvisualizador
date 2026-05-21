import styles from './StickyHeader.module.css'

function StickyHeader({ folder, imageCount }) {
  const folderName = folder.includes('\\') || folder.includes('/')
    ? folder.split(/[/\\]/).pop()
    : folder

  return (
    <div className={styles.header}>
      <div className={styles.content}>
        <h2 className={styles.title}>{folderName}</h2>
        <span className={styles.count}>{imageCount} imágenes</span>
      </div>
    </div>
  )
}

export default StickyHeader
