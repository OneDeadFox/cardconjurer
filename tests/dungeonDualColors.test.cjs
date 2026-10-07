const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas,Image}=require('@napi-rs/canvas'),w=600,h=840;
function pipeline(color){const c=createCanvas(w,h),p=c.getContext('2d');p.fillStyle=color;for(const y of [20,90,700,760])p.fillRect(43,y,515,8);p.fillRect(43,20,4,748);p.fillRect(554,20,4,748);return c;}
function solid(color){const c=createCanvas(w,h);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return c;}
const mask=createCanvas(w,h),mc=mask.getContext('2d'),gradient=mc.createLinearGradient(240,0,360,0);gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,'rgba(0,0,0,1)');mc.fillStyle=gradient;mc.fillRect(0,0,w,h);
const sources={pipelineW:pipeline('#dc5028'),pipelineG:pipeline('#2864dc'),rulesW:solid('#eeddaa'),rulesG:solid('#448866'),rulesM:solid('#ddaa22'),'/img/frames/maskRightHalf.png':mask};
const card={version:'dungeonModules',width:w,height:h,text:{},frames:[{name:'White Pipeline',src:'pipelineW',templateTheme:{familyId:'pipes',side:'full',masks:[]}},{name:'White',src:'rulesW',templateTheme:{familyId:'rules',side:'full',masks:[]}}],templateThemes:{enabled:true,autoStock:false,families:[{id:'pipes',name:'Embark Pipeline',variants:{w:{src:'pipelineW'},g:{src:'pipelineG'}}},{id:'rules',name:'Embark Rules',variants:{w:{src:'rulesW'},g:{src:'rulesG'},m:{src:'rulesM'}}}]},dungeonModules:[{id:'upper',bounds:{x:.51,y:.11,width:.42,height:.5}},{id:'footer',bounds:{x:.07,y:.61,width:.86,height:.14}}]};
const ctx={card,Image,console,scaleX:()=>0,scaleY:()=>0,fixUri:src=>sources[src]?.toDataURL()||src,addEventListener(){},document:{readyState:'loading',addEventListener(){},createElement:()=>createCanvas(1,1),querySelector:()=>null}};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['dungeonModules','dungeonCorners','templateThemes'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
const pixel=(c,x,y)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data);
(async()=>{
 await ctx.TemplateThemes.apply(card,{colorIdentity:'WG'});
 const material=card.frames[0].dungeonPipelineMaterials;assert.ok(material?.left&&material?.right);
 card.frames[0].dungeonPipelineMaterials=JSON.parse(JSON.stringify(material));
 for(const frame of card.frames)frame.image=await load(frame.src);
 const rules=createCanvas(w,h);rules.getContext('2d').drawImage(card.frames[1].image,0,0);
 assert.deepEqual(pixel(rules,100,400),[238,221,170,255]);assert.deepEqual(pixel(rules,500,400),[68,136,102,255],'Generic layer name uses Rules family, not gold');
 const middle=pixel(rules,300,400);assert.ok(middle[0]>68&&middle[0]<238);
 ctx.frameCanvas=solid('#ffffff');
 const walls=createCanvas(w,h),fx=createCanvas(w,h);ctx.DungeonModules.drawWalls(walls.getContext('2d'),fx.getContext('2d'));
 const footerY=Math.floor(card.dungeonModules[1].bounds.y*h);
 assert.deepEqual(pixel(walls,150,footerY),[220,80,40,255]);assert.deepEqual(pixel(walls,500,footerY),[40,100,220,255]);
 const expected=mc.getImageData(306,300,1,1).data[3]/255,vertical=pixel(walls,306,300);
 assert.ok(Math.abs(vertical[0]-(220*(1-expected)+40*expected))<2&&Math.abs(vertical[2]-(40*(1-expected)+220*expected))<2,'Vertical wall uses destination X mask');assert.equal(vertical[3],255);
 for(const [x,y] of [[296,94],[306,94],[306,100],[45,footerY-5],[45,footerY],[50,footerY]])assert.equal(pixel(walls,x,y)[3],255,'Both T joins remain connected without native strokes at '+x+','+y);
 const door=ctx.DungeonModules.doorways(card.dungeonModules)[0];assert.equal(pixel(walls,Math.round(door.x*w),footerY)[3],0);
 await ctx.TemplateThemes.apply(card,{colorIdentity:'W'});assert.equal(card.frames[0].dungeonPipelineMaterials,undefined);
 console.log('PASS: themed import, rules family classification, serialized materials, complete wall overlays, vertical blend, visible T arms, doors, monocolor reset.');
})().catch(e=>{console.error(e);process.exitCode=1;});
