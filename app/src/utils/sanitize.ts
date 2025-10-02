/**
 * Simple text sanitization to prevent XSS attacks from untrusted external data
 * Removes any HTML/script tags and dangerous characters
 */
export function sanitizeText(text: string): string {
  if (!text) return ''
  
  // Convert to string if not already
  const str = String(text)
  
  // Remove any HTML tags and script content
  const withoutTags = str.replace(/<[^>]*>/g, '')
  
  // Replace dangerous characters that could be used for XSS
  const sanitized = withoutTags
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
    .replace(/['"]/g, '') // Remove quotes that could break out of attributes
    
  // Limit length to prevent DOS attacks
  return sanitized.slice(0, 200)
}

/**
 * Sanitize token symbol for safe display
 * Token symbols should only contain alphanumeric characters and basic symbols
 */
export function sanitizeTokenSymbol(symbol: string): string {
  if (!symbol) return 'TOKEN'
  
  // Convert to string and uppercase
  const str = String(symbol).toUpperCase()
  
  // Only allow alphanumeric, dash, underscore, and dot
  const sanitized = str.replace(/[^A-Z0-9\-_.]/g, '')
  
  // Limit length (most token symbols are 3-5 characters)
  const limited = sanitized.slice(0, 20)
  
  // Return a default if empty after sanitization
  return limited || 'TOKEN'
}

/**
 * Sanitize numeric values for display
 */
export function sanitizeNumber(value: any): string {
  const num = Number(value)
  if (!isFinite(num)) return '0'
  return num.toString()
}