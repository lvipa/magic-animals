import { Component, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Actor } from '../scenes/GameScene';
import { StudioEnvironment } from '../scenes/StudioLighting';
import { ModelLoadStatus } from '../characters/ModelLoadStatus';
import { DisplayResolution } from '../scenes/DisplayResolution';
import { song as defaultSong, songPhase, type SingMode, type SongDefinition } from './song';
import { activityOptions, farmFriends, musicAction } from './activities';

function PresentationBudget({ onSlow }: { onSlow: () => void }) {
  const sample = useRef({ frames: 0, elapsed: 0 });
  useFrame((_, delta) => {
    sample.current.frames++;
    sample.current.elapsed += Math.min(delta, 0.2);
    if (sample.current.elapsed > 3) {
      if (sample.current.frames / sample.current.elapsed < 24) onSlow();
      sample.current.frames = 0;
      sample.current.elapsed = 0;
    }
  });
  return null;
}

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
  choice = 0,
  beat = 0,
}: {
  time: number;
  mode: SingMode;
  playing: boolean;
  stars: number[];
  mouthLevel: () => number;
  onStar?: (line: number) => void;
  level?: number;
  song?: SongDefinition;
  choice?: number;
  beat?: number;
}) {
  const phase = songPhase(time, mode, song);
  const [premium, setPremium] = useState(true);
  const pageStart = Math.floor(phase.line / 6) * 6;
  const visibleStars = song.lines.slice(pageStart, pageStart + 6);
  const selected = activityOptions(song)[choice];
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
            {song.theme === 'garden' && (
              <path d="M75 340V165H120V340" fill="#d3a78f" stroke="#8c6f7d" strokeWidth="6" />
            )}
            <text
              x="515"
              y="240"
              fontSize="58"
              opacity={['farm', 'party', 'bus'].includes(song.theme) ? 0 : 1}
            >
              {song.theme === 'letters'
                ? song.lines[phase.line].words[0]
                : (selected?.icon ?? song.lines[phase.line].icon)}
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
              (song.video ? choice === 1 : phase.line === 1) &&
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
        {song.theme === 'farm' && (
          <g>
            <path d="M145 330V230H280V330Z" fill="#ef8e78" />
            <path d="M130 232L212 160L295 232" fill="#fff0d2" />
            <rect x="192" y="268" width="45" height="62" rx="8" fill="#866982" />
            <path
              d="M460 315H640M460 338H640M475 294V353M535 294V353M595 294V353"
              stroke="#fff1d9"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <text x="570" y="288" textAnchor="middle" fontSize="76">
              {farmFriends[choice]?.icon}
            </text>
          </g>
        )}
        {song.theme === 'bus' && (
          <g
            transform={`translate(130 ${playing && choice === 4 ? 268 + Math.sin(time * 7) * 8 : 268})`}
          >
            <rect
              width="460"
              height="102"
              rx="25"
              fill="#ffcf78"
              stroke="#ad785b"
              strokeWidth="5"
            />
            {[35, 98, 161, 224, 365].map((x) => (
              <rect key={x} x={x} y="14" width="49" height="38" rx="9" fill="#8ad2df" />
            ))}
            <g transform={`translate(293 12) scale(${choice === 1 && beat % 2 ? 0.28 : 1} 1)`}>
              <rect width="51" height="84" rx="6" fill="#587f9b" />
              <path d="M25 0V84" stroke="#ffefd2" strokeWidth="3" />
            </g>
            {[82, 376].map((x) => (
              <g
                key={x}
                transform={`translate(${x} 100) rotate(${playing && choice === 0 ? time * 180 : beat * 45})`}
              >
                <circle r="27" fill="#3d455e" />
                <circle r="15" fill="#fff0cf" />
                <path d="M-10 0H10M0-10V10" stroke="#7a779b" strokeWidth="4" />
              </g>
            ))}
            {choice === 2 &&
              [48, 402].map((x) => (
                <path
                  key={x}
                  d={`M${x} 47l${Math.sin((playing ? time * 6 : beat) * 1.2) * 22} -28`}
                  stroke="#405870"
                  strokeWidth="5"
                />
              ))}
            {choice === 3 && (
              <text
                x="230"
                y="-30"
                textAnchor="middle"
                fill="#624966"
                fontSize="30"
                fontWeight="bold"
              >
                Beep! Beep! 🎵
              </text>
            )}
          </g>
        )}
        {song.theme === 'party' && (
          <g>
            {['#ffb3b3', '#b8a6e3', '#ffe695', '#9ddaaa'].map((color, i) => (
              <g key={color} transform={`translate(${150 + i * 140} 90)`}>
                <ellipse rx="19" ry="25" fill={color} />
                <path d="M0 25v45" stroke="#fff0d2" strokeWidth="2" />
              </g>
            ))}
            <text x="550" y="280" textAnchor="middle" fontSize="62">
              {selected?.icon}
            </text>
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
          dpr={2}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          fallback={<div className="sing-fallback">🐱🎤</div>}
        >
          <DisplayResolution maximumDpr={premium ? 2 : 1.5} />
          <PresentationBudget onSlow={() => setPremium(false)} />
          <StudioEnvironment />
          <hemisphereLight args={['#fff4e7', '#819eae', 1.5]} />
          <directionalLight position={[-3, 4, 5]} intensity={2.8} color="#fff1dd" />
          <directionalLight position={[3, 2, -3]} intensity={1.7} color="#b2e4f3" />
          <Actor
            kind={song.character ?? 'cat'}
            position={[0, -1, 0]}
            scale={song.activity === 'bus' ? 1.42 : 1.85}
            premium={premium}
            action={
              phase.done
                ? 'happy'
                : song.video
                  ? musicAction(song, choice, playing || beat > 0)
                  : playing && !phase.turn
                    ? 'sing'
                    : phase.turn
                      ? 'wave'
                      : 'idle'
            }
            mouthLevel={mouthLevel}
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.99, 0.05]} scale={[0.55, 0.3, 1]}>
            <circleGeometry args={[1, 48]} />
            <meshBasicMaterial color="#282042" transparent opacity={0.35} />
          </mesh>
        </Canvas>
        <ModelLoadStatus ids={[song.character ?? 'cat']} />
      </StageBoundary>
      {!song.video && (
        <div className="sing-star-ring" aria-label="Звёзды песни">
          {visibleStars.map((_, slot) => {
            const i = pageStart + slot;
            return (
              <button
                key={i}
                aria-label={`Зажечь звезду ${i + 1}`}
                disabled={!onStar}
                onClick={() => onStar?.(i)}
                className={`${stars.includes(i) ? 'lit' : ''} ${phase.line === i ? 'current' : ''}`}
                style={{
                  left: `${50 - 38 * Math.cos((slot / Math.max(1, visibleStars.length - 1)) * Math.PI)}%`,
                  top: `${60 - 43 * Math.sin((slot / Math.max(1, visibleStars.length - 1)) * Math.PI)}%`,
                }}
              >
                ★
              </button>
            );
          })}
        </div>
      )}
      <span className="sing-milo-label">
        {song.character === 'bunny'
          ? 'Poppy'
          : song.character === 'dog'
            ? 'Buddy'
            : song.character === 'foxy'
              ? 'Foxy'
              : 'Milo'}{' '}
        · {selected?.word ?? 'Sing & play'}
      </span>
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
  choice = 0,
}: {
  time: number;
  mode: SingMode;
  song?: SongDefinition;
  choice?: number;
}) {
  const phase = songPhase(time, mode, song),
    line = song.lines[phase.line];
  const option = activityOptions(song)[choice];
  if (song.video && option)
    return (
      <section className="sing-lyrics sing-activity-caption" aria-label="Движение песни">
        <span className="sing-meaning-picture">{option.icon}</span>
        <p lang="en">{option.word}</p>
        <small>{option.label} · Показывай и подпевай!</small>
      </section>
    );
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
