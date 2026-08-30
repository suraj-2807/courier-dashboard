import app from './app.js'
import { initializeDb } from './config/db.js'
import { startBackgroundTrackingSyncCron } from './services/trackingSync.service.js'

console.log('--- STARTING COURIER ADMIN SERVER ---')
const PORT = process.env.PORT || 5000
console.log(`Attempting to bind to port: ${PORT}`)

// Initialize database then start server
initializeDb().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`Server successfully running on port ${PORT}`)
    // Start background tracking & forwarding number sync cron
    startBackgroundTrackingSyncCron()
  })

  server.on('error', (error) => {
    console.error('SERVER BINDING ERROR:', error)
  })
}).catch((error) => {
  console.error('CRITICAL SERVER BOOTSTRAPPING ERROR:', error)
})