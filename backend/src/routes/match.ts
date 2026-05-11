import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 즉시 랜덤매칭 - 같은 조건의 유저들로 방 생성
router.post('/instant', (req: AuthRequest, res: Response) => {
  const { size, teamGender } = req.body as { size: number; teamGender: '남' | '여' }
  if (!size || !teamGender) return res.status(400).json({ message: '인원수와 성별이 필요합니다.' })

  const currentUser = db.prepare('SELECT id, nickname, gender, dept, email FROM users WHERE id = ?').get(req.userId) as {
    id: number; nickname: string; gender: string; dept: string; email: string
  }

  if (!currentUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

  const otherGender = teamGender === '남' ? '여' : '남'

  // 내 팀: 같은 성별 유저 (나 제외, 최대 size-1명)
  const myTeamPool = db.prepare(
    'SELECT id, nickname, gender, dept, email FROM users WHERE id != ? AND gender = ? LIMIT ?'
  ).all(req.userId, teamGender, size - 1) as { id: number; nickname: string; gender: string; dept: string; email: string }[]

  // 상대팀: 반대 성별 유저 최대 size명
  const otherTeamPool = db.prepare(
    'SELECT id, nickname, gender, dept, email FROM users WHERE gender = ? LIMIT ?'
  ).all(otherGender, size) as { id: number; nickname: string; gender: string; dept: string; email: string }[]

  const myTeam = [currentUser, ...myTeamPool.slice(0, size - 1)]
  const otherTeam = otherTeamPool.slice(0, size)

  // 방 생성
  const title = `${size}v${size} 랜덤매칭`
  let code = makeCode()
  while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) code = makeCode()

  const result = db.prepare(
    'INSERT INTO rooms (title, code, host_id, capacity, team_gender, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, code, req.userId, size, teamGender, 'active') as { lastInsertRowid: number }

  const roomId = Number(result.lastInsertRowid)

  // 모든 멤버 추가
  for (const u of [...myTeam, ...otherTeam]) {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(u.id)
    if (exists) {
      try {
        db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(roomId, u.id)
      } catch (_) { /* ignore */ }
    }
  }

  // 시스템 메시지
  db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
    .run(roomId, null, '시스템', `🎉 ${size}v${size} 매칭이 완료되었어요!`, 'system')

  for (const u of otherTeam) {
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(u.id)
    if (exists) {
      db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
        .run(roomId, u.id, u.nickname, `안녕하세요! 저는 ${u.nickname}이에요 😊`, 'text')
    }
  }

  return res.status(201).json({
    roomId,
    room: { id: roomId, title, code, capacity: size, teamGender, memberCount: myTeam.length + otherTeam.length },
    myTeam: myTeam.map(u => ({ nickname: u.nickname, studentId: u.email.slice(0, 2) + '학번', gender: u.gender, dept: u.dept })),
    otherTeam: otherTeam.map(u => ({ nickname: u.nickname, studentId: u.email.slice(0, 2) + '학번', gender: u.gender, dept: u.dept })),
    size,
  })
})

export default router
