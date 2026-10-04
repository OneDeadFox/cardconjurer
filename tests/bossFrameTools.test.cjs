const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {createCanvas,Image}=require('@napi-rs/canvas');
class BrowserImage extends Image {set src(value){super.src=typeof value==='string'&&value.startsWith('data:image/svg+xml;base64,')?Buffer.from(value.split(',')[1],'base64'):value;}get src(){return super.src;}}
const card={version:'battle',width:200,height:140,frames:[],text:{pt:{text:'8/8'},defense:{text:'5'},rules:{text:'Boss ability'}}};
let commits=0;
const ctx={card,Image:BrowserImage,btoa:s=>Buffer.from(s).toString('base64'),frameCanvas:createCanvas(200,140),
 document:{readyState:'loading',addEventListener(){},querySelector(){return null;},createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}},
 window:{addEventListener(){}},
 createDesignStateSnapshot:()=>JSON.parse(JSON.stringify(card,(key,value)=>key==='image'?undefined:value)),
 applyDesignStateSnapshot(snapshot){Object.assign(card,snapshot);},
 commitDesignUndoSnapshot(){commits++;},
 ensureDesignLayerId(frame){return frame.designLayerId ||= 'id-'+Math.random();},
 cloneFrameForComponent(frame,mask){return {...frame,designLayerId:undefined,name:'Frame — '+mask.name,componentKind:mask.name,masks:[{...mask}]};},
 async rebuildFrameLayerList(){},drawFrames(){},drawTextBuffer(){},
 loadTextOptions(fields){Object.assign(card.text,fields);},
 async addFrame(masks,frame){frame.image=await new Promise((resolve,reject)=>{const image=new BrowserImage();image.onload=()=>resolve(image);image.onerror=reject;image.src=frame.src;});},
 FrameTextPresets:{remap(field,from,to){field.x=to.x+field.x*to.width;field.y=to.y+field.y*to.height;field.width*=to.width;field.height*=to.height;}},
 RulesRange:{removeElementReferences(){}}
};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('js/bossFrameTools.js','utf8'),ctx);
const tools=ctx.window.BossFrameTools;
(async()=>{
 // Render overlapping rules colors, then fade the group once.
 card.bossFrameSettings={rulesOpacity:50};tools.beginRules();
 const red=createCanvas(200,140),blue=createCanvas(200,140);
 red.getContext('2d').fillStyle='red';red.getContext('2d').fillRect(0,0,140,140);
 blue.getContext('2d').fillStyle='blue';blue.getContext('2d').fillRect(80,0,120,140);
 const rules={componentKind:'Rules',opacity:100};
 assert.equal(tools.drawRulesLayer(red,rules),true);assert.equal(tools.drawRulesLayer(blue,rules),true);
 const out=createCanvas(200,140);tools.finishRules(out.getContext('2d'));
 for(const x of [20,100,180])assert.ok(Math.abs(out.getContext('2d').getImageData(x,20,1,1).data[3]-128)<=1,'Split overlap must have the same group alpha');
 assert.equal(tools.drawRulesLayer(red,{componentKind:'Title'}),false,'Title remains outside the faded group');
 const topRules={componentKind:'Rules',opacity:100,image:blue},title={componentKind:'Title',image:red};
 tools.beginRules([rules,topRules,title]);tools.drawRulesLayer(blue,topRules);
 const ordered=createCanvas(200,140);tools.finishRules(ordered.getContext('2d'),title);assert.equal(ordered.getContext('2d').getImageData(100,20,1,1).data[3],0,'Group flush waits for the last rules layer');
 tools.finishRules(ordered.getContext('2d'),topRules);assert.ok(ordered.getContext('2d').getImageData(100,20,1,1).data[3]>0);
 card.bossFrameSettings.rulesOpacity=0;tools.beginRules();tools.drawRulesLayer(red,rules);const zero=createCanvas(200,140);tools.finishRules(zero.getContext('2d'));assert.equal(zero.getContext('2d').getImageData(20,20,1,1).data[3],0);
 // Half-color masks survive automatic separation.
 card.frames=[{src:'/img/frames/m15/battle/g.png',designSourcePack:'Battle',designComponentMasks:[{name:'Title'},{name:'Rules'},{name:'Defense'}],masks:[{name:'Right Half'}]}];
 await tools.setRulesOpacity(65);
 assert.equal(card.frames.length,3);for(const frame of card.frames)assert.equal(frame.masks[1].name,'Right Half');
 assert.equal(card.bossFrameSettings.rulesOpacity,65);assert.equal(card.text.rules.text,'Boss ability');
 // Replace an existing vertical P/T component with horizontal artwork and text.
 const portrait=createCanvas(10,30);portrait.getContext('2d').fillStyle='gold';portrait.getContext('2d').fillRect(0,0,10,30);
 card.frames.push({name:'Power/Toughness',image:portrait,masks:[],src:'existing'});
 await tools.addPT();const badge=card.frames.find(frame=>frame.bossStats);
 assert.ok(badge);assert.ok(Math.abs(badge.bounds.width*card.width/(card.height/2010)-377)<1e-8);assert.ok(Math.abs(badge.bounds.height*card.height/(card.height/2010)-206)<1e-8);assert.ok(badge.image.width>badge.image.height);assert.equal(badge.rotation,0);
 assert.equal(card.text.pt.text,'8/8');assert.equal(card.text.pt.rotation,0);
 assert.equal(card.text.pt.frameAnchor.id,badge.designLayerId);assert.equal(card.text.defense,undefined);
 assert.ok(card.frames.some(frame=>frame.componentKind==='Title'));assert.ok(card.frames.some(frame=>frame.componentKind==='Rules'));
 assert.equal(card.frames.some(frame=>frame.componentKind==='Defense'),false);
 // Symbol changes reuse the same editable frame and preserve the title.
 await tools.setSymbol('back');const symbol=card.frames.find(frame=>frame.bossTitleOwner);
 assert.ok(symbol);const id=symbol.designLayerId;await tools.setSymbol('front');
 assert.equal(card.frames.filter(frame=>frame.bossTitleOwner).length,1);assert.equal(symbol.designLayerId,id);assert.equal(symbol.bossSymbolFace,'front');
 const data=JSON.parse(JSON.stringify(card,(key,value)=>key==='image'?undefined:value));assert.equal(data.bossFrameSettings.rulesOpacity,65);assert.ok(data.frames.find(frame=>frame.bossStats).src.startsWith('data:'));
 assert.ok(commits>=4);
 console.log('PASS: Boss split-mask preservation, grouped opacity, horizontal P/T replacement, symbol reuse and serializable layout.');
})().catch(error=>{console.error(error);process.exitCode=1;});
