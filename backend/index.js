// Global uncaught exception handlers to redirect all errors to stdout
process.on('uncaughtException', (err) => {
  console.log('=== CRITICAL UNCAUGHT EXCEPTION ===')
  console.log('Error Message:', err.message)
  console.log('Stack Trace:\n', err.stack)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.log('=== CRITICAL UNHANDLED REJECTION ===')
  console.log('Reason:', reason)
  if (reason && reason.stack) {
    console.log('Stack Trace:\n', reason.stack)
  }
})

console.log('--- WRAPPER BOOTSTRAPPING COURIER ADMIN SERVER ---')

// Dynamically import the main server entrypoint
import('./src/server.js').catch((err) => {
  console.log('=== IMPORT ERROR IN SERVER.JS ===')
  console.log('Error Message:', err.message)
  console.log('Stack Trace:\n', err.stack)
  process.exit(1)
})
