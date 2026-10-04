// Transactional manual resizing of the combined type/rules section.
(function(){
 'use strict';
 let session=null,drag=null,opening=false;
 const copy=value=>JSON.parse(JSON.stringify(value));
 const rect=frame=>({...frame.bounds});
 const union=(a,b)=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return{x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};};
 const map=(b,from,to)=>({...b,x:to.x+(b.x-from.x)*to.width/from.width,y:to.y+(b.y-from.y)*to.height/from.height,width:b.width*to.width/from.width,height:b.height*to.height/from.height});
 function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
 function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load a container image.'));img.src=typeof fixUri==='function'?fixUri(src):src;});}
 function resized(bounds,edge,dx,dy,mirror,width,height){
  const result={...bounds},minimumX=50/width,minimumY=50/height;
  if(edge.includes('left')||edge.includes('right')){const side=edge.includes('left')?-1:1,delta=side*dx;let size=Math.max(minimumX,bounds.width+delta*(mirror?2:1));const anchor=mirror?bounds.x+bounds.width/2:side<0?bounds.x+bounds.width:bounds.x;size=Math.min(size,mirror?2*Math.min(anchor,1-anchor):side<0?anchor:1-anchor);result.width=size;result.x=mirror?anchor-size/2:side<0?anchor-size:anchor;}
  if(edge.includes('top')||edge.includes('bottom')){const side=edge.includes('top')?-1:1,delta=side*dy;let size=Math.max(minimumY,bounds.height+delta*(mirror?2:1));const anchor=mirror?bounds.y+bounds.height/2:side<0?bounds.y+bounds.height:bounds.y;size=Math.min(size,mirror?2*Math.min(anchor,1-anchor):side<0?anchor:1-anchor);result.height=size;result.y=mirror?anchor-size/2:side<0?anchor-size:anchor;}
  return result;
 }
 function ui(){
  if(document.querySelector('#container-resize-editor'))return;
  const panel=document.createElement('section');panel.id='container-resize-editor';panel.className='container-resize-editor readable-background';panel.hidden=true;
  panel.innerHTML='<div class="container-resize-heading"><strong>Resize Rules Container</strong><button type="button" data-close aria-label="Cancel container resize">×</button></div><p>Drag a container edge or corner. Changes apply only when confirmed.</p><label><input type="checkbox" data-mirror> Mirrored resizing (opposite edges)</label><div class="input-grid"><label>Width (px)<input class="input" type="number" min="50" data-width></label><label>Height (px)<input class="input" type="number" min="50" data-height></label></div><p data-status aria-live="polite"></p><div class="input-grid"><button class="input" type="button" data-confirm>Confirm Changes</button><button class="input" type="button" data-cancel>Cancel</button></div>';
  document.body.appendChild(panel);panel.querySelector('[data-close]').onclick=cancel;panel.querySelector('[data-cancel]').onclick=cancel;panel.querySelector('[data-confirm]').onclick=confirm;
  for(const key of ['width','height'])panel.querySelector('[data-'+key+']').onchange=event=>{if(!session)return;const amount=(Number(event.target.value)-(key==='width'?session.draft.width*card.width:session.draft.height*card.height))/(key==='width'?card.width:card.height);session.draft=resized(session.draft,key==='width'?'right':'bottom',key==='width'?amount/(mirrored()?2:1):0,key==='height'?amount/(mirrored()?2:1):0,mirrored(),card.width,card.height);refresh();drawCard();};
 }
 function mirrored(){return !!document.querySelector('#container-resize-editor [data-mirror]')?.checked;}
 function refresh(){const panel=document.querySelector('#container-resize-editor');if(!panel||!session)return;panel.querySelector('[data-width]').value=Math.round(session.draft.width*card.width);panel.querySelector('[data-height]').value=Math.round(session.draft.height*card.height);}
 function message(value){const node=document.querySelector('#container-resize-editor [data-status]');if(node)node.textContent=value;}
 async function open(){
  if(opening||session)return;opening=true;ui();
  try{
   const range=window.RulesRange?.getSelected(),owner=card.frames.find(frame=>frame.sectionModule?.rangeId===range?.id);
   if(!owner)throw Error('Select a Rules + Prototype range first.');
   if(owner.rotation||range.rotation)throw Error('Set the rules section rotation to zero before resizing its container.');
   const saved=owner.resizeContainer;
   const types=saved?saved.typeIds.map(id=>card.frames.find(frame=>frame.designLayerId===id)).filter(Boolean):card.frames.filter(frame=>/type/i.test(frame.componentKind||'')||(frame.masks||[]).some(mask=>/^type$/i.test(mask.name||'')));
   if(!types.length)throw Error('Add a separate type-line frame component first.');
   const typeRects=await Promise.all(types.map(frame=>FrameSectionTools.originalRectangle(frame,'type'))),typeBox=typeRects.reduce(union);
   const base=rect(owner),pt=saved?.ptIds?saved.ptIds.map(id=>card.frames.find(frame=>frame.designLayerId===id)).filter(Boolean):card.frames.filter(frame=>/power.?\/?toughness|power.*toughness/i.test(frame.componentKind||frame.name||''));
   let outer=union(base,typeBox);pt.forEach(frame=>{outer=union(outer,rect(frame));});
   // Include the nearby stroke, without capturing the title or upper frame.
   if(!saved){const pad=6/card.width;outer={x:Math.max(0,outer.x-pad),y:Math.max(0,outer.y-6/card.height),width:Math.min(1,outer.x+outer.width+pad)-Math.max(0,outer.x-pad),height:Math.min(1,outer.y+outer.height+6/card.height)-Math.max(0,outer.y-6/card.height)};}
   else outer=copy(saved.bounds);
   session={owner,range,types,typeRects,typeBox,pt,original:outer,draft:copy(outer),mode:activeFrameDesignMode,committing:false};
   CanvasDesignTools.suspend();document.querySelector('#container-resize-editor').hidden=false;message('Type line, rules range, lower pinlines and P/T badge resize together.');refresh();drawCard();
  }catch(error){notify(error.message,6);}finally{opening=false;}
 }
 function close(){if(!session)return;const mode=session.mode;session=null;drag=null;document.querySelector('#container-resize-editor').hidden=true;previewCanvas.style.cursor='';CanvasDesignTools.resume();setFrameDesignMode(mode);}
 function cancel(){if(session?.committing)return;close();}
 function draw(){if(!session)return false;const b=previewLayoutBounds(session.draft),ctx=previewContext;ctx.save();ctx.strokeStyle='#ba82ff';ctx.lineWidth=2;ctx.setLineDash([8,4]);ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.setLineDash([]);ctx.fillStyle='#ba82ff';for(const x of [b.x,b.x+b.width/2,b.x+b.width])for(const y of [b.y,b.y+b.height/2,b.y+b.height])if(x!==b.x+b.width/2||y!==b.y+b.height/2)ctx.fillRect(x-4,y-4,8,8);ctx.font='bold 14px sans-serif';ctx.fillText('Rules container — resize preview',b.x+8,b.y+18);ctx.restore();return true;}
 function edgeAt(p){if(!session)return '';const b=previewLayoutBounds(session.draft),tol=12;let edge='';if(p.y>=b.y-tol&&p.y<=b.y+b.height+tol){if(Math.abs(p.x-b.x)<=tol)edge+='left';else if(Math.abs(p.x-b.x-b.width)<=tol)edge+='right';}if(p.x>=b.x-tol&&p.x<=b.x+b.width+tol){if(Math.abs(p.y-b.y)<=tol)edge+='top';else if(Math.abs(p.y-b.y-b.height)<=tol)edge+='bottom';}return edge;}
 async function rendered(frame){
  const output=canvas(card.width,card.height),ctx=output.getContext('2d'),b=frame.bounds,og=frame.ogBounds||b;
  ctx.fillRect(0,0,output.width,output.height);ctx.globalCompositeOperation='source-in';
  for(const mask of frame.masks||[]){const m=frame.maskCanvasBounds||{x:0,y:0,width:1,height:1};drawFrameLayerMask(ctx,mask.image||await load(mask.src),(b.x+(m.x-og.x)*b.width/og.width)*card.width,(b.y+(m.y-og.y)*b.height/og.height)*card.height,m.width*b.width/og.width*card.width,m.height*b.height/og.height*card.height,frame,(b.x+b.width/2)*card.width,(b.y+b.height/2)*card.height);}
  drawFrameLayerImage(ctx,frame.image||await load(frame.src),b.x*card.width,b.y*card.height,b.width*card.width,b.height*card.height,frame);
  if(frame.colorOverlayCheck){ctx.globalCompositeOperation='source-in';ctx.fillStyle=frame.colorOverlay;ctx.fillRect(0,0,output.width,output.height);}
  if(frame.hslHue||frame.hslSaturation||frame.hslLightness)hsl(output,frame.hslHue||0,frame.hslSaturation||0,frame.hslLightness||0);
  FrameSectionTools.cutouts(ctx,frame);return output;
 }
 function crop(source,b){const result=canvas(b.width*card.width,b.height*card.height);result.getContext('2d').drawImage(source,b.x*card.width,b.y*card.height,b.width*card.width,b.height*card.height,0,0,result.width,result.height);return result;}
 function slices(source,w,h){
  const result=canvas(w,h),ctx=result.getContext('2d'),edge=Math.min(24,source.width/4,source.height/4,result.width/4,result.height/4);
  const sx=[0,edge,source.width-edge,source.width],sy=[0,edge,source.height-edge,source.height],dx=[0,edge,result.width-edge,result.width],dy=[0,edge,result.height-edge,result.height];
  for(let x=0;x<3;x++)for(let y=0;y<3;y++)ctx.drawImage(source,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);return result;
 }
 function containerSlices(source,w,h,bandHeight,bottomHeight){
  const result=canvas(w,h),ctx=result.getContext('2d'),top=Math.min(source.height-2,Math.max(1,Math.round(bandHeight))),bottom=Math.min(source.height-top-1,Math.max(1,Math.round(bottomHeight)));
  const sy=[0,top,source.height-bottom,source.height],dy=[0,top,result.height-bottom,result.height];
  for(let i=0;i<3;i++){const band=canvas(source.width,sy[i+1]-sy[i]);band.getContext('2d').drawImage(source,0,sy[i],source.width,band.height,0,0,band.width,band.height);ctx.drawImage(slices(band,result.width,Math.max(1,dy[i+1]-dy[i])),0,dy[i]);}return result;
 }
 async function setImage(frame,source,b){frame.src=source.toDataURL('image/png');frame.image=await load(frame.src);frame.bounds=copy(b);frame.masks=[];frame.rotation=0;frame.flipX=false;frame.flipY=false;frame.colorOverlayCheck=false;frame.hslHue=frame.hslSaturation=frame.hslLightness=0;delete frame.ogBounds;delete frame.maskCanvasBounds;delete frame.assetId;frame.resizeContainerRaster=true;frame.fixedAppearance=true;}
 async function confirm(){
  if(!session||session.committing)return;const s=session;if(JSON.stringify(s.original)===JSON.stringify(s.draft)){close();return;}
  s.committing=true;message('Applying container changes…');const before=createDesignStateSnapshot();
  try{
   const saved=s.owner.resizeContainer,original=s.original,target=s.draft;
   const pinlines=saved?saved.pinlineIds.map(id=>card.frames.find(frame=>frame.designLayerId===id)).filter(Boolean):card.frames.filter(frame=>/pinline|pipeline/i.test(frame.componentKind||frame.name||''));
   const pieces=[];
   if(!saved){for(const frame of pinlines){if(frame.rotation)throw Error('Rotated pinline layers must be flattened before creating this container.');const full=await rendered(frame),part=crop(full,original);full.getContext('2d').clearRect(original.x*card.width,original.y*card.height,original.width*card.width,original.height*card.height);await setImage(frame,full,{x:0,y:0,width:1,height:1});const piece={name:frame.name+' — Rules container',src:part.toDataURL(),bounds:copy(original),masks:[],opacity:frame.opacity??100,mode:frame.mode||'source-over',resizeContainerRaster:true,fixedAppearance:true};ensureDesignLayerId(piece);piece.image=await load(piece.src);card.frames.splice(card.frames.indexOf(frame),0,piece);pieces.push(piece);}}
   else pieces.push(...pinlines);
   for(const piece of pieces){const local=await crop(await rendered(piece),original);await setImage(piece,containerSlices(local,target.width*card.width,target.height*card.height,(s.range.bounds.y-original.y)*card.height,(original.y+original.height-s.range.bounds.y-s.range.bounds.height)*card.height),target);}
   const typeHeight=s.typeBox.height,newType={x:target.x+(s.typeBox.x-original.x)*target.width/original.width,y:target.y+(s.typeBox.y-original.y),width:s.typeBox.width*target.width/original.width,height:typeHeight};
   for(let i=0;i<s.types.length;i++){const frame=s.types[i],from=s.typeRects[i],to={...map(from,s.typeBox,newType),height:from.height,y:newType.y+(from.y-s.typeBox.y)};await setImage(frame,slices(crop(await rendered(frame),from),to.width*card.width,to.height*card.height),to);}
   const oldRules=copy(s.range.bounds),newRules={x:target.x+(oldRules.x-original.x)*target.width/original.width,width:oldRules.width*target.width/original.width,y:newType.y+typeHeight+(oldRules.y-s.typeBox.y-typeHeight),height:oldRules.height+(target.y+target.height-original.y-original.height)-(newType.y-s.typeBox.y)};
   if(newRules.height*card.height<50)throw Error('The container must leave at least 50 pixels for the rules range.');
   Object.assign(s.owner.bounds,map(s.owner.bounds,oldRules,newRules));Object.assign(s.range.bounds,newRules);
   for(const frame of s.pt){const b=frame.bounds;b.x=target.x+target.width-(original.x+original.width-b.x);b.y=target.y+target.height-(original.y+original.height-b.y);}
   for(const [key,field] of Object.entries(card.text||{})){if(s.range.modules.some(module=>module.elements.some(entry=>entry.kind==='text'&&entry.key===key)))continue;if(key==='type'||field.standardRole==='type'){Object.assign(field,map(field,s.typeBox,newType));if(field.frameAnchor){const frame=s.types.find(frame=>frame.designLayerId===field.frameAnchor.id);if(frame)field.frameAnchor.last={...frame.bounds,rotation:0};}}else if((key==='pt'||field.standardRole==='pt')&&!field.frameAnchor){field.x+=target.x+target.width-original.x-original.width;field.y+=target.y+target.height-original.y-original.height;}}
   if(Number(card.setSymbolZoom)>0){card.setSymbolX=newType.x+(Number(card.setSymbolX)-s.typeBox.x)*newType.width/s.typeBox.width;card.setSymbolY=Number(card.setSymbolY)+newType.y-s.typeBox.y;}
   FrameSectionTools.syncRuleModules();FrameTextPresets.sync();
   s.owner.resizeContainer={bounds:copy(target),typeIds:s.types.map(ensureDesignLayerId),ptIds:s.pt.map(ensureDesignLayerId),pinlineIds:pieces.map(ensureDesignLayerId)};
   await rebuildFrameLayerList();commitDesignUndoSnapshot(before,'Resize rules container');s.committing=false;close();RulesRange.refresh();drawFrames();drawTextBuffer();
  }catch(error){await applyDesignStateSnapshot(before);s.committing=false;message(error.message);drawFrames();}
 }
 function mount(){
  previewCanvas.addEventListener('pointerdown',event=>{if(!session)return;event.stopImmediatePropagation();event.preventDefault();if(session.committing||event.button!==0)return;const p=layoutHighlightPoint(event),edge=edgeAt(p);if(edge){drag={edge,point:p,bounds:copy(session.draft),pointerId:event.pointerId};previewCanvas.setPointerCapture?.(event.pointerId);}},true);
  previewCanvas.addEventListener('pointermove',event=>{if(!session)return;event.stopImmediatePropagation();const p=layoutHighlightPoint(event);if(drag){const rx=cardCanvas.width/previewCanvas.width/card.width,ry=cardCanvas.height/previewCanvas.height/card.height;session.draft=resized(drag.bounds,drag.edge,(p.x-drag.point.x)*rx,(p.y-drag.point.y)*ry,mirrored(),card.width,card.height);refresh();drawCard();}else previewCanvas.style.cursor=edgeAt(p)?'crosshair':'default';},true);
  for(const name of ['pointerup','pointercancel'])previewCanvas.addEventListener(name,event=>{if(!session)return;event.stopImmediatePropagation();if(name==='pointercancel'&&drag){session.draft=drag.bounds;refresh();drawCard();}drag=null;},true);
  for(const name of ['dblclick','contextmenu'])previewCanvas.addEventListener(name,event=>{if(session){event.stopImmediatePropagation();event.preventDefault();}},true);
  document.addEventListener('keydown',event=>{if(!session||session.committing)return;if(event.key==='Escape'){cancel();event.preventDefault();}else if(event.ctrlKey&&(event.key==='z'||event.key==='y')){event.preventDefault();event.stopImmediatePropagation();}},true);
  window.addEventListener('creatortabchanged',cancel);window.addEventListener('frameworkspacechanged',cancel);
 }
 function restore(frame,definition){if(!frame.resizeContainerRaster&&!definition.resizeContainerRaster&&!frame.resizeContainer&&!definition.resizeContainer)return;for(const key of ['resizeContainer','resizeContainerRaster','fixedAppearance','ogBounds','maskCanvasBounds','assetId','flipX','flipY','colorOverlayCheck','hslHue','hslSaturation','hslLightness']){if(definition[key]===undefined)delete frame[key];else frame[key]=copy(definition[key]);}frame.src=definition.src;frame.masks=copy(definition.masks||[]);load(frame.src).then(image=>{frame.image=image;return Promise.all(frame.masks.map(async mask=>{mask.image=await load(mask.src);}));}).then(drawFrames);}
 window.ContainerResizeTools={open,cancel,draw,isOpen:()=>!!session,restore,resized,map,slices};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
