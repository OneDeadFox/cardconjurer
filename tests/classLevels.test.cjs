const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const history=[];
const savedText={};
let sequence=0, failNextImage=false;
const ctx=vm.createContext({
  console,Date,Math,Map,Set,
  card:{version:'classRange',width:1500,height:2100,text:{},frames:[],rulesRanges:[]},
  loadedVersions:[],
  document:{readyState:'loading',addEventListener(){},querySelector(){return null;},createElement(){return {getContext:()=>({measureText:t=>({width:t.length*15})})};}},
  addEventListener(){},
  drawCard(){},drawFrames(){},drawTextBuffer(){},
  ensureDesignLayerId:frame=>frame.designLayerId||(frame.designLayerId='layer-'+(++sequence)),
  cloneDesignFrameDefinition:frame=>JSON.parse(JSON.stringify(frame,(key,value)=>key==='image'?undefined:value)),
  loadTextOptions:(definitions,replace=false)=>{
    for(const [key,item]of Object.entries(ctx.card.text))savedText[key]=item.text;
    ctx.card.text=replace?definitions:Object.assign(ctx.card.text,definitions);
    for(const [key,item]of Object.entries(ctx.card.text))if(savedText[key])item.text=savedText[key];
  },
  customTemplateFieldKey:(label,kind,keys)=>{let key=label.replace(/\W/g,'');while(keys.includes(key))key+='x';return key;},
  addFrame:async()=>{if(failNextImage){failNextImage=false;throw Error('Image load failed');}},
  createDesignStateSnapshot:()=>clone(ctx.card),
  commitDesignUndoSnapshot:(before,label)=>history.push({before,label}),
  applyDesignStateSnapshot:async snapshot=>{ctx.card=clone(snapshot);},
  RulesTextStyles:{refreshModule(){}},
  CanvasDesignTools:{editsFrame:()=>false},
  Image:class{set src(value){this.source=value;}},
  fixUri:value=>value,
  layoutHighlightHitAreas:[],
  previewCanvas:{width:750},
  previewLayoutBounds:b=>({x:b.x*750,y:b.y*1050,width:b.width*750,height:b.height*1050}),
  pointInsideLayoutRectangle:(p,r,padding=0)=>p.x>=r.x-padding&&p.x<=r.x+r.width+padding&&p.y>=r.y-padding&&p.y<=r.y+r.height+padding,
});
ctx.window=ctx;
vm.runInContext(read('js/rulesRange.js'),ctx);
vm.runInContext(read('js/classLevels.js'),ctx);
vm.runInContext(read('js/frames/versionClassRange.js'),ctx);
const pack=read('js/frames/packClassRange.js');
vm.runInContext(pack.slice(pack.indexOf('loadTextOptions({'),pack.indexOf('\n\tawait initializeClassRulesRange()')),ctx);

