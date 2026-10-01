import { useSyncExternalStore } from 'react';
import { characterDetails, type Character } from './catalog';
import {
  characterAssetErrors,
  characterAssetRevision,
  characterLoadStatus,
  loadAuthoredCharacter,
  subscribeCharacterAssets,
} from './authoredCat';

export function ModelLoadStatus({ ids }: { ids: readonly Character[] }) {
  useSyncExternalStore(subscribeCharacterAssets, () => ids.map(characterAssetRevision).join(','));
  const waiting = ids.filter((id) => characterLoadStatus.get(id)?.phase !== 'ready');
  if (!waiting.length) return null;
  const failed = waiting.filter((id) => characterAssetErrors.has(id));
  const id = waiting[0], state = characterLoadStatus.get(id);
  const percent = state?.total ? Math.min(100, Math.floor(state.loaded / state.total * 100)) : null;
  return (
    <div className="model-loading">
      <p role="status">
        {failed.length
          ? 'A friend could not load. Check your connection and try again.'
          : ids.length > 1
            ? `Getting your friends ready… ${ids.length - waiting.length}/${ids.length}`
            : state?.phase === 'decoding'
              ? `Adding ${characterDetails[id].name}'s last details…`
              : `Loading ${characterDetails[id].name}…${percent === null ? '' : ` ${percent}%`}`}
      </p>
      {!failed.length && <progress aria-label="Character loading" value={percent ?? undefined} max={100} />}
      {failed.length > 0 && (
        <button onClick={() => failed.forEach((friend) => void loadAuthoredCharacter(friend))}>
          Try again
        </button>
      )}
    </div>
  );
}
