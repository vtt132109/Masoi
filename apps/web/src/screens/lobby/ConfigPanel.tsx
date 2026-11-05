import { ExternalLink, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  MAX_PER_ROLE,
  ROLE_TEAM,
  suggestRoles,
  totalRoles,
  validateConfig,
  type ConfigProblem,
  type GameConfig,
  type RoomView,
  type Rules,
} from '@masoi/shared';
import { BalanceMeter } from '../../components/BalanceMeter';
import { Button } from '../../components/Button';
import { Section, Segmented, Stepper, Toggle } from '../../components/controls';
import { TIMER_PRESETS, detectPreset, type PresetId } from '../../features/presets';
import { vi } from '../../i18n/vi';
import { formatClock } from '../../lib/format';
import { ROLE_ICON, ROLE_ORDER, teamColorClass } from '../../lib/roles';
import { api } from '../../net/client';

const BOOL_RULES: (keyof typeof vi.rule)[] = [
  'nightTaskForVillagers',
  'revealRoleOnDeath',
  'allowSkipVote',
  'absoluteMajority',
  'liveVotes',
  'firstNightNoKill',
  'guardSelfProtect',
  'guardSameTargetTwice',
  'guardAndWitchSameTargetKills',
  'witchSelfHeal',
  'witchBothPotionsSameNight',
  'witchSeesVictimWithoutHeal',
  'hunterShootsWhenPoisoned',
  'seerCanRecheck',
];

export function problemText(p: ConfigProblem, playerCount: number, config: GameConfig): string {
  const P = vi.config.problems;
  switch (p.code) {
    case 'ROLE_SUM':
      return P.ROLE_SUM(totalRoles(config.roles), playerCount);
    case 'ROLE_LIMIT':
      return P.ROLE_LIMIT(p.role ? vi.roles[p.role].name : '');
    case 'PLAYER_COUNT':
      return P.PLAYER_COUNT;
    case 'NO_WOLF':
      return P.NO_WOLF;
    case 'WOLVES_TOO_MANY':
      return P.WOLVES_TOO_MANY;
    case 'TIMER_RANGE':
      return P.TIMER_RANGE;
  }
}

