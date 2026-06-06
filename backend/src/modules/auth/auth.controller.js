import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import supabase from '../../config/supabase.js'

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

    const { data, error } =
      await supabase
        .from('users')
        .insert([
          {
            name,
            email,
            password: hashedPassword,
            role
          }
        ])
        .select()

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      })
    }

    return res.status(201).json({
      success: true,
      user: data[0]
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const { data, error } =
      await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

    if (error || !data) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        data.password
      )

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      })
    }

    const token = jwt.sign(
      {
        id: data.id,
        role: data.role
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
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role
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