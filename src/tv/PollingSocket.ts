/** WebSocket-shaped same-origin fallback for PHP based shared hosting. */
export class PollingSocket {
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  private sessionId: string | null = null;
  private outgoing: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;

  constructor() { void this.pump(); }

  send(data: string) {
    if (this.readyState !== WebSocket.OPEN) throw new Error('TV transport is closed');
    this.outgoing.push(data);
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    void this.pump();
  }

  private async pump() {
    if (this.inFlight || this.readyState === WebSocket.CLOSED) return;
    this.inFlight = true;
    const outgoing = this.outgoing.splice(0);
    try {
      const response = await fetch('/tv-poll.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, messages: outgoing }),
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!response.ok) throw new Error(`TV relay ${response.status}`);
      const packet = await response.json() as { sessionId: string; messages: string[] };
      if (!/^[A-Za-z0-9_-]{32}$/.test(packet.sessionId) || !Array.isArray(packet.messages))
        throw new Error('Invalid TV relay response');
      if (this.readyState === WebSocket.CLOSED) return;
      this.sessionId = packet.sessionId;
      if (this.readyState === WebSocket.CONNECTING) {
        this.readyState = WebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }
      for (const message of packet.messages)
        if (typeof message === 'string') this.onmessage?.(new MessageEvent('message', { data: message }));
    } catch {
      if (this.readyState !== WebSocket.CLOSED) {
        this.outgoing.unshift(...outgoing);
        this.onerror?.(new Event('error'));
        this.close();
      }
    } finally {
      this.inFlight = false;
      if (this.readyState !== WebSocket.CLOSED) {
        if (this.outgoing.length) void this.pump();
        else this.timer = setTimeout(() => { this.timer = null; void this.pump(); }, 300);
      }
    }
  }

  close() {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    if (this.timer) clearTimeout(this.timer);
    // Deliver a queued leave even when React immediately unmounts the screen.
    if (this.sessionId && this.outgoing.length)
      void fetch('/tv-poll.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId, messages: this.outgoing.splice(0) }),
        keepalive: true, credentials: 'omit',
      }).catch(() => {});
    this.onclose?.(new CloseEvent('close'));
  }
}
