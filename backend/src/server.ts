import 'dotenv/config'
import express from 'express'
import http from 'http'
import cors from 'cors'
import path from 'path'
import { Server as IOServer } from 'socket.io'
import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import roomsRoutes from './routes/rooms'
import matchRoutes from './routes/match'
import placesRoutes from './routes/places'
import { setupSocket } from './socket'
import { setIo } from './io'

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
app.use('/api/places', placesRoutes)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// 프론트엔드 정적 파일 서빙
const distPath = path.join(__dirname, '../../dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

setIo(io)
setupSocket(io)

const PORT = process.env.PORT || 8000
server.listen(PORT, () => {
  console.log(`\n서버 실행 중: http://localhost:${PORT}`)
  if (process.env.SMTP_USER) {
    console.log(`이메일 발송: ${process.env.SMTP_USER} (Gmail SMTP)`)
  } else {
    console.log('⚠️  SMTP 미설정 - .env 파일에 SMTP_USER, SMTP_PASS를 설정하세요')
  }
})

export { io }
