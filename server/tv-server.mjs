import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { networkInterfaces } from 'node:os';
import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import { animalIds, gameEvent } from './validation.mjs';

const token = () => randomBytes(32).toString('base64url');
const validToken = (actual, expected) =>
  typeof actual === 'string' &&
  /^[a-zA-Z0-9_-]{43}$/.test(actual) &&
  typeof expected === 'string' &&
  timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.mind': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};
export async function createTVServer({
  port = 8080,
  host = '0.0.0.0',
  root = resolve('dist'),
  tls,
} = {}) {
  root = resolve(root);
  const rooms = new Map(),
    peers = new Map(),
    attempts = new Map(),
    httpPeers = new Map();
  class PollPeer extends EventEmitter {
    constructor(id) {
      super();
      this.id = id;
      this.readyState = WebSocket.OPEN;
      this.outbox = [];
      this.touched = Date.now();
    }
    send(message) { this.outbox.push(message); }
    ping() { this.emit('pong'); }
    terminate() { this.close(); }
    close() {
      if (this.readyState !== WebSocket.OPEN) return;
      this.readyState = WebSocket.CLOSED;
      httpPeers.delete(this.id);
      this.emit('close');
    }
  }
  const send = (socket, data) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ v: 1, ...data }));
  };
  const broadcast = (room, data) => {
    send(room.tv, data);
    send(room.controller, data);
  };
  const presence = (room) =>
    broadcast(room, {
      kind: 'presence',
      tvReady: room.tvReady && room.tv?.readyState === WebSocket.OPEN,
      controllerPresent: room.controller?.readyState === WebSocket.OPEN,
      tvSoundReady: room.audioReady,
      audioTarget: room.audioTarget,
    });
  const snapshot = (room) => {
    if (room.snapshot)
      broadcast(room, {
        kind: 'snapshot',
        snapshot: { ...room.snapshot, sequence: ++room.sequence, released: [...room.released] },
      });
  };
  const cancel = (room, transferId) => {
    const transfer = room.transfers.get(transferId);
    if (!transfer || transfer.done) return;
    clearTimeout(transfer.timer);
    room.transfers.delete(transferId);
    broadcast(room, { kind: 'transfer-cancelled', transferId });
  };
  const clearTransfers = (room) => {
    for (const id of room.transfers.keys()) cancel(room, id);
  };
  const destroy = (room) => {
    clearTransfers(room);
    rooms.delete(room.code);
    broadcast(room, {
      kind: 'error',
      code: 'SESSION_ENDED',
      message: 'The TV session ended. Enter the new code.',
    });
    room.controller?.close(1000, 'Session ended');
    room.tv?.close(1000, 'Session ended');
  };
  const allow = (ip) => {
    const now = Date.now();
    const recent = (attempts.get(ip) ?? []).filter((time) => now - time < 60000);
    if (recent.length >= 10) return false;
    recent.push(now);
    attempts.set(ip, recent);
    return true;
  };
  const handle = async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const path = new URL(req.url, 'http://local').pathname;
    if (path === '/tv-poll' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      let raw = '';
      for await (const part of req) {
        raw += part.toString();
        if (raw.length > 16384) { res.writeHead(413).end('{}'); return; }
      }
      let input;
      try { input = JSON.parse(raw); } catch { res.writeHead(400).end('{}'); return; }
      if (!Array.isArray(input.messages) || input.messages.length > 12 ||
          input.messages.some((message) => typeof message !== 'string' || message.length > 8192)) {
        res.writeHead(400).end('{}'); return;
      }
      let socket;
      if (input.sessionId === null) {
        if (httpPeers.size >= 400) { res.writeHead(503).end('{}'); return; }
        const id = randomBytes(24).toString('base64url');
        socket = new PollPeer(id);
        httpPeers.set(id, socket);
        wss.emit('connection', socket, {
          socket: { remoteAddress: req.headers['x-client-ip'] || req.socket.remoteAddress },
        });
      } else if (typeof input.sessionId === 'string' && /^[A-Za-z0-9_-]{32}$/.test(input.sessionId)) {
        socket = httpPeers.get(input.sessionId);
      }
      if (!socket) { res.writeHead(410).end('{}'); return; }
      socket.touched = Date.now();
      for (const message of input.messages) {
        socket.emit('message', Buffer.from(message), false);
        if (socket.readyState !== WebSocket.OPEN) break;
      }
      const messages = socket.outbox.splice(0);
      res.end(JSON.stringify({ sessionId: socket.id, messages }));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    if (path === '/healthz') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ service: 'magic-animals-tv', protocol: 1 }));
      return;
    }
    let file;
    try {
      file = resolve(root, `.${decodeURIComponent(path)}`);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    } catch {
      if (extname(path) || /^\/(assets|audio|models|markers|icons)\//.test(path)) {
        res.writeHead(404).end();
        return;
      }
      file = resolve(root, 'index.html');
    }
    try {
      const data = await readFile(file);
      res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
      res.setHeader(
        'Cache-Control',
        /[\\/]assets[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      res.setHeader('Content-Length', data.byteLength);
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404).end('Build the app with npm run build.');
    }
  };
  const server = tls ? httpsServer(tls, handle) : httpServer(handle);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://local').pathname !== '/tv-socket') {
      socket.destroy();
      return;
    }
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host) {
          socket.destroy();
          return;
        }
      } catch {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (socket, req) => {
    const peer = {
      role: null,
      room: null,
      ip: req.socket.remoteAddress,
      alive: true,
      count: 0,
      since: Date.now(),
    };
    peers.set(socket, peer);
    socket.on('error', () => {});
    socket.on('pong', () => {
      peer.alive = true;
    });
    const error = (code, message) => send(socket, { kind: 'error', code, message });
    const attach = (room, role) => {
      const old = room[role];
      room[role] = socket;
      old?.close(1000, 'Reconnected');
      peer.room = room;
      peer.role = role;
      room.touched = Date.now();
      send(socket, {
        kind: 'joined',
        role,
        code: room.code,
        token: room[`${role}Token`],
        serverTime: Date.now(),
      });
      presence(room);
      snapshot(room);
      if (role === 'tv' && room.friendScene)
        send(socket, {
          kind: 'event',
          event: 'FRIEND_SCENE',
          payload: room.friendScene,
          sequence: ++room.sequence,
        });
    };
    socket.on('message', (bytes, binary) => {
      if (binary) {
        socket.close(1003, 'JSON only');
        return;
      }
      if (Date.now() - peer.since > 1000) {
        peer.since = Date.now();
        peer.count = 0;
      }
      if (++peer.count > 50) {
        socket.close(1008, 'Rate limit');
        return;
      }
      let msg;
      try {
        msg = JSON.parse(bytes.toString());
      } catch {
        error('BAD_MESSAGE', 'Invalid JSON.');
        return;
      }
      if (msg?.v !== 1 || typeof msg.kind !== 'string') {
        error('BAD_MESSAGE', 'Unsupported protocol.');
        return;
      }
      if (msg.kind === 'ping' && Number.isFinite(msg.sentAt)) {
        send(socket, { kind: 'pong', sentAt: msg.sentAt, serverTime: Date.now() });
        return;
      }
      if (!peer.role) {
        if (msg.kind === 'create') {
          if (!allow(peer.ip) || rooms.size >= 200) {
            error('RATE_LIMIT', 'Please wait before creating another code.');
            return;
          }
          let code;
          do {
            code = String(randomInt(100000, 1000000));
          } while (rooms.has(code));
          const room = {
            code,
            tvToken: token(),
            controllerToken: null,
            tv: null,
            controller: null,
            tvReady: false,
            audioReady: false,
            audioTarget: 'ipad',
            snapshot: null,
            friendScene: null,
            sequence: 0,
            released: new Set(),
            transfers: new Map(),
            touched: Date.now(),
          };
          rooms.set(code, room);
          attach(room, 'tv');
          return;
        }
        if (msg.kind === 'pair') {
          if (!allow(peer.ip)) {
            error('RATE_LIMIT', 'Too many attempts. Wait one minute.');
            return;
          }
          const room = rooms.get(msg.code);
          if (!room || room.tv?.readyState !== WebSocket.OPEN) {
            error('INVALID_CODE', 'Check the six-digit code on the TV.');
            return;
          }
          if (room.controllerToken) {
            error('IN_USE', 'This TV is already paired. Choose New code on the TV.');
            return;
          }
          room.controllerToken = token();
          attach(room, 'controller');
          return;
        }
        if (msg.kind === 'resume') {
          const room = rooms.get(msg.code);
          if (
            !room ||
            !['tv', 'controller'].includes(msg.role) ||
            !validToken(msg.token, room[`${msg.role}Token`])
          ) {
            error('SESSION_ENDED', 'This session expired. Pair using a new TV code.');
            return;
          }
          attach(room, msg.role);
          return;
        }
        error('NOT_PAIRED', 'Pair before sending game events.');
        return;
      }
      const room = peer.room;
      room.touched = Date.now();
      if (room[peer.role] !== socket) return;
      if (msg.kind === 'leave') {
        if (peer.role === 'tv') destroy(room);
        else {
          clearTransfers(room);
          room.controllerToken = null;
          room.controller = null;
          presence(room);
        }
        socket.close(1000, 'Left');
        return;
      }
      if (peer.role === 'tv') {
        if (msg.kind === 'sound-ready' && typeof msg.ready === 'boolean') {
          room.audioReady = msg.ready;
          presence(room);
          return;
        }
        if (msg.kind === 'ready' && typeof msg.ready === 'boolean') {
          room.tvReady = msg.ready;
          if (!msg.ready) clearTransfers(room);
          presence(room);
          return;
        }
        if (msg.kind === 'transfer-ready') {
          const t = room.transfers.get(msg.transferId);
          if (!t || t.done || t.committed || !room.tvReady || !room.controller) return;
          clearTimeout(t.timer);
          t.committed = true;
          t.revealAt = Date.now() + 900;
          broadcast(room, {
            kind: 'transfer-commit',
            transfer: { transferId: t.transferId, id: t.id, revealAt: t.revealAt },
          });
          t.timer = setTimeout(() => {
            if (
              !room.tvReady ||
              room.tv?.readyState !== WebSocket.OPEN ||
              room.controller?.readyState !== WebSocket.OPEN
            ) {
              cancel(room, t.transferId);
              return;
            }
            t.done = true;
            room.released.add(t.id);
            snapshot(room);
          }, 900);
          return;
        }
        error('READ_ONLY', 'The TV receives game events.');
        return;
      }
      if (msg.kind === 'event') {
        const payload = gameEvent(msg.event, msg.payload);
        if (!payload) {
          error('BAD_EVENT', 'Unsupported game event.');
          return;
        }
        if (msg.event === 'AUDIO_ROUTE') {
          room.audioTarget = payload.target;
          presence(room);
          return;
        }
        if (
          msg.event === 'AUDIO_CUE' &&
          (!room.audioReady || room.audioTarget !== 'tv' || !room.tvReady)
        )
          return;
        if (
          msg.event === 'GAME_STARTED' ||
          (msg.event === 'SCENE_CHANGE' && msg.payload.state === 'WELCOME')
        ) {
          clearTransfers(room);
          room.transfers.clear();
          room.released.clear();
          room.friendScene = null;
        }
        if (msg.event === 'SCENE_SYNC') {
          room.snapshot = payload;
          if (!payload.paused) room.friendScene = null;
          snapshot(room);
        } else {
          if (msg.event === 'FRIEND_SCENE') room.friendScene = payload;
          send(room.tv, { kind: 'event', event: msg.event, payload, sequence: ++room.sequence });
        }
        return;
      }
      if (msg.kind === 'transfer-prepare') {
        if (!room.tvReady || room.tv?.readyState !== WebSocket.OPEN) {
          send(socket, { kind: 'transfer-cancelled', transferId: msg.transferId });
          return;
        }
        if (
          !animalIds.includes(msg.id) ||
          typeof msg.transferId !== 'string' ||
          !/^[a-zA-Z0-9-]{8,64}$/.test(msg.transferId)
        ) {
          error('BAD_TRANSFER', 'Invalid transfer.');
          return;
        }
        if (room.transfers.has(msg.transferId)) return;
        if (room.transfers.size >= 128) {
          send(socket, { kind: 'transfer-cancelled', transferId: msg.transferId });
          return;
        }
        const transfer = { id: msg.id, transferId: msg.transferId, committed: false, done: false };
        room.transfers.set(msg.transferId, transfer);
        transfer.timer = setTimeout(() => cancel(room, msg.transferId), 1500);
        send(room.tv, {
          kind: 'transfer-prepare',
          transfer: { id: transfer.id, transferId: transfer.transferId },
        });
        return;
      }
      if (msg.kind === 'transfer-cancel') {
        cancel(room, msg.transferId);
        return;
      }
      error('BAD_MESSAGE', 'Unsupported command.');
    });
    socket.on('close', () => {
      peers.delete(socket);
      const room = peer.room;
      if (!room || room[peer.role] !== socket) return;
      room[peer.role] = null;
      if (peer.role === 'tv') {
        room.tvReady = false;
        room.audioReady = false;
      }
      clearTransfers(room);
      presence(room);
    });
  });
  const heartbeat = setInterval(() => {
    for (const [socket, peer] of peers) {
      if (!peer.alive) {
        socket.terminate();
        continue;
      }
      peer.alive = false;
      socket.ping();
    }
    const now = Date.now();
    for (const socket of httpPeers.values())
      if (now - socket.touched > 60000) socket.close();
    for (const room of rooms.values()) if (now - room.touched > 2 * 60 * 60 * 1000) destroy(room);
    for (const [ip, values] of attempts)
      if (values.every((time) => now - time > 60000)) attempts.delete(ip);
  }, 15000);
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, host, done);
  });
  return {
    server,
    port: server.address().port,
    close: async () => {
      clearInterval(heartbeat);
      for (const room of rooms.values()) clearTransfers(room);
      for (const socket of peers.keys()) socket.terminate();
      await new Promise((done) => wss.close(done));
      await new Promise((done) => server.close(done));
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const tls =
    process.env.TV_TLS_CERT && process.env.TV_TLS_KEY
      ? {
          cert: await readFile(process.env.TV_TLS_CERT),
          key: await readFile(process.env.TV_TLS_KEY),
        }
      : undefined;
  const app = await createTVServer({ port: Number(process.env.TV_PORT ?? 8080), tls });
  const scheme = tls ? 'https' : 'http';
  console.log(`Magic Animals + TV: ${scheme}://localhost:${app.port}/tv`);
  for (const entries of Object.values(networkInterfaces()))
    for (const addr of entries ?? [])
      if (addr.family === 'IPv4' && !addr.internal)
        console.log(`LAN: ${scheme}://${addr.address}:${app.port}/tv`);
  if (!tls)
    console.log(
      'iPad camera requires trusted HTTPS. Use a reverse proxy or TV_TLS_CERT + TV_TLS_KEY.',
    );
  const stop = async () => {
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
