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

import fs from 'fs'

const distIndexPath = path.join(__dirname, '../dist/index.html')
console.log('--- SPA DIST INDEX CHECK ---')
console.log('Target index.html path:', distIndexPath)
console.log('index.html exists:', fs.existsSync(distIndexPath))

// Serve static files from React dist folder
app.use(express.static(path.join(__dirname, '../dist')))

// Catch-all SPA route for any non-API GET request (Hostinger Node Web App recommendation)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  if (fs.existsSync(distIndexPath)) {
    return res.sendFile(distIndexPath)
  }
  res.status(404).send('index.html not found on server')
})

export default app