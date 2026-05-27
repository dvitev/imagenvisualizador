import { useEffect } from 'react'

const SKELETON_ID = '__skeleton_styles__'

function Skeleton() {
  useEffect(() => {
    if (!document.getElementById(SKELETON_ID)) {
      const style = document.createElement('style')
      style.id = SKELETON_ID
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `
      document.head.appendChild(style)
    }
  }, [])

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        borderRadius: '12px',
        width: '100%',
        height: '100%',
        minHeight: '200px'
      }}
    />
  )
}

export default Skeleton
