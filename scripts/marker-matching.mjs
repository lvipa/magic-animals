import { decode, encode } from '@msgpack/msgpack';
import { build } from '../node_modules/mind-ar/src/image-target/matching/hierarchical-clustering.js';

/** Shared frames/text/hoodies are decoration, not unique identification.
 * Keep the full card coordinate system and tracking data, but initialize a
 * match using only its two independently seeded confetti fields.
 * MindAR 1.2.5's public .mind format is version 2; fail on a format change.
 */
export function uniqueCardMatching(buffer) {
  const compiled = decode(new Uint8Array(buffer));
  if (compiled.v !== 2 || compiled.dataList.length !== 8)
    throw Error('Unexpected MindAR schema/roster');
  for (const [index, target] of compiled.dataList.entries()) {
    target.matchingData = target.matchingData
      .map((frame) => {
        const unique = (point) => {
          const x = point.x / frame.scale,
            y = point.y / frame.scale;
          return y > 100 && y < 615 && ((x > 90 && x < 290) || (x > 810 && x < 1010));
        };
        for (const prefix of ['maxima', 'minima']) {
          frame[`${prefix}Points`] = frame[`${prefix}Points`].filter(unique);
          frame[`${prefix}PointsCluster`] = build({ points: frame[`${prefix}Points`] });
        }
        return frame;
      })
      .filter((frame) => frame.maximaPoints.length + frame.minimaPoints.length >= 20);
    if (target.matchingData.length < 3)
      throw Error(`Card ${index}: insufficient unique matching scales`);
    console.log(
      'UNIQUE MATCHING',
      index,
      target.matchingData.map((f) => f.maximaPoints.length + f.minimaPoints.length),
    );
  }
  return Buffer.from(encode(compiled));
}
