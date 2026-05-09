import { useState, useEffect, useRef } from 'react'
import { MOCK_USERS, MockUser } from './RandomMatchScreen'

export interface ChatMessage {
  id: number
  text: string
  isMine: boolean
  senderName?: string
  time: string
  isAppointment?: boolean
}

export interface Appointment {
  place: string
  datetimeISO: string
  accepted: boolean
  verified: boolean
}

export interface ChatRoom {
  id: number
  title: string
  messages: ChatMessage[]
  appointment?: Appointment
}

function nowTime() {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDatetime(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) +
    ' ' +
    d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  )
}

function isWithinWindow(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  return diff >= -30 * 60 * 1000 && diff <= 30 * 60 * 1000
}

function timeUntilText(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return null
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

// ── 약속 설정 모달 ──
function AppointmentModal({ onClose, onSend }: {
  onClose: () => void
  onSend: (place: string, dt: Date) => void
}) {
  const [place, setPlace] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const canSend = place.trim() && dateStr && timeStr

  const openMap = () => {
    if (place.trim())
      window.open(`https://map.kakao.com/?q=${encodeURIComponent(place.trim())}`, '_blank')
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">약속 설정</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="input-group">
          <label>장소</label>
          <div className="place-row">
            <input
              className="pw-input"
              placeholder="장소 이름 입력"
              value={place}
              onChange={e => setPlace(e.target.value)}
            />
            <button className="btn-map-icon" onClick={openMap} title="카카오지도에서 검색">🗺️</button>
          </div>
        </div>
        <div className="input-group">
          <label>날짜</label>
          <input type="date" className="pw-input" value={dateStr} onChange={e => setDateStr(e.target.value)} />
        </div>
        <div className="input-group">
          <label>시간</label>
          <input type="time" className="pw-input" value={timeStr} onChange={e => setTimeStr(e.target.value)} />
        </div>
        <button className="btn-login" onClick={() => canSend && onSend(place.trim(), new Date(`${dateStr}T${timeStr}`))} disabled={!canSend}>
          보내기
        </button>
      </div>
    </div>
  )
}

// ── 만난인증 모달 ──
function VerifyModal({ appointment, onVerify, onClose }: {
  appointment: Appointment
  onVerify: () => void
  onClose: () => void
}) {
  const [step, setStep] = useState<'checking' | 'ready' | 'early' | 'done'>('checking')

  useEffect(() => {
    if (!isWithinWindow(appointment.datetimeISO)) {
      setStep('early')
      return
    }
    if (!navigator.geolocation) { setStep('ready'); return }
    navigator.geolocation.getCurrentPosition(
      () => setStep('ready'),
      () => setStep('ready'),
      { timeout: 5000 }
    )
  }, [])

  const remaining = timeUntilText(appointment.datetimeISO)

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">만난 인증</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="verify-info-box">
          <div className="verify-info-row">
            <span className="verify-info-label">📍 약속 장소</span>
            <span className="verify-info-value">{appointment.place}</span>
          </div>
          <div className="verify-info-row">
            <span className="verify-info-label">🕐 약속 시간</span>
            <span className="verify-info-value">{formatDatetime(appointment.datetimeISO)}</span>
          </div>
        </div>

        {step === 'checking' && (
          <div className="verify-status">📡 위치를 확인하고 있어요...</div>
        )}
        {step === 'early' && (
          <div className="verify-status error">
            {remaining
              ? `아직 약속 시간이 아니에요!\n${remaining} 후에 다시 시도해주세요.`
              : '약속 시간이 지났어요. (약속 시간 ±30분 이내에 인증 가능해요)'}
          </div>
        )}
        {step === 'ready' && (
          <>
            <div className="verify-status ok">📍 위치 확인 완료! 인증할 수 있어요.</div>
            <button className="btn-login" onClick={() => { onVerify(); setStep('done') }}>인증하기</button>
          </>
        )}
        {step === 'done' && (
          <div className="verify-done">✅ 인증되었습니다!</div>
        )}
      </div>
    </div>
  )
}

// ── 친구 초대 모달 ──
function InviteModal({ onClose, onInvite }: {
  onClose: () => void
  onInvite: (studentId: string, nickname: string) => void
}) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<MockUser | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = () => {
    setSearched(true)
    setFound(MOCK_USERS.find(u => u.studentId === query.trim()) ?? null)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">친구 초대</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="input-group">
          <label>학번으로 검색</label>
          <div className="place-row">
            <input
              className="pw-input"
              placeholder="학번 입력 (예: 20230101)"
              value={query}
              onChange={e => { setQuery(e.target.value); setSearched(false); setFound(null) }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn-map-icon" onClick={handleSearch}>🔍</button>
          </div>
        </div>
        {searched && !found && <p className="error-msg">해당 학번의 사용자를 찾을 수 없어요.</p>}
        {found && (
          <div className="invite-user-card">
            <span className="invite-user-avatar">👤</span>
            <div className="invite-user-info">
              <span className="invite-user-name">{found.nickname}</span>
              <span className="invite-user-detail">{found.studentId} · {found.dept}</span>
            </div>
          </div>
        )}
        <button
          className="btn-login"
          disabled={!found}
          onClick={() => found && onInvite(found.studentId, found.nickname)}
        >
          참여 요청 보내기
        </button>
      </div>
    </div>
  )
}

