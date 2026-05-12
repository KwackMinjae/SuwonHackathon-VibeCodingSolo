import { Server as IOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import db from '../db'

const JWT_SECRET = process.env.JWT_SECRET || 'suwon-signal-secret-2024'

interface AuthSocket extends Socket {
  userId?: number
  nickname?: string
}

interface SeekingRoom {
  capacity: number
  teamGender: string
  memberCount: number
}

// 매칭 대기 중인 방 (roomId → 정보)
const seekingRooms = new Map<number, SeekingRoom>()

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function findCompatibleRoom(capacity: number, myGender: string, myMemberCount: number): number | null {
  const oppositeGender = myGender === '남' ? '여' : '남'
  for (const [roomId, info] of seekingRooms.entries()) {
    if (info.capacity === capacity && info.teamGender === oppositeGender && info.memberCount === myMemberCount) {
      return roomId
    }
  }
  return null
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

    if (socket.userId) {
      socket.join(`user:${socket.userId}`)
    }

    socket.on('join-room', (roomId: number) => {
      socket.join(`room:${roomId}`)
      console.log(`[Socket] ${socket.nickname} → room:${roomId}`)
    })

    socket.on('leave-room', (roomId: number) => {
      socket.leave(`room:${roomId}`)
    })

    // 매칭 시작: 상대팀 대기 중인 방이 있으면 즉시 매칭, 없으면 대기
    socket.on('start-match', ({ roomId }: { roomId: number }) => {
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as {
        id: number; capacity: number; team_gender: string; status: string; host_id: number
      } | undefined

      if (!room || room.host_id !== socket.userId) return

      const myGender = room.team_gender
      const capacity = room.capacity

      // 실제 현재 인원수 기준으로 매칭
      const myMemberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?').get(roomId) as { cnt: number }).cnt

      // 팀 정원이 차지 않으면 매칭 불가
      if (myMemberCount < capacity) {
        socket.emit('match-error', { message: `팀원이 부족합니다. (${myMemberCount}/${capacity}명)` })
        return
      }

      const compatibleRoomId = findCompatibleRoom(capacity, myGender, myMemberCount)

      if (compatibleRoomId !== null) {
        // 매칭 성사!
        seekingRooms.delete(compatibleRoomId)

        const myMembers = db.prepare(`
          SELECT u.id, u.nickname, u.gender, u.dept, u.email, u.student_id
          FROM room_members rm JOIN users u ON u.id = rm.user_id
          WHERE rm.room_id = ?
        `).all(roomId) as { id: number; nickname: string; gender: string; dept: string; email: string; student_id: string }[]

        const theirMembers = db.prepare(`
          SELECT u.id, u.nickname, u.gender, u.dept, u.email, u.student_id
          FROM room_members rm JOIN users u ON u.id = rm.user_id
          WHERE rm.room_id = ?
        `).all(compatibleRoomId) as { id: number; nickname: string; gender: string; dept: string; email: string; student_id: string }[]

        const allMembers = [...myMembers, ...theirMembers]

        // 새 매칭 방 생성 (실제 인원수 기준 타이틀)
        const title = `${myMemberCount}v${myMemberCount} 과팅`
        let code = makeCode()
        while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) code = makeCode()

        const result = db.prepare(
          'INSERT INTO rooms (title, code, host_id, capacity, team_gender, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(title, code, socket.userId, myMemberCount * 2, myGender, 'active') as { lastInsertRowid: number }

        const matchRoomId = Number(result.lastInsertRowid)

        for (const u of allMembers) {
          db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(matchRoomId, u.id)
        }
        db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
          .run(matchRoomId, null, '시스템', `🎉 ${myMemberCount}v${myMemberCount} 매칭이 완료되었어요!`, 'system')

        db.prepare("UPDATE rooms SET status = 'closed' WHERE id IN (?, ?)").run(roomId, compatibleRoomId)

        const payload = { roomId: matchRoomId, members: allMembers, size: myMemberCount, teamGender: myGender }
        io.to(`room:${roomId}`).emit('match-started', payload)
        io.to(`room:${compatibleRoomId}`).emit('match-started', payload)

        console.log(`[Socket] 매칭 성사: room${roomId} + room${compatibleRoomId} → room${matchRoomId} (${myMemberCount}v${myMemberCount})`)
      } else {
        // 대기 큐에 추가
        seekingRooms.set(roomId, { capacity, teamGender: myGender, memberCount: myMemberCount })
        db.prepare("UPDATE rooms SET status = 'seeking' WHERE id = ?").run(roomId)
        io.to(`room:${roomId}`).emit('match-seeking', { roomId, memberCount: myMemberCount })
        console.log(`[Socket] 매칭 대기: room${roomId} (${myGender}자 ${myMemberCount}명/${capacity}v${capacity})`)
      }
    })

    // 매칭 취소
    socket.on('cancel-match', ({ roomId }: { roomId: number }) => {
      seekingRooms.delete(roomId)
      db.prepare("UPDATE rooms SET status = 'waiting' WHERE id = ?").run(roomId)
      console.log(`[Socket] 매칭 취소: room${roomId}`)
    })

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

    socket.on('appointment-set', (data: { roomId: number; place: string; datetimeISO: string }) => {
      const { roomId } = data
      io.to(`room:${roomId}`).emit('appointment-updated', { ...data, accepted: false, verified: false })
    })

    socket.on('appointment-accept', (roomId: number) => {
      io.to(`room:${roomId}`).emit('appointment-accepted', { roomId })
    })

    socket.on('appointment-verify', (roomId: number) => {
      io.to(`room:${roomId}`).emit('appointment-verified', { roomId })
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] 해제: ${socket.nickname}`)
    })
  })
}
