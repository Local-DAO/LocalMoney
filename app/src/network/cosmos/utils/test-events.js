// Test file to verify event extraction works with the new format

const testResult = {
  logs: [],
  height: 27177413,
  transactionHash: '0E8492B3EFA08D38E2E8027BEF6D4EC98B039E98A6CAE0004095BE7F155413FB',
  events: [
    {
      type: 'wasm',
      attributes: [
        { key: '_contract_address', value: 'cosmos1t97gan32qpyxpepzq8kjn7n44tvk72q6emak8k3kkypx4w8knvgs48w7wr' },
        { key: 'action', value: 'create_offer' },
        { key: 'type', value: 'Buy' },
        { key: 'id', value: '2' },
        { key: 'rate', value: '100' },
        { key: 'min_amount', value: '1000000' },
        { key: 'max_amount', value: '150000000' },
        { key: 'owner', value: 'cosmos1gkec5sqldd822qxjn5wxvxwef7pw3v0yt36vah' },
        { key: 'msg_index', value: '0' }
      ]
    }
  ],
  gasWanted: 871046n,
  gasUsed: 639487n
};

// Simulate the extraction function
function extractEventAttribute(result, eventType, attributeKey) {
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
    return undefined
  } catch (error) {
    console.warn('Error extracting event attribute:', error)
    return undefined
  }
}

// Test extracting offer ID
const offerId = extractEventAttribute(testResult, 'wasm', 'id')
console.log('Extracted offer ID:', offerId) // Should output: 2

// Test extracting action
const action = extractEventAttribute(testResult, 'wasm', 'action')
console.log('Extracted action:', action) // Should output: create_offer

// Test extracting owner
const owner = extractEventAttribute(testResult, 'wasm', 'owner')
console.log('Extracted owner:', owner) // Should output: cosmos1gkec5sqldd822qxjn5wxvxwef7pw3v0yt36vah

// Test with non-existent attribute
const missing = extractEventAttribute(testResult, 'wasm', 'trade_id')
console.log('Missing attribute:', missing) // Should output: undefined