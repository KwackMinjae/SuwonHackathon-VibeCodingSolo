import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 즉시 랜덤매칭 - 같은 조건의 유저들로 방 생성
router.post('/instant', async (req: AuthRequest, res: Response) => {
  const { size, teamGender } = req.body as { size: number; teamGender: '남' | '여' }
  if (!size || !teamGender) return res.status(400).json({ message: '인원수와 성별이 필요합니다.' })

  const currentUser = await db.get<{
    id: number; nickname: string; gender: string; dept: string; email: string; student_id: string
  }>('SELECT id, nickname, gender, dept, email, student_id FROM users WHERE id = ?', req.userId)

  if (!currentUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

  const otherGender = teamGender === '남' ? '여' : '남'

  const myTeamPool = await db.all<{ id: number; nickname: string; gender: string; dept: string; email: string; student_id: string }>(
    'SELECT id, nickname, gender, dept, email, student_id FROM users WHERE id != ? AND gender = ? LIMIT ?',
    req.userId, teamGender, size - 1
  )

  const otherTeamPool = await db.all<{ id: number; nickname: string; gender: string; dept: string; email: string; student_id: string }>(
    'SELECT id, nickname, gender, dept, email, student_id FROM users WHERE gender = ? LIMIT ?',
    otherGender, size
  )

  const myTeam = [currentUser, ...myTeamPool.slice(0, size - 1)]
  const otherTeam = otherTeamPool.slice(0, size)

  const title = `${size}v${size} 랜덤매칭`
  let code = makeCode()
  while (await db.get('SELECT id FROM rooms WHERE code = ?', code)) code = makeCode()

  const result = await db.run(
    'INSERT INTO rooms (title, code, host_id, capacity, team_gender, status) VALUES (?, ?, ?, ?, ?, ?)',
    title, code, req.userId, size, teamGender, 'active'
  )

  const roomId = result.lastInsertRowid

  for (const u of [...myTeam, ...otherTeam]) {
    const exists = await db.get('SELECT id FROM users WHERE id = ?', u.id)
    if (exists) {
      await db.run('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)', roomId, u.id)
    }
  }

  await db.run(
    'INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)',
    roomId, null, '시스템', `🎉 ${size}v${size} 매칭이 완료되었어요!`, 'system'
  )

  return res.status(201).json({
    roomId,
    room: { id: roomId, title, code, capacity: size, teamGender, memberCount: myTeam.length + otherTeam.length },
    myTeam: myTeam.map(u => ({ id: u.id, nickname: u.nickname, studentId: u.student_id || '', gender: u.gender, dept: u.dept })),
    otherTeam: otherTeam.map(u => ({ id: u.id, nickname: u.nickname, studentId: u.student_id || '', gender: u.gender, dept: u.dept })),
    size,
  })
})

export default router
