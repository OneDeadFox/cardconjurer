const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createCanvas,Image,loadImage}=require('@napi-rs/canvas');
const loadedAssets=[];let sequence=0,commits=0;const snapshots=[];
const palette={w:'#eeeedd',u:'#3366cc',b:'#252525',r:'#cc3333',g:'#229955',m:'#ccbb44',a:'#999999',l:'#996633',c:'#bbbbbb',v:'#777777'};
function fixture(src){
 const image=createCanvas(200,280),ctx=image.getContext('2d');const path=src.toLowerCase();
 if(/mask|\/new\/(title|rules|pinline|border)\.png|book\.svg|pinline\.svg/.test(path)){
  ctx.fillStyle='black';
  if(/right.?half/.test(path)){const gradient=ctx.createLinearGradient(90,0,110,0);gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,'black');ctx.fillStyle=gradient;ctx.fillRect(0,0,200,280);}
  else if(/title/.test(path)){if(/battle/.test(path))ctx.fillRect(8,10,184,28);else ctx.fillRect(12,13,176,20);}
  else if(/rules|book/.test(path))ctx.fillRect(14,174,172,86);
  else if(/crown/.test(path))ctx.fillRect(5,5,190,28);
  else {ctx.strokeStyle='black';ctx.lineWidth=3;ctx.strokeRect(10,10,180,260);}
 }else {const key=path.match(/(?:front|back|rules)?([wubrgmalcv])\.png$/)?.[1]||'m';ctx.fillStyle=palette[key];ctx.fillRect(0,0,200,280);if(/cleartextbox/.test(path))ctx.clearRect(14,174,172,86);if(/(?:borderless|genericshowcase)\/m15genericshowcaseframe/.test(path)){ctx.clearRect(14,174,172,86);ctx.fillStyle=/genericshowcase\/m15genericshowcaseframe/.test(path)?palette[key]+'80':'rgba(0,0,0,0.5)';ctx.fillRect(14,174,172,86);ctx.strokeStyle=palette[key];ctx.lineWidth=2;ctx.strokeRect(14,174,172,86);}}
 return image.toBuffer('image/png');
}
class BrowserImage extends Image {set src(value){loadedAssets.push(value);super.src=/^(data:|blob:)/.test(value)?value:fixture(value);}get src(){return super.src;}}
const context={Image:BrowserImage,card:{version:'battle',width:2814,height:2010,frames:[],text:{rules:{name:'Rules Text',text:'Boss ability',x:.1,y:.64,width:.8,height:.2,size:.04},title:{name:'Title',text:'Boss title',x:.19,y:.052,width:.7,height:.05,size:.04}}},
 document:{createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);},querySelector:()=>null},
 ensureDesignLayerId:frame=>frame.designLayerId ||= 'frame-'+ ++sequence,
 createDesignStateSnapshot:()=>JSON.parse(JSON.stringify(context.card,(key,value)=>key==='image'?undefined:value)),
 async applyDesignStateSnapshot(snapshot){Object.assign(context.card,JSON.parse(JSON.stringify(snapshot)));},
 commitDesignUndoSnapshot(before){commits++;snapshots.push(before);},
 async rebuildFrameLayerList(){},drawFrames(){},drawTextBuffer(){},drawCard(){},resetSetSymbol(){},
 loadTextOptions(fields){Object.assign(context.card.text,fields);},
 scaleX:x=>x*context.card.width,scaleY:y=>y*context.card.height,scaleWidth:w=>w*context.card.width,scaleHeight:h=>h*context.card.height,
 RulesRange:{updateElementRelative(){},removeElementReferences(){}},CanvasDesignTools:{editsFrame:()=>false}
};context.window=context;
vm.createContext(context);for(const path of ['js/frameTextPresets.js','js/frameSectionCatalog.js','js/frameSectionTools.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context);
const S=context.FrameSectionTools;
assert.equal(S.role({componentKind:'Component',componentLabel:'White Frame — Title'}),'title','Generic component labels must not hide title controls');
assert.equal(S.role({name:'White Frame',masks:[{name:'Title'},{name:'Right Half'}]}),'title','A masked title layer must expose title controls');
assert.equal(S.role({name:'White Frame',masks:[{name:'Title'},{name:'Rules'}]}),null,'A complete frame must not be treated as one title section');
// Exercise the appearance mount used by the full layer editor and canvas popup.
class Control {
 constructor(){this.options=[];this.controls=new Map();this.value='';}
 appendChild(child){this.options.push(child);}
 insertBefore(child){this.options.push(child);}
 querySelector(selector){if(!this.controls.has(selector))this.controls.set(selector,new Control());return this.controls.get(selector);}
 remove(){}
}
function editor(reference){const controls=new Control();controls.querySelector=selector=>selector===reference?controls.anchor:selector==='.frame-standard-fields'?controls.fields:null;controls.anchor={};controls.fields={};controls.insertBefore=(panel,before)=>{controls.panel=panel;controls.before=before;};return controls;}
const originalCreate=context.document.createElement;context.document.createElement=()=>new Control();
const fullEditor=editor('.frame-editor-number-grid');S.mount(fullEditor,{componentKind:'Title',name:'White Title',src:'/original/w.png',bounds:{x:0,y:0,width:1,height:1},masks:[]});assert.equal(fullEditor.before,fullEditor.anchor,'Title choices must appear before image geometry controls');assert.ok(fullEditor.panel.innerHTML.includes('Title appearance'));assert.ok(fullEditor.panel.querySelector('[data-section-style]').options.some(option=>option.value==='transform-back'),'Title menu exposes transform back style');
const popup=editor('.frame-standard-fields');S.mount(popup,{componentKind:'Title',masks:[]});assert.equal(popup.before,popup.anchor,'Canvas popup keeps appearance before standard field insertion');
context.document.createElement=originalCreate;
function layer(name,color,extra=[]){return{name:color+' Frame — '+name,componentKind:name,src:'/original/'+color+'.png',bounds:{x:.03,y:.02,width:.94,height:.95},rotation:0,opacity:100,masks:[{name,src:'/original/mask'+name+'.png'},...extra]};}
(async()=>{
 const left=layer('Rules','w'),right=layer('Rules','g',[{name:'Right Half',src:'/original/maskRightHalf.png'}]),pinline=layer('Pinline','g');context.card.frames=[right,left,pinline];
 context.ensureDesignLayerId(right);context.ensureDesignLayerId(left);const anchorBefore={...context.card.text.rules};
 context.card.text.rules.frameAnchor={id:left.designLayerId,last:{...left.bounds,rotation:0}};
 const base=await S.originalRectangle(right,'rules');
 assert.equal(await S.apply(right,{role:'rules',style:'regular',left:'w',right:'g',opacity:45,pinlines:true}),true);
 assert.equal(context.card.frames.length,2,'Split pieces compose into one stable section');assert.equal(right.opacity,45);
 assert.equal(context.card.text.rules.text,'Boss ability');assert.equal(context.card.text.rules.x,anchorBefore.x);
 assert.equal(context.card.text.rules.frameAnchor.id,right.designLayerId);
 assert.equal(pinline.sectionCutouts.length,1);assert.equal(right.sectionAppearance.baseBounds.x,base.x);
 assert.ok(right.src.startsWith('data:image/png;base64,'));
 // Two colors are preserved in the resulting PNG before opacity is applied once.
 const bitmap=createCanvas(right.image.width,right.image.height);bitmap.getContext('2d').drawImage(right.image,0,0);
 const a=bitmap.getContext('2d').getImageData(10,20,1,1).data,b=bitmap.getContext('2d').getImageData(bitmap.width-10,20,1,1).data;
 assert.ok(a[0]>b[0]);assert.equal(a[3],b[3]);
 assert.equal(await S.apply(right,{role:'rules',style:'clear',left:'w',opacity:100,pinlines:false}),true,'Fully transparent sections are valid');const clearPixels=createCanvas(right.image.width,right.image.height);clearPixels.getContext('2d').drawImage(right.image,0,0);assert.equal(clearPixels.getContext('2d').getImageData(20,20,1,1).data[3],0);
 const borderless=context.FrameSectionCatalog.styles.find(style=>style.id==='borderless');assert.equal(borderless.sourcePack,'GenericShowcase');assert.equal(context.FrameSectionCatalog.styles.find(style=>style.id==='borderless-alt').sourcePack,'Borderless');assert.ok(borderless.label.includes('Borderless'));
 const transparent=await S.renderStyle(borderless,'rules','u','r',true,false),transparentImage=await loadImage(transparent.src);const transparentPixels=createCanvas(transparentImage.width,transparentImage.height),tc=transparentPixels.getContext('2d');tc.drawImage(transparentImage,0,0);
 const interior=tc.getImageData(transparentImage.width/4,transparentImage.height/2,1,1).data;assert.equal(interior[3],128,'Original translucent interior must remain translucent');assert.ok(interior[2]>interior[0],'Borderless interior must be colored blue, not black');const redInterior=tc.getImageData(transparentImage.width*3/4,transparentImage.height/2,1,1).data;assert.ok(redInterior[0]>redInterior[2],'Split interior must retain its red tint');const edge=tc.getImageData(0,transparentImage.height/2,1,1).data;assert.ok(edge[2]>edge[0],'Blue edge survives section extraction');const redEdge=tc.getImageData(transparentImage.width-1,transparentImage.height/2,1,1).data;assert.ok(redEdge[0]>redEdge[2],'Split red edge survives section extraction');
 assert.equal(await S.apply(right,{role:'rules',style:'borderless',left:'u',right:'r',opacity:100,pinlines:true}),true);assert.equal(context.card.text.rules.text,'Boss ability');assert.equal(right.sectionAppearance.baseBounds.x,base.x);
 const midpoint=tc.getImageData(transparentImage.width/2,transparentImage.height/2,1,1).data;
 assert.equal(midpoint[3],128,'Blending must not stack opacity or create a transparent seam');assert.ok(midpoint[0]>interior[0]&&midpoint[0]<redInterior[0],'Center transitions between both colors');assert.ok(midpoint[2]<interior[2]&&midpoint[2]>redInterior[2],'Center retains both colors');
 const sameColor=await S.renderStyle(borderless,'rules','u','u',true,false),sameImage=await loadImage(sameColor.src),sameCanvas=createCanvas(sameImage.width,sameImage.height);sameCanvas.getContext('2d').drawImage(sameImage,0,0);assert.deepEqual(Array.from(sameCanvas.getContext('2d').getImageData(sameImage.width/2,sameImage.height/2,1,1).data),Array.from(interior),'Identical colors must blend invisibly');
 assert.equal(await S.apply(right,{role:'rules',style:'adventure',left:'u',opacity:60,pinlines:false}),true);
 assert.equal(pinline.sectionCutouts.length,0,'Disabling matched pinlines restores the original ones');
 const beforeContent=context.card.text.rules.text;S.insertFields(right);assert.equal(context.card.text.rules.text,beforeContent);
 for(const key of ['mana2','title2','type2','rules2'])assert.ok(context.card.text[key]);
 assert.equal(context.card.version,'battle','Section presets never load another card layout');
 const field=context.card.text.rules2,oldX=field.x;right.bounds.x+=.04;S.sync();context.FrameTextPresets.sync();assert.ok(Math.abs(field.x-oldX-.04)<1e-8,'Preset fields follow movement');
 const oldBase=right.sectionAppearance.baseBounds.x;
 assert.equal(await S.apply(right,{role:'rules',style:'prototype',left:'r',opacity:50}),true);assert.ok(Math.abs(right.sectionAppearance.baseBounds.x-oldBase)<1e-8,'Repeated swaps keep the moved layout');
 S.insertFields(right);assert.ok(context.card.text.prototype);assert.ok(context.card.text.pt2);
 assert.equal(await S.apply(right,{role:'rules',style:'browse',left:'g',browseResource:{src:'/other/g.png',bounds:{x:0,y:0,width:1,height:1},masks:[{name:'Rules',src:'/other/maskRules.png'}]},pinlines:false}),true);assert.equal(context.card.version,'battle');assert.equal(await S.apply(right,{role:'rules',style:'browse',left:'g',pinlines:false}),true,'Saved Browse appearance can be reapplied without its original asset');
 // A title's crown can be added, recolored and removed without moving the banner.
 const title=layer('Title','w'),border=layer('Border','w');context.card.frames.push(title,border);const titleBase=await S.originalRectangle(title,'title');
 assert.equal(await S.apply(title,{role:'title',style:'transform-front',left:'g',crown:true,pinlines:true}),true);
 assert.equal(title.sectionAppearance.baseBounds.y,titleBase.y);assert.ok(title.bounds.y<titleBase.y);
 assert.equal(context.card.text.title.text,'Boss title');assert.equal(border.sectionCutouts.length,1);
 assert.ok(title.sectionAppearance.iconBounds);
 assert.equal(await S.apply(title,{role:'title',style:'regular',left:'w',crown:false,pinlines:false}),true);
 assert.equal(border.sectionCutouts.length,0);assert.equal(title.sectionAppearance.baseBounds.y,titleBase.y);
 // Battle uses the left-symbol transform crown and maps its native region to the landscape title.
 const battleTitle=layer('Title','u'),backSymbol={bossTitleOwner:'battle-title',bossSymbolFace:'back',src:'custom-back-symbol',bounds:{x:0,y:0,width:.05,height:.05}};context.card.frames.push(battleTitle,backSymbol);const battleBase=await S.originalRectangle(battleTitle,'title');
 assert.equal(await S.apply(battleTitle,{role:'title',style:'battle',left:'u',crown:true,pinlines:true}),true);
 assert.ok(context.card.frames.includes(backSymbol));assert.equal(backSymbol.bossSymbolFace,'back');assert.equal(backSymbol.bossTitleOwner,battleTitle.designLayerId);assert.equal(backSymbol.bounds.x,battleTitle.sectionAppearance.iconBounds.x);assert.ok(loadedAssets.includes('/img/frames/m15/transform/crowns/regular/u.png'),'Battle must use transform-front crown artwork');assert.equal(battleTitle.sectionAppearance.baseBounds.y,battleBase.y);assert.ok(battleTitle.bounds.y<battleBase.y);
 const crownedWidth=battleTitle.bounds.width;battleTitle.bounds.width*=.8;S.sync();const movedBase=battleTitle.sectionAppearance.baseBounds.width;assert.equal(await S.apply(battleTitle,{role:'title',style:'battle',left:'u',crown:true,pinlines:true}),true);assert.ok(Math.abs(battleTitle.sectionAppearance.baseBounds.width-movedBase)<1e-8);assert.ok(Math.abs(battleTitle.bounds.width-crownedWidth*.8)<1e-8,'Reapplying a crown preserves the resized title');
 assert.equal(await S.apply(battleTitle,{role:'title',style:'transform-back',left:'u',crown:true,pinlines:false}),true);assert.ok(loadedAssets.includes('/img/frames/m15/transform/crowns/regular/new/u.png'),'Back title uses the back transform crown');
 // Crown-only actions preserve uploaded/custom title artwork and all title settings.
 const customTitle={name:'Custom Battle Title',componentKind:'Title',src:'/custom/my-title.png',bounds:{x:.2,y:.12,width:.65,height:.08},rotation:7,masks:[{name:'Title',src:'/custom/maskTitle.png'}],opacity:72},customBorder={name:'Border',componentKind:'Border',src:'/custom/border.png',bounds:{x:.2,y:.12,width:.65,height:.08},rotation:7,masks:[]};context.ensureDesignLayerId(customTitle);context.card.frames.push(customTitle,customBorder);
 const originalTitle=JSON.stringify(customTitle),originalText=JSON.stringify(context.card.text);
 assert.equal(await S.changeCrown(customTitle,{left:'u',right:'g',pinlines:false}),true);
 assert.equal(JSON.stringify(customTitle),originalTitle,'Adding a crown must not rewrite the selected title');assert.equal(JSON.stringify(context.card.text),originalText,'Crown editing must not move text or alter typography');
 const addedCrown=context.card.frames.find(item=>item.sectionCrown?.owner===customTitle.designLayerId);assert.ok(addedCrown);assert.equal(addedCrown.sectionCrown.right,'g');const savedCrown=JSON.parse(JSON.stringify(addedCrown,(key,value)=>key==='image'?undefined:value));assert.equal(savedCrown.sectionCrown.owner,customTitle.designLayerId);assert.ok(savedCrown.src.startsWith('data:image/png'));assert.ok(customBorder.sectionCutouts.some(cut=>cut.owner===addedCrown.designLayerId));
 assert.equal(await S.changeCrown(customTitle,{left:'r',pinlines:true}),true);assert.equal(JSON.stringify(customTitle),originalTitle);assert.equal(context.card.frames.filter(item=>item.sectionCrown?.owner===customTitle.designLayerId).length,1,'Updating replaces only the crown');
 const attached=context.card.frames.find(item=>item.sectionCrown?.owner===customTitle.designLayerId),oldCrownX=attached.bounds.x;customTitle.bounds.x+=.03;S.sync();assert.ok(Math.abs(attached.bounds.x-oldCrownX-.03)<1e-8,'Crown follows its title');customTitle.bounds.x-=.03;S.sync();
 assert.equal(await S.changeCrown(customTitle,{remove:true}),true);assert.equal(JSON.stringify(customTitle),originalTitle);assert.ok(!context.card.frames.some(item=>item.sectionCrown?.owner===customTitle.designLayerId));assert.equal(customBorder.sectionCutouts.length,0,'Removing crown restores border');
 // Black backing is independent of title opacity and travels with the crown PNG.
 assert.equal(await S.changeCrown(customTitle,{type:'regular',left:'u',pinlines:false,backing:true}),true);
 const backed=context.card.frames.find(item=>item.sectionCrown?.owner===customTitle.designLayerId),backedImage=await loadImage(backed.src),backedCanvas=createCanvas(backedImage.width,backedImage.height);backedCanvas.getContext('2d').drawImage(backedImage,0,0);assert.deepEqual(Array.from(backedCanvas.getContext('2d').getImageData(backedImage.width/2,0,1,1).data),[0,0,0,255],'Backing must be solid black behind the crown');assert.equal(backed.opacity,100,'Backing remains opaque even with a translucent title');assert.equal(JSON.stringify(customTitle),originalTitle);
 assert.equal(await S.changeCrown(customTitle,{type:'regular',left:'u',pinlines:false,backing:false}),true);const uncovered=context.card.frames.find(item=>item.sectionCrown?.owner===customTitle.designLayerId);assert.equal(uncovered.sectionCrown.backing,false);assert.notEqual(uncovered.src,backed.src,'Disabling backing rebuilds the crown without the cover');assert.equal(await S.changeCrown(customTitle,{remove:true}),true);assert.ok(!context.card.frames.some(item=>item.sectionCrown?.owner===customTitle.designLayerId),'Removing the crown also removes its backing');
 // Legacy baked crowns recover the saved title style, never the pending UI choice.
 const previousStyle=battleTitle.sectionAppearance.style;assert.equal(await S.changeCrown(battleTitle,{remove:true}),true);assert.equal(battleTitle.sectionAppearance.style,previousStyle);assert.equal(battleTitle.sectionAppearance.crown,false);
 // Missing colors fail atomically without removing a user's layout.
 const beforeFailure=JSON.stringify(context.card,(key,value)=>key==='image'?undefined:value);
 assert.equal(await S.apply(title,{role:'title',style:'clear',left:'v'}),false);
 assert.equal(JSON.stringify(context.card,(key,value)=>key==='image'?undefined:value),beforeFailure);
 assert.ok(commits>=5);assert.equal(snapshots[0].frames.length,3,'Undo snapshot includes original separate color layers');
 const saved=JSON.parse(JSON.stringify(context.card,(key,value)=>key==='image'?undefined:value));assert.ok(saved.frames.find(frame=>frame.sectionAppearance)?.src.startsWith('data:'));
 const liveTitle=context.card.frames.find(item=>item.designLayerId===customTitle.designLayerId);const beforeBadCrown=JSON.stringify(context.card,(key,value)=>key==='image'?undefined:value);assert.equal(await S.changeCrown(liveTitle,{left:'v'}),false);assert.equal(JSON.stringify(context.card,(key,value)=>key==='image'?undefined:value),beforeBadCrown,'Failed crown updates restore the previous crown and title');
 console.log('PASS: shared section swaps, split composition, geometry/content preservation, pinline/crown removal, preset fields, movement, rollback and serializable assets.');
})().catch(error=>{console.error(error);process.exitCode=1;});
