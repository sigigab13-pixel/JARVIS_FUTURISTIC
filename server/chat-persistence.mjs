export async function persistConversationSafely({
  userId,
  messages,
  appendMessages,
  logger = console,
}) {
  if (!userId) {
    return { persistent: false, warning: null };
  }

  try {
    await appendMessages(userId, messages);
    return { persistent: true, warning: null };
  } catch (error) {
    logger.error('JARVIS conversation persistence error:', error?.message || error);
    return {
      persistent: false,
      warning: 'Your answer was generated, but this conversation could not be saved to your account.',
    };
  }
}
