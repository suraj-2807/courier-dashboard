import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

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

const distPath = path.resolve(__dirname, '..', 'dist')
const distIndexPath = path.resolve(distPath, 'index.html')
console.log('--- SPA DIST INDEX CHECK ---')
console.log('Target index.html path:', distIndexPath)
console.log('index.html exists:', fs.existsSync(distIndexPath))

// Serve static files from React dist folder
app.use(express.static(distPath))

// Catch-all SPA route for any non-API GET request (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    // Try sendFile first, with error handling fallback
    res.sendFile(distIndexPath, (err) => {
      if (err) {
        // Fallback: read the file and send it manually
        try {
          const html = fs.readFileSync(distIndexPath, 'utf-8')
          res.type('html').send(html)
        } catch (readErr) {
          console.error('SPA fallback failed:', readErr.message)
          next()
        }
      }
    })
    return
  }
  next()
})

export default app