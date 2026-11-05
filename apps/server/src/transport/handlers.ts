import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  ClientEvents,
  ClientPayloads,
  type Ack,
  type ClientEventName,
  type ErrorCode,
  type JoinResult,
  type ResumeResult,
  type ServerToClient,
} from '@masoi/shared';
import { SlidingWindowLimiter, TokenBucket } from '../rateLimit';
import { Room, RoomError, type Member, type Outbox } from '../rooms/Room';
import type { RoomManager } from '../rooms/RoomManager';

interface Session {
  roomCode: string;
  playerId: string;
}

type SocketData = { session?: Session; bucket: TokenBucket };
type MasoiSocket = Socket<Record<string, never>, ServerToClient, Record<string, never>, SocketData>;

export function createOutbox(io: Server): Outbox {
  return {
    emit(socketId, event, ...args) {
      (io.to(socketId) as unknown as { emit: (e: string, ...a: unknown[]) => void }).emit(
        event,
        ...args,
      );
    },
  };
}

export interface TransportOptions {
  trustProxy: boolean;
  now: () => number;
  log: { warn(obj: object, msg?: string): void; error(obj: object, msg?: string): void };
}

const fail = (code: ErrorCode, message: string): Ack => ({ ok: false, code, message });
const ok = <T>(data: T): Ack<T> => ({ ok: true, data });

