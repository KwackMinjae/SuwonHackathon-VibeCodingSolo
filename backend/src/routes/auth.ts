import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import nodemailer from 'nodemailer'
import db from '../db'
import { signToken } from '../middleware/auth'

const router = Router()

async function getTransporter() {
  const testAccount = await nodemailer.createTestAccount()
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  })
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 인증코드 전송 (회원가입 / 비밀번호 재설정 공통)
router.post('/send-code', async (req: Request, res: Response) => {
  const { email, type } = req.body as { email: string; type: 'signup' | 'reset' }
  if (!email || !type) return res.status(400).json({ message: '이메일과 타입이 필요합니다.' })

  const fullEmail = `${email}@suwon.ac.kr`

  if (type === 'signup') {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return res.status(409).json({ message: '이미 가입된 이메일입니다.' })
  }

  if (type === 'reset') {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (!user) return res.status(404).json({ message: '가입되지 않은 이메일입니다.' })
  }

  const code = generateCode()
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10분

  db.prepare('DELETE FROM verification_codes WHERE email = ? AND type = ?').run(email, type)
  db.prepare(
    'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)'
  ).run(email, code, type, expiresAt)

  // 이메일 전송 시도
  try {
    const transporter = await getTransporter()
    const info = await transporter.sendMail({
      from: '"수원시그널" <no-reply@suwon-signal.kr>',
      to: fullEmail,
      subject: '[수원시그널] 인증번호 안내',
      text: `인증번호: ${code}\n10분 이내에 입력해주세요.`,
    })
    console.log(`[EMAIL] 인증코드 발송: ${fullEmail} → ${code}`)
    console.log(`[EMAIL] 미리보기: ${nodemailer.getTestMessageUrl(info)}`)
  } catch (e) {
    console.log(`[EMAIL] 발송 실패 (코드: ${code}) → ${fullEmail}`)
  }

  // 개발 편의: 응답에 코드 포함
  return res.json({ message: '인증번호가 전송되었습니다.', code })
})

// 인증코드 확인
router.post('/verify-code', (req: Request, res: Response) => {
  const { email, code, type } = req.body as { email: string; code: string; type: string }
  if (!email || !code || !type) return res.status(400).json({ message: '필수 항목이 누락되었습니다.' })

  const row = db.prepare(
    'SELECT * FROM verification_codes WHERE email = ? AND type = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).get(email, type) as { id: number; code: string; expires_at: number } | undefined

  if (!row) return res.status(400).json({ message: '인증번호를 먼저 전송해주세요.' })
  if (Date.now() > row.expires_at) return res.status(400).json({ message: '인증번호가 만료되었습니다.' })
  if (row.code !== code) return res.status(400).json({ message: '인증번호가 올바르지 않습니다.' })

  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(row.id)
  return res.json({ message: '인증 완료' })
})

// 회원가입
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, nickname, gender, dept } = req.body as {
    email: string; password: string; nickname: string; gender: string; dept: string
  }

  if (!email || !password || !nickname || !gender || !dept) {
    return res.status(400).json({ message: '필수 항목이 누락되었습니다.' })
  }
  if (password.length < 8) return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' })
  if (nickname.length > 10) return res.status(400).json({ message: '닉네임은 10자 이하여야 합니다.' })

  const verified = db.prepare(
    'SELECT id FROM verification_codes WHERE email = ? AND type = ? AND used = 1 ORDER BY id DESC LIMIT 1'
  ).get(email, 'signup')
  if (!verified) return res.status(403).json({ message: '이메일 인증을 먼저 완료해주세요.' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) return res.status(409).json({ message: '이미 가입된 이메일입니다.' })

  const passwordHash = await bcrypt.hash(password, 10)
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, nickname, gender, dept) VALUES (?, ?, ?, ?, ?)'
  ).run(email, passwordHash, nickname, gender, dept) as { lastInsertRowid: number }

  const userId = Number(result.lastInsertRowid)
  const token = signToken(userId, email)

  return res.status(201).json({
    token,
    user: { id: userId, email, nickname, gender, dept },
  })
})

// 로그인
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string }
  if (!email || !password) return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
    id: number; email: string; password_hash: string; nickname: string; gender: string; dept: string
  } | undefined

  if (!user) return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })

  const token = signToken(user.id, user.email)
  return res.json({
    token,
    user: { id: user.id, email: user.email, nickname: user.nickname, gender: user.gender, dept: user.dept },
  })
})

// 비밀번호 재설정
router.post('/reset-password', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string }
  if (!email || !password) return res.status(400).json({ message: '필수 항목이 누락되었습니다.' })
  if (password.length < 8) return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' })

  const verified = db.prepare(
    'SELECT id FROM verification_codes WHERE email = ? AND type = ? AND used = 1 ORDER BY id DESC LIMIT 1'
  ).get(email, 'reset')
  if (!verified) return res.status(403).json({ message: '이메일 인증을 먼저 완료해주세요.' })

  const passwordHash = await bcrypt.hash(password, 10)
  const result = db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(passwordHash, email) as { changes: number }
  if (result.changes === 0) return res.status(404).json({ message: '존재하지 않는 사용자입니다.' })

  return res.json({ message: '비밀번호가 재설정되었습니다.' })
})

export default router
