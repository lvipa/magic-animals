import { CAT_MODEL_URL } from './catAsset';
import { CAST_MODEL_URLS } from './castAssets';
import type { Character } from './catalog';

// Keep configuration and menus independent of Three.js and the GLB loader.
export const characterModelUrl = (id: Character) =>
  id === 'cat' ? CAT_MODEL_URL : CAST_MODEL_URLS[id];
