const STAGES = Object.freeze([
  { id: 'story_director', provider: 'huggingface', dependsOn: [] },
  { id: 'character_bible', provider: 'huggingface', dependsOn: ['story_director'] },
  { id: 'world_asset_bible', provider: 'huggingface', dependsOn: ['story_director'] },
  { id: 'scene_director', provider: 'huggingface', dependsOn: ['character_bible', 'world_asset_bible'] },
  { id: 'storyboard_cost_gate', provider: 'jarvis', dependsOn: ['scene_director'] },
  { id: 'visual_generation', provider: 'higgsfield', dependsOn: ['storyboard_cost_gate'] },
  { id: 'motion', provider: 'higgsfield', dependsOn: ['visual_generation'] },
  { id: 'voice_audio', provider: 'elevenlabs', dependsOn: ['story_director'] },
  { id: 'lip_sync', provider: 'higgsfield', dependsOn: ['motion', 'voice_audio'] },
  { id: 'editing', provider: 'jarvis', dependsOn: ['lip_sync'] },
  { id: 'subtitles', provider: 'jarvis', dependsOn: ['editing'] },
  { id: 'continuity_brand_qa', provider: 'jarvis', dependsOn: ['subtitles'] },
  { id: 'repair_recovery', provider: 'jarvis', dependsOn: ['continuity_brand_qa'] },
  { id: 'render', provider: 'jarvis', dependsOn: ['repair_recovery'] },
  { id: 'final_qa', provider: 'jarvis', dependsOn: ['render'] },
  { id: 'publish', provider: 'jarvis', dependsOn: ['final_qa'] },
]);

export function getPipelineStages() {
  return STAGES.map(stage => ({ ...stage, dependsOn: [...stage.dependsOn] }));
}

export function buildPipelinePlan(payload = {}) {
  const projectId = payload.project_id ? String(payload.project_id) : null;
  const requested = payload.operation ? String(payload.operation) : 'plan';
  return {
    accepted: true,
    type: 'video_pipeline',
    operation: requested,
    projectId,
    mode: 'dependency_planned',
    providers: {
      story: 'huggingface',
      voice: 'elevenlabs',
      visuals: 'higgsfield',
      orchestration: 'jarvis',
    },
    stages: getPipelineStages(),
    executionPolicy: {
      parallel: [
        ['character_bible', 'world_asset_bible'],
        ['story_director', 'voice_audio'],
      ],
      maxConcurrentWorkers: 4,
      hardConcurrencyCap: 8,
      externalGeneration: 'adapter_required',
    },
    safety: {
      spending: 'no provider credits are consumed by planning',
      publishing: 'approval_required',
      selfModification: 'disabled',
    },
  };
}

export function isPipelineStageRegistered(stageId) {
  return STAGES.some(stage => stage.id === String(stageId));
}
