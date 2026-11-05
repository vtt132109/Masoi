import { Crosshair } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PlayerView, RoomView } from '@masoi/shared';
import { Button } from '../../components/Button';
import { useKeyboardPick } from '../../hooks/useKeyboardPick';
import { vi } from '../../i18n/vi';
import { api } from '../../net/client';
import { BarNote, Stage } from './Stage';
import { nameOf, useBaseItems } from './items';

export function HunterScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const a = game.myAction;
  const base = useBaseItems(game, room);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSel(null), [game.phase.seq]);

  const shoot = async (target: string | null) => {
    setBusy(true);
    await api.action({ type: 'HUNTER_SHOOT', target });
    setBusy(false);
  };
  const targets = a.kind === 'HUNTER_SHOOT' ? a.targets : [];
  useKeyboardPick({
    enabled: targets.length > 0,
    ids: targets,
    onSelect: (id) => setSel((c) => (c === id ? null : id)),
    onConfirm: () => sel && void shoot(sel),
    onClear: () => setSel(null),
  });

  const icon = <Crosshair className="h-9 w-9 text-wolf" strokeWidth={1.5} aria-hidden />;

  if (a.kind === 'HUNTER_SHOOT') {
    return (
      <Stage
        title={vi.hunter.title}
        hint={vi.hunter.you}
        icon={icon}
        items={base.map((it) => ({
          ...it,
          selectable: a.targets.includes(it.id),
          selected: sel === it.id,
        }))}
        onPick={(id) => setSel((c) => (c === id ? null : id))}
        selectTone="wolf"
        hotkeys
        label="Chọn người để bắn"
        footer={
          <div className="flex gap-2">
            <Button size="lg" disabled={busy} onClick={() => shoot(null)}>
              {vi.hunter.noShoot}
            </Button>
            <Button
              variant="danger"
              size="lg"
              block
              disabled={!sel}
              loading={busy}
              onClick={() => sel && shoot(sel)}
            >
              {sel ? `${vi.hunter.shoot}: ${nameOf(game, sel)}` : vi.hunter.shoot}
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <Stage
      title={vi.hunter.title}
      hint={vi.hunter.waiting(nameOf(game, game.publicInfo.hunterShooter))}
      icon={icon}
      items={base}
      label="Người chơi"
      footer={game.me.alive ? undefined : <BarNote>{vi.discussion.deadSpectator}</BarNote>}
    />
  );
}
