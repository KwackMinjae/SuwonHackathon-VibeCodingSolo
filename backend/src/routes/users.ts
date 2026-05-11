import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

// 내 정보 조회
router.get('/me', (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, email, nickname, gender, dept, created_at FROM users WHERE id = ?'
  ).get(req.userId) as { id: number; email: string; nickname: string; gender: string; dept: string; created_at: string } | undefined

  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
  return res.json({ user })
})

// 닉네임 수정
router.put('/profile', (req: AuthRequest, res: Response) => {
  const { nickname } = req.body as { nickname: string }
  if (!nickname) return res.status(400).json({ message: '닉네임을 입력해주세요.' })
  if (nickname.length > 10) return res.status(400).json({ message: '닉네임은 10자 이하여야 합니다.' })

  db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nickname, req.userId)
  return res.json({ message: '닉네임이 수정되었습니다.', nickname })
})

// 비밀번호 변경 (로그인 상태에서)
router.put('/password', async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string }
  if (!currentPassword || !newPassword) return res.status(400).json({ message: '필수 항목이 누락되었습니다.' })
  if (newPassword.length < 8) return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' })

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as { password_hash: string } | undefined
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return res.status(401).json({ message: '현재 비밀번호가 올바르지 않습니다.' })

  const hash = await bcrypt.hash(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.userId)
  return res.json({ message: '비밀번호가 변경되었습니다.' })
})

// 계정 삭제
router.delete('/me', async (req: AuthRequest, res: Response) => {
  const { password } = req.body as { password: string }
  if (!password) return res.status(400).json({ message: '비밀번호를 입력해주세요.' })

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.userId) as { password_hash: string } | undefined
  if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ message: '비밀번호가 올바르지 않습니다.' })

  db.prepare('DELETE FROM room_members WHERE user_id = ?').run(req.userId)
  db.prepare('DELETE FROM match_queue WHERE user_id = ?').run(req.userId)
  db.prepare('DELETE FROM users WHERE id = ?').run(req.userId)
  return res.json({ message: '계정이 삭제되었습니다.' })
})

export default router
