import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import path from 'path'
import { fileURLToPath } from 'url'

import routes from './routes/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors())

// Parse JSON request body
app.use(express.json())

app.use(morgan('dev'))

// X-Frame-Options: Allow iframe embedding for customer-facing pages only
app.use((req, res, next) => {
  if (req.path.startsWith('/customer')) {
    // Allow embedding in iframes from any origin (WP site)
    res.setHeader('X-Frame-Options', 'ALLOWALL')
    res.removeHeader('X-Frame-Options')
  } else {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  }
  next()
})

app.use('/api', routes)

// Serve static files from React dist folder
app.use(express.static(path.join(__dirname, '../dist')))

// Fallback: serve React index.html for any frontend client routes (SPA)
app.use((req, res, next) => {
  // Only serve index.html for GET requests that aren't API calls or static files
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(__dirname, '../dist/index.html'))
  }
  next()
})

export default app