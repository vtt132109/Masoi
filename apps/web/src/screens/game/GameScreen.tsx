import { History, Menu, Moon, NotebookPen, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PlayerView, RoomView } from '@masoi/shared';
import { ROLE_TEAM } from '@masoi/shared';
import { Avatar } from '../../components/Avatar';
import { HistoryPanel } from '../../components/HistoryPanel';
import { Notebook } from '../../components/Notebook';
import { Sheet } from '../../components/Sheet';
import { TimerRing } from '../../components/TimerRing';
import { useNotebook } from '../../features/notebook';
import { useIsDesktop } from '../../hooks/useBreakpoint';
import { vi } from '../../i18n/vi';
import { ROLE_ICON, ROLE_ORDER } from '../../lib/roles';
import { useApp } from '../../store';
import { DawnScreen } from './Dawn';
import { DiscussionScreen } from './Discussion';
import { ExecutionScreen } from './Execution';
import { GameOverScreen } from './GameOver';
import { HoldToSee } from './HoldToSee';
import { HunterScreen } from './Hunter';
import { MenuSheet } from './MenuSheet';
import { NightScreen } from './Night';
import { RoleReveal } from './RoleReveal';
import { VoteScreen } from './Vote';

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock =
          (await (
            navigator as unknown as {
              wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> };
            }
          ).wakeLock?.request('screen')) ?? null;
      } catch {
        /* không hỗ trợ hoặc bị từ chối */
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

function headerOf(game: PlayerView): { title: string; sub: string; night: boolean } {
  const n = game.phase.dayNumber;
  switch (game.phase.id) {
    case 'ROLE_REVEAL':
      return { title: vi.phases.ROLE_REVEAL, sub: '', night: true };
    case 'NIGHT':
      return { title: vi.night(n), sub: vi.nightUi.asleep, night: true };
    case 'DAWN':
      return { title: vi.phases.DAWN, sub: vi.day(n), night: false };
    case 'HUNTER_SHOT':
      return { title: vi.hunter.title, sub: vi.day(n), night: false };
    case 'DISCUSSION':
      return { title: vi.day(n), sub: vi.phases.DISCUSSION, night: false };
    case 'VOTE':
    case 'REVOTE':
      return { title: vi.day(n), sub: vi.phases[game.phase.id], night: false };
    case 'EXECUTION':
      return { title: vi.day(n), sub: vi.phases.EXECUTION, night: false };
    case 'GAME_OVER':
      return { title: vi.phases.GAME_OVER, sub: '', night: game.gameOver?.win.winner === 'WOLF' };
  }
}

function PhaseContent({ game, room }: { game: PlayerView; room: RoomView }) {
  switch (game.phase.id) {
    case 'ROLE_REVEAL':
      return <RoleReveal game={game} room={room} />;
    case 'NIGHT':
      return <NightScreen game={game} room={room} />;
    case 'DAWN':
      return <DawnScreen game={game} room={room} />;
    case 'HUNTER_SHOT':
      return <HunterScreen game={game} room={room} />;
    case 'DISCUSSION':
      return <DiscussionScreen game={game} room={room} />;
    case 'VOTE':
    case 'REVOTE':
      return <VoteScreen game={game} room={room} />;
    case 'EXECUTION':
      return <ExecutionScreen game={game} room={room} />;
    case 'GAME_OVER':
      return <GameOverScreen game={game} room={room} />;
  }
}

export function GameScreen() {
  const game = useApp((s) => s.game);
  const room = useApp((s) => s.room);
  const desktop = useIsDesktop();
  const [sheet, setSheet] = useState<'notes' | 'history' | 'menu' | null>(null);
  useWakeLock();
  const load = useNotebook((s) => s.load);
  useEffect(() => {
    if (game) load(game.gameId);
  }, [game?.gameId, load]);

  if (!game || !room) return null;
  const head = headerOf(game);
  const HeadIcon = head.night ? Moon : Sun;
  const over = game.phase.id === 'GAME_OVER';
  const closeSheet = () => setSheet(null);

  const header = (
    <header className="flex items-center justify-between gap-3 py-3 safe-top">
      <div className="flex min-w-0 items-center gap-3">
        <HeadIcon className="h-7 w-7 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <h1 className="font-display truncate text-[26px] font-bold leading-[1.1]">
            {head.title}
          </h1>
          {head.sub ? <div className="truncate text-[13px] text-muted">{head.sub}</div> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!over ? (
          <TimerRing
            deadlineAt={game.phase.deadlineAt}
            startedAt={game.phase.startedAt}
            paused={game.phase.paused}
            size={desktop ? 54 : 58}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setSheet('menu')}
          aria-label="Menu"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface hover:border-accent/60"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );

  const pausedBanner = game.phase.paused ? (
    <div
      role="status"
      className="mb-3 rounded-[12px] bg-accent px-4 py-2 text-center text-sm font-bold text-onaccent"
    >
      {vi.conn.paused}
    </div>
  ) : null;

  if (desktop) {
    const RoleIcon = ROLE_ICON[game.me.role];
    return (
      <main data-phase={game.phase.id} className="mx-auto w-full max-w-[1440px] px-6 pb-8">
        {header}
        {pausedBanner}
        <div className="grid grid-cols-[272px_minmax(0,1fr)_330px] items-start gap-5">
          <aside className="flex flex-col gap-4">
            <section className="card p-4">
              <div className="flex items-center gap-3">
                <Avatar
                  index={room.members.find((m) => m.id === game.me.id)?.avatar ?? 0}
                  size={44}
                  dead={!game.me.alive}
                />
                <div className="min-w-0">
                  <div className="truncate font-bold">{game.me.name}</div>
                  <div
                    className={`flex items-center gap-1.5 text-sm font-semibold ${ROLE_TEAM[game.me.role] === 'WOLF' ? 'text-wolf' : 'text-village'}`}
                  >
                    <RoleIcon className="h-4 w-4" aria-hidden />
                    {game.phase.id === 'ROLE_REVEAL' ? '???' : vi.roles[game.me.role].name}
                  </div>
                </div>
              </div>
              <HoldToSee game={game} className="mt-3 w-full" />
            </section>
            <section className="card p-4">
              <h2 className="mb-2 text-[15px] font-bold">
                {vi.lobby.players(game.players.length).replace('/20', '')}
              </h2>
              <ul className="flex flex-col gap-1">
                {game.players.map((p) => {
                  const m = room.members.find((x) => x.id === p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-2.5 py-1 ${p.alive ? '' : 'opacity-55'}`}
                    >
                      <Avatar index={m?.avatar ?? 0} size={26} dead={!p.alive} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      {p.revealedRole && !p.alive ? (
                        <span
                          className={`text-xs font-semibold ${ROLE_TEAM[p.revealedRole] === 'WOLF' ? 'text-wolf' : 'text-village'}`}
                        >
                          {vi.roles[p.revealedRole].name}
                        </span>
                      ) : null}
                      {m && !m.connected && !m.isBot ? (
                        <span
                          className="h-2 w-2 rounded-full bg-wolf"
                          title={vi.lobby.disconnected}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="card p-4">
              <h2 className="mb-2 text-[15px] font-bold">Vai trong ván</h2>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_ORDER.filter((r) => game.roleList[r] > 0).map((r) => (
                  <span
                    key={r}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_TEAM[r] === 'WOLF' ? 'bg-wolf/15 text-wolf' : 'bg-village/15 text-village'}`}
                  >
                    {game.roleList[r]} {vi.roles[r].name}
                  </span>
                ))}
              </div>
            </section>
          </aside>

          <section className="min-w-0">
            <PhaseContent game={game} room={room} />
          </section>

          <aside className="flex max-h-[calc(100dvh-120px)] flex-col gap-4 overflow-y-auto scroll-thin lg:sticky lg:top-4">
            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
                <NotebookPen className="h-4 w-4 text-accent" aria-hidden />
                {vi.notebook.title}
              </h2>
              <Notebook game={game} />
            </section>
            <section className="card p-4">
              <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
                <History className="h-4 w-4 text-accent" aria-hidden />
                {vi.history.title}
              </h2>
              <HistoryPanel game={game} />
            </section>
          </aside>
        </div>
        <MenuSheet open={sheet === 'menu'} onClose={closeSheet} game={game} room={room} />
      </main>
    );
  }

  return (
    <main data-phase={game.phase.id} className="mx-auto w-full max-w-2xl px-4">
      {header}
      {pausedBanner}
      {game.phase.id !== 'ROLE_REVEAL' ? (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <HoldToSee game={game} short className="col-span-1 px-2 text-[13px]" />
          <button
            type="button"
            onClick={() => setSheet('notes')}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] border border-line bg-surface px-2 text-[13px] font-medium hover:border-accent/60"
          >
            <NotebookPen className="h-[18px] w-[18px]" aria-hidden />
            {vi.nightUi.notebook}
          </button>
          <button
            type="button"
            onClick={() => setSheet('history')}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] border border-line bg-surface px-2 text-[13px] font-medium hover:border-accent/60"
          >
            <History className="h-[18px] w-[18px]" aria-hidden />
            {vi.history.title}
          </button>
        </div>
      ) : null}
      <PhaseContent game={game} room={room} />
      <Sheet open={sheet === 'notes'} title={vi.notebook.title} onClose={closeSheet}>
        <Notebook game={game} />
      </Sheet>
      <Sheet open={sheet === 'history'} title={vi.history.title} onClose={closeSheet}>
        <HistoryPanel game={game} />
        <h3 className="mb-2 mt-5 text-sm font-bold">Vai trong ván</h3>
        <div className="flex flex-wrap gap-1.5">
          {ROLE_ORDER.filter((r) => game.roleList[r] > 0).map((r) => (
            <span
              key={r}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_TEAM[r] === 'WOLF' ? 'bg-wolf/15 text-wolf' : 'bg-village/15 text-village'}`}
            >
              {game.roleList[r]} {vi.roles[r].name}
            </span>
          ))}
        </div>
      </Sheet>
      <MenuSheet open={sheet === 'menu'} onClose={closeSheet} game={game} room={room} />
    </main>
  );
}
