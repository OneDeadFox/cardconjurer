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
const footerY=card.dungeonModules[1].bounds.y*840,underlineY=Math.floor(footerY+1);
assert.ok(Math.max(...pixel(c,200,underlineY).slice(0,3))<90);
assert.deepEqual(pixel(c,500,underlineY).slice(0,3),pixel(c,200,underlineY).slice(0,3),'Underline remains dark across the right arm rather than fading');
assert.ok(Math.max(...pixel(c,306,underlineY).slice(0,3))<90,'Underline continues beneath the inner T');
const door=ctx.DungeonModules.doorways(card.dungeonModules)[0];assert.equal(pixel(walls.getContext('2d'),Math.round(door.x*600),underlineY)[3],0,'Underline does not close the doorway');
for(const [x,y]of [[45,Math.floor(footerY-10)],[296,94]])assert.deepEqual(pixel(c,x,y),pixel(f,x,y),'Native T continuation has no new dark cap');
for(const [x,y]of [[556,94],[45,704],[556,704]]){
 const dx=x===45?1:-1,dy=y===94?1:-1;
 for(let oy=-8;oy<8;oy++)for(let ox=-8;ox<8;ox++)if((ox+.5)*dx<0||(oy+.5)*dy<0)assert.deepEqual(pixel(c,x+ox,y+oy),pixel(f,x+ox,y+oy),'Native exterior rounded artwork remains unchanged');
}
// Internal junction cores should remain plain, without a square light/dark tile.
assert.deepEqual(pixel(c,306,Math.floor(footerY)).slice(0,3),[8,123,193]);
// A supplied art-border outline just outside the colored strip takes priority
// over the fallback title-border sample and is extended at its exact position.
f.fillStyle='#101112';f.fillRect(60,Math.floor(footerY+4),230,2);
walls.getContext('2d').clearRect(0,0,600,840);ctx.DungeonModules.drawWalls(walls.getContext('2d'),fx.getContext('2d'));
assert.ok(Math.max(...pixel(walls.getContext('2d'),500,Math.floor(footerY+2)).slice(0,3))<90);
if(process.env.DUNGEON_CORNER_OUTPUT)fs.writeFileSync(process.env.DUNGEON_CORNER_OUTPUT,combined.toBuffer('image/png'));
console.log('PASS: continuous footer underline, open doors, uncapped native T joins, plain junction core, and all three native corner sections.');
// Inner corner arms use the same rendered thickness as their neighboring runs;
// no sampled shadow patch may add a ledge into the room.
for(const [x,y] of [[555,95],[555,703],[45,703]])assert.ok(pixel(walls.getContext('2d'),x,y)[3]>240,'Continuous room-facing corner at '+x+','+y);
for(const [x,y] of [[550,100],[550,698],[50,698]])assert.equal(pixel(walls.getContext('2d'),x,y)[3],0,'No shadow ledge projects into the room');
console.log('PASS: native outer curves, continuous inner joins, and no projecting corner ledges.');
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
