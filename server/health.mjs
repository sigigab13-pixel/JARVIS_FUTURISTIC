import { checkRedisHealth, getRedisHealthState } from './queue.mjs';
import { checkSupabaseHealth } from './store.mjs';
import { isSupabaseStorageConfigured } from './media.mjs';

const VERSION = 'health-v1';

function providerReadiness() {
  const openai = Boolean(process.env.OPENAI_API_KEY);
  const huggingFace = Boolean(process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN);
  return {
    configured: openai || huggingFace,
    providers: {
      openai: openai ? 'configured' : 'not_configured',
      huggingFace: huggingFace ? 'configured' : 'not_configured',
    },
  };
}

export async function buildHealthReport() {
  const startedAt = Date.now();
  const [supabase, redis] = await Promise.all([
    checkSupabaseHealth(),
    checkRedisHealth(),
  ]);

  const storage = {
    configured: isSupabaseStorageConfigured(),
    healthy: isSupabaseStorageConfigured(),
    status: isSupabaseStorageConfigured() ? 'configured' : 'not_configured',
  };

  const ai = providerReadiness();

  const coreHealthy = supabase.healthy && ai.configured;
  const degraded = [];
  if (!redis.healthy) degraded.push('upstash');
  if (!storage.healthy) degraded.push('storage');

  return {
    version: VERSION,
    healthy: coreHealthy,
    readiness: coreHealthy ? 'ready' : 'not_ready',
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    checks: {
      application: {
        healthy: true,
        status: 'ok',
      },
      supabase,
      upstash: redis,
      storage,
      ai,
      vercel: {
        provider: 'vercel',
        environment: process.env.VERCEL_ENV || null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        deploymentUrl: process.env.VERCEL_URL || null,
        status: 'application-runtime-visible',
        note: 'This endpoint cannot certify Vercel deployment/build state.',
      },
      github: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || null,
        status: 'runtime-metadata-only',
      },
    },
    degraded,
    redisCircuit: getRedisHealthState(),
  };
}
