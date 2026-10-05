function requiredText(value, field, maxLength = 500) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw Object.assign(new Error(field + ' is required.'), { statusCode: 400 });
  }
  if (normalized.length > maxLength) {
    throw Object.assign(new Error(field + ' is too long.'), { statusCode: 400 });
  }
  return normalized;
}

function safeFilename(value) {
  return String(value || 'jarvis-book')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'jarvis-book';
}

function asChapter(value, index) {
  if (typeof value === 'string') {
    return { title: 'Chapter ' + (index + 1), body: value.trim() };
  }

  return {
    title: String(value?.title || 'Chapter ' + (index + 1)).trim(),
    body: String(value?.body || '').trim(),
  };
}

export function buildKdpExport({
  title,
  subtitle = '',
  author = 'JARVIS Futuristic',
  description = '',
  story = '',
  chapters = [],
  ageRange = [3, 12],
  keywords = [],
} = {}) {
  const normalizedTitle = requiredText(title, 'title', 200);
  const normalizedAuthor = requiredText(author, 'author', 200);
  const normalizedStory = String(story || '').trim();
  const normalizedChapters = Array.isArray(chapters)
    ? chapters.slice(0, 50).map(asChapter).filter(chapter => chapter.body)
    : [];

  if (!normalizedStory && !normalizedChapters.length) {
    throw Object.assign(new Error('story or chapters are required.'), { statusCode: 400 });
  }

  const normalizedKeywords = Array.isArray(keywords)
    ? keywords.map(value => String(value || '').trim()).filter(Boolean).slice(0, 10)
    : [];

  const manuscriptParts = [
    normalizedTitle,
    subtitle ? String(subtitle).trim() : '',
    'By ' + normalizedAuthor,
    '',
    normalizedStory,
    ...normalizedChapters.flatMap(chapter => ['', chapter.title, '', chapter.body]),
  ].filter(Boolean);

  return {
    exportVersion: 'kdp-manuscript-v1',
    status: 'export_ready',
    title: normalizedTitle,
    subtitle: String(subtitle || '').trim(),
    author: normalizedAuthor,
    description: String(description || '').trim(),
    ageRange: Array.isArray(ageRange) && ageRange.length === 2 ? ageRange : [3, 12],
    keywords: normalizedKeywords,
    suggestedFilename: safeFilename(normalizedTitle) + '-kdp-manuscript.txt',
    manuscript: manuscriptParts.join('\n'),
    note: 'This prepares manuscript content only. It does not upload, publish, or submit anything to Amazon KDP.',
  };
}
