import { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  characterAssetRevision,
  loadAuthoredCharacter,
  subscribeCharacterAssets,
} from './authoredCat';
import { disposeCharacter, makeCharacter, type Character } from './models';

export function useCharacterModel(kind: Character) {
  const revision = useSyncExternalStore(subscribeCharacterAssets, () =>
    characterAssetRevision(kind),
  );
  useEffect(() => {
    void loadAuthoredCharacter(kind);
  }, [kind]);
  const model = useMemo(() => {
    const instance = makeCharacter(kind);
    instance.userData.assetRevision = revision;
    return instance;
  }, [kind, revision]);
  useEffect(() => () => disposeCharacter(model), [model]);
  return model;
}
