import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { playCue, unlockAudio, vibrate } from './audio/sound';
import { ConnectionBanner } from './components/ConnectionBanner';
import { Scenery } from './components/Scenery';
import { Toasts } from './components/Toasts';
import { Home } from './screens/Home';
import { RoomScreen } from './screens/RoomScreen';
import { Rules } from './screens/Rules';
import { useApp } from './store';

/** Màu giao diện theo pha: đêm/ngày. Màn kết thúc theo phe thắng. */
function useTheme(): 'night' | 'day' {
  const game = useApp((s) => s.game);
  const status = useApp((s) => s.room?.status);
  if (!game || status !== 'IN_GAME') return 'night';
  switch (game.phase.id) {
    case 'ROLE_REVEAL':
    case 'NIGHT':
      return 'night';
    case 'GAME_OVER':
      return game.gameOver?.win.winner === 'WOLF' ? 'night' : 'day';
    default:
      return 'day';
  }
}

function ThemeController() {
  const theme = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'night' ? '#0B1020' : '#F6EFE3');
  }, [theme]);
  return null;
}

/** Âm thanh / rung theo tín hiệu của server. Cùng phòng: chỉ "loa chung" phát tiếng. */
function CueEffects() {
  const cue = useApp((s) => s.cue);
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => {
    if (!cue) return;
    const { soundOn, room, session } = useApp.getState();
    const everyDevice = room?.config.playMode === 'REMOTE';
    const isSpeaker = !!session && room?.speakerId === session.playerId;
    if (soundOn && (everyDevice || isSpeaker)) playCue(cue.kind);
    else vibrate(cue.kind === 'HUNTER' ? 60 : 25);
  }, [cue]);
  return null;
}

export function App() {
  return (
    <>
      <Scenery />
      <ThemeController />
      <CueEffects />
      <ConnectionBanner />
      <Toasts />
      <div className="relative z-10 min-h-dvh">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:code" element={<Home />} />
          <Route path="/room" element={<RoomScreen />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
