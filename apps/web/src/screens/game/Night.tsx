import { Moon, Skull } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { GameAction, PlayerView, RoomView } from '@masoi/shared';
import { Button } from '../../components/Button';
import type { PickItem, Tone } from '../../components/PlayerPicker';
import { useKeyboardPick } from '../../hooks/useKeyboardPick';
import { vi } from '../../i18n/vi';
import { api } from '../../net/client';
import { BarNote, Stage } from './Stage';
import { nameOf, useBaseItems } from './items';

interface Cfg {
  title: string;
  hint?: ReactNode;
  icon?: ReactNode;
  extra?: ReactNode;
  items: PickItem[];
  onPick?: (id: string) => void;
  footer?: ReactNode;
  tone?: 'accent' | 'wolf';
  ids: string[];
  onEnter?: () => void;
  onEsc?: () => void;
}

const moon = <Moon className="h-9 w-9 text-accent" strokeWidth={1.5} aria-hidden />;

export function NightScreen({ game, room }: { game: PlayerView; room: RoomView }) {
  const a = game.myAction;
  const base = useBaseItems(game, room);
  const n = game.phase.dayNumber;
  const [sel, setSel] = useState<string | null>(null);
  const [poison, setPoison] = useState<string | null>(null);
  const [heal, setHeal] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sang bước mới của đêm (MAIN → Phù thủy) thì xóa lựa chọn cục bộ.
  useEffect(() => {
    setSel(null);
    setPoison(null);
    setHeal(false);
  }, [game.phase.seq]);

  const send = async (action: GameAction) => {
    setBusy(true);
    await api.action(action);
    setBusy(false);
  };
  const toggle = (id: string) => setSel((cur) => (cur === id ? null : id));
  const sleep = (title: string, hint: string, icon: ReactNode = moon): Cfg => ({
    title,
    hint,
    icon,
    items: base,
    ids: [],
  });

  let cfg: Cfg;

  if (!game.me.alive) {
    cfg = sleep(
      vi.common.dead,
      vi.nightUi.deadNight,
      <Skull className="h-9 w-9 text-muted" strokeWidth={1.5} aria-hidden />,
    );
  } else if (a.kind === 'NONE' || a.kind === 'NIGHT_WAIT') {
    cfg = sleep(
      vi.nightUi.asleep,
      a.kind === 'NIGHT_WAIT' ? vi.nightUi.waitWitch : vi.nightUi.sleepHint,
    );
  } else if (a.kind === 'WOLF_VOTE') {
    const votes = game.privateInfo.wolfVotes ?? {};
    const items = base.map((it) => ({
      ...it,
      selectable: !a.locked && a.targets.includes(it.id),
      selected: a.current === it.id,
      marks: Object.entries(votes)
        .filter(([, t]) => t === it.id)
        .map(([w]) => ({ text: nameOf(game, w).charAt(0).toUpperCase(), tone: 'wolf' as Tone })),
    }));
    const summary = Object.entries(votes)
      .map(([w, t]) => `${nameOf(game, w)} → ${t ? nameOf(game, t) : '…'}`)
      .join(' · ');
    cfg = {
      title: vi.nightUi.wolf.title,
      hint: summary || vi.nightUi.wolf.hint,
      icon: moon,
      items,
      tone: 'wolf',
      ids: a.targets,
      onPick: (id) => void send({ type: 'WOLF_VOTE', target: a.current === id ? null : id }),
      onEnter: () => !a.locked && void send({ type: 'WOLF_LOCK' }),
      onEsc: () => a.current && void send({ type: 'WOLF_VOTE', target: null }),
      footer: a.locked ? (
        <BarNote>{vi.nightUi.wolf.locked}</BarNote>
      ) : (
        <div className="flex gap-2">
          <Button
            size="lg"
            disabled={!a.current || busy}
            onClick={() => send({ type: 'WOLF_VOTE', target: null })}
          >
            {vi.common.cancel}
          </Button>
          <Button
            variant="danger"
            size="lg"
            block
            loading={busy}
            onClick={() => send({ type: 'WOLF_LOCK' })}
          >
            {a.current
              ? `${vi.nightUi.wolf.lock}: ${nameOf(game, a.current)}`
              : vi.nightUi.wolf.lock}
          </Button>
        </div>
      ),
    };
  } else if (a.kind === 'SEER_CHECK') {
    const mine = game.privateInfo.seerChecks?.find((c) => c.night === n);
    const items = base.map((it) => ({
      ...it,
      selectable: !a.done && a.targets.includes(it.id),
      selected: a.done ? mine?.target === it.id : sel === it.id,
    }));
    cfg = {
      title: vi.nightUi.seer.title,
      icon: moon,
      items,
      ids: a.targets,
      onPick: toggle,
      onEnter: () => sel && void send({ type: 'SEER_CHECK', target: sel }),
      onEsc: () => setSel(null),
      footer: a.done ? (
        mine ? (
          <div
            className="anim-pop rounded-card px-4 py-3 text-center text-[16px] font-bold"
            style={{
              background:
                mine.result === 'WOLF'
                  ? 'color-mix(in srgb, var(--team-wolf) 18%, transparent)'
                  : 'color-mix(in srgb, var(--team-village) 18%, transparent)',
              color: mine.result === 'WOLF' ? 'var(--team-wolf)' : 'var(--team-village)',
            }}
            role="status"
          >
            {nameOf(game, mine.target)}{' '}
            {mine.result === 'WOLF' ? vi.nightUi.seer.isWolf : vi.nightUi.seer.notWolf}
          </div>
        ) : (
          <BarNote>{vi.nightUi.done}</BarNote>
        )
      ) : (
        <div className="flex gap-2">
          <Button
            size="lg"
            disabled={busy}
            onClick={() => send({ type: 'SEER_CHECK', target: null })}
          >
            {vi.common.skip}
          </Button>
          <Button
            variant="primary"
            size="lg"
            block
            disabled={!sel}
            loading={busy}
            onClick={() => sel && send({ type: 'SEER_CHECK', target: sel })}
          >
            {sel ? `${vi.nightUi.seer.confirm}: ${nameOf(game, sel)}` : vi.nightUi.seer.confirm}
          </Button>
        </div>
      ),
    };
  } else if (a.kind === 'GUARD_PROTECT') {
    const last = game.privateInfo.guardLast ?? null;
    const items = base.map((it) => ({
      ...it,
      selectable: !a.done && a.targets.includes(it.id),
      selected: sel === it.id,
      sub: last === it.id && !a.targets.includes(it.id) ? vi.nightUi.guard.last : it.sub,
    }));
    cfg = {
      title: vi.nightUi.guard.title,
      icon: moon,
      items,
      ids: a.targets,
      onPick: toggle,
      onEnter: () => sel && void send({ type: 'GUARD_PROTECT', target: sel }),
      onEsc: () => setSel(null),
      footer: a.done ? (
        <BarNote>{vi.nightUi.done}</BarNote>
      ) : (
        <div className="flex gap-2">
          <Button
            size="lg"
            disabled={busy}
            onClick={() => send({ type: 'GUARD_PROTECT', target: null })}
          >
            {vi.common.skip}
          </Button>
          <Button
            variant="primary"
            size="lg"
            block
            disabled={!sel}
            loading={busy}
            onClick={() => sel && send({ type: 'GUARD_PROTECT', target: sel })}
          >
            {sel ? `${vi.nightUi.guard.confirm}: ${nameOf(game, sel)}` : vi.nightUi.guard.confirm}
          </Button>
        </div>
      ),
    };
  } else if (a.kind === 'NIGHT_DUMMY') {
    cfg = {
      title: vi.nightUi.dummy.title,
      hint: vi.nightUi.dummy.hint,
      icon: moon,
      items: base.map((it) => ({
        ...it,
        selectable: !a.done && a.targets.includes(it.id),
        selected: sel === it.id,
      })),
      ids: a.targets,
      onPick: toggle,
      onEnter: () => void send({ type: 'NIGHT_DUMMY', suspect: sel }),
      onEsc: () => setSel(null),
      footer: a.done ? (
        <BarNote>{vi.nightUi.done}</BarNote>
      ) : (
        <div className="flex gap-2">
          <Button
            size="lg"
            disabled={busy}
            onClick={() => send({ type: 'NIGHT_DUMMY', suspect: null })}
          >
            {vi.common.skip}
          </Button>
          <Button
            variant="primary"
            size="lg"
            block
            loading={busy}
            onClick={() => send({ type: 'NIGHT_DUMMY', suspect: sel })}
          >
            {sel ? `${vi.common.confirm}: ${nameOf(game, sel)}` : vi.common.confirm}
          </Button>
        </div>
      ),
    };
  } else if (a.kind === 'WITCH_ACT') {
    const W = vi.nightUi.witch;
    const potions = game.privateInfo.witchPotions;
    const items = base.map((it) => ({
      ...it,
      selectable: !a.done && a.poisonTargets.includes(it.id),
      selected: poison === it.id,
      sub: poison === it.id ? 'Đầu độc' : a.victim === it.id ? 'Bị cắn' : it.sub,
      subTone: (poison === it.id || a.victim === it.id ? 'wolf' : it.subTone) as Tone | undefined,
    }));
    const victim = a.victim ? nameOf(game, a.victim) : null;
    const hint = victim
      ? W.victim(victim)
      : potions?.heal || !potions
        ? W.noVictim
        : W.victimHidden;
    cfg = {
      title: W.title,
      hint,
      icon: moon,
      items,
      tone: 'wolf',
      ids: a.poisonTargets,
      onPick: (id) => setPoison((cur) => (cur === id ? null : id)),
      onEsc: () => setPoison(null),
      onEnter: () => void send({ type: 'WITCH_ACT', heal, poison }),
      extra: a.done ? null : (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {a.canHeal ? (
            <Button
              size="sm"
              variant={heal ? 'primary' : 'secondary'}
              aria-pressed={heal}
              onClick={() => setHeal((v) => !v)}
            >
              {heal ? W.healed : W.heal}
              {victim ? `: ${victim}` : ''}
            </Button>
          ) : null}
          {a.canPoison ? (
            <span className="rounded-full bg-wolf/15 px-3 py-1 text-xs font-semibold text-wolf">
              {W.poisonTitle}
            </span>
          ) : null}
        </div>
      ),
      footer: a.done ? (
        <BarNote>{vi.nightUi.done}</BarNote>
      ) : (
        <div className="flex flex-col gap-2">
          <BarNote>{W.summary(heal, poison ? nameOf(game, poison) : null)}</BarNote>
          <div className="flex gap-2">
            <Button
              size="lg"
              disabled={busy}
              onClick={() => send({ type: 'WITCH_ACT', heal: false, poison: null })}
            >
              {W.nothing}
            </Button>
            <Button
              variant="primary"
              size="lg"
              block
              loading={busy}
              onClick={() => send({ type: 'WITCH_ACT', heal, poison })}
            >
              {W.confirm}
            </Button>
          </div>
        </div>
      ),
    };
  } else {
    cfg = sleep(vi.nightUi.asleep, vi.nightUi.sleepHint);
  }

  useKeyboardPick({
    enabled: cfg.ids.length > 0,
    ids: cfg.ids,
    onSelect: (id) => cfg.onPick?.(id),
    onConfirm: cfg.onEnter,
    onClear: cfg.onEsc,
  });

  return (
    <Stage
      title={cfg.title}
      hint={cfg.hint}
      icon={cfg.icon}
      extra={cfg.extra}
      items={cfg.items}
      onPick={cfg.onPick}
      selectTone={cfg.tone}
      footer={cfg.footer}
      hotkeys
      label="Chọn người chơi"
    />
  );
}
