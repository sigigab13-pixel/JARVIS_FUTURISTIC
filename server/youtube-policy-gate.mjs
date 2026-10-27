/**
 * Conservative, deterministic preflight checks for JARVIS YouTube uploads.
 *
 * This is a risk screen, not a legal opinion and not a guarantee against
 * platform enforcement. It deliberately fails closed when required review
 * attestations are missing.
 */

export const YOUTUBE_POLICY_GATE_VERSION = 'youtube-policy-gate-v1';

const CHILD_BLOCK_RULES = [
  {
    code: 'CHILD_AGE_INAPPROPRIATE_SEXUAL_CONTENT',
    pattern: /\b(?:sexual(?:ized|ly)?|pornograph(?:y|ic)|erotic content)\b/i,
    message: 'Potentially age-inappropriate sexual material was detected. Remove it and review the complete script and visuals.',
  },
  {
    code: 'CHILD_DANGEROUS_CHALLENGE',
    pattern: /\b(?:try (?:this|it) at home|do (?:this|it) at home|dangerous challenge|hold your breath until|play with fire|mix (?:bleach|cleaning chemicals)|climb onto the roof|jump off (?:a |the )(?:roof|bridge|cliff))\b/i,
    message: 'Potentially imitable dangerous activity was detected. Remove the risky instruction or rewrite it as a clear, safe lesson.',
  },
  {
    code: 'CHILD_HARM_INSTRUCTION',
    pattern: /\b(?:how to|step[- ]by[- ]step|instructions to|dare someone to)\b.{0,80}\b(?:self[- ]harm|suicide|seriously injure yourself)\b/i,
    message: 'Potentially harmful instructions were detected. Do not render or publish this draft; rewrite it safely.',
  },
  {
    code: 'CHILD_GRAPHIC_VIOLENCE',
    pattern: /\b(?:graphic violence|graphic injury|gore|torture|dismemberment)\b/i,
    message: 'Potentially graphic violence was detected for a child-directed story. Rewrite the draft for the selected age group.',
  },
  {
    code: 'ENGAGEMENT_MANIPULATION',
    pattern: /\b(?:sub\s*4\s*sub|sub\s*for\s*sub|buy\s+(?:views|likes|subscribers|comments)|subscribe\s+to\s+win\s+(?:money|a prize|a gift)|guaranteed\s+(?:viral|views|subscribers))\b/i,
    message: 'Potentially manipulative engagement or promotion language was detected. Remove it and keep metadata accurate.',
  },
];

const THIRD_PARTY_IP_RULES = [
  /\bpeppa\s+pig\b/i,
  /\bpaw\s+patrol\b/i,
  /\bmickey\s+mouse\b/i,
  /\bminnie\s+mouse\b/i,
  /\bbluey\b/i,
  /\bdisney\b/i,
  /\bmarvel\b/i,
  /\bdc\s+comics\b/i,
  /\bspider[- ]?man\b/i,
  /\bbatman\b/i,
  /\bsuperman\b/i,
  /\bbarbie\b/i,
  /\bsonic\s+the\s+hedgehog\b/i,
  /\bpok[eé]mon\b/i,
  /\bsuper\s+mario\b/i,
  /\bharry\s+potter\b/i,
  /\bminions?\b/i,
  /\bthe\s+grinch\b/i,
];

const REQUIRED_REVIEW_ATTESTATIONS = [
  ['rightsConfirmed', 'I own or have permission to use every visual, voice, song, sound, font, and other third-party element.'],
  ['originalityConfirmed', 'This video adds original value and is not a copied, minimally changed, or near-duplicate mass-produced upload.'],
  ['visualsReviewed', 'I inspected the rendered video scene by scene for visual safety, age suitability, misleading imagery, and unexpected content.'],
  ['audioReviewed', 'I listened to the complete video audio for unsafe language, unexpected sounds, music/voice problems, and rights concerns.'],
  ['safetyReviewed', 'I reviewed the complete rendered video for child safety, harmful or dangerous material, privacy, and age suitability.'],
  ['metadataReviewed', 'The title, description, and tags are accurate, relevant, and not deceptive or engagement-manipulating.'],
  ['audienceReviewed', 'I checked that the audience setting accurately reflects who this video is made for.'],
  ['aiDisclosureReviewed', 'I reviewed YouTube’s altered/synthetic-content disclosure rules and selected the correct disclosure below.'],
];

