import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 3200;

export default defineConfig({
  testDir: '.',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: {
    // Cần `pnpm build` trước. Ván chạy nhanh hơn 6-7 lần để test không quá lâu.
    command: 'node apps/server/dist/index.js',
    cwd: root,
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      STATIC_DIR: 'apps/web/dist',
      ALLOW_BOTS: '1',
      TIME_SCALE: '0.15',
      LOG_LEVEL: 'warn',
      NODE_ENV: 'test',
    },
  },
});
