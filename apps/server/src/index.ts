import cors from '@fastify/cors';
import { PVE_STAGES, STARTER_PETS } from '@pokiwar/shared';
import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { AuthManager } from './authManager.js';
import { PvpManager } from './pvpManager.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

async function bootstrap() {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  });

  const pvp = new PvpManager();
  const auth = new AuthManager();

  const extractToken = (authHeader?: string): string | null => {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim() || null;
  };

  app.get('/health', async () => ({
    ok: true,
    service: 'pokiwar-server',
    ...pvp.getStats(),
  }));

  app.post('/api/auth/register', async (req, reply) => {
    const body = (req.body ?? {}) as {
      username?: string;
      displayName?: string;
      password?: string;
      starterPetId?: string;
      serverId?: string;
    };
    const res = auth.register({
      username: body.username ?? '',
      displayName: body.displayName ?? '',
      password: body.password ?? '',
      starterPetId: body.starterPetId,
      serverId: body.serverId,
    });
    if (!res.ok) {
      return reply.code(400).send(res);
    }
    return res;
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body ?? {}) as {
      username?: string;
      password?: string;
      serverId?: string;
    };
    const res = auth.login({
      username: body.username ?? '',
      password: body.password ?? '',
      serverId: body.serverId,
    });
    if (!res.ok) {
      return reply.code(401).send(res);
    }
    return res;
  });

  app.get('/api/auth/me', async (req, reply) => {
    const token = extractToken(req.headers.authorization);
    if (!token) return reply.code(401).send({ ok: false, message: 'Chưa đăng nhập.' });
    const found = auth.getByToken(token);
    if (!found) return reply.code(401).send({ ok: false, message: 'Phiên đăng nhập đã hết hạn.' });
    return { ok: true, ...found };
  });

  app.put('/api/auth/progress', async (req, reply) => {
    const token = extractToken(req.headers.authorization);
    if (!token) return reply.code(401).send({ ok: false, message: 'Chưa đăng nhập.' });
    const body = (req.body ?? {}) as { progress?: Record<string, unknown> };
    if (!body.progress) return reply.code(400).send({ ok: false, message: 'Thiếu dữ liệu tiến trình.' });
    const ok = auth.saveProgress(token, body.progress);
    if (!ok) return reply.code(401).send({ ok: false, message: 'Phiên không hợp lệ.' });
    return { ok: true };
  });

  app.post('/api/auth/logout', async (req) => {
    const token = extractToken(req.headers.authorization);
    if (token) auth.logout(token);
    return { ok: true };
  });

  app.get('/api/pets', async () => ({ pets: STARTER_PETS }));
  app.get('/api/stages', async () => ({ stages: PVE_STAGES }));

  const wss = new WebSocketServer({ server: app.server, path: '/ws' });
  wss.on('connection', (ws) => {
    pvp.handleConnect(ws);
    ws.on('message', (data) => pvp.handleMessage(ws, data.toString()));
    ws.on('close', () => pvp.handleDisconnect(ws));
  });

  await app.listen({ port: PORT, host: HOST });
}

bootstrap().catch((err) => {
  console.error('Failed to start Pokiwar server:', err);
  process.exit(1);
});
