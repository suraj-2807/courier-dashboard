import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query, execute } from '../../config/db.js'

export const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'operator'
    } = req.body

    const hashedPassword =
      await bcrypt.hash(password, 10)

    const result = await execute(
      `INSERT INTO users (name, email, password, role)
       VALUES (?, ?, ?, ?)`,
      [name, email, hashedPassword, role]
    )

    const rows = await query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [result.insertId]
    )

    return res.status(201).json({
      success: true,
      user: rows[0]
    })
  } catch (error) {
    console.error(error)

    // Handle duplicate email
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      })
    }

    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const rows = await query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]
    )

    const user = rows[0]

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        user.password
      )

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      })
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn:
          process.env.JWT_EXPIRES_IN
      }
    )

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const me = async (req, res) => {
  return res.json({
    success: true,
    user: req.user
  })
}