import { Server as IOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import db from '../db'

const JWT_SECRET = process.env.JWT_SECRET || 'suwon-signal-secret-2024'

interface AuthSocket extends Socket {
  userId?: number
  nickname?: string
}

export function setupSocket(io: IOServer) {
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('인증이 필요합니다.'))
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number }
      socket.userId = payload.userId
      const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(payload.userId) as { nickname: string } | undefined
      socket.nickname = user?.nickname ?? '알 수 없음'
      next()
    } catch {
      next(new Error('유효하지 않은 토큰입니다.'))
    }
  })

  io.on('connection', (socket: AuthSocket) => {
    console.log(`[Socket] 연결: ${socket.nickname} (${socket.userId})`)

    // 채팅방 입장
    socket.on('join-room', (roomId: number) => {
      socket.join(`room:${roomId}`)
      console.log(`[Socket] ${socket.nickname} → room:${roomId}`)
    })

    // 채팅방 퇴장
    socket.on('leave-room', (roomId: number) => {
      socket.leave(`room:${roomId}`)
    })

    // 메시지 전송
    socket.on('send-message', (data: { roomId: number; text: string }) => {
      const { roomId, text } = data
      if (!text?.trim() || !roomId) return

      const result = db.prepare(
        'INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)'
      ).run(roomId, socket.userId, socket.nickname, text.trim(), 'text') as { lastInsertRowid: number }

      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(result.lastInsertRowid)) as {
        id: number; room_id: number; user_id: number; nickname: string; text: string; type: string; created_at: string
      }

      const now = new Date()
      const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

      io.to(`room:${roomId}`).emit('new-message', {
        id: msg.id,
        text: msg.text,
        senderName: msg.nickname,
        userId: msg.user_id,
        time,
        type: msg.type,
      })
    })

    // 약속 설정 알림
    socket.on('appointment-set', (data: { roomId: number; place: string; datetimeISO: string }) => {
      const { roomId } = data
      io.to(`room:${roomId}`).emit('appointment-updated', { ...data, accepted: false, verified: false })
    })

    // 약속 수락 알림
    socket.on('appointment-accept', (roomId: number) => {
      io.to(`room:${roomId}`).emit('appointment-accepted', { roomId })
    })

    // 만남 인증 알림
    socket.on('appointment-verify', (roomId: number) => {
      io.to(`room:${roomId}`).emit('appointment-verified', { roomId })
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] 해제: ${socket.nickname}`)
    })
  })
}
