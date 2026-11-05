import { Navigate } from 'react-router-dom';
import { vi } from '../i18n/vi';
import { useApp } from '../store';
import { GameScreen } from './game/GameScreen';
import { Lobby } from './lobby/Lobby';

export function RoomScreen() {
  const session = useApp((s) => s.session);
  const room = useApp((s) => s.room);
  const game = useApp((s) => s.game);
  const booted = useApp((s) => s.booted);

  if (!session) return booted ? <Navigate to="/" replace /> : <Loading />;
  if (!room) return <Loading />;
  if (room.status === 'IN_GAME') return game ? <GameScreen /> : <Loading />;
  return <Lobby />;
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted">{vi.common.loading}</div>
  );
}
