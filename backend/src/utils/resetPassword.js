// Password Reset Utility
// Usage: node src/utils/resetPassword.js

import bcrypt from 'bcryptjs'
import supabase from '../config/supabase.js'

const EMAIL = process.argv[2] || 'admin@princeexp.com'
const NEW_PASSWORD = process.argv[3] || 'admin123'

async function resetPassword() {
  try {
    // Check if user exists
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', EMAIL)
      .single()

    if (fetchError || !user) {
      console.log(`\n❌ User with email "${EMAIL}" not found.`)
      console.log('Creating new admin user...\n')

      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10)

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            name: 'Admin',
            email: EMAIL,
            password: hashedPassword,
            role: 'admin',
            is_active: true
          }
        ])
        .select()

      if (createError) {
        console.error('Failed to create user:', createError.message)
        process.exit(1)
      }

      console.log('✅ Admin user created successfully!')
      console.log(`   Email:    ${EMAIL}`)
      console.log(`   Password: ${NEW_PASSWORD}`)
      console.log(`   Role:     admin\n`)
      process.exit(0)
    }

    // Update password
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10)

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update password:', updateError.message)
      process.exit(1)
    }

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
