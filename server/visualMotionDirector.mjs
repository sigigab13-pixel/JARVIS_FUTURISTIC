const FORMATS = ['16:9', '9:16', '1:1'];
const SHOT_TYPES = ['wide', 'medium', 'close-up', 'tracking', 'overhead', 'establishing'];
const clean = (v, max=4000) => String(v ?? '').trim().slice(0,max);

export function buildVisualMotionPrompt({ title='Untitled Story', scenes=[], characters=[], format='16:9', ageRange='6-10' }) {
  const safeFormat = FORMATS.includes(format) ? format : '16:9';
  const sceneData = Array.isArray(scenes) ? scenes.slice(0,20) : [];
  const cast = Array.isArray(characters) ? characters.slice(0,8).map(c => typeof c === 'string' ? c : c?.name).filter(Boolean).join(', ') : '';
  if (!sceneData.length) throw new Error('Scenes are required.');
  return [
    "Create an original, child-safe visual and motion direction plan for a children's production.",
    "Preserve the Character Bible and scene continuity. Do not imitate a living creator or copyrighted visual style.",
    "Do not describe sexual content, graphic violence, dangerous instructions, hateful content, or inappropriate frightening imagery.",
    "Return JSON with scenes[].sceneNumber, shotType, composition, cameraMovement, characterBlocking, environmentMotion, lighting, colorMood, transition, continuityLock, generationPrompt.",
    "Title: " + clean(title,180),
    "Audience: " + clean(ageRange,30),
    "Format: " + safeFormat,
    cast ? "Character Bible names: " + cast : '',
    "SCENES:",
    JSON.stringify(sceneData)
  ].filter(Boolean).join('\n');
}

export function normalizeVisualMotionPlan(value) {
  let parsed=value;
  if(typeof value==='string'){try{parsed=JSON.parse(value)}catch{return{scenes:[],raw:value.slice(0,30000)}}}
  const scenes=Array.isArray(parsed?.scenes)?parsed.scenes.slice(0,20):[];
  return {scenes:scenes.map((s,i)=>({sceneNumber:i+1,shotType:SHOT_TYPES.includes(s?.shotType)?s.shotType:'medium',composition:clean(s?.composition,1000),cameraMovement:clean(s?.cameraMovement,800),characterBlocking:clean(s?.characterBlocking,1200),environmentMotion:clean(s?.environmentMotion,1000),lighting:clean(s?.lighting,700),colorMood:clean(s?.colorMood,700),transition:clean(s?.transition,700),continuityLock:clean(s?.continuityLock,1200)||'Preserve approved character and world identity.',generationPrompt:clean(s?.generationPrompt,2200),status:'planned'}))};
}
