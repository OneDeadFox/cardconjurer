const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const src=fs.readFileSync('js/creator-23.js','utf8');const extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));let before,rendered=false,loads=0;const button={disabled:false,onclick:async()=>{loads++;ctx.card.version='classRange';ctx.card.dungeonModules=[];}};
const ctx={card:{version:'dungeonModules',dungeonModules:[{id:'custom',bounds:{x:.1,y:.2,width:.7,height:.6}}],frames:[]},document:{querySelector:()=>button},getCurrentFrameLayoutSelection:()=>({key:'ClassRange',groupLabel:'Custom',packLabel:'Class'}),syncFrameLayoutTemplateControls(){},setFrameLayoutTemplateStatus(){},captureCurrentDesignDefaults(){},createDesignStateSnapshot:()=>clone(ctx.card),commitDesignUndoSnapshot:s=>before=s};ctx.window=ctx;
vm.runInNewContext(extract('function registerCurrentFrameLayoutTemplate()','async function loadFrameLayoutTemplateForPack('),ctx);
(async()=>{
for(const source of ['auto','element','browse'])assert.equal(await ctx.applyCurrentFrameLayout({force:true,source}),false);assert.equal(loads,0);
ctx.card.dungeonLayoutLocked=true;assert.equal(await ctx.applyCurrentFrameLayout({force:true}),false);assert.equal(loads,0);
ctx.card.dungeonLayoutLocked=false;assert.equal(await ctx.applyCurrentFrameLayout({force:true}),true);assert.equal(loads,1);assert.equal(before.dungeonModules[0].id,'custom');
Object.assign(ctx,{selectedFrame:null,cloneDesignValue:clone,setDesignPlacementInputs(){},drawFrames(){},drawText(){},watermarkEdited(){},drawCard(){},DungeonModules:{mount(){},render(){rendered=true;}}});ctx.document.querySelector=()=>null;
vm.runInNewContext(extract('async function applyDesignStateSnapshot(','async function undoDesignChange('),ctx);
await ctx.applyDesignStateSnapshot({layoutIdentity:{version:'dungeonModules',onload:'/js/frames/versionDungeon.js'},dungeonModules:before.dungeonModules,dungeonLayoutLocked:true,artPlacement:{},setSymbolPlacement:{},watermarkPlacement:{},dungeonWallTexture:'custom-texture',dungeonPadding:12});
assert.equal(ctx.card.version,'dungeonModules');assert.equal(ctx.card.dungeonModules[0].id,'custom');assert.equal(ctx.card.dungeonLayoutLocked,true);assert.equal(ctx.card.dungeonWallTexture,'custom-texture');assert.equal(ctx.card.dungeonPadding,12);assert.ok(rendered);
console.log('PASS: automatic additions preserve dungeon; lock blocks explicit replacement; layout replacement records undo; restoring snapshot restores dungeon identity and settings.');
})().catch(e=>{console.error(e);process.exitCode=1;});
