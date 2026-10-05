/**
 * JARVIS Media Provider Office
 *
 * Isolated provider registry. This module intentionally has no imports from
 * Children Factory, video rendering, publishing, or provider SDKs.
 */

export const MEDIA_PROVIDER_IDS = Object.freeze({
  INTERNAL: 'internal',
  EVERYGEN: 'everygen',
  HIGGSFIELD: 'higgsfield',
  VIEWMAX: 'viewmax',
});

export const MEDIA_PROVIDER_CAPABILITIES = Object.freeze([
  'image.generate',
  'video.generate',
  'voiceover.generate',
  'audio.generate',
]);

function normalizeProvider(provider = {}) {
  const id = String(provider.id || '').trim().toLowerCase();
  return {
    id,
    label: String(provider.label || id || 'Unknown provider'),
    enabled: provider.enabled !== false,
    capabilities: new Set(Array.isArray(provider.capabilities) ? provider.capabilities.map(String) : []),
    priority: Number.isFinite(Number(provider.priority)) ? Number(provider.priority) : 100,
  };
}

export function createMediaProviderRegistry(providers = []) {
  const normalized = providers
    .map(normalizeProvider)
    .filter(provider => provider.id);

  const byId = new Map(normalized.map(provider => [provider.id, provider]));

  return Object.freeze({
    list() {
      return normalized.map(provider => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        capabilities: [...provider.capabilities],
        priority: provider.priority,
      }));
    },

    get(id) {
      return byId.get(String(id || '').trim().toLowerCase()) || null;
    },

    supports(id, capability) {
      const provider = byId.get(String(id || '').trim().toLowerCase());
      return Boolean(provider?.enabled && provider.capabilities.has(String(capability)));
    },

    select({ capability, preferred = [], exclude = [] } = {}) {
      const wanted = String(capability || '').trim();
      const excluded = new Set(exclude.map(value => String(value).trim().toLowerCase()));
      const preferredIds = preferred.map(value => String(value).trim().toLowerCase());

      const candidates = normalized.filter(provider =>
        provider.enabled &&
        provider.capabilities.has(wanted) &&
        !excluded.has(provider.id)
      );

      candidates.sort((a, b) => {
        const ai = preferredIds.indexOf(a.id);
        const bi = preferredIds.indexOf(b.id);
        const ap = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
        const bp = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
        return ap - bp || a.priority - b.priority || a.id.localeCompare(b.id);
      });

      return candidates[0] ? {
        id: candidates[0].id,
        label: candidates[0].label,
        capability: wanted,
      } : null;
    },
  });
}

export function defaultMediaProviderRegistry(env = process.env) {
  const enabled = value => String(value || '').toLowerCase() === 'true';

  return createMediaProviderRegistry([
    {
      id: MEDIA_PROVIDER_IDS.INTERNAL,
      label: 'JARVIS Internal',
      enabled: true,
      priority: 10,
      capabilities: MEDIA_PROVIDER_CAPABILITIES,
    },
    {
      id: MEDIA_PROVIDER_IDS.EVERYGEN,
      label: 'Everygen',
      enabled: enabled(env.JARVIS_EVERYGEN_ENABLED),
      priority: 20,
      capabilities: ['image.generate', 'video.generate', 'voiceover.generate', 'audio.generate'],
    },
    {
      id: MEDIA_PROVIDER_IDS.HIGGSFIELD,
      label: 'Higgsfield',
      enabled: enabled(env.JARVIS_HIGGSFIELD_ENABLED),
      priority: 30,
      capabilities: ['image.generate', 'video.generate'],
    },
    {
      id: MEDIA_PROVIDER_IDS.VIEWMAX,
      label: 'Viewmax',
      enabled: enabled(env.JARVIS_VIEWMAX_ENABLED),
      priority: 40,
      capabilities: ['image.generate', 'video.generate', 'voiceover.generate', 'audio.generate'],
    },
  ]);
}

export function selectMediaProvider(options = {}, env = process.env) {
  return defaultMediaProviderRegistry(env).select(options);
}


export function getMediaProviderStatus(env = process.env) {
  return defaultMediaProviderRegistry(env).list().map(provider => ({
    ...provider,
    state: provider.enabled ? 'enabled' : 'disabled',
  }));
}

export function getMediaProviderPlan({ capability, preferred = [], env = process.env } = {}) {
  const registry = defaultMediaProviderRegistry(env);
  const ordered = [];
  const excluded = [];
  let selection = registry.select({ capability, preferred, exclude: excluded });
  while (selection) {
    ordered.push(selection);
    excluded.push(selection.id);
    selection = registry.select({ capability, preferred, exclude: excluded });
  }

  return {
    capability: String(capability || '').trim(),
    selected: ordered[0] || null,
    fallbackChain: ordered,
    providerCount: ordered.length,
  };
}
