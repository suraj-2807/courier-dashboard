import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import routes from './routes/index.js'

const app = express()

app.use(cors())

// Parse JSON request body
app.use(express.json())

app.use(morgan('dev'))

app.use('/api', routes)

export default app