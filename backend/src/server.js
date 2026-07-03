import app from './app.js'

console.log('--- STARTING COURIER ADMIN SERVER ---')
const PORT = process.env.PORT || 5000
console.log(`Attempting to bind to port: ${PORT}`)

const server = app.listen(PORT, () => {
  console.log(`Server successfully running on port ${PORT}`)
})

server.on('error', (error) => {
  console.error('SERVER BINDING ERROR:', error)
})