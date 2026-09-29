import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHold } from '../hooks/useHold';
import { useGame } from '../storage/store';
export function ParentGate() {
  const [confirm, setConfirm] = useState(false);
  const gate = useHold();
  const navigate = useNavigate();
  const setParent = useGame((s) => s.setParent);
  const clear = () => gate.cancel();
  const hold = (ms: number, done: () => void) => gate.start(ms, done);
  return (
    <>
      <div
        className="parent-corner"
        aria-label="Hold for parent mode"
        onPointerDown={() => hold(3000, () => setConfirm(true))}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
      />
      {confirm && (
        <div className="parent-gate">
          <div className="gate-card">
            <p>For grown-ups</p>
            <button
              className="large-button"
              onPointerDown={() =>
                hold(2000, () => {
                  setConfirm(false);
                  setParent(true);
                  navigate('/parent');
                })
              }
              onPointerUp={clear}
              onPointerCancel={clear}
              onPointerLeave={clear}
            >
              Hold PARENT
            </button>
            <button onClick={() => setConfirm(false)}>Back</button>
          </div>
        </div>
      )}
    </>
  );
}
