import { useRuntime } from '../tracking/runtime';
import { useGame } from '../storage/store';
import { useQuality } from '../hooks/useQuality';
export function DebugOverlay() {
  const r = useRuntime(),
    s = useGame(),
    q = useQuality();
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return (
    <div className="debug">
      FPS: {r.fps} · tracking FPS: {r.trackingFPS}
      <br />
      camera: {r.camera} · AR: {r.ar}
      <br />
      tracking: {r.visible ? 'ON' : 'SEARCHING'} · target: {r.target ?? '—'}
      <br />
      state: {s.state} · mode: {s.mode}
      <br />
      quality: {s.quality} → {q.effective}
      <br />
      memory:{' '}
      {memory ? `${Math.round(memory.usedJSHeapSize / 1048576)} MB (JS heap only)` : 'not exposed'}
      <br />
      {r.error}
    </div>
  );
}
