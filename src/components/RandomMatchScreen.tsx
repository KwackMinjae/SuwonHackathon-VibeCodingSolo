import { useState, useEffect } from 'react'

export interface UserProfile {
  nickname: string
  studentId: string
  gender: '남' | '여'
  dept: string
}

export interface MockUser {
  id?: number
  nickname: string
  studentId: string
  gender: '남' | '여'
  dept: string
}

export const MOCK_USERS: MockUser[] = [
  { nickname: '봄바람', studentId: '22031045', gender: '여', dept: '경영학부' },
  { nickname: '하늘이', studentId: '23010892', gender: '여', dept: '간호학과' },
  { nickname: '강태양', studentId: '21055231', gender: '남', dept: '컴퓨터학부' },
  { nickname: '이슬비', studentId: '24012345', gender: '여', dept: '미디어커뮤니케이션학과' },
  { nickname: '민준혁', studentId: '22078901', gender: '남', dept: '전기전자공학부' },
  { nickname: '서하린', studentId: '23045678', gender: '여', dept: '호텔관광학부' },
]

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

type View = 'select' | 'host-setup' | 'host-wait' | 'join-input' | 'join-wait' | 'matched'

interface Props {
  onBack: () => void
  currentUser: UserProfile
  onMatchSuccess: (matchedUsers: MockUser[], size: number) => void
}

export default function RandomMatchScreen({ onBack, currentUser, onMatchSuccess }: Props) {
  const [view, setView] = useState<View>('select')
  const [roomCode, setRoomCode] = useState('')
  const [matchSize, setMatchSize] = useState(2)
  const [members, setMembers] = useState(1)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [matchedUsers, setMatchedUsers] = useState<MockUser[]>([])

  const createRoom = () => {
    setRoomCode(makeCode())
    setMembers(1)
    setView('host-wait')
  }

  const joinRoom = () => {
    if (joinCode.length !== 6) { setJoinError('방 번호는 6자리예요.'); return }
    setJoinError('')
    setView('join-wait')
  }

  const addMember = () => {
    setMembers(prev => Math.min(prev + 1, matchSize))
  }

  const startMatch = () => {
    const picked = [...MOCK_USERS]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(matchSize - 1, 1))
    setMatchedUsers(picked)
    setCountdown(3)
  }

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setView('matched')
      onMatchSuccess(matchedUsers, matchSize)
      return
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // ── 선택 화면 ──
  if (view === 'select') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={onBack}>← 뒤로</button>
      <h2 className="match-title">랜덤매칭</h2>
      <p className="step-desc">방을 만들거나 방 번호로 입장하세요.</p>

      <div className="match-select-cards">
        <button className="match-select-card card-create"
          onClick={() => { setMatchSize(2); setView('host-setup') }}>
          <span className="match-card-icon">🏠</span>
          <span className="match-card-label">방 만들기</span>
          <span className="match-card-sub">고유 번호로 친구 초대</span>
        </button>
        <button className="match-select-card card-join"
          onClick={() => { setJoinCode(''); setJoinError(''); setView('join-input') }}>
          <span className="match-card-icon">🚪</span>
          <span className="match-card-label">방 들어가기</span>
          <span className="match-card-sub">방 번호 입력 후 입장</span>
        </button>
      </div>
    </div>
  )

  // ── 방 만들기: 인원 설정 ──
  if (view === 'host-setup') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('select')}>← 뒤로</button>
      <h2 className="match-title">방 만들기</h2>
      <p className="step-desc">매칭할 인원 수를 설정해주세요.</p>

      <div className="input-group">
        <label>매칭 인원</label>
        <div className="match-size-row">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              className={`match-size-btn ${matchSize === n ? 'selected' : ''}`}
              onClick={() => setMatchSize(n)}
            >
              {n}명
            </button>
          ))}
        </div>
        <p className="step-desc" style={{ marginTop: 8 }}>
          {matchSize}명이 모이면 매칭을 시작할 수 있어요.
        </p>
      </div>

      <button className="btn-login" onClick={createRoom}>방 만들기</button>
    </div>
  )

  // ── 방장 대기실 ──
  if (view === 'host-wait') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('host-setup')}>← 뒤로</button>
      <h2 className="match-title">대기 중</h2>

      <div className="room-code-box">
        <p className="room-code-label">방 번호</p>
        <p className="room-code">{roomCode}</p>
        <p className="room-code-hint">이 번호를 상대방에게 공유하세요</p>
      </div>

      <div className="member-status">
        <div className="member-bar-wrap">
          <div className="member-bar-fill" style={{ width: `${(members / matchSize) * 100}%` }} />
        </div>
        <p className="member-count">{members} / {matchSize}명 입장</p>
      </div>

      <div className="member-dots">
        {Array.from({ length: matchSize }).map((_, i) => (
          <div key={i} className={`member-dot ${i < members ? 'filled' : ''}`} />
        ))}
      </div>

      {members < matchSize && (
        <button className="btn-signup" onClick={addMember}>
          [테스트] 멤버 입장 시뮬
        </button>
      )}

      <button
        className="btn-login"
        onClick={startMatch}
        disabled={members < matchSize || countdown !== null}
      >
        {countdown !== null
          ? `${countdown}초 후 매칭 시작...`
          : members < matchSize
            ? `${matchSize - members}명 더 필요해요`
            : '매칭 시작하기 💘'}
      </button>
    </div>
  )

  // ── 방 들어가기: 코드 입력 ──
  if (view === 'join-input') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('select')}>← 뒤로</button>
      <h2 className="match-title">방 들어가기</h2>
      <p className="step-desc">방장에게 받은 6자리 방 번호를 입력해주세요.</p>

      <div className="input-group">
        <label>방 번호</label>
        <input
          type="text"
          placeholder="6자리 방 번호 입력"
          value={joinCode}
          onChange={e => {
            setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))
            setJoinError('')
          }}
          className={`pw-input ${joinError ? 'error' : ''}`}
          maxLength={6}
        />
        {joinError && <p className="error-msg">{joinError}</p>}
      </div>

      <button className="btn-login" onClick={joinRoom} disabled={joinCode.length !== 6}>
        입장하기
      </button>
    </div>
  )

  // ── 참가자 대기실 ──
  if (view === 'join-wait') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('join-input')}>← 뒤로</button>
      <h2 className="match-title">입장 완료!</h2>

      <div className="room-code-box">
        <p className="room-code-label">입장한 방 번호</p>
        <p className="room-code">{joinCode}</p>
      </div>

      <div className="waiting-spinner">
        <div className="spinner-dot" />
        <div className="spinner-dot" />
        <div className="spinner-dot" />
      </div>
      <p className="step-desc" style={{ textAlign: 'center' }}>
        방장이 매칭을 시작하기를 기다리고 있어요...
      </p>

      <button className="btn-login" onClick={startMatch}>
        [테스트] 매칭 시작
      </button>
    </div>
  )

  // ── 매칭 완료 ──
  return (
    <div className="match-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: '3rem' }}>🎉</p>
      <h2 className="match-title" style={{ textAlign: 'center' }}>매칭 완료!</h2>
      <p className="step-desc" style={{ textAlign: 'center' }}>채팅방이 열렸어요!</p>
      <button className="btn-login" onClick={onBack}>채팅방 확인하기</button>
    </div>
  )
}
