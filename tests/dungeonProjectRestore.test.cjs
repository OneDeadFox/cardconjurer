const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/creator-23.js','utf8');
const load=source.slice(source.indexOf('async function loadCardData('),source.indexOf('async function loadCard(selectedCardKey)'));
const element={classList:{remove(){}},value:'',checked:false};let events=[];
const ctx={document:{querySelector:()=>element,getElementById:()=>element},date:new Date(),selectedTextIndex:0,canvasList:['dungeon','dungeonFX'],dungeonCanvas:{width:1,height:1},dungeonFXCanvas:{width:1,height:1},currentCardOrientation:()=> 'portrait',scaleX:x=>x,scaleY:y=>y,scaleWidth:x=>x,scaleHeight:y=>y};ctx.window=ctx;
for(const name of ['clearDesignUndoHistory','syncCardOrientationState','artistEdited','loadTextOptions','uploadArt','uploadSetSymbol','uploadWatermark','serialInfoEdited','drawTextBuffer','drawFrames','bottomInfoEdited','watermarkEdited'])ctx[name]=()=>{};
ctx.loadScript=async()=>{events.push('script');};ctx.sizeCanvas=name=>{events.push('resize');ctx[name+'Canvas']={width:ctx.card.width,height:ctx.card.height};};
ctx.DungeonModules={mount:()=>events.push('mount'),render:()=>events.push('render')};
vm.runInNewContext(load,ctx);
(async()=>{
const saved={version:'dungeonModules',width:1000,height:1400,marginX:0,marginY:0,onload:'/js/frames/versionDungeon.js',frames:[],text:{room:{text:'Saved room'}},dungeonModules:[{id:'room',bounds:{x:.13,y:.21,width:.7,height:.3},cornerStyles:{tl:{style:'t-down',size:.02,fades:{right:{enabled:true,length:.04}}}}}],dungeonWallTexture:'data:image/png;base64,texture',dungeonWallColor:'custom',dungeonAutoFit:true,dungeonAutoFitBounds:{top:.21,bottom:.51}};
assert.equal(await ctx.loadCardData(JSON.parse(JSON.stringify(saved)),'test'),true);
assert.equal(events.at(-1),'render');assert.ok(events.indexOf('render')>events.lastIndexOf('resize'));
assert.equal(JSON.stringify(ctx.card.dungeonModules),JSON.stringify(saved.dungeonModules));assert.equal(ctx.card.dungeonWallTexture,saved.dungeonWallTexture);assert.equal(ctx.card.dungeonAutoFit,true);
events=[];await ctx.loadCardData(saved,'same-sized project');assert.deepEqual(events,['script','mount','render']);
events=[];await ctx.loadCardData({...saved,dungeonModules:[]},'empty dungeon');assert.equal(ctx.card.dungeonModules.length,0);assert.equal(events.at(-1),'render');
console.log('PASS: restored dungeon redraws after resizing and on same-size reload; room/corner/texture/fit data and empty layouts survive.');
})().catch(e=>{console.error(e);process.exitCode=1;});
