import type { World } from './adventure';
import './play.css';
export function WorldBackdrop({ world }: { world: World }) {
  return (
    <div className={`world-backdrop world-${world}`} aria-hidden="true">
      <svg viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice">
        {world === 'space' ? (
          <>
            {[...Array(24)].map((_, i) => (
              <circle
                key={i}
                cx={(i * 137 + 61) % 1000}
                cy={(i * 83 + 27) % 500}
                r={(i % 3) + 1.5}
                fill="#fff5ce"
              />
            ))}
            <g transform="translate(780 150) rotate(-24)">
              <ellipse rx="100" ry="28" fill="none" stroke="#be9aec" strokeWidth="16" />
              <circle r="58" fill="#d8b6ed" />
              <path
                d="M-45 -20 Q0 12 48 -13 M-46 10 Q0 37 40 18"
                fill="none"
                stroke="#b792da"
                strokeWidth="9"
              />
            </g>
            <g className="world-rocket" transform="translate(140 200) rotate(24)">
              <path d="M-24 90 L0 143 L24 90" fill="#ffd074" />
              <path d="M-24 50 L-44 90 L-20 80 M24 50 L44 90 L20 80" fill="#ff8b92" />
              <path d="M0 -65 Q-35 -25 -25 80 L25 80 Q35 -25 0 -65" fill="#fff0d9" />
              <circle cy="3" r="16" fill="#84d8ec" stroke="#688db0" strokeWidth="6" />
            </g>
            <path d="M0 610 Q400 400 1000 610 V650 H0" fill="#766391" />
          </>
        ) : (
          <>
            <circle cx="835" cy="105" r="45" fill="#ffdc88" />
            <g fill="#ffffff" opacity=".65">
              <ellipse cx="180" cy="108" rx="85" ry="20" />
              <ellipse cx="224" cy="95" rx="39" ry="31" />
              <ellipse cx="596" cy="160" rx="100" ry="19" />
            </g>
            <path d="M0 445 Q240 325 520 437 Q790 345 1000 435 V650 H0" fill="#a1cc9e" />
            <path d="M0 510 Q250 419 550 513 Q800 447 1000 506 V650 H0" fill="#71aa83" />
            {world === 'forest'
              ? [80, 195, 790, 925].map((x, i) => (
                  <g key={x} transform={`translate(${x} ${i % 2 ? 420 : 380})`}>
                    <rect x="-12" y="-45" width="24" height="145" rx="10" fill="#b48365" />
                    <ellipse cy="-103" rx="65" ry="100" fill={i % 2 ? '#6ca891' : '#4e9584'} />
                    <circle cx="-30" cy="-70" r="47" fill="#82bb96" />
                  </g>
                ))
              : world === 'trampoline'
                ? [155, 840].map((x) => (
                    <g key={x} transform={`translate(${x} 485)`}>
                      <path d="M-67 4 L-78 69 M67 4 L78 69" stroke="#c0cddd" strokeWidth="13" />
                      <ellipse
                        cy="4"
                        rx="92"
                        ry="25"
                        fill="#6a7899"
                        stroke="#efb0ba"
                        strokeWidth="16"
                      />
                      <path d="M-92 0 V-143 M92 0 V-143" stroke="#91b7d5" strokeWidth="7" />
                      <path
                        d="M-92 -140 Q0 -100 92 -140"
                        fill="none"
                        stroke="#ffe1a6"
                        strokeWidth="4"
                      />
                    </g>
                  ))
                : [90, 250, 790, 925].map((x, i) => (
                    <g key={x} transform={`translate(${x} ${540 + (i % 2) * 26})`}>
                      <path d="M0 0 V38" stroke="#4f936a" strokeWidth="5" />
                      {[0, 60, 120].map((angle) => (
                        <ellipse
                          key={angle}
                          rx="7"
                          ry="20"
                          transform={`rotate(${angle})`}
                          fill="#ffe9b4"
                        />
                      ))}
                      <circle r="6" fill="#f2b86b" />
                    </g>
                  ))}
          </>
        )}
      </svg>
    </div>
  );
}
