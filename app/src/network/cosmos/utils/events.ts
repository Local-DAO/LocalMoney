import { DeliverTxResponse } from '@cosmjs/stargate'

/**
 * Safely extracts an attribute value from transaction events
 * Handles both old and new event formats from CosmJS
 * 
 * @param result - The transaction result from CosmJS
 * @param eventType - The event type to search for (e.g., 'wasm')
 * @param attributeKey - The attribute key to find (e.g., 'id', 'trade_id')
 * @returns The attribute value or undefined if not found
 */
export function extractEventAttribute(
  result: DeliverTxResponse,
  eventType: string,
  attributeKey: string
): string | undefined {
  try {
    // Current format: events directly on result with string keys/values
    if (result.events && Array.isArray(result.events)) {
      const event = result.events.find((e) => e.type === eventType)
      if (event && event.attributes) {
        const attr = event.attributes.find((a) => a.key === attributeKey)
        if (attr) {
          return attr.value
        }
      }
    }

    // Fallback: Try the old format (logs[0].events)
    if (result.logs && result.logs.length > 0 && result.logs[0].events) {
      const event = result.logs[0].events.find((e) => e.type === eventType)
      if (event) {
        const attr = event.attributes.find((a) => a.key === attributeKey)
        if (attr) return attr.value
      }
    }

    // Try rawLog as last resort
    if (result.rawLog) {
      try {
        const logs = JSON.parse(result.rawLog)
        if (Array.isArray(logs) && logs.length > 0 && logs[0].events) {
          const event = logs[0].events.find((e: any) => e.type === eventType)
          if (event) {
            const attr = event.attributes.find((a: any) => a.key === attributeKey)
            if (attr) return attr.value
          }
        }
      } catch {
        // rawLog might not be valid JSON
      }
    }

    return undefined
  } catch (error) {
    console.warn('Error extracting event attribute:', error)
    return undefined
  }
}

/**
 * Extracts offer ID from transaction result
 */
export function extractOfferId(result: DeliverTxResponse): number | undefined {
  const offerId = extractEventAttribute(result, 'wasm', 'id')
  return offerId ? Number(offerId) : undefined
}

/**
 * Extracts trade ID from transaction result
 */
export function extractTradeId(result: DeliverTxResponse): number | undefined {
  const tradeId = extractEventAttribute(result, 'wasm', 'trade_id')
  return tradeId ? Number(tradeId) : undefined
}