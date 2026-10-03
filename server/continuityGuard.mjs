export function checkCharacterContinuity({ scenes = [], characters = [] }) {
  const bible = Array.isArray(characters) ? characters : [];
  const known = new Map(bible.map(c => [String(c?.name || '').trim().toLowerCase(), c]));
  const issues = [];
  const checkedScenes = Array.isArray(scenes) ? scenes : [];

  checkedScenes.forEach((scene, index) => {
    const names = Array.isArray(scene?.characters) ? scene.characters : [];
    names.forEach(name => {
      const key = String(name).trim().toLowerCase();
      if (key && !known.has(key)) {
        issues.push({ sceneNumber: scene?.sceneNumber || index + 1, character: String(name), issue: 'Character is not present in the Character Bible.' });
      }
    });

    const notes = String(scene?.continuityNotes || '').toLowerCase();
    if (notes.includes('inconsistent') || notes.includes('continuity issue') || notes.includes('mismatch')) {
      issues.push({ sceneNumber: scene?.sceneNumber || index + 1, issue: 'Scene Director flagged a possible continuity concern.', details: String(scene.continuityNotes).slice(0, 500) });
    }
  });

  return {
    status: issues.length ? 'needs_review' : 'planned_ok',
    checkedScenes: checkedScenes.length,
    checkedCharacters: bible.length,
    issues: issues.slice(0, 50),
    note: 'Text-level continuity check only; this does not verify rendered visual identity.',
  };
}
