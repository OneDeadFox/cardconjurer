const fs=require('fs'),vm=require('vm'),{createCanvas,Image}=require('@napi-rs/canvas');
const assert=require('node:assert/strict'),path=require('node:path');
const root=process.env.EMBARK_NATIVE_FIXTURE;if(!root){console.log('SKIP: set EMBARK_NATIVE_FIXTURE to the extracted project and stock asset directory');process.exit(0);}
const card=JSON.parse(fs.readFileSync(root+'/embark.json'));const jsRoot=path.resolve(__dirname,'../js');
card.templateThemes.autoStock=false;
const assets=fs.readdirSync(root+'/embark-fixture/assets');
const ctx={card,Image,console,scaleX:()=>0,scaleY:()=>0,fixUri:src=>src.startsWith('asset://')?root+'/embark-fixture/assets/'+assets.find(f=>f.includes(src.slice(8))):src==='/img/frames/maskRightHalf.png'?root+'/embark-fixture/right-mask.png':src.startsWith('/img/')?root+'/embark-fixture/stock'+src:src,addEventListener(){},document:{readyState:'loading',addEventListener(){},createElement:()=>createCanvas(1,1),querySelector:()=>null}};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['dungeonModules','dungeonCorners','templateThemes'])vm.runInContext(fs.readFileSync(jsRoot+'/'+name+'.js','utf8'),ctx);
(async()=>{await ctx.TemplateThemes.apply(card,{colorIdentity:process.env.TEST_COLOR||'WG'});for(const f of card.frames)f.image=await new Promise((resolve,reject)=>{const i=new Image;i.onload=()=>resolve(i);i.onerror=reject;i.src=ctx.fixUri(f.src);});
const c=createCanvas(card.width,card.height),p=c.getContext('2d');for(const f of card.frames.slice().reverse()){
 const layer=createCanvas(c.width,c.height),lp=layer.getContext('2d'),b=f.bounds||{};
 lp.drawImage(f.image,Math.round((b.x||0)*c.width),Math.round((b.y||0)*c.height),Math.round((b.width||1)*c.width),Math.round((b.height||1)*c.height));
 for(const mask of f.masks||[]){const i=new Image();i.src=ctx.fixUri(mask.src);lp.globalCompositeOperation='destination-in';lp.drawImage(i,0,0,c.width,c.height);}
 p.drawImage(layer,0,0);layer.width=1;layer.height=1;
 }
 c.toBuffer('image/png');for(const f of card.frames)if(!f.templateTheme)delete f.image;if(global.gc)global.gc();ctx.frameCanvas=c;
const walls=createCanvas(c.width,c.height),fx=createCanvas(c.width,c.height);ctx.DungeonModules.drawWalls(walls.getContext('2d'),fx.getContext('2d'));p.drawImage(walls,0,0);p.drawImage(fx,0,0);walls.width=1;fx.width=1;if(global.gc)global.gc();
const envelope=card.dungeonPipelineEnvelope,px=envelope.right*card.width,top=envelope.top*card.height,bottom=envelope.bottom*card.height,left=envelope.x*card.width;
const finalPixels=p.getImageData(0,0,c.width,c.height).data;
const pixel=(x,y)=>Array.from(finalPixels.slice((Math.floor(y)*c.width+Math.floor(x))*4,(Math.floor(y)*c.width+Math.floor(x))*4+3));
// At each native turn the inside outline must continue on both arms.
for(const [x,y,dx,dy]of [[px,top,-1,1],[px,bottom,-1,-1],[left,bottom,1,-1]]){
 for(let t=12;t<30;t++){
  assert.ok(Math.max(...pixel(x+dx*8,y+dy*t))<90,'Continuous vertical inside shadow '+[x,y,dx,dy,t,pixel(x+dx*8,y+dy*t)]);
  assert.ok(Math.max(...pixel(x+dx*t,y+dy*8))<90,'Continuous horizontal inside shadow '+[x,y,dx,dy,t,pixel(x+dx*t,y+dy*8)]);
 }
}
if((process.env.TEST_COLOR||'WG')==='WG'){
 // The previous quadrant cut left a pale rectangular highlight in this core.
 for(const [y,dy] of [[top,1],[bottom,-1]])for(let t=12;t<=45;t++){
  const color=pixel(px,y+dy*t),reference=pixel(px,y+dy*(t+1));
  if(color[1]>100&&reference[1]>100)assert.ok(color.every((v,i)=>Math.abs(v-reference[i])<12),'No rectangular corner seam '+[y,dy,t,color,reference]);
 }
}
// Corner handoffs must not introduce a gray bar across the inside edge.
for(const x of [left+8,px-8])for(let t=20;t<=45;t++)assert.ok(Math.max(...pixel(x,bottom-t))<25,'No gray shadow at the beginning of a lower corner patch');
// The native lower bevel is one thin edge, not a generated edge plus the
// original typeline border. Check the full middle, including the blend.
for(const fraction of [.1,.25,.5,.75,.9]){
 const x=left+(px-left)*fraction;let dark=0;
 for(let t=1;t<25;t++)if(Math.max(...pixel(x,bottom+t))<60)dark++;
 assert.ok(dark>=2&&dark<=4,'Single thin lower border ('+dark+' pixels)');
}
console.log('PASS: actual project, stock frame masks, native rounded joins, continuous shadows, no patch smudges, a thin bottom edge and no quadrant seam ('+(process.env.TEST_COLOR||'WG')+').');})();
