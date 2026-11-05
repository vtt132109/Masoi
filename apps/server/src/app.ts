import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import type { ServerToClient } from '@masoi/shared';
import { RoomManager } from './rooms/RoomManager';
import { createOutbox, registerHandlers } from './transport/handlers';

export interface AppOptions {
  port?: number;
  host?: string;
  /** Thư mục build của web (để phục vụ file tĩnh). */
  staticDir?: string;
  /** Origin được phép (CORS cho socket). Bỏ trống = chỉ cùng origin. */
  allowedOrigin?: string;
  trustProxy?: boolean;
  allowBots?: boolean;
  /** Nhân mọi thời gian của ván (test). */
  timeScale?: number;
  logLevel?: string;
  sweepIntervalMs?: number;
}

export async function createApp(options: AppOptions = {}) {
  const fastify = Fastify({
    logger: { level: options.logLevel ?? 'info' },
    trustProxy: options.trustProxy ?? false,
  });
  const log = fastify.log as FastifyBaseLogger;

  const io = new Server<Record<string, never>, ServerToClient>(fastify.server, {
    cors: options.allowedOrigin ? { origin: options.allowedOrigin } : undefined,
    maxHttpBufferSize: 4 * 1024, // payload tối đa 4KB
    pingInterval: 10_000,
    pingTimeout: 10_000,
    serveClient: false,
  });

  const out = createOutbox(io as unknown as Server);
  const manager = new RoomManager({
    out,
    now: () => Date.now(),
    timeScale: options.timeScale ?? 1,
    allowBots: options.allowBots ?? false,
    log,
  });
  const transport = registerHandlers(io as unknown as Server, manager, out, {
    trustProxy: options.trustProxy ?? false,
    now: () => Date.now(),
    log,
  });

  fastify.get('/healthz', async () => ({ ok: true, ...manager.stats() }));

  const staticDir = options.staticDir ? resolve(options.staticDir) : undefined;
  if (staticDir && existsSync(staticDir)) {
    await fastify.register(fastifyStatic, { root: staticDir, wildcard: false });
    // SPA: mọi đường dẫn không phải file → index.html
    fastify.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/socket.io') || req.method !== 'GET') {
        return reply.code(404).send({ error: 'not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  const sweeper = setInterval(() => {
    manager.sweep();
    transport.sweepLimiters();
  }, options.sweepIntervalMs ?? 5000);
  sweeper.unref();

  return {
    fastify,
    io,
    manager,
    async listen(): Promise<number> {
      await fastify.listen({ port: options.port ?? 3000, host: options.host ?? '0.0.0.0' });
      const addr = fastify.server.address();
      return typeof addr === 'object' && addr ? addr.port : (options.port ?? 3000);
    },
    async close(): Promise<void> {
      clearInterval(sweeper);
      manager.closeAll();
      await io.close();
      await fastify.close().catch(() => undefined);
    },
  };
}
