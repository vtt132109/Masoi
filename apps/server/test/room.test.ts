import { describe, expect, it } from 'vitest';
import { RoomError, REMOVE_AFTER_MS, type Outbox, type Room } from '../src/rooms/Room';
import { LIMITS, RoomManager } from '../src/rooms/RoomManager';

function setup(opts: { allowBots?: boolean; timeScale?: number } = {}) {
  const clock = { t: 1_000_000 };
  const sent: { socketId: string; event: string; payload: unknown }[] = [];
  const out: Outbox = {
    emit(socketId, event, ...args) {
      sent.push({ socketId, event, payload: args[0] });
    },
  };
  const noop = () => undefined;
  const manager = new RoomManager({
    out,
    now: () => clock.t,
    timeScale: opts.timeScale ?? 1,
    allowBots: opts.allowBots ?? false,
    log: { info: noop, warn: noop, error: noop },
  });
  return { clock, sent, manager };
}

function fill(manager: RoomManager, n: number) {
  const { room, member: host } = manager.create('Chủ phòng', 0);
  room.connect(host, 's-host');
  const others = [];
  for (let i = 1; i < n; i++) {
    const { member } = manager.join(room.code, `Người ${i}`, i % 24);
    room.connect(member, `s-${i}`);
    member.ready = true;
    others.push(member);
  }
  return { room, host, others };
}

const code = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof RoomError ? e.code : `lỗi khác: ${String(e)}`;
  }
  return 'OK';
};

describe('phòng chờ', () => {
  it('tạo phòng với mã 5 ký tự dễ đọc, người tạo là chủ phòng', () => {
    const { manager } = setup();
    const { room, member } = manager.create('An', 3);
    expect(room.code).toMatch(/^[A-HJ-NP-Z]{5}$/);
    expect(room.hostId).toBe(member.id);
  });

  it('không cho trùng tên (không phân biệt hoa thường), phòng đầy, không có phòng', () => {
    const { manager } = setup();
    const { room } = manager.create('An', 0);
    expect(code(() => manager.join(room.code, 'AN', 1))).toBe('NICKNAME_TAKEN');
    expect(code(() => manager.join('ZZZZZ', 'Bình', 1))).toBe('ROOM_NOT_FOUND');
    for (let i = 1; i < 20; i++) manager.join(room.code, `P${i}`, 0);
    expect(code(() => manager.join(room.code, 'Thừa', 0))).toBe('ROOM_FULL');
  });

  it('tự gợi ý bộ vai theo số người cho đến khi chủ phòng tự chỉnh', () => {
    const { manager } = setup();
    const { room, host, others } = fill(manager, 8);
    expect(room.config.roles.WEREWOLF).toBe(2);
    expect(room.config.roles.HUNTER).toBe(1);
    room.removeFromLobby(others[0]!);
    expect(room.config.roles.HUNTER).toBe(0); // 7 người
    room.updateConfig(host, { roles: { VILLAGER: 3 } });
    expect(room.autoRoles).toBe(false);
    const before = { ...room.config.roles };
    manager.join(room.code, 'Mới', 0);
    expect(room.config.roles).toEqual(before);
    room.updateConfig(host, {}, true);
    expect(room.autoRoles).toBe(true);
  });

  it('chỉ chủ phòng được chỉnh cấu hình, kick, bắt đầu', () => {
    const { manager } = setup();
    const { room, host, others } = fill(manager, 6);
    const guest = others[0]!;
    expect(code(() => room.updateConfig(guest, { playMode: 'REMOTE' }))).toBe('NOT_HOST');
    expect(code(() => room.kick(guest, host.id))).toBe('NOT_HOST');
    expect(code(() => room.startGame(guest))).toBe('NOT_HOST');
    expect(code(() => room.updateConfig(host, { playMode: 'REMOTE' }))).toBe('OK');
    expect(room.config.playMode).toBe('REMOTE');
  });

  it('link cuộc gọi phải là https; loa chung phải là người trong phòng', () => {
    const { manager } = setup();
    const { room, host, others } = fill(manager, 5);
    expect(code(() => room.updateConfig(host, { speakerDeviceId: 'khong-co' }))).toBe(
      'INVALID_CONFIG',
    );
    room.updateConfig(host, { speakerDeviceId: others[0]!.id });
    expect(room.view().speakerId).toBe(others[0]!.id);
    others[0]!.connected = false;
    expect(room.view().speakerId).toBe(host.id); // quay về chủ phòng khi loa chung mất kết nối
  });

  it('bắt đầu ván: kiểm tra đủ người, sẵn sàng, cấu hình hợp lệ', () => {
    const { manager } = setup();
    const { room, host, others } = fill(manager, 4);
    expect(code(() => room.startGame(host))).toBe('NOT_ENOUGH_PLAYERS');

    const { manager: m2 } = setup();
    const f = fill(m2, 6);
    f.others[0]!.ready = false;
    expect(code(() => f.room.startGame(f.host))).toBe('NOT_READY');
    f.others[0]!.ready = true;
    f.room.updateConfig(f.host, { roles: { WEREWOLF: 0, VILLAGER: 5 } });
    expect(code(() => f.room.startGame(f.host))).toBe('INVALID_CONFIG');
    f.room.updateConfig(f.host, {}, true);
    expect(code(() => f.room.startGame(f.host))).toBe('OK');
    expect(f.room.status).toBe('IN_GAME');
    expect(code(() => f.room.startGame(f.host))).toBe('ROOM_IN_GAME');
    void room;
    void host;
    void others;
  });

  it('không vào thêm được khi đang chơi; mỗi người chỉ nhận view của chính mình', () => {
    const { manager, sent } = setup();
    const { room, host, others } = fill(manager, 6);
    room.startGame(host);
    expect(code(() => manager.join(room.code, 'Muộn', 0))).toBe('ROOM_IN_GAME');

    sent.length = 0;
    room.broadcastGame();
    const views = sent.filter((s) => s.event === 'game:view');
    expect(views).toHaveLength(6);
    for (const m of [host, ...others]) {
      const v = views.find((x) => x.socketId === m.socketId)!.payload as { me: { id: string } };
      expect(v.me.id).toBe(m.id);
    }
    expect(JSON.stringify(sent)).not.toContain('"seed"');
  });
});

