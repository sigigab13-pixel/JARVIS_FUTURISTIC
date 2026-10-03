export function buildSceneDirectorPrompt({
  masterStory,
  title = 'Untitled Story',
  ageRange = '6-10',
  characters = [],
  sceneCount = 6,
}) {
  const story = String(masterStory ?? '').trim().slice(0, 30000);
  if (!story) throw new Error('Master story is required.');

  const count = Math.max(2, Math.min(20, Number(sceneCount) || 6));
  const safeCharacters = Array.isArray(characters)
    ? characters.slice(0, 8).map(x => String(x).trim()).filter(Boolean)
    : [];

  return [
    'Create an original, child-safe scene-by-scene production plan from the supplied master story.',
    'Do not reproduce copyrighted text or imitate a living creator.',
    'Avoid graphic violence, sexual content, hateful content, dangerous instructions, and inappropriate frightening material.',
    'Preserve the same character identities, appearances, personalities, relationships, locations, props, and visual rules across scenes.',
    'Return JSON with: scenes[].sceneNumber, title, purpose, characters, setting, action, dialogue, visualPlan, cameraPlan, audioPlan, continuityNotes, lipSyncPlan.',
    '',
    `Title: ${String(title).slice(0, 180)}`,
    `Age range: ${String(ageRange).slice(0, 30)}`,
    `Characters: ${safeCharacters.join(', ') || 'Create only what the story requires.'}`,
    `Target scene count: ${count}`,
    '',
    'MASTER STORY:',
    story,
  ].join('\n');
}

export function normalizeScenePlan(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch {
      return { scenes: [], raw: value.slice(0, 30000) };
    }
  }

  const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.slice(0, 20) : [];
  return {
    scenes: scenes.map((scene, index) => ({
      sceneNumber: index + 1,
      title: String(scene?.title ?? `Scene ${index + 1}`).slice(0, 180),
      purpose: String(scene?.purpose ?? '').slice(0, 800),
      characters: Array.isArray(scene?.characters) ? scene.characters.slice(0, 8).map(String) : [],
      setting: String(scene?.setting ?? '').slice(0, 1000),
      action: String(scene?.action ?? '').slice(0, 3000),
      dialogue: String(scene?.dialogue ?? '').slice(0, 5000),
      visualPlan: String(scene?.visualPlan ?? '').slice(0, 2000),
      cameraPlan: String(scene?.cameraPlan ?? '').slice(0, 1500),
      audioPlan: String(scene?.audioPlan ?? '').slice(0, 1500),
      continuityNotes: String(scene?.continuityNotes ?? '').slice(0, 1500),
      lipSyncPlan: scene?.lipSyncPlan && typeof scene.lipSyncPlan === 'object'
        ? scene.lipSyncPlan
        : { enabled: true, status: 'planned' },
    })),
  };
}
