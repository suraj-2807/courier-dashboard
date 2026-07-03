// Password Reset Utility
// Usage: node src/utils/resetPassword.js [email] [password]

import bcrypt from 'bcryptjs'
import { query, execute } from '../config/db.js'

const EMAIL = process.argv[2] || 'admin@princeexp.com'
const NEW_PASSWORD = process.argv[3] || 'admin123'

async function resetPassword() {
  try {
    // Check if user exists
    const rows = await query(
      'SELECT id, email, name FROM users WHERE email = ? LIMIT 1',
      [EMAIL]
    )

    const user = rows[0]

    if (!user) {
      console.log(`\n❌ User with email "${EMAIL}" not found.`)
      console.log('Creating new admin user...\n')

      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10)

      await execute(
        `INSERT INTO users (name, email, password, role, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        ['Admin', EMAIL, hashedPassword, 'admin', true]
      )

      console.log('✅ Admin user created successfully!')
      console.log(`   Email:    ${EMAIL}`)
      console.log(`   Password: ${NEW_PASSWORD}`)
      console.log(`   Role:     admin\n`)
      process.exit(0)
    }

    // Update password
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10)

    await execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user.id]
    )

    console.log('\n✅ Password reset successfully!')
    console.log(`   User:     ${user.name}`)
    console.log(`   Email:    ${user.email}`)
    console.log(`   Password: ${NEW_PASSWORD}\n`)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

resetPassword()
