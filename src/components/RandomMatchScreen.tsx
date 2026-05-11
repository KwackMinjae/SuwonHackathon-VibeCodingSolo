import { useState, useEffect } from 'react'
import { api } from '../api/client'

export interface UserProfile {
  id?: number
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

export interface AvailableRoom {
  id: number
  title: string
  capacity: number
  memberCount: number
  code: string
}

type View = 'select' | 'host-setup' | 'host-wait' | 'join-input' | 'join-wait' | 'instant' | 'instant-searching' | 'result'
type TeamGender = '남' | '여'

interface MatchResult {
  myTeam: MockUser[]
  otherTeam: MockUser[]
  size: number
}

interface Props {
  onBack: () => void
  currentUser: UserProfile
  onMatchSuccess: (matchedUsers: MockUser[], size: number, roomId?: number) => void
  onRoomCreated?: (room: AvailableRoom) => void
  publicRooms?: AvailableRoom[]
  onJoinPublicRoom?: (room: AvailableRoom) => void
  initialView?: View
}

export default function RandomMatchScreen({ onBack, currentUser, onMatchSuccess, onRoomCreated, publicRooms, onJoinPublicRoom, initialView = 'select' }: Props) {
  const [view, setView]           = useState<View>(initialView)
  const [matchSize, setMatchSize] = useState(3)
  const [teamGender, setTeamGender] = useState<TeamGender>(currentUser.gender)
  const [roomCode, setRoomCode]   = useState('')
  const [roomId, setRoomId]       = useState(0)
  const [members, setMembers]     = useState(1)
  const [joinCode, setJoinCode]   = useState('')
  const [joinError, setJoinError] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [result, setResult]       = useState<MatchResult | null>(null)
  const [loading, setLoading]     = useState(false)

  const otherGender: TeamGender = teamGender === '남' ? '여' : '남'

  // 방 만들기
  const createRoom = async () => {
    setLoading(true)
    try {
      const data = await api.post<{ room: { id: number; title: string; code: string; capacity: number; teamGender: string; memberCount: number } }>(
        '/rooms', { capacity: matchSize, teamGender }, true
      )
      const { room } = data
      setRoomCode(room.code)
      setRoomId(room.id)
      setMembers(1)
      setView('host-wait')
      onRoomCreated?.({
        id: room.id,
        title: room.title,
        capacity: room.capacity,
        memberCount: room.memberCount,
        code: room.code,
      })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '방 만들기에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 코드로 방 참여
  const joinRoom = async () => {
    if (joinCode.length !== 6) { setJoinError('방 번호는 6자리예요.'); return }
    setLoading(true)
    try {
      await api.post<{ room: unknown }>('/rooms/join', { code: joinCode }, true)
      setJoinError('')
      setView('join-wait')
    } catch (e: unknown) {
      setJoinError(e instanceof Error ? e.message : '입장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const addMember = () => setMembers(p => Math.min(p + 1, matchSize))

  // 매칭 시작 (방장)
  const startMatch = () => {
    const mockMyTeam: MockUser[] = [
      { nickname: currentUser.nickname, studentId: currentUser.studentId, gender: teamGender, dept: currentUser.dept },
      ...Array.from({ length: members - 1 }, (_, i) => ({
        nickname: `친구${i + 1}`, studentId: `2400${i + 10}`, gender: teamGender, dept: '수원대학교',
      })),
    ]
    const mockOtherTeam: MockUser[] = Array.from({ length: matchSize }, (_, i) => ({
      nickname: `상대${i + 1}`, studentId: `2300${i + 10}`, gender: otherGender, dept: '수원대학교',
    }))
    setResult({ myTeam: mockMyTeam, otherTeam: mockOtherTeam, size: matchSize })
    setCountdown(3)
  }

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      setView('result')
      if (result) onMatchSuccess([...result.myTeam, ...result.otherTeam], result.size, roomId || undefined)
      return
    }
    const t = setTimeout(() => setCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // 즉시 랜덤매칭
  const startInstantMatch = async () => {
    setView('instant-searching')
    try {
      const data = await api.post<{
        roomId: number
        myTeam: MockUser[]
        otherTeam: MockUser[]
        size: number
        room: AvailableRoom
      }>('/match/instant', { size: matchSize, teamGender }, true)

      setResult({ myTeam: data.myTeam, otherTeam: data.otherTeam, size: data.size })
      setView('result')
      onMatchSuccess([...data.myTeam, ...data.otherTeam], data.size, data.roomId)
    } catch {
      // 서버에 다른 유저가 없는 경우 목 데이터로 폴백
      await new Promise(r => setTimeout(r, 2000))
      const mockMyTeam: MockUser[] = [
        { nickname: currentUser.nickname, studentId: currentUser.studentId, gender: teamGender, dept: currentUser.dept },
        ...Array.from({ length: matchSize - 1 }, (_, i) => ({
          nickname: `친구${i + 1}`, studentId: `2400${i + 10}`, gender: teamGender, dept: '수원대학교',
        })),
      ]
      const mockOtherTeam: MockUser[] = Array.from({ length: matchSize }, (_, i) => ({
        nickname: `상대${i + 1}`, studentId: `2300${i + 10}`, gender: otherGender, dept: '수원대학교',
      }))
      setResult({ myTeam: mockMyTeam, otherTeam: mockOtherTeam, size: matchSize })
      setView('result')
      onMatchSuccess([...mockMyTeam, ...mockOtherTeam], matchSize)
    }
  }

  if (view === 'select') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={onBack}>← 뒤로</button>
      <h2 className="match-title">랜덤매칭</h2>
      <p className="step-desc">방을 만들거나 방 번호로 입장하세요.</p>
      <div className="match-select-cards">
        <button className="match-select-card card-create"
          onClick={() => { setMatchSize(3); setTeamGender(currentUser.gender); setView('host-setup') }}>
          <span className="match-card-icon">🏠</span>
          <span className="match-card-label">방 만들기</span>
          <span className="match-card-sub">고유 번호로 친구 초대</span>
        </button>
        <button className="match-select-card card-join"
          onClick={() => { setJoinCode(''); setJoinError(''); setView('join-input') }}>
          <span className="match-card-icon">🚪</span>
          <span className="match-card-label">방 참여하기</span>
          <span className="match-card-sub">방 번호 입력 후 입장</span>
        </button>
      </div>
    </div>
  )

  if (view === 'host-setup') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('select')}>← 뒤로</button>
      <h2 className="match-title">방 만들기</h2>

      <div className="input-group">
        <label>미팅 인원</label>
        <div className="match-size-row">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className={`match-size-btn ${matchSize === n ? 'selected' : ''}`} onClick={() => setMatchSize(n)}>
              {n}v{n}
            </button>
          ))}
        </div>
        <p className="step-desc" style={{ marginTop: 8 }}>각 팀 {matchSize}명씩 총 {matchSize * 2}명이 매칭돼요.</p>
      </div>

      <div className="input-group">
        <label>우리 팀 성별</label>
        <div className="gender-row">
          {(['남', '여'] as TeamGender[]).map(g => (
            <button key={g} className={`btn-gender ${teamGender === g ? 'selected' : ''}`} onClick={() => setTeamGender(g)}>
              {g}자팀
            </button>
          ))}
        </div>
        <p className="step-desc" style={{ marginTop: 8 }}>
          우리 팀 {teamGender}자 {matchSize}명 vs 상대팀 {otherGender}자 {matchSize}명
        </p>
      </div>

      <button className="btn-login" onClick={createRoom} disabled={loading}>
        {loading ? '생성 중...' : '방 만들기'}
      </button>
    </div>
  )

