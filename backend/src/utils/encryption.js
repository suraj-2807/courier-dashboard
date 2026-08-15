import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

/**
 * Derives a guaranteed 32-byte (256-bit) key buffer from process.env.ENCRYPTION_KEY or fallback.
 * SHA-256 ensures the key buffer is ALWAYS exactly 32 bytes, preventing Node.js "Invalid key length" errors.
 */
function getSecretKeyBuffer() {
  const rawKey = process.env.ENCRYPTION_KEY || 'prince-courier-default-enc-key!!'
  return crypto.createHash('sha256').update(String(rawKey)).digest()
}

/**
 * Encrypt a plaintext string or object safely
 */
export function encrypt(text) {
  if (!text) return ''
  try {
    const key = getSecretKeyBuffer()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const plainText = typeof text === 'object' ? JSON.stringify(text) : String(text)
    let encrypted = cipher.update(plainText, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return iv.toString('hex') + ':' + encrypted
  } catch (err) {
    console.error('Encryption failed:', err.message)
    return typeof text === 'object' ? JSON.stringify(text) : String(text)
  }
}

/**
 * Decrypt an encrypted string safely.
 * Returns the original string if decryption fails or if input is unencrypted.
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return ''
  if (typeof encryptedText === 'object') {
    return JSON.stringify(encryptedText)
  }
  
  const textStr = String(encryptedText).trim()
  if (!textStr.includes(':')) {
    return textStr
  }

  try {
    const key = getSecretKeyBuffer()
    const parts = textStr.split(':')
    if (parts.length < 2 || parts[0].length !== 32) {
      return textStr
    }
    const iv = Buffer.from(parts.shift(), 'hex')
    const encrypted = parts.join(':')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    return textStr
  }
}

/**
 * Mask a string, showing only last 4 chars
 */
export function maskValue(value) {
  if (!value || value.length <= 4) return '••••••••'
  return '••••••••' + String(value).slice(-4)
}
