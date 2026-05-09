import { useState } from 'react'
import { UserProfile } from './RandomMatchScreen'

const DEPARTMENTS = [
  '인문학부', '외국어학부', '법행정학부', '미디어커뮤니케이션학과',
  '소방행정학과(야간)', '경제학부', '경영학부', '호텔관광학부',
  '바이오화학산업학부', '건설환경에너지공학부', '건축도시부동산학부',
  '산업 및 기계공학부', '반도체공학과', '전기전자공학부',
  '화학공학신소재공학부', '데이터과학부', '컴퓨터학부', '정보통신학부',
  '간호학과', '아동가족복지학과', '의류학과', '식품영양학과', '디지털콘텐츠',
]

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

type Step = 'email' | 'verify' | 'info'

interface Props {
  onBack: () => void
  onComplete?: (user: UserProfile) => void
}

export default function SignupScreen({ onBack, onComplete }: Props) {
  const [step, setStep] = useState<Step>('email')

  // 이메일 인증
  const [emailId, setEmailId] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [codeError, setCodeError] = useState(false)

  // 회원 정보
  const [nickname, setNickname] = useState('')
  const [gender, setGender] = useState<'남' | '여' | ''>('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [department, setDepartment] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const studentId = emailId.slice(0, 2)

  const sendCode = () => {
    const code = generateCode()
    setSentCode(code)
    setInputCode('')
    setCodeError(false)
    setStep('verify')
    alert(`[개발 테스트용]\n${emailId}@suwon.ac.kr 로 인증번호가 전송됐어요.\n인증번호: ${code}`)
  }

  const verifyCode = () => {
    if (inputCode === sentCode) {
      setCodeError(false)
      setStep('info')
    } else {
      setCodeError(true)
    }
  }

  const handleSignup = () => {
    const newErrors: Record<string, string> = {}
    if (!nickname) newErrors.nickname = '닉네임을 입력해주세요.'
    if (nickname.length > 10) newErrors.nickname = '닉네임은 10자 이하여야 해요.'
    if (!gender) newErrors.gender = '성별을 선택해주세요.'
    if (password.length < 8) newErrors.password = '비밀번호는 8자 이상이어야 해요.'
    if (password !== confirmPw) newErrors.confirmPw = '비밀번호가 일치하지 않아요.'
    if (!department) newErrors.department = '학과를 선택해주세요.'
    if (studentId.length < 2) newErrors.studentId = '이메일을 다시 확인해주세요.'

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    alert('회원가입이 완료됐어요!')
    onComplete?.({
      nickname,
      studentId: emailId,
      gender: gender as '남' | '여',
      dept: department,
    })
    onBack()
  }

  return (
    <div className="login-wrap">
      <button className="btn-back" onClick={onBack}>← 로그인으로</button>
      <h2 className="login-title">회원가입</h2>

      {/* Step 1: 이메일 입력 */}
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
          <button className="btn-login" onClick={sendCode} disabled={emailId.length < 2}>
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
          <button className="btn-forgot" onClick={sendCode}>인증번호 재전송하기</button>
        </>
      )}

      {/* Step 3: 회원 정보 입력 */}
      {step === 'info' && (
        <>
          {/* 닉네임 */}
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
              {errors.nickname
                ? <p className="error-msg">{errors.nickname}</p>
                : <span />}
              <span className="char-count">{nickname.length}/10</span>
            </div>
          </div>

          {/* 성별 */}
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

          {/* 비밀번호 */}
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

          {/* 비밀번호 확인 */}
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

          {/* 학번 */}
          <div className="input-group">
            <label>학번</label>
            <div className="student-id-box">{studentId}학번</div>
          </div>

          {/* 학과 선택 */}
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

          <button className="btn-login" onClick={handleSignup}>가입하기</button>
        </>
      )}
    </div>
  )
}
