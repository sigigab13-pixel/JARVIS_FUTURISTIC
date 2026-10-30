const GREETING_PATTERNS = [
  /^(?:hi|hey|hello|hiya|yo|sup)[!.?\s]*$/i,
  /^(?:good\s+)?(?:morning|afternoon|evening|night)[!.?\s]*$/i,
  /^(?:howdy|what'?s\s+up)[!.?\s]*$/i,
];

export function isSimpleGreeting(value) {
  const message = String(value ?? '').trim();
  return message.length > 0 && message.length <= 40
    && GREETING_PATTERNS.some((pattern) => pattern.test(message));
}

export function buildLocalGreeting(displayName = '') {
  const name = String(displayName || '').trim().split(/[\s@]/)[0];
  return name
    ? `Hey, ${name}! I'm here. What would you like to work on?`
    : "Hey! I'm here. What would you like to work on?";
}
