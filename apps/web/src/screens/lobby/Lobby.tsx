import {
  Crown,
  ExternalLink,
  LogOut,
  Share2,
  Trash2,
  UserX,
  Volume2,
  VolumeX,
  WifiOff,
  Check,
  Bot,
  BookOpen,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateConfig, type MemberView } from '@masoi/shared';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { RoomCode } from '../../components/RoomCode';
import { Sheet } from '../../components/Sheet';
import { vi } from '../../i18n/vi';
import { useIsDesktop } from '../../hooks/useBreakpoint';
import { api } from '../../net/client';
import { useApp } from '../../store';
import { ConfigPanel } from './ConfigPanel';

export function Lobby() {
  const room = useApp((s) => s.room);
  const session = useApp((s) => s.session);
  const soundOn = useApp((s) => s.soundOn);
  const setSoundOn = useApp((s) => s.setSoundOn);
  const desktop = useIsDesktop();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'players' | 'config'>('players');
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!room || !session) return null;
  const me = room.members.find((m) => m.id === session.playerId);
  if (!me) return null;
  const isHost = room.hostId === me.id;
  const active = room.members.filter((m) => !m.left);
  const problems = validateConfig(room.config, active.length);
  const allReady = active.every((m) => m.id === room.hostId || m.ready || m.isBot);

  let reason: string | null = null;
  if (active.length < 5) reason = vi.lobby.cantStart.notEnough;
  else if (!allReady) reason = vi.lobby.cantStart.notReady;
  else if (problems.length > 0) reason = vi.lobby.cantStart.invalid;

  const leave = async () => {
    await api.leave();
    navigate('/');
  };

  const start = async () => {
    setBusy(true);
    await api.start();
    setBusy(false);
  };

  const actionBar = (
    <div className="flex flex-col gap-2">
      <p className="text-center text-[13px] text-muted">{vi.lobby.preGame[room.config.playMode]}</p>
      {isHost ? (
        <>
          <div className="flex gap-2">
            {room.allowBots ? (
              <Button
                variant="secondary"
                size="lg"
                icon={<Bot className="h-5 w-5" aria-hidden />}
                onClick={() => api.addBot()}
                disabled={active.length >= 20}
                aria-label={vi.lobby.addBot}
                title={vi.lobby.addBot}
              >
                <span className="hidden sm:inline">{vi.lobby.addBot}</span>
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              block
              disabled={!!reason}
              loading={busy}
              onClick={start}
            >
              {vi.lobby.start}
            </Button>
          </div>
          {reason ? <p className="text-center text-xs text-muted">{reason}</p> : null}
        </>
      ) : (
        <>
          <Button
            variant={me.ready ? 'secondary' : 'primary'}
            size="lg"
            block
            onClick={() => api.setReady(!me.ready)}
            icon={me.ready ? undefined : <Check className="h-5 w-5" aria-hidden />}
          >
            {me.ready ? vi.lobby.notReady : vi.lobby.ready}
          </Button>
          <p className="text-center text-xs text-muted">{vi.lobby.waitingHost}</p>
        </>
      )}
    </div>
  );

  const playersList = (
    <section className="card p-4" aria-label={vi.lobby.players(active.length)}>
      <h2 className="mb-2 text-[15px] font-bold">{vi.lobby.players(active.length)}</h2>
      <ul className="scroll-thin flex flex-col lg:max-h-[30vh] lg:overflow-y-auto">
        {active.map((m) => (
          <MemberRow key={m.id} m={m} meId={me.id} isHost={isHost} />
        ))}
      </ul>
    </section>
  );

  const modeBadge = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="rounded-full border border-line bg-raised px-3 py-1 text-xs font-semibold">
        {room.config.playMode === 'IN_PERSON' ? '🏠 ' : '🌐 '}
        {vi.config.modes[room.config.playMode]}
      </span>
      {room.config.playMode === 'REMOTE' && room.config.voiceCallUrl ? (
        <a
          href={room.config.voiceCallUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-bold text-onaccent"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          {vi.config.openCall}
        </a>
      ) : null}
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-44 safe-top lg:pb-10">
      <header className="flex items-center justify-between gap-2 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={leave}
          icon={<LogOut className="h-4 w-4" aria-hidden />}
        >
          {vi.lobby.leave}
        </Button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            aria-label={soundOn ? vi.audio.off : vi.audio.on}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface hover:border-accent/60"
          >
            {soundOn ? (
              <Volume2 className="h-5 w-5" aria-hidden />
            ) : (
              <VolumeX className="h-5 w-5" aria-hidden />
            )}
          </button>
          <Link
            to="/rules"
            aria-label={vi.home.rules}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface hover:border-accent/60"
          >
            <BookOpen className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>

      {desktop ? (
        <div className="grid grid-cols-[390px_1fr] items-start gap-6">
          <div className="flex flex-col gap-4">
            <section className="card p-5">
              <RoomCode code={room.code} showQr />
              <div className="mt-4">{modeBadge}</div>
            </section>
            {playersList}
            <div className="card p-4">{actionBar}</div>
          </div>
          <div>
            <h1 className="font-display mb-3 text-3xl font-bold">{vi.lobby.config}</h1>
            <ConfigPanel room={room} readOnly={!isHost} />
          </div>
        </div>
      ) : (
        <>
          <section className="card mb-4 flex flex-col items-center gap-3 p-4">
            <div className="flex w-full items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted">
                  {vi.lobby.code}
                </div>
                <div className="font-display text-[40px] font-bold leading-none tracking-[0.2em]">
                  {room.code}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShareOpen(true)}
                icon={<Share2 className="h-4 w-4" aria-hidden />}
              >
                {vi.lobby.share}
              </Button>
            </div>
            {modeBadge}
          </section>

          <div
            role="tablist"
            className="mb-4 grid grid-cols-2 gap-1 rounded-[14px] border border-line bg-surface p-1"
          >
            {(['players', 'config'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-11 rounded-[10px] text-sm font-bold transition ${tab === t ? 'bg-accent text-onaccent' : 'text-muted'}`}
              >
                {t === 'players' ? vi.lobby.players(active.length) : vi.lobby.config}
              </button>
            ))}
          </div>

          {tab === 'players' ? playersList : <ConfigPanel room={room} readOnly={!isHost} />}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 safe-bottom">
            {actionBar}
          </div>

          <Sheet open={shareOpen} title={vi.lobby.share} onClose={() => setShareOpen(false)}>
            <RoomCode code={room.code} showQr />
          </Sheet>
        </>
      )}
    </main>
  );
}

function MemberRow({ m, meId, isHost }: { m: MemberView; meId: string; isHost: boolean }) {
  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-raised hover:text-ink';
  return (
    <li className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
      <Avatar index={m.avatar} size={42} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{m.nickname}</span>
          {m.isHost ? (
            <Crown className="h-4 w-4 shrink-0 text-accent" aria-label={vi.common.host} />
          ) : null}
          {m.id === meId ? (
            <span className="rounded-full bg-raised px-2 text-[11px] font-bold text-accent">
              {vi.common.you}
            </span>
          ) : null}
          {m.isBot ? (
            <span className="rounded-full bg-raised px-2 text-[11px] font-bold text-muted">
              {vi.common.bot}
            </span>
          ) : null}
        </div>
        <div className="text-xs">
          {!m.connected && !m.isBot ? (
            <span className="inline-flex items-center gap-1 font-semibold text-wolf">
              <WifiOff className="h-3 w-3" aria-hidden />
              {vi.lobby.disconnected}
            </span>
          ) : m.isHost || m.ready || m.isBot ? (
            <span className="font-semibold text-village">
              {m.isHost ? vi.common.host : vi.lobby.readyLabel}
            </span>
          ) : (
            <span className="text-muted">{vi.lobby.notReadyLabel}</span>
          )}
        </div>
      </div>
      {isHost && m.id !== meId ? (
        <div className="flex">
          {!m.isBot ? (
            <button
              type="button"
              className={iconBtn}
              onClick={() => api.transferHost(m.id)}
              aria-label={`${vi.lobby.makeHost}: ${m.nickname}`}
              title={vi.lobby.makeHost}
            >
              <Crown className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className={iconBtn}
            onClick={() => (m.isBot ? api.removeBot(m.id) : api.kick(m.id))}
            aria-label={`${m.isBot ? vi.lobby.removeBot : vi.lobby.kick}: ${m.nickname}`}
            title={m.isBot ? vi.lobby.removeBot : vi.lobby.kick}
          >
            {m.isBot ? (
              <Trash2 className="h-4 w-4" aria-hidden />
            ) : (
              <UserX className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      ) : null}
    </li>
  );
}
