import test from 'node:test';import assert from 'node:assert/strict';import{buildContentStrategy,scoreContentIdea}from'../server/content-strategy-office.mjs';
test('kids short strategy',()=>{const p=buildContentStrategy({series:'kids',topic:'Kobi and the Singing Bird',age:7,platforms:['youtube','tiktok']});assert.equal(p.version,'content-strategy-v1');assert.equal(p.packaging[0].aspectRatio,'9:16');assert.equal(p.variants.length,2);assert.equal(p.safety.reviewRequired,true)});
test('unsupported platforms fail closed',()=>assert.throws(()=>buildContentStrategy({topic:'Test',platforms:['unknown']}),/supported platform/));
test('idea score is deterministic',()=>{const r=scoreContentIdea({topic:'bird teaches sharing',clarity:1,curiosity:1,educationalValue:1,seriesFit:1,productionEase:1});assert.equal(r.score,100);assert.equal(r.tier,'strong')});
test('score signals are clamped',()=>{const r=scoreContentIdea({topic:'Test',curiosity:99,clarity:-5});assert.ok(r.score>=0&&r.score<=100)});
