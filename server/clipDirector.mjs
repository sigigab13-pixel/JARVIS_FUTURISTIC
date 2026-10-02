export const CLIP_FORMATS = {
  landscape: '16:9',
  vertical: '9:16',
  square: '1:1',
};

export const CLIP_TYPES = [
  'story highlight',
  'rhyme',
  'educational moment',
  'character moment',
  'lesson recap',
];

function clean(value, max = 5000) {
  return String(value ?? '').trim().slice(0, max);
}

export function buildClipDirectorPrompt({
  masterStory,
  clipType = 'story highlight',
  durationSeconds = 45,
  format = '9:16',
  ageRange = '6-10',
  characters = [],
}) {
  const story = clean(masterStory, 24000);
  if (!story) throw new Error('A master story is required.');

  const duration = Math.min(120, Math.max(15, Number(durationSeconds) || 45));
  const safeFormat = CLIP_FORMATS[format] || CLIP_FORMATS.vertical;
  const safeType = CLIP_TYPES.includes(clipType) ? clipType : CLIP_TYPES[0];
  const safeAge = clean(ageRange, 30) || '6-10';
  const cast = Array.isArray(characters)
    ? characters.slice(0, 8).map((c) => clean(c, 120)).filter(Boolean).join(', ')
    : '';

  return [
    'Create an ORIGINAL short-form children’s video clip plan derived only from the supplied master story.',
    'Do not reproduce copyrighted text, lyrics, or another creator’s distinctive style.',
    'Keep the content age-appropriate, positive, non-graphic, and free of sexual content, hateful content, dangerous instructions, or frightening material inappropriate for children.',
    '',
    `Target age: ${safeAge}`,
    `Clip type: ${safeType}`,
    `Target duration: ${duration} seconds`,
    `Output format: ${safeFormat}`,
    cast ? `Character continuity must preserve these characters: ${cast}` : '',
    '',
    'Return a concise production brief with:',
    '1. Clip title',
    '2. Hook for the first 2-3 seconds',
    '3. Source moment from the master story',
    '4. Short narration/dialogue plan',
    '5. Visual and motion direction',
    '6. Voice/audio direction',
    '7. Continuity notes for characters, world, and props',
    '8. End beat or child-safe call to action',
    '',
    'Master story:',
    story,
  ].filter(Boolean).join('\n');
}

export function normalizeClipPlan(value) {
  const text = clean(value, 12000);
  return {
    title: text.match(/(?:^|\n)\s*(?:1\.|title:)\s*(.+)/i)?.[1]?.trim()?.slice(0, 180) || 'Children’s Short Clip',
    plan: text,
  };
}
