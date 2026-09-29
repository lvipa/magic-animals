import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ARStage } from '../components/ARStage';
import { CameraFeed } from '../components/CameraFeed';
import { useRuntime } from '../tracking/runtime';
export function MarkerTest() {
  const r = useRuntime(),
    [error, setError] = useState('');
  return (
    <main className="test-page">
      <Link to="/parent">← Parent</Link>
      <ARStage markerTest onFound={() => {}} onFailure={(e) => setError(String(e))} />
      <div className="diagnostic">
        <h2>Marker test</h2>
        <div>Camera: {r.camera}</div>
        <div>Tracking: {r.ar}</div>
        <div>Current target: {r.target?.toUpperCase() ?? '—'}</div>
        <div>Target visible: {r.visible ? 'YES' : 'NO'}</div>
        <div>Confidence: not exposed by MindAR</div>
        <div>Tracking FPS: {r.trackingFPS}</div>
        <div>Resolution: {r.resolution}</div>
        <div>Anchor: test cube and XYZ axes</div>
        {error && <div>{error}</div>}
      </div>
    </main>
  );
}
export function CameraTest() {
  return (
    <main className="test-page">
      <Link to="/parent">← Parent</Link>
      <CameraFeed diagnostic />
    </main>
  );
}
