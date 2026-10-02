import { useState } from 'react';
import { Link } from 'react-router-dom';
import { animals } from '../config/animals';
import { characterDetails, type Character } from '../characters/catalog';
import { useAdventure } from './adventure';
import { missionAction, moves, type LearningAction } from './lessons';
import { audio } from '../audio/AudioManager';
import { getTVBridge } from '../tv/WebSocketTVBridge';
export function HuntPanel({
  active,
  demonstrate,
  resetScene,
}: {
  active: Character | null;
  demonstrate: (action: LearningAction) => void;
  resetScene: () => void;
}) {
  const { found, missions, finishMission, restart } = useAdventure();
  const [feedback, setFeedback] = useState('');
  const next = animals.find((a) => !found.includes(a.id));
  const task = active ? missionAction[active] : null;
  const speak = (cue: string) => {
    audio.unlockAudio();
    audio.stop();
    const bridge = getTVBridge();
    if (bridge.shouldSpeakOnTV()) bridge.sendEvent('AUDIO_CUE', { cue });
    else audio.say(cue);
  };
  return (
    <section className="hunt-panel" aria-label="Альбом друзей">
      <header>
        <strong>🔎 {found.length} / 8 друзей</strong>
        <span>⭐ {missions.length} / 8 заданий</span>
      </header>
      <div className="hunt-album">
        {animals.map((a) => (
          <div
            key={a.id}
            className={found.includes(a.id) ? 'found' : ''}
            aria-label={`${a.word}: ${found.includes(a.id) ? 'найден' : 'ищем'}`}
          >
            <span>{characterDetails[a.id].icon}</span>
            <small>{a.word}</small>
            <b>{missions.includes(a.id) ? '⭐' : found.includes(a.id) ? '✓' : '?'}</b>
          </div>
        ))}
      </div>
      <p aria-live="polite">
        {found.length === 8
          ? missions.length === 8
            ? '🎉 Все друзья и все 8 звёзд! Молодец!'
            : '🎉 Вся команда найдена! Получи звёзды за задания.'
          : next
            ? `Кто прячется? Найди ${characterDetails[next.id].icon} ${next.word}! Любая карточка подходит.`
            : ''}
      </p>
      {task && active && found.includes(active) && !missions.includes(active) && (
        <div className="hunt-task" key={active}>
          <strong>{characterDetails[active].name}: послушай и выбери действие</strong>
          <button onClick={() => speak(`ask-${task}`)}>🔊 Послушать задание</button>
          <div className="hunt-answers">
            {[
              task,
              ...(['wave', 'sleep', 'happy', 'run'] as LearningAction[])
                .filter((a) => a !== task)
                .slice(0, 2),
            ]
              .sort()
              .map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    if (action === task) {
                      finishMission(active);
                      demonstrate(action);
                      setFeedback(`⭐ ${moves[action].phrase} ${moves[action].ru}`);
                    } else {
                      setFeedback('Послушай ещё раз — получится!');
                      speak('try-again');
                    }
                  }}
                >
                  {moves[action].icon} {moves[action].label}
                </button>
              ))}
          </div>
        </div>
      )}
      <p role="status">{feedback}</p>
      <div className="hunt-tools">
        {next && (
          <button onClick={() => speak(`find-${next.word.toLowerCase()}`)}>🔊 Подсказка</button>
        )}
        <button
          className="hunt-restart"
          onClick={() => {
            restart();
            resetScene();
            setFeedback('Новый поиск! Убери прежнюю карточку и покажи любую снова.');
            speak('hunt-start');
          }}
        >
          🔄 Начать поиск заново
        </button>
        <Link to="/friends">🐾 Поиграть</Link>
      </div>
    </section>
  );
}
