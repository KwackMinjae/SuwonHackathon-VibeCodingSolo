import { Server as IOServer } from 'socket.io'

let _io: IOServer

export function setIo(io: IOServer) {
  _io = io
}

export function getIo(): IOServer {
  return _io
}
