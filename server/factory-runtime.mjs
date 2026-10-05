function text(value, max = 4000) {
  return String(value || '').trim().slice(0, max);
}

export function buildChildrenFactoryImageSteps({ story, character, count = 3 } = {}) {
  const safeStory = text(story, 5000);
  const safeCharacter = character && typeof character === 'object' ? character : {};
  const characterPrompt = [
    'Create a child-friendly storybook illustration.',
    'Keep this exact character consistent in every image:',
    'Name: ' + text(safeCharacter.name, 120),
    'Species: ' + text(safeCharacter.species, 120),
    'Color: ' + text(safeCharacter.color, 120),
    'Clothes: ' + text(safeCharacter.clothes, 300),
    'Description: ' + text(safeCharacter.description, 1000),
    'Style: warm, colorful, friendly, simple storybook art.',
    'No text, no watermark.',
  ].join(' ');

  return Array.from({ length: Math.min(6, Math.max(1, Number(count) || 3)) }, (_, offset) => {
    const scene = offset + 1;
    return {
      id: 'factory-image-' + scene,
      title: 'Generate Children Factory scene ' + scene,
      capability: 'image',
      executorType: 'image_generation',
      sideEffect: true,
      priority: 70,
      maxAttempts: 3,
      prompt: (characterPrompt + ' Illustration ' + scene + ' should depict a different moment from this story: ' + safeStory).slice(0, 4000),
      input: { factory: 'children-v1', scene },
    };
  });
}

export function appendChildrenFactoryImage(metadata, scene, result) {
  const base = metadata && typeof metadata === 'object' ? metadata : {};
  const existing = Array.isArray(base.images) ? base.images.filter(Boolean) : [];
  const normalizedScene = Math.max(1, Number(scene) || 1);
  const nextItem = {
    scene: normalizedScene,
    sha256: text(result?.sha256, 128),
    media: result?.media && typeof result.media === 'object' ? result.media : null,
  };
  const images = [...existing.filter(item => Number(item?.scene) !== normalizedScene), nextItem]
    .sort((a, b) => Number(a.scene) - Number(b.scene));
  return {
    ...base,
    images,
    factoryBuild: {
      status: 'running',
      completedScenes: images.length,
      totalScenes: Number(base?.factoryBuild?.totalScenes || 3),
    },
  };
}

export function markChildrenFactoryBuildComplete(metadata) {
  const base = metadata && typeof metadata === 'object' ? metadata : {};
  const total = Number(base?.factoryBuild?.totalScenes || (Array.isArray(base.images) ? base.images.length : 0));
  return {
    ...base,
    factoryBuild: {
      ...(base.factoryBuild || {}),
      status: 'completed',
      completedScenes: Array.isArray(base.images) ? base.images.length : 0,
      totalScenes: total,
    },
  };
}
