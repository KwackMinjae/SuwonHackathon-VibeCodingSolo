import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server as IOServer } from 'socket.io'
import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import roomsRoutes from './routes/rooms'
import matchRoutes from './routes/match'
import { setupSocket } from './socket'

const app = express()
const server = http.createServer(app)

const allowedOrigin = process.env.CORS_ORIGIN ?? '*'

const io = new IOServer(server, {
  cors: { origin: allowedOrigin, methods: ['GET', 'POST'] },
})

app.use(cors({ origin: allowedOrigin }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/rooms', roomsRoutes)
app.use('/api/match', matchRoutes)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

setupSocket(io)

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`\n서버 실행 중: port ${PORT}`)
})

export { io }
