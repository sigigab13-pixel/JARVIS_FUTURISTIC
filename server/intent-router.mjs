function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function tokens(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}


const intentRules = [
  { intent: 'image', patterns: [/\bimage\b/i, /\bdraw\b/i, /\bpicture\b/i, /\bphoto\b/i, /\billustrat(?:e|ion)\b/i, /\bthumbnail\b/i, /\bposter\b/i] },
  { intent: 'children-factory', patterns: [
    /\b(?:create|make|generate|produce|build|prepare)\b[\s\S]{0,140}\b(?:children?|kids?|rhyme|nursery|bedtime|story|stories|animation|video|short)\b/i,
    /\b(?:children?|kids?)\b[\s\S]{0,140}\b(?:rhyme|nursery|bedtime|story|stories|animation|video|short)\b/i,
  ] },
  { intent: 'children-story', patterns: [/\bchildren?\b/i, /\bkids?\b/i, /\bbedtime\b/i, /\bstory for (?:a )?kid\b/i, /\brhyme\b/i, /\bnursery\b/i, /\b5[- ]year[- ]old\b/i, /\b6[- ]year[- ]old\b/i, /\b7[- ]year[- ]old\b/i, /\b8[- ]year[- ]old\b/i] },
  { intent: 'repair', patterns: [/\bfix\b/i, /\bbroken\b/i, /\brepair\b/i] },
];

function inferIntent(input) {
  for (const rule of intentRules) {
    if (rule.patterns.some(pattern => pattern.test(input))) return rule.intent;
  }
  return 'chat';
}

const goalPatterns = [
  { mode: 'search', patterns: [/\b(search|look up|find|research|check online|what's new|latest|current)\b/i] },
  { mode: 'create', patterns: [/\b(create|make|generate|build|write|design|produce|draw)\b/i] },
  { mode: 'inspect', patterns: [/\b(check|inspect|analyze|review|diagnose|look at|what is wrong|what's wrong|explain this)\b/i] },
  { mode: 'execute', patterns: [/\b(send|publish|upload|book|schedule|delete|update|change|run|launch|post)\b/i] },
  { mode: 'manage', patterns: [/\b(manage|organize|track|monitor|handle|coordinate)\b/i] },
  { mode: 'decide', patterns: [/\b(should i|which one|compare|choose|decide|recommend)\b/i] },
];

function inferMode(input) {
  for (const group of goalPatterns) {
    if (group.patterns.some(pattern => pattern.test(input))) return group.mode;
  }
  return 'answer';
}

function extractReferences(input, priorMessages = []) {
  const value = normalizeText(input);
  const prior = Array.isArray(priorMessages) ? priorMessages : [];
  const references = [];

  if (/\b(this|that|it|these|those|the file|the picture|the image|the document|the report|the video|the message)\b/i.test(value)) {
    const candidates = prior
      .slice(-8)
      .filter(message => message?.role && typeof message?.content === 'string')
      .map(message => ({
        role: message.role,
        content: normalizeText(message.content).slice(0, 500),
      }))
      .filter(item => item.content);
    references.push({
      type: 'contextual',
      expression: value,
      candidates,
      requiresResolution: true,
    });
  }

  const timeReference = value.match(/\b(yesterday|today|tomorrow|last week|next week|last month|next month)\b/i);
  if (timeReference) {
    references.push({
      type: 'temporal',
      expression: timeReference[1],
      requiresResolution: true,
    });
  }

  return references;
}

export function routeIntent({ messages = [], availableCapabilities = [], user = null } = {}) {
  const normalizedMessages = Array.isArray(messages)
    ? messages.filter(message => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
    : [];
  const latest = normalizeText(normalizedMessages.at(-1)?.content || '');
  const prior = normalizedMessages.slice(0, -1);
  const mode = inferMode(latest);
  const intent = inferIntent(latest);
  const wordSet = new Set(tokens(latest));

  const capabilityScores = availableCapabilities.map(capability => {
    const descriptionTokens = tokens(capability.description || '');
    const keywordTokens = Array.isArray(capability.keywords) ? capability.keywords.flatMap(tokens) : [];
    const descriptionOverlap = descriptionTokens.filter(token => wordSet.has(token)).length;
    const keywordOverlap = keywordTokens.filter(token => wordSet.has(token)).length;
    const overlap = (keywordOverlap * 3) + descriptionOverlap;
    return { ...capability, routeScore: overlap };
  }).sort((a, b) => b.routeScore - a.routeScore);

  const references = extractReferences(latest, prior);
  const needsClarification = references.some(reference => reference.requiresResolution) && prior.length === 0;

  return {
    intent,
    mode,
    latestUserMessage: latest,
    candidateCapabilities: capabilityScores.filter(item => item.routeScore > 0).slice(0, 6),
    references,
    needsClarification,
    authenticatedUserId: user?.id || null,
  };
}

export function routeContextForPrompt(route) {
  if (!route) return '';
  const lines = [
    'Intent routing context:',
    `- intent: ${route.intent || 'chat'}`,
    `- mode: ${route.mode}`,
    `- candidate capabilities: ${route.candidateCapabilities?.map(item => item.id).join(', ') || 'none confidently identified'}`,
    `- contextual references detected: ${route.references?.length || 0}`,
    '- Treat references as unresolved until they can be grounded in the supplied conversation, files, memory, or tool context.',
  ];
  if (route.needsClarification) lines.push('- A reference appears unresolved because there is not enough prior context. Ask one focused question if it materially affects the task.');
  return lines.join('\n');
}