function collectText({ topic = '', title = '', story = '', description = '', tags = [], character = {} } = {}) {
  const characterText = character && typeof character === 'object' && !Array.isArray(character)
    ? Object.values(character).map(value => String(value ?? '')).join(' ')
    : String(character ?? '');
  const tagText = Array.isArray(tags) ? tags.map(value => String(value ?? '')).join(' ') : '';
  return [topic, title, story, description, characterText, tagText]
    .map(value => String(value ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

export function evaluateChildrenFactoryPreflight({ topic = '', title = '', story = '', character = {}, age = 5, description = '', tags = [] } = {}) {
  const text = collectText({ topic, title, story, character, description, tags });
  const blockingFindings = [];
  const reviewFindings = [];
  const seen = new Set();

  for (const rule of CHILD_BLOCK_RULES) {
    if (rule.pattern.test(text) && !seen.has(rule.code)) {
      seen.add(rule.code);
      blockingFindings.push({ code: rule.code, severity: 'block', message: rule.message });
    }
  }

  if (!Number.isInteger(Number(age)) || Number(age) < 3 || Number(age) > 12) {
    blockingFindings.push({
      code: 'CHILD_TARGET_AGE_INVALID',
      severity: 'block',
      message: 'Children Factory requires a declared target age from 3 through 12.',
    });
  }

  if (THIRD_PARTY_IP_RULES.some(pattern => pattern.test(text))) {
    reviewFindings.push({
      code: 'POSSIBLE_THIRD_PARTY_IP',
      severity: 'review',
      message: 'A known third-party character or brand name may be present. Replace it with original material, or confirm documented rights before publishing.',
    });
  }

  if (/\b(?:phone number|home address|email address|school name|live location)\b/i.test(text)) {
    reviewFindings.push({
      code: 'MINOR_PRIVACY_REVIEW',
      severity: 'review',
      message: 'The draft mentions a personal-information category. Confirm it does not expose or solicit a real child’s private information.',
    });
  }

  const status = blockingFindings.length
    ? 'blocked'
    : reviewFindings.length
      ? 'review_required'
      : 'preflight_passed';

  return {
    version: YOUTUBE_POLICY_GATE_VERSION,
    status,
    checkedAt: new Date().toISOString(),
    blockingFindings,
    reviewFindings,
    note: 'Automated preflight detects only some risks. It cannot determine every policy, copyright, or legal issue.',
  };
}

export function evaluateYouTubePublishGate({
  title = '',
  description = '',
  tags = [],
  isChildrenFactory = false,
  story = '',
  topic = '',
  character = {},
  age = 5,
  madeForKids,
  containsSyntheticMedia,
  privacyStatus = 'private',
  policyReview = {},
} = {}) {
  const blockingFindings = [];
  const reviewFindings = [];
  const missingAttestations = [];
  const normalizedTitle = String(title ?? '').trim();
  const normalizedDescription = String(description ?? '').trim();
  const normalizedTags = Array.isArray(tags) ? tags.map(value => String(value ?? '').trim()).filter(Boolean) : [];

  if (!normalizedTitle) {
    blockingFindings.push({ code: 'YOUTUBE_TITLE_REQUIRED', severity: 'block', message: 'A truthful, non-empty title is required.' });
  } else if (normalizedTitle.length > 100) {
    blockingFindings.push({ code: 'YOUTUBE_TITLE_TOO_LONG', severity: 'block', message: 'YouTube titles must not exceed 100 characters.' });
  }

  if (BufferSafeLength(normalizedDescription) > 5000) {
    blockingFindings.push({ code: 'YOUTUBE_DESCRIPTION_TOO_LONG', severity: 'block', message: 'The description must not exceed 5,000 UTF-8 bytes.' });
  }

  const metadataText = [normalizedTitle, normalizedDescription, normalizedTags.join(' ')].join('\n');
  for (const rule of CHILD_BLOCK_RULES.filter(item => item.code === 'ENGAGEMENT_MANIPULATION')) {
    if (rule.pattern.test(metadataText)) {
      blockingFindings.push({ code: rule.code, severity: 'block', message: rule.message });
    }
  }

  if (typeof madeForKids !== 'boolean') {
    blockingFindings.push({
      code: 'YOUTUBE_AUDIENCE_SELECTION_REQUIRED',
      severity: 'block',
      message: 'Select the accurate Made for Kids audience setting before uploading.',
    });
  } else if (isChildrenFactory && madeForKids !== true) {
    blockingFindings.push({
      code: 'CHILDREN_FACTORY_MUST_BE_MADE_FOR_KIDS',
      severity: 'block',
      message: 'Children Factory stories are directed at children, so this upload must be designated Made for Kids.',
    });
  }

  if (typeof containsSyntheticMedia !== 'boolean') {
    blockingFindings.push({
      code: 'YOUTUBE_AI_DISCLOSURE_SELECTION_REQUIRED',
      severity: 'block',
      message: 'Choose whether this video contains realistic altered/synthetic content or AI-generated music that requires disclosure.',
    });
  }

  if (isChildrenFactory && privacyStatus !== 'private') {
    blockingFindings.push({
      code: 'CHILDREN_FACTORY_PRIVATE_FIRST_REQUIRED',
      severity: 'block',
      message: 'Children Factory videos must upload as private first. Review the processed video in YouTube Studio before manually making it public.',
    });
  }

  if (isChildrenFactory) {
    const childScreen = evaluateChildrenFactoryPreflight({ topic, title: normalizedTitle, story, character, age, description: normalizedDescription, tags: normalizedTags });
    blockingFindings.push(...childScreen.blockingFindings);
    if (childScreen.reviewFindings.length) {
      blockingFindings.push({
        code: 'CHILDREN_FACTORY_REVIEW_FINDINGS_NOT_RESOLVED',
        severity: 'block',
        message: 'The child-directed video still has unresolved third-party-IP or privacy review findings. Resolve those concerns before upload.',
      });
    }
    reviewFindings.push(...childScreen.reviewFindings);
  }

  for (const [key, label] of REQUIRED_REVIEW_ATTESTATIONS) {
    if (policyReview?.[key] !== true) missingAttestations.push({ key, label });
  }

  if (missingAttestations.length) {
    reviewFindings.push({
      code: 'HUMAN_POLICY_REVIEW_INCOMPLETE',
      severity: 'review',
      message: 'Complete all review confirmations before JARVIS uploads the video.',
    });
  }

  const ready = blockingFindings.length === 0 && missingAttestations.length === 0;
  return {
    version: YOUTUBE_POLICY_GATE_VERSION,
    status: blockingFindings.length
      ? 'blocked'
      : missingAttestations.length
        ? 'review_required'
        : reviewFindings.length
          ? 'ready_with_warnings'
          : 'ready',
    ready,
    blockingFindings,
    reviewFindings,
    missingAttestations,
    containsSyntheticMedia: typeof containsSyntheticMedia === 'boolean' ? containsSyntheticMedia : null,
    madeForKids: typeof madeForKids === 'boolean' ? madeForKids : null,
    note: 'A passed gate is not a guarantee against copyright claims, Community Guidelines enforcement, age-setting errors, or monetization decisions.',
  };
}

function BufferSafeLength(value) {
  // Buffer is available in the Node server; this fallback also keeps the helper portable for tests.
  return typeof Buffer !== 'undefined'
    ? Buffer.byteLength(String(value ?? ''), 'utf8')
    : new TextEncoder().encode(String(value ?? '')).length;
}

export function requiredYouTubePolicyAttestations() {
  return REQUIRED_REVIEW_ATTESTATIONS.map(([key, label]) => ({ key, label }));
}

const originalityStopwords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'he', 'her', 'his', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'our',
  'she', 'so', 'the', 'their', 'them', 'they', 'this', 'to', 'was', 'we',
  'were', 'with', 'you', 'your', 'once', 'there', 'then', 'when', 'where',
  'who', 'what', 'how', 'why', 'very', 'just', 'little', 'one', 'two',
]);

function normalizedOriginalityTokens(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !originalityStopwords.has(token));
}

