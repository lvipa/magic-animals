import { song as defaultSong, songPhase, type SingMode, type SongDefinition } from './song';
import { activityOptions } from './activities';
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