(async()=>{
  await ctx.initializeClassRulesRange();
  let range=ctx.ClassLevels.range();
  assert.equal(range.modules.length,3,'new Classes begin with three levels');
  const third=range.modules[2],bannerEntry=third.elements.find(e=>e.role==='banner');
  let banner=ctx.card.frames.find(f=>f.designLayerId===bannerEntry.key);
  const originalBounds=clone(banner.bounds),originalId=banner.designLayerId;
  await ctx.ClassLevels.replace(banner,'data:image/png;base64,custom');
  assert.deepEqual(clone(banner.bounds),originalBounds,'replacement preserves geometry');
  assert.equal(banner.designLayerId,originalId,'replacement preserves element identity');
  assert.equal(third.elements.find(e=>e.role==='banner').key,originalId);
  assert.ok(ctx.card.frames.some(f=>f!==banner&&f.src==='/img/frames/class/header.png'),'replacement is local');
  const cost=third.elements.find(e=>e.role==='cost'),ability=third.elements.find(e=>e.role==='ability');
  ctx.card.text[cost.key].text='{4}:';ctx.card.text[ability.key].text='Original ability';
  ability.textFamilyId='shared-style';
  const extra={name:'Custom note',text:'Extra content',x:range.bounds.x,y:range.bounds.y,width:.12,height:.03,size:.02};
  ctx.card.text.note=extra;third.elements.push({kind:'text',key:'note',role:'extra',owned:true,offset:{x:5,y:90,width:180,height:63}});
  await ctx.ClassLevels.add();
  assert.equal(range.modules.length,4);
  const fourth=range.modules[3],fourthBanner=ctx.card.frames.find(f=>f.designLayerId===fourth.elements.find(e=>e.role==='banner').key);
  assert.equal(fourthBanner.src,banner.src,'new level inherits custom banner');
  assert.equal(fourth.elements.length,third.elements.length,'new level inherits extra elements');
  assert.notEqual(fourthBanner.visualFamilyId,banner.visualFamilyId,'appearance edits remain independent after copying');
  for(const e of fourth.elements.filter(e=>e.kind==='text'))assert.equal(ctx.card.text[e.key].text,e.role==='title'?'Level 4':'','new level starts with blank content');
  assert.ok(fourth.elements.every(e=>!e.textFamilyId),'copied fields are not silently linked to a style family');
  assert.equal(ctx.card.text[ability.key].text,'Original ability');
  await ctx.ClassLevels.add();assert.equal(range.modules.length,4,'four-level cap is enforced');
  const created=clone(fourth.elements);
  ctx.ClassLevels.remove(fourth.id);
  assert.equal(range.modules.length,3);
  for(const e of created)assert.ok(e.kind==='text'?!ctx.card.text[e.key]:!ctx.card.frames.some(f=>f.designLayerId===e.key),'whole-level removal removes all owned elements');
  await ctx.applyDesignStateSnapshot(history.pop().before);range=ctx.ClassLevels.range();
  assert.equal(range.modules.length,4,'undo restores entire deleted level');
  for(const e of created)assert.ok(e.kind==='text'?ctx.card.text[e.key]:ctx.card.frames.some(f=>f.designLayerId===e.key));
  ctx.ClassLevels.remove(range.modules[3].id);
  await ctx.applyDesignStateSnapshot(history.findLast(item=>item.label==='Add Class level').before);range=ctx.ClassLevels.range();
  assert.equal(range.modules.length,3,'undoing creation restores previous section count');
  for(const e of created)assert.ok(e.kind==='text'?!ctx.card.text[e.key]:!ctx.card.frames.some(f=>f.designLayerId===e.key),'undoing creation leaves no orphan elements');
  const renamed=range.modules[2];
  const title=renamed.elements.find(e=>e.role==='title');ctx.card.text[title.key].text='Custom title';
  ctx.ClassLevels.remove(range.modules[1].id);range=ctx.ClassLevels.range();
  assert.equal(range.modules[1].level,2);assert.equal(ctx.card.text[title.key].text,'Custom title','renumbering preserves custom titles');
  ctx.ClassLevels.remove(range.modules[1].id);range=ctx.ClassLevels.range();
  assert.equal(range.modules.length,1);
  await ctx.ClassLevels.add();assert.equal(range.modules.length,2,'adding after only Level 1 remains uses stored later-level design');
  assert.ok(range.modules[1].elements.some(e=>e.role==='banner'));
  const beforeFailure=clone(ctx.card);failNextImage=true;await ctx.ClassLevels.add();
  assert.deepEqual(clone(ctx.card),beforeFailure,'failed creation rolls back partially created elements');
  range=ctx.ClassLevels.range();
  ctx.card.frames.push({designLayerId:'base',src:'/img/frames/class/u.png',bounds:{x:0,y:0,width:1,height:1}});
  banner=ctx.card.frames.find(f=>f.classRangeBanner);
  await ctx.ClassLevels.replace(banner,'data:image/png;base64,blue');
  await ctx.ClassLevels.addAppearance(banner,'w','data:image/png;base64,white');
  const layoutBefore=clone(range.modules),textBefore=clone(ctx.card.text),boundsBefore=clone(ctx.card.frames.map(f=>f.bounds));
  ctx.ClassLevels.applyVariant('w');
  assert.equal(banner.src,'data:image/png;base64,white');
  assert.equal(ctx.card.frames.find(f=>f.designLayerId==='base').src,'/img/frames/class/w.png');
  assert.deepEqual(clone(range.modules),layoutBefore);assert.deepEqual(clone(ctx.card.text),textBefore);assert.deepEqual(clone(ctx.card.frames.map(f=>f.bounds)),boundsBefore,'theme changes preserve layout');
  banner.fixedAppearance=true;ctx.ClassLevels.applyVariant('u');assert.equal(banner.src,'data:image/png;base64,white','fixed appearances remain unchanged');
  banner.fixedAppearance=false;ctx.ClassLevels.applyVariant('g');assert.equal(banner.src,'data:image/png;base64,white','missing appearances keep the existing asset');
  const restored=cloneDesign(banner);await ctx.ClassLevels.replace(banner,'data:image/png;base64,replacement');ctx.ClassLevels.restoreAppearance(banner,restored);assert.equal(banner.src,restored.src,'appearance restoration restores the source and family');
  const saved=clone(ctx.card);ctx.card=clone(saved);assert.deepEqual(clone(ctx.ClassLevels.range().visualFamilies),saved.rulesRanges[0].visualFamilies,'asset associations are serializable with the layout');
  await ctx.ClassLevels.add();range=ctx.ClassLevels.range();
  const source=range.modules[1],destination=range.modules[2];
  const destinationAbility=destination.elements.find(e=>e.role==='ability');ctx.card.text[destinationAbility.key].text='Keep this ability';
  const sourceAbility=source.elements.find(e=>e.role==='ability');ctx.card.text[sourceAbility.key].fontSize=-9;
  await ctx.ClassLevels.applyDesignToOthers(source);range=ctx.ClassLevels.range();
  const changed=range.modules[2].elements.find(e=>e.role==='ability');assert.equal(ctx.card.text[changed.key].fontSize,-9);assert.equal(ctx.card.text[changed.key].text,'Keep this ability','explicit shared-design action preserves other levels’ content');
  ctx.ClassLevels.select(range.modules[2].id);await ctx.ClassLevels.add(true);
  const duplicate=range.modules[3],duplicateAbility=duplicate.elements.find(e=>e.role==='ability');
  assert.equal(ctx.card.text[duplicateAbility.key].text,'Keep this ability','Duplicate level copies content as well as design');
  ctx.ClassLevels.select(duplicate.id);ctx.ClassLevels.move(-1);
  assert.equal(range.modules[2].id,duplicate.id);assert.equal(duplicate.level,3,'reordering renumbers levels');
  const duplicateTitle=duplicate.elements.find(e=>e.role==='title');assert.equal(ctx.card.text[duplicateTitle.key].text,'Level 3');
  const box=ctx.RulesRange.getModuleLayouts(range)[2].bounds;
  ctx.card.text.canvasExtra={name:'Canvas text',text:'',x:box.x+.01,y:box.y+.01,width:.02,height:.02,size:.02};
  assert.equal(ctx.ClassLevels.attachCreatedElement('text','canvasExtra',ctx.card.text.canvasExtra),true);
  assert.ok(duplicate.elements.some(e=>e.key==='canvasExtra'&&e.owned),'canvas-created elements belong to their containing level');
  assert.equal(ctx.ClassLevels.attachCreatedElement('text','outside',{x:0,y:0,width:.01,height:.01}),false,'elements outside the Class area remain independent');
  console.log('PASS: Class defaults, inherited design, cap, atomic deletion/undo, renumbering, fallback, rollback, variants, persistence and explicit shared editing.');
})().catch(error=>{console.error(error);process.exitCode=1;});
function cloneDesign(frame){return JSON.parse(JSON.stringify(frame,(key,value)=>key==='image'?undefined:value));}
