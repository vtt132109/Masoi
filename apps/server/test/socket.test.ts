import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connectClient, type Socket } from 'socket.io-client';
import {
  ClientEvents,
  type Ack,
  type GameAction,
  type JoinResult,
  type PlayerView,
  type ResumeResult,
  type RoomView,
} from '@masoi/shared';
import { createApp } from '../src/app';

let app: Awaited<ReturnType<typeof createApp>>;
let port = 0;
const sockets: Socket[] = [];

beforeAll(async () => {
  app = await createApp({
    port: 0,
    host: '127.0.0.1',
    allowBots: true,
    timeScale: 0.012,
    logLevel: 'silent',
  });
  port = await app.listen();
});

afterAll(async () => {
  for (const s of sockets) s.close();
  await app.close();
});

class Client {
  socket: Socket;
  room: RoomView | null = null;
  game: PlayerView | null = null;
  cues: string[] = [];
  events: string[] = [];
  playerId = '';
  token = '';
  roomCode = '';

  constructor() {
    this.socket = connectClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(this.socket);
    this.socket.on('room:view', (v: RoomView) => (this.room = v));
    this.socket.on('game:view', (v: PlayerView) => (this.game = v));
    this.socket.on('game:cue', (c: { kind: string }) => this.cues.push(c.kind));
    for (const e of ['session:replaced', 'room:kicked', 'server:notice']) {
      this.socket.on(e, () => this.events.push(e));
    }
  }

  ready(): Promise<void> {
    return new Promise((res) =>
      this.socket.connected ? res() : this.socket.once('connect', () => res()),
    );
  }

  emit<T = undefined>(event: string, payload: object = {}): Promise<Ack<T>> {
    return new Promise((res) => this.socket.emit(event, payload, (a: Ack<T>) => res(a)));
  }

  async create(nickname: string): Promise<JoinResult> {
    await this.ready();
    const r = await this.emit<JoinResult>(ClientEvents.roomCreate, { nickname, avatar: 1 });
    if (!r.ok) throw new Error(r.message);
    Object.assign(this, {
      playerId: r.data.playerId,
      token: r.data.token,
      roomCode: r.data.roomCode,
    });
    return r.data;
  }

  async join(roomCode: string, nickname: string) {
    await this.ready();
    const r = await this.emit<JoinResult>(ClientEvents.roomJoin, { roomCode, nickname, avatar: 2 });
    if (r.ok)
      Object.assign(this, {
        playerId: r.data.playerId,
        token: r.data.token,
        roomCode: r.data.roomCode,
      });
    return r;
  }

  /** Hành động tự động đơn giản dựa trên myAction của chính mình. */
  autoPlay(): void {
    const v = this.game;
    if (!v) return;
    const seq = v.phase.seq;
    const send = (action: GameAction) =>
      this.socket.emit(ClientEvents.gameAction, { phaseSeq: seq, action }, () => undefined);
    const a = v.myAction;
    const first = <T>(xs: T[]) => xs[0] ?? null;
    switch (a.kind) {
      case 'ACK_ROLE':
        if (!a.done) this.socket.emit(ClientEvents.gameAckRole, { phaseSeq: seq }, () => undefined);
        break;
      case 'NIGHT_DUMMY':
        if (!a.done) send({ type: 'NIGHT_DUMMY', suspect: first(a.targets) });
        break;
      case 'SEER_CHECK':
        if (!a.done) send({ type: 'SEER_CHECK', target: first(a.targets) });
        break;
      case 'GUARD_PROTECT':
        if (!a.done) send({ type: 'GUARD_PROTECT', target: first(a.targets) });
        break;
      case 'WOLF_VOTE':
        if (!a.locked) {
          send({ type: 'WOLF_VOTE', target: first(a.targets) });
          send({ type: 'WOLF_LOCK' });
        }
        break;
      case 'WITCH_ACT':
        if (!a.done) send({ type: 'WITCH_ACT', heal: a.canHeal, poison: null });
        break;
      case 'HUNTER_SHOOT':
        send({ type: 'HUNTER_SHOOT', target: first(a.targets) });
        break;
      case 'DISCUSS':
        if (!a.readyToVote) send({ type: 'READY_TO_VOTE', ready: true });
        break;
      case 'VOTE':
        if (a.current === null) send({ type: 'VOTE', target: first(a.targets) });
        break;
      default:
    }
  }
}

