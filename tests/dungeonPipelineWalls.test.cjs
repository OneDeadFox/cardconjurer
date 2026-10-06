const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const card={width:600,height:840,dungeonWallColor:'U',frames:[{name:'Custom Pipeline',image:{naturalWidth:600,naturalHeight:840}}],dungeonModules:[{id:'top',bounds:{x:.51,y:.11,width:.42,height:.5}},{id:'footer',bounds:{x:.07,y:.61,width:.86,height:.14}}]};
const pixels=new Uint8ClampedArray(600*840*4);
for(let y=20;y<28;y++)for(let x=0;x<600;x++){const i=(y*600+x)*4;pixels[i]=x<300?30:70;pixels[i+1]=x<300?100:180;pixels[i+2]=x<300?200:80;pixels[i+3]=255;}
const gradients=[];
const drawing=new Proxy({createLinearGradient(){const stops=[];gradients.push(stops);return{addColorStop:(p,c)=>stops.push([p,c])};}}, {get:(o,k)=>k in o?o[k]:()=>{}});
const ctx={card,scaleX:()=>0,scaleY:()=>0,document:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:pixels})})}),querySelector:()=>null}};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['js/dungeonModules.js','js/dungeonCorners.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
assert.equal(ctx.DungeonModules.drawWalls(drawing,drawing),true);
assert.ok(gradients.some(stops=>stops.some(([p,c])=>p<.5&&c.includes('30,100,200'))&&stops.some(([p,c])=>p>.5&&c.includes('70,180,80'))),'Wall gradients retain both colors of composed pipeline');
const nodes=ctx.DungeonCorners.collect();assert.ok(nodes.some(n=>n.settings.style==='t-down'));assert.ok(nodes.some(n=>n.settings.style==='t-right'));
card.dungeonModules[0].cornerStyles={tl:{style:'rounded',size:.02,fades:{}}};assert.ok(ctx.DungeonCorners.collect().some(n=>n.settings.style==='rounded'),'Authored corner selection preserved');
card.dungeonWallColor='custom';assert.equal(ctx.DungeonModules.drawWalls(drawing,drawing),false,'Explicit custom wall texture remains available');
// Distinct source edges verify geometry migration and edge-specific material selection.
for(const [start,end,color] of [[90,98,[100,50,30]],[700,708,[200,150,40]]])for(let y=start;y<end;y++)for(let x=0;x<600;x++){const i=(y*600+x)*4;pixels.set([...color,255],i);}
for(const start of [43,554])for(let x=start;x<start+4;x++)for(let y=20;y<708;y++)pixels.set([40,70,90,255],(y*600+x)*4);
card.frames[0].image={naturalWidth:600,naturalHeight:840};card.dungeonWallColor='pipeline';const fixedTop=card.dungeonModules[1].bounds.y;
assert.equal(ctx.DungeonModules.drawWalls(drawing,drawing),true);const footer=card.dungeonModules[1].bounds;
assert.equal(footer.y,fixedTop);assert.ok(Math.abs(footer.x-45/600)<1e-9);assert.ok(Math.abs(footer.y+footer.height-704/840)<1e-9);
assert.ok(gradients.some(stops=>stops.some(([p,c])=>c.includes('100,50,30'))),'Top wall uses title-bottom strip');
assert.ok(gradients.some(stops=>stops.some(([p,c])=>c.includes('200,150,40'))),'Bottom wall uses typeline-top strip');
assert.ok(gradients.some(stops=>stops.some(([p,c])=>c.includes('40,70,90'))),'Vertical walls use vertical pipeline strip');
const aligned=JSON.stringify(card.dungeonModules.map(r=>r.bounds));ctx.DungeonModules.drawWalls(drawing,drawing);assert.equal(JSON.stringify(card.dungeonModules.map(r=>r.bounds)),aligned);
// Rendered frame supplies bevels outside the uploaded flat-color strip.
const finished=pixels.slice();for(let y=87;y<90;y++)for(let x=0;x<600;x++)finished.set([10,20,30,255],(y*600+x)*4);
for(let x=558;x<561;x++)for(let y=20;y<708;y++)finished.set([15,25,35,255],(y*600+x)*4);
ctx.frameCanvas={width:600,height:840};let created=0;
ctx.document.createElement=()=>{const data=(created++%2)?finished:pixels;return{getContext:()=>({drawImage(){},getImageData:()=>({data})})};};
card.dungeonModules.forEach(room=>room.pipelineAligned=2);const originalFooterY=footer.y;ctx.DungeonModules.drawWalls(drawing,drawing);
assert.equal(footer.y,originalFooterY);assert.ok(card.dungeonModules.every(room=>room.pipelineAligned===3),'Previously aligned templates receive updated geometry');
assert.ok(Math.abs(card.dungeonModules[0].bounds.y-92.5/840)<1e-9,'Top follows the complete rendered stroke, including its outline');
assert.ok(gradients.some(stops=>stops.some(([p,c])=>c.includes('15,25,35'))),'Art-side walls include the rendered right-edge shading');
console.log('PASS: pipeline strips, rendered bevels, native thickness, updated saved bounds, fixed final-row top, split colors and editable junctions.');
