const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let createCanvas;
try { ({createCanvas}=require('@napi-rs/canvas')); } catch { console.log('SKIP raster checks: install @napi-rs/canvas to run'); process.exit(0); }
const source=createCanvas(600,840),s=source.getContext('2d');
Object.defineProperties(source,{naturalWidth:{value:600},naturalHeight:{value:840}});
// Uploaded pipeline identifies geometry; the finished frame adds asymmetric bevels.
s.fillStyle='#087bc1';for(const y of [20,90,700,760])s.fillRect(43,y,515,8);
s.fillRect(43,20,4,748);s.fillRect(554,20,4,748);
const finished=createCanvas(600,840),f=finished.getContext('2d');f.drawImage(source,0,0);
f.fillStyle='#17272d';for(const y of [90,700])f.fillRect(43,y-3,515,3);
f.fillStyle='#9ce2ff';for(const y of [90,700])f.fillRect(43,y+6,515,2);
f.fillStyle='#15232c';for(const x of [43,554])f.fillRect(x-3,20,3,748);
f.fillStyle='#a4e2ff';for(const x of [43,554])f.fillRect(x+4,20,3,748);
const card={version:'dungeonModules',width:600,height:840,dungeonWallColor:'pipeline',frames:[{name:'Blue Pipeline',image:source}],text:{},dungeonModules:[
 {id:'a',textKey:'a',bounds:{x:.51,y:.11,width:.42,height:.25}},
 {id:'b',textKey:'b',bounds:{x:.51,y:.36,width:.21,height:.25}},
 {id:'c',textKey:'c',bounds:{x:.72,y:.36,width:.21,height:.25}},
 {id:'footer',textKey:'d',bounds:{x:.07,y:.61,width:.86,height:.14}}
]};
for(const room of card.dungeonModules)card.text[room.textKey]={text:'Test ability',size:.038};
const ctx={card,frameCanvas:finished,scaleX:()=>0,scaleY:()=>0,document:{createElement:()=>createCanvas(300,150),querySelector:()=>null},RulesRange:{measureModuleText:()=>35}};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['js/dungeonModules.js','js/dungeonCorners.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const walls=createCanvas(600,840),effects=createCanvas(600,840);
assert.equal(ctx.DungeonModules.drawWalls(walls.getContext('2d'),effects.getContext('2d')),true);
const footer=card.dungeonModules[3],b=card.dungeonModules[1].bounds,jx=Math.round(b.x*600),jy=Math.round(b.y*840);
const pixel=(x,y)=>Array.from(walls.getContext('2d').getImageData(x,y,1,1).data);
assert.equal(footer.bounds.y,.61,'Wide final row upper edge stays where the template placed it');
assert.ok(Math.abs(card.dungeonModules[0].bounds.y-94/840)<1e-9,'Bevel does not shift the title-bottom anchor');
assert.ok(pixel(jx,jy)[3]>240,'Shared junction has no missing core');
assert.ok(pixel(jx,jy)[2]>100,'An interior junction does not get a black overlapping outline');
assert.ok(pixel(Math.round(footer.bounds.x*600)+2,Math.round(footer.bounds.y*840)+2)[3]>240,'Unequal wall widths meet without a missing corner quadrant');
// Auto-fit retains both exterior anchors and the art/footer boundary even without height lock.
card.dungeonAutoFit=true;ctx.DungeonModules.reflow();
assert.equal(footer.bounds.y,.61);assert.ok(Math.abs(footer.bounds.y+footer.bounds.height-704/840)<1e-9);
assert.ok(Math.abs(card.dungeonModules[0].bounds.y-94/840)<1e-9);
const stable=JSON.stringify(card.dungeonModules.map(r=>r.bounds));ctx.DungeonModules.reflow();assert.equal(JSON.stringify(card.dungeonModules.map(r=>r.bounds)),stable,'Repeated fits do not drift');
// A rounded junction must cut away the old square corner in the colored material too.
card.dungeonModules[0].cornerStyles={tr:{style:'rounded',size:.035,fades:{}}};
walls.getContext('2d').clearRect(0,0,600,840);ctx.DungeonModules.drawWalls(walls.getContext('2d'),effects.getContext('2d'));
const top=card.dungeonModules[0].bounds;
assert.ok(pixel(Math.round((top.x+top.width)*600),Math.round(top.y*840))[3]<10,'Colored strips respect rounded corner geometry');
// Exercise the actual frame-composition completion hook, not a direct redraw.
const creator=fs.readFileSync('js/creator-23.js','utf8');
vm.runInContext(creator.slice(creator.indexOf('function drawFrames()'),creator.indexOf('function loadFramePacks(')),ctx);
const masking=createCanvas(600,840),black=createCanvas(600,840);black.getContext('2d').fillRect(0,0,600,840);
Object.assign(ctx,{frameContext:f,frameMaskingCanvas:masking,frameMaskingContext:masking.getContext('2d'),black,drawTextBetweenFrames:false,scaleX:v=>v*600,scaleY:v=>v*840,scaleWidth:v=>v*600,scaleHeight:v=>v*840,drawCard:()=>{},drawFrameLayerImage:(context,image,x,y,width,height)=>context.drawImage(image,x,y,width,height),dungeonEdited:skip=>{assert.equal(skip,true,'Frame completion refreshes walls without a text redraw loop');walls.getContext('2d').clearRect(0,0,600,840);ctx.DungeonModules.drawWalls(walls.getContext('2d'),effects.getContext('2d'));}});
card.frames[0].masks=[];card.frames[0].opacity=100;
s.globalCompositeOperation='source-in';s.fillStyle='#3bc16d';s.fillRect(0,0,600,840);s.globalCompositeOperation='source-over';
ctx.drawFrames();
const recolored=pixel(390,Math.round(top.y*840));assert.ok(recolored[1]>recolored[2],'Walls sample the newly composed frame color rather than the previous blue frame');
if(process.env.DUNGEON_RASTER_OUTPUT)fs.writeFileSync(process.env.DUNGEON_RASTER_OUTPUT,walls.toBuffer('image/png'));
console.log('PASS: raster junction cores, missing quadrants, bevel anchors, fixed footer during fit, edited corner coverage, and frame-change redraw ordering.');
