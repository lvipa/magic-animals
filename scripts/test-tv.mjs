import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { WebSocket } from 'ws';
import { chromium } from 'playwright';
import { createTVServer } from '../server/tv-server.mjs';
import { browserExecutable, isolateTestContext } from './browser-runtime.mjs';

const app = await createTVServer({ port: 0, host: '127.0.0.1' });
const base = `http://127.0.0.1:${app.port}`,
  checks = [],
  sockets = [];
const pass = (name) => {
  checks.push(name);
  console.log('PASS', name);
};
function peer() {
  const socket = new WebSocket(`${base.replace('http', 'ws')}/tv-socket`);
  sockets.push(socket);
  const inbox = [],
    waiters = [];
  socket.on('error', () => {});
  socket.on('message', (data) => {
    const msg = JSON.parse(data);
    const waiter = waiters.find((w) => w.test(msg));
    if (waiter) {
      waiters.splice(waiters.indexOf(waiter), 1);
      clearTimeout(waiter.timer);
      waiter.resolve(msg);
    } else inbox.push(msg);
  });
  return {
    socket,
    open: () =>
      new Promise((r, j) => {
        socket.once('open', r);
        socket.once('error', j);
      }),
    send: (msg) => socket.send(JSON.stringify({ v: 1, ...msg })),
    next: (test, ms = 4000) => {
      const index = inbox.findIndex(test);
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = {
          test,
          resolve,
          timer: setTimeout(() => {
            waiters.splice(waiters.indexOf(waiter), 1);
            reject(new Error('TV message timeout'));
          }, ms),
        };
        waiters.push(waiter);
      });
    },
  };
}
const initialScene = {
  caption: 'CAT!',
  animal: 'cat',
  reveal: 1,
  action: 'happy',
  foxy: 'happy',
  effects: false,
  finale: false,
};
async function hold(page, locator, duration) {
  const box = await locator.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(duration);
  await page.mouse.up();
}
try {
  const tv = peer();
  await tv.open();
  tv.send({ kind: 'create' });
  const room = await tv.next((m) => m.kind === 'joined');
  assert.match(room.code, /^\d{6}$/);
  tv.send({ kind: 'ready', ready: true });
  const controller = peer();
  await controller.open();
  controller.send({ kind: 'pair', code: room.code });
  const identity = await controller.next((m) => m.kind === 'joined');
  await controller.next((m) => m.kind === 'presence' && m.tvReady);
  pass('TV room creation, six-digit pairing and ready handshake');
  tv.send({ kind: 'sound-ready', ready: true });
  controller.send({ kind: 'event', event: 'AUDIO_ROUTE', payload: { target: 'tv' } });
  await controller.next((m) => m.kind === 'presence' && m.tvSoundReady && m.audioTarget === 'tv');
  controller.send({ kind: 'event', event: 'AUDIO_CUE', payload: { cue: 'cat' } });
  await tv.next((m) => m.kind === 'event' && m.event === 'AUDIO_CUE' && m.payload.cue === 'cat');
  controller.send({ kind: 'event', event: 'AUDIO_CUE', payload: { cue: 'character-cat-wave' } });
  await tv.next(
    (m) => m.kind === 'event' && m.event === 'AUDIO_CUE' && m.payload.cue === 'character-cat-wave',
  );
  controller.send({ kind: 'event', event: 'AUDIO_CUE', payload: { cue: 'ask-jump' } });
  await tv.next(
    (m) => m.kind === 'event' && m.event === 'AUDIO_CUE' && m.payload.cue === 'ask-jump',
  );
  tv.send({ kind: 'sound-ready', ready: false });
  await controller.next((m) => m.kind === 'presence' && !m.tvSoundReady && m.audioTarget === 'tv');
  controller.send({ kind: 'event', event: 'AUDIO_ROUTE', payload: { target: 'ipad' } });
  await controller.next((m) => m.kind === 'presence' && m.audioTarget === 'ipad');
  pass('Voice routes to an unlocked TV and reports availability for iPad fallback');
  controller.send({
    kind: 'event',
    event: 'SCENE_SYNC',
    payload: { state: 'CAT_PLAY', scene: initialScene },
  });
  const synced = await tv.next((m) => m.kind === 'snapshot');
  assert.equal(synced.snapshot.scene.animal, 'cat');
  controller.send({
    kind: 'event',
    event: 'SCENE_SYNC',
    payload: {
      state: 'CAT_PLAY',
      scene: { ...initialScene, cameraFrame: 'forbidden', reveal: NaN },
    },
  });
  assert.equal((await controller.next((m) => m.kind === 'error')).code, 'BAD_EVENT');
  controller.send({ kind: 'event', event: 'CAMERA_FRAME', payload: { image: 'forbidden' } });
  assert.equal((await controller.next((m) => m.kind === 'error')).code, 'BAD_EVENT');
  tv.send({
    kind: 'event',
    event: 'SCENE_SYNC',
    payload: { state: 'CAT_PLAY', scene: initialScene },
  });
  assert.equal((await tv.next((m) => m.kind === 'error')).code, 'READ_ONLY');
  pass('Validated scene synchronization; camera uploads and TV control commands rejected');
  for (const id of ['elephant', 'panda', 'cat', 'bunny', 'foxy', 'dog', 'bear', 'lion']) {
    controller.send({
      kind: 'event',
      event: 'SCENE_SYNC',
      payload: { state: 'FREE_PLAY', scene: { ...initialScene, animal: id } },
    });
    const message = await tv.next((m) => m.kind === 'snapshot');
    assert.equal(message.snapshot.scene.animal, id);
  }
  pass('Eight unordered AR card scenes synchronize to TV');
  for (const id of ['foxy', 'cat', 'dog', 'lion', 'bunny', 'bear', 'panda', 'elephant']) {
    controller.send({ kind: 'event', event: 'FRIEND_SCENE', payload: { id, action: 'wave' } });
    const friend = await tv.next((m) => m.kind === 'event' && m.event === 'FRIEND_SCENE');
    assert.deepEqual(friend.payload, { id, action: 'wave' });
  }
  controller.send({
    kind: 'event',
    event: 'FRIEND_SCENE',
    payload: { id: 'unknown', action: 'wave' },
  });
  assert.equal((await controller.next((m) => m.kind === 'error')).code, 'BAD_EVENT');
  pass('All eight bonus friends and their actions synchronize; unknown characters rejected');
  const singing = {
    song: 'twinkle-v2-natural',
    mode: 'echo',
    time: 4.5,
    playing: true,
    guide: true,
    stars: [0],
    sentAt: Date.now(),
    active: true,
  };
  controller.send({ kind: 'event', event: 'SING_SCENE', payload: singing });
  assert.deepEqual(
    (await tv.next((m) => m.kind === 'event' && m.event === 'SING_SCENE')).payload,
    singing,
  );
  controller.send({ kind: 'event', event: 'SING_SCENE', payload: { ...singing, stars: [99] } });
  assert.equal((await controller.next((m) => m.kind === 'error')).code, 'BAD_EVENT');
  pass('Singing clock and participation synchronize; invalid song payload rejected');
  for (const action of ['sing', 'tired', 'hungry', 'thirsty', 'sad']) {
    controller.send({
      kind: 'event',
      event: 'FRIEND_SCENE',
      payload: { id: 'dog', action, world: 'space' },
    });
    const friend = await tv.next((m) => m.kind === 'event' && m.event === 'FRIEND_SCENE');
    assert.deepEqual(friend.payload, { id: 'dog', action, world: 'space' });
  }
  controller.send({
    kind: 'event',
    event: 'SCENE_SYNC',
    payload: {
      state: 'FREE_PLAY',
      scene: { ...initialScene, animal: 'cat', action: 'sing', world: 'forest' },
    },
  });
  assert.equal((await tv.next((m) => m.kind === 'snapshot')).snapshot.scene.world, 'forest');
  controller.send({
    kind: 'event',
    event: 'FRIEND_SCENE',
    payload: { id: 'dog', action: 'sing', world: 'unknown' },
  });
  assert.equal((await controller.next((m) => m.kind === 'error')).code, 'BAD_EVENT');
  pass('All new educational actions and world choice synchronize; invalid world rejected');
  controller.send({
    kind: 'event',
    event: 'FRIEND_SCENE',
    payload: { id: 'elephant', action: 'wave', world: 'space' },
  });
  await tv.next((m) => m.kind === 'event' && m.event === 'FRIEND_SCENE');
  const attacker = peer();
  await attacker.open();
  attacker.send({ kind: 'resume', code: room.code, role: 'controller', token: 'я'.repeat(43) });
  assert.equal((await attacker.next((m) => m.kind === 'error')).code, 'SESSION_ENDED');
  attacker.socket.close();
  pass('Capability token validation rejects malformed or unauthorized resume');
  const transferId = 'transfer-cat-0001';
  controller.send({ kind: 'transfer-prepare', id: 'cat', transferId });
  await tv.next((m) => m.kind === 'transfer-prepare');
  tv.send({ kind: 'transfer-ready', transferId });
  const committed = await controller.next((m) => m.kind === 'transfer-commit');
  assert.ok(committed.transfer.revealAt > Date.now());
  await tv.next((m) => m.kind === 'transfer-commit');
  controller.send({ kind: 'transfer-prepare', id: 'cat', transferId });
  tv.send({ kind: 'transfer-ready', transferId });
  const released = await tv.next(
    (m) => m.kind === 'snapshot' && m.snapshot.released.includes('cat'),
  );
  assert.deepEqual(released.snapshot.released, ['cat']);
  pass('Two-phase transfer with scheduled reveal and duplicate transfer deduplication');
  const cancelledId = 'transfer-dog-0002';
  controller.send({ kind: 'transfer-prepare', id: 'dog', transferId: cancelledId });
  await tv.next((m) => m.kind === 'transfer-prepare');
  tv.send({ kind: 'transfer-ready', transferId: cancelledId });
  await controller.next((m) => m.kind === 'transfer-commit');
  tv.socket.close();
  await controller.next((m) => m.kind === 'transfer-cancelled' && m.transferId === cancelledId);
  pass('TV disconnect cancels a committed transfer before reveal');
  const tvResume = peer();
  await tvResume.open();
  tvResume.send({ kind: 'resume', role: 'tv', code: room.code, token: room.token });
  await tvResume.next((m) => m.kind === 'joined');
  const restored = await tvResume.next((m) => m.kind === 'snapshot');
  assert.deepEqual(restored.snapshot.released, ['cat']);
  assert.deepEqual(
    (await tvResume.next((m) => m.kind === 'event' && m.event === 'FRIEND_SCENE')).payload,
    { id: 'elephant', action: 'wave', world: 'space' },
  );
  pass('Reconnect restores scene and released animals without duplicates');
  controller.socket.close();
  const resumedController = peer();
  await resumedController.open();
  resumedController.send({
    kind: 'resume',
    role: 'controller',
    code: room.code,
    token: identity.token,
  });
  await resumedController.next((m) => m.kind === 'joined');
  resumedController.send({ kind: 'event', event: 'SCENE_CHANGE', payload: { state: 'WELCOME' } });
  resumedController.send({
    kind: 'event',
    event: 'SCENE_SYNC',
    payload: {
      state: 'WELCOME',
      scene: { ...initialScene, animal: null, reveal: 0 },
      paused: true,
    },
  });
  const reset = await tvResume.next((m) => m.kind === 'snapshot' && m.snapshot.state === 'WELCOME');
  assert.deepEqual(reset.snapshot.released, []);
  assert.equal(reset.snapshot.paused, true);
  pass('Controller resume, reset and pause synchronization');
  for (const socket of sockets) socket.close();

  if (!process.argv.includes('--protocol-only')) {
    const browser = await chromium.launch({
      headless: true,
      executablePath: browserExecutable(),
      args: ['--enable-webgl'],
    });
    try {
      const tvContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await isolateTestContext(tvContext);
      const screen = await tvContext.newPage();
      const errors = [];
      screen.on('pageerror', (error) => errors.push(error.message));
      await screen.goto(`${base}/tv`);
      const decoded = await screen.evaluate(async () => {
        const context = new AudioContext();
        try {
          const manifest = await fetch('/audio/manifest.json').then((r) => r.json());
          return await Promise.all(
            manifest.clips.map(async (clip) => {
              const response = await fetch(`/audio/${clip.group}/${clip.cue}.mp3`);
              if (!response.ok) throw new Error(`Missing audio: ${clip.cue}`);
              const buffer = await context.decodeAudioData(await response.arrayBuffer());
              const samples = buffer.getChannelData(0);
              let peak = 0;
              for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
              if (buffer.duration < 0.2 || peak < 0.005 || peak >= 1)
                throw new Error(`Invalid audio: ${clip.cue}`);
              return clip.cue;
            }),
          );
        } finally {
          await context.close();
        }
      });
      const manifest = JSON.parse(await readFile('public/audio/manifest.json', 'utf8'));
      assert.equal(decoded.length, manifest.clips.length);
      assert.equal(new Set(decoded).size, manifest.clips.length);
      pass(
        `All ${decoded.length} cartoon voice/effect MP3 files decode with non-silent unclipped samples`,
      );
      await screen.getByRole('button', { name: 'START TV' }).click();
      await screen.waitForFunction(() =>
        /^\d{6}$/.test(document.querySelector('.tv-code')?.textContent),
      );
      const code = await screen.locator('.tv-code').innerText();
      await screen.screenshot({ path: 'artifacts/tv-pairing.png' });
      const ipadContext = await browser.newContext({ viewport: { width: 1180, height: 820 } });
      await isolateTestContext(ipadContext);
      const ipad = await ipadContext.newPage();
      ipad.on('pageerror', (error) => errors.push(error.message));
      await ipad.goto(`${base}/parent/tv`);
      await hold(ipad, ipad.getByRole('button', { name: 'Hold PARENT' }), 2150);
      await ipad.getByLabel('TV code').fill(code);
      await ipad.getByRole('button', { name: 'Connect TV', exact: true }).click();
      await ipad.getByRole('heading', { name: 'TV connected ✓' }).waitFor();
      await screen.getByText('iPad connected ✓', { exact: false }).waitFor();
      pass('Two browser screens pair through the actual TV relay');
      await ipad.getByRole('link', { name: 'Back to game', exact: true }).click();
      await hold(ipad, ipad.locator('.parent-corner'), 3100);
      await hold(ipad, ipad.getByRole('button', { name: 'Hold PARENT' }), 2150);
      await ipad.getByRole('button', { name: 'Force CAT' }).click();
      await screen.locator('.tv-caption').filter({ hasText: 'CAT!' }).waitFor();
      await screen.waitForTimeout(450);
      await screen.screenshot({ path: 'artifacts/tv-cat.png' });
      pass('GameEngine sends a real scene update to the rendered TV character');
      await screen.reload();
      await screen.locator('.tv-caption').filter({ hasText: 'CAT!' }).waitFor();
      pass('TV page reload resumes the paired session and latest scene');
      await ipad.goto(`${base}/friends`);
      await ipad.getByRole('button', { name: /DOG/ }).click();
      await ipad.getByRole('button', { name: /Космос/ }).click();
      await ipad.getByRole('button', { name: '🎵 Sing', exact: true }).click();
      await screen.locator('.tv-caption').filter({ hasText: 'I am singing!' }).waitFor();
      await screen.locator('.tv-stage .world-space').waitFor();
      await screen.reload();
      await screen.locator('.tv-caption').filter({ hasText: 'I am singing!' }).waitFor();
      await screen.locator('.tv-stage .world-space').waitFor();
      pass(
        'Rendered TV shows the child-selected rocket world and English singing phrase, restored after reload',
      );
      assert.deepEqual(errors, []);
      await tvContext.close();
      await ipadContext.close();
    } finally {
      await browser.close();
    }
  }
  await writeFile(
    process.argv.includes('--protocol-only')
      ? 'TV_PROTOCOL_TEST_RESULTS.json'
      : 'TV_TEST_RESULTS.json',
    JSON.stringify(
      {
        environment:
          'Local Node relay, WebSocket clients and desktop Chromium; physical iPad/TV test deferred',
        passed: checks,
      },
      null,
      2,
    ),
  );
} finally {
  for (const socket of sockets) socket.terminate();
  await app.close();
}
