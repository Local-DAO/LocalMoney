const algorithm = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  extractable: false,
  hash: {
    name: 'SHA-256',
  },
}

let vector: Uint8Array | null = null

function getVector(): Uint8Array {
  if (!vector && typeof window !== 'undefined') {
    vector = window.crypto.getRandomValues(new Uint8Array(16))
  }
  return vector!
}

export async function generateKeys(): Promise<Secrets> {
  const keys = await window.crypto.subtle.generateKey(algorithm, true, ['encrypt', 'decrypt'])
  return await exportKeys(keys)
}

export async function encryptData(publicKey: string, data: string): Promise<string> {
  if (!publicKey || typeof publicKey !== 'string') {
    throw new Error('Invalid public key: empty or not a string')
  }

  try {
    const key = await importPublicKey(publicKey)
    const encryptedData = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
        iv: getVector(),
      },
      key,
      textToArrayBuffer(data)
    )
    return arrayBufferToBase64(encryptedData)
  } catch (e) {
    console.error('Encryption failed:', e)
    throw new Error(`Failed to encrypt data: ${e.message}`)
  }
}

export async function decryptData(privateKey: string, encryptedData: string): Promise<string> {
  try {
    const key = await importPrivateKey(privateKey)
    const decryptedData = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
        iv: getVector(),
      },
      key,
      base64ToArrayBuffer(encryptedData)
    )
    return arrayBufferToText(decryptedData)
  } catch (e) {
    return ''
  }
}

async function exportKeys(keys: CryptoKeyPair): Promise<Secrets> {
  const spki = await window.crypto.subtle.exportKey('spki', keys.publicKey)
  const publicKey = arrayBufferToBase64(spki)
  const pkcs8 = await window.crypto.subtle.exportKey('pkcs8', keys.privateKey)
  const privateKey = arrayBufferToBase64(pkcs8)
  return { publicKey, privateKey }
}

async function importPublicKey(publicKey: string) {
  return await window.crypto.subtle.importKey('spki', base64ToArrayBuffer(publicKey), algorithm, true, ['encrypt'])
}

async function importPrivateKey(privateKey: string) {
  return await window.crypto.subtle.importKey('pkcs8', base64ToArrayBuffer(privateKey), algorithm, true, ['decrypt'])
}

function textToArrayBuffer(text: string): Uint8Array {
  const buf = unescape(encodeURIComponent(text))
  const bufView = new Uint8Array(buf.length)
  for (let i = 0; i < buf.length; i++) {
    bufView[i] = buf.charCodeAt(i)
  }
  return bufView
}

function arrayBufferToText(arrayBuffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(arrayBuffer)
  let str = ''
  for (let i = 0; i < byteArray.byteLength; i++) {
    str += String.fromCharCode(byteArray[i])
  }
  return str
}

function base64ToArrayBuffer(b64str: string): ArrayBuffer {
  // Validate and clean the base64 string
  if (!b64str || typeof b64str !== 'string') {
    throw new Error('Invalid base64 string: empty or not a string')
  }
  
  // Remove any whitespace or line breaks
  const cleanB64 = b64str.replace(/\s/g, '')
  
  // Check if it's a valid base64 string
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  if (!base64Regex.test(cleanB64)) {
    throw new Error('Invalid base64 string format')
  }
  
  // Ensure proper padding
  const paddedB64 = cleanB64.padEnd(cleanB64.length + (4 - cleanB64.length % 4) % 4, '=')
  
  try {
    const byteStr = atob(paddedB64)
    const bytes = new Uint8Array(byteStr.length)
    for (let i = 0; i < byteStr.length; i++) {
      bytes[i] = byteStr.charCodeAt(i)
    }
    return bytes.buffer
  } catch (e) {
    throw new Error(`Failed to decode base64 string: ${e.message}`)
  }
}

function arrayBufferToBase64(arr: ArrayBuffer): string {
  const byteArray = new Uint8Array(arr)
  let byteString = ''
  for (let i = 0; i < byteArray.byteLength; i++) {
    byteString += String.fromCharCode(byteArray[i])
  }
  return btoa(byteString)
}

export interface Secrets {
  publicKey: string
  privateKey: string
}
