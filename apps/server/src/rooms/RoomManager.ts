import { randomInt } from 'node:crypto';
import type { PlayerId, RoomCode } from '@masoi/shared';
import { Room, RoomError, hashToken, type Member, type RoomDeps } from './Room';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // bỏ I và O cho dễ đọc

export const LIMITS = {
  hostGraceMs: 30_000,
  lobbyGraceMs: 2 * 60_000,
  emptyRoomMs: 5 * 60_000,
  abandonedGameMs: 10 * 60_000,
  idleMs: 30 * 60_000,
  maxAgeMs: 6 * 60 * 60_000,
  maxRooms: 2000,
};

export class RoomManager {
  private rooms = new Map<RoomCode, Room>();

  constructor(private readonly deps: RoomDeps) {}

  get size(): number {
    return this.rooms.size;
  }

  find(code: RoomCode): Room | undefined {
    return this.rooms.get(code);
  }

  private newCode(): RoomCode {
    for (let i = 0; i < 50; i++) {
      let code = '';
      for (let j = 0; j < 5; j++) code += ALPHABET[randomInt(0, ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
    throw new RoomError('INTERNAL', 'Không tạo được mã phòng');
  }

  create(nickname: string, avatar: number): { room: Room; member: Member; token: string } {
    if (this.rooms.size >= LIMITS.maxRooms)
      throw new RoomError('INTERNAL', 'Máy chủ đang quá tải, thử lại sau');
    const room = new Room(this.newCode(), this.deps);
    const { member, token } = room.addMember(nickname, avatar);
    this.rooms.set(room.code, room);
    this.deps.log.info({ room: room.code }, 'tạo phòng');
    return { room, member, token };
  }

  join(
    code: RoomCode,
    nickname: string,
    avatar: number,
  ): { room: Room; member: Member; token: string } {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Không tìm thấy phòng này');
    const { member, token } = room.addMember(nickname, avatar);
    return { room, member, token };
  }

  /** Tìm thành viên theo token (so sánh hash). */
  resume(code: RoomCode, token: string): { room: Room; member: Member } {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Phòng không còn tồn tại');
    const hash = hashToken(token);
    const member = room.members.find((m) => m.tokenHash === hash && !m.left);
    if (!member) throw new RoomError('BAD_SESSION', 'Phiên đã hết hạn, hãy vào lại phòng');
    return { room, member };
  }

  destroy(code: RoomCode): void {
    const room = this.rooms.get(code);
    if (!room) return;
    room.destroy();
    this.rooms.delete(code);
    this.deps.log.info({ room: code }, 'xóa phòng');
  }

  /** Dọn dẹp định kỳ. */
  sweep(): void {
    const now = this.deps.now();
    for (const room of [...this.rooms.values()]) {
      // Việc dọn dẹp tự nó không phải "hoạt động" của người chơi.
      const lastActivity = room.lastActivityAt;
      room.maintain(LIMITS.hostGraceMs, LIMITS.lobbyGraceMs);
      room.lastActivityAt = lastActivity;
      if (room.status === 'LOBBY' && room.activeMembers.length === 0) {
        this.destroy(room.code);
        continue;
      }
      const humans = room.connectedHumans;
      const lastSeen = Math.max(lastActivity, ...room.members.map((m) => m.disconnectedAt ?? 0));
      const emptyFor = now - lastSeen;
      const dead =
        now - room.createdAt > LIMITS.maxAgeMs ||
        now - lastActivity > LIMITS.idleMs ||
        (humans === 0 &&
          emptyFor > (room.status === 'IN_GAME' ? LIMITS.abandonedGameMs : LIMITS.emptyRoomMs));
      if (dead) this.destroy(room.code);
    }
  }

  closeAll(): void {
    for (const code of [...this.rooms.keys()]) this.destroy(code);
  }

  /** Dùng cho test/giám sát. */
  stats(): { rooms: number; players: number; inGame: number } {
    let players = 0;
    let inGame = 0;
    for (const r of this.rooms.values()) {
      players += r.connectedHumans;
      if (r.status === 'IN_GAME') inGame++;
    }
    return { rooms: this.rooms.size, players, inGame };
  }
}

export type { PlayerId };
