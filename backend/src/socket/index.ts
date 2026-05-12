import { Server as IOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import db from '../db'

const JWT_SECRET = process.env.JWT_SECRET || 'suwon-signal-secret-2024'

interface AuthSocket extends Socket {
  userId?: number
  nickname?: string
}

// ── 타입 정의 ──────────────────────────────────────────────────

interface SeekingRoom {
  capacity: number
  teamGender: string
  memberCount: number
  deptSet: Set<string>    // 팀 학과 집합 (중복 제거)
  allowDuplicate: boolean // true = 학과 중복 상관없음
  timestamp: number       // 매칭 시작 시각 (오래 기다린 팀 우선)
}

type SoloUser = {
  userId: number
  nickname: string
  dept: string
  allowDuplicate: boolean
  timestamp: number
}

// ── 인메모리 큐 ────────────────────────────────────────────────

// 팀 매칭 대기 방 (roomId → 정보)
const seekingRooms = new Map<number, SeekingRoom>()

// 빠른 매칭 큐: key = `${matchSize}-${gender}`
const soloQueue = new Map<string, SoloUser[]>()

// ── 유틸 ──────────────────────────────────────────────────────

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

/**
 * 두 팀의 매칭 가능 여부 판정
 * - 둘 다 allowDuplicate=true → 무조건 매칭
 * - 한 팀이라도 false → 학과 집합 교집합이 없어야 매칭
 */
function canMatch(
  a: { deptSet: Set<string>; allowDuplicate: boolean },
  b: { deptSet: Set<string>; allowDuplicate: boolean }
): boolean {
  if (a.allowDuplicate && b.allowDuplicate) return true
  for (const dept of a.deptSet) {
    if (b.deptSet.has(dept)) return false
  }
  return true
}

// ── 팀 매칭 ───────────────────────────────────────────────────

/**
 * 대기 중인 방 중 조건에 맞는 방을 찾음
 * - 같은 capacity, 반대 성별, 정원 충족
 * - 학과 중복 조건 통과
 * - 가장 오래 기다린 방 우선
 */
function findCompatibleRoom(
  capacity: number,
  myGender: string,
  myDeptSet: Set<string>,
  myAllowDuplicate: boolean
): number | null {
  const oppositeGender = myGender === '남' ? '여' : '남'

  const candidates: [number, SeekingRoom][] = []
  for (const [roomId, info] of seekingRooms.entries()) {
    if (info.capacity === capacity && info.teamGender === oppositeGender && info.memberCount === capacity) {
      candidates.push([roomId, info])
    }
  }
  // 오래 기다린 팀 우선 정렬
  candidates.sort((a, b) => a[1].timestamp - b[1].timestamp)

  for (const [roomId, info] of candidates) {
    if (canMatch(
      { deptSet: myDeptSet, allowDuplicate: myAllowDuplicate },
      { deptSet: info.deptSet, allowDuplicate: info.allowDuplicate }
    )) {
      return roomId
    }
  }
  return null
}

// ── 빠른 매칭 ─────────────────────────────────────────────────

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

function createMatchRoomAndNotify(
  io: IOServer,
  matchSize: number,
  gender: string,
  myTeam: { userId: number }[],
  theirTeam: { userId: number }[]
) {
  const allIds = [...myTeam, ...theirTeam].map(u => u.userId)
  const allDetails = allIds.map(id =>
    db.prepare('SELECT id, nickname, gender, dept, email, student_id FROM users WHERE id = ?').get(id) as {
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

  for (const id of allIds) {
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(matchRoomId, id)
  }
  db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
    .run(matchRoomId, null, '시스템', `🎉 ${matchSize}v${matchSize} 매칭이 완료되었어요!`, 'system')

  const payload = { roomId: matchRoomId, members: allDetails, size: matchSize, teamGender: gender }
  for (const id of allIds) {
    io.to(`user:${id}`).emit('match-started', payload)
  }
  console.log(`[Socket] 빠른매칭 성사: ${matchSize}v${matchSize} → room${matchRoomId}`)
}

/**
 * 빠른 매칭 큐에서 매칭 가능한 조합 탐색
 * - 가장 오래 기다린 matchSize명을 Anchor 팀으로 설정
 * - 상대 큐에서 오래 기다린 순으로 matchSize씩 슬라이딩하며 학과 조건 확인
 */
function tryCreateSoloMatch(io: IOServer, matchSize: number, gender: string) {
  const oppositeGender = gender === '남' ? '여' : '남'
  const myKey = `${matchSize}-${gender}`
  const theirKey = `${matchSize}-${oppositeGender}`

  const myQueue = soloQueue.get(myKey) ?? []
  const theirQueue = soloQueue.get(theirKey) ?? []

  if (myQueue.length < matchSize || theirQueue.length < matchSize) return

  // Anchor: 가장 오래 기다린 N명
  const myTeam = myQueue.slice(0, matchSize)
  const myDeptSet = new Set(myTeam.map(u => u.dept))
  const myAllowDuplicate = myTeam.every(u => u.allowDuplicate)

  // 상대 큐에서 오래 기다린 순으로 시도
  for (let i = 0; i <= theirQueue.length - matchSize; i++) {
    const theirTeam = theirQueue.slice(i, i + matchSize)
    const theirDeptSet = new Set(theirTeam.map(u => u.dept))
    const theirAllowDuplicate = theirTeam.every(u => u.allowDuplicate)

    if (canMatch(
      { deptSet: myDeptSet, allowDuplicate: myAllowDuplicate },
      { deptSet: theirDeptSet, allowDuplicate: theirAllowDuplicate }
    )) {
      // 매칭된 유저 큐에서 제거
      const myMatchedIds = new Set(myTeam.map(u => u.userId))
      const theirMatchedIds = new Set(theirTeam.map(u => u.userId))
      soloQueue.set(myKey, myQueue.filter(u => !myMatchedIds.has(u.userId)))
      soloQueue.set(theirKey, theirQueue.filter(u => !theirMatchedIds.has(u.userId)))

      createMatchRoomAndNotify(io, matchSize, gender, myTeam, theirTeam)

      broadcastQueueStatus(io, matchSize, gender)
      broadcastQueueStatus(io, matchSize, oppositeGender)
      return
    }
  }
  // 조건에 맞는 상대 없음 → 대기 유지
}

// ── 소켓 설정 ─────────────────────────────────────────────────

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

    if (socket.userId) socket.join(`user:${socket.userId}`)

    socket.on('join-room', (roomId: number) => {
      socket.join(`room:${roomId}`)
    })

    socket.on('leave-room', (roomId: number) => {
      socket.leave(`room:${roomId}`)
    })

    // ── 팀 매칭 ────────────────────────────────────────────────

    socket.on('start-match', ({ roomId }: { roomId: number }) => {
      const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as {
        id: number; capacity: number; team_gender: string; status: string; host_id: number; allow_duplicate: number
      } | undefined

      if (!room || room.host_id !== socket.userId) return

      const myGender = room.team_gender
      const capacity = room.capacity
      const myAllowDuplicate = room.allow_duplicate === 1

      const myMembers = db.prepare(`
        SELECT u.id, u.nickname, u.gender, u.dept, u.email, u.student_id
        FROM room_members rm JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ?
      `).all(roomId) as { id: number; nickname: string; gender: string; dept: string; email: string; student_id: string }[]

      const myMemberCount = myMembers.length
      const myDeptSet = new Set(myMembers.map(m => m.dept))

      const compatibleRoomId = findCompatibleRoom(capacity, myGender, myDeptSet, myAllowDuplicate)

      if (compatibleRoomId !== null && myMemberCount === capacity) {
        // 매칭 성사
        seekingRooms.delete(compatibleRoomId)

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
        // 대기 큐 등록
        seekingRooms.set(roomId, {
          capacity,
          teamGender: myGender,
          memberCount: myMemberCount,
          deptSet: myDeptSet,
          allowDuplicate: myAllowDuplicate,
          timestamp: Date.now(),
        })
        db.prepare("UPDATE rooms SET status = 'seeking' WHERE id = ?").run(roomId)
        io.to(`room:${roomId}`).emit('match-seeking', { roomId, memberCount: myMemberCount })

        const reason = myMemberCount < capacity
          ? `정원 미달 (${myMemberCount}/${capacity}명)`
          : compatibleRoomId === null
            ? '학과 조건에 맞는 상대팀 없음'
            : '상대팀 대기 없음'
        console.log(`[Socket] 팀매칭 대기: room${roomId} (${myGender} ${myMemberCount}/${capacity}명, 이유: ${reason})`)
      }
    })

    socket.on('cancel-match', ({ roomId }: { roomId: number }) => {
      seekingRooms.delete(roomId)
      db.prepare("UPDATE rooms SET status = 'waiting' WHERE id = ?").run(roomId)
      console.log(`[Socket] 팀매칭 취소: room${roomId}`)
    })

    // ── 빠른 매칭 (솔로 큐) ────────────────────────────────────

    socket.on('solo-queue-join', ({ matchSize, allowDuplicate }: { matchSize: number; allowDuplicate: boolean }) => {
      if (![2, 3, 4].includes(matchSize)) return

      const user = db.prepare('SELECT id, nickname, gender, dept FROM users WHERE id = ?').get(socket.userId) as {
        id: number; nickname: string; gender: string; dept: string
      } | undefined
      if (!user) return

      const key = `${matchSize}-${user.gender}`
      const queue = soloQueue.get(key) ?? []

      if (queue.find(u => u.userId === socket.userId)) {
        // 이미 대기 중 → 현재 상태만 전송
        const oppositeGender = user.gender === '남' ? '여' : '남'
        const theirQueue = soloQueue.get(`${matchSize}-${oppositeGender}`) ?? []
        socket.emit('solo-queue-status', { myCount: queue.length, theirCount: theirQueue.length, needed: matchSize })
        return
      }

      queue.push({
        userId: socket.userId!,
        nickname: user.nickname,
        dept: user.dept,
        allowDuplicate: allowDuplicate !== false,
        timestamp: Date.now(),
      })
      soloQueue.set(key, queue)

      const oppositeGender = user.gender === '남' ? '여' : '남'
      const theirQueue = soloQueue.get(`${matchSize}-${oppositeGender}`) ?? []
      socket.emit('solo-queue-status', { myCount: queue.length, theirCount: theirQueue.length, needed: matchSize })
      broadcastQueueStatus(io, matchSize, user.gender)

      console.log(`[Socket] 빠른매칭 대기: ${user.nickname} (${user.gender}, ${matchSize}v${matchSize}, 학과: ${user.dept}, 중복${allowDuplicate ? '허용' : '불가'})`)

      tryCreateSoloMatch(io, matchSize, user.gender)
    })

    socket.on('solo-queue-leave', ({ matchSize }: { matchSize: number }) => {
      const user = db.prepare('SELECT gender FROM users WHERE id = ?').get(socket.userId) as { gender: string } | undefined
      if (!user) return

      const key = `${matchSize}-${user.gender}`
      const queue = soloQueue.get(key) ?? []
      soloQueue.set(key, queue.filter(u => u.userId !== socket.userId))
      broadcastQueueStatus(io, matchSize, user.gender)
    })

    // ── 채팅 / 약속 ────────────────────────────────────────────

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
        id: msg.id, text: msg.text, senderName: msg.nickname,
        userId: msg.user_id, time, type: msg.type,
      })
    })

    socket.on('appointment-set', (data: { roomId: number; place: string; datetimeISO: string }) => {
      io.to(`room:${data.roomId}`).emit('appointment-updated', { ...data, accepted: false, verified: false })
    })

    socket.on('appointment-accept', (roomId: number) => {
      io.to(`room:${roomId}`).emit('appointment-accepted', { roomId })
    })

    socket.on('appointment-verify', (roomId: number) => {
      io.to(`room:${roomId}`).emit('appointment-verified', { roomId })
    })

    socket.on('disconnect', () => {
      for (const [key, queue] of soloQueue.entries()) {
        const next = queue.filter(u => u.userId !== socket.userId)
        if (next.length !== queue.length) soloQueue.set(key, next)
      }
      console.log(`[Socket] 해제: ${socket.nickname}`)
    })
  })
}
