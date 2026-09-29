import type { AnimalId } from '../config/animals';
import type { TVBridge, TVEvent } from './TVBridge';
import { emptyConnection, type TVConnection, type TransferPlan, type TVSnapshot } from './protocol';
import { PollingSocket } from './PollingSocket';

type Role = 'tv' | 'controller';
interface Credentials {
  code: string;
  token: string;
  role: Role;
}
export type TVMessage =
  | { v: 1; kind: 'joined'; role: Role; code: string; token: string; serverTime: number }
  | {
      v: 1;
      kind: 'presence';
      tvReady: boolean;
      controllerPresent: boolean;
      tvSoundReady: boolean;
      audioTarget: 'ipad' | 'tv';
    }
  | { v: 1; kind: 'snapshot'; snapshot: TVSnapshot }
  | { v: 1; kind: 'event'; event: TVEvent; payload: unknown; sequence: number }
  | { v: 1; kind: 'transfer-prepare'; transfer: { id: AnimalId; transferId: string } }
  | { v: 1; kind: 'transfer-commit'; transfer: TransferPlan }
  | { v: 1; kind: 'transfer-cancelled'; transferId: string }
  | { v: 1; kind: 'pong'; sentAt: number; serverTime: number }
  | { v: 1; kind: 'error'; code: string; message: string };

