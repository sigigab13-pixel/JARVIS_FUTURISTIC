const clean=(v,max=3000)=>String(v??'').trim().slice(0,max);
export function buildVoiceAudioPrompt({title='Untitled Story',scenes=[],characters=[],ageRange='6-10',language='en'}){
 if(!Array.isArray(scenes)||!scenes.length)throw new Error('Scenes are required.');
 const cast=Array.isArray(characters)?characters.slice(0,8).map(c=>typeof c==='string'?c:c?.name).filter(Boolean).join(', '):'';
 return [
  "Create an original, child-safe voice and audio direction plan for the supplied scenes.",
  "Do not imitate a real person or copyrighted performance. Keep voices age-appropriate and non-sexualized.",
  "Return JSON with scenes[].sceneNumber, narratorDirection, dialogueDirection, emotion, pacing, pronunciationNotes, musicMood, soundEffects, silenceBeats, mixNotes.",
  "Title: "+clean(title,180),"Audience: "+clean(ageRange,30),"Language: "+clean(language,20),
  cast?"Characters: "+cast:"","SCENES:",JSON.stringify(scenes.slice(0,20))
 ].filter(Boolean).join('\n');
}
export function normalizeVoiceAudioPlan(value){
 let parsed=value;if(typeof value==='string'){try{parsed=JSON.parse(value)}catch{return{scenes:[],raw:value.slice(0,30000)}}}
 const scenes=Array.isArray(parsed?.scenes)?parsed.scenes.slice(0,20):[];
 return {scenes:scenes.map((s,i)=>({sceneNumber:i+1,narratorDirection:clean(s?.narratorDirection),dialogueDirection:clean(s?.dialogueDirection),emotion:clean(s?.emotion,600),pacing:clean(s?.pacing,600),pronunciationNotes:clean(s?.pronunciationNotes,700),musicMood:clean(s?.musicMood,700),soundEffects:Array.isArray(s?.soundEffects)?s.soundEffects.slice(0,10).map(x=>clean(x,160)):[],silenceBeats:clean(s?.silenceBeats,500),mixNotes:clean(s?.mixNotes,800),status:'planned'}))};
}
