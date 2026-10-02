function hasItems(value){return Array.isArray(value)?value.length>0:Boolean(value);}
export function runProductionQa({story=null,characterBible=null,scenes=[],visualPlan=null,audioPlan=null,lipSyncPlan=null,timeline=null,pack=null}={}) {
  const issues=[],warnings=[];
  if(!story?.content)issues.push('Master story is missing.');
  if(!hasItems(characterBible?.characters))issues.push('Character Bible is missing.');
  if(!hasItems(scenes))issues.push('Scene plan is missing.');
  if(!hasItems(visualPlan?.scenes))issues.push('Visual plan is missing.');
  if(!hasItems(audioPlan?.scenes))issues.push('Voice/audio plan is missing.');
  if(!hasItems(lipSyncPlan?.scenes))warnings.push('Lip-sync plan is missing or empty.');
  if(!hasItems(timeline?.scenes))issues.push('Timeline plan is missing.');
  if(pack?.render?.status==='complete'||pack?.publish?.status==='published')issues.push('Production status claims completion; verify connected-provider evidence before publishing.');
  if(timeline?.render?.status==='complete')issues.push('Timeline render claims completion without provider verification.');
  const dialogueExists=scenes.some(scene=>String(scene?.dialogue||'').trim());
  if(dialogueExists&&!hasItems(lipSyncPlan?.scenes))issues.push('Dialogue exists but no lip-sync plan is available.');
  return {status:issues.length?'needs_review':'ready_for_generation',issues,warnings,checks:{story:Boolean(story?.content),characterBible:hasItems(characterBible?.characters),scenes:hasItems(scenes),visualPlan:hasItems(visualPlan?.scenes),audioPlan:hasItems(audioPlan?.scenes),lipSyncPlan:hasItems(lipSyncPlan?.scenes),timeline:hasItems(timeline?.scenes),renderNotClaimed:timeline?.render?.status!=='complete',publishNotClaimed:timeline?.publish?.status!=='published'},note:'QA is planning-layer validation only. It does not verify rendered pixels, audio output, provider jobs, or publication.'};
}
