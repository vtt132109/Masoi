import { createApp } from './app';

const env = process.env;
const isProd = env.NODE_ENV === 'production';

const app = await createApp({
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '0.0.0.0',
  staticDir: env.STATIC_DIR ?? new URL('../../web/dist', import.meta.url).pathname,
  allowedOrigin: env.ALLOWED_ORIGIN,
  trustProxy: env.TRUST_PROXY === '1',
  // Bot chỉ để thử một mình: mặc định bật khi phát triển, tắt ở production.
  allowBots: env.ALLOW_BOTS ? env.ALLOW_BOTS === '1' : !isProd,
  // Chỉ để thử/E2E: nhân mọi thời gian của ván (ví dụ 0.2 = nhanh gấp 5 lần).
  timeScale: env.TIME_SCALE ? Number(env.TIME_SCALE) : 1,
  logLevel: env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
});

const port = await app.listen();
app.fastify.log.info(`Ma Sói server đang chạy ở cổng ${port}`);

const shutdown = async (signal: string) => {
  app.fastify.log.info(`Nhận ${signal}, đang tắt…`);
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
