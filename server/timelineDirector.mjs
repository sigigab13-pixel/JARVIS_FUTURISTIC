const FORMATS = ['16:9', '9:16', '1:1'];
function clean(value, max = 600) { return String(value ?? '').trim().slice(0, max); }
export function buildTimelinePlan({ title = 'Untitled Story', scenes = [], audioPlan = null, lipSyncPlan = null, format = '16:9' } = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('Scenes are required.');
  const outputFormat = FORMATS.includes(format) ? format : '16:9';
  const sequence = scenes.slice(0,20).map((scene,index)=>({sceneNumber:scene?.sceneNumber??index+1,durationEstimateSeconds:5,videoTrack:{status:'planned',source:`scene-${scene?.sceneNumber??index+1}`},dialogueTrack:{status:'planned'},musicTrack:{status:'planned'},sfxTrack:{status:'planned'},captions:{status:'planned',enabled:Boolean(scene?.dialogue)},transition:index===0?'cut-in':'cut',notes:clean(scene?.continuityNotes,400)}));
  return {status:'planned',title:clean(title,200),sequenceId:`children-${Date.now().toString(36)}`,outputFormats:[outputFormat,...FORMATS.filter(x=>x!==outputFormat)],tracks:['video','dialogue','music','sound-effects','captions'],scenes:sequence,render:{status:'not_started'},publish:{status:'not_started'},sourceStatus:{audioPlan:Boolean(audioPlan),lipSyncPlan:Boolean(lipSyncPlan)}};
}
