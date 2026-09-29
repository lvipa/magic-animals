import { createTVServer } from '../server/tv-server.mjs';

const app = await createTVServer({ port: 0, host: '127.0.0.1' });
const url = `http://127.0.0.1:${app.port}/tv-poll`;
async function poll(sessionId, messages = []) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, messages: messages.map((message) => JSON.stringify({ v: 1, ...message })) }),
  });
  if (!response.ok) throw new Error(`Poll HTTP ${response.status}`);
  const data = await response.json();
  return { sessionId: data.sessionId, messages: data.messages.map(JSON.parse) };
}
const has = (packet, kind) => packet.messages.find((message) => message.kind === kind);
try {
  let tv = await poll(null);
  tv = await poll(tv.sessionId, [{ kind: 'create' }]);
  const joinedTV = has(tv, 'joined');
  if (!/^\d{6}$/.test(joinedTV?.code)) throw new Error('TV room not created');
  await poll(tv.sessionId, [{ kind: 'ready', ready: true }, { kind: 'sound-ready', ready: true }]);
  let controller = await poll(null);
  controller = await poll(controller.sessionId, [{ kind: 'pair', code: joinedTV.code }]);
  if (!has(controller, 'joined')) throw new Error('iPad did not pair');
  controller = await poll(controller.sessionId, [{ kind: 'event', event: 'FRIEND_SCENE', payload: { id: 'bunny', action: 'wave' } }]);
  tv = await poll(tv.sessionId);
  if (!tv.messages.some((m) => m.kind === 'event' && m.event === 'FRIEND_SCENE' && m.payload.id === 'bunny'))
    throw new Error('Friend scene did not reach TV');
  controller = await poll(controller.sessionId, [{ kind: 'transfer-prepare', id: 'cat', transferId: '12345678abcd' }]);
  tv = await poll(tv.sessionId);
  if (!has(tv, 'transfer-prepare')) throw new Error('Transfer not prepared');
  tv = await poll(tv.sessionId, [{ kind: 'transfer-ready', transferId: '12345678abcd' }]);
  controller = await poll(controller.sessionId);
  if (!has(controller, 'transfer-commit')) throw new Error('Transfer not committed');
  console.log('PASS TV HTTP relay: pairing, presence, friend scene, staged transfer');
} finally {
  await app.close();
}
