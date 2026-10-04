const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const selectors={'#frame-resource-texture':{value:'builtin:m15-pt-green'},'#frame-resource-mask':{value:'0'},'#frame-resource-status':{classList:{toggle(){}}}};
const added=[];
const context={card:{version:'battle',orientation:'landscape',orientationRotation:0,width:2814,height:2010,frames:[],text:{}},
 ensureDesignLayerId(frame){return frame.designLayerId ||= 'pt-test';},createDesignStateSnapshot:()=>({}),commitDesignUndoSnapshot(){},loadTextOptions(fields){Object.assign(context.card.text,fields);},drawTextBuffer(){},drawCard(){},
 availableFrames:[],selectedFrameIndex:7,selectedMaskIndex:5,
 document:{querySelector:selector=>selectors[selector]||null},
 FrameProjectStore:{getAssets:()=>[]},
 async addFrame(masks){assert.equal(context.selectedMaskIndex,0,'Constructor uses its own mask selection');const frame=JSON.parse(JSON.stringify(context.availableFrames[context.selectedFrameIndex]));added.push({frame,masks});}};
context.window=context;context.addEventListener=()=>{};
vm.createContext(context);
// Provide the resource-picker options without mounting the unrelated library UI.
const source=fs.readFileSync('js/frameResourceLibrary.js','utf8').replace('\tinit();\n})();','\tvisibleMasks = BUILT_IN_MASKS.slice();\n})();');
vm.runInContext(source,context);
vm.runInContext(fs.readFileSync('js/frameTextPresets.js','utf8'),context);
(async()=>{
 await context.FrameResourceLibrary.createLayer();let frame=added.at(-1).frame;
 assert.equal(frame.rotation,0);assert.equal(frame.orientationPrepared,'landscape');assert.equal(frame.bounds.x,.891);
 assert.ok(Math.abs((frame.bounds.width*2814)/(frame.bounds.height*2010)-377/206)<1e-8,'Battle badge preserves source proportions');
 assert.ok(frame.bounds.width<.15&&frame.bounds.height<.1);assert.equal(context.selectedFrameIndex,7);assert.equal(context.selectedMaskIndex,5);assert.equal(frame.designResourceComponent,true);
 assert.equal(frame.designTextLayout.text.pt.x,.08,'Inserted text uses badge-local geometry');
 context.FrameTextPresets.insert(frame,'pt',false);const field=context.card.text.pt;assert.ok(field.x>=frame.bounds.x&&field.x+field.width<=frame.bounds.x+frame.bounds.width);assert.ok(field.y>=frame.bounds.y&&field.y+field.height<=frame.bounds.y+frame.bounds.height);assert.ok(field.size>.02,'P/T text must remain legible');
 // Split masks operate on the badge, not the full card.
 selectors['#frame-resource-mask'].value='2';await context.FrameResourceLibrary.createLayer();frame=added.at(-1).frame;
 assert.equal(added.at(-1).masks[0].name,'Right Half');assert.deepEqual(frame.maskCanvasBounds,frame.bounds);
 // Respect a hand-positioned Boss badge for subsequent colors.
 context.card.frames=[{bossStats:true,bounds:{x:.8,y:.7,width:.11,height:.08}}];
 await context.FrameResourceLibrary.createLayer();assert.deepEqual(added.at(-1).frame.bounds,context.card.frames[0].bounds);
 context.card.version='m15Regular';context.card.orientation='portrait';context.card.width=2010;context.card.height=2814;
 selectors['#frame-resource-mask'].value='0';await context.FrameResourceLibrary.createLayer();frame=added.at(-1).frame;
 assert.deepEqual(frame.bounds,{x:.7573,y:.8848,width:.188,height:.0733});assert.equal(frame.orientationPrepared,undefined);
 // Full-card base textures retain their original full-card placement.
 selectors['#frame-resource-texture'].value='builtin:m15-green';await context.FrameResourceLibrary.createLayer();
 assert.deepEqual(added.at(-1).frame.bounds,{x:0,y:0,width:1,height:1});
 console.log('PASS: constructor P/T proportions, Battle/regular placement, split masks, saved badge placement and base textures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
