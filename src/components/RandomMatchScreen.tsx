import { useState } from 'react'

export interface UserProfile {
  nickname: string
  studentId: string
  gender: '남' | '여'
  dept: string
}

export interface MockUser extends UserProfile {
  id: number
}

export const MOCK_USERS: MockUser[] = [
  { id: 1,  nickname: '민지',  studentId: '20230101', gender: '여', dept: '경영학부' },
  { id: 2,  nickname: '수아',  studentId: '20220202', gender: '여', dept: '인문학부' },
  { id: 3,  nickname: '하린',  studentId: '20230303', gender: '여', dept: '컴퓨터학부' },
  { id: 4,  nickname: '예은',  studentId: '20220404', gender: '여', dept: '아동가족복지학과' },
  { id: 5,  nickname: '지유',  studentId: '20230505', gender: '여', dept: '간호학과' },
  { id: 6,  nickname: '나연',  studentId: '20220606', gender: '여', dept: '식품영양학과' },
  { id: 7,  nickname: '다인',  studentId: '20231707', gender: '여', dept: '외국어학부' },
  { id: 8,  nickname: '준혁',  studentId: '20230708', gender: '남', dept: '산업 및 기계공학부' },
  { id: 9,  nickname: '태양',  studentId: '20220809', gender: '남', dept: '경영학부' },
  { id: 10, nickname: '도현',  studentId: '20230910', gender: '남', dept: '전기전자공학부' },
  { id: 11, nickname: '시윤',  studentId: '20221011', gender: '남', dept: '컴퓨터학부' },
  { id: 12, nickname: '재원',  studentId: '20231112', gender: '남', dept: '데이터과학부' },
  { id: 13, nickname: '성민',  studentId: '20221213', gender: '남', dept: '법행정학부' },
  { id: 14, nickname: '현우',  studentId: '20231314', gender: '남', dept: '반도체공학과' },
]

type MatchSize = 2 | 3 | 4
type MatchStatus = 'idle' | 'searching' | 'success' | 'fail'

interface Props {
  onBack: () => void
  currentUser: UserProfile
  onMatchSuccess: (matchedUsers: MockUser[], size: MatchSize) => void
}

export default function RandomMatchScreen({ onBack, currentUser, onMatchSuccess }: Props) {
  const [selectedSizes, setSelectedSizes] = useState<Set<MatchSize>>(new Set([3]))
  const [deptFilter, setDeptFilter] = useState(false)
  const [status, setStatus] = useState<MatchStatus>('idle')
  const [matched, setMatched] = useState<MockUser[]>([])
  const [matchedSize, setMatchedSize] = useState<MatchSize>(3)

  const toggleSize = (size: MatchSize) => {
    setSelectedSizes(prev => {
      const next = new Set(prev)
      if (next.has(size) && next.size > 1) next.delete(size)
      else next.add(size)
      return next
    })
  }

  const startMatch = () => {
    setStatus('searching')

    setTimeout(() => {
      const opposite = currentUser.gender === '남' ? '여' : '남'
      let pool = MOCK_USERS.filter(u => u.gender === opposite)
      if (deptFilter) pool = pool.filter(u => u.dept !== currentUser.dept)

      // 큰 사이즈부터 시도
      const sizes = ([...selectedSizes] as MatchSize[]).sort((a, b) => b - a)
      let found: MockUser[] | null = null
      let foundSize: MatchSize = 3

      for (const size of sizes) {
        if (pool.length >= size) {
          found = [...pool].sort(() => Math.random() - 0.5).slice(0, size)
          foundSize = size
          break
        }
      }

      if (found) {
        setMatched(found)
        setMatchedSize(foundSize)
        setStatus('success')
      } else {
        setStatus('fail')
      }
    }, 2500)
  }

  // 매칭 성공 화면
  if (status === 'success') return (
    <div className="random-wrap">
      <div className="random-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="random-title">랜덤매칭</h2>
        <span />
      </div>
      <div className="match-success-wrap">
        <div className="match-success-icon">🎉</div>
        <h3 className="match-success-title">매칭 성공!</h3>
        <p className="match-success-desc">{matchedSize}v{matchedSize} 매칭이 완료되었어요</p>
        <div className="match-users-list">
          {matched.map(u => (
            <div key={u.id} className="match-user-chip">
              <span className="match-chip-nickname">{u.nickname}</span>
              <span className="match-chip-info">{u.studentId.slice(0, 4)}학번 · {u.dept}</span>
            </div>
          ))}
        </div>
        <button className="btn-login" onClick={() => onMatchSuccess(matched, matchedSize)}>
          채팅방 입장하기
        </button>
      </div>
    </div>
  )

  // 메인 설정 화면
  return (
    <div className="random-wrap">
      <div className="random-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="random-title">랜덤매칭</h2>
        <span />
      </div>

      {status === 'searching' ? (
        <div className="match-searching">
          <div className="match-heart-spin">💘</div>
          <p className="match-searching-text">매칭 상대를 찾고 있어요...</p>
          <p className="match-searching-sub">잠시만 기다려주세요</p>
        </div>
      ) : (
        <div className="random-settings">
          {status === 'fail' && (
            <div className="match-fail-msg">
              매칭 가능한 상대가 없어요.<br />필터를 조정해보세요.
            </div>
          )}

          <div className="random-section">
            <h3 className="random-section-title">매칭 인원</h3>
            <p className="random-section-desc">중복 선택 가능 · 가장 큰 인원 기준으로 매칭해요</p>
            <div className="size-btn-row">
              {([2, 3, 4] as MatchSize[]).map(size => (
                <button
                  key={size}
                  className={`btn-size ${selectedSizes.has(size) ? 'selected' : ''}`}
                  onClick={() => toggleSize(size)}
                >
                  <span className="size-label">{size}v{size}</span>
                  <span className="size-sub">각 {size}명</span>
                </button>
              ))}
            </div>
          </div>

          <div className="random-section">
            <h3 className="random-section-title">필터</h3>
            <button
              className={`btn-filter-toggle ${deptFilter ? 'on' : ''}`}
              onClick={() => setDeptFilter(p => !p)}
            >
              <span className="filter-icon">🏫</span>
              <div className="filter-text">
                <span className="filter-label">같은 과/학부 제외</span>
                <span className="filter-desc">나와 같은 {currentUser.dept} 제외</span>
              </div>
              <span className={`filter-badge ${deptFilter ? 'on' : 'off'}`}>
                {deptFilter ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          <button className="btn-login" style={{ marginTop: 'auto' }} onClick={startMatch}>
            매칭 시작하기 💘
          </button>
        </div>
      )}
    </div>
  )
}
