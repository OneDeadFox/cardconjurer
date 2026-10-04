const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let count=0;
const ctx={card:{width:2814,height:2010,text:{pt:{text:'8/8'}},frames:[]},ensureDesignLayerId:frame=>frame.designLayerId ||= 'frame-'+ ++count,
 createDesignStateSnapshot:()=>({}),commitDesignUndoSnapshot(){},loadTextOptions(fields){Object.assign(ctx.card.text,fields);},drawTextBuffer(){},drawCard(){},resetSetSymbol(){}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/frameTextPresets.js','utf8'),ctx);
const P=ctx.FrameTextPresets,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fieldFor(frame){return Object.values(ctx.card.text).find(field=>field.frameAnchor?.id===frame.designLayerId&&field.standardRole==='pt');}
function checkBadge(frame,cropped){ctx.card.frames.push(frame);P.insert(frame,'pt',cropped);const field=fieldFor(frame),b=frame.bounds;
 assert.ok(field.x>=b.x&&field.x+field.width<=b.x+b.width);assert.ok(field.y>=b.y&&field.y+field.height<=b.y+b.height);
 assert.ok(field.width>b.width*.6);assert.ok(field.height>b.height*.45);assert.ok(field.size>b.height*.45);return field;}
// Old Browse layer: source layout metadata uses full-card geometry.
const browse={src:'/img/frames/m15/regular/m15PTG.png',name:'Green Power/Toughness',bounds:{x:.891,y:.874,width:.093,height:.071},designTextLayout:{text:{pt:{x:.7928,y:.902,width:.1367,height:.0372,size:.0372}}}};
let field=checkBadge(browse,false);assert.equal(field.text,'8/8');assert.equal(field.rotation,0);const initial={...field};
// Both dropdown choices produce badge-relative geometry for known cropped artwork.
P.insert(browse,'pt',true);field=fieldFor(browse);near(field.x,initial.x);near(field.size,initial.size);
const boss={bossStats:true,name:'Boss Power/Toughness',src:'asset://custom',bounds:{x:.87,y:.85,width:.11,height:.07}};checkBadge(boss,false);
const custom={name:'Custom P/T',bounds:{x:.2,y:.3,width:.15,height:.07},masks:[]};checkBadge(custom,false);
const resource={name:'M15 P/T',src:'/img/frames/m15/regular/m15PTW.png',bounds:{x:.85,y:.82,width:.1,height:.065},designTextLayout:{coordinateSpace:'component',text:{pt:{x:.08,y:.18,width:.84,height:.64,size:.6}}}};
field=checkBadge(resource,false);near(field.x,.858);near(field.size,.039);
// Existing text follows movement/scaling, rather than returning to full-card coordinates.
const oldX=field.x,oldSize=field.size;resource.bounds.x+=.03;resource.bounds.height*=1.5;P.sync();near(field.x,oldX+.03);near(field.size,oldSize*1.5);
// Uncropped source masks still use full-card placement.
const full={name:'Frame — Power/Toughness',bounds:{x:0,y:0,width:1,height:1},masks:[{name:'Power/Toughness'}]};ctx.card.frames.push(full);P.insert(full,'pt',false);field=fieldFor(full);near(field.x,.7928);near(field.y,.902);near(field.size,.0372);
// The popup selects P/T and cropped artwork for the constructor's P/T label.
const controls={'.preset-kind':{value:''},'.preset-layout':{value:'full'},'.preset-add':{}};const panel={querySelector:selector=>controls[selector]};P.mount({querySelector:()=>panel},{...resource,name:'M15 P/T — White',componentKind:'Power/Toughness'});assert.equal(controls['.preset-kind'].value,'pt');assert.equal(controls['.preset-layout'].value,'cropped');
// Standard portrait badge exactly reproduces the existing standard text geometry.
ctx.card.width=2010;ctx.card.height=2814;const normal={src:'/img/frames/m15/regular/m15PTM.png',bounds:{x:.7573,y:.8848,width:.188,height:.0733}};checkBadge(normal,false);field=fieldFor(normal);near(field.x,.7928);near(field.y,.902);near(field.width,.1367);near(field.height,.0372);near(field.size,.0372);
console.log('PASS: P/T text placement for Browse, Boss, constructor, custom and full-card masked frames; content and scaling preserved.');
