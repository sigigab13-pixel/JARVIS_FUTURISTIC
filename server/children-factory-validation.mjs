export function validateChildrenFactoryRenderAssets({ mission, userId, imageKeys } = {}) {
  if (mission?.metadata?.factory !== 'children-v1') return { ok: true };

  const ownerPrefix = `jarvis/${String(userId || '').trim()}/`;
  const images = Array.isArray(mission.metadata?.images) ? mission.metadata.images : [];
  const byScene = new Map();

  for (const image of images) {
    const scene = Number(image?.scene);
    const key = String(image?.media?.key || image?.media?.path || '').trim();
    if (!Number.isInteger(scene) || scene < 1 || scene > 3 || !key || byScene.has(scene)) {
      return {
        ok: false,
        code: 'CHILDREN_FACTORY_SCENE_ASSETS_INCOMPLETE',
        message: 'Children Factory rendering requires exactly one stored asset for each of scenes 1, 2, and 3.',
      };
    }
    byScene.set(scene, key);
  }

  if (byScene.size !== 3 || [1, 2, 3].some(scene => !byScene.has(scene))) {
    return {
      ok: false,
      code: 'CHILDREN_FACTORY_SCENE_ASSETS_INCOMPLETE',
      message: 'Children Factory rendering requires all three stored scene assets before rendering.',
    };
  }

  const expectedKeys = [1, 2, 3].map(scene => byScene.get(scene));
  if (expectedKeys.some(key => !key.startsWith(ownerPrefix))) {
    return {
      ok: false,
      code: 'CHILDREN_FACTORY_SCENE_ASSET_OWNERSHIP',
      message: 'A recorded Children Factory scene asset does not belong to this JARVIS user.',
    };
  }

  const supplied = Array.isArray(imageKeys) ? imageKeys.map(value => String(value || '').trim()) : [];
  if (supplied.length !== 3 || new Set(supplied).size !== 3
    || expectedKeys.some(key => !supplied.includes(key))) {
    return {
      ok: false,
      code: 'CHILDREN_FACTORY_SCENE_ASSET_MISMATCH',
      message: 'Children Factory rendering must use exactly the three scene assets recorded on this mission.',
    };
  }

  return { ok: true };
}
