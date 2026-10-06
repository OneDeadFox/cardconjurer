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
console.log('PASS: pipeline wall sampling, split colors, art T-junctions, authored corners and custom texture fallback.');
