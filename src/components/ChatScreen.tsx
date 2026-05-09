import { useState, useEffect, useRef } from 'react'

export interface ChatMessage {
  id: number
  text: string
  isMine: boolean
  time: string
}

export interface ChatRoom {
  id: number
  title: string
  messages: ChatMessage[]
}

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
            return (
              <button key={room.id} className="chat-room-item" onClick={() => onOpenRoom(room)}>
                <div className="chat-room-icon">💬</div>
                <div className="chat-room-info">
                  <span className="chat-room-name">{room.title}</span>
                  <span className="chat-room-last">{last ? last.text : '채팅을 시작해보세요!'}</span>
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
  onBack: () => void
  onSend: (text: string) => void
}

export function ChatRoomView({ room, onBack, onSend }: RoomProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.messages.length])

  const handleSend = () => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <div className="chat-room-wrap">
      <div className="chat-room-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="chat-room-title">{room.title}</h2>
        <span />
      </div>

      <div className="chat-messages">
        {room.messages.map(msg => (
          <div key={msg.id} className={`chat-bubble-wrap ${msg.isMine ? 'mine' : 'theirs'}`}>
            <div className={`chat-bubble ${msg.isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
              {msg.text}
            </div>
            <span className="chat-time">{msg.time}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
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
