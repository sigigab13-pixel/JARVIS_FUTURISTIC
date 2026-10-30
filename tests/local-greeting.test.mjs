import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalGreeting, isSimpleGreeting } from '../server/local-greeting.mjs';

test('recognizes short greetings without matching ordinary requests', () => {
  for (const greeting of ['hey', 'Hello!', 'good morning', 'Good evening.', "what's up"]) {
    assert.equal(isSimpleGreeting(greeting), true, greeting);
  }
  for (const message of ['hey can you help me', 'hello world', 'good morning explain photosynthesis', '']) {
    assert.equal(isSimpleGreeting(message), false, message);
  }
});

test('builds a friendly local greeting with or without a display name', () => {
  assert.equal(buildLocalGreeting(), "Hey! I'm here. What would you like to work on?");
  assert.equal(buildLocalGreeting('Saviour Example'), "Hey, Saviour! I'm here. What would you like to work on?");
});
