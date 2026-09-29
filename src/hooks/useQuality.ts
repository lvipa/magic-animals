import { useEffect, useState } from 'react';
import { useRuntime } from '../tracking/runtime';
import { useGame, type Quality } from '../storage/store';
export function useQuality() {
  const selected = useGame((s) => s.quality),
    fps = useRuntime((s) => s.fps);
  const [automatic, setAutomatic] = useState<Exclude<Quality, 'AUTO'>>('MEDIUM');
  useEffect(() => {
    if (selected !== 'AUTO' || fps === 0) return;
    if (fps < 25) setAutomatic('LOW');
  }, [selected, fps]);
  const effective = selected === 'AUTO' ? automatic : selected;
  return {
    effective,
    pixelRatio: effective === 'HIGH' ? 2 : effective === 'MEDIUM' ? 1.5 : 1,
    particles: effective === 'HIGH' ? 24 : effective === 'MEDIUM' ? 16 : 8,
  };
}
