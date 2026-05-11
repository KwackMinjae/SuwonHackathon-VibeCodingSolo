import { useState } from 'react'
import SettingsTab from './SettingsTab'
import { ChatList, ChatRoomView, ChatRoom, ChatMessage } from './ChatScreen'
import RandomMatchScreen, { UserProfile, MockUser } from './RandomMatchScreen'
import { api } from '../api/client'

type Tab = '과팅' | '채팅방' | '설정'
type SubScreen = null | 'random-create' | 'random-join' | 'random-instant' | 'chatroom'

export interface PublicRoom {
  id: number
  title: string
  capacity: number
  memberCount: number
  code: string
}

interface Props {
  onLogout: () => void
  onAccountDeleted: () => void
  onPasswordReset: () => void
  currentUser: UserProfile
  setCurrentUser: (user: UserProfile) => void
  darkMode: boolean
  onToggleDarkMode: () => void
}

function nowTime() {
  const d = new Date()
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function MainScreen({ onLogout, onAccountDeleted, onPasswordReset, currentUser, setCurrentUser, darkMode, onToggleDarkMode }: Props) {
  const [tab, setTab]           = useState<Tab>('과팅')
  const [sub, setSub]           = useState<SubScreen>(null)
  const [chatRooms, setChatRooms]   = useState<ChatRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([])

  const handleMatchSuccess = (matchedUsers: MockUser[], size: number, roomId?: number) => {
    const t = nowTime()
    const members = [currentUser.nickname, ...matchedUsers.map(u => u.nickname)]
    const memberIds: Record<string, number> = {}
    matchedUsers.forEach(u => { if (u.id) memberIds[u.nickname] = u.id })

    const systemMsg: ChatMessage = {
      id: Date.now(),
      text: `🎉 ${size}v${size} 매칭이 완료되었어요!`,
      isMine: false,
      senderName: '시스템',
      time: t,
    }
    const introMsgs: ChatMessage[] = matchedUsers.map((u, i) => ({
      id: Date.now() + i + 1,
      text: `안녕하세요! 저는 ${u.nickname}이에요 😊`,
      isMine: false,
      senderName: u.nickname,
      time: t,
    }))
    const newRoom: ChatRoom = {
      id: roomId ?? Date.now() + 1000,
      title: `${size}v${size} 매칭`,
      messages: [systemMsg, ...introMsgs],
      capacity: size * 2,
      memberCount: size * 2,
      members,
      memberIds,
      ratings: {},
    }
    setChatRooms(prev => [...prev, newRoom])
    setActiveRoom(newRoom)
    setSub('chatroom')
    setTab('채팅방')
  }

  const handleRoomCreated = (room: PublicRoom) => {
    setPublicRooms(prev => [...prev, room])
  }

  const handleJoinPublicRoom = async (pubRoom: PublicRoom) => {
    try {
      await api.post('/rooms/join', { code: pubRoom.code }, true)
    } catch { /* 이미 가입됐을 수도 있음 */ }
    const t = nowTime()
    const newRoom: ChatRoom = {
      id: pubRoom.id,
      title: pubRoom.title,
      messages: [{ id: Date.now(), text: '채팅방에 참여했어요! 인사를 건네보세요 👋', isMine: false, time: t }],
      capacity: pubRoom.capacity,
      memberCount: pubRoom.memberCount + 1,
      members: [currentUser.nickname],
      ratings: {},
    }
    setPublicRooms(prev => prev.map(r =>
      r.id === pubRoom.id ? { ...r, memberCount: r.memberCount + 1 } : r
    ).filter(r => r.memberCount < r.capacity))
    setChatRooms(prev => [...prev, newRoom])
    setActiveRoom(newRoom)
    setSub('chatroom')
    setTab('채팅방')
  }

  const handleOpenRoom = (room: ChatRoom) => {
    setActiveRoom(room)
    setSub('chatroom')
  }

  const handleSend = (text: string) => {
    if (!activeRoom) return
    const msg: ChatMessage = {
      id: Date.now(), text, isMine: true,
      senderName: currentUser.nickname, time: nowTime(),
    }
    const updated = { ...activeRoom, messages: [...activeRoom.messages, msg] }
    setChatRooms(prev => prev.map(r => r.id === updated.id ? updated : r))
    setActiveRoom(updated)
  }

  const handleUpdateRoom = (updatedRoom: ChatRoom) => {
    setChatRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r))
    setActiveRoom(updatedRoom)
  }

  const handleLeave = async () => {
    if (!activeRoom) return
    try {
      await api.del(`/rooms/${activeRoom.id}/leave`, {}, true)
    } catch { /* ignore */ }
    setChatRooms(prev => prev.filter(r => r.id !== activeRoom.id))
    setActiveRoom(null)
    setSub(null)
    setTab('채팅방')
  }

  const handleUpdateUser = (nickname: string) => {
    setCurrentUser({ ...currentUser, nickname })
  }

  if (sub === 'random-create') return (
    <RandomMatchScreen
      onBack={() => setSub(null)}
      currentUser={currentUser}
      onMatchSuccess={handleMatchSuccess}
      onRoomCreated={handleRoomCreated}
      initialView="host-setup"
    />
  )
  if (sub === 'random-join') return (
    <RandomMatchScreen
      onBack={() => setSub(null)}
      currentUser={currentUser}
      onMatchSuccess={handleMatchSuccess}
      onRoomCreated={handleRoomCreated}
      publicRooms={publicRooms}
      onJoinPublicRoom={handleJoinPublicRoom}
      initialView="join-input"
    />
  )
  if (sub === 'random-instant') return (
    <RandomMatchScreen
      onBack={() => setSub(null)}
      currentUser={currentUser}
      onMatchSuccess={handleMatchSuccess}
      onRoomCreated={handleRoomCreated}
      initialView="instant"
    />
  )
  if (sub === 'chatroom' && activeRoom) return (
    <ChatRoomView
      room={activeRoom}
      currentUserId={currentUser.id}
      currentNickname={currentUser.nickname}
      onBack={() => { setSub(null); setTab('채팅방') }}
      onSend={handleSend}
      onUpdateRoom={handleUpdateRoom}
      onLeave={handleLeave}
    />
  )

  return (
    <div className="main-wrap">
      <div className="main-topbar">
        <span className="main-topbar-title">수원시그널</span>
      </div>

      <div className="main-content">
        {tab === '과팅'  && <GatingTab onCreate={() => setSub('random-create')} onJoin={() => setSub('random-join')} onInstant={() => setSub('random-instant')} />}
        {tab === '채팅방' && <ChatList rooms={chatRooms} onOpenRoom={handleOpenRoom} />}
        {tab === '설정'  && (
          <SettingsTab
            onLogout={onLogout}
            onAccountDeleted={onAccountDeleted}
            onPasswordReset={onPasswordReset}
            darkMode={darkMode}
            onToggleDarkMode={onToggleDarkMode}
            currentUser={currentUser}
            onUpdateUser={handleUpdateUser}
          />
        )}
      </div>

      <nav className="bottom-nav">
        {(['과팅', '채팅방', '설정'] as Tab[]).map(t => (
          <button key={t} className={`nav-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            <span className="nav-icon">{navIcon(t)}</span>
            <span className="nav-label">{t}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function navIcon(tab: Tab) {
  if (tab === '과팅') return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
  if (tab === '채팅방') return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function GatingTab({ onCreate, onJoin, onInstant }: { onCreate: () => void; onJoin: () => void; onInstant: () => void }) {
  return (
    <div className="gating-tab">
      <div className="gating-header">
        <p className="gating-subtitle">설레는 과팅을 시작해보세요 💙</p>
      </div>
      <div className="gating-cards">
        <button className="gating-card card-notice" onClick={onCreate}>
          <div className="card-icon">🏠</div>
          <div className="card-text">
            <span className="card-title">방 만들기</span>
            <span className="card-desc">방을 개설하고 고유 번호로<br />친구를 초대하세요</span>
          </div>
          <span className="card-arrow">›</span>
        </button>
        <button className="gating-card card-random" onClick={onJoin}>
          <div className="card-icon">🚪</div>
          <div className="card-text">
            <span className="card-title">방 참여하기</span>
            <span className="card-desc">방 번호를 입력해서<br />과팅방에 입장하세요</span>
          </div>
          <span className="card-arrow">›</span>
        </button>
        <button className="gating-card card-instant" onClick={onInstant}>
          <div className="card-icon">🎲</div>
          <div className="card-text">
            <span className="card-title">랜덤매칭</span>
            <span className="card-desc">인원 설정 후 즉시<br />랜덤으로 매칭해드려요</span>
          </div>
          <span className="card-arrow">›</span>
        </button>
      </div>
    </div>
  )
}
