import { Router, Response } from 'express'
import db from '../db'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { getIo } from '../io'

const router = Router()
router.use(authMiddleware)

function makeCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 방 만들기
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { capacity, teamGender, allowDuplicate } = req.body as { capacity: number; teamGender: string; allowDuplicate?: boolean }
    if (!capacity || !teamGender) return res.status(400).json({ message: '인원수와 팀 성별이 필요합니다.' })

    const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.userId) as { nickname: string }
    if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    const title = `${capacity}v${capacity} 과팅`
    let code = makeCode()
    while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) code = makeCode()

    const result = db.prepare(
      'INSERT INTO rooms (title, code, host_id, capacity, team_gender, allow_duplicate) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, code, req.userId, capacity, teamGender, allowDuplicate !== false ? 1 : 0) as { lastInsertRowid: number }

    const roomId = Number(result.lastInsertRowid)
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(roomId, req.userId)
    db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
      .run(roomId, null, '시스템', `🏠 ${user.nickname}님이 방을 만들었어요!`, 'system')

    return res.status(201).json({
      room: { id: roomId, title, code, capacity, teamGender, memberCount: 1 },
    })
  } catch (e) {
    console.error('[POST /rooms]', e)
    return res.status(500).json({ message: '방 만들기에 실패했습니다.' })
  }
})

// 공개 방 목록
router.get('/public', (req: AuthRequest, res: Response) => {
  try {
    const rooms = db.prepare(`
      SELECT r.id, r.title, r.code, r.capacity, r.team_gender AS teamGender,
             COUNT(rm.id) AS memberCount
      FROM rooms r
      LEFT JOIN room_members rm ON rm.room_id = r.id
      WHERE r.status = 'waiting'
      GROUP BY r.id
      HAVING memberCount < r.capacity
      ORDER BY r.created_at DESC
      LIMIT 20
    `).all()
    return res.json({ rooms })
  } catch (e) {
    console.error('[GET /rooms/public]', e)
    return res.status(500).json({ message: '방 목록 조회에 실패했습니다.' })
  }
})

// 코드로 방 참여
router.post('/join', (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code: string }
    if (!code) return res.status(400).json({ message: '초대 코드가 필요합니다.' })

    const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code) as {
      id: number; title: string; code: string; capacity: number; team_gender: string; status: string; host_id: number
    } | undefined

    if (!room) return res.status(404).json({ message: '존재하지 않는 방입니다.' })
    if (room.status !== 'waiting') return res.status(400).json({ message: '이미 시작된 방입니다.' })

    const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM room_members WHERE room_id = ?').get(room.id) as { cnt: number }).cnt
    if (memberCount >= room.capacity) return res.status(400).json({ message: '방이 가득 찼습니다.' })

    const alreadyIn = db.prepare('SELECT id FROM room_members WHERE room_id = ? AND user_id = ?').get(room.id, req.userId)
    if (!alreadyIn) {
      db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, req.userId)
      const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.userId) as { nickname: string }
      db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
        .run(room.id, null, '시스템', `👋 ${user.nickname}님이 입장했어요!`, 'system')
    }

    const updatedMembers = db.prepare(`
      SELECT u.nickname, u.id
      FROM room_members rm JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
      ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, rm.id ASC
    `).all(room.id, room.host_id) as { nickname: string; id: number }[]

    const io = getIo()
    io.to(`room:${room.id}`).emit('member-joined', {
      members: updatedMembers.map(m => m.nickname),
      memberCount: updatedMembers.length,
      hostId: room.host_id,
    })

    return res.json({
      room: { id: room.id, title: room.title, code: room.code, capacity: room.capacity, teamGender: room.team_gender, memberCount: updatedMembers.length, hostId: room.host_id },
    })
  } catch (e) {
    console.error('[POST /rooms/join]', e)
    return res.status(500).json({ message: '방 참여에 실패했습니다.' })
  }
})

