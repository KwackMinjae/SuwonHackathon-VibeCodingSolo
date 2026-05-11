import { useState, useEffect, useRef } from 'react'
import { getSocket } from '../api/socket'
import { api } from '../api/client'

export interface ChatMessage {
  id: number
  text: string
  isMine: boolean
  senderName?: string
  time: string
  isAppointment?: boolean
  userId?: number
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
  capacity: number
  memberCount: number
  members: string[]
  memberIds?: Record<string, number>
  ratings: Record<string, number>
}

function nowTime() {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDatetime(iso: string) {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }) +
    ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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

function canRate(appt?: Appointment) {
  if (!appt || !appt.accepted) return false
  return Date.now() - new Date(appt.datetimeISO).getTime() >= 4 * 60 * 60 * 1000
}

function AppointmentModal({ onClose, onSend }: {
  onClose: () => void
  onSend: (place: string, dt: Date) => void
}) {
  const [place, setPlace] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const canSend = place.trim() && dateStr && timeStr

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
            <input className="pw-input" placeholder="장소 이름 입력" value={place} onChange={e => setPlace(e.target.value)} />
            <button className="btn-map-icon"
              onClick={() => place.trim() && window.open(`https://map.kakao.com/?q=${encodeURIComponent(place.trim())}`, '_blank')}>
              🗺️
            </button>
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
        <button className="btn-login" disabled={!canSend}
          onClick={() => canSend && onSend(place.trim(), new Date(`${dateStr}T${timeStr}`))}>
          보내기
        </button>
      </div>
    </div>
  )
}

function VerifyModal({ appointment, onVerify, onClose }: {
  appointment: Appointment; onVerify: () => void; onClose: () => void
}) {
  const [step, setStep] = useState<'checking' | 'ready' | 'early' | 'done'>('checking')

  useEffect(() => {
    if (!isWithinWindow(appointment.datetimeISO)) { setStep('early'); return }
    if (!navigator.geolocation) { setStep('ready'); return }
    navigator.geolocation.getCurrentPosition(() => setStep('ready'), () => setStep('ready'), { timeout: 5000 })
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
        {step === 'checking' && <div className="verify-status">📡 위치를 확인하고 있어요...</div>}
        {step === 'early' && (
          <div className="verify-status error">
            {remaining ? `아직 약속 시간이 아니에요!\n${remaining} 후에 다시 시도해주세요.`
              : '약속 시간이 지났어요. (약속 시간 ±30분 이내에 인증 가능해요)'}
          </div>
        )}
        {step === 'ready' && (
          <>
            <div className="verify-status ok">📍 위치 확인 완료! 인증할 수 있어요.</div>
            <button className="btn-login" onClick={() => { onVerify(); setStep('done') }}>인증하기</button>
          </>
        )}
        {step === 'done' && <div className="verify-done">✅ 인증되었습니다!</div>}
      </div>
    </div>
  )
}

function RatingModal({ members, ratings, appt, onRate, onClose }: {
  members: string[]
  ratings: Record<string, number>
  appt?: Appointment
  onRate: (nickname: string, stars: number) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<Record<string, number>>(ratings)
  const ratable = canRate(appt)
  const hoursLeft = appt?.accepted
    ? Math.max(0, Math.ceil((new Date(appt.datetimeISO).getTime() + 4 * 3600000 - Date.now()) / 3600000))
    : null

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">⭐ 별점 주기</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="rating-notice">🔒 별점은 상대방에게 공개되지 않아요</div>
        {!ratable && (
          <div className="rating-locked">
            {!appt || !appt.accepted
              ? '약속이 확정된 후 4시간이 지나면\n별점을 줄 수 있어요.'
              : `약속 후 약 ${hoursLeft}시간이 지나면\n별점을 줄 수 있어요.`}
          </div>
        )}
        {ratable && members.filter(m => m !== '나').map(nickname => (
          <div key={nickname} className="rating-row">
            <span className="rating-name">{nickname}</span>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} className={`star-btn ${(local[nickname] ?? 0) >= s ? 'filled' : ''}`}
                  onClick={() => { const updated = { ...local, [nickname]: s }; setLocal(updated); onRate(nickname, s) }}>
                  ★
                </button>
              ))}
            </div>
          </div>
        ))}
        <button className="btn-login" onClick={onClose}>완료</button>
      </div>
    </div>
  )
}