const until = async (cond: () => boolean, ms = 5000, what = 'điều kiện') => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error(`Quá thời gian chờ ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe('socket: phòng chờ', () => {
  it('tạo phòng, vào phòng, báo lỗi đúng mã, đồng bộ danh sách', async () => {
    const host = new Client();
    const { roomCode } = await host.create('Chủ phòng');
    await until(() => host.room?.members.length === 1);

    const guest = new Client();
    const bad = await guest.join('ZZZZZ', 'Khách');
    expect(bad).toMatchObject({ ok: false, code: 'ROOM_NOT_FOUND' });
    const invalid = await guest.emit(ClientEvents.roomJoin, {
      roomCode: 'abc',
      nickname: 'x',
      avatar: 99,
    });
    expect(invalid).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });

    const ok = await guest.join(roomCode.toLowerCase(), '  Khách   Mới ');
    expect(ok.ok).toBe(true);
    await until(() => host.room?.members.length === 2);
    expect(host.room?.members.map((m) => m.nickname)).toEqual(['Chủ phòng', 'Khách Mới']);

    const dup = await new Client().join(roomCode, 'khách mới');
    expect(dup).toMatchObject({ ok: false, code: 'NICKNAME_TAKEN' });

    const notHost = await guest.emit(ClientEvents.roomUpdateConfig, {
      patch: { playMode: 'REMOTE' },
    });
    expect(notHost).toMatchObject({ ok: false, code: 'NOT_HOST' });
    const cfg = await host.emit(ClientEvents.roomUpdateConfig, {
      patch: { playMode: 'REMOTE', voiceCallUrl: 'https://meet.example.com/abc' },
    });
    expect(cfg.ok).toBe(true);
    await until(() => guest.room?.config.playMode === 'REMOTE');
    const badUrl = await host.emit(ClientEvents.roomUpdateConfig, {
      patch: { voiceCallUrl: 'http://x.com' },
    });
    expect(badUrl).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });
    const js = await host.emit(ClientEvents.roomUpdateConfig, {
      patch: { voiceCallUrl: 'javascript:alert(1)' },
    });
    expect(js).toMatchObject({ ok: false, code: 'VALIDATION_FAILED' });

    const ping = await host.emit<{ serverTs: number }>(ClientEvents.timePing, {
      clientTs: Date.now(),
    });
    expect(ping.ok && Math.abs(ping.data.serverTs - Date.now()) < 1000).toBe(true);
  });

  it('chưa vào phòng thì không gọi được lệnh phòng/ván', async () => {
    const c = new Client();
    await c.ready();
    expect(await c.emit(ClientEvents.gameStart)).toMatchObject({ ok: false, code: 'NOT_IN_ROOM' });
    expect(
      await c.emit(ClientEvents.gameAction, { phaseSeq: 1, action: { type: 'WOLF_LOCK' } }),
    ).toMatchObject({
      ok: false,
      code: 'NOT_IN_ROOM',
    });
  });

  it('kết nối lại bằng token: nhận lại đủ trạng thái; tab cũ bị báo thay thế', async () => {
    const a = new Client();
    const { roomCode, token, playerId } = await a.create('Người quay lại');
    const b = new Client();
    await b.ready();
    const bad = await b.emit(ClientEvents.sessionResume, { roomCode, token: 'x'.repeat(24) });
    expect(bad).toMatchObject({ ok: false, code: 'BAD_SESSION' });

    const r = await b.emit<ResumeResult>(ClientEvents.sessionResume, { roomCode, token });
    expect(r.ok && r.data.playerId).toBe(playerId);
    await until(() => a.events.includes('session:replaced'));
    // tab cũ không còn thao tác được
    expect(await a.emit(ClientEvents.roomSetReady, { ready: true })).toMatchObject({
      ok: false,
      code: 'NOT_IN_ROOM',
    });
    expect(await b.emit(ClientEvents.roomSetReady, { ready: true })).toMatchObject({ ok: true });
  });

  it('mất kết nối thì hiện ở danh sách, kết nối lại thì khôi phục', async () => {
    const host = new Client();
    const { roomCode } = await host.create('Chủ');
    const g = new Client();
    await g.join(roomCode, 'Khách');
    await until(() => host.room?.members.length === 2);
    g.socket.close();
    await until(() => host.room?.members.find((m) => m.nickname === 'Khách')?.connected === false);
    const g2 = new Client();
    await g2.ready();
    await g2.emit(ClientEvents.sessionResume, { roomCode, token: g.token });
    await until(() => host.room?.members.find((m) => m.nickname === 'Khách')?.connected === true);
  });

  it('giới hạn tốc độ: bắn quá nhiều lệnh sẽ bị RATE_LIMITED', async () => {
    const c = new Client();
    await c.create('Spam');
    const results = await Promise.all(
      Array.from({ length: 120 }, () => c.emit(ClientEvents.timePing, { clientTs: 1 })),
    );
    expect(results.some((r) => !r.ok && r.code === 'RATE_LIMITED')).toBe(true);
  });
});

describe('socket: một ván đầy đủ', () => {
  it('1 người + 4 bot chơi từ đầu đến hết, không rò thông tin, cue và view đúng', async () => {
    const human = new Client();
    await human.create('Người chơi');
    for (let i = 0; i < 4; i++) {
      expect(await human.emit(ClientEvents.roomAddBot)).toMatchObject({ ok: true });
    }
    await until(() => human.room?.members.length === 5);
    expect(human.room?.members.filter((m) => m.isBot)).toHaveLength(4);

    // Mỗi view nhận được đều phải sạch: không có vai của người khác đang sống.
    const seen: PlayerView[] = [];
    human.socket.on('game:view', (v: PlayerView) => {
      seen.push(v);
      for (const p of v.players) {
        if (p.id !== v.me.id && p.alive && !v.gameOver) expect(p.revealedRole).toBeUndefined();
      }
      human.autoPlay();
    });

    expect(await human.emit(ClientEvents.gameStart)).toMatchObject({ ok: true });
    await until(() => human.game?.phase.id === 'GAME_OVER', 90_000, 'ván kết thúc');

    const v = human.game!;
    expect(v.gameOver?.win.winner).toMatch(/VILLAGE|WOLF|DRAW/);
    expect(Object.keys(v.gameOver?.roles ?? {})).toHaveLength(5);
    expect(human.cues).toContain('NIGHT_FALLS');
    expect(human.cues).toContain('GAME_OVER');
    expect(seen.length).toBeGreaterThan(10);
    // nhận được view ở đúng thứ tự pha tăng dần
    for (let i = 1; i < seen.length; i++)
      expect(seen[i]!.phase.seq).toBeGreaterThanOrEqual(seen[i - 1]!.phase.seq);

    // Quay lại phòng chờ và chơi lại được.
    expect(await human.emit(ClientEvents.gameBackToLobby)).toMatchObject({ ok: true });
    await until(() => human.room?.status === 'LOBBY');
    expect(human.room?.members).toHaveLength(5);
  }, 120_000);

  it('người chơi người thật: 5 client cùng chơi, mỗi người chỉ thấy vai của mình', async () => {
    const clients = [new Client(), new Client(), new Client(), new Client(), new Client()];
    const first = clients[0]!;
    const { roomCode } = await first.create('P0');
    for (let i = 1; i < 5; i++) {
      const r = await clients[i]!.join(roomCode, `P${i}`);
      expect(r.ok).toBe(true);
      await clients[i]!.emit(ClientEvents.roomSetReady, { ready: true });
    }
    await until(
      () =>
        first.room?.members.length === 5 && first.room.members.every((m) => m.ready || m.isHost),
    );

    const notReadyTest = await clients[1]!.emit(ClientEvents.gameStart);
    expect(notReadyTest).toMatchObject({ ok: false, code: 'NOT_HOST' });

    for (const c of clients) {
      c.socket.on('game:view', (v: PlayerView) => {
        for (const p of v.players) {
          if (p.id !== v.me.id && p.alive && !v.gameOver) expect(p.revealedRole).toBeUndefined();
        }
        c.autoPlay();
      });
    }
    expect(await first.emit(ClientEvents.gameStart)).toMatchObject({ ok: true });
    await until(
      () => clients.every((c) => c.game?.phase.id === 'GAME_OVER'),
      90_000,
      'ván kết thúc',
    );

    // Cuối ván mọi người thấy cùng một kết quả.
    const winners = new Set(clients.map((c) => c.game?.gameOver?.win.winner));
    expect(winners.size).toBe(1);
    // Mỗi người biết đúng vai của mình trong bảng vai cuối ván.
    for (const c of clients) expect(c.game?.gameOver?.roles[c.playerId]).toBe(c.game?.me.role);
  }, 120_000);
});