// 방 정보 조회
router.get('/:id', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)

    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) as {
      id: number; title: string; code: string; capacity: number; team_gender: string; status: string; host_id: number
    } | undefined

    if (!room) return res.status(404).json({ message: '방을 찾을 수 없습니다.' })

    const members = db.prepare(`
      SELECT u.id, u.nickname, u.gender, u.dept, u.email, u.student_id
      FROM room_members rm
      JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
      ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, rm.id ASC
    `).all(roomId, room.host_id) as { id: number; nickname: string; gender: string; dept: string; email: string; student_id: string }[]

    const messages = db.prepare(
      'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC'
    ).all(roomId)

    const appointment = db.prepare('SELECT * FROM appointments WHERE room_id = ?').get(roomId)

    return res.json({ room: { ...room, teamGender: room.team_gender, hostId: room.host_id, members, memberCount: members.length, messages, appointment } })
  } catch (e) {
    console.error('[GET /rooms/:id]', e)
    return res.status(500).json({ message: '방 정보 조회에 실패했습니다.' })
  }
})

// 팀원 추방 (방장 전용)
router.delete('/:id/members/:userId', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)
    const targetUserId = parseInt(req.params.userId)

    const room = db.prepare('SELECT host_id FROM rooms WHERE id = ?').get(roomId) as { host_id: number } | undefined
    if (!room) return res.status(404).json({ message: '방을 찾을 수 없습니다.' })
    if (room.host_id !== req.userId) return res.status(403).json({ message: '방장만 추방할 수 있습니다.' })
    if (targetUserId === req.userId) return res.status(400).json({ message: '자신을 추방할 수 없습니다.' })

    const target = db.prepare('SELECT nickname FROM users WHERE id = ?').get(targetUserId) as { nickname: string } | undefined
    if (!target) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

    db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, targetUserId)
    db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
      .run(roomId, null, '시스템', `🚫 ${target.nickname}님이 추방되었습니다.`, 'system')

    const updatedMembers = db.prepare(`
      SELECT u.nickname, u.id
      FROM room_members rm JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
      ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, rm.id ASC
    `).all(roomId, room.host_id) as { nickname: string; id: number }[]

    const io = getIo()
    io.to(`room:${roomId}`).emit('member-joined', {
      members: updatedMembers.map(m => m.nickname),
      memberCount: updatedMembers.length,
      hostId: room.host_id,
    })
    io.to(`user:${targetUserId}`).emit('kicked-from-room', { roomId })

    return res.json({ message: '추방되었습니다.' })
  } catch (e) {
    console.error('[DELETE /rooms/:id/members/:userId]', e)
    return res.status(500).json({ message: '추방에 실패했습니다.' })
  }
})

// 방 나가기
router.delete('/:id/leave', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)
    const user = db.prepare('SELECT nickname FROM users WHERE id = ?').get(req.userId) as { nickname: string }
    const room = db.prepare('SELECT host_id, status FROM rooms WHERE id = ?').get(roomId) as { host_id: number; status: string } | undefined

    const io = getIo()

    if (room && room.host_id === req.userId && room.status === 'waiting') {
      // 방장이 나가면 방 전체 종료
      db.prepare('DELETE FROM room_members WHERE room_id = ?').run(roomId)
      db.prepare("UPDATE rooms SET status = 'closed' WHERE id = ?").run(roomId)
      io.to(`room:${roomId}`).emit('room-closed', { roomId, reason: '방장이 방을 나갔습니다.' })
    } else {
      db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(roomId, req.userId)
      db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
        .run(roomId, null, '시스템', `🚪 ${user.nickname}님이 퇴장했어요.`, 'system')

      const updatedMembers = db.prepare(`
        SELECT u.nickname FROM room_members rm JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = ?
        ORDER BY CASE WHEN u.id = ? THEN 0 ELSE 1 END, rm.id ASC
      `).all(roomId, room?.host_id ?? 0) as { nickname: string }[]

      io.to(`room:${roomId}`).emit('member-joined', {
        members: updatedMembers.map(m => m.nickname),
        memberCount: updatedMembers.length,
        hostId: room?.host_id,
      })

      if (updatedMembers.length === 0) {
        db.prepare("UPDATE rooms SET status = 'closed' WHERE id = ?").run(roomId)
      }
    }

    return res.json({ message: '방을 나갔습니다.' })
  } catch (e) {
    console.error('[DELETE /rooms/:id/leave]', e)
    return res.status(500).json({ message: '방 나가기에 실패했습니다.' })
  }
})