function PlusMenu({ onAppt, onRate, onLeave, onClose }: {
  onAppt: () => void; onRate: () => void; onLeave: () => void; onClose: () => void
}) {
  return (
    <>
      <div className="plus-menu-overlay" onClick={onClose} />
      <div className="plus-menu">
        <button className="plus-menu-item" onClick={() => { onAppt(); onClose() }}>
          <span>📍</span><span>약속장소 지정</span>
        </button>
        <button className="plus-menu-item" onClick={() => { onRate(); onClose() }}>
          <span>⭐</span><span>별점 주기</span>
        </button>
        <button className="plus-menu-item danger" onClick={() => { onLeave(); onClose() }}>
          <span>🚪</span><span>채팅방 나가기</span>
        </button>
      </div>
    </>
  )
}

function LeaveModal({ onClose, onLeave }: { onClose: () => void; onLeave: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h3 className="modal-title">채팅방 나가기</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="step-desc" style={{ textAlign: 'center' }}>
          채팅방을 나가면 대화 내용이<br />모두 삭제돼요.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn-signup" style={{ flex: 1 }} onClick={onClose}>취소</button>
          <button className="btn-login" style={{ flex: 1, background: '#e74c3c' }} onClick={onLeave}>나가기</button>
        </div>
      </div>
    </div>
  )
}

function AppointmentCard({ appt, onAccept }: { appt: Appointment; onAccept: () => void }) {
  return (
    <div className="appt-card">
      <div className="appt-card-title">📅 약속 설정</div>
      <div className="appt-card-row">
        <span className="appt-card-icon">📍</span>
        <span className="appt-card-text">{appt.place}</span>
        <button className="btn-map-small"
          onClick={() => window.open(`https://map.kakao.com/?q=${encodeURIComponent(appt.place)}`, '_blank')}>
          지도
        </button>
      </div>
      <div className="appt-card-row">
        <span className="appt-card-icon">🕐</span>
        <span className="appt-card-text">{formatDatetime(appt.datetimeISO)}</span>
      </div>
      {!appt.accepted
        ? <button className="btn-accept" onClick={onAccept}>수락하기</button>
        : <div className="appt-accepted">✅ 약속이 확정되었어요!</div>}
    </div>
  )
}

