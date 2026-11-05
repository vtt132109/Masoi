import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROLE_IDS, ROLE_TEAM } from '@masoi/shared';
import { vi } from '../i18n/vi';
import { ROLE_ICON, ROLE_ORDER, teamColorClass } from '../lib/roles';

export function Rules() {
  const R = vi.rulesPage;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 safe-top">
      <Link
        to="/"
        className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {vi.common.back}
      </Link>
      <h1 className="font-display mb-3 text-4xl font-bold">{R.title}</h1>
      <p className="mb-6 text-[17px] text-muted">{R.intro}</p>

      <section className="card mb-4 p-5">
        <h2 className="mb-3 text-lg font-bold">{R.flow}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-[15px]">
          {R.flowSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section className="card mb-4 p-5">
        <h2 className="mb-3 text-lg font-bold">{R.win}</h2>
        <ul className="space-y-1.5 text-[15px]">
          <li className="text-village">✔ {R.winVillage}</li>
          <li className="text-wolf">✔ {R.winWolf}</li>
        </ul>
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        {ROLE_ORDER.filter((r) => ROLE_IDS.includes(r)).map((r) => {
          const Icon = ROLE_ICON[r];
          const c = teamColorClass(ROLE_TEAM[r]);
          return (
            <article key={r} className="card flex gap-3 p-4">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${c.soft} ${c.text}`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-bold">
                  {vi.roles[r].name}{' '}
                  <span className={`text-xs font-semibold ${c.text}`}>
                    · {vi.teams[ROLE_TEAM[r]]}
                  </span>
                </h3>
                <p className="text-sm text-muted">{vi.roles[r].desc}</p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="card mb-4 p-5">
        <h2 className="mb-2 text-lg font-bold">{R.antiLeak}</h2>
        <p className="text-[15px] text-muted">{R.antiLeakText}</p>
      </section>
      <section className="card p-5">
        <h2 className="mb-2 text-lg font-bold">{R.modes}</h2>
        <p className="text-[15px] text-muted">{R.modesText}</p>
      </section>
    </main>
  );
}