// 약속 설정
router.post('/:id/appointment', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)
    const { place, datetimeISO } = req.body as { place: string; datetimeISO: string }
    if (!place || !datetimeISO) return res.status(400).json({ message: '장소와 시간이 필요합니다.' })

    db.prepare(`
      INSERT INTO appointments (room_id, place, datetime_iso)
      VALUES (?, ?, ?)
      ON CONFLICT(room_id) DO UPDATE SET place = excluded.place, datetime_iso = excluded.datetime_iso, accepted = 0, verified = 0
    `).run(roomId, place, datetimeISO)

    db.prepare('INSERT INTO messages (room_id, user_id, nickname, text, type) VALUES (?, ?, ?, ?, ?)')
      .run(roomId, req.userId, null, '', 'appointment')

    return res.json({ message: '약속이 설정되었습니다.' })
  } catch (e) {
    console.error('[POST /rooms/:id/appointment]', e)
    return res.status(500).json({ message: '약속 설정에 실패했습니다.' })
  }
})

// 약속 수락
router.put('/:id/appointment/accept', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)
    db.prepare('UPDATE appointments SET accepted = 1 WHERE room_id = ?').run(roomId)
    return res.json({ message: '약속이 수락되었습니다.' })
  } catch (e) {
    console.error('[PUT /rooms/:id/appointment/accept]', e)
    return res.status(500).json({ message: '약속 수락에 실패했습니다.' })
  }
})

// 만남 인증
router.put('/:id/appointment/verify', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)
    db.prepare('UPDATE appointments SET verified = 1 WHERE room_id = ?').run(roomId)
    return res.json({ message: '만남이 인증되었습니다.' })
  } catch (e) {
    console.error('[PUT /rooms/:id/appointment/verify]', e)
    return res.status(500).json({ message: '만남 인증에 실패했습니다.' })
  }
})

// 맘에 드는 상대 선택 (mutual like → 1:1 DM방)
router.post('/:id/like', (req: AuthRequest, res: Response) => {
  try {
    const roomId = parseInt(req.params.id)
    const { likeeId } = req.body as { likeeId: number }
    if (!likeeId) return res.status(400).json({ message: 'likeeId가 필요합니다.' })

    const likerId = req.userId!

    // 이미 선택했는지 확인
    const existing = db.prepare('SELECT id FROM likes WHERE room_id = ? AND liker_id = ?').get(roomId, likerId)
    if (existing) return res.status(409).json({ message: '이미 선택하셨습니다.' })

    db.prepare('INSERT INTO likes (room_id, liker_id, likee_id) VALUES (?, ?, ?)').run(roomId, likerId, likeeId)

    // 상호 선택 여부 확인
    const mutual = db.prepare(
      'SELECT id FROM likes WHERE room_id = ? AND liker_id = ? AND likee_id = ?'
    ).get(roomId, likeeId, likerId)

    if (!mutual) {
      return res.json({ matched: false })
    }

    // 상호 선택! 1:1 DM방 생성
    const liker = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(likerId) as { id: number; nickname: string }
    const likee = db.prepare('SELECT id, nickname FROM users WHERE id = ?').get(likeeId) as { id: number; nickname: string }

    const title = `💌 ${liker.nickname} & ${likee.nickname}`
    const makeCode = () => String(Math.floor(100000 + Math.random() * 900000))
    let code = makeCode()
    while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) code = makeCode()

    const result = db.prepare(
      'INSERT INTO rooms (title, code, host_id, capacity, team_gender, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, code, likerId, 2, '혼성', 'active') as { lastInsertRowid: number }

    const dmRoomId = Number(result.lastInsertRowid)
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(dmRoomId, likerId)
    db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').run(dmRoomId, likeeId)

    // 두 유저에게 소켓 이벤트 전송
    const io = getIo()
    const payload = {
      dmRoomId,
      title,
      otherUser: { id: likee.id, nickname: likee.nickname },
    }
    const payloadForLikee = {
      dmRoomId,
      title,
      otherUser: { id: liker.id, nickname: liker.nickname },
    }
    io.to(`user:${likerId}`).emit('mutual-match-found', payload)
    io.to(`user:${likeeId}`).emit('mutual-match-found', payloadForLikee)

    return res.json({ matched: true, dmRoomId, title })
  } catch (e) {
    console.error('[POST /rooms/:id/like]', e)
    return res.status(500).json({ message: '좋아요에 실패했습니다.' })
  }
})

export default router