export function ConfigPanel({ room, readOnly }: { room: RoomView; readOnly: boolean }) {
  const c = room.config;
  const n = room.members.filter((m) => !m.left).length;
  const problems = validateConfig(c, n);
  const total = totalRoles(c.roles);
  const preset = detectPreset(c.timers);

  return (
    <div className="flex flex-col gap-4">
      {readOnly ? <p className="text-sm text-muted">{vi.lobby.hostOnlyEdit}</p> : null}

      <ModeSection room={room} readOnly={readOnly} />

      <Section
        title={vi.config.roles}
        right={
          readOnly ? null : (
            <Button
              size="sm"
              variant={room.autoRoles ? 'primary' : 'secondary'}
              icon={<Wand2 className="h-4 w-4" aria-hidden />}
              onClick={() =>
                api.updateConfig({ roles: suggestRoles(Math.max(5, Math.min(20, n))) }, true)
              }
            >
              {vi.config.suggest}
            </Button>
          )
        }
      >
        <ul className="flex flex-col gap-1">
          {ROLE_ORDER.map((r) => {
            const Icon = ROLE_ICON[r];
            const col = teamColorClass(ROLE_TEAM[r]);
            return (
              <li key={r} className="flex items-center gap-3 py-1.5">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${col.soft} ${col.text}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">
                    {vi.roles[r].name}
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {vi.teams[ROLE_TEAM[r]]}
                  </span>
                </span>
                {readOnly ? (
                  <span className="tabular text-lg font-bold">{c.roles[r]}</span>
                ) : (
                  <Stepper
                    label={vi.roles[r].name}
                    value={c.roles[r]}
                    min={0}
                    max={MAX_PER_ROLE[r] ?? 20}
                    onChange={(v) => api.updateConfig({ roles: { [r]: v } })}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-muted">
            {vi.config.autoRoles}: <b className="text-ink">{room.autoRoles ? 'Bật' : 'Tắt'}</b>
          </span>
          <span className={`tabular font-bold ${total === n ? 'text-village' : 'text-wolf'}`}>
            {total}/{n}
          </span>
        </div>
        <div className="mt-3">
          <BalanceMeter roles={c.roles} />
        </div>
        {problems.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-wolf" role="alert">
            {problems.map((p, i) => (
              <li key={i}>• {problemText(p, n, c)}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title={vi.config.timers}>
        <Segmented<PresetId | 'custom'>
          label={vi.config.timers}
          value={preset ?? 'custom'}
          disabled={readOnly}
          options={[
            { value: 'fast', label: vi.config.timerPreset.fast },
            { value: 'standard', label: vi.config.timerPreset.standard },
            { value: 'slow', label: vi.config.timerPreset.slow },
          ]}
          onChange={(v) => v !== 'custom' && api.updateConfig({ timers: TIMER_PRESETS[v] })}
        />
        <ul className="mt-3 flex flex-col gap-1">
          {(
            [
              ['discussion', 30, 600, 15],
              ['vote', 15, 120, 5],
              ['nightMain', 20, 90, 5],
              ['witch', 10, 60, 5],
            ] as const
          ).map(([key, min, max, step]) => (
            <li key={key} className="flex items-center justify-between gap-3 py-1">
              <span className="text-[15px]">{vi.config.timerLabels[key]}</span>
              {readOnly ? (
                <span className="tabular font-bold">{formatClock(c.timers[key] * 1000)}</span>
              ) : (
                <Stepper
                  label={vi.config.timerLabels[key]}
                  value={c.timers[key]}
                  min={min}
                  max={max}
                  step={step}
                  format={(v) => formatClock(v * 1000)}
                  onChange={(v) => api.updateConfig({ timers: { [key]: v } })}
                />
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={vi.config.rules}>
        <div className="flex flex-col gap-3">
          <div>
            <div className="mb-1.5 text-sm font-semibold">{vi.discussionMode.label}</div>
            <Segmented
              label={vi.discussionMode.label}
              value={c.rules.discussionMode}
              disabled={readOnly}
              options={(['FREE', 'TURNS'] as const).map((v) => ({
                value: v,
                label: vi.discussionMode.options[v],
              }))}
              onChange={(v) => api.updateConfig({ rules: { discussionMode: v } })}
            />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-semibold">{vi.tieBreak.label}</div>
            <Segmented
              label={vi.tieBreak.label}
              value={c.rules.tieBreak}
              disabled={readOnly}
              options={(['NO_LYNCH', 'REVOTE', 'RANDOM'] as const).map((v) => ({
                value: v,
                label: vi.tieBreak.options[v],
              }))}
              onChange={(v) => api.updateConfig({ rules: { tieBreak: v } })}
            />
          </div>
          <details className="group rounded-[12px] border border-line bg-bg2 px-3">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] font-semibold">
              Luật nâng cao
              <span className="text-xs text-muted group-open:hidden">Mở</span>
            </summary>
            <div className="divide-y divide-line pb-2">
              {BOOL_RULES.map((key) => (
                <Toggle
                  key={key}
                  label={vi.rule[key].label}
                  hint={vi.rule[key].hint || undefined}
                  checked={c.rules[key as keyof Rules] as boolean}
                  disabled={readOnly}
                  onChange={(v) => api.updateConfig({ rules: { [key]: v } })}
                />
              ))}
            </div>
          </details>
        </div>
      </Section>
    </div>
  );
}

function ModeSection({ room, readOnly }: { room: RoomView; readOnly: boolean }) {
  const c = room.config;
  const [url, setUrl] = useState(c.voiceCallUrl ?? '');
  const [urlError, setUrlError] = useState(false);
  useEffect(() => setUrl(c.voiceCallUrl ?? ''), [c.voiceCallUrl]);

  const commitUrl = () => {
    const v = url.trim();
    if (v === (c.voiceCallUrl ?? '')) return setUrlError(false);
    if (v === '') {
      setUrlError(false);
      return void api.updateConfig({ voiceCallUrl: null });
    }
    if (!/^https:\/\/\S+$/i.test(v) || v.length > 300) return setUrlError(true);
    setUrlError(false);
    void api.updateConfig({ voiceCallUrl: v });
  };

  const speakers = room.members.filter((m) => m.connected && !m.isBot && !m.left);

  return (
    <Section title={vi.config.mode}>
      <Segmented
        label={vi.config.mode}
        value={c.playMode}
        disabled={readOnly}
        options={[
          { value: 'IN_PERSON', label: vi.config.modes.IN_PERSON },
          { value: 'REMOTE', label: vi.config.modes.REMOTE },
        ]}
        onChange={(v) => api.updateConfig({ playMode: v })}
      />
      <p className="mt-2 text-[13px] text-muted">{vi.lobby.modeIntro[c.playMode]}</p>

      {c.playMode === 'REMOTE' ? (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-semibold" htmlFor="voice-url">
            {vi.config.voiceLink}
          </label>
          {readOnly ? (
            c.voiceCallUrl ? (
              <a
                href={c.voiceCallUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 break-all text-sm font-semibold text-accent underline"
              >
                <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                {new URL(c.voiceCallUrl).host}
              </a>
            ) : (
              <span className="text-sm text-muted">—</span>
            )
          ) : (
            <>
              <input
                id="voice-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={commitUrl}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder="https://meet.google.com/…"
                inputMode="url"
                autoComplete="off"
                aria-invalid={urlError}
                className={`h-12 w-full rounded-[12px] border bg-bg2 px-3 text-[15px] placeholder:text-muted focus:border-accent ${urlError ? 'border-wolf' : 'border-line'}`}
              />
              <p className={`mt-1 text-xs ${urlError ? 'text-wolf' : 'text-muted'}`}>
                {urlError ? vi.config.voiceInvalid : vi.config.voiceHelp}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-semibold" htmlFor="speaker">
            {vi.config.speaker}
          </label>
          <select
            id="speaker"
            disabled={readOnly}
            value={c.speakerDeviceId ?? ''}
            onChange={(e) => api.updateConfig({ speakerDeviceId: e.target.value || null })}
            className="h-12 w-full rounded-[12px] border border-line bg-bg2 px-3 text-[15px] focus:border-accent disabled:opacity-60"
          >
            <option value="">{vi.config.speakerHost}</option>
            {speakers
              .filter((m) => m.id !== room.hostId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nickname}
                </option>
              ))}
          </select>
        </div>
      )}
    </Section>
  );
}
