export class HoldGate {
  private timer: ReturnType<typeof setTimeout> | null = null;
  start(duration: number, callback: () => void) {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      callback();
    }, duration);
  }
  cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
