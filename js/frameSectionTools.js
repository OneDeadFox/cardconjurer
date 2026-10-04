// Shared appearance controls for sections, independent of the card's layout version.
(function(){
 'use strict';
 const colors={w:'White',u:'Blue',b:'Black',r:'Red',g:'Green',m:'Multicolor',a:'Artifact',l:'Land',c:'Colorless',v:'Vehicle'};
 const unit={x:0,y:0,width:1,height:1,rotation:0};
 const imageCache=new Map();let busy=false;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const bounds=frame=>({...unit,...frame.bounds,rotation:Number(frame.rotation)||0});
 function role(frame){
  if(['title','rules'].includes(frame.sectionAppearance?.role))return frame.sectionAppearance.role;
  const classify=name=>/title|header/i.test(name||'')?'title':/rules|text.?boxes/i.test(name||'')?'rules':null;
  const named=classify(frame.componentKind)||classify(frame.componentLabel)||classify(frame.name);if(named)return named;
  const masks=(frame.masks||[]).filter(mask=>!/^(left|right|top|bottom) half$/i.test(mask.name||''));return masks.length===1?classify(masks[0].name):null;
 }
 function insertAppearance(container,panel){container.insertBefore(panel,container.querySelector('.frame-editor-number-grid')||container.querySelector('.frame-standard-fields'));}
 function canvas(width,height){const result=document.createElement('canvas');result.width=Math.max(1,Math.round(width));result.height=Math.max(1,Math.round(height));return result;}
 async function image(src){if(!src)throw Error('This appearance has no asset for the selected color.');if(!imageCache.has(src))imageCache.set(src,new Promise((resolve,reject)=>{const value=new Image();value.crossOrigin='anonymous';value.onload=()=>resolve(value);value.onerror=()=>{imageCache.delete(src);reject(Error('Could not load '+src));};value.src=typeof fixUri==='function'?fixUri(src):src;}));return imageCache.get(src);}
 function alphaBounds(source){const ctx=source.getContext('2d'),pixels=ctx.getImageData(0,0,source.width,source.height).data;let x0=source.width,y0=source.height,x1=-1,y1=-1;for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(x1<x0)throw Error('The selected section artwork is empty.');return{x:x0/source.width,y:y0/source.height,width:(x1-x0+1)/source.width,height:(y1-y0+1)/source.height};}
 function union(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};}
 function expand(rect,amount){return{x:Math.max(0,rect.x-amount),y:Math.max(0,rect.y-amount),width:Math.min(1,rect.x+rect.width+amount)-Math.max(0,rect.x-amount),height:Math.min(1,rect.y+rect.height+amount)-Math.max(0,rect.y-amount)};}
 function mapRect(rect,from,to){const result={...rect,rotation:rect.rotation||0};FrameTextPresets.remap(result,{...from,rotation:from.rotation||0},{...to,rotation:to.rotation||0},false);return result;}
 async function drawResource(resource,maskNames,referenceSize){
  const asset=await image(resource.src),b=resource.bounds||unit;
  const w=referenceSize?.width||Math.round((asset.naturalWidth||asset.width)/(b.width||1)),h=referenceSize?.height||Math.round((asset.naturalHeight||asset.height)/(b.height||1));
  const output=canvas(w,h),ctx=output.getContext('2d');ctx.drawImage(asset,b.x*w,b.y*h,b.width*w,b.height*h);
  const masks=(resource.masks||[]).filter(mask=>maskNames?.includes(mask.name));
  if(masks.length){const combined=canvas(w,h),maskCtx=combined.getContext('2d');for(const mask of masks)maskCtx.drawImage(await image(mask.src),0,0,w,h);ctx.globalCompositeOperation='destination-in';ctx.drawImage(combined,0,0);}
  return output;
 }
 async function originalRectangle(frame,sectionRole){
  if(frame.sectionAppearance)return clone(frame.sectionAppearance.baseBounds);
  const asset=await image(frame.src),source=canvas(asset.naturalWidth||asset.width,asset.naturalHeight||asset.height),ctx=source.getContext('2d');ctx.drawImage(asset,0,0);
  // Ignore half masks here: a split-color section still occupies the complete region.
  const masks=(frame.masks||[]).filter(mask=>! /^(left|right|top|bottom) half$/i.test(mask.name||''));
  for(const mask of masks){ctx.globalCompositeOperation='destination-in';ctx.drawImage(await image(mask.src),0,0,source.width,source.height);}
  const rect=alphaBounds(source);return mapRect(rect,unit,bounds(frame));
 }
 function family(src){return /^data:|^blob:|^asset:/.test(src||'')?null:String(src||'').slice(0,String(src||'').lastIndexOf('/'));}
 function colorOf(frame){const name=frame.name||'';for(const[key,label]of Object.entries(colors))if(name.toLowerCase().includes(label.toLowerCase()))return key;const tail=(frame.src||'').split('/').at(-1);const match=tail?.match(/(?:front|back|rules)?([wubrgmalcv])\.png$/i);return match?match[1].toLowerCase():'m';}
 function members(frame,sectionRole){if(frame.sectionAppearance)return[frame];const original=family(frame.bossSymbolOriginalSource||frame.src),b=bounds(frame);return card.frames.filter(item=>item===frame||(original&&family(item.bossSymbolOriginalSource||item.src)===original&&role(item)===sectionRole&&JSON.stringify(bounds(item))===JSON.stringify(b)));}
 async function crownCanvas(style,key,pinlines,size,rect,backing=true){
  const result=canvas(size.width,size.height),ctx=result.getContext('2d');
    // Battle keeps its transform symbol on the left, like the transform-front title.
    const crownStyle=style.id==='battle'?'transform-front':style.id.startsWith('transform-')?style.id:'regular';const crownResource=FrameSectionCatalog.crowns[crownStyle]?.[key];if(!crownResource)throw Error('No legendary crown is available for this color.');
    const masks=crownResource.masks.filter(mask=>pinlines?/With Pinlines/i.test(mask.name):/Without Pinlines/i.test(mask.name)).map(mask=>mask.name);
    const reference=FrameSectionCatalog.styles.find(item=>item.id===crownStyle).variants[key]||FrameSectionCatalog.styles.find(item=>item.id===crownStyle).variants.m;
    const titleMask=await image(reference.masks.find(mask=>mask.name==='Title').src),referenceCanvas=canvas(titleMask.naturalWidth||titleMask.width,titleMask.naturalHeight||titleMask.height);referenceCanvas.getContext('2d').drawImage(titleMask,0,0);
    const from=alphaBounds(referenceCanvas),crownLayer=await drawResource(crownResource,masks,{width:referenceCanvas.width,height:referenceCanvas.height});
    if(backing){const cover=FrameSectionCatalog.crownCovers[crownStyle].bounds,backed=canvas(referenceCanvas.width,referenceCanvas.height),backCtx=backed.getContext('2d');backCtx.fillStyle='black';backCtx.fillRect(cover.x*backed.width,cover.y*backed.height,cover.width*backed.width,cover.height*backed.height);backCtx.drawImage(crownLayer,0,0);crownLayer.getContext('2d').clearRect(0,0,crownLayer.width,crownLayer.height);crownLayer.getContext('2d').globalCompositeOperation='source-over';crownLayer.getContext('2d').drawImage(backed,0,0);}
    // Map the crown's native title region to this title, rather than stretching
    // its complete portrait canvas into a landscape card canvas.
    const sy=rect.height*size.height/(from.height*referenceCanvas.height),cap=Math.min(from.width*referenceCanvas.width/3,from.height*referenceCanvas.height*2),scale=Math.min(sy,rect.width*size.width/(cap*2));
    const sourceLeft=from.x*referenceCanvas.width+cap,sourceRight=(from.x+from.width)*referenceCanvas.width-cap,targetLeft=rect.x*size.width+cap*scale,targetRight=(rect.x+rect.width)*size.width-cap*scale;
    const y=(rect.y-from.y*rect.height/from.height)*size.height,height=sy*referenceCanvas.height;
    // Preserve the icon surround and rounded end at the title's height scale;
    // only stretch the middle of the crown for a wider landscape title.
    const x=rect.x*size.width-from.x*referenceCanvas.width*scale;
    ctx.drawImage(crownLayer,0,0,sourceLeft,referenceCanvas.height,x,y,sourceLeft*scale,height);
    ctx.drawImage(crownLayer,sourceLeft,0,sourceRight-sourceLeft,referenceCanvas.height,targetLeft,y,targetRight-targetLeft,height);
    ctx.drawImage(crownLayer,sourceRight,0,referenceCanvas.width-sourceRight,referenceCanvas.height,targetRight,y,(referenceCanvas.width-sourceRight)*scale,height);
  return result;
 }
 async function blendColors(target,second,rect){
  const maskImage=await image('/img/frames/maskRightHalf.png'),mask=canvas(maskImage.naturalWidth||maskImage.width,maskImage.naturalHeight||maskImage.height),maskCtx=mask.getContext('2d');maskCtx.drawImage(maskImage,0,0);
  const weights=maskCtx.getImageData(0,0,mask.width,mask.height).data,ctx=target.getContext('2d'),first=ctx.getImageData(0,0,target.width,target.height),other=second.getContext('2d').getImageData(0,0,second.width,second.height).data;
  // Complementary, premultiplied weights preserve the original transparency.
  // Ordinary source-over would darken the translucent seam by stacking both colors.
  for(let y=0;y<target.height;y++){
   const my=Math.max(0,Math.min(mask.height-1,Math.floor((y/target.height-rect.y)/rect.height*mask.height)));
   for(let x=0;x<target.width;x++){
    const mx=Math.max(0,Math.min(mask.width-1,Math.floor((x/target.width-rect.x)/rect.width*mask.width))),i=(y*target.width+x)*4,w=weights[(my*mask.width+mx)*4+3]/255;
    const a=first.data[i+3]*(1-w),b=other[i+3]*w,total=a+b;
    for(let channel=0;channel<3;channel++)first.data[i+channel]=total?(first.data[i+channel]*a+other[i+channel]*b)/total:0;
    first.data[i+3]=total;
   }
  }
  ctx.putImageData(first,0,0);
 }
 async function renderStyle(style,sectionRole,left,right,pinlines,crown){
  const resource=style.variants[left];if(!resource)throw Error(style.label+' does not have a '+colors[left]+' appearance.');
  const primaryMask=resource.masks.find(mask=>mask.name.toLowerCase()===sectionRole);
  const maskNames=primaryMask?[primaryMask.name]:[];
  const primary=await drawResource(resource,maskNames),size={width:primary.width,height:primary.height};let rect;try{rect=alphaBounds(primary);}catch(error){if(!primaryMask)throw error;const shape=canvas(size.width,size.height);shape.getContext('2d').drawImage(await image(primaryMask.src),0,0,size.width,size.height);rect=alphaBounds(shape);}
  const renderColor=async key=>{
   const variant=style.variants[key];if(!variant)throw Error(style.label+' does not have a '+colors[key]+' appearance.');
   const names=maskNames.slice();if(pinlines&&primaryMask)for(const mask of variant.masks||[])if(mask.name==='Pinline')names.push(mask.name);
   const layer=await drawResource(variant,names,size),ctx=layer.getContext('2d');
   // Pinline masks span the entire card. Keep only this section's portion.
   if(pinlines&&names.length>maskNames.length){const clip=expand(rect,.004);ctx.globalCompositeOperation='destination-in';ctx.fillStyle='black';const limiter=canvas(size.width,size.height);limiter.getContext('2d').fillRect(clip.x*size.width,clip.y*size.height,clip.width*size.width,clip.height*size.height);ctx.drawImage(limiter,0,0);}
   ctx.globalCompositeOperation='source-over';
   if(style.id==='prototype')for(const extra of variant.extras||[])ctx.drawImage(await drawResource(extra,[],size),0,0);
   if(crown&&sectionRole==='title'){
    ctx.drawImage(await crownCanvas(style,key,pinlines,size,rect),0,0);
   }
   return layer;
  };
  const merged=canvas(size.width,size.height),ctx=merged.getContext('2d');ctx.drawImage(await renderColor(left),0,0);
  if(right)await blendColors(merged,await renderColor(right),rect);
  let outer;try{outer=alphaBounds(merged);}catch(error){outer=rect;}const cropped=canvas(outer.width*size.width,outer.height*size.height);cropped.getContext('2d').drawImage(merged,outer.x*size.width,outer.y*size.height,outer.width*size.width,outer.height*size.height,0,0,cropped.width,cropped.height);
  return{src:cropped.toDataURL('image/png'),primary:rect,outer};
 }
 function localTextLayout(frame,sectionRole){const fields=sectionRole==='title'?['title','mana']:['rules'],saved={coordinateSpace:'component',text:{}};for(const key of fields){const field=Object.values(card.text||{}).find(item=>item.frameAnchor?.id===frame.designLayerId&&item.standardRole===key)||card.text?.[key];if(!field)continue;const local=clone(field);delete local.frameAnchor;delete local.text;FrameTextPresets.remap(local,bounds(frame),unit,false);saved.text[key]=local;}return saved;}
 function fitTitleText(frame,style,sourceRegion,base,previousIds){
  const battle=style.id==='battle',back=style.id==='transform-back',front=style.id==='transform-front';
  const native=battle?{title:{x:387/2100,y:81/1500,width:1547/2100,height:114/1500},mana:{x:0,y:100/1500,width:1957/2100,height:71/1500}}:{title:{x:front ? .16 : .0854,y:.0522,width:(front||back) ? .7547 : .8292,height:.0543},mana:{x:.0854,y:.0613,width:.8438,height:71/2100}};
  for(const key of ['title','mana'])for(const[name,field]of Object.entries(card.text||{})){
   const anchored=previousIds.has(field.frameAnchor?.id)&&(field.standardRole===key||name===key),center={x:field.x+field.width/2,y:field.y+field.height/2};
   const inSection=name===key&&center.x>=base.x-.02&&center.x<=base.x+base.width+.02&&center.y>=base.y-.02&&center.y<=base.y+base.height+.02;
   if(!anchored&&!inSection)continue;
   const fitted=mapRect(native[key],{...sourceRegion,rotation:0},base);Object.assign(field,{x:fitted.x,y:fitted.y,width:fitted.width,height:fitted.height,rotation:fitted.rotation});
   field.frameAnchor={id:frame.designLayerId,last:bounds(frame)};field.standardRole=key;if(key==='title')field.color=back?'white':(field.color==='white'?'black':field.color||'black');
  }
 }
 function refreshGeometry(frame){
  const prefixes=[];if(window.CanvasDesignTools?.editsFrame(frame))prefixes.push('canvas-element');if(typeof selectedFrame!=='undefined'&&selectedFrame===frame)prefixes.push('frame-editor');
  for(const prefix of prefixes)for(const[key,value]of Object.entries({x:frame.bounds.x*card.width,y:frame.bounds.y*card.height,width:frame.bounds.width*card.width,height:frame.bounds.height*card.height,rotation:frame.rotation||0,opacity:frame.opacity??100})){const control=document.querySelector('#'+prefix+'-'+key);if(control)control.value=Math.round(value);}
 }
 function rebaseAnchors(frame,removed=[]){const ids=new Set([frame.designLayerId,...removed.map(item=>ensureDesignLayerId(item))]);for(const field of Object.values(card.text||{}))if(ids.has(field.frameAnchor?.id)){field.frameAnchor.id=frame.designLayerId;field.frameAnchor.last=bounds(frame);}}
 function status(panel,message){const output=panel?.querySelector('[data-section-status]');if(output)output.textContent=message;}
 async function apply(frame,options,panel){
  if(busy||!card.frames.includes(frame))return false;busy=true;const before=createDesignStateSnapshot();
  try{
   const sectionRole=options.role||role(frame);if(!['title','rules'].includes(sectionRole))throw Error('Choose a title or rules section first.');
   let style=FrameSectionCatalog.styles.find(item=>item.id===options.style&&item.roles.includes(sectionRole));if(options.style==='browse'){const selected=options.browseResource||(frame.sectionAppearance?.style==='browse'?{src:frame.src,bounds:unit,masks:[]}:null);if(selected)style={id:'browse',label:'Browse section',roles:[sectionRole],variants:{[options.left||colorOf(frame)]:selected}};}if(!style)throw Error('This style is not available for the selected section.');
   const original=members(frame,sectionRole),base=await originalRectangle(frame,sectionRole),rendered=await renderStyle(style,sectionRole,options.left||colorOf(frame),options.right||'',options.pinlines!==false,!!options.crown);
   const previousSource=frame.src,previousBounds=bounds(frame),owner=ensureDesignLayerId(frame),appearance={role:sectionRole,style:style.id,fitTitleText:options.fitTitleText!==false,left:options.left||colorOf(frame),right:options.right||'',pinlines:options.pinlines!==false,crown:!!options.crown,baseBounds:base,sourceRegion:rendered.primary,originalFamily:frame.sectionAppearance?.originalFamily||family(frame.bossSymbolOriginalSource||frame.src),originalBounds:frame.sectionAppearance?.originalBounds||bounds(frame),opacity:Math.max(0,Math.min(100,Number(options.opacity??frame.opacity??100)))};
   const expanded=mapRect(rendered.outer,rendered.primary,base);
   if(sectionRole==='title'&&style.id.startsWith('transform-'))appearance.iconBounds=mapRect({x:style.id==='transform-back'?1737/2010:.0594,y:.0505,width:.0734,height:.0524},rendered.primary,base);
   if(sectionRole==='title'&&style.id==='battle')appearance.iconBounds=mapRect({x:.116,y:.056,width:.047,height:.066},rendered.primary,base);
   frame.src=rendered.src;delete frame.bossSymbolCleared;delete frame.bossSymbolOriginalSource;delete frame.assetId;frame.masks=[];delete frame.maskCanvasBounds;delete frame.ogBounds;delete frame.visualFamilyId;frame.fixedAppearance=true;
   if(sectionRole==='rules'&&card.version==='battle')card.bossFrameSettings={...(card.bossFrameSettings||{}),rulesOpacity:appearance.opacity};
   frame.bounds={x:expanded.x,y:expanded.y,width:expanded.width,height:expanded.height};frame.rotation=expanded.rotation||0;frame.imageFit='stretch';frame.opacity=appearance.opacity;frame.noThumb=true;frame.componentKind=sectionRole==='title'?'Title':'Rules';frame.sectionAppearance=appearance;appearance.lastBounds=bounds(frame);
   // The individual pieces become one composed section image, so opacity applies once.
   const removed=original.filter(item=>item!==frame);card.frames=card.frames.filter(item=>!removed.includes(item));
   for(const item of removed)window.RulesRange?.removeElementReferences('frame',ensureDesignLayerId(item));
   rebaseAnchors(frame,removed);if(sectionRole==='title'&&appearance.fitTitleText)fitTitleText(frame,style,rendered.primary,base,new Set(original.map(item=>ensureDesignLayerId(item))));frame.designTextLayout=localTextLayout(frame,sectionRole);
   for(const item of card.frames){if(item===frame)continue;if(item.sectionCutouts)item.sectionCutouts=item.sectionCutouts.filter(cut=>cut.owner!==owner);const label=item.componentKind||item.name||'';const paired=appearance.originalFamily&&family(item.bossSymbolOriginalSource||item.src)===appearance.originalFamily&&JSON.stringify(bounds(item))===JSON.stringify(appearance.originalBounds);if(paired&&(/pinline/i.test(label)&&appearance.pinlines||/border/i.test(label)&&appearance.crown)){item.sectionCutouts=(item.sectionCutouts||[]).filter(cut=>cut.owner!==owner);item.sectionCutouts.push({owner});}}
   if(sectionRole==='title'){
    // A replacement title includes its own symbol; remove the previous overlay.
    const icons=card.frames.filter(item=>item.bossTitleOwner===owner||(card.version==='battle'&&item.bossTitleOwner==='battle-title'));
    if(style.id==='battle')for(const icon of icons){icon.bossTitleOwner=owner;icon.bounds=clone(appearance.iconBounds);icon.rotation=icon.bounds.rotation||0;icon.bossTitleOwnerBounds=bounds(frame);}
    else {card.frames=card.frames.filter(item=>!icons.includes(item));for(const icon of icons)window.RulesRange?.removeElementReferences('frame',ensureDesignLayerId(icon));}
   }
   frame.image=await image(frame.src);window.RulesRange?.updateElementRelative('frame',owner,{resizeVertical:true});await rebuildFrameLayerList();refreshGeometry(frame);drawFrames();drawTextBuffer();
   if(!options.suppressUndo&&!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Change '+sectionRole+' section appearance');
   status(panel,'Appearance replaced. The card layout and text content were preserved.');return true;
  }catch(error){await applyDesignStateSnapshot(before);status(panel,error.message);return false;}
  finally{busy=false;}
 }
 async function changeCrown(frame,options,panel){
  if(busy||!card.frames.includes(frame)||role(frame)!=='title')return false;
  const before=createDesignStateSnapshot();
  try{
   // Older saved sections baked the crown into the title image. Recover their
   // recorded title appearance once, without using pending title-panel choices.
   if(frame.sectionAppearance?.crown){const saved=clone(frame.sectionAppearance),icons=card.frames.filter(item=>item.bossTitleOwner===frame.designLayerId);if(!await apply(frame,{...saved,crown:false,fitTitleText:false,suppressUndo:true},panel))throw Error('Could not recover the title beneath the crown.');for(const icon of icons)if(!card.frames.includes(icon))card.frames.unshift(icon);}
   busy=true;const owner=ensureDesignLayerId(frame),old=card.frames.filter(item=>item.sectionCrown?.owner===owner);
   let replacement;
   if(!options.remove){
    const inferred=frame.sectionAppearance?.style||FrameSectionCatalog.styles.find(style=>Object.values(style.variants).some(variant=>(variant.src===frame.src||variant.src===frame.bossSymbolOriginalSource)))?.id||(card.version==='battle'?'battle':'regular');
    const type=options.type&&options.type!=='auto'?options.type:inferred;
    const style=FrameSectionCatalog.styles.find(style=>style.id===type)||FrameSectionCatalog.styles.find(style=>style.id==='regular');
    const color=options.left||frame.sectionAppearance?.left||colorOf(frame),right=options.right||'';
    const native=style.variants[color]||style.variants.m||Object.values(style.variants)[0],asset=await image(native.src),size={width:asset.naturalWidth||asset.width,height:asset.naturalHeight||asset.height};
    const mask=canvas(size.width,size.height);mask.getContext('2d').drawImage(await image(native.masks.find(item=>item.name==='Title').src),0,0,size.width,size.height);const rect=alphaBounds(mask);
    const composed=await crownCanvas(style,color,options.pinlines!==false,size,rect,options.backing!==false);if(right)await blendColors(composed,await crownCanvas(style,right,options.pinlines!==false,size,rect,options.backing!==false),rect);
    const outer=alphaBounds(composed),cropped=canvas(outer.width*size.width,outer.height*size.height);cropped.getContext('2d').drawImage(composed,outer.x*size.width,outer.y*size.height,outer.width*size.width,outer.height*size.height,0,0,cropped.width,cropped.height);
    const base=await originalRectangle(frame,'title'),placed=mapRect(outer,rect,base);
    replacement={name:'Legendary crown',componentKind:'Legendary Crown',src:cropped.toDataURL('image/png'),bounds:{x:placed.x,y:placed.y,width:placed.width,height:placed.height},rotation:placed.rotation||0,masks:[],opacity:100,noThumb:true,imageFit:'stretch',fixedAppearance:true,sectionCrown:{owner,type:options.type||'auto',left:color,right,pinlines:options.pinlines!==false,backing:options.backing!==false,lastOwnerBounds:bounds(frame)}};
    ensureDesignLayerId(replacement);replacement.image=await image(replacement.src);
   }
   const removedIds=new Set(old.map(item=>item.designLayerId));card.frames=card.frames.filter(item=>!old.includes(item));for(const item of old)window.RulesRange?.removeElementReferences('frame',item.designLayerId);
   for(const item of card.frames)if(item.sectionCutouts)item.sectionCutouts=item.sectionCutouts.filter(cut=>!removedIds.has(cut.owner));
   if(replacement){card.frames.splice(card.frames.indexOf(frame),0,replacement);const originalFamily=frame.sectionAppearance?.originalFamily||family(frame.bossSymbolOriginalSource||frame.src),originalBounds=frame.sectionAppearance?.originalBounds||bounds(frame);for(const item of card.frames)if(/border/i.test(item.componentKind||item.name||'')&&family(item.bossSymbolOriginalSource||item.src)===originalFamily&&JSON.stringify(bounds(item))===JSON.stringify(originalBounds)){item.sectionCutouts=(item.sectionCutouts||[]).concat({owner:replacement.designLayerId});}}
   await rebuildFrameLayerList();refreshGeometry(frame);drawFrames();drawTextBuffer();if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,options.remove?'Remove legendary crown':'Change legendary crown');status(panel,options.remove?'Crown removed. Title bar preserved.':'Crown updated. Title bar preserved.');return true;
  }catch(error){await applyDesignStateSnapshot(before);status(panel,error.message);return false;}finally{busy=false;}
 }
 // A rules background remains the outer container; its attached boxes share its space.
 function moduleId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
 function relative(rect,container){return{x:(rect.x-container.x)/container.width,y:(rect.y-container.y)/container.height,width:rect.width/container.width,height:rect.height/container.height};}
 const prototypeCache=new Map();
 function renderPrototype(left,right,pinlines=true){const key=left+":"+(right||"")+":"+pinlines;if(!prototypeCache.has(key))prototypeCache.set(key,renderPrototypeArtwork(left,right,pinlines).catch(error=>{prototypeCache.delete(key);throw error;}));return prototypeCache.get(key);}
 async function renderPrototypeArtwork(left,right,pinlines){
  const style=FrameSectionCatalog.styles.find(style=>style.id==='prototype'),variant=style.variants[left];
  if(!variant)throw Error('Prototype boxes support white, blue, black, red, green and multicolor.');
  // Prototype rules artwork is already a cropped section on a full-card canvas.
  // Its Pinline mask is only a border, not a mask for the complete rules interior.
  const layer=await drawResource(variant,[]),size={width:layer.width,height:layer.height},primary=alphaBounds(layer);
  if(right){const other=style.variants[right];if(!other)throw Error('This Prototype color is not available.');await blendColors(layer,await drawResource(other,[],size),primary);}
  if(!pinlines){
   // The stock Prototype outline is baked into the rules PNG. Use its inner
   // texture at the same outer bounds so toggling it never changes the layout.
   const x=primary.x*size.width,y=primary.y*size.height,w=primary.width*size.width,h=primary.height*size.height;
   const insetX=Math.min(w*.08,size.width*11/1500),insetY=Math.min(h*.08,size.height*11/2100),bottom=Math.min(h*.12,size.height*18/2100),interior=canvas(w,h);
   interior.getContext('2d').drawImage(layer,x+insetX,y+insetY,w-2*insetX,h-insetY-bottom,0,0,interior.width,interior.height);
   layer.getContext('2d').clearRect(0,0,size.width,size.height);layer.getContext('2d').drawImage(interior,x,y,w,h);
  }
  const crop=source=>{const rect=alphaBounds(source),out=canvas(rect.width*source.width,rect.height*source.height);out.getContext('2d').drawImage(source,rect.x*source.width,rect.y*source.height,rect.width*source.width,rect.height*source.height,0,0,out.width,out.height);return{src:out.toDataURL('image/png'),rect};};
  const result={...crop(layer),primary,extras:{}};
  for(const [index,kind] of ['mana','pt'].entries()){
   const source=await drawResource(variant.extras[index],[],size);
   if(right)await blendColors(source,await drawResource(style.variants[right].extras[index],[],size),primary);
   result.extras[kind]=crop(source);
  }
  return result;
 }
 async function configurePrototypeParts(frame,options={}){
  const group=frame.sectionModule,range=card.rulesRanges.find(item=>item.id===group.rangeId),part=card.frames.find(item=>item.designLayerId===group.partId);
  const module=range.modules.find(item=>item.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId));
  const rendered=await renderPrototype(options.left||group.left,options.right??group.right,options.pinlines??group.pinlines??true),base=group.baseBounds;
  const destination={...base,height:base.height*group.fraction,y:group.position==='bottom'?base.y+base.height*(1-group.fraction):base.y};
  part.src=rendered.src;part.image=await image(part.src);const primaryEntry=module.elements.find(entry=>entry.kind==='frame'&&entry.key===group.partId);primaryEntry.relative=clone(unit);delete primaryEntry.offset;
  part.bounds={x:destination.x,y:destination.y,width:destination.width,height:destination.height};part.rotation=frame.rotation||0;group.lastPartBounds=bounds(part);
  group.left=options.left||group.left;group.right=options.right??group.right;group.partsVersion=2;group.pinlines=options.pinlines??group.pinlines??true;
  group.pieces={manaFrame:options.manaFrame??group.pieces?.manaFrame??true,manaText:options.manaText??group.pieces?.manaText??true,ptFrame:options.ptFrame??group.pieces?.ptFrame??false,ptText:options.ptText??group.pieces?.ptText??false};
  const fields={};
  for(const kind of ['mana','pt']){
   const existing=card.frames.filter(item=>item.prototypePiece?.owner===frame.designLayerId&&item.prototypePiece.kind===kind);
   if(!group.pieces[kind+'Frame']){
    const ids=new Set(existing.map(item=>item.designLayerId));card.frames=card.frames.filter(item=>!ids.has(item.designLayerId));module.elements=module.elements.filter(entry=>entry.kind!=='frame'||!ids.has(entry.key));
   }else{
    const resource=rendered.extras[kind],placed=mapRect(resource.rect,rendered.primary,destination);
    const extra=existing[0]||{name:kind==='pt'?'Prototype Power/Toughness':'Prototype mana cost box',componentKind:kind==='pt'?'Power/Toughness':'Mana Cost',bounds:{},rotation:frame.rotation||0,masks:[],opacity:100,noThumb:true,imageFit:'stretch',fixedAppearance:true,prototypePiece:{owner:frame.designLayerId,kind}};
    extra.src=resource.src;extra.image=await image(extra.src);extra.bounds={x:placed.x,y:placed.y,width:placed.width,height:placed.height};ensureDesignLayerId(extra);
    if(!existing.length){card.frames.splice(card.frames.indexOf(part),0,extra);module.elements.push({kind:'frame',key:extra.designLayerId,relative:relative(placed,destination),owned:true});}
   }
   const fieldKey=(kind==='pt'?'pt2':'mana2')+'-'+part.designLayerId;
   if(!group.pieces[kind+'Text']){delete card.text[fieldKey];module.elements=module.elements.filter(entry=>entry.kind!=='text'||entry.key!==fieldKey);}
   else if(!card.text[fieldKey]){
    const field=clone(fieldDefinitions('prototype')[kind==='pt'?'pt2':'mana2']);field.text='';field.customField=true;field.sectionOwnerId=frame.designLayerId;field.sectionField=kind==='pt'?'pt2':'mana2';FrameTextPresets.remap(field,{...rendered.primary,rotation:0},destination,false);fields[fieldKey]=field;module.elements.push({kind:'text',key:fieldKey,relative:relative(field,destination),owned:true});
   }
  }
  // Correct the fitted fields of older attachments whose background was masked away.
  if(!group.nativePrimary){for(const entry of module.elements){if(entry.kind!=='text')continue;const field=card.text[entry.key],native=fieldDefinitions('prototype')[field?.sectionField];if(!field||!native)continue;const fit=clone(native);FrameTextPresets.remap(fit,{...rendered.primary,rotation:0},destination,false);entry.relative=relative(fit,destination);delete entry.offset;Object.assign(field,{x:fit.x,y:fit.y,width:fit.width,height:fit.height,size:field.sectionField==='prototype'?(Number(card.text[group.mainKey]?.size)||.038):fit.size});}}
  group.nativePrimary=clone(rendered.primary);group.fieldBounds={};
  if(Object.keys(fields).length)loadTextOptions(fields,false);
  // Rebuild the textbox selector after individually removing a preset field.
  if(Object.keys(card.text||{}).length)loadTextOptions(card.text,true);
  syncRuleModules();
 }
 async function attachPrototype(frame,options={},panel){
  if(busy||!card.frames.includes(frame)||role(frame)!=='rules')return false;
  if(frame.sectionModule)return updatePrototype(frame,options,panel);
  busy=true;const before=createDesignStateSnapshot();
  try{
   const owner=ensureDesignLayerId(frame),base=await originalRectangle(frame,'rules');
   const candidates=Object.entries(card.text||{}).filter(([key,field])=>{const attached=field.frameAnchor?.id===owner&&(field.standardRole==='rules'||!field.oneLine),cx=field.x+field.width/2,cy=field.y+field.height/2;return attached||!field.oneLine&&(key==='rules'||/rules|ability/i.test(field.name||''))&&cx>=base.x&&cx<=base.x+base.width&&cy>=base.y&&cy<=base.y+base.height;});
   if(!candidates.length)throw Error('Add the main rules text field before attaching a Prototype box.');
   const [mainKey,main]=candidates.find(([key,field])=>field.frameAnchor?.id===owner)||candidates[0];
   if((card.rulesRanges||[]).some(range=>range.modules.some(module=>module.elements.some(entry=>entry.kind==='text'&&entry.key===mainKey))))throw Error('This rules field already belongs to a range. Detach it before creating this rules module.');
   const style=FrameSectionCatalog.styles.find(style=>style.id==='prototype'),left=options.left||frame.sectionAppearance?.left||colorOf(frame),right=options.right||'';
   const rendered=await renderPrototype(left,right,options.pinlines!==false),fraction=.38;
   const destination={...base,height:base.height*fraction,y:options.position==='bottom'?base.y+base.height*(1-fraction):base.y};
   const placed=mapRect(rendered.rect,rendered.primary,destination);
   const part={name:'Prototype box',componentKind:'Prototype Box',src:rendered.src,bounds:{x:placed.x,y:placed.y,width:placed.width,height:placed.height},rotation:placed.rotation||0,masks:[],opacity:100,noThumb:true,imageFit:'stretch',fixedAppearance:true};
   ensureDesignLayerId(part);part.image=await image(part.src);card.frames.splice(card.frames.indexOf(frame),0,part);
   const rangeId=moduleId('rules-section'),mainModule={id:moduleId('rules-main'),name:'Rules text',sizing:'flex',size:1,elements:[]},prototypeModule={id:moduleId('rules-prototype'),name:'Prototype',sizing:'fixed',size:destination.height*card.height,elements:[]};
   const range={id:rangeId,name:'Rules + Prototype',kind:'rules-section',direction:'vertical',bounds:clone(base),rotation:base.rotation||0,modules:options.position==='bottom'?[mainModule,prototypeModule]:[prototypeModule,mainModule]};
   const mainRelative=relative(main,base),savedAnchor=main.frameAnchor?clone(main.frameAnchor):null;delete main.frameAnchor;
   // Keep the established horizontal geometry and padding as the available height changes.
   mainModule.elements.push({kind:'text',key:mainKey,relative:clone(mainRelative),owned:false});
   prototypeModule.elements.push({kind:'frame',key:part.designLayerId,relative:relative(placed,destination),owned:true});
   const fields={},definitions=fieldDefinitions('prototype');
   for(const key of ['prototype']){
    const definition=clone(definitions[key]),target=key+'-'+part.designLayerId;definition.text='';definition.customField=true;definition.sectionOwnerId=owner;definition.sectionField=key;
    FrameTextPresets.remap(definition,{...rendered.primary,rotation:0},destination,false);
    definition.size=Number(main.size)||.038;
    fields[target]=definition;prototypeModule.elements.push({kind:'text',key:target,relative:relative(definition,destination),owned:true});
   }
   loadTextOptions(fields,false);
   card.rulesRanges=(card.rulesRanges||[]).concat(range);
   frame.sectionModule={rangeId,partId:part.designLayerId,mainKey,mainRelative,savedAnchor,position:options.position==='bottom'?'bottom':'top',fraction,left,right,rulesFontVersion:1,lastOwnerBounds:bounds(frame),lastPartBounds:bounds(part),baseBounds:clone(base)};
   await configurePrototypeParts(frame,options);syncRuleModules();await rebuildFrameLayerList();window.RulesRange?.refresh();drawFrames();drawTextBuffer();
   if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Attach Prototype rules module');
   status(panel,'Prototype attached. Its background and optional mana/P/T pieces are separate elements.');return true;
  }catch(error){await applyDesignStateSnapshot(before);status(panel,error.message);return false;}finally{busy=false;}
 }
 async function updatePrototype(frame,options={},panel){
  const group=frame.sectionModule;if(!group)return false;const before=createDesignStateSnapshot();
  try{
   if(options.remove){
    const range=(card.rulesRanges||[]).find(item=>item.id===group.rangeId);
    card.rulesRanges=(card.rulesRanges||[]).filter(item=>item!==range);
    if(range)window.RulesRange?.removeOwnedElements(range.modules);
    restoreMainField(frame,group);delete frame.sectionModule;
   }else{
    group.position=options.position==='bottom'?'bottom':'top';
    const part=card.frames.find(item=>item.designLayerId===group.partId);
    if(!part)throw Error('The attached Prototype artwork was removed. Remove this attachment and add it again.');
    await configurePrototypeParts(frame,options);
    syncRuleModules();
   }
   await rebuildFrameLayerList();window.RulesRange?.refresh();drawFrames();drawTextBuffer();
   if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,options.remove?'Remove Prototype rules module':'Update Prototype rules module');
   status(panel,options.remove?'Prototype removed. Main rules text restored.':'Prototype placement updated.');return true;
  }catch(error){await applyDesignStateSnapshot(before);status(panel,error.message);return false;}
 }
 function restoreMainField(frame,group){
  const field=card.text?.[group.mainKey];if(!field)return;field.rangeFontReduction=0;field.rangeUniformTextSize=false;uniformRulesCache.delete(group.rangeId);
  const restored=mapRect(group.mainRelative,unit,{...group.baseBounds,rotation:frame.rotation||0});Object.assign(field,{x:restored.x,y:restored.y,width:restored.width,height:restored.height,rotation:restored.rotation});
  if(group.savedAnchor)field.frameAnchor={...group.savedAnchor,last:bounds(frame)};
 }
 function repairPrototypeRulesDefault(frame){
  const group=frame.sectionModule;if(!group||group.rulesFontVersion===1)return;
  const field=card.text?.['prototype-'+group.partId],main=card.text?.[group.mainKey],range=(card.rulesRanges||[]).find(item=>item.id===group.rangeId);
  if(!field||!main)return;
  const entry=range?.modules.flatMap(module=>module.elements).find(entry=>entry.kind==='text'&&entry.key==='prototype-'+group.partId);
  // Repair only a generated, unstyled default. Preserve explicit size overrides
  // and style families, and leave the text box's geometry unchanged.
  const nativeHeight=group.nativePrimary?.height;
  const generatedSizes=nativeHeight?[group.fraction,.38].map(fraction=>.0295*group.baseBounds.height*fraction/nativeHeight):[];
  if(!entry?.textFamilyId&&(field.font||'mplantin')==='mplantin'&&!Number(field.fontSize)&&generatedSizes.some(size=>Math.abs(size-Number(field.size))<.000001)){
   field.size=Number(main.size)||.038;delete group.uniformSize;uniformRulesCache.delete(group.rangeId);
  }
  group.rulesFontVersion=1;
 }
 function uniformRulesFields(frame){const group=frame.sectionModule;if(!group)return[];return [group.mainKey,'prototype-'+group.partId].map(key=>({key,field:card.text?.[key]})).filter(item=>item.field&&!item.field.hidden);}
 function defaultPixelSize(field){return Math.max(1,(Number(field.size)||.038)*card.height+(parseInt(field.fontSize||'0',10)||0));}
 function setUniformRulesSize(frame,size,enabled){for(const {field} of uniformRulesFields(frame)){field.rangeUniformTextSize=enabled;field.rangeFontReduction=enabled?Math.max(0,defaultPixelSize(field)-size):0;}}
 const uniformRulesCache=new Map();
 function sectionLayouts(range){
  const frame=card.frames.find(frame=>frame.sectionModule?.rangeId===range.id);if(!frame)return null;
  const group=frame.sectionModule,base=group.baseBounds,prototype=range.modules.find(module=>module.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId));
  return range.modules.map(module=>{const isPrototype=module===prototype,fraction=isPrototype?group.fraction:1-group.fraction;const box={x:base.x,y:base.y,width:base.width,height:base.height*fraction};if(group.position==='top'?!isPrototype:isPrototype)box.y+=base.height*(isPrototype?1-group.fraction:group.fraction);return{module,bounds:box,pixels:box.height*card.height,overflow:!!range.fitOverflow};});
 }
 function moduleHeightLimits(range,group){
  const total=group.baseBounds.height*card.height,prototype=range.modules.find(module=>module.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId)),main=range.modules.find(module=>module!==prototype);
  const max=value=>Number.isFinite(value)&&value>=0?value:Infinity;
  const low=Math.max(10,Number(prototype.minSize)||0,total-max(main?.maxSize));
  const high=Math.min(total-Math.max(10,Number(main?.minSize)||0),max(prototype.maxSize));
  return{low:Math.max(1,Math.min(low,high)),high:Math.max(1,high),conflict:low>high};
 }
 function setSectionHeight(frame,pixels){
  const group=frame.sectionModule,range=card.rulesRanges.find(range=>range.id===group.rangeId),module=range.modules.find(module=>module.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId));
  group.fraction=pixels/(group.baseBounds.height*card.height);module.size=pixels;group.lastModuleSize=pixels;syncRuleModules();
 }
 async function fitUniformText(fits){
  syncRuleModules();
  for(const frame of card.frames||[]){
   const group=frame.sectionModule;if(!group)continue;repairPrototypeRulesDefault(frame);
   const range=(card.rulesRanges||[]).find(item=>item.id===group.rangeId),fields=uniformRulesFields(frame);
   if(!range||(fields.length<2)||(!range.uniformTextSize&&!range.autoSizeModules)){setUniformRulesSize(frame,0,false);uniformRulesCache.delete(group.rangeId);continue;}
   const max=Math.max(1,Math.floor(Math.min(...fields.map(({field})=>defaultPixelSize(field))))),limit=Number.isFinite(range.maxFontReduction)?Math.max(0,range.maxFontReduction):Infinity,min=Math.max(1,Math.ceil(Math.max(...fields.filter(({field})=>!/\{fontoverride(?:[+-]?\d+)?\}/i.test(field.text||'')).map(({field})=>defaultPixelSize(field)-limit),max-limit)));
   const signature=()=>JSON.stringify({height:card.height,width:card.width,auto:range.autoSizeModules,uniform:range.uniformTextSize,limit:range.maxFontReduction,modules:range.modules.map(module=>({id:module.id,min:module.minSize,max:module.maxSize})),fields:fields.map(({key,field})=>({key,...Object.fromEntries(Object.entries(field).filter(([name])=>!['rangeFontReduction','rangeUniformTextSize','rangeClip'].includes(name)))})),obstacles:card.frames.filter(item=>/power|toughness/i.test(item.componentKind||item.name||'')).map(item=>({bounds:item.bounds,rotation:item.rotation,hidden:item.hidden}))});
   const cached=uniformRulesCache.get(group.rangeId);
   if(cached?.signature===signature()){group.uniformSize=cached.size;setUniformRulesSize(frame,cached.size,range.uniformTextSize);continue;}
   if(range.autoSizeModules&&!group.autoSizingActive){group.manualFraction=group.fraction;group.autoSizingActive=true;}
   const prototypeModule=range.modules.find(module=>module.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId));
   const protoFields=prototypeModule.elements.filter(entry=>entry.kind==='text').map(entry=>({key:entry.key,field:card.text?.[entry.key]})).filter(item=>item.field&&!item.field.hidden);
   const limits=moduleHeightLimits(range,group),hasText=protoFields.some(({field})=>String(field.text||'').trim());
   const overridden=item=>/\{fontoverride(?:[+-]?\d+)?\}/i.test(item.field.text||'');
   const check=async(items,ignoreOverride)=>{let ok=true;for(const item of items){const result=await fits(item.field,item.key);if(!result&&!(ignoreOverride&&overridden(item)))ok=false;}return ok;};
   const attempt=async size=>{
    setUniformRulesSize(frame,size,true);
    if(range.autoSizeModules){
     let height=limits.low;
     if(hasText){let low=Math.ceil(limits.low),high=Math.floor(limits.high);height=limits.high;
      while(low<=high){const candidate=Math.floor((low+high)/2);setSectionHeight(frame,candidate);setUniformRulesSize(frame,size,true);if(await check(protoFields,false)){height=candidate;high=candidate-1;}else low=candidate+1;}
     }
     setSectionHeight(frame,height);setUniformRulesSize(frame,size,true);
    }
    // Fixed inline overrides stay fixed. An overflowing explicit override is
    // reported by the final render instead of forcing unrelated text smaller.
    return await check(fields,true)&&!limits.conflict;
   };
   let low=min,high=max,best=min,bestHeight=group.fraction*group.baseBounds.height*card.height,found=false;
   while(low<=high){const candidate=Math.floor((low+high)/2);if(await attempt(candidate)){found=true;best=candidate;bestHeight=group.fraction*group.baseBounds.height*card.height;low=candidate+1;}else high=candidate-1;}
   if(!found){await attempt(min);bestHeight=group.fraction*group.baseBounds.height*card.height;}
   if(range.autoSizeModules)setSectionHeight(frame,bestHeight);
   group.uniformSize=best;range.fitOverflow=!found;setUniformRulesSize(frame,best,range.uniformTextSize);uniformRulesCache.set(group.rangeId,{signature:signature(),size:best});
   // Geometry changes made during text fitting also need a frame redraw.
   if(range.autoSizeModules&&typeof redrawFrames!=='undefined')redrawFrames=true;
   if(!document.activeElement||!/^rules-range-/.test(document.activeElement.id||''))window.RulesRange?.refreshInputs?.();
  }
 }
 function syncRuleModules(){
  for(const frame of card.frames||[]){
   const group=frame.sectionModule;if(!group)continue;repairPrototypeRulesDefault(frame);
   const range=(card.rulesRanges||[]).find(item=>item.id===group.rangeId),part=card.frames.find(item=>item.designLayerId===group.partId);
   let current=bounds(frame),rangeChanged=false;
   if(range&&['x','y','width','height'].some(key=>Math.abs(range.bounds[key]-group.baseBounds[key])>1e-9)&&JSON.stringify(current)===JSON.stringify(group.lastOwnerBounds)){
    const placed=mapRect(current,group.baseBounds,{...range.bounds,rotation:range.rotation||0});Object.assign(frame.bounds,{x:placed.x,y:placed.y,width:placed.width,height:placed.height});frame.rotation=placed.rotation;current=bounds(frame);rangeChanged=true;
   }
   if(JSON.stringify(current)!==JSON.stringify(group.lastOwnerBounds)){group.baseBounds=mapRect(group.baseBounds,group.lastOwnerBounds,current);group.lastOwnerBounds=current;}
   if(!range||!part||!range.modules.some(module=>module.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId))){
    if(range){card.rulesRanges=card.rulesRanges.filter(item=>item!==range);window.RulesRange?.removeOwnedElements(range.modules);}
    restoreMainField(frame,group);delete frame.sectionModule;continue;
   }
   if(!range.autoSizeModules&&group.autoSizingActive){group.fraction=group.manualFraction??group.fraction;delete group.autoSizingActive;delete group.uniformSize;const resetModule=range.modules.find(module=>module.elements.some(entry=>entry.key===group.partId));resetModule.size=group.baseBounds.height*card.height*group.fraction;group.lastModuleSize=resetModule.size;}
   const base=group.baseBounds;
   const mainField=card.text?.[group.mainKey];
   if(!rangeChanged&&mainField&&group.lastMainBounds&&JSON.stringify({x:mainField.x,y:mainField.y,width:mainField.width,height:mainField.height})!==JSON.stringify(group.lastMainBounds)){
    const edited=relative(mainField,group.lastMainBox),share=group.lastMainBox.height/base.height;group.mainRelative={...edited,y:edited.y*share,height:1-share+edited.height*share};
   }
   const prototype=range.modules.find(module=>module.elements.some(entry=>entry.kind==='frame'&&entry.key===group.partId)),main=range.modules.find(module=>module.elements.some(entry=>entry.kind==='text'&&entry.key===group.mainKey));
   if(!main){card.rulesRanges=card.rulesRanges.filter(item=>item!==range);window.RulesRange?.removeOwnedElements(range.modules);restoreMainField(frame,group);delete frame.sectionModule;continue;}
   // Dragging the Prototype box changes how much of the outer rules region it occupies.
   if(JSON.stringify(bounds(part))!==JSON.stringify(group.lastPartBounds)){
    const entry=prototype.elements.find(entry=>entry.kind==='frame');
    group.fraction=part.bounds.height/(base.height*(entry.relative?.height||1));
   }else if(prototype.size!==group.lastModuleSize&&group.lastModuleSize!==undefined)group.fraction=prototype.size/(base.height*card.height);
   group.fraction=Math.max(range.autoSizeModules?1/(base.height*card.height):.01,Math.min(.99,group.fraction));prototype.size=base.height*card.height*group.fraction;group.lastModuleSize=prototype.size;
   range.bounds={x:base.x,y:base.y,width:base.width,height:base.height};range.rotation=base.rotation||0;
   range.modules=group.position==='bottom'?[main,prototype]:[prototype,main];
   const protoBox={...base,height:base.height*group.fraction,y:group.position==='bottom'?base.y+base.height*(1-group.fraction):base.y};
   const mainBox={...base,height:base.height*(1-group.fraction),y:group.position==='top'?base.y+base.height*group.fraction:base.y};
   for(const [module,box] of [[prototype,protoBox],[main,mainBox]])for(const entry of module.elements){
    const target=entry.kind==='frame'?card.frames.find(item=>item.designLayerId===entry.key):card.text?.[entry.key];if(!target)continue;
    if(entry.kind==='text'&&entry.key!==group.mainKey&&group.fieldBounds?.[entry.key]&&!rangeChanged){const fieldBounds={x:target.x,y:target.y,width:target.width,height:target.height};if(JSON.stringify(fieldBounds)!==JSON.stringify(group.fieldBounds[entry.key]))entry.relative=relative(target,group.lastProtoBox);}
    const local=entry.relative||relative(entry.kind==='frame'?target.bounds:target,box);entry.relative=local;delete entry.offset;
    // The main rules field preserves its original top/bottom inset, rather than compressing its padding.
    const effective=entry.kind==='text'&&entry.key===group.mainKey?{...group.mainRelative,y:group.mainRelative.y/(1-group.fraction),height:Math.max(.01,(group.mainRelative.height-group.fraction)/(1-group.fraction))}:local;
    entry.relative=clone(effective);
    const fitted=mapRect(effective,unit,{...box,rotation:frame.rotation||0});
    Object.assign(entry.kind==='frame'?target.bounds:target,{x:fitted.x,y:fitted.y,width:fitted.width,height:fitted.height});target.rotation=fitted.rotation;
    if(target.frameAnchor)delete target.frameAnchor;
   }
   if(range.uniformTextSize&&uniformRulesFields(frame).length>=2){const sizes=uniformRulesFields(frame).map(({field})=>defaultPixelSize(field));const size=Math.min(group.uniformSize||Infinity,...sizes);setUniformRulesSize(frame,Number.isFinite(size)?size:1,true);}else setUniformRulesSize(frame,0,false);
   group.fieldBounds={};for(const entry of prototype.elements)if(entry.kind==='text'&&card.text?.[entry.key]){const field=card.text[entry.key];group.fieldBounds[entry.key]={x:field.x,y:field.y,width:field.width,height:field.height};}
   group.lastProtoBox=clone(protoBox);group.lastPartBounds=bounds(part);group.lastMainBox=clone(mainBox);
   if(mainField)group.lastMainBounds={x:mainField.x,y:mainField.y,width:mainField.width,height:mainField.height};
  }
 }
 function sync(){syncRuleModules();for(const frame of card.frames||[]){const appearance=frame.sectionAppearance;if(!appearance)continue;const current=bounds(frame);if(JSON.stringify(current)!==JSON.stringify(appearance.lastBounds)){appearance.baseBounds=mapRect(appearance.baseBounds,appearance.lastBounds,current);if(appearance.iconBounds)appearance.iconBounds=mapRect(appearance.iconBounds,appearance.lastBounds,current);appearance.lastBounds=current;}}for(const frame of card.frames||[]){const crown=frame.sectionCrown;if(!crown)continue;const owner=card.frames.find(item=>item.designLayerId===crown.owner);if(!owner)continue;const current=bounds(owner);if(JSON.stringify(current)!==JSON.stringify(crown.lastOwnerBounds)){const placed=mapRect(bounds(frame),crown.lastOwnerBounds,current);frame.bounds={x:placed.x,y:placed.y,width:placed.width,height:placed.height};frame.rotation=placed.rotation||0;crown.lastOwnerBounds=current;}}window.BossFrameTools?.syncSymbols();}
 function cutouts(context,frame){if(!frame.sectionCutouts?.length)return;context.save();context.globalCompositeOperation='destination-out';for(const cut of frame.sectionCutouts){const owner=card.frames.find(item=>item.designLayerId===cut.owner);if(!owner?.sectionAppearance&&!owner?.sectionCrown)continue;const b=bounds(owner);context.save();context.translate(scaleX(b.x)+scaleWidth(b.width)/2,scaleY(b.y)+scaleHeight(b.height)/2);context.rotate(b.rotation*Math.PI/180);context.fillStyle='black';context.fillRect(-scaleWidth(b.width)/2,-scaleHeight(b.height)/2,scaleWidth(b.width),scaleHeight(b.height));context.restore();}context.restore();}
 function restoreAppearance(frame,definition){if(!frame.sectionAppearance&&!definition.sectionAppearance&&!frame.sectionCutouts&&!definition.sectionCutouts&&!frame.sectionCrown&&!definition.sectionCrown&&!frame.sectionModule&&!definition.sectionModule&&!frame.prototypePiece&&!definition.prototypePiece)return;for(const key of ['prototypePiece','sectionModule','sectionAppearance','sectionCrown','sectionCutouts','fixedAppearance','visualFamilyId','componentKind','designTextLayout','maskCanvasBounds','ogBounds','assetId']){if(definition[key]===undefined)delete frame[key];else frame[key]=clone(definition[key]);}frame.src=definition.src;frame.masks=clone(definition.masks||[]);Promise.all([image(frame.src).then(asset=>{frame.image=asset;}),...frame.masks.map(async mask=>{mask.image=await image(mask.src);})]).then(drawFrames).catch(()=>{});}
 function fieldDefinitions(style){
  if(style==='adventure')return{rules:{name:'Rules Text (Right)',x:.5267,y:.65,width:.3867,height:.2358,size:.0353,font:'mplantin'},mana2:{name:'Adventure Mana Cost',x:.0814,y:.6391,width:.4,height:60/2100,size:60/1638,color:'white',align:'right',oneLine:true,manaCost:true},title2:{name:'Adventure Title',x:.0814,y:.6391,width:.4,height:.0296,size:.0296,color:'white',oneLine:true,font:'belerenb'},type2:{name:'Adventure Type',x:.0814,y:.6839,width:.4,height:.0296,size:.0296,color:'white',oneLine:true,font:'belerenb'},rules2:{name:'Adventure Rules Text',x:.0854,y:.7358,width:.3947,height:.15,size:.0353,font:'mplantin'}};
  if(style==='prototype')return{rules:{name:'Rules Text',x:129/1500,y:1565/2100,width:1242/1500,height:359/2100,size:.0295,font:'mplantin'},prototype:{name:'Prototype Rules',x:129/1500,y:1335/2100,width:1041/1500,height:193/2100,size:.0295,font:'mplantin'},mana2:{name:'Prototype Mana Cost',x:-24/1500,y:1340/2100,width:.9292,height:71/2100,size:72/2100,align:'right',oneLine:true,manaCost:true},pt2:{name:'Prototype Power/Toughness',x:.7928,y:.6935,width:.1367,height:.0372,size:.0372,color:'white',font:'belerenbsc',oneLine:true,align:'center'}};
  return null;
 }
 function insertFields(frame,panel){const appearance=frame.sectionAppearance,definitions=fieldDefinitions(appearance?.style);if(!definitions)return;const before=createDesignStateSnapshot(),fields={};for(const[key,definition]of Object.entries(definitions)){const existing=Object.entries(card.text||{}).find(([name,field])=>field.sectionOwnerId===frame.designLayerId&&field.sectionField===key);const target=existing?.[0]||(!card.text[key]?.frameAnchor||card.text[key]?.frameAnchor.id===frame.designLayerId?key:key+'-'+frame.designLayerId);const field={...clone(definition),text:card.text[target]?.text||'',customField:true,sectionOwnerId:frame.designLayerId,sectionField:key};FrameTextPresets.remap(field,{...appearance.sourceRegion,rotation:0},appearance.baseBounds,false);field.frameAnchor={id:frame.designLayerId,last:bounds(frame)};fields[target]=field;}const content=Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.text]));loadTextOptions(fields,false);for(const[key,text]of Object.entries(content))card.text[key].text=text;drawTextBuffer();if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Insert '+appearance.style+' section fields');status(panel,'Preset fields added. Existing content was preserved.');}
 function mount(container,frame){container.querySelector('.frame-section-tools')?.remove();if(!frame)return;const sectionRole=role(frame);if(!sectionRole){const chooser=document.createElement('details');chooser.className='frame-section-tools wide';chooser.innerHTML='<summary>Use as a title or rules section</summary><select class="input"><option value="Title">Title / header</option><option value="Rules">Rules background</option></select><button class="input" type="button">Configure section</button>';chooser.querySelector('button').onclick=()=>{const before=createDesignStateSnapshot();frame.componentKind=chooser.querySelector('select').value;if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Set frame section role');if(window.FrameTextPresets)FrameTextPresets.mount(container,frame);else mount(container,frame);};insertAppearance(container,chooser);return;}const panel=document.createElement('section');panel.className='frame-section-tools wide';
  panel.innerHTML='<h3>'+ (sectionRole==='title'?'Title':'Rules') +' appearance</h3><label>Style<select class="input" data-section-style></select></label><label>Color<select class="input" data-section-left></select></label><label><input type="checkbox" data-section-split> Split colors</label><label data-section-right-row hidden>Right color<select class="input" data-section-right></select></label>'+''+'<button class="input" type="button" data-section-apply>Apply appearance</button><details><summary>Advanced</summary>'+(sectionRole==='title'?'<label><input type="checkbox" data-section-fit-text checked> Fit title text around this style’s symbol</label>':'')+'<label><input type="checkbox" data-section-pinlines checked> Include matching pinlines</label><label>Background opacity (%)<input class="input" type="number" min="0" max="100" data-section-opacity value="100"></label><button class="input" type="button" data-section-browse>Use the selected Browse frame’s section</button><p>Uses that asset’s section without loading its card layout.</p><button class="input" type="button" data-section-fields hidden>Add preset text fields</button></details><p data-section-status role="status"></p>';
  if(sectionRole==='title'){
   const crownControls=document.createElement('details');crownControls.open=true;crownControls.innerHTML='<summary>Legendary crown</summary><label>Crown type<select class="input" data-crown-type><option value="auto">Match current title</option><option value="regular">Regular</option><option value="transform-front">Transform — front</option><option value="transform-back">Transform — back</option></select></label><label>Crown color<select class="input" data-crown-left></select></label><label><input type="checkbox" data-crown-split> Split crown colors</label><label data-crown-right-row hidden>Right crown color<select class="input" data-crown-right></select></label><label><input type="checkbox" data-crown-pinlines checked> Crown pinlines</label><label><input type="checkbox" data-crown-backing checked> Hide underlying pinlines (black backing)</label><button type="button" class="input" data-crown-update>Add / Update crown</button><button type="button" class="input" data-crown-remove>Remove crown</button><p>Changes only the crown. Title style, colors, text and symbol stay as they are.</p>';panel.insertBefore(crownControls,panel.querySelector('[data-section-status]'));
   const current=card.frames.find(item=>item.sectionCrown?.owner===frame.designLayerId)?.sectionCrown||frame.sectionAppearance||{};
   for(const selector of ['[data-crown-left]','[data-crown-right]'])for(const[key,label]of Object.entries(colors)){const option=document.createElement('option');option.value=key;option.textContent=label;crownControls.querySelector(selector).appendChild(option);}
   crownControls.querySelector('[data-crown-type]').value=current.type||'auto';crownControls.querySelector('[data-crown-left]').value=current.left||colorOf(frame);crownControls.querySelector('[data-crown-right]').value=current.right||'u';crownControls.querySelector('[data-crown-split]').checked=!!current.right;crownControls.querySelector('[data-crown-right-row]').hidden=!current.right;crownControls.querySelector('[data-crown-pinlines]').checked=current.pinlines!==false;crownControls.querySelector('[data-crown-backing]').checked=current.backing!==false;
   crownControls.querySelector('[data-crown-split]').onchange=event=>{crownControls.querySelector('[data-crown-right-row]').hidden=!event.target.checked;};
   crownControls.querySelector('[data-crown-update]').onclick=async()=>{if(await changeCrown(frame,{type:crownControls.querySelector('[data-crown-type]').value,left:crownControls.querySelector('[data-crown-left]').value,right:crownControls.querySelector('[data-crown-split]').checked?crownControls.querySelector('[data-crown-right]').value:'',pinlines:crownControls.querySelector('[data-crown-pinlines]').checked,backing:crownControls.querySelector('[data-crown-backing]').checked},panel))mount(container,frame);};
   crownControls.querySelector('[data-crown-remove]').disabled=!frame.sectionAppearance?.crown&&!card.frames.some(item=>item.sectionCrown?.owner===frame.designLayerId);crownControls.querySelector('[data-crown-remove]').onclick=async()=>{if(await changeCrown(frame,{remove:true},panel))mount(container,frame);};
  }
  if(sectionRole==='rules'){
   const attachment=document.createElement('details');attachment.open=true;
   attachment.innerHTML='<summary>Attached rules boxes</summary><label>Prototype placement<select class="input" data-prototype-position><option value="top">Top</option><option value="bottom">Bottom</option></select></label><label>Prototype color<select class="input" data-prototype-color></select></label><label><input type="checkbox" data-prototype-split> Split Prototype colors</label><label data-prototype-right-row hidden>Right Prototype color<select class="input" data-prototype-right></select></label><label><input type="checkbox" data-prototype-pinlines checked> Prototype pinlines</label><details><summary>Optional pieces</summary><label><input type="checkbox" data-prototype-mana-frame> Mana cost artwork</label><label><input type="checkbox" data-prototype-mana-text> Mana cost text</label><label><input type="checkbox" data-prototype-pt-frame> Power/toughness artwork</label><label><input type="checkbox" data-prototype-pt-text> Power/toughness text</label></details><button class="input" type="button" data-prototype-add>'+ (frame.sectionModule?'Update Prototype box':'Attach Prototype box') +'</button><button class="input" type="button" data-prototype-remove>Remove Prototype box</button><p>Keeps this background. Drag the Prototype box to adjust the space available to the main rules text. Optional pieces can also be selected and removed individually on the canvas.</p>';
   const group=frame.sectionModule;
   attachment.querySelector('[data-prototype-position]').value=group?.position||'top';attachment.querySelector('[data-prototype-pinlines]').checked=group?.pinlines!==false;
   for(const selector of ['[data-prototype-color]','[data-prototype-right]'])for(const key of Object.keys(FrameSectionCatalog.styles.find(style=>style.id==='prototype').variants)){const option=document.createElement('option');option.value=key;option.textContent=colors[key];attachment.querySelector(selector).appendChild(option);}
   const initialColor=group?.left||frame.sectionAppearance?.left||colorOf(frame);attachment.querySelector('[data-prototype-color]').value=['w','u','b','r','g','m'].includes(initialColor)?initialColor:'m';
   attachment.querySelector('[data-prototype-right]').value=group?.right||'u';attachment.querySelector('[data-prototype-split]').checked=!!group?.right;attachment.querySelector('[data-prototype-right-row]').hidden=!group?.right;
   attachment.querySelector('[data-prototype-split]').onchange=event=>{attachment.querySelector('[data-prototype-right-row]').hidden=!event.target.checked;};
   for(const [key,selector,fallback] of [['manaFrame','mana-frame',true],['manaText','mana-text',true],['ptFrame','pt-frame',false],['ptText','pt-text',false]]){
    let checked=group?.pieces?.[key]??fallback;
    if(group?.partsVersion===2){const kind=key.startsWith('pt')?'pt':'mana';checked=key.endsWith('Frame')?card.frames.some(item=>item.prototypePiece?.owner===frame.designLayerId&&item.prototypePiece.kind===kind):!!card.text[(kind==='pt'?'pt2':'mana2')+'-'+group.partId];}
    attachment.querySelector('[data-prototype-'+selector+']').checked=checked;
   }
   attachment.querySelector('[data-prototype-remove]').hidden=!group;
   attachment.querySelector('[data-prototype-add]').onclick=async()=>{if(await attachPrototype(frame,{position:attachment.querySelector('[data-prototype-position]').value,left:attachment.querySelector('[data-prototype-color]').value,right:attachment.querySelector('[data-prototype-split]').checked?attachment.querySelector('[data-prototype-right]').value:'',pinlines:attachment.querySelector('[data-prototype-pinlines]').checked,manaFrame:attachment.querySelector('[data-prototype-mana-frame]').checked,manaText:attachment.querySelector('[data-prototype-mana-text]').checked,ptFrame:attachment.querySelector('[data-prototype-pt-frame]').checked,ptText:attachment.querySelector('[data-prototype-pt-text]').checked},panel))mount(container,frame);};
   attachment.querySelector('[data-prototype-remove]').onclick=async()=>{if(await updatePrototype(frame,{remove:true},panel))mount(container,frame);};
   panel.insertBefore(attachment,panel.querySelector('[data-section-status]'));
  }
  const appearance=frame.sectionAppearance||{};const select=panel.querySelector('[data-section-style]');for(const style of FrameSectionCatalog.styles.filter(style=>style.roles.includes(sectionRole))){const option=document.createElement('option');option.value=style.id;option.textContent=style.label;select.appendChild(option);}if(appearance.style==='browse'){const option=document.createElement('option');option.value='browse';option.textContent='Custom / Browse asset';select.appendChild(option);}select.value=appearance.style||FrameSectionCatalog.styles.find(style=>Object.values(style.variants).some(variant=>(variant.src===frame.src||variant.src===frame.bossSymbolOriginalSource)))?.id||'regular';
  for(const selector of ['[data-section-left]','[data-section-right]'])for(const[key,label]of Object.entries(colors)){const option=document.createElement('option');option.value=key;option.textContent=label;panel.querySelector(selector).appendChild(option);}
  const same=members(frame,sectionRole),rightPiece=same.find(item=>(item.masks||[]).some(mask=>/^right half$/i.test(mask.name||''))),leftPiece=same.find(item=>item!==rightPiece),right=appearance.right||(same.length>1?colorOf(rightPiece||same.find(item=>item!==frame)):'');panel.querySelector('[data-section-left]').value=appearance.left||colorOf(leftPiece||frame);panel.querySelector('[data-section-right]').value=right||'u';panel.querySelector('[data-section-split]').checked=!!right;panel.querySelector('[data-section-right-row]').hidden=!right;panel.querySelector('[data-section-pinlines]').checked=appearance.pinlines!==false;panel.querySelector('[data-section-opacity]').value=frame.opacity??100;if(sectionRole==='title'){panel.querySelector('[data-section-fit-text]').checked=appearance.fitTitleText!==false;}
  function updatePalette(){const style=FrameSectionCatalog.styles.find(item=>item.id===select.value);if(!style)return;for(const selector of ['[data-section-left]','[data-section-right]']){const input=panel.querySelector(selector);for(const option of input.options)option.disabled=!style.variants[option.value];if(!style.variants[input.value])input.value=style.variants.m?'m':Object.keys(style.variants)[0];}}select.onchange=updatePalette;updatePalette();
  panel.querySelector('[data-section-split]').onchange=event=>{panel.querySelector('[data-section-right-row]').hidden=!event.target.checked;};
  const fields=panel.querySelector('[data-section-fields]');fields.hidden=!fieldDefinitions(appearance.style);fields.onclick=()=>insertFields(frame,panel);
  panel.querySelector('[data-section-apply]').onclick=async()=>{const ok=await apply(frame,{role:sectionRole,style:select.value,left:panel.querySelector('[data-section-left]').value,right:panel.querySelector('[data-section-split]').checked?panel.querySelector('[data-section-right]').value:'',crown:!!frame.sectionAppearance?.crown,fitTitleText:panel.querySelector('[data-section-fit-text]')?.checked,pinlines:panel.querySelector('[data-section-pinlines]').checked,opacity:panel.querySelector('[data-section-opacity]').value},panel);if(ok)fields.hidden=!fieldDefinitions(frame.sectionAppearance.style);};
  panel.querySelector('[data-section-browse]').onclick=async()=>{if(typeof availableFrames==='undefined'||typeof selectedFrameIndex==='undefined'||!availableFrames[selectedFrameIndex]){status(panel,'Choose a frame asset in Browse Frames first.');return;}const resource=availableFrames[selectedFrameIndex],ok=await apply(frame,{role:sectionRole,style:'browse',browseResource:clone(resource),left:colorOf(resource),right:'',crown:false,pinlines:panel.querySelector('[data-section-pinlines]').checked,opacity:panel.querySelector('[data-section-opacity]').value,fitTitleText:false},panel);if(ok)mount(container,frame);};
  insertAppearance(container,panel);
 }
 window.FrameSectionTools={role,apply,changeCrown,attachPrototype,updatePrototype,renderPrototype,fitUniformText,sectionLayouts,syncRuleModules,mount,sync,cutouts,restoreAppearance,insertFields,renderStyle,originalRectangle,fieldDefinitions};
})();
