const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let createCanvas;try{({createCanvas}=require('@napi-rs/canvas'));}catch{console.log('SKIP: @napi-rs/canvas required');process.exit(0);}
const source=createCanvas(600,840),s=source.getContext('2d');
Object.defineProperties(source,{naturalWidth:{value:600},naturalHeight:{value:840}});
s.fillStyle='#087bc1';for(const y of [20,90,700,760])s.fillRect(43,y,515,8);s.fillRect(43,20,4,748);s.fillRect(554,20,4,748);
const frame=createCanvas(600,840),f=frame.getContext('2d');f.drawImage(source,0,0);
// The lower edge beside the art is black; its source counterpart on the right
// is pale. The footer must carry the black underline across both halves.
f.fillStyle='#050607';f.fillRect(60,96,240,2);f.fillStyle='#aaddff';f.fillRect(300,96,240,2);
// Distinct rounded native corners make accidental square overpainting visible.
for(const [x,y,dx,dy]of [[556,94,-1,1],[45,704,1,-1],[556,704,-1,-1]]){
 f.clearRect(x-16,y-16,32,32);f.beginPath();f.moveTo(x+dx*16,y);f.lineTo(x+dx*8,y);f.quadraticCurveTo(x,y,x,y+dy*8);f.lineTo(x,y+dy*16);f.strokeStyle='#087bc1';f.lineWidth=4;f.stroke();
}
const card={version:'dungeonModules',width:600,height:840,dungeonWallColor:'pipeline',frames:[{name:'Pipeline',image:source}],text:{},dungeonModules:[{id:'upper',bounds:{x:.51,y:.11,width:.42,height:.5}},{id:'footer',bounds:{x:.07,y:.61,width:.86,height:.14}}]};
const ctx={card,frameCanvas:frame,scaleX:()=>0,scaleY:()=>0,document:{createElement:()=>createCanvas(1,1),querySelector:()=>null}};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['dungeonModules','dungeonCorners'])vm.runInContext(fs.readFileSync('js/'+file+'.js','utf8'),ctx);
const walls=createCanvas(600,840),fx=createCanvas(600,840);ctx.DungeonModules.drawWalls(walls.getContext('2d'),fx.getContext('2d'));
const combined=createCanvas(600,840),c=combined.getContext('2d');c.drawImage(frame,0,0);c.drawImage(walls,0,0);
const pixel=(context,x,y)=>Array.from(context.getImageData(x,y,1,1).data);
const footerY=card.dungeonModules[1].bounds.y*840,underlineY=Math.floor(footerY+3);
assert.deepEqual(pixel(c,200,underlineY).slice(0,3),[5,6,7]);
assert.deepEqual(pixel(c,500,underlineY).slice(0,3),[5,6,7],'Underline remains dark across the right arm rather than fading');
assert.deepEqual(pixel(c,306,underlineY).slice(0,3),[5,6,7],'Underline continues beneath the inner T');
const door=ctx.DungeonModules.doorways(card.dungeonModules)[0];assert.equal(pixel(walls.getContext('2d'),Math.round(door.x*600),underlineY)[3],0,'Underline does not close the doorway');
for(const [x,y]of [[45,Math.floor(footerY-10)],[296,94]])assert.deepEqual(pixel(c,x,y),pixel(f,x,y),'Native T continuation has no new dark cap');
for(const [x,y]of [[556,94],[45,704],[556,704]]){
 const expected=f.getImageData(x-8,y-8,16,16).data,actual=c.getImageData(x-8,y-8,16,16).data;
 assert.deepEqual(actual,expected,'Rounded frame artwork remains unchanged beneath the outer corner');
}
// Internal junction cores should remain plain, without a square light/dark tile.
assert.deepEqual(pixel(c,306,Math.floor(footerY)).slice(0,3),[8,123,193]);
// A supplied art-border outline just outside the colored strip takes priority
// over the fallback title-border sample and is extended at its exact position.
f.fillStyle='#101112';f.fillRect(60,Math.floor(footerY+4),230,2);
walls.getContext('2d').clearRect(0,0,600,840);ctx.DungeonModules.drawWalls(walls.getContext('2d'),fx.getContext('2d'));
assert.deepEqual(pixel(walls.getContext('2d'),500,Math.floor(footerY+5)).slice(0,3),[16,17,18]);
if(process.env.DUNGEON_CORNER_OUTPUT)fs.writeFileSync(process.env.DUNGEON_CORNER_OUTPUT,combined.toBuffer('image/png'));
console.log('PASS: continuous footer underline, open doors, uncapped native T joins, plain junction core, and all three native corner sections.');
// Color-only rounded assets must not erase the neighboring inner shadow.
// Put the outline just inside (outside the sampled colored strip), with gaps
// matching the native corner patches seen in the user's screenshot.
f.fillStyle='#151617';
f.fillRect(47,110,2,578);f.fillRect(551,110,3,578);
f.fillRect(60,98,480,2);f.fillRect(60,697,480,3);
// Invalidate the sampled source after the frame artwork changes.
f.fillStyle='#097bc1';f.fillRect(105,92,5,1);
walls.getContext('2d').clearRect(0,0,600,840);ctx.DungeonModules.drawWalls(walls.getContext('2d'),fx.getContext('2d'));
for(const [x,y] of [[48,690],[55,698],[552,690],[540,698],[552,110],[540,99]]){
 assert.deepEqual(pixel(walls.getContext('2d'),x,y),[21,22,23,255],'Inner shadow continues through rounded corner at '+x+','+y);
}
console.log('PASS: all three rounded corner patches retain adjoining inner shadow lines.');
// Both sides of every doorway have dark end caps, with the gap left open.
for(const d of ctx.DungeonModules.doorways(card.dungeonModules)){
 const horizontal=d.axis==='horizontal',x=d.x*600,y=d.y*840;
 const half=Math.min(840*.0381,d.span*(horizontal?600:840)*.5)/2;
 for(const sign of [-1,1]){
  const end=(horizontal?x:y)+sign*half;
  const samples=[-1,0,1].map(offset=>pixel(walls.getContext('2d'),Math.floor(horizontal?end+offset:x),Math.floor(horizontal?y:end+offset))).filter(c=>c[3]>100);
  assert.ok(samples.some(c=>Math.max(...c.slice(0,3))<100),'Dark cap on '+(sign<0?'left/top':'right/bottom')+' end');
 }
 assert.equal(pixel(walls.getContext('2d'),Math.round(x),Math.round(y))[3],0,'Door gap stays open');
}
console.log('PASS: matching dark caps at both doorway ends and unobstructed openings.');