function wordShingles(tokens, size = 4) {
  const output = new Set();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    output.add(tokens.slice(index, index + size).join(' '));
  }
  return output;
}

function setSimilarity(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

/**
 * Checks only recent persisted Children Factory projects for obvious title/story
 * near-duplicates. It does not compare against the public internet and cannot
 * determine whether a video is original enough for monetization.
 */
export function evaluateContentOriginality({ title = '', story = '', existingProjects = [] } = {}) {
  const titleTokens = normalizedOriginalityTokens(title);
  const normalizedTitle = titleTokens.join(' ');
  const titleSet = new Set(titleTokens);
  const storySet = wordShingles(normalizedOriginalityTokens(story), 4);
  const matches = [];

  for (const project of Array.isArray(existingProjects) ? existingProjects : []) {
    const bible = project?.story_bible && typeof project.story_bible === 'object'
      ? project.story_bible
      : {};
    if (bible.factory !== 'children-v1') continue;

    const priorTitle = String(project?.title || '');
    const priorStory = String(bible.story || '');
    if (!priorTitle || !priorStory) continue;
    const priorTitleTokens = normalizedOriginalityTokens(priorTitle);
    const priorNormalizedTitle = priorTitleTokens.join(' ');
    const titleSimilarity = setSimilarity(titleSet, new Set(priorTitleTokens));
    const storySimilarity = setSimilarity(
      storySet,
      wordShingles(normalizedOriginalityTokens(priorStory), 4),
    );
    if (normalizedTitle && priorNormalizedTitle === normalizedTitle) {
      matches.push({ projectId: project.id || null, title: priorTitle, titleSimilarity: 1, storySimilarity });
    } else if (storySimilarity >= 0.45) {
      matches.push({ projectId: project.id || null, title: priorTitle, titleSimilarity, storySimilarity });
    }
  }

  matches.sort((a, b) => b.storySimilarity - a.storySimilarity || b.titleSimilarity - a.titleSimilarity);
  const closest = matches[0] || null;
  const status = !closest
    ? 'unique_in_recent_projects'
    : closest.titleSimilarity === 1 || closest.storySimilarity >= 0.72
      ? 'blocked_near_duplicate'
      : 'review_required';

  return {
    status,
    comparedProjects: Array.isArray(existingProjects) ? existingProjects.length : 0,
    closestMatch: closest ? {
      projectId: closest.projectId,
      title: closest.title,
      titleSimilarity: Number(closest.titleSimilarity.toFixed(3)),
      storySimilarity: Number(closest.storySimilarity.toFixed(3)),
    } : null,
    note: 'This is only a recent-project similarity screen, not proof of originality or a copyright search.',
  };
}
