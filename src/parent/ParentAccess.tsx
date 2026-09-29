import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../storage/store';
import { useHold } from '../hooks/useHold';
export function ParentAccess({ children }: { children: ReactNode }) {
  const parent = useGame((s) => s.parent),
    setParent = useGame((s) => s.setParent),
    hold = useHold();
  if (parent) return children;
  return (
    <div className="parent-page">
      <Link to="/">← Game</Link>
      <h1>For grown-ups</h1>
      <p>Hold the button for two seconds to open diagnostics.</p>
      <button
        onPointerDown={() => hold.start(2000, () => setParent(true))}
        onPointerUp={() => hold.cancel()}
        onPointerCancel={() => hold.cancel()}
        onPointerLeave={() => hold.cancel()}
      >
        Hold PARENT
      </button>
    </div>
  );
}
