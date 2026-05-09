import { useState } from 'react'

type View = 'main' | 'profile' | 'pwStep1' | 'pwStep2' | 'pwStep3' | 'deleteConfirm' | 'deleteConfirm2' | 'deleted'

interface Props {
  onLogout: () => void
  onAccountDeleted: () => void
  onPasswordReset: () => void
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export default function SettingsTab({ onLogout, onAccountDeleted, onPasswordReset }: Props) {
  const [view, setView] = useState<View>('main')

  // 프로필
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [nicknameSaved, setNicknameSaved] = useState(false)

  // 비밀번호 재설정
  const [emailId, setEmailId] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')

  // 계정 삭제
  const [deletePw, setDeletePw] = useState('')
  const [deletePwError, setDeletePwError] = useState('')

  const sendCode = () => {
    const code = generateCode()
    setSentCode(code)
    setInputCode('')
    setCodeError(false)
    setView('pwStep2')
    alert(`[개발 테스트용]\n${emailId}@suwon.ac.kr 로 인증번호가 전송됐어요.\n인증번호: ${code}`)
  }

  const verifyCode = () => {
    if (inputCode === sentCode) { setCodeError(false); setView('pwStep3') }
    else setCodeError(true)
  }

  const resetPassword = () => {
    if (newPw.length < 8) { setPwError('비밀번호는 8자 이상이어야 해요.'); return }
    if (newPw !== confirmPw) { setPwError('비밀번호가 일치하지 않아요.'); return }
    setPwError('')
    alert('비밀번호가 재설정됐어요. 다시 로그인해주세요.')
    onPasswordReset()
  }

  const saveNickname = () => {
    if (!nickname) { setNicknameError('닉네임을 입력해주세요.'); return }
    if (nickname.length > 10) { setNicknameError('10자 이하로 입력해주세요.'); return }
    setNicknameError('')
    setNicknameSaved(true)
    setTimeout(() => setNicknameSaved(false), 2000)
  }

  const tryDelete = () => {
    if (deletePw.length < 8) { setDeletePwError('비밀번호를 올바르게 입력해주세요.'); return }
    setDeletePwError('')
    setView('deleteConfirm2')
  }

  // ── 메인 설정 화면 ──
  if (view === 'main') return (
    <div className="settings-wrap">
      <h2 className="settings-title">설정</h2>
      <div className="settings-list">
        <button className="settings-item" onClick={() => setView('profile')}>
          <span className="settings-item-icon">👤</span>
          <span className="settings-item-label">프로필 수정</span>
          <span className="settings-item-arrow">›</span>
        </button>
        <button className="settings-item" onClick={onLogout}>
          <span className="settings-item-icon">🚪</span>
          <span className="settings-item-label">로그아웃</span>
          <span className="settings-item-arrow">›</span>
        </button>
        <button className="settings-item danger" onClick={() => { setDeletePw(''); setDeletePwError(''); setView('deleteConfirm') }}>
          <span className="settings-item-icon">🗑️</span>
          <span className="settings-item-label">계정 삭제</span>
          <span className="settings-item-arrow">›</span>
        </button>
      </div>
    </div>
  )

  // ── 프로필 수정 ──
  if (view === 'profile') return (
    <div className="login-wrap">
      <button className="btn-back" onClick={() => setView('main')}>← 설정으로</button>
      <h2 className="login-title">프로필 수정</h2>

      <div className="input-group">
        <label>닉네임 <span className="label-hint">(10자 이하)</span></label>
        <input
          type="text"
          placeholder="새 닉네임 입력"
          value={nickname}
          onChange={e => { setNickname(e.target.value); setNicknameError('') }}
          className={`pw-input ${nicknameError ? 'error' : ''}`}
          maxLength={10}
        />
        <div className="input-meta">
          {nicknameError ? <p className="error-msg">{nicknameError}</p> : <span />}
          <span className="char-count">{nickname.length}/10</span>
        </div>
      </div>
      {nicknameSaved && <p style={{ color: '#1a8fa0', fontSize: '0.85rem', textAlign: 'center' }}>닉네임이 저장됐어요!</p>}
      <button className="btn-login" onClick={saveNickname}>닉네임 저장</button>

      <div className="divider" />

      <button className="btn-signup" onClick={() => { setEmailId(''); setView('pwStep1') }}>
        비밀번호 재설정
      </button>
    </div>
  )

  // ── 비밀번호 재설정 Step1: 이메일 ──
  if (view === 'pwStep1') return (
    <div className="login-wrap">
      <button className="btn-back" onClick={() => setView('profile')}>← 프로필 수정으로</button>
      <h2 className="login-title">비밀번호 재설정</h2>
      <p className="step-desc">학교 이메일로 인증을 진행해주세요.</p>
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
      <button className="btn-login" onClick={sendCode} disabled={!emailId}>인증번호 전송</button>
    </div>
  )

  // ── Step2: 인증번호 ──
  if (view === 'pwStep2') return (
    <div className="login-wrap">
      <button className="btn-back" onClick={() => setView('pwStep1')}>← 이전으로</button>
      <h2 className="login-title">인증번호 확인</h2>
      <p className="step-desc"><b>{emailId}@suwon.ac.kr</b> 로 전송된<br />인증번호 6자리를 입력해주세요.</p>
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
      <button className="btn-login" onClick={verifyCode} disabled={inputCode.length !== 6}>확인</button>
      <button className="btn-forgot" onClick={sendCode}>인증번호 재전송하기</button>
    </div>
  )

  // ── Step3: 새 비밀번호 ──
  if (view === 'pwStep3') return (
    <div className="login-wrap">
      <h2 className="login-title">새 비밀번호 설정</h2>
      <p className="step-desc">새로운 비밀번호를 입력해주세요.</p>
      <div className="input-group">
        <label>새 비밀번호</label>
        <input type="password" placeholder="8자 이상 입력" value={newPw}
          onChange={e => { setNewPw(e.target.value); setPwError('') }}
          className="pw-input" />
      </div>
      <div className="input-group">
        <label>비밀번호 확인</label>
        <input type="password" placeholder="비밀번호 재입력" value={confirmPw}
          onChange={e => { setConfirmPw(e.target.value); setPwError('') }}
          className={`pw-input ${pwError ? 'error' : ''}`} />
        {pwError && <p className="error-msg">{pwError}</p>}
      </div>
      <button className="btn-login" onClick={resetPassword}>비밀번호 재설정 완료</button>
    </div>
  )

  // ── 계정 삭제: 비밀번호 입력 ──
  if (view === 'deleteConfirm') return (
    <div className="login-wrap">
      <button className="btn-back" onClick={() => setView('main')}>← 설정으로</button>
      <h2 className="login-title">계정 삭제</h2>
      <p className="step-desc">계정 삭제를 위해 비밀번호를 입력해주세요.</p>
      <div className="input-group">
        <label>비밀번호</label>
        <input type="password" placeholder="비밀번호 입력" value={deletePw}
          onChange={e => { setDeletePw(e.target.value); setDeletePwError('') }}
          className={`pw-input ${deletePwError ? 'error' : ''}`} />
        {deletePwError && <p className="error-msg">{deletePwError}</p>}
      </div>
      <button className="btn-login" style={{ background: '#e74c3c' }} onClick={tryDelete}>
        확인
      </button>
    </div>
  )

  // ── 계정 삭제: 최종 확인 ──
  if (view === 'deleteConfirm2') return (
    <div className="login-wrap" style={{ justifyContent: 'center', gap: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '2rem' }}>⚠️</p>
        <h2 className="login-title" style={{ marginTop: 12 }}>정말 계정을 삭제하시겠습니까?</h2>
        <p className="step-desc" style={{ marginTop: 8 }}>삭제된 계정은 복구할 수 없어요.</p>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn-signup" style={{ flex: 1 }} onClick={() => setView('main')}>아니오</button>
        <button className="btn-login" style={{ flex: 1, background: '#e74c3c' }} onClick={() => setView('deleted')}>예</button>
      </div>
    </div>
  )

  // ── 계정 삭제 완료 ──
  return (
    <div className="login-wrap" style={{ justifyContent: 'center', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <p style={{ fontSize: '3rem' }}>✅</p>
      <h2 className="login-title">계정이 삭제되었습니다.</h2>
      <p className="step-desc">이용해 주셔서 감사해요.</p>
      <button className="btn-login" onClick={onAccountDeleted}>로그인 화면으로</button>
    </div>
  )
}
