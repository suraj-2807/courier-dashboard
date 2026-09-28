import app from './app.js'
import { initializeDb } from './config/db.js'
import { startBackgroundTrackingSyncCron } from './services/trackingSync.service.js'

console.log('--- STARTING COURIER ADMIN SERVER ---')

const PORT = process.env.PORT || 5000

console.log(`Attempting to bind to port: ${PORT}`)

// Start HTTP server FIRST
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server successfully running on port ${PORT}`)

  // Run DB initialization in background
  initializeDb()
    .then(() => {
      console.log('Database initialization completed.')
      startBackgroundTrackingSyncCron()
    })
    .catch((error) => {
      console.error('Database initialization failed:', error)
    })
})

server.on('error', (error) => {
  console.error('SERVER BINDING ERROR:', error)
  process.exit(1)
})