import type { TimelineEntry } from '@masoi/shared';
import { vi } from '../i18n/vi';

/** Biến một mục timeline thành câu tiếng Việt. `name` tra tên người chơi theo id. */
export function describeTimeline(e: TimelineEntry, name: (id: string) => string): string {
  const T = vi.timeline;
  const actor = e.actor ? name(e.actor) : '';
  const target = e.target ? name(e.target) : '';
  switch (e.kind) {
    case 'WOLF_TARGET':
      return T.WOLF_TARGET(target);
    case 'NO_WOLF_TARGET':
      return T.NO_WOLF_TARGET();
    case 'GUARD':
      return T.GUARD(actor, target);
    case 'SEER':
      return T.SEER(actor, target, e.result === 'WOLF');
    case 'WITCH_HEAL':
      return T.WITCH_HEAL(actor, target);
    case 'WITCH_POISON':
      return T.WITCH_POISON(actor, target);
    case 'SAVED':
      return T.SAVED(target);
    case 'DEATH':
      return T.DEATH[e.cause ?? 'WOLF'](target);
    case 'NO_LYNCH':
      return T.NO_LYNCH();
    case 'HUNTER_SHOT':
      return T.HUNTER_SHOT(actor, target);
    default:
      return '';
  }
}
