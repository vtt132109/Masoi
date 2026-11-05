import { BookOpen, Moon, Plus, Smartphone, Globe, Sparkles, LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { vi } from '../i18n/vi';
import { AVATAR_COUNT } from '../lib/avatars';
import { api } from '../net/client';
import { useApp } from '../store';

const MODE_ICONS = [Smartphone, Globe, Sparkles];

export function Home() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const session = useApp((s) => s.session);
  const room = useApp((s) => s.room);
  const booted = useApp((s) => s.booted);
  const endedReason = useApp((s) => s.endedReason);
  const profile = useApp((s) => s.profile);
  const setProfile = useApp((s) => s.setProfile);
  const conn = useApp((s) => s.conn);

  const [code, setCode] = useState(
    (urlCode ?? '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5),
  );
  const [mode, setMode] = useState<'create' | 'join'>(urlCode ? 'join' : 'create');
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (urlCode) {
      setCode(
        urlCode
          .toUpperCase()
          .replace(/[^A-Z]/g, '')
          .slice(0, 5),
      );
      setMode('join');
    }
  }, [urlCode]);

  if (session && room) return <Navigate to="/room" replace />;

  const name = profile.nickname.trim().replace(/\s+/g, ' ');
  const nameOk = name.length >= 2 && name.length <= 16;
  const codeOk = code.length === 5;
  const canSubmit = nameOk && (mode === 'create' || codeOk) && conn === 'connected';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    const ok =
      mode === 'create'
        ? await api.create(name, profile.avatar)
        : await api.join(code, name, profile.avatar);
    setBusy(false);
    if (ok) navigate('/room');
  };

  const endedMsg =
    endedReason === 'KICKED'
      ? vi.conn.kicked
      : endedReason === 'REMOVED'
        ? vi.conn.removed
        : endedReason === 'ROOM_GONE'
          ? vi.conn.roomGone
          : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 pb-10 safe-top lg:justify-center lg:px-10">
      <header className="flex items-center justify-between py-3">
        <div className="flex items-center gap-2 font-display text-xl font-bold text-accent">
          <Moon className="h-6 w-6" aria-hidden />
          {vi.app.name}
        </div>
        <Link
          to="/rules"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-accent/60"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          {vi.home.rules}
        </Link>
      </header>

      <div className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <section className="text-center lg:text-left">
          <h1 className="font-display text-[44px] font-bold leading-[1.05] sm:text-6xl lg:text-7xl">
            {vi.home.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[17px] text-muted lg:mx-0">{vi.app.tagline}</p>
          <ul className="mt-8 hidden gap-4 lg:grid">
            {vi.home.howItWorks.map((h, i) => {
              const Icon = MODE_ICONS[i] ?? Sparkles;
              return (
                <li key={h.t} className="card flex items-start gap-4 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block font-bold">{h.t}</span>
                    <span className="block text-sm text-muted">{h.d}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card mx-auto w-full max-w-md p-5 sm:p-6" aria-label="Vào chơi">
          {endedMsg ? (
            <p
              role="status"
              className="mb-4 rounded-[12px] bg-wolf/15 px-3 py-2 text-sm font-medium text-wolf"
            >
              {endedMsg}
            </p>
          ) : null}
          {!booted ? <p className="mb-2 text-sm text-muted">{vi.common.loading}</p> : null}

          <form onSubmit={submit} className="flex flex-col gap-4">
            <div
              className="grid grid-cols-2 gap-1 rounded-[14px] border border-line bg-bg2 p-1"
              role="tablist"
            >
              {(['create', 'join'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`min-h-11 rounded-[10px] text-sm font-bold transition ${mode === m ? 'bg-accent text-onaccent' : 'text-muted hover:text-ink'}`}
                >
                  {m === 'create' ? vi.home.createRoom : vi.home.joinRoom}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => setPickingAvatar((v) => !v)}
                aria-expanded={pickingAvatar}
                aria-label={vi.home.pickAvatar}
                className="rounded-full p-1 ring-2 ring-line transition hover:ring-accent"
              >
                <Avatar index={profile.avatar} size={56} />
              </button>
              <label className="min-w-0 flex-1">
                <span className="mb-1 flex justify-between text-sm font-semibold">
                  {vi.home.yourName}
                  <span className="font-normal text-muted">{vi.home.nameHelp}</span>
                </span>
                <input
                  value={profile.nickname}
                  onChange={(e) => setProfile({ nickname: e.target.value.slice(0, 16) })}
                  placeholder={vi.home.namePlaceholder}
                  autoComplete="nickname"
                  maxLength={16}
                  className="h-12 w-full rounded-[12px] border border-line bg-bg2 px-3 text-[16px] placeholder:text-muted focus:border-accent"
                />
              </label>
            </div>

            {pickingAvatar ? (
              <div
                className="anim-rise grid grid-cols-6 gap-2 rounded-[14px] border border-line bg-bg2 p-3"
                role="listbox"
                aria-label={vi.home.pickAvatar}
              >
                {Array.from({ length: AVATAR_COUNT }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="option"
                    aria-selected={profile.avatar === i}
                    aria-label={`Hình ${i + 1}`}
                    onClick={() => {
                      setProfile({ avatar: i });
                      setPickingAvatar(false);
                    }}
                    className={`flex items-center justify-center rounded-full p-0.5 ${profile.avatar === i ? 'ring-2 ring-accent' : 'hover:ring-2 hover:ring-line'}`}
                  >
                    <Avatar index={i} size={40} />
                  </button>
                ))}
              </div>
            ) : null}

            {mode === 'join' ? (
              <label className="anim-rise">
                <span className="mb-1 block text-sm font-semibold">{vi.home.roomCode}</span>
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, '')
                        .slice(0, 5),
                    )
                  }
                  placeholder={vi.home.codePlaceholder}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  className="font-display h-14 w-full rounded-[12px] border border-line bg-bg2 px-3 text-center text-[28px] font-bold tracking-[0.3em] placeholder:text-muted/60 focus:border-accent"
                />
              </label>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              disabled={!canSubmit}
              loading={busy}
              icon={
                mode === 'create' ? (
                  <Plus className="h-5 w-5" aria-hidden />
                ) : (
                  <LogIn className="h-5 w-5" aria-hidden />
                )
              }
            >
              {mode === 'create' ? vi.home.createRoom : vi.home.joinRoom}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted">{vi.app.noChatNote}</p>
        </section>

        <ul className="grid gap-3 lg:hidden">
          {vi.home.howItWorks.map((h, i) => {
            const Icon = MODE_ICONS[i] ?? Sparkles;
            return (
              <li key={h.t} className="card flex items-start gap-3 p-3.5">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <span className="text-sm">
                  <b>{h.t}.</b> <span className="text-muted">{h.d}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
