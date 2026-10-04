import type { SongDefinition } from './song';
import { activityOptions } from './activities';
export function MusicActivity({
  song,
  choice,
  onChoose,
}: {
  song: SongDefinition;
  choice: number;
  onChoose: (index: number) => void;
}) {
  const options = activityOptions(song);
  if (!options.length) return null;
  return (
    <section className="music-activity" aria-label="Играй с песенкой">
      <p>
        {song.activity === 'farm'
          ? 'Кто споёт следующий куплет?'
          : song.activity === 'body'
            ? 'Покажи вместе с Poppy!'
            : song.activity === 'bus'
              ? 'Ты водитель! Нажми на картинку.'
              : song.activity === 'spider'
                ? 'Помоги паучку: дождик, солнышко и снова вверх!'
                : 'Повторяй и нажимай!'}
      </p>
      <div>
        {options.map((option, index) => (
          <button key={option.word} aria-pressed={choice === index} onClick={() => onChoose(index)}>
            <span aria-hidden="true">{option.icon}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
      <strong className="music-action-word" lang="en">
        {options[choice]?.word}
        {options[choice] && 'sound' in options[choice] ? ' · ' + options[choice].sound : ''}
      </strong>
    </section>
  );
}
