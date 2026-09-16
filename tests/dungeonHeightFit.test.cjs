const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={document:{querySelector:()=>null},card:{version:'dungeonModules',height:1000,width:1000,text:{a:{size:.03,measured:70},b:{size:.03,measured:170}},dungeonModules:[{id:'a',textKey:'a',bounds:{x:.1,y:.1,width:.8,height:.35}},{id:'b',textKey:'b',bounds:{x:.1,y:.45,width:.8,height:.35}}]},RulesRange:{measureModuleText:t=>t.measured},createDesignStateSnapshot:()=>JSON.parse(JSON.stringify(ctx.card)),commitDesignUndoSnapshot:()=>{}};ctx.window=ctx;
vm.runInNewContext(fs.readFileSync('js/dungeonModules.js','utf8'),ctx);const D=ctx.DungeonModules;
const original=JSON.stringify(ctx.card.dungeonModules.map(r=>r.bounds));const bottom=()=>Math.max(...ctx.card.dungeonModules.map(r=>r.bounds.y+r.bounds.height));const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
D.setAutoFit(true);assert.ok(bottom()<.8);D.setAutoFit(false);assert.equal(JSON.stringify(ctx.card.dungeonModules.map(r=>r.bounds)),original);
D.setHeightLock(true);D.setAutoFit(true);approx(bottom(),.8);approx(ctx.card.dungeonModules[0].bounds.y,.1);assert.ok(ctx.card.dungeonModules[1].bounds.height>ctx.card.dungeonModules[0].bounds.height);approx(ctx.card.dungeonModules[1].bounds.y,ctx.card.dungeonModules[0].bounds.y+ctx.card.dungeonModules[0].bounds.height);
const fitted=JSON.stringify(ctx.card.dungeonModules.map(r=>r.bounds));D.reflow();assert.equal(JSON.stringify(ctx.card.dungeonModules.map(r=>r.bounds)),fitted);
ctx.card=JSON.parse(JSON.stringify(ctx.card));D.setAutoFit(false);assert.equal(JSON.stringify(ctx.card.dungeonModules.map(r=>r.bounds)),original);
D.setHeightLock(false);D.setAutoFit(true);const compact=bottom();D.setHeightLock(true);ctx.card.text.b.measured=240;D.reflow();approx(bottom(),compact);
ctx.card.text.b.measured=5000;D.reflow();approx(bottom(),compact);assert.equal(ctx.card.dungeonAutoFitOverflow,true);
D.setAutoFit(false);assert.equal(JSON.stringify(ctx.card.dungeonModules.map(r=>r.bounds)),original);
console.log('PASS: reversible fitting; locked total and shared boundaries; stable reflow; save/load; lock after fitting; overflow retains total.');
D.setPadding(12,true);for(const r of ctx.card.dungeonModules){approx(ctx.card.text[r.textKey].x,r.bounds.x+.012);approx(ctx.card.text[r.textKey].width,r.bounds.width-.024);}
D.select('a');D.setPadding(30,false);approx(ctx.card.text.a.x,ctx.card.dungeonModules[0].bounds.x+.03);approx(ctx.card.text.b.x,ctx.card.dungeonModules[1].bounds.x+.012);
D.setPadding(0,true);approx(ctx.card.text.a.x,ctx.card.dungeonModules[0].bounds.x);assert.equal(ctx.card.dungeonModules[0].padding,undefined);
ctx.card.text.a.measured=80;ctx.card.text.b.measured=80;D.setHeightLock(false);D.setAutoFit(true);const noPadding=bottom();D.setPadding(25,true);assert.ok(bottom()>noPadding);D.setAutoFit(false);
console.log('PASS: individual/global/zero padding and text-driven heights include padding.');
