import { useState } from 'react'
import { api, setToken, storeUser, UserInfo } from '../api/client'
import { reconnectSocket } from '../api/socket'

interface Props {
  onSignup: () => void
  onForgot: () => void
  onLogin: (user: UserInfo) => void
}

export default function LoginScreen({ onSignup, onForgot, onLogin }: Props) {
  const [emailId, setEmailId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!emailId) { setError('이메일 아이디를 입력해주세요.'); return }
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 해요.'); return }
    setError('')
    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserInfo }>('/auth/login', {
        email: emailId,
        password,
      })
      setToken(data.token)
      storeUser(data.user)
      reconnectSocket()
      onLogin(data.user)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <h2 className="login-title">로그인</h2>

      <div className="input-group">
        <label>학교 이메일</label>
        <div className="email-row">
          <input
            type="text"
            placeholder="아이디 입력"
            value={emailId}
            onChange={e => { setEmailId(e.target.value); setError('') }}
            className="email-input"
          />
          <span className="email-domain">@suwon.ac.kr</span>
        </div>
      </div>

      <div className="input-group">
        <label>비밀번호</label>
        <input
          type="password"
          placeholder="8자 이상 입력"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          className={`pw-input ${error ? 'error' : ''}`}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
        {error && <p className="error-msg">{error}</p>}
      </div>

      <button className="btn-login" onClick={handleLogin} disabled={loading}>
        {loading ? '로그인 중...' : '로그인'}
      </button>

      <button className="btn-forgot" onClick={onForgot}>비밀번호를 잊으셨나요?</button>

      <div className="divider" />

      <button className="btn-signup" onClick={onSignup}>회원가입하기</button>
    </div>
  )
}
