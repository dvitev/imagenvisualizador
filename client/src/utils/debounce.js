function debounce(func, wait) {
  let timeout
  const debounced = function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
  
  debounced.cancel = () => {
    clearTimeout(timeout)
  }
  
  return debounced
}

export default debounce
