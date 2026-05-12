// localStorage 기반 인메모리 DB (서버 없이 동작)

const P = 'ss_'

function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(P + key) ?? '[]') } catch { return [] }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(P + key, JSON.stringify(data))
}

function nextId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1
}

export interface DBUser { id: number; email: string; password: string; nickname: string; gender: string; dept: string }
export interface DBRoom { id: number; title: string; code: string; hostId: number; capacity: number; teamGender: string; status: string }
export interface DBMember { roomId: number; userId: number }
export interface DBMessage { id: number; roomId: number; userId: number | null; nickname: string | null; text: string; type: string; createdAt: string }
export interface DBAppointment { roomId: number; place: string; datetimeISO: string; accepted: number; verified: number }
export interface DBRating { roomId: number; raterId: number; rateeId: number; stars: number }
export interface DBVCode { email: string; code: string; type: string; expiresAt: number; used: number }

export const db = {
  users: {
    all: (): DBUser[] => load('users'),
    find: (id: number): DBUser | null => load<DBUser>('users').find(u => u.id === id) ?? null,
    byEmail: (email: string): DBUser | null => load<DBUser>('users').find(u => u.email === email) ?? null,
    create(d: Omit<DBUser, 'id'>): DBUser {
      const all = load<DBUser>('users')
      const u: DBUser = { id: nextId(all), ...d }
      save('users', [...all, u])
      return u
    },
    update(id: number, p: Partial<DBUser>): void {
      save('users', load<DBUser>('users').map(u => u.id === id ? { ...u, ...p } : u))
    },
    delete(id: number): void {
      save('users', load<DBUser>('users').filter(u => u.id !== id))
    },
  },
  rooms: {
    all: (): DBRoom[] => load('rooms'),
    find: (id: number): DBRoom | null => load<DBRoom>('rooms').find(r => r.id === id) ?? null,
    byCode: (code: string): DBRoom | null => load<DBRoom>('rooms').find(r => r.code === code) ?? null,
    create(d: Omit<DBRoom, 'id'>): DBRoom {
      const all = load<DBRoom>('rooms')
      const r: DBRoom = { id: nextId(all), ...d }
      save('rooms', [...all, r])
      return r
    },
    update(id: number, p: Partial<DBRoom>): void {
      save('rooms', load<DBRoom>('rooms').map(r => r.id === id ? { ...r, ...p } : r))
    },
  },
  members: {
    forRoom: (roomId: number): DBMember[] => load<DBMember>('members').filter(m => m.roomId === roomId),
    count: (roomId: number): number => load<DBMember>('members').filter(m => m.roomId === roomId).length,
    has: (roomId: number, userId: number): boolean => load<DBMember>('members').some(m => m.roomId === roomId && m.userId === userId),
    add(roomId: number, userId: number): void {
      const all = load<DBMember>('members')
      if (!all.some(m => m.roomId === roomId && m.userId === userId)) save('members', [...all, { roomId, userId }])
    },
    remove(roomId: number, userId: number): void {
      save('members', load<DBMember>('members').filter(m => !(m.roomId === roomId && m.userId === userId)))
    },
    removeUser(userId: number): void {
      save('members', load<DBMember>('members').filter(m => m.userId !== userId))
    },
  },
  messages: {
    forRoom: (roomId: number): DBMessage[] => load<DBMessage>('messages').filter(m => m.roomId === roomId),
    add(d: Omit<DBMessage, 'id' | 'createdAt'>): DBMessage {
      const all = load<DBMessage>('messages')
      const m: DBMessage = { id: nextId(all), ...d, createdAt: new Date().toISOString() }
      save('messages', [...all, m])
      return m
    },
  },
  appointments: {
    forRoom: (roomId: number): DBAppointment | null => load<DBAppointment>('appointments').find(a => a.roomId === roomId) ?? null,
    set(roomId: number, place: string, datetimeISO: string): void {
      save('appointments', [
        ...load<DBAppointment>('appointments').filter(a => a.roomId !== roomId),
        { roomId, place, datetimeISO, accepted: 0, verified: 0 },
      ])
    },
    accept(roomId: number): void {
      save('appointments', load<DBAppointment>('appointments').map(a => a.roomId === roomId ? { ...a, accepted: 1 } : a))
    },
    verify(roomId: number): void {
      save('appointments', load<DBAppointment>('appointments').map(a => a.roomId === roomId ? { ...a, verified: 1 } : a))
    },
  },
  ratings: {
    upsert(roomId: number, raterId: number, rateeId: number, stars: number): void {
      save('ratings', [
        ...load<DBRating>('ratings').filter(r => !(r.roomId === roomId && r.raterId === raterId && r.rateeId === rateeId)),
        { roomId, raterId, rateeId, stars },
      ])
    },
  },
  vcodes: {
    set(email: string, code: string, type: string): void {
      save('vcodes', [
        ...load<DBVCode>('vcodes').filter(c => !(c.email === email && c.type === type && c.used === 0)),
        { email, code, type, expiresAt: Date.now() + 10 * 60 * 1000, used: 0 },
      ])
    },
    getPending(email: string, type: string): DBVCode | null {
      const all = load<DBVCode>('vcodes').filter(c => c.email === email && c.type === type && c.used === 0)
      return all[all.length - 1] ?? null
    },
    hasVerified(email: string, type: string): boolean {
      return load<DBVCode>('vcodes').some(c => c.email === email && c.type === type && c.used === 1)
    },
    markUsed(email: string, type: string): void {
      save('vcodes', load<DBVCode>('vcodes').map(c =>
        c.email === email && c.type === type && c.used === 0 ? { ...c, used: 1 } : c
      ))
    },
  },
}

export function makeRoomCode(): string {
  let code: string
  do { code = String(Math.floor(100000 + Math.random() * 900000)) } while (db.rooms.byCode(code))
  return code
}

export function encodeToken(userId: number, email: string): string {
  return btoa(JSON.stringify({ userId, email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }))
}

export function decodeToken(token: string): { userId: number; email: string } | null {
  try {
    const d = JSON.parse(atob(token))
    if (d.exp < Date.now()) return null
    return { userId: d.userId, email: d.email }
  } catch { return null }
}

// 데모용 초기 데이터 - 앱 시작 시 DB가 비어있으면 샘플 유저 추가
export function seedDemoData(): void {
  if (db.users.all().length > 0) return
  const demoUsers = [
    { email: '22철수', password: 'demo1234', nickname: '철수', gender: '남', dept: '컴퓨터학부' },
    { email: '23민수', password: 'demo1234', nickname: '민수', gender: '남', dept: '전기전자공학부' },
    { email: '24준호', password: 'demo1234', nickname: '준호', gender: '남', dept: '데이터과학부' },
    { email: '22영희', password: 'demo1234', nickname: '영희', gender: '여', dept: '경영학부' },
    { email: '23민지', password: 'demo1234', nickname: '민지', gender: '여', dept: '간호학과' },
    { email: '24수연', password: 'demo1234', nickname: '수연', gender: '여', dept: '인문학부' },
  ]
  for (const u of demoUsers) db.users.create(u)
}
