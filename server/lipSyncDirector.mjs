const MAX_SCENES = 20;
function clean(value, max = 1200) { return String(value ?? '').trim().slice(0, max); }
export function buildLipSyncPrompt({ title = 'Untitled Story', scenes = [], characters = [], ageRange = '6-10' } = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('Scenes are required.');
  const safeScenes = scenes.slice(0, MAX_SCENES).map((scene, index) => ({ sceneNumber: scene?.sceneNumber ?? index + 1, dialogue: clean(scene?.dialogue, 1600), characters: Array.isArray(scene?.characters) ? scene.characters.slice(0, 8) : [], lipSyncPlan: scene?.lipSyncPlan || null }));
  return [
    `Create a structured lip-sync planning sheet for the original children's production "${clean(title, 200)}" for ages ${clean(ageRange, 40)}.`,
    'Return JSON only: {"scenes":[{"sceneNumber":1,"segments":[{"speaker":"Character","text":"dialogue","timingEstimateSeconds":4,"mouthIntensity":"medium","expression":"warm","pauseAfterSeconds":0.5}],"notes":"..."}]}',
    'Rules: planning only; never claim lip-sync has been generated or rendered; preserve supplied dialogue; no copyrighted lyrics or real-person performance imitation; scenes without dialogue get empty segments; timing estimates must be non-negative.',
    `Characters: __CHARACTERS__`,
    `Scenes: __SCENES__`
  ].join('\n');
}
export function normalizeLipSyncPlan(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.slice(0, MAX_SCENES) : [];
  return { status: 'planned', scenes: scenes.map((scene, index) => ({
    sceneNumber: scene?.sceneNumber ?? index + 1,
    segments: Array.isArray(scene?.segments) ? scene.segments.slice(0, 40).map(segment => ({
      speaker: clean(segment?.speaker, 120), text: clean(segment?.text, 1000),
      timingEstimateSeconds: Math.max(0, Number(segment?.timingEstimateSeconds) || 0),
      mouthIntensity: clean(segment?.mouthIntensity, 40) || 'medium',
      expression: clean(segment?.expression, 120),
      pauseAfterSeconds: Math.max(0, Number(segment?.pauseAfterSeconds) || 0),
    })) : [], notes: clean(scene?.notes, 800),
  })) };
}
