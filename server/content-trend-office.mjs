export const TREND_PLATFORMS=Object.freeze(['youtube','tiktok','facebook']);
export const TREND_WINDOWS=Object.freeze({hourly:1,sixHours:6,daily:24,weekly:168});
const clean=(v,m=300)=>String(v??'').trim().slice(0,m);
const clamp=(v)=>Math.min(1,Math.max(0,Number(v)||0));
export function normalizeTrendSignal(input={}){
 const topic=clean(input.topic,500); if(!topic) throw new Error('A trend topic is required.');
 const platform=clean(input.platform,30).toLowerCase();
 if(!TREND_PLATFORMS.includes(platform)) throw new Error('An unsupported trend platform was supplied.');
 return {topic,platform,velocity:clamp(input.velocity??.5),engagement:clamp(input.engagement??.5),freshness:clamp(input.freshness??.8),audienceFit:clamp(input.audienceFit??.7),source:clean(input.source,200)||'user-supplied',observedAt:clean(input.observedAt,80)||null};
}
export function rankTrendOpportunity(input={}){
 const s=normalizeTrendSignal(input);
 const score=Math.round((s.velocity*.30+s.engagement*.25+s.freshness*.20+s.audienceFit*.25)*100);
 return {...s,score,tier:score>=80?'priority':score>=60?'promising':'watch'};
}
export function buildTrendQueue(signals=[],options={}){
 if(!Array.isArray(signals)) throw new Error('Trend signals must be an array.');
 const max=Math.min(20,Math.max(1,Math.floor(Number(options.limit)||10)));
 return signals.map(rankTrendOpportunity).sort((a,b)=>b.score-a.score).slice(0,max).map((item,index)=>({...item,rank:index+1}));
}
export function buildSixHourTrendCheck({series='kids',platforms=TREND_PLATFORMS}={}){
 const safeSeries=clean(series,30).toLowerCase()||'kids';
 const safePlatforms=[...new Set((Array.isArray(platforms)?platforms:[]).map(v=>clean(v,30).toLowerCase()).filter(v=>TREND_PLATFORMS.includes(v)))];
 return {version:'trend-office-v1',series:safeSeries,platforms:safePlatforms.length?safePlatforms:TREND_PLATFORMS,intervalHours:6,nextAction:'collect-fresh-signals',publishAutomatically:false,requiresFreshEvidence:true};
}