  if (view === 'host-wait') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('host-setup')}>← 뒤로</button>
      <h2 className="match-title">대기 중</h2>

      <div className="room-code-box">
        <p className="room-code-label">초대 코드</p>
        <p className="room-code">{roomCode}</p>
        <p className="room-code-hint">친구에게 이 번호를 공유하세요</p>
      </div>

      <div className="team-status-box">
        <p className="team-status-title">우리 팀 ({teamGender}자)</p>
        <div className="member-dots">
          {Array.from({ length: matchSize }).map((_, i) => (
            <div key={i} className={`member-dot ${i < members ? 'filled' : 'auto'}`}>
              {i < members ? (i === 0 ? '나' : '친구') : '?'}
            </div>
          ))}
        </div>
        <p className="member-count">
          {members}/{matchSize}명 입장 · 부족한 {Math.max(matchSize - members, 0)}명은 자동 매칭
        </p>
      </div>

      <div className="team-status-box other-team">
        <p className="team-status-title">상대팀 ({otherGender}자) — 자동 매칭</p>
        <div className="member-dots">
          {Array.from({ length: matchSize }).map((_, i) => (
            <div key={i} className="member-dot auto">?</div>
          ))}
        </div>
      </div>

      {members < matchSize && (
        <button className="btn-signup" onClick={addMember}>[테스트] 친구 입장 시뮬</button>
      )}

      <button className="btn-login" onClick={startMatch} disabled={countdown !== null}>
        {countdown !== null ? `${countdown}초 후 매칭 시작...` : '매칭 시작하기 💘'}
      </button>

      <p className="match-notice">지금 바로 시작해도 돼요! 부족한 인원은 자동으로 채워져요.</p>
    </div>
  )

  if (view === 'join-input') {
    const openRooms = (publicRooms ?? []).filter(r => r.memberCount < r.capacity)
    return (
      <div className="match-wrap">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="match-title">방 참여하기</h2>

        {openRooms.length > 0 && (
          <>
            <p className="step-desc">참여 가능한 방 목록</p>
            <div className="available-rooms">
              {openRooms.map(room => (
                <button key={room.id} className="available-room-card" onClick={() => onJoinPublicRoom?.(room)}>
                  <div className="available-room-info">
                    <span className="available-room-title">{room.title}</span>
                    <span className="available-room-count">{room.memberCount}/{room.capacity}명</span>
                  </div>
                  <span className="available-room-code">#{room.code}</span>
                  <span className="available-room-join">참여</span>
                </button>
              ))}
            </div>
            <div className="available-rooms-divider">또는 코드로 직접 입장</div>
          </>
        )}

        <p className="step-desc">방장에게 받은 6자리 초대 코드를 입력해주세요.</p>
        <div className="input-group">
          <label>초대 코드</label>
          <input
            type="text"
            placeholder="6자리 코드 입력"
            value={joinCode}
            onChange={e => { setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setJoinError('') }}
            className={`pw-input ${joinError ? 'error' : ''}`}
            maxLength={6}
          />
          {joinError && <p className="error-msg">{joinError}</p>}
        </div>
        <button className="btn-login" onClick={joinRoom} disabled={joinCode.length !== 6 || loading}>
          {loading ? '입장 중...' : '입장하기'}
        </button>
      </div>
    )
  }

  if (view === 'instant') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={onBack}>← 뒤로</button>
      <h2 className="match-title">랜덤매칭</h2>
      <p className="step-desc">인원과 우리 팀 성별을 설정하면 바로 매칭해드려요!</p>

      <div className="input-group">
        <label>미팅 인원</label>
        <div className="match-size-row">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className={`match-size-btn ${matchSize === n ? 'selected' : ''}`} onClick={() => setMatchSize(n)}>
              {n}v{n}
            </button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label>우리 팀 성별</label>
        <div className="gender-row">
          {(['남', '여'] as TeamGender[]).map(g => (
            <button key={g} className={`btn-gender ${teamGender === g ? 'selected' : ''}`} onClick={() => setTeamGender(g)}>
              {g}자팀
            </button>
          ))}
        </div>
        <p className="step-desc" style={{ marginTop: 8 }}>
          {teamGender}자 {matchSize}명 vs {otherGender}자 {matchSize}명 매칭
        </p>
      </div>

      <button className="btn-login" onClick={startInstantMatch}>매칭 시작하기 💘</button>
    </div>
  )

  if (view === 'instant-searching') return (
    <div className="match-wrap" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3.5rem', animation: 'heartSpin 1s linear infinite' }}>💘</div>
      <h2 className="match-title" style={{ textAlign: 'center' }}>매칭 중...</h2>
      <p className="step-desc" style={{ textAlign: 'center' }}>잠시만 기다려주세요</p>
    </div>
  )

  if (view === 'join-wait') return (
    <div className="match-wrap">
      <button className="btn-back" onClick={() => setView('join-input')}>← 뒤로</button>
      <h2 className="match-title">입장 완료!</h2>
      <div className="room-code-box">
        <p className="room-code-label">입장한 방</p>
        <p className="room-code">{joinCode}</p>
      </div>
      <div className="waiting-spinner">
        <div className="spinner-dot" /><div className="spinner-dot" /><div className="spinner-dot" />
      </div>
      <p className="step-desc" style={{ textAlign: 'center' }}>
        방장이 매칭을 시작하기를 기다리고 있어요...
      </p>
      <button className="btn-login" onClick={startMatch}>[테스트] 매칭 시작</button>
    </div>
  )

  if (view === 'result' && result) return (
    <div className="match-wrap">
      <h2 className="match-title" style={{ textAlign: 'center' }}>🎉 매칭 완료!</h2>
      <p className="step-desc" style={{ textAlign: 'center' }}>
        {result.size}v{result.size} 미팅이 성사됐어요!
      </p>

      <div className="result-team-box my-team-box">
        <p className="result-team-label">우리 팀 ({teamGender}자)</p>
        {result.myTeam.map((u, i) => (
          <div key={i} className="result-user-row">
            <span className="result-nickname">{u.nickname}</span>
            <span className="result-info">{u.studentId.slice(0, 2)}학번 · {u.dept}</span>
          </div>
        ))}
      </div>

      <div className="result-vs">VS</div>

      <div className="result-team-box other-team-box">
        <p className="result-team-label">상대팀 ({otherGender}자)</p>
        {result.otherTeam.map((u, i) => (
          <div key={i} className="result-user-row">
            <span className="result-nickname">{u.nickname}</span>
            <span className="result-info">{u.studentId.slice(0, 2)}학번 · {u.dept}</span>
          </div>
        ))}
      </div>

      <button className="btn-login" onClick={onBack}>채팅방 확인하기</button>
    </div>
  )

  return null
}
