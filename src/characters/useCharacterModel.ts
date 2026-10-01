import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  characterAssetRevision,
  characterLoadStatus,
  loadAuthoredCharacter,
  subscribeCharacterAssets,
} from './authoredCat';
import { disposeCharacter, makeCharacter, type Character } from './models';

export function useCharacterModel(kind: Character, priority = true) {
  useSyncExternalStore(subscribeCharacterAssets, () =>
    characterAssetRevision(kind),
  );
  useEffect(() => {
    void loadAuthoredCharacter(kind, priority);
  }, [kind, priority]);
  // Progress notifications repaint the status, not the whole skinned model.
  const ready = characterLoadStatus.get(kind)?.phase === 'ready';
  const model = useMemo(() => {
    const instance = makeCharacter(kind);
    instance.userData.assetRevision = Number(ready);
    return instance;
  }, [kind, ready]);
  useEffect(() => () => disposeCharacter(model), [model]);
  return model;
}
