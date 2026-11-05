import type { BrowserContext, Page } from '@playwright/test';

export const phaseOf = (page: Page) =>
  page
    .locator('main[data-phase]')
    .first()
    .getAttribute('data-phase', { timeout: 1000 })
    .catch(() => null);

/** Theo dõi mọi view mà server gửi cho trang này: bắt lỗi rò rỉ vai ở tầng mạng. */
export function watchLeaks(page: Page, leaks: string[]) {
  page.on('websocket', (ws) => {
    ws.on('framereceived', ({ payload }) => {
      const text = typeof payload === 'string' ? payload : payload.toString();
      if (!text.startsWith('42')) return;
      let msg: unknown;
      try {
        msg = JSON.parse(text.slice(2));
      } catch {
        return;
      }
      if (!Array.isArray(msg) || msg[0] !== 'game:view') return;
      const view = msg[1] as {
        me: { id: string };
        players: { id: string; alive: boolean; revealedRole?: string }[];
        gameOver?: unknown;
        privateInfo: { wolfVotes?: unknown };
        myAction: { kind: string };
      };
      if (!view.gameOver) {
        for (const p of view.players) {
          if (p.id !== view.me.id && p.alive && p.revealedRole) {
            leaks.push(`thấy vai của ${p.id} đang sống: ${p.revealedRole}`);
          }
        }
      }
      const raw = JSON.stringify(view);
      for (const forbidden of ['"seed"', '"wolfTarget"', '"dummyPicks"', '"pendingShots"']) {
        if (raw.includes(forbidden)) leaks.push(`view chứa ${forbidden}`);
      }
    });
  });
}

const click = async (page: Page, name: RegExp | string, exact = false) => {
  const btn = page.getByRole('button', { name, exact }).last();
  if ((await btn.count()) === 0) return false;
  if (!(await btn.isEnabled().catch(() => false))) return false;
  await btn.click({ timeout: 2000 }).catch(() => undefined);
  return true;
};

const pickFirstTile = async (page: Page) => {
  const tiles = page.locator('button[aria-pressed]:not([disabled])');
  if ((await tiles.count()) === 0) return false;
  await tiles
    .first()
    .click({ timeout: 2000 })
    .catch(() => undefined);
  return true;
};

/** Một nhịp "người chơi tự động" dùng đúng các nút trên giao diện. */
export async function autopilotStep(page: Page): Promise<string | null> {
  const phase = await phaseOf(page);
  switch (phase) {
    case 'ROLE_REVEAL':
      await click(page, 'Đã hiểu', true);
      break;
    case 'NIGHT':
      if (await pickFirstTile(page)) {
        await click(page, /^(Chốt mục tiêu|Soi người này|Bảo vệ người này|Xác nhận)/);
      } else {
        // Phù thủy: không cần chọn ai
        await click(page, /^Xác nhận$/);
      }
      break;
    case 'DISCUSSION':
      await click(page, 'Sẵn sàng bỏ phiếu', true);
      break;
    case 'VOTE':
    case 'REVOTE':
      if (await pickFirstTile(page)) await click(page, /^(Bỏ phiếu|Đổi phiếu)$/);
      break;
    case 'HUNTER_SHOT':
      if (await pickFirstTile(page)) await click(page, /^Bắn/);
      break;
  }
  return phase;
}

/** Chạy tự động cho đến khi GAME_OVER (hoặc hết thời gian). */
export async function autopilotUntilOver(page: Page, timeoutMs = 200_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const phase = await autopilotStep(page);
    if (phase === 'GAME_OVER') return;
    await page.waitForTimeout(250);
  }
  throw new Error('Ván không kết thúc kịp thời gian');
}

export async function newPlayer(
  context: BrowserContext,
  errors: string[],
  leaks: string[],
): Promise<Page> {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  watchLeaks(page, leaks);
  return page;
}
