function Skeleton() {
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
