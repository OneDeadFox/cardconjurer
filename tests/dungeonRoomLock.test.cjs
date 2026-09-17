const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={document:{querySelector:()=>null},card:{version:'dungeonModules',width:1000,height:1000,text:{},dungeonModules:[]},RulesRange:{measureModuleText:t=>t.measured},createDesignStateSnapshot:()=>JSON.parse(JSON.stringify(ctx.card)),commitDesignUndoSnapshot(){}};ctx.window=ctx;
for(let i=0;i<4;i++){const id='r'+i;ctx.card.text[id]={size:.03,measured:40+i*15};ctx.card.dungeonModules.push({id,textKey:id,bounds:{x:.1,y:.1+i*.2,width:.8,height:.2}});}
vm.runInNewContext(fs.readFileSync('js/dungeonModules.js','utf8'),ctx);const D=ctx.DungeonModules,approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
D.select('r1');D.setRoomLock(true);const locked=JSON.stringify(ctx.card.dungeonModules[1].bounds);D.setHeightLock(true);D.setAutoFit(true);
assert.equal(JSON.stringify(ctx.card.dungeonModules[1].bounds),locked);approx(ctx.card.dungeonModules[3].bounds.y+ctx.card.dungeonModules[3].bounds.height,.9);approx(ctx.card.dungeonModules[2].bounds.y,.5);assert.notEqual(ctx.card.dungeonModules[2].bounds.height,.2);
const old=ctx.card.dungeonModules[2].bounds.height;ctx.card.text.r2.measured=120;D.reflow();assert.equal(JSON.stringify(ctx.card.dungeonModules[1].bounds),locked);assert.notEqual(ctx.card.dungeonModules[2].bounds.height,old);
ctx.card=JSON.parse(JSON.stringify(ctx.card));D.reflow();assert.equal(JSON.stringify(ctx.card.dungeonModules[1].bounds),locked);
ctx.card.dungeonModules[1].bounds.x=.9;D.snapRoom(ctx.card.dungeonModules[1],'move');assert.equal(JSON.stringify(ctx.card.dungeonModules[1].bounds),locked);
D.setAutoFit(false);assert.equal(JSON.stringify(ctx.card.dungeonModules[1].bounds),locked);approx(ctx.card.dungeonModules[2].bounds.height,.2);
D.setAutoFit(true);ctx.card.text.r1.measured=4000;D.reflow();assert.ok(ctx.card.dungeonAutoFitOverflow);assert.equal(JSON.stringify(ctx.card.dungeonModules[1].bounds),locked);
D.setAutoFit(false);ctx.card.text.r1.measured=60;D.setRoomLock(false);assert.equal(ctx.card.dungeonModules[1].lockedBounds,undefined);
console.log('PASS: individual lock with overall height fit, unlocked resizing, text edits, save/load, drag protection, fit-off restore and overflow.');
