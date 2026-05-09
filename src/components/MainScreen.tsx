import { useState } from 'react'
import SettingsTab from './SettingsTab'

type Tab = '과팅' | '채팅방' | '설정'

interface Props {
  onLogout: () => void
  onAccountDeleted: () => void
  onPasswordReset: () => void
}

export default function MainScreen({ onLogout, onAccountDeleted, onPasswordReset }: Props) {
  const [tab, setTab] = useState<Tab>('과팅')

  return (
    <div className="main-wrap">
      <div className="main-content">
        {tab === '과팅'  && <GatingTab />}
        {tab === '채팅방' && <PlaceholderTab title="채팅방" />}
        {tab === '설정'  && (
          <SettingsTab
            onLogout={onLogout}
            onAccountDeleted={onAccountDeleted}
            onPasswordReset={onPasswordReset}
          />
        )}
      </div>

      <nav className="bottom-nav">
        {(['과팅', '채팅방', '설정'] as Tab[]).map(t => (
          <button
            key={t}
            className={`nav-item ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function GatingTab() {
  return (
    <div className="gating-tab">
      <div className="gating-header">
        <h2 className="gating-title">수원시그널</h2>
        <p className="gating-subtitle">설레는 과팅을 시작해보세요 💙</p>
      </div>
      <div className="gating-cards">
        <button className="gating-card card-notice">
          <div className="card-icon">📋</div>
          <div className="card-text">
            <span className="card-title">공고모집</span>
            <span className="card-desc">과팅 공고를 올리거나<br />참여 신청을 해보세요</span>
          </div>
          <span className="card-arrow">›</span>
        </button>
        <button className="gating-card card-random">
          <div className="card-icon">🎲</div>
          <div className="card-text">
            <span className="card-title">랜덤매칭</span>
            <span className="card-desc">조건에 맞는 상대를<br />랜덤으로 매칭해드려요</span>
          </div>
          <span className="card-arrow">›</span>
        </button>
      </div>
    </div>
  )
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="placeholder-tab">
      <p className="placeholder-text">{title}</p>
      <p className="placeholder-sub">준비 중이에요</p>
    </div>
  )
}