describe('kết nối & dọn dẹp', () => {
  it('chuyển quyền chủ phòng sau khi mất kết nối quá hạn', () => {
    const { manager, clock } = setup();
    const { room, host, others } = fill(manager, 5);
    room.disconnect(host, 's-host');
    clock.t += LIMITS.hostGraceMs - 1000;
    manager.sweep();
    expect(room.hostId).toBe(host.id);
    clock.t += 2000;
    manager.sweep();
    expect(room.hostId).toBe(others[0]!.id);
  });

  it('phòng chờ: người mất kết nối quá 2 phút bị xóa; phòng trống quá 5 phút bị xóa', () => {
    const { manager, clock } = setup();
    const { room, host, others } = fill(manager, 5);
    room.disconnect(others[0]!, 's-1');
    clock.t += LIMITS.lobbyGraceMs + 1000;
    manager.sweep();
    expect(room.members).toHaveLength(4);

    for (const m of room.members) room.disconnect(m, m.socketId ?? '');
    void host;
    clock.t += LIMITS.emptyRoomMs + 1000;
    manager.sweep();
    expect(manager.find(room.code)).toBeUndefined();
  });

  it('phòng không hoạt động quá 30 phút hoặc tồn tại quá 6 giờ bị xóa', () => {
    const a = setup();
    const ra = fill(a.manager, 5).room;
    a.clock.t += LIMITS.idleMs + 1000;
    a.manager.sweep();
    expect(a.manager.find(ra.code)).toBeUndefined();

    const b = setup();
    const { room: rb } = fill(b.manager, 5);
    for (let i = 0; i < 13; i++) {
      b.clock.t += 30 * 60_000 - 1000;
      rb.touch();
      b.manager.sweep();
    }
    expect(b.manager.find(rb.code)).toBeUndefined();
  });

  it('kết nối lại bằng token: đúng người, sai token thì bị từ chối; socket cũ bị thay thế', () => {
    const { manager } = setup();
    const { room, member, token } = manager.create('An', 0);
    room.connect(member, 'old');
    expect(code(() => manager.resume(room.code, 'sai-token-sai-token-1234'))).toBe('BAD_SESSION');
    const r = manager.resume(room.code, token);
    expect(r.member.id).toBe(member.id);
    expect(room.connect(r.member, 'new')).toBe('old');
    // socket cũ rớt muộn không được làm người chơi bị coi là mất kết nối
    room.disconnect(member, 'old');
    expect(member.connected).toBe(true);
    room.disconnect(member, 'new');
    expect(member.connected).toBe(false);
  });
});

describe('trong ván', () => {
  it('chủ phòng chỉ loại được người đã mất kết nối đủ lâu', () => {
    const { manager, clock } = setup();
    const { room, host, others } = fill(manager, 6);
    room.startGame(host);
    const target = others[0]!;
    expect(code(() => room.hostCommand(host, { kind: 'REMOVE_PLAYER', playerId: target.id }))).toBe(
      'INVALID_TARGET',
    );
    room.disconnect(target, target.socketId!);
    clock.t += REMOVE_AFTER_MS - 1;
    expect(code(() => room.hostCommand(host, { kind: 'REMOVE_PLAYER', playerId: target.id }))).toBe(
      'INVALID_TARGET',
    );
    clock.t += 2;
    expect(code(() => room.hostCommand(host, { kind: 'REMOVE_PLAYER', playerId: target.id }))).toBe(
      'OK',
    );
    expect(room.game?.players[target.id]?.alive).toBe(false);
    expect(target.left).toBe(true);
  });

  it('rời phòng giữa ván → bị loại khỏi ván; quyền chủ phòng chuyển đi', () => {
    const { manager } = setup();
    const { room, host, others } = fill(manager, 6);
    room.startGame(host);
    room.leave(host);
    expect(room.game?.players[host.id]?.removed).toBe(true);
    expect(room.hostId).toBe(others[0]!.id);
  });

  it('bot chỉ có khi máy chủ cho phép', () => {
    const off = setup();
    const a = fill(off.manager, 5);
    expect(code(() => a.room.addBot(a.host))).toBe('BOTS_DISABLED');

    const on = setup({ allowBots: true });
    const { room, member } = on.manager.create('Chủ', 0);
    room.connect(member, 's');
    for (let i = 0; i < 4; i++) room.addBot(member);
    expect(room.activeMembers).toHaveLength(5);
    expect(room.activeMembers.filter((m) => m.isBot).every((m) => m.ready && m.connected)).toBe(
      true,
    );
    room.startGame(member);
    room.destroy();
  });

  it('chỉ quay về phòng chờ khi ván đã kết thúc', () => {
    const { manager } = setup();
    const { room, host } = fill(manager, 6);
    room.startGame(host);
    expect(code(() => room.backToLobby(host))).toBe('NO_GAME');
    room.destroy();
  });
});

export type { Room };
