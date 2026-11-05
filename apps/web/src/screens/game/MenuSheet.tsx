import {
  BookOpen,
  FastForward,
  LogOut,
  Pause,
  Play,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PlayerView, RoomView } from '@masoi/shared';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { vi } from '../../i18n/vi';
import { useServerNow } from '../../hooks/useNow';
import { api } from '../../net/client';
import { useApp } from '../../store';

const REMOVE_AFTER_MS = 30_000;

export function MenuSheet({
  open,
  onClose,
  game,
  room,
}: {
  open: boolean;
  onClose: () => void;
  game: PlayerView;
  room: RoomView;
}) {
  const navigate = useNavigate();
  const soundOn = useApp((s) => s.soundOn);
  const setSoundOn = useApp((s) => s.setSoundOn);
  const now = useServerNow(1000);
  const isHost = room.hostId === game.me.id;
  const over = game.phase.id === 'GAME_OVER';
  const paused = game.phase.paused;

  const offline = room.members.filter(
    (m) => !m.connected && !m.isBot && !m.left && m.id !== game.me.id,
  );

  const leave = async () => {
    if (!window.confirm('Rời phòng giữa ván? Bạn sẽ bị loại khỏi ván này.')) return;
    await api.leave();
    navigate('/');
  };

  return (
    <Sheet open={open} title={isHost ? vi.host.title : 'Menu'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setSoundOn(!soundOn)}
            icon={
              soundOn ? (
                <Volume2 className="h-4 w-4" aria-hidden />
              ) : (
                <VolumeX className="h-4 w-4" aria-hidden />
              )
            }
          >
            {soundOn ? vi.audio.off : vi.audio.on}
          </Button>
          <a
            href="/rules"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-line bg-raised px-4 text-[15px] font-semibold hover:border-accent/60"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            {vi.home.rules}
          </a>
        </div>

        {isHost && !over ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">{vi.host.title}</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paused ? 'primary' : 'secondary'}
                onClick={() => api.host({ kind: paused ? 'RESUME' : 'PAUSE' })}
                icon={
                  paused ? (
                    <Play className="h-4 w-4" aria-hidden />
                  ) : (
                    <Pause className="h-4 w-4" aria-hidden />
                  )
                }
              >
                {paused ? vi.host.resume : vi.host.pause}
              </Button>
              <Button
                onClick={() => api.host({ kind: 'EXTEND', seconds: 30 })}
                icon={<Plus className="h-4 w-4" aria-hidden />}
              >
                {vi.host.extend}
              </Button>
              <Button
                className="col-span-2"
                disabled={paused}
                onClick={() => api.host({ kind: 'SKIP' })}
                icon={<FastForward className="h-4 w-4" aria-hidden />}
              >
                {vi.host.skip}
              </Button>
            </div>

            <h3 className="mt-2 text-sm font-bold">{vi.host.disconnectedPlayers}</h3>
            {offline.length === 0 ? (
              <p className="text-sm text-muted">{vi.host.none}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {offline.map((m) => {
                  const waited = m.disconnectedAt ? now - m.disconnectedAt : 0;
                  const left = Math.max(0, Math.ceil((REMOVE_AFTER_MS - waited) / 1000));
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-[12px] border border-line bg-bg2 p-2.5"
                    >
                      <WifiOff className="h-4 w-4 shrink-0 text-wolf" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold">{m.nickname}</span>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={left > 0}
                        icon={<Trash2 className="h-4 w-4" aria-hidden />}
                        onClick={() => api.host({ kind: 'REMOVE_PLAYER', playerId: m.id })}
                      >
                        {left > 0 ? vi.host.removeWait(left) : vi.host.remove}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        <Button variant="ghost" onClick={leave} icon={<LogOut className="h-4 w-4" aria-hidden />}>
          {vi.host.leave}
        </Button>
      </div>
    </Sheet>
  );
}
