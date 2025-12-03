// Toast utility with proper memory management and cleanup
type ToastType = 'success' | 'error' | 'warning' | 'info'

// Constants for timing
const TOAST_DISPLAY_DURATION = 5000 // 5 seconds
const TOAST_FADE_DURATION = 300 // 300ms fade out

// Store active timeouts for cleanup
const activeTimeouts = new Map<HTMLElement, { displayTimeout: NodeJS.Timeout; removeTimeout?: NodeJS.Timeout }>()

/**
 * Show a custom toast notification with proper cleanup
 * @param message - The message to display
 * @param type - The type of toast (success, error, warning, info)
 */
export function showCustomToast(message: string, type: ToastType = 'info') {
  const div = document.createElement('div')
  div.textContent = message
  div.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 16px 24px;
    border-radius: 8px;
    z-index: 9999;
    font-family: 'Poppins', sans-serif;
    font-size: 14px;
    transition: opacity 0.3s;
    ${type === 'error' ? 'background: #ef4444; color: white;' : ''}
    ${type === 'success' ? 'background: #10b981; color: white;' : ''}
    ${type === 'warning' ? 'background: #f59e0b; color: white;' : ''}
    ${type === 'info' ? 'background: #3b82f6; color: white;' : ''}
  `
  document.body.appendChild(div)
  
  // Set up cleanup with proper timeout management
  const displayTimeout = setTimeout(() => {
    div.style.opacity = '0'
    const removeTimeout = setTimeout(() => {
      // Check if element still exists in DOM before removing
      if (div.parentNode) {
        document.body.removeChild(div)
      }
      // Clean up from our tracking map
      activeTimeouts.delete(div)
    }, TOAST_FADE_DURATION)
    
    // Update the timeout reference
    const timeoutRefs = activeTimeouts.get(div)
    if (timeoutRefs) {
      timeoutRefs.removeTimeout = removeTimeout
    }
  }, TOAST_DISPLAY_DURATION)
  
  // Store timeout references for cleanup
  activeTimeouts.set(div, { displayTimeout })
  
  // Return cleanup function for immediate cleanup if needed
  return () => {
    const timeoutRefs = activeTimeouts.get(div)
    if (timeoutRefs) {
      clearTimeout(timeoutRefs.displayTimeout)
      if (timeoutRefs.removeTimeout) {
        clearTimeout(timeoutRefs.removeTimeout)
      }
      activeTimeouts.delete(div)
    }
    if (div.parentNode) {
      document.body.removeChild(div)
    }
  }
}

/**
 * Clean up all active toasts (useful for page navigation)
 */
export function cleanupAllToasts() {
  activeTimeouts.forEach((timeoutRefs, div) => {
    clearTimeout(timeoutRefs.displayTimeout)
    if (timeoutRefs.removeTimeout) {
      clearTimeout(timeoutRefs.removeTimeout)
    }
    if (div.parentNode) {
      document.body.removeChild(div)
    }
  })
  activeTimeouts.clear()
}

// Clean up on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAllToasts)
}