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

type SoloUser = { userId: number; nickname: string }

// 팀 매칭 대기 방 (roomId → 정보)
const seekingRooms = new Map<number, SeekingRoom>()

// 빠른 매칭 큐: key = `${matchSize}-${gender}`  (예: "3-남", "3-여")
const soloQueue = new Map<string, SoloUser[]>()

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function findCompatibleRoom(capacity: number, myGender: string): number | null {
  const oppositeGender = myGender === '남' ? '여' : '남'
  for (const [roomId, info] of seekingRooms.entries()) {
    if (info.capacity === capacity && info.teamGender === oppositeGender && info.memberCount === capacity) {
      return roomId
    }
  }
  return null
}

// 빠른 매칭 큐 상태를 해당 큐의 모든 대기자에게 전송
function broadcastQueueStatus(io: IOServer, matchSize: number, gender: string) {
  const oppositeGender = gender === '남' ? '여' : '남'
  const myQueue = soloQueue.get(`${matchSize}-${gender}`) ?? []
  const theirQueue = soloQueue.get(`${matchSize}-${oppositeGender}`) ?? []

  for (const u of myQueue) {
    io.to(`user:${u.userId}`).emit('solo-queue-status', {
      myCount: myQueue.length,
      theirCount: theirQueue.length,
      needed: matchSize,
    })
  }
}

