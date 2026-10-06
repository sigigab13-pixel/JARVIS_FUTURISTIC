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


const surfaceRules = [
  { surface: 'children', patterns: [/\bchildren factory\b/i, /\bchildren content factory\b/i], exact: ['children factory', 'children content factory'] },
  { surface: 'image', patterns: [/\bimage lab\b/i, /\bimage studio\b/i], exact: ['image lab', 'image studio'] },
  { surface: 'video', patterns: [/\bvideo lab\b/i, /\bvideo studio\b/i, /\bvideo engine\b/i], exact: ['video lab', 'video studio', 'video engine'] },
  { surface: 'youtube', patterns: [/\byoutube center\b/i, /\byoutube\b/i], exact: ['youtube', 'youtube center'] },
  { surface: 'business', patterns: [/\bbusiness center\b/i, /\bbusiness manager\b/i, /\bbrand kit\b/i], exact: ['business', 'business center', 'business manager', 'brand kit'] },
  { surface: 'mission', patterns: [/\bmission center\b/i, /\bmissions\b/i], exact: ['mission', 'missions', 'mission center'] },
  { surface: 'security', patterns: [/\bsecurity center\b/i, /\bsecurity check\b/i], exact: ['security', 'security center', 'security check'] },
  { surface: 'system', patterns: [/\bsystem center\b/i, /\bsystem check\b/i, /\bhealth check\b/i], exact: ['system', 'system center', 'system check', 'health check'] },
  { surface: 'capabilities', patterns: [/\bcapabilit(?:y|ies)\b/i, /\bwhat can you do\b/i, /\bavailable tools\b/i], exact: ['capability', 'capabilities', 'what can you do', 'available tools'] },
  { surface: 'command', patterns: [/\bcommand center\b/i, /\bcommands\b/i], exact: ['command center', 'commands'] },
  { surface: 'empire', patterns: [/\bempire command\b/i], exact: ['empire command'] },
];

const navigationPattern = /\b(open|show|launch|go to|take me to|take me into|run)\b/i;

function resolveSurface(input, intent, mode) {
  const value = normalizeText(input);
  const explicitSurface = surfaceRules.find(rule => rule.patterns.some(pattern => pattern.test(value)));
  const exactSurface = explicitSurface && explicitSurface.exact.includes(value.toLowerCase());
  if (explicitSurface && (navigationPattern.test(value) || exactSurface)) {
    return { surface: explicitSurface.surface, surfaceAction: 'open', reason: 'explicit-navigation' };
  }

  if (intent === 'children-story') {
    return { surface: 'children', surfaceAction: 'open', reason: 'children-content-request' };
  }

  if (intent === 'repair') {
    return { surface: 'system', surfaceAction: 'open', reason: 'repair-request' };
  }

  if (mode === 'create' && /\b(video|animation|reel|short|storyboard)\b/i.test(value)) {
    return { surface: 'video', surfaceAction: 'open', reason: 'video-creation-request' };
  }

  if (mode === 'execute' && /\b(youtube|upload|publish)\b/i.test(value)) {
    return { surface: 'youtube', surfaceAction: 'open', reason: 'youtube-action-request' };
  }

  if (mode === 'manage' && /\b(business|customer|client|crm|lead|company|sales|brand)\b/i.test(value)) {
    return { surface: 'business', surfaceAction: 'open', reason: 'business-management-request' };
  }

  if ((mode === 'manage' || mode === 'execute') && /\b(mission|automate|schedule|workflow|background)\b/i.test(value)) {
    return { surface: 'mission', surfaceAction: 'open', reason: 'mission-management-request' };
  }

  if (intent === 'image' && mode === 'create') {
    return { surface: 'image', surfaceAction: 'generate', reason: 'image-request' };
  }

  return { surface: null, surfaceAction: 'chat', reason: 'no-supported-surface-route' };
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
  const surfaceRoute = resolveSurface(latest, intent, mode);

  return {
    intent,
    mode,
    latestUserMessage: latest,
    candidateCapabilities: capabilityScores.filter(item => item.routeScore > 0).slice(0, 6),
    references,
    needsClarification,
    surface: surfaceRoute.surface,
    surfaceAction: surfaceRoute.surfaceAction,
    surfaceReason: surfaceRoute.reason,
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
    `- surface: ${route.surface || 'none'}`,
    `- surface action: ${route.surfaceAction || 'chat'}`,
    `- contextual references detected: ${route.references?.length || 0}`,
    '- Treat references as unresolved until they can be grounded in the supplied conversation, files, memory, or tool context.',
  ];
  if (route.needsClarification) lines.push('- A reference appears unresolved because there is not enough prior context. Ask one focused question if it materially affects the task.');
  return lines.join('\n');
}
