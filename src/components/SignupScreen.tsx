import { useState } from 'react'
import { api, setToken, storeUser, UserInfo } from '../api/client'

const DEPARTMENTS = [
  '인문학부', '외국어학부', '법행정학부', '미디어커뮤니케이션학과',
  '소방행정학과(야간)', '경제학부', '경영학부', '호텔관광학부',
  '바이오화학산업학부', '건설환경에너지공학부', '건축도시부동산학부',
  '산업 및 기계공학부', '반도체공학과', '전기전자공학부',
  '화학공학신소재공학부', '데이터과학부', '컴퓨터학부', '정보통신학부',
  '간호학과', '아동가족복지학과', '의류학과', '식품영양학과', '디지털콘텐츠',
]

type Step = 'email' | 'verify' | 'info'

interface Props {
  onBack: () => void
  onComplete?: (user: UserInfo) => void
}

export default function SignupScreen({ onBack, onComplete }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [loading, setLoading] = useState(false)

  const [emailId, setEmailId] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeError, setCodeError] = useState('')

  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState<'남' | '여' | ''>('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [department, setDepartment] = useState('')
  const [studentIdInput, setStudentIdInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const sendCode = async () => {
    setLoading(true)
    try {
      await api.post('/auth/send-code', { email: emailId, type: 'signup' })
      setInputCode('')
      setCodeError('')
      setStep('verify')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '전송에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setLoading(true)
    try {
      await api.post('/auth/verify-code', { email: emailId, code: inputCode, type: 'signup' })
      setCodeError('')
      setStep('info')
    } catch (e: unknown) {
      setCodeError(e instanceof Error ? e.message : '인증번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    const newErrors: Record<string, string> = {}
    if (!nickname) newErrors.nickname = '닉네임을 입력해주세요.'
    if (nickname.length > 10) newErrors.nickname = '닉네임은 10자 이하여야 해요.'
    if (!gender) newErrors.gender = '성별을 선택해주세요.'
    if (password.length < 8) newErrors.password = '비밀번호는 8자 이상이어야 해요.'
    if (password !== confirmPw) newErrors.confirmPw = '비밀번호가 일치하지 않아요.'
    if (!department) newErrors.department = '학과를 선택해주세요.'
    if (!studentIdInput) newErrors.studentId = '학번을 입력해주세요.'
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setLoading(true)
    try {
      const data = await api.post<{ token: string; user: UserInfo }>('/auth/register', {
        email: emailId,
        password,
        nickname,
        gender,
        dept: department,
        student_id: studentIdInput,
      })
      setToken(data.token)
      storeUser(data.user)
      alert('회원가입이 완료됐어요!')
      onComplete?.(data.user)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <button className="btn-back" onClick={onBack}>← 로그인으로</button>
      <h2 className="login-title">회원가입</h2>

      {step === 'email' && (
        <>
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
          <button className="btn-login" onClick={sendCode} disabled={emailId.length < 2 || loading}>
            {loading ? '전송 중...' : '인증번호 전송'}
          </button>
        </>
      )}

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
              onChange={e => { setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }}
              className={`pw-input ${codeError ? 'error' : ''}`}
              maxLength={6}
            />
            {codeError && <p className="error-msg">{codeError}</p>}
          </div>
          <button className="btn-login" onClick={verifyCode} disabled={inputCode.length !== 6 || loading}>
            {loading ? '확인 중...' : '확인'}
          </button>
          <button className="btn-forgot" onClick={sendCode} disabled={loading}>인증번호 재전송하기</button>
        </>
      )}

      {step === 'info' && (
        <>
          <div className="input-group">
            <label>닉네임 <span className="label-hint">(10자 이하)</span></label>
            <input
              type="text"
              placeholder="닉네임 입력"
              value={nickname}
              onChange={e => { setNickname(e.target.value); setErrors(p => ({ ...p, nickname: '' })) }}
              className={`pw-input ${errors.nickname ? 'error' : ''}`}
              maxLength={10}
            />
            <div className="input-meta">
              {errors.nickname ? <p className="error-msg">{errors.nickname}</p> : <span />}
              <span className="char-count">{nickname.length}/10</span>
            </div>
          </div>

          <div className="input-group">
            <label>성별</label>
            <div className="gender-row">
              {(['남', '여'] as const).map(g => (
                <button
                  key={g}
                  className={`btn-gender ${gender === g ? 'selected' : ''}`}
                  onClick={() => { setGender(g); setErrors(p => ({ ...p, gender: '' })) }}
                >
                  {g}
                </button>
              ))}
            </div>
            {errors.gender && <p className="error-msg">{errors.gender}</p>}
          </div>

          <div className="input-group">
            <label>비밀번호 <span className="label-hint">(8자 이상)</span></label>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
              className={`pw-input ${errors.password ? 'error' : ''}`}
            />
            {errors.password && <p className="error-msg">{errors.password}</p>}
          </div>

          <div className="input-group">
            <label>비밀번호 확인</label>
            <input
              type="password"
              placeholder="비밀번호 재입력"
              value={confirmPw}
              onChange={e => { setConfirmPw(e.target.value); setErrors(p => ({ ...p, confirmPw: '' })) }}
              className={`pw-input ${errors.confirmPw ? 'error' : ''}`}
            />
            {errors.confirmPw && <p className="error-msg">{errors.confirmPw}</p>}
          </div>

          <div className="input-group">
            <label>학번</label>
            <input
              type="text"
              placeholder="학번 입력 (예: 20120001)"
              value={studentIdInput}
              onChange={e => { setStudentIdInput(e.target.value); setErrors(p => ({ ...p, studentId: '' })) }}
              className={`pw-input ${errors.studentId ? 'error' : ''}`}
            />
            {errors.studentId && <p className="error-msg">{errors.studentId}</p>}
          </div>

          <div className="input-group">
            <label>학과/부</label>
            <select
              className={`dept-select ${errors.department ? 'error' : ''}`}
              value={department}
              onChange={e => { setDepartment(e.target.value); setErrors(p => ({ ...p, department: '' })) }}
            >
              <option value="">학과를 선택해주세요</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.department && <p className="error-msg">{errors.department}</p>}
          </div>

          <button className="btn-login" onClick={handleSignup} disabled={loading}>
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </>
      )}
    </div>
  )
}