export function ChatList({ rooms, onOpenRoom }: { rooms: ChatRoom[]; onOpenRoom: (room: ChatRoom) => void }) {
  return (
    <div className="chat-list-wrap">
      <h2 className="chat-list-title">채팅방</h2>
      {rooms.length === 0 ? (
        <div className="chat-empty">참여한 채팅방이 없어요.<br />채팅방을 만들거나 참여해보세요!</div>
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

interface RoomProps {
  room: ChatRoom
  currentUserId?: number
  currentNickname?: string
  onBack: () => void
  onSend: (text: string) => void
  onUpdateRoom: (room: ChatRoom) => void
  onLeave: () => void
}

export function ChatRoomView({ room, currentUserId, currentNickname, onBack, onSend, onUpdateRoom, onLeave }: RoomProps) {
  const [input, setInput]               = useState('')
  const [showPlus, setShowPlus]         = useState(false)
  const [showAppModal, setShowAppModal] = useState(false)
  const [showVerify, setShowVerify]     = useState(false)
  const [showRating, setShowRating]     = useState(false)
  const [showLeave, setShowLeave]       = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('join-room', room.id)

    socket.on('new-message', (msg: { id: number; text: string; senderName: string; userId: number; time: string; type: string }) => {
      const newMsg: ChatMessage = {
        id: msg.id,
        text: msg.text,
        isMine: msg.userId === currentUserId,
        senderName: msg.senderName,
        time: msg.time,
        userId: msg.userId,
        isAppointment: msg.type === 'appointment',
      }
      onUpdateRoom({ ...room, messages: [...room.messages, newMsg] })
    })

    socket.on('appointment-updated', (data: { place: string; datetimeISO: string; accepted: boolean; verified: boolean }) => {
      const apptMsg: ChatMessage = { id: Date.now(), text: '', isMine: false, time: nowTime(), isAppointment: true }
      onUpdateRoom({
        ...room,
        messages: [...room.messages, apptMsg],
        appointment: { place: data.place, datetimeISO: data.datetimeISO, accepted: false, verified: false },
      })
    })

    socket.on('appointment-accepted', () => {
      if (room.appointment) {
        onUpdateRoom({ ...room, appointment: { ...room.appointment, accepted: true } })
      }
    })

    socket.on('appointment-verified', () => {
      if (room.appointment) {
        onUpdateRoom({ ...room, appointment: { ...room.appointment, verified: true } })
      }
    })

    return () => {
      socket.off('new-message')
      socket.off('appointment-updated')
      socket.off('appointment-accepted')
      socket.off('appointment-verified')
      socket.emit('leave-room', room.id)
    }
  }, [room.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.messages.length])

  const appt = room.appointment

  const handleSetAppointment = async (place: string, dt: Date) => {
    const datetimeISO = dt.toISOString()
    try {
      await api.post(`/rooms/${room.id}/appointment`, { place, datetimeISO }, true)
      const socket = getSocket()
      socket.emit('appointment-set', { roomId: room.id, place, datetimeISO })
      const apptMsg: ChatMessage = { id: Date.now(), text: '', isMine: true, time: nowTime(), isAppointment: true }
      onUpdateRoom({
        ...room,
        messages: [...room.messages, apptMsg],
        appointment: { place, datetimeISO, accepted: false, verified: false },
      })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '약속 설정에 실패했습니다.')
    }
    setShowAppModal(false)
  }

  const handleAcceptAppointment = async () => {
    try {
      await api.put(`/rooms/${room.id}/appointment/accept`, {}, true)
      const socket = getSocket()
      socket.emit('appointment-accept', room.id)
      if (appt) onUpdateRoom({ ...room, appointment: { ...appt, accepted: true } })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '수락에 실패했습니다.')
    }
  }

  const handleVerify = async () => {
    try {
      await api.put(`/rooms/${room.id}/appointment/verify`, {}, true)
      const socket = getSocket()
      socket.emit('appointment-verify', room.id)
      if (appt) onUpdateRoom({ ...room, appointment: { ...appt, verified: true } })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '인증에 실패했습니다.')
    }
  }

  const handleRate = async (nickname: string, stars: number) => {
    const rateeId = room.memberIds?.[nickname]
    if (!rateeId) return
    try {
      await api.post(`/rooms/${room.id}/ratings`, { rateeId, stars }, true)
      onUpdateRoom({ ...room, ratings: { ...room.ratings, [nickname]: stars } })
    } catch { /* 별점 실패 시 무시 */ }
  }

  const handleSend = () => {
    if (!input.trim()) return
    const socket = getSocket()
    socket.emit('send-message', { roomId: room.id, text: input.trim() })
    // 낙관적 업데이트
    const msg: ChatMessage = {
      id: Date.now(), text: input.trim(), isMine: true,
      senderName: currentNickname, time: nowTime(), userId: currentUserId,
    }
    onUpdateRoom({ ...room, messages: [...room.messages, msg] })
    setInput('')
  }

  let rightBtn: React.ReactNode
  if (!appt || !appt.accepted) {
    rightBtn = <button className="btn-appt-header" onClick={() => setShowAppModal(true)}>📍 약속장소 지정</button>
  } else if (!appt.verified) {
    rightBtn = <button className="btn-verify-header" onClick={() => setShowVerify(true)}>✅ 만난인증</button>
  } else {
    rightBtn = <span className="btn-verified-header">✓ 인증완료</span>
  }

  return (
    <div className="chat-room-wrap">
      {showPlus && (
        <PlusMenu
          onAppt={() => setShowAppModal(true)}
          onRate={() => setShowRating(true)}
          onLeave={() => setShowLeave(true)}
          onClose={() => setShowPlus(false)}
        />
      )}
      {showAppModal && <AppointmentModal onClose={() => setShowAppModal(false)} onSend={handleSetAppointment} />}
      {showVerify && appt && (
        <VerifyModal appointment={appt} onVerify={handleVerify} onClose={() => setShowVerify(false)} />
      )}
      {showRating && (
        <RatingModal
          members={room.members}
          ratings={room.ratings}
          appt={appt}
          onRate={handleRate}
          onClose={() => setShowRating(false)}
        />
      )}
      {showLeave && <LeaveModal onClose={() => setShowLeave(false)} onLeave={onLeave} />}

      <div className="chat-room-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="chat-room-title">{room.title}</h2>
        {rightBtn}
      </div>

      <div className="chat-messages">
        {room.messages.map(msg =>
          msg.isAppointment && appt ? (
            <div key={msg.id} className="appt-card-wrapper">
              <AppointmentCard appt={appt} onAccept={handleAcceptAppointment} />
            </div>
          ) : (
            <div key={msg.id} className={`chat-bubble-wrap ${msg.isMine ? 'mine' : 'theirs'}`}>
              {!msg.isMine && msg.senderName && <span className="chat-sender-name">{msg.senderName}</span>}
              <div className={`chat-bubble ${msg.isMine ? 'bubble-mine' : 'bubble-theirs'}`}>{msg.text}</div>
              <span className="chat-time">{msg.time}</span>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <button className="btn-plus" onClick={() => setShowPlus(p => !p)}>+</button>
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
