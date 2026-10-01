import { useEffect, useRef } from 'react';
import type { MindARProvider } from '../ar/MindARProvider';
import type { ARProvider } from '../ar/ARProvider';
import type { AnimalId } from '../config/animals';
import { animals } from '../config/animals';
import { useQuality } from '../hooks/useQuality';
import { useRuntime } from '../tracking/runtime';
interface Props {
  onFound: (id: AnimalId) => void;
  onTap?: (id: AnimalId) => void;
  onFailure: (error: unknown) => void;
  onReady?: (provider: ARProvider) => void;
  markerTest?: boolean;
}
export function ARStage(props: Props) {
  const root = useRef<HTMLDivElement>(null),
    provider = useRef<MindARProvider | null>(null),
    callbacks = useRef(props);
  callbacks.current = props;
  const { pixelRatio } = useQuality();
  const qualityRatio = useRef(pixelRatio);
  qualityRatio.current = pixelRatio;
  useEffect(() => {
    if (!root.current) return;
    let p: MindARProvider | null = null;
    let disposed = false;
    const launch = async () => {
      try {
        const { MindARProvider: Provider } = await import('../ar/MindARProvider');
        if (disposed) return;
        p = new Provider();
        provider.current = p;
        await p.initialize(root.current!, props.markerTest);
        p.setQuality(qualityRatio.current);
        if (disposed) return;
        await p.registerTargets(animals.map((a) => a.id));
        if (disposed) return;
        p.onTargetFound((id) => callbacks.current.onFound(id));
        p.onAnimalTap((id) => callbacks.current.onTap?.(id));
        await p.start();
        if (disposed) void p.stop();
        else callbacks.current.onReady?.(p);
      } catch (error) {
        if (!disposed) {
          await p?.stop();
          useRuntime.getState().update({
            camera: 'ERROR',
            ar: 'ERROR',
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          });
          callbacks.current.onFailure(error);
        }
      }
    };
    void launch();
    return () => {
      disposed = true;
      void p?.stop();
      provider.current = null;
    };
  }, [props.markerTest]);
  useEffect(() => provider.current?.setQuality(pixelRatio), [pixelRatio]);
  return <div ref={root} className="ar-container" />;
}
