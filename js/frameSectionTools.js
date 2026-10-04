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
 function members(frame,sectionRole){if(frame.sectionAppearance)return[frame];const original=family(frame.src),b=bounds(frame);return card.frames.filter(item=>item===frame||(original&&family(item.src)===original&&role(item)===sectionRole&&JSON.stringify(bounds(item))===JSON.stringify(b)));}
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
   const names=maskNames.slice();if(pinlines)for(const mask of variant.masks||[])if(mask.name==='Pinline')names.push(mask.name);
   const layer=await drawResource(variant,names,size),ctx=layer.getContext('2d');
   // Pinline masks span the entire card. Keep only this section's portion.
   if(pinlines&&names.length>maskNames.length){const clip=expand(rect,.004);ctx.globalCompositeOperation='destination-in';ctx.fillStyle='black';const limiter=canvas(size.width,size.height);limiter.getContext('2d').fillRect(clip.x*size.width,clip.y*size.height,clip.width*size.width,clip.height*size.height);ctx.drawImage(limiter,0,0);}
   ctx.globalCompositeOperation='source-over';
   if(style.id==='prototype')for(const extra of variant.extras||[])ctx.drawImage(await drawResource(extra,[],size),0,0);
   if(crown&&sectionRole==='title'){
    // Battle keeps its transform symbol on the left, like the transform-front title.
    const crownStyle=style.id==='battle'?'transform-front':style.id.startsWith('transform-')?style.id:'regular';const crownResource=FrameSectionCatalog.crowns[crownStyle]?.[key];if(!crownResource)throw Error('No legendary crown is available for this color.');
    const masks=crownResource.masks.filter(mask=>pinlines?/With Pinlines/i.test(mask.name):/Without Pinlines/i.test(mask.name)).map(mask=>mask.name);
    const reference=FrameSectionCatalog.styles.find(item=>item.id===crownStyle).variants[key]||FrameSectionCatalog.styles.find(item=>item.id===crownStyle).variants.m;
    const titleMask=await image(reference.masks.find(mask=>mask.name==='Title').src),referenceCanvas=canvas(titleMask.naturalWidth||titleMask.width,titleMask.naturalHeight||titleMask.height);referenceCanvas.getContext('2d').drawImage(titleMask,0,0);
    const from=alphaBounds(referenceCanvas),crownLayer=await drawResource(crownResource,masks,{width:referenceCanvas.width,height:referenceCanvas.height});
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
   const previousSource=frame.src,previousBounds=bounds(frame),owner=ensureDesignLayerId(frame),appearance={role:sectionRole,style:style.id,fitTitleText:options.fitTitleText!==false,left:options.left||colorOf(frame),right:options.right||'',pinlines:options.pinlines!==false,crown:!!options.crown,baseBounds:base,sourceRegion:rendered.primary,originalFamily:frame.sectionAppearance?.originalFamily||family(frame.src),originalBounds:frame.sectionAppearance?.originalBounds||bounds(frame),opacity:Math.max(0,Math.min(100,Number(options.opacity??frame.opacity??100)))};
   const expanded=mapRect(rendered.outer,rendered.primary,base);
   if(sectionRole==='title'&&style.id.startsWith('transform-'))appearance.iconBounds=mapRect({x:style.id==='transform-back'?1737/2010:.0594,y:.0505,width:.0734,height:.0524},rendered.primary,base);
   if(sectionRole==='title'&&style.id==='battle')appearance.iconBounds=mapRect({x:.116,y:.056,width:.047,height:.066},rendered.primary,base);
   frame.src=rendered.src;delete frame.assetId;frame.masks=[];delete frame.maskCanvasBounds;delete frame.ogBounds;delete frame.visualFamilyId;frame.fixedAppearance=true;
   if(sectionRole==='rules'&&card.version==='battle')card.bossFrameSettings={...(card.bossFrameSettings||{}),rulesOpacity:appearance.opacity};
   frame.bounds={x:expanded.x,y:expanded.y,width:expanded.width,height:expanded.height};frame.rotation=expanded.rotation||0;frame.imageFit='stretch';frame.opacity=appearance.opacity;frame.noThumb=true;frame.componentKind=sectionRole==='title'?'Title':'Rules';frame.sectionAppearance=appearance;appearance.lastBounds=bounds(frame);
   // The individual pieces become one composed section image, so opacity applies once.
   const removed=original.filter(item=>item!==frame);card.frames=card.frames.filter(item=>!removed.includes(item));
   for(const item of removed)window.RulesRange?.removeElementReferences('frame',ensureDesignLayerId(item));
   rebaseAnchors(frame,removed);if(sectionRole==='title'&&appearance.fitTitleText)fitTitleText(frame,style,rendered.primary,base,new Set(original.map(item=>ensureDesignLayerId(item))));frame.designTextLayout=localTextLayout(frame,sectionRole);
   for(const item of card.frames){if(item===frame)continue;if(item.sectionCutouts)item.sectionCutouts=item.sectionCutouts.filter(cut=>cut.owner!==owner);const label=item.componentKind||item.name||'';const paired=appearance.originalFamily&&family(item.src)===appearance.originalFamily&&JSON.stringify(bounds(item))===JSON.stringify(appearance.originalBounds);if(paired&&(/pinline/i.test(label)&&appearance.pinlines||/border/i.test(label)&&appearance.crown)){item.sectionCutouts=(item.sectionCutouts||[]).filter(cut=>cut.owner!==owner);item.sectionCutouts.push({owner});}}
   if(sectionRole==='title'){
    // A replacement title includes its own symbol; remove the previous overlay.
    const icons=card.frames.filter(item=>item.bossTitleOwner===owner||(card.version==='battle'&&item.bossTitleOwner==='battle-title'));
    if(style.id==='battle')for(const icon of icons){icon.bossTitleOwner=owner;icon.bounds=clone(appearance.iconBounds);icon.rotation=icon.bounds.rotation||0;}
    else {card.frames=card.frames.filter(item=>!icons.includes(item));for(const icon of icons)window.RulesRange?.removeElementReferences('frame',ensureDesignLayerId(icon));}
   }
   frame.image=await image(frame.src);window.RulesRange?.updateElementRelative('frame',owner,{resizeVertical:true});await rebuildFrameLayerList();refreshGeometry(frame);drawFrames();drawTextBuffer();
   if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Change '+sectionRole+' section appearance');
   status(panel,'Appearance replaced. The card layout and text content were preserved.');return true;
  }catch(error){await applyDesignStateSnapshot(before);status(panel,error.message);return false;}
  finally{busy=false;}
 }
 function sync(){for(const frame of card.frames||[]){const appearance=frame.sectionAppearance;if(!appearance)continue;const current=bounds(frame);if(JSON.stringify(current)!==JSON.stringify(appearance.lastBounds)){appearance.baseBounds=mapRect(appearance.baseBounds,appearance.lastBounds,current);if(appearance.iconBounds)appearance.iconBounds=mapRect(appearance.iconBounds,appearance.lastBounds,current);appearance.lastBounds=current;}}}
 function cutouts(context,frame){if(!frame.sectionCutouts?.length)return;context.save();context.globalCompositeOperation='destination-out';for(const cut of frame.sectionCutouts){const owner=card.frames.find(item=>item.designLayerId===cut.owner);if(!owner?.sectionAppearance)continue;const b=bounds(owner);context.save();context.translate(scaleX(b.x)+scaleWidth(b.width)/2,scaleY(b.y)+scaleHeight(b.height)/2);context.rotate(b.rotation*Math.PI/180);context.fillStyle='black';context.fillRect(-scaleWidth(b.width)/2,-scaleHeight(b.height)/2,scaleWidth(b.width),scaleHeight(b.height));context.restore();}context.restore();}
 function restoreAppearance(frame,definition){if(!frame.sectionAppearance&&!definition.sectionAppearance&&!frame.sectionCutouts&&!definition.sectionCutouts)return;for(const key of ['sectionAppearance','sectionCutouts','fixedAppearance','visualFamilyId','componentKind','designTextLayout','maskCanvasBounds','ogBounds','assetId']){if(definition[key]===undefined)delete frame[key];else frame[key]=clone(definition[key]);}frame.src=definition.src;frame.masks=clone(definition.masks||[]);Promise.all([image(frame.src).then(asset=>{frame.image=asset;}),...frame.masks.map(async mask=>{mask.image=await image(mask.src);})]).then(drawFrames).catch(()=>{});}
 function fieldDefinitions(style){
  if(style==='adventure')return{rules:{name:'Rules Text (Right)',x:.5267,y:.65,width:.3867,height:.2358,size:.0353,font:'mplantin'},mana2:{name:'Adventure Mana Cost',x:.0814,y:.6391,width:.4,height:60/2100,size:60/1638,color:'white',align:'right',oneLine:true,manaCost:true},title2:{name:'Adventure Title',x:.0814,y:.6391,width:.4,height:.0296,size:.0296,color:'white',oneLine:true,font:'belerenb'},type2:{name:'Adventure Type',x:.0814,y:.6839,width:.4,height:.0296,size:.0296,color:'white',oneLine:true,font:'belerenb'},rules2:{name:'Adventure Rules Text',x:.0854,y:.7358,width:.3947,height:.15,size:.0353,font:'mplantin'}};
  if(style==='prototype')return{rules:{name:'Rules Text',x:129/1500,y:1565/2100,width:1242/1500,height:359/2100,size:.0295,font:'mplantin'},prototype:{name:'Prototype Rules',x:129/1500,y:1335/2100,width:1041/1500,height:193/2100,size:.0295,font:'mplantin'},mana2:{name:'Prototype Mana Cost',x:-24/1500,y:1340/2100,width:.9292,height:71/2100,size:72/2100,align:'right',oneLine:true,manaCost:true},pt2:{name:'Prototype Power/Toughness',x:.7928,y:.6935,width:.1367,height:.0372,size:.0372,color:'white',font:'belerenbsc',oneLine:true,align:'center'}};
  return null;
 }
 function insertFields(frame,panel){const appearance=frame.sectionAppearance,definitions=fieldDefinitions(appearance?.style);if(!definitions)return;const before=createDesignStateSnapshot(),fields={};for(const[key,definition]of Object.entries(definitions)){const existing=Object.entries(card.text||{}).find(([name,field])=>field.sectionOwnerId===frame.designLayerId&&field.sectionField===key);const target=existing?.[0]||(!card.text[key]?.frameAnchor||card.text[key]?.frameAnchor.id===frame.designLayerId?key:key+'-'+frame.designLayerId);const field={...clone(definition),text:card.text[target]?.text||'',customField:true,sectionOwnerId:frame.designLayerId,sectionField:key};FrameTextPresets.remap(field,{...appearance.sourceRegion,rotation:0},appearance.baseBounds,false);field.frameAnchor={id:frame.designLayerId,last:bounds(frame)};fields[target]=field;}const content=Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.text]));loadTextOptions(fields,false);for(const[key,text]of Object.entries(content))card.text[key].text=text;drawTextBuffer();if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Insert '+appearance.style+' section fields');status(panel,'Preset fields added. Existing content was preserved.');}
 function mount(container,frame){container.querySelector('.frame-section-tools')?.remove();if(!frame)return;const sectionRole=role(frame);if(!sectionRole){const chooser=document.createElement('details');chooser.className='frame-section-tools wide';chooser.innerHTML='<summary>Use as a title or rules section</summary><select class="input"><option value="Title">Title / header</option><option value="Rules">Rules background</option></select><button class="input" type="button">Configure section</button>';chooser.querySelector('button').onclick=()=>{const before=createDesignStateSnapshot();frame.componentKind=chooser.querySelector('select').value;if(!window.CanvasDesignTools?.editsFrame(frame))commitDesignUndoSnapshot(before,'Set frame section role');mount(container,frame);};insertAppearance(container,chooser);return;}const panel=document.createElement('section');panel.className='frame-section-tools wide';
  panel.innerHTML='<h3>'+ (sectionRole==='title'?'Title':'Rules') +' appearance</h3><label>Style<select class="input" data-section-style></select></label><label>Color<select class="input" data-section-left></select></label><label><input type="checkbox" data-section-split> Split colors</label><label data-section-right-row hidden>Right color<select class="input" data-section-right></select></label>'+(sectionRole==='title'?'<label><input type="checkbox" data-section-crown> Legendary crown</label>':'')+'<button class="input" type="button" data-section-apply>Apply appearance</button><details><summary>Advanced</summary>'+(sectionRole==='title'?'<label><input type="checkbox" data-section-fit-text checked> Fit title text around this style’s symbol</label>':'')+'<label><input type="checkbox" data-section-pinlines checked> Include matching pinlines</label><label>Background opacity (%)<input class="input" type="number" min="0" max="100" data-section-opacity value="100"></label><button class="input" type="button" data-section-browse>Use the selected Browse frame’s section</button><p>Uses that asset’s section without loading its card layout.</p><button class="input" type="button" data-section-fields hidden>Add preset text fields</button></details><p data-section-status role="status"></p>';
  const appearance=frame.sectionAppearance||{};const select=panel.querySelector('[data-section-style]');for(const style of FrameSectionCatalog.styles.filter(style=>style.roles.includes(sectionRole))){const option=document.createElement('option');option.value=style.id;option.textContent=style.label;select.appendChild(option);}if(appearance.style==='browse'){const option=document.createElement('option');option.value='browse';option.textContent='Custom / Browse asset';select.appendChild(option);}select.value=appearance.style||FrameSectionCatalog.styles.find(style=>Object.values(style.variants).some(variant=>variant.src===frame.src))?.id||'regular';
  for(const selector of ['[data-section-left]','[data-section-right]'])for(const[key,label]of Object.entries(colors)){const option=document.createElement('option');option.value=key;option.textContent=label;panel.querySelector(selector).appendChild(option);}
  const same=members(frame,sectionRole),rightPiece=same.find(item=>(item.masks||[]).some(mask=>/^right half$/i.test(mask.name||''))),leftPiece=same.find(item=>item!==rightPiece),right=appearance.right||(same.length>1?colorOf(rightPiece||same.find(item=>item!==frame)):'');panel.querySelector('[data-section-left]').value=appearance.left||colorOf(leftPiece||frame);panel.querySelector('[data-section-right]').value=right||'u';panel.querySelector('[data-section-split]').checked=!!right;panel.querySelector('[data-section-right-row]').hidden=!right;panel.querySelector('[data-section-pinlines]').checked=appearance.pinlines!==false;panel.querySelector('[data-section-opacity]').value=frame.opacity??100;if(sectionRole==='title'){panel.querySelector('[data-section-crown]').checked=!!appearance.crown;panel.querySelector('[data-section-fit-text]').checked=appearance.fitTitleText!==false;}
  function updatePalette(){const style=FrameSectionCatalog.styles.find(item=>item.id===select.value);if(!style)return;for(const selector of ['[data-section-left]','[data-section-right]']){const input=panel.querySelector(selector);for(const option of input.options)option.disabled=!style.variants[option.value];if(!style.variants[input.value])input.value=style.variants.m?'m':Object.keys(style.variants)[0];}}select.onchange=updatePalette;updatePalette();
  panel.querySelector('[data-section-split]').onchange=event=>{panel.querySelector('[data-section-right-row]').hidden=!event.target.checked;};
  const fields=panel.querySelector('[data-section-fields]');fields.hidden=!fieldDefinitions(appearance.style);fields.onclick=()=>insertFields(frame,panel);
  panel.querySelector('[data-section-apply]').onclick=async()=>{const ok=await apply(frame,{role:sectionRole,style:select.value,left:panel.querySelector('[data-section-left]').value,right:panel.querySelector('[data-section-split]').checked?panel.querySelector('[data-section-right]').value:'',crown:panel.querySelector('[data-section-crown]')?.checked,fitTitleText:panel.querySelector('[data-section-fit-text]')?.checked,pinlines:panel.querySelector('[data-section-pinlines]').checked,opacity:panel.querySelector('[data-section-opacity]').value},panel);if(ok)fields.hidden=!fieldDefinitions(frame.sectionAppearance.style);};
  panel.querySelector('[data-section-browse]').onclick=async()=>{if(typeof availableFrames==='undefined'||typeof selectedFrameIndex==='undefined'||!availableFrames[selectedFrameIndex]){status(panel,'Choose a frame asset in Browse Frames first.');return;}const resource=availableFrames[selectedFrameIndex],ok=await apply(frame,{role:sectionRole,style:'browse',browseResource:clone(resource),left:colorOf(resource),right:'',crown:false,pinlines:panel.querySelector('[data-section-pinlines]').checked,opacity:panel.querySelector('[data-section-opacity]').value,fitTitleText:false},panel);if(ok)mount(container,frame);};
  insertAppearance(container,panel);
 }
 window.FrameSectionTools={role,apply,mount,sync,cutouts,restoreAppearance,insertFields,renderStyle,originalRectangle,fieldDefinitions};
})();
