import { useState } from 'react'

type PostType = '같이나갈사람' | '상대'
type Gender = '남' | '여' | ''

interface Post {
  id: number
  title: string
  type: PostType
  gender: Gender
  count: number
  content: string
  createdAt: string
}

interface Props {
  onBack: () => void
  onJoin?: (title: string) => void
}

export default function NoticeScreen({ onBack, onJoin }: Props) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [posts, setPosts] = useState<Post[]>([
    {
      id: 1,
      title: '컴퓨터학부 3:3 과팅 구해요!',
      type: '같이나갈사람',
      gender: '남',
      count: 2,
      content: '저희는 여자 1명인데요, 같이 나갈 여자분 2명 더 구합니다! 편하게 연락주세요 😊',
      createdAt: '2026.05.09',
    },
    {
      id: 2,
      title: '경영학부 여자팀 상대 남자 구합니다',
      type: '상대',
      gender: '남',
      count: 3,
      content: '저희 여자 3명입니다. 상대 남자 3명 구해요. 분위기 좋은 분들 환영!',
      createdAt: '2026.05.09',
    },
  ])
  const [selected, setSelected] = useState<Post | null>(null)

  // 작성 폼 상태
  const [title, setTitle] = useState('')
  const [postType, setPostType] = useState<PostType>('같이나갈사람')
  const [gender, setGender] = useState<Gender>('')
  const [count, setCount] = useState(1)
  const [content, setContent] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setTitle(''); setPostType('같이나갈사람'); setGender(''); setCount(1); setContent(''); setErrors({})
  }

  const handleSubmit = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = '제목을 입력해주세요.'
    if (!gender) e.gender = '성별을 선택해주세요.'
    if (!content.trim()) e.content = '내용을 입력해주세요.'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const newPost: Post = {
      id: Date.now(),
      title: title.trim(),
      type: postType,
      gender,
      count,
      content: content.trim(),
      createdAt: new Date().toLocaleDateString('ko-KR').replace(/\. /g, '.').replace('.', ''),
    }
    setPosts(prev => [newPost, ...prev])
    resetForm()
    setView('list')
  }

  // ── 목록 ──
  if (view === 'list') return (
    <div className="notice-wrap">
      <div className="notice-header">
        <button className="btn-back" onClick={onBack}>← 뒤로</button>
        <h2 className="notice-title">공고모집</h2>
        <button className="btn-write" onClick={() => { resetForm(); setView('create') }}>✏️ 글쓰기</button>
      </div>

      <div className="notice-list">
        {posts.length === 0 && (
          <div className="notice-empty">아직 공고가 없어요.<br />첫 번째 공고를 올려보세요!</div>
        )}
        {posts.map(post => (
          <button key={post.id} className="notice-card" onClick={() => { setSelected(post); setView('detail') }}>
            <div className="notice-card-top">
              <span className="notice-card-title">{post.title}</span>
              <span className={`notice-badge ${post.type === '같이나갈사람' ? 'badge-team' : 'badge-partner'}`}>
                {post.type === '같이나갈사람'
                  ? `같이나갈 ${post.gender} ${post.count}명`
                  : `상대 ${post.gender}자 ${post.count}명`}
              </span>
            </div>
            <p className="notice-card-preview">{post.content}</p>
            <span className="notice-card-date">{post.createdAt}</span>
          </button>
        ))}
      </div>
    </div>
  )

  // ── 글쓰기 ──
  if (view === 'create') return (
    <div className="notice-wrap">
      <div className="notice-header">
        <button className="btn-back" onClick={() => setView('list')}>← 목록으로</button>
        <h2 className="notice-title">공고 작성</h2>
        <span />
      </div>

      <div className="create-form">
        {/* 제목 + 타입 선택 */}
        <div className="title-type-row">
          <div className="input-group" style={{ flex: 1 }}>
            <label>제목</label>
            <input
              type="text"
              placeholder="제목 입력"
              value={title}
              onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })) }}
              className={`pw-input ${errors.title ? 'error' : ''}`}
            />
            {errors.title && <p className="error-msg">{errors.title}</p>}
          </div>
          <div className="input-group type-select-group">
            <label>모집 유형</label>
            <select
              className="type-select"
              value={postType}
              onChange={e => { setPostType(e.target.value as PostType); setGender('') }}
            >
              <option value="같이나갈사람">같이 나갈 사람</option>
              <option value="상대">상대</option>
            </select>
          </div>
        </div>

        {/* 성별 + 인원 */}
        <div className="gender-count-row">
          <div className="input-group" style={{ flex: 1 }}>
            <label>
              {postType === '같이나갈사람' ? '필요한 성별' : '상대 성별'}
            </label>
            <div className="gender-row">
              {(['남', '여'] as Gender[]).map(g => (
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
          <div className="input-group count-group">
            <label>인원 수</label>
            <select
              className="type-select"
              value={count}
              onChange={e => setCount(Number(e.target.value))}
            >
              {[1,2,3,4,5,6].map(n => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </div>
        </div>

        {/* 자유 글쓰기 */}
        <div className="input-group">
          <label>내용</label>
          <textarea
            placeholder="공고 내용을 자유롭게 작성해주세요."
            value={content}
            onChange={e => { setContent(e.target.value); setErrors(p => ({ ...p, content: '' })) }}
            className={`notice-textarea ${errors.content ? 'error' : ''}`}
            rows={5}
          />
          {errors.content && <p className="error-msg">{errors.content}</p>}
        </div>

        <button className="btn-login" onClick={handleSubmit}>공고 등록하기</button>
      </div>
    </div>
  )

  // ── 상세 보기 ──
  return (
    <div className="notice-wrap">
      <div className="notice-header">
        <button className="btn-back" onClick={() => setView('list')}>← 목록으로</button>
        <h2 className="notice-title">공고 상세</h2>
        <span />
      </div>
      {selected && (
        <div className="notice-detail">
          <div className="notice-detail-top">
            <h3 className="notice-detail-title">{selected.title}</h3>
            <span className={`notice-badge ${selected.type === '같이나갈사람' ? 'badge-team' : 'badge-partner'}`}>
              {selected.type === '같이나갈사람'
                ? `같이나갈 ${selected.gender} ${selected.count}명`
                : `상대 ${selected.gender}자 ${selected.count}명`}
            </span>
          </div>
          <span className="notice-card-date">{selected.createdAt}</span>
          <div className="notice-detail-divider" />
          <p className="notice-detail-content">{selected.content}</p>
          <button className="btn-login" style={{ marginTop: 'auto' }} onClick={() => selected && onJoin?.(selected.title)}>참여 신청하기</button>
        </div>
      )}
    </div>
  )
}
