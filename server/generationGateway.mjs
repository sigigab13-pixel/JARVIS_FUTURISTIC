const FORMATS = ['16:9', '9:16', '1:1'];

function clean(value, max = 2400) {
  return String(value ?? '').trim().slice(0, max);
}

function providerStatus() {
  return {
    higgsfield: process.env.HIGGSFIELD_API_KEY ? 'configured' : 'not_configured',
    elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'not_configured',
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
      visual: {
        provider: 'higgsfield',
        status: process.env.HIGGSFIELD_API_KEY ? 'ready_to_submit' : 'provider_not_configured',
        format: safeFormat,
        prompt: clean(visual?.generationPrompt || scene?.visualPlan || scene?.action),
        shotType: clean(visual?.shotType, 80) || 'medium',
        cameraMovement: clean(visual?.cameraMovement, 160),
      },
      audio: {
        provider: 'elevenlabs',
        status: process.env.ELEVENLABS_API_KEY ? 'ready_to_submit' : 'provider_not_configured',
        narratorDirection: clean(audio?.narratorDirection, 800),
        dialogueDirection: clean(audio?.dialogueDirection, 1000),
        emotion: clean(audio?.emotion, 160),
        pacing: clean(audio?.pacing, 160),
      },
      lipSync: {
        status: lip?.segments?.length ? 'planned' : 'needs_dialogue_plan',
        segmentCount: Array.isArray(lip?.segments) ? lip.segments.length : 0,
      },
      execution: 'not_started',
    };
  });

  const statuses = providerStatus();
  return {
    version: '1.0',
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
