import { useState } from 'react'

interface Props {
  onSignup: () => void
}

export default function LoginScreen({ onSignup }: Props) {
  const [emailId, setEmailId] = useState('')
  const [password, setPassword] = useState('')
  const [pwError, setPwError] = useState('')

  const handleLogin = () => {
    if (password.length < 8) {
      setPwError('비밀번호는 8자 이상이어야 해요.')
      return
    }
    setPwError('')
    alert(`${emailId}@suwon.ac.kr 로그인 시도`)
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
            onChange={e => setEmailId(e.target.value)}
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
          onChange={e => { setPassword(e.target.value); setPwError('') }}
          className={`pw-input ${pwError ? 'error' : ''}`}
        />
        {pwError && <p className="error-msg">{pwError}</p>}
      </div>

      <button className="btn-login" onClick={handleLogin}>로그인</button>

      <button className="btn-forgot">비밀번호를 잊으셨나요?</button>

      <div className="divider" />

      <button className="btn-signup" onClick={onSignup}>회원가입하기</button>
    </div>
  )
}
