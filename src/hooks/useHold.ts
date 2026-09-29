import { useEffect, useMemo } from 'react';
import { HoldGate } from '../parent/HoldGate';
export function useHold() {
  const gate = useMemo(() => new HoldGate(), []);
  useEffect(() => () => gate.cancel(), [gate]);
  return gate;
}