// 양쪽 큐가 모두 matchSize 이상이면 매칭 성사
function tryCreateSoloMatch(io: IOServer, matchSize: number, gender: string) {
  const oppositeGender = gender === '남' ? '여' : '남'
  const myKey = `${matchSize}-${gender}`
  const theirKey = `${matchSize}-${oppositeGender}`

  const myQueue = soloQueue.get(myKey) ?? []
  const theirQueue = soloQueue.get(theirKey) ?? []

  if (myQueue.length < matchSize || theirQueue.length < matchSize) return

  // 각 큐에서 앞에서부터 matchSize명 추출
  const myTeam = myQueue.splice(0, matchSize)
  const theirTeam = theirQueue.splice(0, matchSize)
  soloQueue.set(myKey, myQueue)
  soloQueue.set(theirKey, theirQueue)

  const allUsers = [...myTeam, ...theirTeam]

  const allDetails = allUsers.map(u =>
    db.prepare('SELECT id, nickname, gender, dept, email, student_id FROM users WHERE id = ?').get(u.userId) as {
      id: number; nickname: string; gender: string; dept: string; email: string; student_id: string
    }
  ).filter(Boolean)

  const title = `${matchSize}v${matchSize} 과팅`
  let code = makeCode()
  while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) code = makeCode()

  const result = db.prepare(
    'INSERT INTO rooms (title, code, host_id, capacity, team_gender, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, code, myTeam[0].userId, matchSize * 2, gender, 'active') as { lastInsertRowid: number }

  const matchRoomId = Number(result.lastInsertRowid)

  for (const u of allDetails) {
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(matchRoomId, u.id)
  }
  db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
    .run(matchRoomId, null, '시스템', `🎉 ${matchSize}v${matchSize} 매칭이 완료되었어요!`, 'system')

  const payload = { roomId: matchRoomId, members: allDetails, size: matchSize, teamGender: gender }

  for (const u of allUsers) {
    io.to(`user:${u.userId}`).emit('match-started', payload)
  }

  // 나머지 대기자에게 업데이트된 큐 상태 전송
  broadcastQueueStatus(io, matchSize, gender)
  broadcastQueueStatus(io, matchSize, oppositeGender)

  console.log(`[Socket] 빠른매칭 성사: ${matchSize}v${matchSize} (${gender} vs ${oppositeGender}) → room${matchRoomId}`)
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

    // ── 팀 매칭 ──────────────────────────────────────────────

    socket.on('start-match', ({ roomId }: { roomId: number }) => {
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as {
        id: number; capacity: number; team_gender: string; status: string; host_id: number
      } | undefined

      if (!room || room.host_id !== socket.userId) return

      const myGender = room.team_gender
      const capacity = room.capacity
      const myMemberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?').get(roomId) as { cnt: number }).cnt

      const compatibleRoomId = findCompatibleRoom(capacity, myGender)

      if (compatibleRoomId !== null && myMemberCount === capacity) {
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

        console.log(`[Socket] 팀매칭 성사: room${roomId} + room${compatibleRoomId} → room${matchRoomId}`)
      } else {
        seekingRooms.set(roomId, { capacity, teamGender: myGender, memberCount: myMemberCount })
        db.prepare("UPDATE rooms SET status = 'seeking' WHERE id = ?").run(roomId)
        io.to(`room:${roomId}`).emit('match-seeking', { roomId, memberCount: myMemberCount })
        console.log(`[Socket] 팀매칭 대기: room${roomId} (${myGender} ${myMemberCount}/${capacity}명)`)
      }
    })

    socket.on('cancel-match', ({ roomId }: { roomId: number }) => {
      seekingRooms.delete(roomId)
      db.prepare("UPDATE rooms SET status = 'waiting' WHERE id = ?").run(roomId)
      console.log(`[Socket] 팀매칭 취소: room${roomId}`)
    })

    // ── 빠른 매칭 (솔로 큐) ──────────────────────────────────

    socket.on('solo-queue-join', ({ matchSize }: { matchSize: number }) => {
      if (![2, 3, 4].includes(matchSize)) return

      const user = db.prepare('SELECT id, nickname, gender FROM users WHERE id = ?').get(socket.userId) as {
        id: number; nickname: string; gender: string
      } | undefined
      if (!user) return

      const key = `${matchSize}-${user.gender}`
      const queue = soloQueue.get(key) ?? []

      // 중복 방지
      if (queue.find(u => u.userId === socket.userId)) {
        // 이미 대기 중이면 현재 상태만 전송
        const oppositeGender = user.gender === '남' ? '여' : '남'
        const theirQueue = soloQueue.get(`${matchSize}-${oppositeGender}`) ?? []
        socket.emit('solo-queue-status', { myCount: queue.length, theirCount: theirQueue.length, needed: matchSize })
        return
      }

      queue.push({ userId: socket.userId!, nickname: user.nickname })
      soloQueue.set(key, queue)

      const oppositeGender = user.gender === '남' ? '여' : '남'
      const theirQueue = soloQueue.get(`${matchSize}-${oppositeGender}`) ?? []

      // 현재 유저에게 큐 상태 전송
      socket.emit('solo-queue-status', { myCount: queue.length, theirCount: theirQueue.length, needed: matchSize })
      // 같은 큐 다른 대기자들에게도 업데이트
      broadcastQueueStatus(io, matchSize, user.gender)

      console.log(`[Socket] 빠른매칭 대기: ${user.nickname} (${user.gender}, ${matchSize}v${matchSize}) — 큐: ${queue.length}명`)

      // 매칭 시도
      tryCreateSoloMatch(io, matchSize, user.gender)
    })

    socket.on('solo-queue-leave', ({ matchSize }: { matchSize: number }) => {
      const user = db.prepare('SELECT gender FROM users WHERE id = ?').get(socket.userId) as { gender: string } | undefined
      if (!user) return

      const key = `${matchSize}-${user.gender}`
      const queue = soloQueue.get(key) ?? []
      soloQueue.set(key, queue.filter(u => u.userId !== socket.userId))

      broadcastQueueStatus(io, matchSize, user.gender)
      console.log(`[Socket] 빠른매칭 취소: userId=${socket.userId} (${matchSize}v${matchSize})`)
    })

    // ── 채팅 / 약속 ──────────────────────────────────────────

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
      // 연결 끊기면 모든 솔로 큐에서 제거
      for (const [key, queue] of soloQueue.entries()) {
        const next = queue.filter(u => u.userId !== socket.userId)
        if (next.length !== queue.length) soloQueue.set(key, next)
      }
      console.log(`[Socket] 해제: ${socket.nickname}`)
    })
  })
}
