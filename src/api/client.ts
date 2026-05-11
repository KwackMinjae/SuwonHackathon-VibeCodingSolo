const BASE_URL = `${import.meta.env.VITE_API_URL ?? ''}/api`

export function getToken() {
  return localStorage.getItem('token')
}

export function setToken(token: string) {
  localStorage.setItem('token', token)
}

export function clearToken() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function getStoredUser(): UserInfo | null {
  const raw = localStorage.getItem('user')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function storeUser(user: UserInfo) {
  localStorage.setItem('user', JSON.stringify(user))
}

export interface UserInfo {
  id: number
  email: string
  nickname: string
  gender: '남' | '여'
  dept: string
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth = false
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? '오류가 발생했습니다.')
  return data as T
}

export const api = {
  post: <T>(path: string, body?: unknown, auth = false) => request<T>('POST', path, body, auth),
  get:  <T>(path: string, auth = false) => request<T>('GET', path, undefined, auth),
  put:  <T>(path: string, body?: unknown, auth = false) => request<T>('PUT', path, body, auth),
  del:  <T>(path: string, body?: unknown, auth = false) => request<T>('DELETE', path, body, auth),
}
