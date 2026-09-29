import { useEffect, useRef, useState } from 'react';
import { useRuntime } from '../tracking/runtime';
export function CameraFeed({
  onError,
  diagnostic = false,
}: {
  onError?: (error: string) => void;
  diagnostic?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null),
    errorCallback = useRef(onError);
  errorCallback.current = onError;
  const [status, setStatus] = useState('REQUESTING'),
    [size, setSize] = useState('—'),
    [fps, setFps] = useState(0),
    [orientation, setOrientation] = useState(screen.orientation?.type ?? 'unknown');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [deviceId, setDeviceId] = useState<string>();
  useEffect(() => {
    const videoElement = videoRef.current;
    let stream: MediaStream | null = null,
      frameId = 0,
      alive = true,
      last = performance.now(),
      frames = 0;
    const updateOrientation = () =>
      setOrientation(
        screen.orientation?.type ?? (innerWidth > innerHeight ? 'landscape' : 'portrait'),
      );
    window.addEventListener('resize', updateOrientation);
    useRuntime.getState().update({ camera: 'REQUESTING' });
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: 'environment' } },
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (!alive) return;
        const resolution = `${video.videoWidth} × ${video.videoHeight}`;
        setSize(resolution);
        setStatus('READY');
        useRuntime.getState().update({ camera: 'READY', resolution });
        setDevices(
          (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'),
        );
        if ('requestVideoFrameCallback' in video) {
          const tick = (time: number) => {
            if (!alive) return;
            frames++;
            if (time - last >= 1000) {
              setFps(Math.round((frames * 1000) / (time - last)));
              frames = 0;
              last = time;
            }
            frameId = video.requestVideoFrameCallback(tick);
          };
          frameId = video.requestVideoFrameCallback(tick);
        } else setFps(Math.round(stream.getVideoTracks()[0]?.getSettings().frameRate ?? 0));
      } catch (error) {
        if (!alive) return;
        setStatus('UNAVAILABLE');
        useRuntime.getState().update({ camera: 'ERROR', error: String(error) });
        errorCallback.current?.(String(error));
      }
    };
    void start();
    return () => {
      alive = false;
      window.removeEventListener('resize', updateOrientation);
      videoElement?.cancelVideoFrameCallback?.(frameId);
      stream?.getTracks().forEach((t) => t.stop());
      useRuntime.getState().update({ camera: 'OFF' });
    };
  }, [deviceId]);
  return (
    <div className="camera-feed">
      <video ref={videoRef} muted playsInline autoPlay />
      {diagnostic && (
        <div className="diagnostic">
          <h2>Camera test</h2>
          <div>Permission / camera: {status}</div>
          <div>Resolution: {size}</div>
          <div>Orientation: {orientation}</div>
          <div>Camera FPS: {fps}</div>
          {devices.length > 1 && (
            <select value={deviceId ?? ''} onChange={(e) => setDeviceId(e.target.value)}>
              <option value="">Default rear camera</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Camera'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
