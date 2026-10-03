    }

    const memoryContext = semanticMemories.length
      ? `Relevant long-term memories for this user, ranked by relevance and importance:\n${semanticMemories.map((m, i) => `${i + 1}. [${String(m.memory_type || 'memory')}] ${String(m.content || '').trim()}`).join('\n')}\nUse only memories that genuinely help answer the current request. Prefer identity, preferences, goals, project decisions, and explicit instructions when relevant. Do not mention the memory system unless asked.`
      : '';

    const systemMessage = [
      "You are JARVIS FUTURISTIC, Saviour's AI assistant.",
      "The JARVIS application provides you with the current conversation messages and, when available, relevant long-term memories retrieved from its persistent memory system.",
      "Use the supplied conversation and memory context to maintain continuity. Do not claim that you cannot remember previous conversations when relevant history or memory is supplied.",
      "Do not describe yourself as ChatGPT, Claude, Hugging Face, or another underlying model unless the user explicitly asks which model/provider is being used.",
      "Do not output generic capability lists or generic knowledge-cutoff disclaimers unless the user explicitly asks for them.",
      "Be accurate, concise, friendly, and honest about capabilities. Do not claim an external action happened unless the connected service confirms it.",
      "For security topics, stay defensive and educational. For NEXORA, keep trading simulated/paper-only.",
      memoryContext,
    ].filter(Boolean).join('\n\n');

    const response = await fetch(HF_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          {
            role: 'system',
            content: systemMessage,
          },
          ...messages,
        ],
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });
    const data = await response.json();
    if (!response.ok) return json(res, response.status >= 400 && response.status < 500 ? 400 : 502, { error: data?.error?.message || 'Hugging Face AI request failed.' });
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!text) return json(res, 502, { error: 'The AI core returned an empty response.' });
    if (userId && latestUserMessage.length >= 12) {
      const memory = classifyMemory(latestUserMessage);
      try {
        await saveSemanticMemory(userId, latestUserMessage, {
          source: 'chat',
          importance: memory.importance,
        }, memory.type);
      } catch (memoryError) {
        console.error('Semantic memory save error:', memoryError);
      }
    }
