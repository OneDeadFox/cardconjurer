// Battle-based Boss controls. Assets remain ordinary editable frame layers.
(function () {
 'use strict';
 let rulesCanvas, rulesContext, lastRulesLayer, busy = false;
 const clone = value => JSON.parse(JSON.stringify(value));
 const label = frame => String(frame.componentKind || frame.name || '').toLowerCase();
 const battle = () => card.version === 'battle';
 function isTitle(frame){if(!frame||frame.sectionCrown)return false;return window.FrameSectionTools?.role(frame)==='title'||frame.sectionAppearance?.role==='title'||/title|header/i.test([frame.componentKind,frame.componentLabel,frame.name].filter(Boolean).join(' '));}
 function defaultStatsBounds(){const width=377/2010*card.height/card.width;return {x:.984-width,y:.874,width,height:206/2010};}
 function compactStatsBounds(bounds){return bounds&&Math.abs(bounds.x-.891)<1e-8&&Math.abs(bounds.y-.874)<1e-8&&Math.abs(bounds.width-.093)<1e-8&&(Math.abs(bounds.height-.060)<1e-8||Math.abs(bounds.height-.093*card.width/card.height*206/377)<1e-8);}
 function isRules(frame) {
  return /^rules$/.test(label(frame)) || /[—–-]\s*rules\b/i.test(frame.name || '') ||
   (frame.masks || []).some(mask => /^(rules|rules text)$/i.test(mask.name || ''));
 }
 function settings() { return card.bossFrameSettings || {}; }
 function status(message) { const node = document.querySelector('#boss-frame-status'); if (node) node.textContent = message; }
 function newCanvas(width, height) { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
 function beginRules(layers = card.frames.slice().reverse()) {
  if (!battle() || settings().rulesOpacity === undefined) return;
  lastRulesLayer = layers.filter(frame=>frame.image&&!frame.hidden&&!frame.preserveAlpha&&isRules(frame)).at(-1);
  rulesCanvas = rulesCanvas || newCanvas(card.width, card.height);
  rulesCanvas.width = frameCanvas.width; rulesCanvas.height = frameCanvas.height;
  rulesContext = rulesCanvas.getContext('2d'); rulesContext.clearRect(0, 0, rulesCanvas.width, rulesCanvas.height);
 }
 function drawRulesLayer(image, frame) {
  if (!battle() || settings().rulesOpacity === undefined || !isRules(frame) || frame.sectionAppearance) return false;
  rulesContext.globalAlpha = Math.max(0, Math.min(100, Number(frame.opacity ?? 100))) / 100;
  rulesContext.globalCompositeOperation = frame.erase ? 'destination-out' : (frame.mode || 'source-over');
  rulesContext.drawImage(image, 0, 0, rulesCanvas.width, rulesCanvas.height);
  return true;
 }
 function finishRules(context, frame) {
  if (frame && frame !== lastRulesLayer) return;
  if (!battle() || settings().rulesOpacity === undefined || !rulesCanvas) return;
  context.save(); context.globalCompositeOperation = 'source-over';
  context.globalAlpha = Math.max(0, Math.min(100, settings().rulesOpacity)) / 100;
  context.drawImage(rulesCanvas, 0, 0); context.restore();
 }
 async function prepare() {
  // Preserve half-color masks when separating a combined Battle layer.
  const rebuilt=[];let changed=false;
  for(const frame of card.frames){
   const masks=frame.designComponentMasks || [];
   const battleSource=frame.designSourcePack==='Battle'||/\/battle\/[wubrgmalc]\.png$/.test(frame.src || '');
   const semantic=(frame.masks||[]).some(mask=>/^(Rules|Title|Type|Defense|Border|Pinline)$/i.test(mask.name || ''));
   if(battleSource&&!frame.componentKind&&!semantic){
    if(!masks.length)throw Error('This combined Battle image has no component masks. Add it again from Browse Frames before using Boss controls.');
    const pieces=masks.filter(mask=>/^(Rules|Title|Type|Defense|Border|Pinline)$/i.test(mask.name || ''));
    for(const mask of pieces){const part=cloneFrameForComponent(frame,mask);part.masks.push(...clone(frame.masks||[]));rebuilt.push(part);}
    changed=true;
   }else rebuilt.push(frame);
  }
  if(changed){card.frames=rebuilt;await rebuildFrameLayerList();}
 }
 async function setRulesOpacity(value) {
  if (busy || !battle()) return;
  busy = true; const before = createDesignStateSnapshot();
  try {
   await prepare();
   const layers = card.frames.filter(isRules);
   if (!layers.length) throw Error('No Rules component was found. Add a rules-box layer using the Rules mask first.');
   if (layers.some(layer => layer.preserveAlpha)) throw Error('Turn off Preserve alpha on the Rules layers before adjusting group opacity.');
   card.bossFrameSettings = {...settings(), rulesOpacity: Math.max(0, Math.min(100, Number(value)))};
   for(const layer of layers)if(layer.sectionAppearance){layer.opacity=card.bossFrameSettings.rulesOpacity;layer.sectionAppearance.opacity=layer.opacity;}
   drawFrames(); commitDesignUndoSnapshot(before, 'Change Boss rules background opacity');
   status('Rules backgrounds blend as one group. Text remains fully opaque.');
  } catch (error) { await applyDesignStateSnapshot(before); status(error.message); }
  finally { busy = false; refresh(); }
 }
 function iconSource(face) {
  const points = face === 'back' ? '25,36 75,36 50,77' : '25,64 75,64 50,23';
  return 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="black"/><polygon points="'+points+'" fill="white" stroke="white" stroke-width="5" stroke-linejoin="round"/></svg>');
 }
 function iconBounds(owner) {
  if(owner?.sectionAppearance?.iconBounds)return {...owner.sectionAppearance.iconBounds};
  const source=owner?.bossSymbolOriginalSource||owner?.src||'',back=/\/transform\/.*\/back[^/]*\.png$/i.test(source),transform=/\/transform\//i.test(source);
  const native = back ? {x:1737/2010,y:.0505,width:.0734,height:.0524} : battle()&&!transform ? {x: .116, y: .056, width: .047, height: .066} : {x: .061, y: .052, width: .070, height: .050};
  const bounds = owner?.bounds || {x: 0, y: 0, width: 1, height: 1};
  const icon = {...native, rotation: 0};
  if (owner) FrameTextPresets.remap(icon, {x:0,y:0,width:1,height:1,rotation:0}, {...bounds,rotation:owner.rotation || 0}, false);
  return icon;
 }
 function ownerBounds(owner){return {x:0,y:0,width:1,height:1,...owner.bounds,rotation:Number(owner.rotation)||0};}
 async function clearOriginalSymbol(owner){
  if(owner.bossSymbolCleared)return;
  if(!owner.image)await reload(owner);
  const icon=iconBounds(owner),local={...icon};FrameTextPresets.remap(local,ownerBounds(owner),{x:0,y:0,width:1,height:1,rotation:0},false);
  const bitmap=newCanvas(owner.image.naturalWidth||owner.image.width,owner.image.naturalHeight||owner.image.height),ctx=bitmap.getContext('2d');ctx.drawImage(owner.image,0,0);
  // Keep the printed surround; remove the old glyph inside its black disk.
  ctx.globalCompositeOperation='source-atop';ctx.fillStyle='black';ctx.beginPath();ctx.ellipse((local.x+local.width/2)*bitmap.width,(local.y+local.height/2)*bitmap.height,local.width*bitmap.width/2,local.height*bitmap.height/2,0,0,Math.PI*2);ctx.fill();
  if(!/^data:|^blob:/.test(owner.src))owner.bossSymbolOriginalSource=owner.src;
  owner.src=bitmap.toDataURL('image/png');delete owner.assetId;owner.bossSymbolCleared=true;await reload(owner);
 }
 function syncSymbols(){for(const symbol of card.frames){if(!symbol.bossTitleOwnerBounds)continue;const owner=card.frames.find(item=>item.designLayerId===symbol.bossTitleOwner);if(!owner)continue;const current=ownerBounds(owner);if(JSON.stringify(current)!==JSON.stringify(symbol.bossTitleOwnerBounds)){const placed={...symbol.bounds,rotation:symbol.rotation||0};FrameTextPresets.remap(placed,symbol.bossTitleOwnerBounds,current,false);symbol.bounds={x:placed.x,y:placed.y,width:placed.width,height:placed.height};symbol.rotation=placed.rotation||0;symbol.bossTitleOwnerBounds=current;}}}
 async function setSymbol(face, owner) {
  if (busy) return; busy = true; const before = createDesignStateSnapshot();
  try {
   if(!owner&&battle())await prepare();
   owner=owner||card.frames.find(item=>!item.bossTitleOwner&&isTitle(item));
   const peers=owner?card.frames.filter(item=>item===owner||(!item.bossTitleOwner&&isTitle(item)&&JSON.stringify(ownerBounds(item))===JSON.stringify(ownerBounds(owner)))):[];
   for(const title of peers)await clearOriginalSymbol(title);
   const ownerId = owner ? ensureDesignLayerId(owner) : 'battle-title';
   const ownerIds=new Set(peers.map(ensureDesignLayerId));ownerIds.add(ownerId);if(battle())ownerIds.add('battle-title');
   const existing=card.frames.filter(item=>ownerIds.has(item.bossTitleOwner));let frame=existing.find(item=>item.bossTitleOwner===ownerId)||existing[0];
   const duplicates=existing.filter(item=>item!==frame);card.frames=card.frames.filter(item=>!duplicates.includes(item));for(const item of duplicates)window.RulesRange?.removeElementReferences('frame',item.designLayerId);
   const src = iconSource(face);
   if (!frame) {
    frame = {name:'Transform symbol', src, masks:[], bounds:iconBounds(owner), opacity:100, noThumb:true, bossTitleOwner:ownerId, bossSymbolFace:face};
    ensureDesignLayerId(frame); card.frames.unshift(frame); await addFrame([],frame);
   } else { frame.src = src; delete frame.assetId; frame.bossSymbolFace = face;frame.bossTitleOwner=ownerId;frame.bounds=iconBounds(owner);frame.rotation=frame.bounds.rotation||0; await reload(frame); }
   if(owner)frame.bossTitleOwnerBounds=ownerBounds(owner);
   await rebuildFrameLayerList();
   if (battle()) card.bossFrameSettings = {...settings(), symbolFace:face};
   drawFrames(); commitDesignUndoSnapshot(before, 'Change transform symbol'); status('Transform symbol replaced. Its layer remains editable.');
  } catch(error) { await applyDesignStateSnapshot(before); status(error.message); }
  finally { busy = false; refresh(); }
 }
 function reload(frame) {
  return new Promise((resolve,reject) => { const image = new Image(); image.crossOrigin='anonymous'; image.onload=()=>{frame.image=image;resolve();}; image.onerror=()=>reject(Error('The frame image could not be loaded.')); image.src=frame.src; });
 }
 async function croppedBadge(frames) {
  for(const frame of frames)if(!frame.image)await reload(frame);
  const width=frames[0].image.naturalWidth||frames[0].image.width,height=frames[0].image.naturalHeight||frames[0].image.height;
  const canvas=newCanvas(width,height),ctx=canvas.getContext('2d');
  for(const frame of frames.slice().reverse()){
   const layer=newCanvas(width,height),out=layer.getContext('2d');out.drawImage(frame.image,0,0,width,height);
   for(const mask of frame.masks || []) {
    if(!mask.image)throw Error('Wait for the badge masks to finish loading, then try again.');
    out.globalCompositeOperation='destination-in';out.drawImage(mask.image,0,0,width,height);
   }
   if(frame.colorOverlayCheck){out.globalCompositeOperation='source-in';out.fillStyle=frame.colorOverlay;out.fillRect(0,0,width,height);}
   if(frame.hslHue||frame.hslSaturation||frame.hslLightness)hsl(layer,frame.hslHue||0,frame.hslSaturation||0,frame.hslLightness||0);
   ctx.globalAlpha=(frame.opacity??100)/100;ctx.drawImage(layer,0,0);
  }
  const pixels=ctx.getImageData(0,0,width,height).data;let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)throw Error('The selected P/T artwork is empty.');
  const w=right-left+1,h=bottom-top+1,rotate=h>w;
  const result=newCanvas(rotate?h:w,rotate?w:h),out=result.getContext('2d');
  if(rotate){out.translate(h,0);out.rotate(Math.PI/2);}
  out.drawImage(canvas,left,top,w,h,0,0,w,h);return result.toDataURL('image/png');
 }
 async function addPT() {
  if(busy||!battle())return;busy=true;const before=createDesignStateSnapshot();
  try {
   await prepare();
   let sources=card.frames.filter(frame=>/power.?\/?toughness|power.*toughness|\bpt\b/i.test(label(frame)) && !frame.bossStats);
   if(!sources.length){const existing=card.frames.find(frame=>frame.bossStats);sources=existing?[existing]:[{src:'/img/frames/m15/borderless/pt/m.png',masks:[]}];}
   const src=await croppedBadge(sources);
   const existing=card.frames.find(frame=>frame.bossStats),bounds=existing?.bounds&&!compactStatsBounds(existing.bounds)?existing.bounds:defaultStatsBounds();
   const frame=existing||{name:'Boss Power/Toughness',masks:[],opacity:100,noThumb:true,bossStats:true};
   frame.src=src;delete frame.assetId;frame.bounds=clone(bounds);frame.rotation=0;frame.imageFit='stretch';
   if(!existing){ensureDesignLayerId(frame);card.frames.unshift(frame);await addFrame([],frame);}else await reload(frame);
   // Replace the old component, not the whole frame or its type/rules border.
   const removed=card.frames.filter(item=>item!==frame&&(sources.includes(item)||/^defense$/.test(label(item))||/[—–-]\s*defense\b/i.test(item.name||'')));
   card.frames=card.frames.filter(item=>!removed.includes(item));
   for(const item of removed)window.RulesRange?.removeElementReferences('frame',ensureDesignLayerId(item));
   const old=card.text.pt,field={name:'Power/Toughness',text:old?.text||'',x:bounds.x+bounds.width*.08,y:bounds.y+bounds.height*.2,width:bounds.width*.84,height:bounds.height*.6,size:.0372,font:'belerenbsc',oneLine:true,align:'center',rotation:0,standardRole:'pt',customField:true};
   field.frameAnchor={id:ensureDesignLayerId(frame),last:{...bounds,rotation:0}};
   delete card.text.defense;
   loadTextOptions({pt:field},false);card.text.pt.text=field.text;card.text.pt.rotation=0;
   await rebuildFrameLayerList();drawTextBuffer();drawFrames();commitDesignUndoSnapshot(before,'Set horizontal Boss Power/Toughness');
   status('P/T artwork and text now read horizontally near the defense position. Double-click the badge to adjust it.');
  }catch(error){await applyDesignStateSnapshot(before);status(error.message);}
  finally{busy=false;refresh();}
 }
 function restoreAppearance(frame,definition) {
  const cleared=frame.bossSymbolCleared||definition.bossSymbolCleared;
  for(const key of ['bossStats','bossTitleOwner','bossSymbolFace','bossTitleOwnerBounds','bossSymbolCleared','bossSymbolOriginalSource']){if(definition[key]===undefined)delete frame[key];else frame[key]=clone(definition[key]);}
  if((cleared||definition.bossStats||definition.bossTitleOwner)&&frame.src!==definition.src){frame.src=definition.src;reload(frame).then(drawFrames).catch(error=>status(error.message));}
 }
 function mountElement(container,frame) {
  container.querySelector('.title-transform-controls')?.remove();
  if(!frame||!(isTitle(frame)||frame.bossTitleOwner))return;
  const owner=frame.bossTitleOwner?card.frames.find(item=>ensureDesignLayerId(item)===frame.bossTitleOwner):frame;
  const panel=document.createElement('details');panel.className='title-transform-controls wide';
  panel.innerHTML='<summary>Transform symbol</summary><p>Replace the symbol while keeping the title artwork and placement.</p><button type="button" class="input" data-face="front">Front symbol ↑</button><button type="button" class="input" data-face="back">Back symbol ↓</button>';
  panel.querySelectorAll('[data-face]').forEach(button=>button.onclick=()=>setSymbol(button.dataset.face,owner));container.appendChild(panel);
 }
 function refresh(){const panel=document.querySelector('#boss-frame-panel');if(!panel)return;panel.hidden=!battle();if(panel.hidden)return;panel.querySelector('#boss-rules-opacity').value=settings().rulesOpacity??100;panel.querySelector('#boss-rules-opacity-value').textContent=(settings().rulesOpacity??100)+'%';panel.querySelector('#boss-symbol-face').value=settings().symbolFace||'original';panel.querySelectorAll('button,input,select').forEach(node=>node.disabled=busy);}
 function mount(){
  const generic=document.querySelector('#rules-range-list')?.closest('.readable-background');if(!generic)return;
  const panel=document.createElement('section');panel.id='boss-frame-panel';panel.className='readable-background padding margin-bottom';panel.hidden=true;
  panel.innerHTML='<h3>Battle / Boss layout</h3><button id="boss-add-pt" type="button" class="input">Use horizontal Power/Toughness badge</button><label>Transform symbol<select id="boss-symbol-face" class="input"><option value="original" disabled>Original artwork</option><option value="front">Front ↑</option><option value="back">Back ↓</option></select></label><label>Rules background opacity <output id="boss-rules-opacity-value">100%</output><input id="boss-rules-opacity" class="input" type="range" min="0" max="100" value="100"></label><p>Changes the combined rules background only; ability text stays opaque.</p><p id="boss-frame-status" role="status"></p>';
  generic.before(panel);panel.querySelector('#boss-add-pt').onclick=addPT;panel.querySelector('#boss-symbol-face').onchange=event=>setSymbol(event.target.value);
  panel.querySelector('#boss-rules-opacity').oninput=event=>{panel.querySelector('#boss-rules-opacity-value').textContent=event.target.value+'%';};panel.querySelector('#boss-rules-opacity').onchange=event=>setRulesOpacity(event.target.value);refresh();
 }
 window.BossFrameTools={defaultStatsBounds,compactStatsBounds,isTitle,isRules,beginRules,drawRulesLayer,finishRules,setRulesOpacity,setSymbol,syncSymbols,addPT,restoreAppearance,mountElement,refresh,iconBounds,iconSource};
 window.addEventListener('frameworkspacechanged',refresh);window.addEventListener('creatortabchanged',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
