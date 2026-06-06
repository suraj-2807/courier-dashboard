import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'prince-courier-default-enc-key!!' // 32 chars
const IV_LENGTH = 16

/**
 * Encrypt a plaintext string
 */
export function encrypt(text) {
  if (!text) return ''
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf-8'), iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return ''
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts.shift(), 'hex')
  const encrypted = parts.join(':')
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'utf-8'), iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * Mask a string, showing only last 4 chars
 */
export function maskValue(value) {
  if (!value || value.length <= 4) return '••••••••'
  return '••••••••' + value.slice(-4)
}
