import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/** Supersample HD displays, without allocating an enormous buffer on 4K TVs. */
export function DisplayResolution() {
  const size = useThree((s) => s.size),
    setDpr = useThree((s) => s.setDpr);
  useEffect(() => {
    setDpr(Math.min(1.5, Math.sqrt((3840 * 2160) / Math.max(1, size.width * size.height))));
  }, [size.width, size.height, setDpr]);
  return null;
}
