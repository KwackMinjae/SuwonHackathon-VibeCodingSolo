import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 방 만들기
router.post('/', (req: AuthRequest, res: Response) => {
  const { capacity, teamGender } = req.body as { capacity: number; teamGender: string }
  if (!capacity || !teamGender) return res.status(400).json({ message: '인원수와 팀 성별이 필요합니다.' })

  const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.userId) as { nickname: string }
  const title = `${capacity}v${capacity} 과팅`
  let code = makeCode()
  while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) code = makeCode()

  const result = db.prepare(
    'INSERT INTO rooms (title, code, host_id, capacity, team_gender) VALUES (?, ?, ?, ?, ?)'
  ).run(title, code, req.userId, capacity, teamGender) as { lastInsertRowid: number }

  const roomId = Number(result.lastInsertRowid)
  db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(roomId, req.userId)

  // 시스템 메시지
  db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
    .run(roomId, null, '시스템', `🏠 ${user.nickname}님이 방을 만들었어요!`, 'system')

  return res.status(201).json({
    room: { id: roomId, title, code, capacity, teamGender, memberCount: 1 },
  })
})

// 공개 방 목록
router.get('/public', (req: AuthRequest, res: Response) => {
  const rooms = db.prepare(`
    SELECT r.id, r.title, r.code, r.capacity, r.team_gender AS teamGender,
           COUNT(rm.id) AS memberCount
    FROM rooms r
    LEFT JOIN room_members rm ON rm.room_id = r.id
    WHERE r.status = 'waiting'
    GROUP BY r.id
    HAVING memberCount < r.capacity
    ORDER BY r.created_at DESC
    LIMIT 20
  `).all()
  return res.json({ rooms })
})

// 코드로 방 참여
router.post('/join', (req: AuthRequest, res: Response) => {
  const { code } = req.body as { code: string }
  if (!code) return res.status(400).json({ message: '초대 코드가 필요합니다.' })

  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code) as {
    id: number; title: string; code: string; capacity: number; team_gender: string; status: string
  } | undefined

  if (!room) return res.status(404).json({ message: '존재하지 않는 방입니다.' })
  if (room.status !== 'waiting') return res.status(400).json({ message: '이미 시작된 방입니다.' })

  const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?').get(room.id) as { cnt: number }).cnt
  if (memberCount >= room.capacity) return res.status(400).json({ message: '방이 가득 찼습니다.' })

  const alreadyIn = db.prepare('SELECT id FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.userId)
  if (!alreadyIn) {
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, req.userId)
    const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.userId) as { nickname: string }
    db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
      .run(room.id, null, '시스템', `👋 ${user.nickname}님이 입장했어요!`, 'system')
  }

  const newCount = memberCount + (alreadyIn ? 0 : 1)
  return res.json({
    room: { id: room.id, title: room.title, code: room.code, capacity: room.capacity, teamGender: room.team_gender, memberCount: newCount },
  })
})

// 방 정보 조회
router.get('/:id', (req: AuthRequest, res: Response) => {
  const roomId = parseInt(req.params.id)

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as {
    id: number; title: string; code: string; capacity: number; team_gender: string; status: string
  } | undefined

  if (!room) return res.status(404).json({ message: '방을 찾을 수 없습니다.' })

  const members = db.prepare(`
    SELECT u.id, u.nickname, u.gender, u.dept, u.email
    FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?
  `).all(roomId) as { id: number; nickname: string; gender: string; dept: string; email: string }[]

  const messages = db.prepare(
    'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC'
  ).all(roomId)

  const appointment = db.prepare('SELECT * FROM appointments WHERE room_id = ?').get(roomId)

  return res.json({ room: { ...room, teamGender: room.team_gender, members, messages, appointment } })
})

// 방 나가기
router.delete('/:id/leave', (req: AuthRequest, res: Response) => {
  const roomId = parseInt(req.params.id)
  const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.userId) as { nickname: string }

  db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, req.userId)
  db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
    .run(roomId, null, '시스템', `🚪 ${user.nickname}님이 퇴장했어요.`, 'system')

  const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?').get(roomId) as { cnt: number }).cnt
  if (memberCount === 0) {
    db.prepare("UPDATE rooms SET status = 'closed' WHERE id = ?").run(roomId)
  }

  return res.json({ message: '방을 나갔습니다.' })
})

// 약속 설정
router.post('/:id/appointment', (req: AuthRequest, res: Response) => {
  const roomId = parseInt(req.params.id)
  const { place, datetimeISO } = req.body as { place: string; datetimeISO: string }
  if (!place || !datetimeISO) return res.status(400).json({ message: '장소와 시간이 필요합니다.' })

  db.prepare(`
    INSERT INTO appointments (room_id, place, datetime_iso)
    VALUES (?, ?, ?)
    ON CONFLICT(room_id) DO UPDATE SET place = excluded.place, datetime_iso = excluded.datetime_iso, accepted = 0, verified = 0
  `).run(roomId, place, datetimeISO)

  db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
    .run(roomId, req.userId, null, '', 'appointment')

  return res.json({ message: '약속이 설정되었습니다.' })
})

// 약속 수락
router.put('/:id/appointment/accept', (req: AuthRequest, res: Response) => {
  const roomId = parseInt(req.params.id)
  db.prepare('UPDATE appointments SET accepted = 1 WHERE room_id = ?').run(roomId)
  return res.json({ message: '약속이 수락되었습니다.' })
})

// 만남 인증
router.put('/:id/appointment/verify', (req: AuthRequest, res: Response) => {
  const roomId = parseInt(req.params.id)
  db.prepare('UPDATE appointments SET verified = 1 WHERE room_id = ?').run(roomId)
  return res.json({ message: '만남이 인증되었습니다.' })
})

// 별점 등록
router.post('/:id/ratings', (req: AuthRequest, res: Response) => {
  const roomId = parseInt(req.params.id)
  const { rateeId, stars } = req.body as { rateeId: number; stars: number }
  if (!rateeId || !stars) return res.status(400).json({ message: '필수 항목이 누락되었습니다.' })

  db.prepare(`
    INSERT INTO ratings (room_id, rater_id, ratee_id, stars)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(room_id, rater_id, ratee_id) DO UPDATE SET stars = excluded.stars
  `).run(roomId, req.userId, rateeId, stars)

  return res.json({ message: '별점이 등록되었습니다.' })
})

export default router
