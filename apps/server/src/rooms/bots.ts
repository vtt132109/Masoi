import { botCommand, makeRng } from '@masoi/engine';
import type { Room, RoomDeps } from './Room';

/**
 * Bot chơi thử (chỉ dùng khi bật ALLOW_BOTS): sau mỗi thay đổi của ván, mỗi bot
 * hành động sau một khoảng trễ ngẫu nhiên, dựa trên đúng thông tin bot được thấy.
 */
export class BotRunner {
  private timers = new Set<NodeJS.Timeout>();
  private rng = makeRng(Date.now() & 0x7fffffff);
  private acted = new Map<string, number>();
  private pending = new Set<string>();
  private lastSeq = -1;

  constructor(
    private readonly room: Room,
    private readonly deps: RoomDeps,
  ) {}

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.acted.clear();
    this.pending.clear();
    this.lastSeq = -1;
  }

  onChange(): void {
    const game = this.room.game;
    if (!game || game.winner) return this.stop();
    if (game.phase.seq !== this.lastSeq) {
      this.lastSeq = game.phase.seq;
      this.acted.clear();
    }
    for (const bot of this.room.members.filter((m) => m.isBot && !m.left)) {
      const key = bot.id;
      if (this.pending.has(key) || (this.acted.get(key) ?? 0) >= 3) continue;
      this.pending.add(key);
      const seq = game.phase.seq;
      const delay = (500 + this.rng.int(2000)) * this.deps.timeScale;
      const t = setTimeout(() => {
        this.timers.delete(t);
        this.pending.delete(key);
        const g = this.room.game;
        if (!g || g.winner || g.phase.seq !== seq || g.phase.paused) return;
        const cmd = botCommand(g, bot.id, this.rng);
        if (!cmd) return;
        this.acted.set(key, (this.acted.get(key) ?? 0) + 1);
        try {
          this.room.dispatch(cmd);
        } catch {
          /* lệnh trễ nhịp: bỏ qua */
        }
      }, delay);
      this.timers.add(t);
    }
  }
}
