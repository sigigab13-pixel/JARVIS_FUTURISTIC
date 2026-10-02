const DEFAULT_AGE_RANGE = '6-10';
const DEFAULT_TONE = 'warm, playful, age-appropriate, and encouraging';

export const CHILDREN_GENRES = [
  'rhymes',
  'bedtime story',
  'adventure',
  'educational story',
  'moral story',
  'science story',
];

export function buildChildrenStoryPrompt({
  idea,
  genre = 'bedtime story',
  ageRange = DEFAULT_AGE_RANGE,
  lesson = '',
  length = 'short',
  characters = [],
} = {}) {
  const cleanIdea = String(idea || '').trim();
  if (!cleanIdea) throw new Error('A story idea is required.');

  const safeGenre = CHILDREN_GENRES.includes(String(genre)) ? String(genre) : 'bedtime story';
  const safeAgeRange = String(ageRange || DEFAULT_AGE_RANGE).trim().slice(0, 40);
  const safeLesson = String(lesson || '').trim().slice(0, 500);
  const safeLength = ['short', 'medium', 'long'].includes(String(length))
    ? String(length)
    : 'short';
  const safeCharacters = Array.isArray(characters)
    ? characters
        .map(character => ({
          name: String(character?.name || '').trim().slice(0, 60),
          role: String(character?.role || '').trim().slice(0, 120),
        }))
        .filter(character => character.name)
        .slice(0, 8)
    : [];

  return [
    'You are JARVIS Children\'s Creative Director.',
    'Create original children\'s content that is safe, kind, imaginative, and suitable for the requested age range.',
    'Do not imitate a living author or reproduce copyrighted text, songs, characters, or stories.',
    'Avoid graphic violence, sexual content, dangerous instructions, hateful content, and frightening material that is inappropriate for children.',
    'Use simple, natural language and positive problem-solving.',
    '',
    `Genre: ${safeGenre}`,
    `Age range: ${safeAgeRange}`,
    `Length: ${safeLength}`,
    `Tone: ${DEFAULT_TONE}`,
    `Story idea: ${cleanIdea.slice(0, 2000)}`,
    safeLesson ? `Learning or moral goal: ${safeLesson}` : 'Learning or moral goal: choose a gentle, useful takeaway.',
    safeCharacters.length
      ? `Characters: ${safeCharacters.map(character => `${character.name} (${character.role || 'main character'})`).join(', ')}`
      : 'Characters: create a small cast with distinct, child-friendly personalities.',
    '',
    'Return:',
    '1. Title',
    '2. Character list',
    '3. Story in clear sections or verses',
    '4. One-sentence lesson',
    '5. Optional next-episode idea',
  ].join('\n');
}

export function normalizeChildrenStory(value) {
  const text = String(value || '').trim();
  if (!text) throw new Error('The children content response was empty.');

  return {
    title: extractSection(text, 'Title') || 'Untitled JARVIS Story',
    content: text.slice(0, 30000),
  };
}

function extractSection(text, heading) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:#+\\s*)?${heading}\\s*[:\\-]\\s*(.+)`, 'i');
  return text.match(pattern)?.[1]?.trim() || '';
}
