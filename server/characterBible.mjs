const MAX_CHARS = 8;

export function buildCharacterBiblePrompt({
  title = 'Untitled Story',
  masterStory,
  characters = [],
  ageRange = '6-10',
}) {
  const story = String(masterStory ?? '').trim().slice(0, 30000);
  if (!story) throw new Error('Master story is required.');
  const names = Array.isArray(characters)
    ? characters.slice(0, MAX_CHARS).map(x => String(x).trim()).filter(Boolean)
    : [];

  return [
    'Create an original, child-safe Character Bible for a children\'s production.',
    'Use stable identity details so the same character can be planned consistently across episodes, scenes, clips, rhymes, and educational videos.',
    'Do not imitate a living person, creator, or copyrighted character.',
    'Avoid sexualized descriptions, graphic violence, hateful content, dangerous instructions, or inappropriate frightening material.',
    'Return JSON with characters[].id, name, role, ageRange, personality, appearance, clothing, accessories, voiceDirection, movementCues, expressions, relationships, recurringProps, identityLock, safetyNotes.',
    '',
    `Title: ${String(title).slice(0, 180)}`,
    `Audience age range: ${String(ageRange).slice(0, 30)}`,
    `Requested characters: ${names.join(', ') || 'Infer only the characters needed by the story.'}`,
    '',
    'MASTER STORY:',
    story,
  ].join('\\n');
}

export function normalizeCharacterBible(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch {
      return { characters: [], raw: value.slice(0, 30000) };
    }
  }
  const characters = Array.isArray(parsed?.characters) ? parsed.characters.slice(0, MAX_CHARS) : [];
  return {
    characters: characters.map((c, index) => ({
      id: String(c?.id || `char-${index + 1}`).slice(0, 80),
      name: String(c?.name || `Character ${index + 1}`).slice(0, 120),
      role: String(c?.role || 'supporting character').slice(0, 240),
      ageRange: String(c?.ageRange || '').slice(0, 60),
      personality: String(c?.personality || '').slice(0, 1000),
      appearance: String(c?.appearance || '').slice(0, 1800),
      clothing: String(c?.clothing || '').slice(0, 1200),
      accessories: String(c?.accessories || '').slice(0, 800),
      voiceDirection: String(c?.voiceDirection || '').slice(0, 800),
      movementCues: String(c?.movementCues || '').slice(0, 800),
      expressions: String(c?.expressions || '').slice(0, 800),
      relationships: String(c?.relationships || '').slice(0, 1200),
      recurringProps: Array.isArray(c?.recurringProps) ? c.recurringProps.slice(0, 8).map(x => String(x).slice(0, 160)) : [],
      identityLock: String(c?.identityLock || 'Keep core identity, appearance, personality, and recurring props consistent.').slice(0, 1200),
      safetyNotes: String(c?.safetyNotes || 'Keep the character child-safe and age-appropriate.').slice(0, 800),
      status: 'planned',
    })),
  };
}
