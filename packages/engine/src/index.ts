export * from './state';
export { createGame, type CreateGameInput } from './create';
export { apply } from './reducer';
export { projectFor } from './projection';
export { checkWin } from './phases';
export { botCommand, makeRng } from './bot';

import type { GameState } from './state';

/** Hạn chót của pha hiện tại (epoch ms). null = không có (tạm dừng hoặc hết ván). */
export function nextDeadline(state: GameState): number | null {
  if (state.winner || state.phase.paused) return null;
  return state.phase.deadlineAt;
}
