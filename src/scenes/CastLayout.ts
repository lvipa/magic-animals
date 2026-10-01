import { useThree } from '@react-three/fiber';

/** Fit the cast inside the camera frustum, reserving space for the HUD/caption. */
export function useCastLayout(count: number) {
  const { width, height } = useThree((state) => state.viewport);
  const columns = Math.max(1, Math.min(count, width / height < 0.9 ? 2 : 4));
  const rows = Math.ceil(count / columns);
  const scale = Math.min(0.88, (width * 0.84) / (columns * 1.55), (height * 0.66) / (rows * 1.65));
  return {
    scale,
    position: (index: number): [number, number, number] => [
      ((index % columns) - (columns - 1) / 2) * 1.55 * scale,
      height * 0.06 + ((rows - 1) / 2 - Math.floor(index / columns)) * 1.65 * scale - 0.58 * scale,
      0,
    ],
  };
}