// ── 약속 카드 (채팅 메시지) ──
function AppointmentCard({ appt, onAccept }: { appt: Appointment; onAccept: () => void }) {
  const openMap = () =>
    window.open(`https://map.kakao.com/?q=${encodeURIComponent(appt.place)}`, '_blank')

  return (
    <div className="appt-card">
      <div className="appt-card-title">📅 약속 설정</div>
      <div className="appt-card-row">
        <span className="appt-card-icon">📍</span>
        <span className="appt-card-text">{appt.place}</span>
        <button className="btn-map-small" onClick={openMap}>지도</button>
      </div>
      <div className="appt-card-row">
        <span className="appt-card-icon">🕐</span>
        <span className="appt-card-text">{formatDatetime(appt.datetimeISO)}</span>
      </div>
      {!appt.accepted ? (
        <button className="btn-accept" onClick={onAccept}>수락하기</button>
      ) : (
        <div className="appt-accepted">✅ 약속이 확정되었어요!</div>
      )}
    </div>
  )
}

// ── 채팅방 목록 ──
interface ListProps {
  rooms: ChatRoom[]
  onOpenRoom: (room: ChatRoom) => void
}

export function ChatList({ rooms, onOpenRoom }: ListProps) {
  return (
    <div className="chat-list-wrap">
      <h2 className="chat-list-title">채팅방</h2>
      {rooms.length === 0 ? (
        <div className="chat-empty">
          참여한 채팅방이 없어요.<br />공고에서 참여 신청을 해보세요!
        </div>
      ) : (
        <div className="chat-rooms">
          {rooms.map(room => {
            const last = room.messages[room.messages.length - 1]
            const preview = last?.isAppointment ? '📅 약속이 설정되었어요' : (last?.text ?? '채팅을 시작해보세요!')
            return (
              <button key={room.id} className="chat-room-item" onClick={() => onOpenRoom(room)}>
                <div className="chat-room-icon">💬</div>
                <div className="chat-room-info">
                  <span className="chat-room-name">{room.title}</span>
                  <span className="chat-room-last">{preview}</span>
                </div>
                <span className="chat-room-arrow">›</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 채팅방 뷰 ──
interface RoomProps {
  room: ChatRoom
  onBack: () => void
  onSend: (text: string) => void
  onUpdateRoom: (room: ChatRoom) => void
  onInvite: (studentId: string, nickname: string) => void
}

export function ChatRoomView({ room, onBack, onSend, onUpdateRoom, onInvite }: RoomProps) {
  const [input, setInput] = useState('')
  const [showAppModal, setShowAppModal] = useState(false)
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.messages.length])

  const appt = room.appointment

  const handleSetAppointment = (place: string, dt: Date) => {
    const apptMsg: ChatMessage = {
      id: Date.now(),
      text: '',
      isMine: true,
      time: nowTime(),
      isAppointment: true,
    }
    onUpdateRoom({
      ...room,
      messages: [...room.messages, apptMsg],
      appointment: { place, datetimeISO: dt.toISOString(), accepted: false, verified: false },
    })
    setShowAppModal(false)
  }

  const handleAccept = () => {
    if (!appt) return
    onUpdateRoom({ ...room, appointment: { ...appt, accepted: true } })
  }

  const handleVerify = () => {
    if (!appt) return
    onUpdateRoom({ ...room, appointment: { ...appt, verified: true } })
  }

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  // 우상단 버튼
  let rightBtn: React.ReactNode
  if (!appt || !appt.accepted) {
    rightBtn = (
      <button className="btn-appt-header" onClick={() => setShowAppModal(true)}>
        📍 약속장소 지정
      </button>
    )
  } else if (!appt.verified) {
    rightBtn = (
      <button className="btn-verify-header" onClick={() => setShowVerifyModal(true)}>
        ✅ 만난인증
      </button>
    )
  } else {
    rightBtn = <span className="btn-verified-header">✓ 인증완료</span>
  }

  return (
    <div className="chat-room-wrap">
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvite={(sid, nick) => { onInvite(sid, nick); setShowInviteModal(false) }}
        />
      )}
      {showAppModal && (
        <AppointmentModal onClose={() => setShowAppModal(false)} onSend={handleSetAppointment} />
      )}
      {showVerifyModal && appt && (
        <VerifyModal
          appointment={appt}
          onVerify={handleVerify}
          onClose={() => setShowVerifyModal(false)}
        />
      )}

      <div className="chat-room-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="chat-room-title">{room.title}</h2>
        {rightBtn}
      </div>

      <div className="chat-messages">
        {room.messages.map(msg =>
          msg.isAppointment && appt ? (
            <div key={msg.id} className="appt-card-wrapper">
              <AppointmentCard appt={appt} onAccept={handleAccept} />
            </div>
          ) : (
            <div key={msg.id} className={`chat-bubble-wrap ${msg.isMine ? 'mine' : 'theirs'}`}>
              {!msg.isMine && msg.senderName && (
                <span className="chat-sender-name">{msg.senderName}</span>
              )}
              <div className={`chat-bubble ${msg.isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                {msg.text}
              </div>
              <span className="chat-time">{msg.time}</span>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <button className="btn-plus" onClick={() => setShowInviteModal(true)}>+</button>
        <input
          className="chat-input"
          placeholder="메시지를 입력하세요"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button className="chat-send-btn" onClick={handleSend}>전송</button>
      </div>
    </div>
  )
}
