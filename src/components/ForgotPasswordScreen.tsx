import { useState } from 'react'

type Step = 'email' | 'verify' | 'reset'

interface Props {
  onBack: () => void
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export default function ForgotPasswordScreen({ onBack }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [emailId, setEmailId] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [done, setDone] = useState(false)

  const sendCode = () => {
    const code = generateCode()
    setSentCode(code)
    setInputCode('')
    setCodeError(false)
    setStep('verify')
    // 실제 서비스에서는 이메일 API 호출
    alert(`[개발 테스트용]\n${emailId}@suwon.ac.kr 로 인증번호가 전송됐어요.\n인증번호: ${code}`)
  }

  const verifyCode = () => {
    if (inputCode === sentCode) {
      setCodeError(false)
      setStep('reset')
    } else {
      setCodeError(true)
    }
  }

  const resetPassword = () => {
    if (newPw.length < 8) {
      setPwError('비밀번호는 8자 이상이어야 해요.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('비밀번호가 일치하지 않아요.')
      return
    }
    setPwError('')
    setDone(true)
    setTimeout(() => onBack(), 2000)
  }

  if (done) {
    return (
      <div className="login-wrap" style={{ textAlign: 'center', gap: 16 }}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 className="login-title">비밀번호 재설정 완료!</h2>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>로그인 화면으로 이동합니다...</p>
      </div>
    )
  }

  return (
    <div className="login-wrap">
      <button className="btn-back" onClick={onBack}>← 로그인으로</button>
      <h2 className="login-title">비밀번호 찾기</h2>

      {/* Step 1: 이메일 입력 */}
      {step === 'email' && (
        <>
          <p className="step-desc">가입한 학교 이메일을 입력해주세요.</p>
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
          <button className="btn-login" onClick={sendCode} disabled={!emailId}>
            인증번호 전송
          </button>
        </>
      )}

      {/* Step 2: 인증번호 확인 */}
      {step === 'verify' && (
        <>
          <p className="step-desc">
            <b>{emailId}@suwon.ac.kr</b> 로 전송된<br />인증번호 6자리를 입력해주세요.
          </p>
          <div className="input-group">
            <label>인증번호</label>
            <input
              type="text"
              placeholder="인증번호 6자리"
              value={inputCode}
              onChange={e => { setInputCode(e.target.value); setCodeError(false) }}
              className={`pw-input ${codeError ? 'error' : ''}`}
              maxLength={6}
            />
            {codeError && <p className="error-msg">인증번호를 확인해주세요.</p>}
          </div>
          <button className="btn-login" onClick={verifyCode} disabled={inputCode.length !== 6}>
            확인
          </button>
          <button className="btn-forgot" onClick={sendCode}>
            인증번호 재전송하기
          </button>
        </>
      )}

      {/* Step 3: 비밀번호 재설정 */}
      {step === 'reset' && (
        <>
          <p className="step-desc">새로운 비밀번호를 입력해주세요.</p>
          <div className="input-group">
            <label>새 비밀번호</label>
            <input
              type="password"
              placeholder="8자 이상 입력"
              value={newPw}
              onChange={e => { setNewPw(e.target.value); setPwError('') }}
              className="pw-input"
            />
          </div>
          <div className="input-group">
            <label>비밀번호 확인</label>
            <input
              type="password"
              placeholder="비밀번호 재입력"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
              className={`pw-input ${pwError ? 'error' : ''}`}
            />
            {pwError && <p className="error-msg">{pwError}</p>}
          </div>
          <button className="btn-login" onClick={resetPassword}>
            비밀번호 재설정
          </button>
        </>
      )}
    </div>
  )
}
