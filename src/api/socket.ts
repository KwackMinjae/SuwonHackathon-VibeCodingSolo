import { io, Socket } from 'socket.io-client'
import { getToken } from './client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL ?? window.location.origin
    socket = io(apiUrl, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function reconnectSocket() {
  disconnectSocket()
  return getSocket()
}
