const FORMATS = ['16:9', '9:16', '1:1'];

const PROVIDERS = {
  higgsfield: {
    imageModel: 'gpt_image_2_5',
    motionModel: 'cinematic_studio_video_4_0',
    lipSyncModel: 'sync_so',
  },
  elevenlabs: {
    speechModel: 'eleven_multilingual_v2',
  },
};

function clean(value, max = 2400) {
  return String(value ?? '').trim().slice(0, max);
}

function providerStatus() {
  return {
    higgsfield: process.env.HIGGSFIELD_API_KEY ? 'configured' : 'not_configured',
    elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'not_configured',
  };
}

export function getGenerationCapabilities() {
  const statuses = providerStatus();
  return {
    version: '1.2',
    status: 'planning_ready',
    providers: {
      higgsfield: {
        status: statuses.higgsfield,
        imageModel: PROVIDERS.higgsfield.imageModel,
        motionModel: PROVIDERS.higgsfield.motionModel,
        lipSyncModel: PROVIDERS.higgsfield.lipSyncModel,
        pipeline: 'story scene -> reference image -> motion video -> optional lip-sync',
      },
      elevenlabs: {
        status: statuses.elevenlabs,
        speechModel: PROVIDERS.elevenlabs.speechModel,
        pipeline: 'dialogue/narration -> speech audio',
      },
    },
    supportedFormats: FORMATS,
    executionPolicy: [
      'Do not submit a provider job from the planning endpoint.',
      'Do not expose provider credentials to the browser.',
      'Do not mark media generated until a provider confirms a completed result.',
      'Keep each scene traceable to its story, character, audio, and QA inputs.',
      'Provider execution is adapter-based; this service records confirmed results without inventing provider job IDs or URLs.',
    ],
  };
}

export function buildGenerationPlan({
  title = 'Untitled Story',
  ageRange = '6-10',
  format = '16:9',
  scenes = [],
  visualPlan = null,
  audioPlan = null,
  lipSyncPlan = null,
  qa = null,
}) {
  const safeFormat = FORMATS.includes(format) ? format : '16:9';
  const sceneList = Array.isArray(scenes) ? scenes.slice(0, 20) : [];
  if (!sceneList.length) throw new Error('Scenes are required.');
  if (qa && qa.status && qa.status !== 'ready_for_generation') {
    throw new Error('Production QA must be ready_for_generation before media generation can be prepared.');
  }

  const visualScenes = Array.isArray(visualPlan?.scenes) ? visualPlan.scenes : [];
  const audioScenes = Array.isArray(audioPlan?.scenes) ? audioPlan.scenes : [];
  const lipScenes = Array.isArray(lipSyncPlan?.scenes) ? lipSyncPlan.scenes : [];

  const jobs = sceneList.map((scene, index) => {
    const number = Number(scene?.sceneNumber) || index + 1;
    const visual = visualScenes.find(item => Number(item?.sceneNumber) === number) || {};
    const audio = audioScenes.find(item => Number(item?.sceneNumber) === number) || {};
    const lip = lipScenes.find(item => Number(item?.sceneNumber) === number) || {};

    return {
      sceneNumber: number,
      image: {
        provider: 'higgsfield',
        model: PROVIDERS.higgsfield.imageModel,
        status: process.env.HIGGSFIELD_API_KEY ? 'ready_to_submit' : 'provider_not_configured',
        format: safeFormat,
        prompt: clean(visual?.generationPrompt || scene?.visualPlan || scene?.action),
        execution: 'not_started',
      },
      visual: {
        provider: 'higgsfield',
        model: PROVIDERS.higgsfield.motionModel,
        status: process.env.HIGGSFIELD_API_KEY ? 'ready_to_submit' : 'provider_not_configured',
        format: safeFormat,
        prompt: clean(visual?.generationPrompt || scene?.visualPlan || scene?.action),
        shotType: clean(visual?.shotType, 80) || 'medium',
        cameraMovement: clean(visual?.cameraMovement, 160),
        execution: 'not_started',
      },
      audio: {
        provider: 'elevenlabs',
        model: PROVIDERS.elevenlabs.speechModel,
        status: process.env.ELEVENLABS_API_KEY ? 'ready_to_submit' : 'provider_not_configured',
        narratorDirection: clean(audio?.narratorDirection, 800),
        dialogueDirection: clean(audio?.dialogueDirection, 1000),
        emotion: clean(audio?.emotion, 160),
        pacing: clean(audio?.pacing, 160),
        execution: 'not_started',
      },
      lipSync: {
        provider: 'higgsfield',
        model: PROVIDERS.higgsfield.lipSyncModel,
        status: lip?.segments?.length ? 'planned' : 'needs_dialogue_plan',
        segmentCount: Array.isArray(lip?.segments) ? lip.segments.length : 0,
        execution: 'not_started',
      },
    };
  });

  const statuses = providerStatus();
  return {
    version: '1.2',
    title: clean(title, 180),
    ageRange: clean(ageRange, 40),
    format: safeFormat,
    status: 'prepared_not_executed',
    providers: statuses,
    jobs,
    guardrails: [
      'Generation is not executed by this planning endpoint.',
      'Provider credentials are never returned.',
      'JARVIS must receive a confirmed provider result before marking media generated.',
      'Only original, child-safe production plans may proceed.',
    ],
  };
}

export function buildExecutionStatus(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('A generation plan is required.');
  const jobs = Array.isArray(plan.jobs) ? plan.jobs.slice(0, 20) : [];
  return {
    status: plan.status || 'unknown',
    title: clean(plan.title, 180),
    jobs: jobs.map(job => ({
      sceneNumber: Number(job?.sceneNumber) || 0,
      image: { status: job?.image?.status || 'unknown', execution: job?.image?.execution || 'not_started' },
      visual: { status: job?.visual?.status || 'unknown', execution: job?.visual?.execution || 'not_started' },
      audio: { status: job?.audio?.status || 'unknown', execution: job?.audio?.execution || 'not_started' },
      lipSync: { status: job?.lipSync?.status || 'unknown', execution: job?.lipSync?.execution || 'not_started' },
    })),
    rule: 'Only a confirmed provider result may move execution from not_started to completed.',
  };
}

export function recordProviderResult({ plan, sceneNumber, lane, providerJobId, status = 'completed', resultUrl = '' }) {
  if (!plan || typeof plan !== 'object') throw new Error('A generation plan is required.');
  const allowedLanes = ['image', 'visual', 'audio', 'lipSync'];
  if (!allowedLanes.includes(lane)) throw new Error('Invalid generation lane.');
  const jobs = Array.isArray(plan.jobs) ? plan.jobs : [];
  const job = jobs.find(item => Number(item?.sceneNumber) === Number(sceneNumber));
  if (!job) throw new Error('Scene was not found in the generation plan.');
  if (!providerJobId) throw new Error('A confirmed provider job ID is required.');
  const laneState = job[lane] || {};
  const safeStatus = ['completed', 'failed', 'canceled'].includes(status) ? status : null;
  if (!safeStatus) throw new Error('Provider result status must be completed, failed, or canceled.');
  laneState.execution = safeStatus;
  laneState.providerJobId = clean(providerJobId, 200);
  if (safeStatus === 'completed' && resultUrl) laneState.resultUrl = clean(resultUrl, 2000);
  job[lane] = laneState;
  return { ...plan, status: 'execution_updated', jobs };
}