const clientIp = (socket: MasoiSocket, trustProxy: boolean): string => {
  if (trustProxy) {
    const fwd = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address;
};

export function registerHandlers(
  io: Server,
  manager: RoomManager,
  out: Outbox,
  opts: TransportOptions,
): { sweepLimiters: () => void } {
  const createLimiter = new SlidingWindowLimiter(20, 60 * 60_000); // tạo phòng/giờ/IP
  const joinFailLimiter = new SlidingWindowLimiter(10, 60_000); // vào phòng sai/phút/IP

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as unknown as MasoiSocket;
    socket.data.bucket = new TokenBucket(40, 20, opts.now());
    const ip = clientIp(socket, opts.trustProxy);

    const session = (): { room: Room; member: Member } => {
      const s = socket.data.session;
      const room = s ? manager.find(s.roomCode) : undefined;
      const member = room?.member(s?.playerId ?? '');
      if (!room || !member || member.left || member.socketId !== socket.id) {
        throw new RoomError('NOT_IN_ROOM', 'Bạn chưa ở trong phòng nào');
      }
      return { room, member };
    };

    const attach = (room: Room, member: Member): void => {
      const prev = room.connect(member, socket.id);
      socket.data.session = { roomCode: room.code, playerId: member.id };
      if (prev) {
        out.emit(prev, 'session:replaced');
        const old = io.sockets.sockets.get(prev) as unknown as MasoiSocket | undefined;
        if (old) old.data.session = undefined;
      }
    };

    /** Đăng ký một handler: kiểm tra schema, giới hạn tốc độ, bắt lỗi, trả ack thống nhất. */
    function on<E extends ClientEventName>(
      event: E,
      handler: (payload: z.infer<(typeof ClientPayloads)[E]>) => unknown,
    ): void {
      socket.on(event as string, (raw: unknown, ack?: (a: Ack<unknown>) => void) => {
        const reply = (a: Ack<unknown>) => {
          if (typeof ack === 'function') ack(a);
        };
        if (!socket.data.bucket.take(opts.now()))
          return reply(fail('RATE_LIMITED', 'Bạn thao tác quá nhanh'));
        const parsed = ClientPayloads[event].safeParse(raw ?? {});
        if (!parsed.success)
          return reply(fail('VALIDATION_FAILED', 'Dữ liệu gửi lên không hợp lệ'));
        try {
          const data = handler(parsed.data as z.infer<(typeof ClientPayloads)[E]>);
          reply(ok(data ?? undefined));
        } catch (err) {
          if (err instanceof RoomError) return reply(fail(err.code, err.message));
          opts.log.error({ event, err: String(err) }, 'lỗi không mong đợi');
          reply(fail('INTERNAL', 'Có lỗi xảy ra, thử lại sau'));
        }
      });
    }

    const guardJoin = <T>(fn: () => T): T => {
      if (!joinFailLimiter.allowed(ip, opts.now())) {
        throw new RoomError('RATE_LIMITED', 'Thử sai quá nhiều lần, đợi một phút rồi thử lại');
      }
      try {
        return fn();
      } catch (err) {
        if (
          err instanceof RoomError &&
          (err.code === 'ROOM_NOT_FOUND' || err.code === 'BAD_SESSION')
        ) {
          joinFailLimiter.record(ip, opts.now());
        }
        throw err;
      }
    };

    // ---------------------------------------------------------- Phiên & thời gian

    on(ClientEvents.timePing, () => ({ serverTs: Date.now() }));

    on(ClientEvents.sessionResume, ({ roomCode, token }): ResumeResult => {
      const { room, member } = guardJoin(() => manager.resume(roomCode, token));
      attach(room, member);
      room.broadcastRoom();
      return { playerId: member.id, room: room.view(), game: room.gameViewFor(member) };
    });

    // ---------------------------------------------------------- Phòng

    on(ClientEvents.roomCreate, ({ nickname, avatar }): JoinResult => {
      if (!createLimiter.hit(ip, opts.now()))
        throw new RoomError('RATE_LIMITED', 'Bạn tạo phòng quá nhiều, thử lại sau');
      const { room, member, token } = manager.create(nickname, avatar);
      attach(room, member);
      room.sendFullState(member);
      return { roomCode: room.code, playerId: member.id, token };
    });

    on(ClientEvents.roomJoin, ({ roomCode, nickname, avatar }): JoinResult => {
      const { room, member, token } = guardJoin(() => manager.join(roomCode, nickname, avatar));
      attach(room, member);
      room.broadcastRoom();
      return { roomCode: room.code, playerId: member.id, token };
    });

    on(ClientEvents.roomLeave, () => {
      const { room, member } = session();
      socket.data.session = undefined;
      room.leave(member);
      if (room.activeMembers.length === 0 && room.status === 'LOBBY') manager.destroy(room.code);
      else {
        room.broadcastRoom();
        room.broadcastGame();
      }
    });

    on(ClientEvents.roomSetReady, ({ ready }) => {
      const { room, member } = session();
      room.setReady(member, ready);
      room.broadcastRoom();
    });

    on(ClientEvents.roomUpdateProfile, (p) => {
      const { room, member } = session();
      room.updateProfile(member, p);
      room.broadcastRoom();
    });

    on(ClientEvents.roomUpdateConfig, ({ patch, autoRoles }) => {
      const { room, member } = session();
      room.updateConfig(member, patch, autoRoles);
      room.broadcastRoom();
    });

    on(ClientEvents.roomKick, ({ playerId }) => {
      const { room, member } = session();
      const target = room.kick(member, playerId);
      if (target.socketId) {
        out.emit(target.socketId, 'room:kicked', { reason: 'KICKED' });
        const s = io.sockets.sockets.get(target.socketId) as unknown as MasoiSocket | undefined;
        if (s) s.data.session = undefined;
      }
      room.broadcastRoom();
    });

    on(ClientEvents.roomTransferHost, ({ playerId }) => {
      const { room, member } = session();
      room.transferHost(member, playerId);
      room.broadcastRoom();
    });

    on(ClientEvents.roomAddBot, () => {
      const { room, member } = session();
      room.addBot(member);
      room.broadcastRoom();
    });

    on(ClientEvents.roomRemoveBot, ({ playerId }) => {
      const { room, member } = session();
      room.removeBot(member, playerId);
      room.broadcastRoom();
    });

    // ---------------------------------------------------------- Ván

    on(ClientEvents.gameStart, () => {
      const { room, member } = session();
      room.startGame(member);
    });

    on(ClientEvents.gameAckRole, ({ phaseSeq }) => {
      const { room, member } = session();
      room.ackRole(member, phaseSeq);
    });

    on(ClientEvents.gameAction, ({ phaseSeq, action }) => {
      const { room, member } = session();
      room.action(member, phaseSeq, action);
    });

    on(ClientEvents.gameHost, ({ command }) => {
      const { room, member } = session();
      room.hostCommand(member, command);
    });

    on(ClientEvents.gameBackToLobby, () => {
      const { room, member } = session();
      room.backToLobby(member);
    });

    socket.on('disconnect', () => {
      const s = socket.data.session;
      if (!s) return;
      const room = manager.find(s.roomCode);
      const member = room?.member(s.playerId);
      if (!room || !member) return;
      room.disconnect(member, socket.id);
      room.broadcastRoom();
    });
  });

  return {
    sweepLimiters: () => {
      const now = opts.now();
      createLimiter.sweep(now);
      joinFailLimiter.sweep(now);
    },
  };
}