export class WebSocketTVBridge implements TVBridge {
  private socket: WebSocket | PollingSocket | null = null;
  private credentials: Credentials | null = null;
  private status: TVConnection = { ...emptyConnection };
  private statusListeners = new Set<() => void>();
  private messages = new Set<(message: TVMessage) => void>();
  private events = new Set<(event: TVEvent, payload?: unknown) => void>();
  private pending = new Map<
    string,
    { resolve: (value: TransferPlan | null) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private retry: ReturnType<typeof setTimeout> | null = null;
  private pings = new Set<ReturnType<typeof setTimeout>>();
  private offset = 0;
  private bestRTT = Infinity;
  private retries = 0;
  private wanted = false;
  private presentationReady = false;
  private soundReady = false;
  private lastSnapshot: unknown = null;
  private lastFriend: unknown = null;
  private sequence = -1;
  private storageKey: string;
  constructor(private role: Role) {
    this.storageKey = `magic-animals-tv-${role}`;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(this.storageKey) ?? 'null',
      ) as Credentials | null;
      if (
        saved?.role === role &&
        /^\d{6}$/.test(saved.code) &&
        /^[a-zA-Z0-9_-]{43}$/.test(saved.token)
      )
        this.credentials = saved;
    } catch {
      /* storage is optional */
    }
  }
  getStatus = () => this.status;
  subscribe = (listener: () => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };
  onMessage(handler: (message: TVMessage) => void) {
    this.messages.add(handler);
    return () => {
      this.messages.delete(handler);
    };
  }
  onEvent(handler: (event: TVEvent, payload?: unknown) => void) {
    this.events.add(handler);
    return () => {
      this.events.delete(handler);
    };
  }
  private update(patch: Partial<TVConnection>) {
    this.status = { ...this.status, ...patch };
    this.statusListeners.forEach((fn) => fn());
    this.events.forEach((fn) => fn('CONNECTION_CHANGED', { ready: this.isReady() }));
  }
  private write(message: Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ v: 1, ...message }));
  }
  private save() {
    try {
      if (this.credentials)
        sessionStorage.setItem(this.storageKey, JSON.stringify(this.credentials));
      else sessionStorage.removeItem(this.storageKey);
    } catch {
      /* no persistent game data */
    }
  }
  async connect() {
    if (this.credentials && !this.socket) this.open({ kind: 'resume', ...this.credentials });
  }
  createRoom() {
    this.disconnect();
    this.sequence = -1;
    this.open({ kind: 'create' });
  }
  pair(code: string) {
    if (!/^\d{6}$/.test(code)) {
      this.update({ state: 'error', message: 'Enter the six-digit code from the TV.' });
      return;
    }
    this.disconnect();
    this.sequence = -1;
    this.open({ kind: 'pair', code });
  }
  private open(hello: Record<string, unknown>) {
    this.wanted = true;
    this.update({
      state: this.credentials ? 'reconnecting' : 'connecting',
      message: '',
      tvReady: false,
    });
    const url = new URL('/tv-socket', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = location.hostname === 'animals.flowlabli.online'
      ? new PollingSocket()
      : new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.write(hello);
    };
    socket.onerror = () => {
      if (this.socket === socket)
        this.update({
          message: 'TV server unavailable. Open the game through the TV server and try again.',
        });
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      if (this.socket !== socket || typeof event.data !== 'string') return;
      let msg: TVMessage;
      try {
        msg = JSON.parse(event.data) as TVMessage;
        if (msg.v !== 1) return;
      } catch {
        return;
      }
      if (msg.kind === 'joined') {
        this.credentials = { code: msg.code, token: msg.token, role: this.role };
        this.save();
        this.retries = 0;
        this.bestRTT = Infinity;
        this.offset = msg.serverTime - Date.now();
        this.update({ state: 'waiting', code: msg.code, message: '' });
        for (let i = 0; i < 4; i++) {
          const timer = setTimeout(() => {
            this.pings.delete(timer);
            this.write({ kind: 'ping', sentAt: Date.now() });
          }, i * 180);
          this.pings.add(timer);
        }
        if (this.role === 'tv') {
          this.write({ kind: 'ready', ready: this.presentationReady && !document.hidden });
          this.write({ kind: 'sound-ready', ready: this.soundReady });
        }
        if (this.role === 'controller' && this.lastSnapshot)
          this.sendEvent('SCENE_SYNC', this.lastSnapshot);
        if (this.role === 'controller' && this.lastFriend)
          this.sendEvent('FRIEND_SCENE', this.lastFriend);
      }
      if (msg.kind === 'presence')
        this.update({ ...msg, state: msg.tvReady && msg.controllerPresent ? 'ready' : 'waiting' });
      if (msg.kind === 'pong') {
        const rtt = Date.now() - msg.sentAt;
        if (rtt < this.bestRTT) {
          this.bestRTT = rtt;
          this.offset = msg.serverTime - (msg.sentAt + rtt / 2);
        }
        return;
      }
      if (msg.kind === 'error') {
        const fatal = ['SESSION_ENDED', 'INVALID_CODE', 'IN_USE', 'RATE_LIMIT'].includes(msg.code);
        if (fatal) {
          this.wanted = false;
          this.credentials = null;
          this.save();
          this.socket?.close();
        }
        this.update({ state: 'error', message: msg.message, tvReady: false });
      }
      if (msg.kind === 'snapshot' || msg.kind === 'event') {
        const sequence = msg.kind === 'snapshot' ? msg.snapshot.sequence : msg.sequence;
        if (sequence <= this.sequence) return;
        this.sequence = sequence;
      }
      if (msg.kind === 'transfer-commit')
        this.resolveTransfer(msg.transfer.transferId, msg.transfer);
      if (msg.kind === 'transfer-cancelled') {
        this.resolveTransfer(msg.transferId, null);
        this.events.forEach((fn) => fn('TRANSFER_CANCELLED', { transferId: msg.transferId }));
      }
      if (msg.kind === 'event') this.events.forEach((fn) => fn(msg.event, msg.payload));
      this.messages.forEach((fn) => fn(msg));
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.pending.forEach((_, id) => this.resolveTransfer(id, null));
      this.pings.forEach(clearTimeout);
      this.pings.clear();
      this.update({
        state:
          this.wanted && this.credentials
            ? 'reconnecting'
            : this.status.state === 'error'
              ? 'error'
              : 'off',
        tvReady: false,
        controllerPresent: false,
      });
      if (this.wanted && this.credentials)
        this.retry = setTimeout(
          () => {
            this.retry = null;
            void this.connect();
          },
          Math.min(8000, 800 * 2 ** this.retries++),
        );
    };
  }
  setPresentationReady(ready: boolean) {
    this.presentationReady = ready;
    this.write({ kind: 'ready', ready });
  }
  setSoundReady(ready: boolean) {
    this.soundReady = ready;
    this.write({ kind: 'sound-ready', ready });
  }
  setAudioTarget(target: 'ipad' | 'tv') {
    this.sendEvent('AUDIO_ROUTE', { target });
  }
  shouldSpeakOnTV() {
    return this.isReady() && this.status.tvSoundReady && this.status.audioTarget === 'tv';
  }
  acknowledgeTransfer(transferId: string) {
    if (this.presentationReady && !document.hidden)
      this.write({ kind: 'transfer-ready', transferId });
  }
  sendEvent(event: TVEvent, payload?: unknown) {
    if (event === 'SCENE_SYNC') this.lastSnapshot = payload;
    if (event === 'SCENE_SYNC' && !(payload as { paused?: boolean })?.paused)
      this.lastFriend = null;
    if (event === 'FRIEND_SCENE') this.lastFriend = payload;
    if (this.role === 'controller' && this.credentials)
      this.write({ kind: 'event', event, payload });
  }
  isReady() {
    return this.status.state === 'ready' && this.status.tvReady;
  }
  serverTime() {
    return Date.now() + this.offset;
  }
  requestTransfer(id: AnimalId): Promise<TransferPlan | null> {
    if (!this.isReady()) return Promise.resolve(null);
    const transferId = [...crypto.getRandomValues(new Uint8Array(16))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.resolveTransfer(transferId, null);
        this.cancelTransfer(transferId);
      }, 2200);
      this.pending.set(transferId, { resolve, timer });
      this.write({ kind: 'transfer-prepare', id, transferId });
    });
  }
  cancelTransfer(transferId: string) {
    this.write({ kind: 'transfer-cancel', transferId });
    this.resolveTransfer(transferId, null);
  }
  private resolveTransfer(id: string, value: TransferPlan | null) {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(value);
  }
  close() {
    this.wanted = false;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.pings.forEach(clearTimeout);
    this.pings.clear();
    this.pending.forEach((_, id) => this.resolveTransfer(id, null));
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.update({ ...emptyConnection });
  }
  disconnect() {
    this.write({ kind: 'leave' });
    this.close();
    this.credentials = null;
    this.lastSnapshot = null;
    this.lastFriend = null;
    this.save();
  }
}
let controller: WebSocketTVBridge | null = null;
export function getTVBridge() {
  if (!controller) {
    controller = new WebSocketTVBridge('controller');
    void controller.connect();
  }
  return controller;
}
