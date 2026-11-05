import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  GameConfigSchema,
  MAX_PLAYERS,
  MIN_PLAYERS,
  defaultConfig,
  mergeConfig,
  suggestRoles,
  validateConfig,
  type ErrorCode,
  type GameAction,
  type GameConfig,
  type GameConfigPatch,
  type HostCommand,
  type MemberView,
  type PlayerId,
  type RoomCode,
  type RoomView,
  type ServerToClient,
} from '@masoi/shared';
import {
  apply,
  createGame,
  nextDeadline,
  projectFor,
  type Command,
  type GameState,
} from '@masoi/engine';
import { BotRunner } from './bots';

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface Member {
  id: PlayerId;
  nickname: string;
  avatar: number;
  tokenHash: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
  isBot: boolean;
  left: boolean;
}

export interface Outbox {
  emit<K extends keyof ServerToClient>(
    socketId: string,
    event: K,
    ...args: Parameters<ServerToClient[K]>
  ): void;
}

export interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface RoomDeps {
  out: Outbox;
  now: () => number;
  /** Nhân mọi thời gian của ván (dùng cho test). */
  timeScale: number;
  allowBots: boolean;
  log: Logger;
}

/** Chủ phòng chỉ được loại người đã mất kết nối quá ngần này (ms). */
export const REMOVE_AFTER_MS = 30_000;

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const BOT_NAMES = [
  'An',
  'Bình',
  'Chi',
  'Dũng',
  'Em',
  'Giang',
  'Hà',
  'Khoa',
  'Linh',
  'Minh',
  'Nam',
  'Oanh',
  'Phúc',
  'Quân',
  'Sơn',
  'Trang',
  'Uyên',
  'Vy',
  'Xuân',
  'Yến',
];

export class Room {
  hostId: PlayerId;
  members: Member[] = [];
  config: GameConfig;
  autoRoles = true;
  game: GameState | null = null;
  status: 'LOBBY' | 'IN_GAME' = 'LOBBY';
  lastActivityAt: number;
  readonly createdAt: number;
  private cueSeq = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly bots: BotRunner;

  constructor(
    readonly code: RoomCode,
    private readonly deps: RoomDeps,
  ) {
    this.createdAt = deps.now();
    this.lastActivityAt = this.createdAt;
    this.hostId = '';
    this.config = defaultConfig(MIN_PLAYERS);
    this.bots = new BotRunner(this, deps);
  }

  // ------------------------------------------------------------ Thành viên

  get activeMembers(): Member[] {
    return this.members.filter((m) => !m.left);
  }

  member(id: PlayerId): Member | undefined {
    return this.members.find((m) => m.id === id);
  }

  /** Thêm người chơi (hoặc bot). Trả về token gốc để gửi cho client (chỉ lưu hash). */
  addMember(
    nickname: string,
    avatar: number,
    opts: { bot?: boolean } = {},
  ): { member: Member; token: string } {
    if (this.status === 'IN_GAME')
      throw new RoomError('ROOM_IN_GAME', 'Phòng đang chơi, không vào thêm được');
    if (this.activeMembers.length >= MAX_PLAYERS) throw new RoomError('ROOM_FULL', 'Phòng đã đầy');
    const taken = this.activeMembers.some(
      (m) => m.nickname.toLowerCase() === nickname.toLowerCase(),
    );
    if (taken) throw new RoomError('NICKNAME_TAKEN', 'Tên này đã có người dùng trong phòng');

    const token = randomBytes(24).toString('base64url');
    const now = this.deps.now();
    const member: Member = {
      id: randomBytes(6).toString('base64url'),
      nickname,
      avatar,
      tokenHash: hashToken(token),
      socketId: null,
      connected: opts.bot === true,
      ready: opts.bot === true,
      joinedAt: now,
      disconnectedAt: null,
      isBot: opts.bot === true,
      left: false,
    };
    this.members.push(member);
    if (!this.hostId) this.hostId = member.id;
    this.touch();
    this.refreshAutoRoles();
    return { member, token };
  }

