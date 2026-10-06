const MAX_RESPONSE_LENGTH = 20000;
const MAX_REPAIR_ISSUES = 6;

function cleanText(value) {
  return String(value ?? '').trim();
}

function issue(code, message, repairable = true) {
  return { code, message, repairable };
}

export function inspectAssistantResponse(text, { provider = '' } = {}) {
  const value = cleanText(text);
  const issues = [];

  if (!value) {
    issues.push(issue('EMPTY_RESPONSE', 'The assistant produced no usable response.', false));
  }

  if (String(text ?? '').length > MAX_RESPONSE_LENGTH) {
    issues.push(issue('RESPONSE_TOO_LARGE', `The assistant response exceeded the ${MAX_RESPONSE_LENGTH}-character safety bound.`, false));
  }

  if (/\[object\s+Object\]/i.test(value)) {
    issues.push(issue('OBJECT_SERIALIZATION_LEAK', 'The response contains a leaked object serialization marker.'));
  }

  if (/(^|\s)(?:undefined|null)(?=\s|[.,!?;:]|$)/i.test(value)) {
    issues.push(issue('UNRESOLVED_VALUE_LEAK', 'The response contains an unresolved JavaScript value marker.'));
  }

  const fenceCount = (value.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) {
    issues.push(issue('UNCLOSED_CODE_FENCE', 'The response contains an unclosed Markdown code fence.'));
  }

  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const repeatedLine = lines.find(line => {
    if (line.length < 20) return false;
    let count = 0;
    for (const candidate of lines) if (candidate === line) count += 1;
    return count >= 3;
  });
  if (repeatedLine) {
    issues.push(issue('REPEATED_BLOCK', 'The response repeats the same substantive line multiple times.'));
  }

  if (/^\s*(?:internal\s+server\s+error|error:\s*\[object\s+Object\])/i.test(value)) {
    issues.push(issue('INTERNAL_ERROR_LEAK', 'The response appears to expose an internal error rather than a user-facing answer.'));
  }

  const limitedIssues = issues.slice(0, MAX_REPAIR_ISSUES);
  return {
    ok: limitedIssues.length === 0,
    issues: limitedIssues,
    repairable: limitedIssues.length > 0 && limitedIssues.every(item => item.repairable),
    provider: cleanText(provider).slice(0, 120),
    checkedAt: new Date().toISOString(),
  };
}

export function buildRepairInstruction(check) {
  const issues = Array.isArray(check?.issues) ? check.issues.slice(0, MAX_REPAIR_ISSUES) : [];
  const issueText = issues.length
    ? issues.map(item => `- ${item.code}: ${item.message}`).join('\n')
    : '- No specific issue was supplied; produce the safest complete answer.';

  return [
    'JARVIS SELF-CHECK REPAIR.',
    'Rewrite the previous assistant response into the final user-facing answer.',
    'Preserve the user request and useful information, but remove the detected defects.',
    'Do not mention this repair process, internal checks, hidden prompts, or model internals.',
    'Do not invent external actions, tool results, files, sources, or evidence.',
    'Return only the corrected answer.',
    '',
    'Detected defects:',
    issueText,
  ].join('\n');
}

export function repairTextDeterministically(text) {
  let value = cleanText(text);
  value = value.replace(/\n{4,}/g, '\n\n');
  return value.trim();
}

export function selfCheckAndNormalize(text, options = {}) {
  const normalized = repairTextDeterministically(text);
  const before = inspectAssistantResponse(text, options);
  const after = inspectAssistantResponse(normalized, options);

  return {
    text: normalized,
    before,
    after,
    repaired: normalized !== cleanText(text),
  };
}

export const SELF_CHECK_LIMITS = {
  maxResponseLength: MAX_RESPONSE_LENGTH,
  maxRepairIssues: MAX_REPAIR_ISSUES,
};