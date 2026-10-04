import { Component, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Actor } from '../scenes/GameScene';
import { StudioEnvironment } from '../scenes/StudioLighting';
import { ModelLoadStatus } from '../characters/ModelLoadStatus';
import { DisplayResolution } from '../scenes/DisplayResolution';
import { song as defaultSong, songPhase, type SingMode, type SongDefinition } from './song';

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <div className="sing-fallback">🐱🎤</div> : this.props.children;
  }
}
export function SingStage({
  time,
  mode,
  playing,
  stars,
  mouthLevel,
  onStar,
  level = 0,
  song = defaultSong,
}: {
  time: number;
  mode: SingMode;
  playing: boolean;
  stars: number[];
  mouthLevel: () => number;
  onStar?: (line: number) => void;
  level?: number;
  song?: SongDefinition;
}) {
  const phase = songPhase(time, mode, song);
  return (
    <div className={`sing-stage theme-${song.theme} ${phase.turn && playing ? 'child-turn' : ''}`}>
      <svg
        className="sing-space"
        viewBox="0 0 720 440"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="sing-sky">
            <stop stopColor="#666ab4" />
            <stop offset="1" stopColor="#272550" />
          </radialGradient>
          <linearGradient id="sing-planet" x2="0" y2="1">
            <stop stopColor="#a78cce" />
            <stop offset="1" stopColor="#6b598f" />
          </linearGradient>
        </defs>
        <rect
          width="720"
          height="440"
          fill={song.theme === 'space' ? 'url(#sing-sky)' : '#9ed9df'}
        />
        {song.theme !== 'space' && (
          <g>
            <circle cx="625" cy="75" r="40" fill="#ffe7a6" />
            <ellipse cx="360" cy="490" rx="510" ry="148" fill="#8bbc9c" />
            <path d="M75 340V165H120V340" fill="#d3a78f" stroke="#8c6f7d" strokeWidth="6" />
            <text x="515" y="240" fontSize="58">
              {song.theme === 'letters'
                ? song.lines[phase.line].words[0]
                : song.lines[phase.line].icon}
            </text>
            {song.theme === 'letters' && (
              <g fill="#fff0c4" fontSize="45" fontWeight="bold">
                <text x="95" y="90">
                  A
                </text>
                <text x="220" y="65">
                  B
                </text>
                <text x="490" y="80">
                  C
                </text>
              </g>
            )}
            {song.theme === 'garden' &&
              phase.line === 1 &&
              [125, 180, 540, 590, 660].map((x) => (
                <path
                  key={x}
                  d={`M${x} 100l-14 40`}
                  stroke="#599abd"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              ))}
          </g>
        )}
        {song.theme === 'space' && (
          <g>
            {[45, 126, 212, 298, 425, 510, 645, 687].map((x, i) => (
              <circle key={x} cx={x} cy={45 + ((i * 73) % 235)} r={i % 2 ? 2 : 3} fill="#ffe8ad" />
            ))}
            <circle cx="610" cy="90" r="39" fill="#d1b8eb" />
            <ellipse
              cx="610"
              cy="90"
              rx="68"
              ry="13"
              fill="none"
              stroke="#aa89ce"
              strokeWidth="9"
              transform="rotate(-25 610 90)"
            />
            <ellipse cx="360" cy="490" rx="510" ry="148" fill="url(#sing-planet)" />
            <g transform="translate(72 210) rotate(18)">
              <path d="M0 25Q-22-7 0-53Q22-7 0 25" fill="#fff0d2" />
              <circle cy="-16" r="9" fill="#6abfd1" />
              <path d="M-10 20L0 48L10 20" fill="#ffb879" />
            </g>
          </g>
        )}
      </svg>
      <StageBoundary>
        <Canvas
          camera={{ position: [0, 0.7, 4.8], fov: 38 }}
          dpr={1.5}
          gl={{ alpha: true, antialias: true }}
          fallback={<div className="sing-fallback">🐱🎤</div>}
        >
          <DisplayResolution />
          <StudioEnvironment />
          <hemisphereLight args={['#fff4e7', '#819eae', 1.5]} />
          <directionalLight position={[-3, 4, 5]} intensity={2.8} color="#fff1dd" />
          <directionalLight position={[3, 2, -3]} intensity={1.7} color="#b2e4f3" />
          <Actor
            kind="cat"
            position={[0, -1, 0]}
            scale={1.65}
            action={
              phase.done ? 'happy' : playing && !phase.turn ? 'sing' : phase.turn ? 'wave' : 'idle'
            }
            mouthLevel={mouthLevel}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.99, 0.05]} scale={[0.55, 0.3, 1]}>
            <circleGeometry args={[1, 48]} />
            <meshBasicMaterial color="#282042" transparent opacity={0.35} />
          </mesh>
        </Canvas>
        <ModelLoadStatus ids={['cat']} />
      </StageBoundary>
      <div className="sing-star-ring" aria-label="Звёзды песни">
        {song.lines.map((_, i) => (
          <button
            key={i}
            aria-label={`Зажечь звезду ${i + 1}`}
            disabled={!onStar}
            onClick={() => onStar?.(i)}
            className={`${stars.includes(i) ? 'lit' : ''} ${phase.line === i ? 'current' : ''}`}
            style={{
              left: `${50 - 38 * Math.cos((i / (song.lines.length - 1)) * Math.PI)}%`,
              top: `${60 - 43 * Math.sin((i / (song.lines.length - 1)) * Math.PI)}%`,
            }}
          >
            ★
          </button>
        ))}
      </div>
      <span className="sing-milo-label">Milo's little concert</span>
      {phase.turn && playing && (
        <div className="sing-turn-badge">
          🎤 Твой голос! <span style={{ transform: `scale(${1 + level * 0.6})` }}>✦</span>
        </div>
      )}
    </div>
  );
}
export function SingLyrics({
  time,
  mode,
  song = defaultSong,
}: {
  time: number;
  mode: SingMode;
  song?: SongDefinition;
}) {
  const phase = songPhase(time, mode, song),
    line = song.lines[phase.line];
  return (
    <section className="sing-lyrics" aria-label="Слова песни">
      <span className="sing-meaning-picture" aria-hidden="true">
        {line.icon}
      </span>
      <p lang="en">
        {line.words.map((word, i) => (
          <span key={i} className={i === phase.word && !phase.done ? 'active' : ''}>
            {word}{' '}
          </span>
        ))}
      </p>
      <small>{line.meaning}</small>
      <div className="sing-word">
        {line.key} <span>— {line.translation}</span>
      </div>
    </section>
  );
}
