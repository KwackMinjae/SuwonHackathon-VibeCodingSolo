import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import * as brevo from '@getbrevo/brevo'
import db from '../db'
import { signToken } from '../middleware/auth'

const router = Router()

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sendVerificationEmail(to: string, code: string) {
  const apiKey = process.env.BREVO_API_KEY
  const from = process.env.MAIL_FROM || 'bongdamsignal@gmail.com'
  if (!apiKey) throw new Error('BREVO_API_KEY 환경변수를 설정해주세요.')

  const defaultClient = brevo.ApiClient.instance
  defaultClient.authentications['api-key'].apiKey = apiKey

  const client = new brevo.TransactionalEmailsApi()
  const email = new brevo.SendSmtpEmail()

  email.sender = { email: from, name: '수원시그널' }
  email.to = [{ email: to }]
  email.subject = '[수원시그널] 이메일 인증번호'
  email.textContent = `인증번호: ${code}\n\n이 코드는 10분간 유효합니다.`
  email.htmlContent = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;border:1px solid #eee;border-radius:12px">
      <h2 style="color:#1a8fa0;margin-bottom:8px">수원시그널</h2>
      <p style="color:#444;margin-bottom:24px">아래 인증번호를 입력해주세요. <strong>10분</strong> 이내에 사용해야 합니다.</p>
      <div style="background:#f0f9fa;border-radius:8px;padding:24px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:bold;color:#1a8fa0">
        ${code}
      </div>
      <p style="color:#999;font-size:12px;margin-top:24px">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
    </div>
  `
  await client.sendTransacEmail(email)
}

// 인증코드 전송
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
  const expiresAt = Date.now() + 10 * 60 * 1000

  db.prepare('DELETE FROM verification_codes WHERE email = ? AND type = ?').run(email, type)
  db.prepare(
    'INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)'
  ).run(email, code, type, expiresAt)

  try {
    await sendVerificationEmail(fullEmail, code)
    console.log(`[EMAIL] 발송 완료: ${fullEmail}`)
    return res.json({ message: '인증번호가 전송되었습니다.' })
  } catch (e) {
    console.error('[EMAIL] 발송 실패:', e)
    return res.status(500).json({ message: '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' })
  }
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
  const { email, password, nickname, gender, dept, student_id } = req.body as {
    email: string; password: string; nickname: string; gender: string; dept: string; student_id?: string
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
  const sid = student_id?.trim() ?? ''
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, nickname, gender, dept, student_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(email, passwordHash, nickname, gender, dept, sid) as { lastInsertRowid: number }

  const userId = Number(result.lastInsertRowid)
  const token = signToken(userId, email)

  return res.status(201).json({
    token,
    user: { id: userId, email, nickname, gender, dept, student_id: sid },
  })
})

// 로그인
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string }
  if (!email || !password) return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
    id: number; email: string; password_hash: string; nickname: string; gender: string; dept: string; student_id: string
  } | undefined

  if (!user) return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' })

  const token = signToken(user.id, user.email)
  return res.json({
    token,
    user: { id: user.id, email: user.email, nickname: user.nickname, gender: user.gender, dept: user.dept, student_id: user.student_id ?? '' },
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
