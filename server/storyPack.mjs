export const PRODUCTION_TYPES = [
  'full episode',
  'short clip',
  'rhyme',
  'educational clip',
  'story pack',
];

export const OUTPUT_FORMATS = ['16:9', '9:16', '1:1'];

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

export function buildStoryPack({
  title = '',
  story = '',
  genre = 'bedtime story',
  ageRange = '6-10',
  characters = [],
  scenes = [],
  productionTypes = ['full episode', 'short clip', 'rhyme', 'educational clip'],
}) {
  const safeCharacters = Array.isArray(characters)
    ? characters.slice(0, 8).map((c) => clean(c, 160)).filter(Boolean)
    : [];

  const safeScenes = Array.isArray(scenes)
    ? scenes.slice(0, 30).map((s, index) => ({
        sceneNumber: index + 1,
        title: clean(s?.title, 160),
        description: clean(s?.description, 1000),
      }))
    : [];

  const safeTypes = Array.isArray(productionTypes)
    ? productionTypes.filter((x) => PRODUCTION_TYPES.includes(x))
    : [];

  return {
    version: 1,
    title: clean(title, 180) || 'Untitled Children Story',
    genre: clean(genre, 80) || 'bedtime story',
    ageRange: clean(ageRange, 30) || '6-10',
    masterStory: clean(story, 30000),
    characterBible: safeCharacters.map((name) => ({
      name,
      identityStatus: 'planned',
    })),
    scenes: safeScenes,
    productionTypes: safeTypes,
    outputs: {
      fullEpisode: { status: 'planned', format: '16:9' },
      shortClips: { status: 'planned', format: '9:16' },
      rhyme: { status: 'planned', format: '9:16' },
      educationalClip: { status: 'planned', format: '9:16' },
      thumbnail: { status: 'planned', format: '1:1' },
    },
    qa: {
      status: 'pending',
      checks: [
        'age appropriateness',
        'character continuity',
        'world and prop continuity',
        'audio and dialogue review',
        'format readiness',
        'copyright originality review',
      ],
    },
    render: { status: 'not_started' },
    publish: { status: 'not_started' },
  };
}

export function validateStoryPack(pack) {
  const errors = [];
  if (!pack?.masterStory) errors.push('Master story is missing.');
  if (!pack?.title) errors.push('Title is missing.');
  if (!Array.isArray(pack?.characterBible)) errors.push('Character Bible is invalid.');
  if (!Array.isArray(pack?.scenes)) errors.push('Scene plan is invalid.');
  return { valid: errors.length === 0, errors };
}
