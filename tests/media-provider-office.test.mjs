import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaProviderRegistry, defaultMediaProviderRegistry, selectMediaProvider } from '../server/media-provider-office.mjs';

test('media provider office always has the internal provider', () => {
  const registry = defaultMediaProviderRegistry({});
  assert.equal(registry.get('internal')?.enabled, true);
  assert.equal(registry.supports('internal', 'video.generate'), true);
});

test('preferred provider wins when enabled and capable', () => {
  const registry = createMediaProviderRegistry([
    { id: 'internal', capabilities: ['video.generate'], priority: 10 },
    { id: 'everygen', capabilities: ['video.generate'], priority: 20 },
  ]);
  assert.equal(registry.select({ capability: 'video.generate', preferred: ['everygen'] })?.id, 'everygen');
});

test('disabled providers are safely skipped', () => {
  const registry = createMediaProviderRegistry([
    { id: 'internal', capabilities: ['video.generate'], priority: 10 },
    { id: 'everygen', enabled: false, capabilities: ['video.generate'], priority: 1 },
  ]);
  assert.equal(registry.select({ capability: 'video.generate', preferred: ['everygen'] })?.id, 'internal');
});

test('provider can be excluded for fallback selection', () => {
  const registry = createMediaProviderRegistry([
    { id: 'internal', capabilities: ['video.generate'], priority: 10 },
    { id: 'viewmax', capabilities: ['video.generate'], priority: 20 },
  ]);
  assert.equal(registry.select({ capability: 'video.generate', exclude: ['internal'] })?.id, 'viewmax');
});

test('Everygen remains optional and disabled by default', () => {
  assert.equal(selectMediaProvider({ capability: 'video.generate', preferred: ['everygen'] }, {})?.id, 'internal');
});

test('Everygen can be enabled without changing the internal provider', () => {
  assert.equal(selectMediaProvider({ capability: 'video.generate', preferred: ['everygen'] }, { JARVIS_EVERYGEN_ENABLED: 'true' })?.id, 'everygen');
});