  private refreshAutoRoles(): void {
    if (this.status !== 'LOBBY' || !this.autoRoles) return;
    const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, this.activeMembers.length));
    this.config.roles = suggestRoles(n);
  }

  /** Gắn socket mới cho thành viên. Trả về socket cũ (nếu có) để báo "bị thay thế". */
  connect(member: Member, socketId: string): string | null {
    const prev = member.socketId && member.socketId !== socketId ? member.socketId : null;
    member.socketId = socketId;
    member.connected = true;
    member.disconnectedAt = null;
    this.touch();
    return prev;
  }

  /** Socket rớt. Bỏ qua nếu socket này đã bị thay thế bằng socket khác. */
  disconnect(member: Member, socketId: string): void {
    if (member.socketId !== socketId) return;
    member.socketId = null;
    member.connected = false;
    member.disconnectedAt = this.deps.now();
    if (this.status === 'LOBBY') member.ready = false;
    this.touch();
  }

  setReady(member: Member, ready: boolean): void {
    if (this.status !== 'LOBBY') throw new RoomError('ROOM_IN_GAME', 'Ván đang chơi');
    member.ready = ready;
    this.touch();
  }

  updateProfile(member: Member, p: { nickname?: string; avatar?: number }): void {
    if (this.status !== 'LOBBY') throw new RoomError('ROOM_IN_GAME', 'Chỉ đổi tên ở phòng chờ');
    if (p.nickname !== undefined) {
      const nick = p.nickname;
      const taken = this.activeMembers.some(
        (m) => m.id !== member.id && m.nickname.toLowerCase() === nick.toLowerCase(),
      );
      if (taken) throw new RoomError('NICKNAME_TAKEN', 'Tên này đã có người dùng trong phòng');
      member.nickname = nick;
    }
    if (p.avatar !== undefined) member.avatar = p.avatar;
    this.touch();
  }

  /** Xóa hẳn khỏi phòng chờ. Nếu là chủ phòng thì chuyển quyền. */
  removeFromLobby(member: Member): void {
    this.members = this.members.filter((m) => m.id !== member.id);
    if (this.config.speakerDeviceId === member.id) this.config.speakerDeviceId = null;
    if (this.hostId === member.id) this.pickNewHost();
    this.touch();
    this.refreshAutoRoles();
  }

  private pickNewHost(): void {
    const next = this.activeMembers
      .filter((m) => m.connected && !m.isBot)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) this.hostId = next.id;
  }

  /** Rời phòng. Ở phòng chờ: xóa. Đang chơi: bị loại khỏi ván nhưng vẫn nằm trong danh sách đến hết ván. */
  leave(member: Member): void {
    if (this.status === 'LOBBY' || !this.game) {
      this.removeFromLobby(member);
      return;
    }
    if (this.game.winner) {
      member.left = true;
    } else {
      this.removeFromGame(member);
    }
    member.socketId = null;
    member.connected = false;
    if (this.hostId === member.id) this.pickNewHost();
    this.touch();
  }

  private removeFromGame(member: Member): void {
    member.left = true;
    if (this.game && !this.game.winner && !this.game.players[member.id]?.removed) {
      this.dispatch({ type: 'HOST', command: { kind: 'REMOVE_PLAYER', playerId: member.id } });
    }
  }

  kick(by: Member, targetId: PlayerId): Member {
    this.requireHost(by);
    if (this.status !== 'LOBBY') throw new RoomError('ROOM_IN_GAME', 'Chỉ loại người ở phòng chờ');
    const target = this.member(targetId);
    if (!target || target.id === by.id)
      throw new RoomError('INVALID_TARGET', 'Không loại được người này');
    this.removeFromLobby(target);
    return target;
  }

  transferHost(by: Member, targetId: PlayerId): void {
    this.requireHost(by);
    const target = this.member(targetId);
    if (!target || target.left || target.isBot)
      throw new RoomError('INVALID_TARGET', 'Không chuyển quyền được cho người này');
    this.hostId = target.id;
    this.touch();
  }

  addBot(by: Member): Member {
    this.requireHost(by);
    if (!this.deps.allowBots) throw new RoomError('BOTS_DISABLED', 'Máy chủ này không bật bot');
    const used = new Set(this.activeMembers.map((m) => m.nickname.toLowerCase()));
    const base =
      BOT_NAMES.find((n) => !used.has(`bot ${n}`.toLowerCase())) ?? `${randomInt(100, 999)}`;
    const { member } = this.addMember(`Bot ${base}`, randomInt(0, 24), { bot: true });
    return member;
  }

  removeBot(by: Member, targetId: PlayerId): void {
    this.requireHost(by);
    const target = this.member(targetId);
    if (!target?.isBot) throw new RoomError('INVALID_TARGET', 'Đây không phải bot');
    this.removeFromLobby(target);
  }

  // ------------------------------------------------------------ Cấu hình

  requireHost(by: Member): void {
    if (this.hostId !== by.id) throw new RoomError('NOT_HOST', 'Chỉ chủ phòng làm được việc này');
  }

  updateConfig(by: Member, patch: GameConfigPatch, autoRoles?: boolean): void {
    this.requireHost(by);
    if (this.status !== 'LOBBY')
      throw new RoomError('ROOM_IN_GAME', 'Chỉ chỉnh cấu hình ở phòng chờ');
    const merged = mergeConfig(this.config, patch);
    if (!GameConfigSchema.safeParse(merged).success)
      throw new RoomError('INVALID_CONFIG', 'Cấu hình không hợp lệ');
    if (merged.timers.nightMinMin > merged.timers.nightMinMax) {
      throw new RoomError(
        'INVALID_CONFIG',
        'Thời gian đêm tối thiểu: giá trị nhỏ phải ≤ giá trị lớn',
      );
    }
    if (merged.speakerDeviceId !== null) {
      const sp = this.member(merged.speakerDeviceId);
      if (!sp || sp.left || sp.isBot)
        throw new RoomError('INVALID_CONFIG', 'Thiết bị loa chung không hợp lệ');
    }
    this.config = merged;
    if (patch.roles) this.autoRoles = false;
    if (autoRoles !== undefined) this.autoRoles = autoRoles;
    this.refreshAutoRoles();
    this.touch();
  }

  // ------------------------------------------------------------ Bắt đầu / kết thúc ván

  startGame(by: Member): void {
    this.requireHost(by);
    if (this.status !== 'LOBBY') throw new RoomError('ROOM_IN_GAME', 'Ván đã bắt đầu');

    // Người đang mất kết nối ở phòng chờ không được tính vào ván.
    for (const m of this.activeMembers.filter((x) => !x.connected && !x.isBot))
      this.removeFromLobby(m);
    const players = this.activeMembers;
    if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
      throw new RoomError(
        'NOT_ENOUGH_PLAYERS',
        `Cần từ ${MIN_PLAYERS} đến ${MAX_PLAYERS} người chơi`,
      );
    }
    if (players.some((m) => m.id !== this.hostId && !m.ready)) {
      throw new RoomError('NOT_READY', 'Còn người chưa sẵn sàng');
    }
    this.refreshAutoRoles();
    const problems = validateConfig(this.config, players.length);
    if (problems.length > 0) {
      throw new RoomError(
        'INVALID_CONFIG',
        `Cấu hình chưa hợp lệ: ${problems.map((p) => p.code).join(', ')}`,
      );
    }

    const config = structuredClone(this.config);
    if (this.deps.timeScale !== 1) {
      for (const k of Object.keys(config.timers) as (keyof GameConfig['timers'])[]) {
        config.timers[k] = config.timers[k] * this.deps.timeScale;
      }
    }
    this.game = createGame({
      id: randomUUID(),
      players: players.map((m) => ({ id: m.id, name: m.nickname })),
      config,
      seed: randomInt(1, 2 ** 31 - 1),
      now: this.deps.now(),
    });
    this.status = 'IN_GAME';
    this.cueSeq = 0;
    this.touch();
    this.deps.log.info({ room: this.code, players: players.length }, 'ván bắt đầu');
    this.afterChange();
  }

  backToLobby(by: Member): void {
    this.requireHost(by);
    if (!this.game?.winner) throw new RoomError('NO_GAME', 'Ván chưa kết thúc');
    this.clearTimer();
    this.bots.stop();
    this.game = null;
    this.status = 'LOBBY';
    this.members = this.members.filter((m) => !m.left);
    for (const m of this.members) m.ready = m.isBot;
    this.refreshAutoRoles();
    this.touch();
    this.broadcastRoom();
  }

  // ------------------------------------------------------------ Lệnh trong ván

  private requireGame(): GameState {
    if (!this.game) throw new RoomError('NO_GAME', 'Chưa có ván nào đang chơi');
    return this.game;
  }

  ackRole(member: Member, phaseSeq: number): void {
    this.requireGame();
    this.dispatch({ type: 'ACK_ROLE', playerId: member.id, phaseSeq });
  }

  action(member: Member, phaseSeq: number, action: GameAction): void {
    this.requireGame();
    this.dispatch({ type: 'ACTION', playerId: member.id, phaseSeq, action });
  }

  hostCommand(by: Member, command: HostCommand): void {
    this.requireHost(by);
    const game = this.requireGame();
    if (command.kind === 'REMOVE_PLAYER') {
      const target = this.member(command.playerId);
      if (!target || target.id === by.id || target.left || !game.players[target.id]) {
        throw new RoomError('INVALID_TARGET', 'Không loại được người này');
      }
      const gone =
        target.disconnectedAt !== null &&
        this.deps.now() - target.disconnectedAt >= REMOVE_AFTER_MS;
      if (!target.isBot && !gone) {
        throw new RoomError(
          'INVALID_TARGET',
          'Chỉ loại được người đã mất kết nối từ 30 giây trở lên',
        );
      }
      this.removeFromGame(target);
      if (target.socketId)
        this.deps.out.emit(target.socketId, 'room:kicked', { reason: 'REMOVED' });
      this.touch();
      return;
    }
    this.dispatch({ type: 'HOST', command });
    if (command.kind === 'PAUSE') this.notice('PAUSED');
    if (command.kind === 'RESUME') this.notice('RESUMED');
  }

  /** Áp một lệnh vào engine; nếu hợp lệ thì phát view mới cho tất cả mọi người. */
  dispatch(cmd: Command): void {
    const game = this.requireGame();
    const r = apply(game, cmd, this.deps.now());
    if (!r.ok) throw new RoomError(r.error.code, r.error.message);
    this.game = r.state;
    this.touch();
    for (const kind of r.cues) {
      const cue = { kind, seq: ++this.cueSeq };
      for (const m of this.members) if (m.socketId) this.deps.out.emit(m.socketId, 'game:cue', cue);
    }
    this.afterChange();
  }

  private afterChange(): void {
    // Luôn gửi cho TẤT CẢ cùng lúc để không ai đoán vai qua nhịp cập nhật.
    this.broadcastRoom();
    this.broadcastGame();
    this.reschedule();
    this.bots.onChange();
  }

  private reschedule(): void {
    this.clearTimer();
    const game = this.game;
    if (!game) return;
    const deadline = nextDeadline(game);
    if (deadline === null) return;
    const delay = Math.min(Math.max(0, deadline - this.deps.now()), 2 ** 31 - 1);
    const seq = game.phase.seq;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        if (this.game && this.game.phase.seq === seq)
          this.dispatch({ type: 'TIMER', phaseSeq: seq });
      } catch (err) {
        this.deps.log.error({ room: this.code, err: String(err) }, 'lỗi khi xử lý hết giờ');
      }
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // ------------------------------------------------------------ Phát dữ liệu

  view(): RoomView {
    const speaker = this.config.speakerDeviceId
      ? this.member(this.config.speakerDeviceId)
      : undefined;
    const members: MemberView[] = this.members.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      avatar: m.avatar,
      connected: m.connected,
      ready: m.ready,
      isHost: m.id === this.hostId,
      isBot: m.isBot,
      left: m.left,
      disconnectedAt: m.disconnectedAt,
    }));
    return {
      code: this.code,
      hostId: this.hostId,
      status: this.status,
      members,
      config: this.config,
      autoRoles: this.autoRoles,
      allowBots: this.deps.allowBots,
      speakerId: speaker && !speaker.left && speaker.connected ? speaker.id : this.hostId,
    };
  }

  broadcastRoom(): void {
    const view = this.view();
    for (const m of this.members) if (m.socketId) this.deps.out.emit(m.socketId, 'room:view', view);
  }

  gameViewFor(member: Member) {
    if (!this.game || !this.game.players[member.id]) return null;
    return projectFor(this.game, member.id);
  }

  broadcastGame(): void {
    if (!this.game) return;
    for (const m of this.members) {
      if (!m.socketId || m.isBot) continue;
      const v = this.gameViewFor(m);
      if (v) this.deps.out.emit(m.socketId, 'game:view', v);
    }
  }

  /** Gửi lại toàn bộ trạng thái cho một người (sau khi vào phòng / kết nối lại). */
  sendFullState(member: Member): void {
    if (!member.socketId) return;
    this.deps.out.emit(member.socketId, 'room:view', this.view());
    const v = this.gameViewFor(member);
    if (v) this.deps.out.emit(member.socketId, 'game:view', v);
  }

  private notice(code: string): void {
    for (const m of this.members) {
      if (m.socketId) this.deps.out.emit(m.socketId, 'server:notice', { level: 'info', code });
    }
  }

  // ------------------------------------------------------------ Dọn dẹp

  touch(): void {
    this.lastActivityAt = this.deps.now();
  }

  /** Chạy định kỳ: chuyển quyền chủ phòng, dọn người mất kết nối ở phòng chờ. */
  maintain(hostGraceMs: number, lobbyGraceMs: number): void {
    const now = this.deps.now();
    const host = this.member(this.hostId);
    if (!host || (host.disconnectedAt !== null && now - host.disconnectedAt > hostGraceMs)) {
      const before = this.hostId;
      this.pickNewHost();
      if (this.hostId !== before) {
        this.notice('HOST_CHANGED');
        this.broadcastRoom();
      }
    }
    if (this.status === 'LOBBY') {
      const stale = this.members.filter(
        (m) =>
          !m.connected &&
          !m.isBot &&
          m.disconnectedAt !== null &&
          now - m.disconnectedAt > lobbyGraceMs,
      );
      for (const m of stale) this.removeFromLobby(m);
      if (stale.length > 0) this.broadcastRoom();
    }
  }

  get connectedHumans(): number {
    return this.members.filter((m) => m.connected && !m.isBot && !m.left).length;
  }

  destroy(): void {
    this.clearTimer();
    this.bots.stop();
    for (const m of this.members) {
      if (m.socketId) this.deps.out.emit(m.socketId, 'room:kicked', { reason: 'REMOVED' });
    }
  }
}
