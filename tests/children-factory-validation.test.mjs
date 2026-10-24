import test from 'node:test';
import assert from 'node:assert/strict';
import { validateChildrenFactoryRenderAssets } from '../server/children-factory-validation.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const key = scene => `jarvis/${userId}/children-factory/scene-${scene}.png`;
const missionWithScenes = scenes => ({
  metadata: {
    factory: 'children-v1',
    images: scenes.map(scene => ({
      scene,
      media: { key: key(scene), path: key(scene) },
    })),
  },
});

test('Children Factory render accepts exactly the three mission-bound scene assets', () => {
  assert.deepEqual(validateChildrenFactoryRenderAssets({
    mission: missionWithScenes([1, 2, 3]),
    userId,
    imageKeys: [key(1), key(2), key(3)],
  }), { ok: true });
});

test('Children Factory render rejects a missing scene', () => {
  const result = validateChildrenFactoryRenderAssets({
    mission: missionWithScenes([1, 2]),
    userId,
    imageKeys: [key(1), key(2)],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CHILDREN_FACTORY_SCENE_ASSETS_INCOMPLETE');
});

test('Children Factory render rejects unrelated or substituted user-owned assets', () => {
  const result = validateChildrenFactoryRenderAssets({
    mission: missionWithScenes([1, 2, 3]),
    userId,
    imageKeys: [key(1), key(2), `jarvis/${userId}/other-project/extra.png`],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CHILDREN_FACTORY_SCENE_ASSET_MISMATCH');
});

test('Children Factory render rejects duplicate scene records', () => {
  const result = validateChildrenFactoryRenderAssets({
    mission: missionWithScenes([1, 2, 2, 3]),
    userId,
    imageKeys: [key(1), key(2), key(3)],
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'CHILDREN_FACTORY_SCENE_ASSETS_INCOMPLETE');
});

test('non-Children Factory video projects keep their existing render behavior', () => {
  assert.deepEqual(validateChildrenFactoryRenderAssets({
    mission: { metadata: { factory: 'other' } },
    userId,
    imageKeys: [key(1)],
  }), { ok: true });
});
