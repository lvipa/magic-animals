import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRuntime } from '../tracking/runtime';
export function FrameMeter({ enabled }: { enabled: boolean }) {
  const sample = useRef({ last: performance.now(), frames: 0 });
  useFrame(() => {
    if (!enabled) return;
    const now = performance.now();
    sample.current.frames++;
    if (now - sample.current.last >= 1000) {
      useRuntime
        .getState()
        .update({ fps: Math.round((sample.current.frames * 1000) / (now - sample.current.last)) });
      sample.current = { last: now, frames: 0 };
    }
  });
  return null;
}
