// Transactional manual resizing of the combined type/rules section.
(function(){
 'use strict';
 let session=null,drag=null,opening=false;
 const cursor=edge=>!edge?'default':/lefttop|rightbottom/.test(edge)?'nwse-resize':/righttop|leftbottom/.test(edge)?'nesw-resize':/left|right/.test(edge)?'ew-resize':'ns-resize';
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
  panel.innerHTML='<div class="container-resize-heading"><strong>Resize Rules Container</strong><button type="button" data-close aria-label="Cancel container resize">×</button></div><p>Drag a container edge or corner. Changes apply only when confirmed.</p><label><input type="checkbox" data-mirror> Mirrored resizing (opposite edges)</label><button class="input" type="button" data-match hidden>Match Rules Container Width</button><div class="input-grid"><label>Width (px)<input class="input" type="number" min="50" data-width></label><label>Height (px)<input class="input" type="number" min="50" data-height></label></div><p data-status aria-live="polite"></p><div class="input-grid"><button class="input" type="button" data-confirm>Confirm Changes</button><button class="input" type="button" data-cancel>Cancel</button></div>';
  document.body.appendChild(panel);panel.querySelector('[data-close]').onclick=cancel;panel.querySelector('[data-cancel]').onclick=cancel;panel.querySelector('[data-confirm]').onclick=confirm;panel.querySelector('[data-match]').onclick=matchRulesWidth;
  for(const key of ['width','height'])panel.querySelector('[data-'+key+']').onchange=event=>{if(!session)return;const amount=(Number(event.target.value)-(key==='width'?session.draft.width*card.width:session.draft.height*card.height))/(key==='width'?card.width:card.height);session.draft=resized(session.draft,key==='width'?'right':'bottom',key==='width'?amount/(mirrored()?2:1):0,key==='height'?amount/(mirrored()?2:1):0,mirrored(),card.width,card.height);refresh();requestPreview();};
 }
 function mirrored(){return !!document.querySelector('#container-resize-editor [data-mirror]')?.checked;}
 function refresh(){const panel=document.querySelector('#container-resize-editor');if(!panel||!session)return;panel.querySelector('[data-width]').value=Math.round(session.draft.width*card.width);panel.querySelector('[data-height]').value=Math.round(session.draft.height*card.height);}
 function message(value){const node=document.querySelector('#container-resize-editor [data-status]');if(node)node.textContent=value;}
 async function open(kind='rules'){
  if(opening||session)return;opening=true;ui();
  try{
   if(kind==='title'){await openTitleSession();return;}
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
   if(!saved)outer=await includePipelineStrokes(outer,'Title container');
   session={kind:'rules',owner,range,types,typeRects,typeBox,pt,original:outer,draft:copy(outer),mode:activeFrameDesignMode,committing:false,snapshot:createDesignStateSnapshot(),baseline:capture(),pending:null,previewPromise:null,timer:null,previewError:null};
   show();
  }catch(error){notify(error.message,6);}finally{opening=false;}
 }
 function show(){CanvasDesignTools.suspend();const panel=document.querySelector('#container-resize-editor');panel.hidden=false;panel.querySelector('.container-resize-heading strong').textContent=session.kind==='title'?'Resize Title Container':'Resize Rules Container';panel.querySelector('[data-match]').hidden=session.kind!=='title';message('Live preview includes the fitted font sizes. Confirm keeps changes; Cancel restores the original.');refresh();drawCard();}
 async function openTitleSession(){
  const titles=card.frames.filter(frame=>!frame.bossTitleOwner&&!frame.sectionCrown&&FrameSectionTools.role(frame)==='title');
  const owner=typeof selectedFrame!=='undefined'&&titles.includes(selectedFrame)?selectedFrame:titles[0];
  if(!owner)throw Error('Add a separate title frame component first.');
  if(owner.rotation)throw Error('Set the title section rotation to zero before resizing its container.');
  const saved=owner.titleResizeContainer,ownerRect=await FrameSectionTools.originalRectangle(owner,'title');
  const peers=saved?saved.titleIds.map(id=>card.frames.find(frame=>frame.designLayerId===id)).filter(Boolean):titles.filter(frame=>JSON.stringify(frame.bounds)===JSON.stringify(owner.bounds));
  const ids=new Set(peers.map(ensureDesignLayerId)),titleRects=await Promise.all(peers.map(frame=>FrameSectionTools.originalRectangle(frame,'title')));
  const crowns=card.frames.filter(frame=>ids.has(frame.sectionCrown?.owner));
  const symbols=card.frames.filter(frame=>ids.has(frame.bossTitleOwner));
  let outer=ownerRect;for(const b of titleRects)outer=union(outer,b);for(const frame of [...crowns,...symbols])outer=union(outer,rect(frame));
  if(saved)outer=copy(saved.bounds);else{const x=Math.max(0,outer.x-6/card.width),y=Math.max(0,outer.y-6/card.height);outer={x,y,width:Math.min(1,outer.x+outer.width+6/card.width)-x,height:Math.min(1,outer.y+outer.height+6/card.height)-y};}
  if(!saved)outer=await includePipelineStrokes(outer,'Rules container');
  session={kind:'title',owner,peers,titleRects,crowns,symbols,original:outer,draft:copy(outer),mode:activeFrameDesignMode,committing:false,snapshot:createDesignStateSnapshot(),baseline:capture(),pending:null,previewPromise:null,timer:null,previewError:null};show();
 }
 function matchRulesWidth(){if(!session||session.kind!=='title')return;const selected=window.RulesRange?.getSelected(),owner=card.frames.find(frame=>frame.resizeContainer&&frame.sectionModule?.rangeId===selected?.id)||card.frames.find(frame=>frame.resizeContainer);if(!owner){message('Resize the rules container first, then use its saved width here.');return;}session.draft.x=owner.resizeContainer.bounds.x;session.draft.width=owner.resizeContainer.bounds.width;refresh();requestPreview();}
 function close(){if(!session)return;const mode=session.mode;session=null;drag=null;document.querySelector('#container-resize-editor').hidden=true;previewCanvas.style.cursor='';CanvasDesignTools.resume();setFrameDesignMode(mode);}
 async function cancel(){const s=session;if(!s||s.committing)return;s.committing=true;s.pending=null;clearTimeout(s.timer);await s.previewPromise;reset(s);close();drawFrames();if(typeof drawText==='function')await drawText();else drawTextBuffer();}
 function capture(){return{frames:card.frames.slice(),definitions:card.frames.map(frame=>({frame,hasMasks:Object.prototype.hasOwnProperty.call(frame,'masks'),definition:copy(Object.fromEntries(Object.entries(frame).filter(([key])=>!['image','masks'].includes(key)))),image:frame.image,masks:(frame.masks||[]).map(mask=>({definition:copy(Object.fromEntries(Object.entries(mask).filter(([key])=>key!=='image'))),image:mask.image}))})),text:copy(card.text),ranges:copy(card.rulesRanges||[]),setSymbolX:card.setSymbolX,setSymbolY:card.setSymbolY};}
 function reset(s){const b=s.baseline;card.frames=b.frames.slice();for(const saved of b.definitions){for(const key of Object.keys(saved.frame))delete saved.frame[key];Object.assign(saved.frame,copy(saved.definition),{image:saved.image,masks:saved.masks.map(mask=>({...copy(mask.definition),image:mask.image}))});if(!saved.hasMasks)delete saved.frame.masks;}card.text=copy(b.text);card.rulesRanges=copy(b.ranges);card.setSymbolX=b.setSymbolX;card.setSymbolY=b.setSymbolY;if(s.kind!=='title')s.range=card.rulesRanges.find(range=>range.id===s.owner.sectionModule.rangeId);}
 function requestPreview(){if(!session||session.committing)return;session.pending=copy(session.draft);clearTimeout(session.timer);session.timer=setTimeout(()=>runPreview(session),80);drawCard();}
 function runPreview(s){if(!s||s!==session)return Promise.resolve();clearTimeout(s.timer);if(s.previewPromise)return s.previewPromise;s.previewPromise=(async()=>{while(s.pending&&!s.committing){const target=s.pending;s.pending=null;try{reset(s);await apply(s,target);drawFrames();if(typeof drawText==='function')await drawText();else drawTextBuffer();s.previewError=null;message('Live preview updated. Font reductions are shown on the canvas.');}catch(error){reset(s);s.previewError=error;message(error.message);drawFrames();if(typeof drawText==='function')await drawText();}}})().finally(()=>{s.previewPromise=null;});return s.previewPromise;}

 function draw(){if(!session)return false;const b=previewLayoutBounds(session.draft),ctx=previewContext;ctx.save();ctx.strokeStyle='#ba82ff';ctx.lineWidth=2;ctx.setLineDash([8,4]);ctx.strokeRect(b.x,b.y,b.width,b.height);ctx.setLineDash([]);ctx.fillStyle='#ba82ff';for(const x of [b.x,b.x+b.width/2,b.x+b.width])for(const y of [b.y,b.y+b.height/2,b.y+b.height])if(x!==b.x+b.width/2||y!==b.y+b.height/2)ctx.fillRect(x-4,y-4,8,8);ctx.font='bold 14px sans-serif';ctx.fillText((session.kind==='title'?'Title':'Rules')+' container — resize preview',b.x+8,b.y+18);ctx.restore();return true;}
 function edgeAt(p){if(!session)return '';const b=previewLayoutBounds(session.draft),tol=12;let edge='';if(p.y>=b.y-tol&&p.y<=b.y+b.height+tol){if(Math.abs(p.x-b.x)<=tol)edge+='left';else if(Math.abs(p.x-b.x-b.width)<=tol)edge+='right';}if(p.x>=b.x-tol&&p.x<=b.x+b.width+tol){if(Math.abs(p.y-b.y)<=tol)edge+='top';else if(Math.abs(p.y-b.y-b.height)<=tol)edge+='bottom';}return edge;}
 // Capture complete connected strokes, even when part extends past the frame's box.
 function connectedBounds(source,b){
  const w=source.width,h=source.height,p=source.getContext('2d').getImageData(0,0,w,h).data,seen=new Uint8Array(w*h),queue=new Uint32Array(w*h);
  let left=Math.floor(b.x*w),top=Math.floor(b.y*h),right=Math.ceil((b.x+b.width)*w),bottom=Math.ceil((b.y+b.height)*h),count=0;
  const add=i=>{if(i>=0&&i<w*h&&!seen[i]&&p[i*4+3]>0){seen[i]=1;queue[count++]=i;}};
  for(let y=Math.max(0,top);y<Math.min(h,bottom);y++)for(let x=Math.max(0,left);x<Math.min(w,right);x++)add(y*w+x);
  for(let n=0;n<count;n++){const i=queue[n],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);if(x)add(i-1);if(x+1<w)add(i+1);if(y)add(i-w);if(y+1<h)add(i+w);}
  return{x:left/w,y:top/h,width:(right-left)/w,height:(bottom-top)/h};
 }
 async function includePipelineStrokes(bounds,excluded){
  for(const frame of card.frames.filter(frame=>/pinline|pipeline/i.test(frame.componentKind||frame.name||'')&&!frame.name.includes(excluded))){if(frame.rotation)continue;bounds=union(bounds,connectedBounds(await rendered(frame),bounds));}
  return bounds;
 }
 // Old container extraction could strand part of a connected stroke in the
 // original full-card layer. Repair that saved raster before it is displayed.
 async function migrate(data){
  if(!window.TemplateThemes)return false;let changed=false;
  const frames=data.frames||[],families=data.templateThemes?.families||[];
  for(const owner of frames){
   const saved=owner.resizeContainer;if(!saved)continue;
   for(const id of saved.pinlineIds||[]){
    const piece=frames.find(frame=>frame.designLayerId===id);
    if(!piece||piece.pipelineRepairVersion===1||piece.templateTheme?.side!=='full')continue;
    const family=families.find(item=>item.id===piece.templateTheme.familyId);
    const residual=frames.find(frame=>frame!==piece&&frame.name===piece.name.replace(/ — Rules container$/,'')&&frame.resizeContainerRaster&&frame.bounds?.width===1&&frame.bounds?.height===1);
    if(!family||!residual)continue;
    const reference=canvas(piece.bounds.width*data.width,piece.bounds.height*data.height);reference.getContext('2d').drawImage(await load(piece.src),0,0,reference.width,reference.height);
    const leftover=await load(residual.src),full=canvas(leftover.width,leftover.height);full.getContext('2d').drawImage(leftover,0,0);
    const a=full.getContext('2d').getImageData(0,0,full.width,full.height).data;if(!a.some((value,index)=>index%4===3&&value))continue;
    const sourceRecord=family.variants.b||family.variants[Object.keys(family.variants)[0]],sourceImage=await load(sourceRecord.src),source=canvas(sourceImage.width,sourceImage.height);source.getContext('2d').drawImage(sourceImage,0,0);
    const region=piece.templateTheme.sourceRegion||piece.bounds,connected=connectedBounds(source,region),section=canvas(source.width,Math.ceil((connected.y+connected.height)*source.height)-Math.floor(connected.y*source.height));section.getContext('2d').drawImage(source,0,-Math.floor(connected.y*source.height));
    const strokeRuns=value=>{const p=value.getContext('2d').getImageData(0,0,value.width,value.height).data,x=Math.floor(value.width/2),runs=[];for(let y=0;y<value.height;y++)if(p[(y*value.width+x)*4+3]>16){const last=runs[runs.length-1];if(last&&last[1]===y)last[1]++;else runs.push([y,y+1]);}return runs;};
    const originalRuns=strokeRuns(section),savedRuns=strokeRuns(reference);
    if(originalRuns.length!==3||savedRuns.length!==3)continue;
    const missing=originalRuns[0][1]-originalRuns[0][0]-(savedRuns[0][1]-savedRuns[0][0]);if(missing<=0||missing>32)continue;
    // Do not consume unrelated artwork from the original layer.
    const sectionTop=Math.floor(connected.y*source.height);let safe=true;for(let i=3;i<a.length;i+=4)if(a[i]&&Math.floor((i-3)/4/full.width)<sectionTop){safe=false;break;}if(!safe)continue;
    const oldBounds=copy(piece.bounds),repaired=TemplateThemes.fitPipeline(section,reference,missing),newBounds={...piece.bounds,y:piece.bounds.y-missing/data.height,height:piece.bounds.height+missing/data.height};
    piece.src=repaired.toDataURL();piece.bounds=newBounds;piece.pipelineRepairVersion=1;delete piece.assetId;delete piece.image;
    const aligned=(a,b)=>['x','y','width','height'].every(key=>Math.abs(a[key]-b[key])<.000001);
    // Preserve the existing right-half appearance when opening the template.
    for(const other of frames){
     if(other===piece||!other.name?.includes('Right Half')||!other.name.endsWith(' — Rules container')||!aligned(other.bounds,oldBounds))continue;
     const oldHalf=canvas(reference.width,reference.height);oldHalf.getContext('2d').drawImage(await load(other.src),0,0,oldHalf.width,oldHalf.height);
     const color=Object.entries({w:'White',u:'Blue',b:'Black',r:'Red',g:'Green',m:'Multicolored'}).find(([,name])=>other.name.startsWith(name))?.[0],variant=family.variants[color];if(!variant)continue;
     const bitmap=await load(variant.src),paint=canvas(section.width,section.height);paint.getContext('2d').drawImage(bitmap,0,-Math.floor(connected.y*source.height));
     const fullHalf=TemplateThemes.fitPipeline(paint,reference,missing),pixels=fullHalf.getContext('2d').getImageData(0,0,fullHalf.width,fullHalf.height),base=reference.getContext('2d').getImageData(0,0,reference.width,reference.height).data,half=oldHalf.getContext('2d').getImageData(0,0,oldHalf.width,oldHalf.height).data;
     const ratios=[];for(let x=0;x<reference.width;x++){let ba=0,ha=0;for(let y=savedRuns[1][0];y<savedRuns[1][1];y++){ba=Math.max(ba,base[(y*reference.width+x)*4+3]);ha=Math.max(ha,half[(y*reference.width+x)*4+3]);}ratios.push(ba?Math.min(1,ha/ba):0);}
     for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]*=ratios[((i-3)/4)%reference.width];fullHalf.getContext('2d').putImageData(pixels,0,0);
     other.src=fullHalf.toDataURL();other.bounds=copy(newBounds);other.pipelineRepairVersion=1;delete other.assetId;delete other.image;
    }
    const stem=name=>String(name).replace(/^(White|Blue|Black|Red|Green|Multicolored) /,'').replace(/ — Right Half/,'').replace(/Completed/,'Complete');
    for(const other of frames){if(stem(other.name)!==stem(residual.name)||other.bounds?.width!==1||other.bounds?.height!==1)continue;other.src=canvas(data.width,data.height).toDataURL();other.hidden=true;delete other.assetId;delete other.image;}
    const regionTop=Math.floor(connected.y*source.height);piece.templateTheme.sourceRegion={x:0,y:regionTop/source.height,width:1,height:section.height/source.height};
    if(Math.abs(saved.bounds.y-(newBounds.y+missing/data.height))<.00001){saved.bounds.y=newBounds.y;saved.bounds.height=newBounds.height;}
    changed=true;
   }
  }
  for(const owner of frames){const saved=owner.resizeContainer;if(!saved||owner.typePipelineAlignmentVersion===1)continue;
   const pipe=frames.find(frame=>saved.pinlineIds?.includes(frame.designLayerId)&&frame.templateTheme?.side==='full');if(!pipe)continue;
   const image=await load(pipe.src),raster=canvas(image.width,image.height);raster.getContext('2d').drawImage(image,0,0);const p=raster.getContext('2d').getImageData(0,0,raster.width,raster.height).data,middle=Math.floor(raster.width/2),runs=[];
   let left=raster.width,right=0;for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++)if(p[(y*raster.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x+1);}
   for(let y=0;y<raster.height;y++)if(p[(y*raster.width+middle)*4+3]>16){const last=runs[runs.length-1];if(last&&last[1]===y)last[1]++;else runs.push([y,y+1]);}if(runs.length<2)continue;
   const cx=pipe.bounds.x+(left+right)/2/raster.width*pipe.bounds.width,cy=pipe.bounds.y+(runs[0][1]+runs[1][0])/2/raster.height*pipe.bounds.height;
   const prototypes=new Set(frames.map(frame=>frame.sectionModule?.partId));
   for(const id of saved.typeIds||[]){const frame=frames.find(frame=>frame.designLayerId===id);if(!frame||prototypes.has(id))continue;const old=copy(frame.bounds),dx=cx-old.x-old.width/2,dy=cy-old.y-old.height/2;frame.bounds.x+=dx;frame.bounds.y+=dy;
    for(const [key,field] of Object.entries(data.text||{}))if(key==='type'||field.standardRole==='type'||field.frameAnchor?.id===id){field.x+=dx;field.y+=dy;if(field.frameAnchor)field.frameAnchor.last={...frame.bounds,rotation:frame.rotation||0};}
   }
   owner.typePipelineAlignmentVersion=1;changed=true;
  }
  return await fitSections(data)||changed;
 }
 // Fill through the middle of the outline strokes, so transparent artwork
 // meets the pipeline instead of exposing a strip of art between the layers.
 async function fitSections(data,force=false,onlyFrame=null){
  let changed=false;const frames=data.frames||[],prototypeIds=new Set(frames.map(frame=>frame.sectionModule?.partId));
  for(const owner of frames)for(const kind of ['title','type']){
   const saved=kind==='title'?owner.titleResizeContainer:owner.resizeContainer;if(!saved||(!force&&owner[kind+'PipelineFillVersion']===1))continue;
   const ids=kind==='title'?saved.titleIds:saved.typeIds;
   const targets=(ids||[]).map(id=>frames.find(frame=>frame.designLayerId===id)).filter(frame=>frame&&frame.src&&!prototypeIds.has(frame.designLayerId)&&(!onlyFrame||frame===onlyFrame));if(!targets.length)continue;
   const pipe=frames.find(frame=>saved.pinlineIds?.includes(frame.designLayerId)&&!frame.hidden&&!/Right Half/.test(frame.name||''));if(!pipe)continue;
   const bitmap=await load(pipe.src),raster=canvas(bitmap.width,bitmap.height);raster.getContext('2d').drawImage(bitmap,0,0);const pixels=raster.getContext('2d').getImageData(0,0,raster.width,raster.height).data,runs=[],middle=Math.floor(raster.width/2);let left=raster.width,right=0;
   for(let y=0;y<raster.height;y++)for(let x=0;x<raster.width;x++)if(pixels[(y*raster.width+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x+1);}
   for(let y=0;y<raster.height;y++)if(pixels[(y*raster.width+middle)*4+3]>16){const last=runs[runs.length-1];if(last&&last[1]===y)last[1]++;else runs.push([y,y+1]);}if(runs.length<2||right<=left)continue;
   const top=(runs[0][0]+runs[0][1])/2,bottom=(runs[1][0]+runs[1][1])/2,b=pipe.bounds,target={x:b.x+left/raster.width*b.width,y:b.y+top/raster.height*b.height,width:(right-left)/raster.width*b.width,height:(bottom-top)/raster.height*b.height};
   for(const frame of targets){
    // Keep foreground text and symbols exactly where the user placed them.
    frame.bounds={...frame.bounds,...target};frame.src=slices(await load(frame.src),target.width*data.width,target.height*data.height).toDataURL();delete frame.assetId;frame.image=await load(frame.src);
    if(frame.sectionAppearance){frame.sectionAppearance.baseBounds={...target,rotation:frame.rotation||0};frame.sectionAppearance.lastBounds={...target,rotation:frame.rotation||0};}
    for(const field of Object.values(data.text||{}))if(field.frameAnchor?.id===frame.designLayerId)field.frameAnchor.last={...target,rotation:frame.rotation||0};
   }
   owner[kind+'PipelineFillVersion']=1;changed=true;
  }
  return changed;
 }
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
 async function setImage(frame,source,b){const recipe=window.TemplateThemes?.stockRecipe(frame,card);if(recipe)frame.stockThemeRecipe=recipe;frame.src=source.toDataURL('image/png');frame.image=await load(frame.src);frame.bounds=copy(b);frame.masks=[];frame.rotation=0;frame.flipX=false;frame.flipY=false;frame.colorOverlayCheck=false;frame.hslHue=frame.hslSaturation=frame.hslLightness=0;delete frame.ogBounds;delete frame.maskCanvasBounds;delete frame.assetId;frame.resizeContainerRaster=true;frame.fixedAppearance=true;}
 async function apply(s,target){
   if(s.kind==='title')return applyTitle(s,target);
   const original=s.original;
   const saved=s.owner.resizeContainer;
   const pinlines=saved?saved.pinlineIds.map(id=>card.frames.find(frame=>frame.designLayerId===id)).filter(Boolean):card.frames.filter(frame=>/pinline|pipeline/i.test(frame.componentKind||frame.name||'')&&!frame.name.includes('Title container'));
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
 }
 async function applyTitle(s,target){
  const original=s.original,saved=s.owner.titleResizeContainer;
  const pinlines=saved?saved.pinlineIds.map(id=>card.frames.find(frame=>frame.designLayerId===id)).filter(Boolean):card.frames.filter(frame=>/pinline|pipeline/i.test(frame.componentKind||frame.name||'')&&!frame.name.includes('Rules container'));
  const pieces=[];
  if(!saved){for(const frame of pinlines){if(frame.rotation)throw Error('Rotated pinline layers must be flattened before creating this container.');const full=await rendered(frame),part=crop(full,original);full.getContext('2d').clearRect(original.x*card.width,original.y*card.height,original.width*card.width,original.height*card.height);await setImage(frame,full,{x:0,y:0,width:1,height:1});const piece={name:frame.name+' — Title container',src:part.toDataURL(),bounds:copy(original),masks:[],opacity:frame.opacity??100,mode:frame.mode||'source-over',resizeContainerRaster:true,fixedAppearance:true};ensureDesignLayerId(piece);piece.image=await load(piece.src);card.frames.splice(card.frames.indexOf(frame),0,piece);pieces.push(piece);}}
  else pieces.push(...pinlines);
  for(const piece of pieces)await setImage(piece,slices(crop(await rendered(piece),original),target.width*card.width,target.height*card.height),target);
  for(let i=0;i<s.peers.length;i++){const frame=s.peers[i],from=s.titleRects[i],to=map(from,original,target);await setImage(frame,slices(crop(await rendered(frame),from),to.width*card.width,to.height*card.height),to);frame.componentKind='Title';if(frame.sectionAppearance){const appearance=frame.sectionAppearance;if(appearance.iconBounds)appearance.iconBounds=map(appearance.iconBounds,original,target);appearance.baseBounds=copy(to);appearance.lastBounds={...to,rotation:0};}}
  for(const crown of s.crowns){const from=rect(crown),to=map(from,original,target);await setImage(crown,slices(crop(await rendered(crown),from),to.width*card.width,to.height*card.height),to);const owner=card.frames.find(frame=>frame.designLayerId===crown.sectionCrown.owner);crown.sectionCrown.lastOwnerBounds={...owner.bounds,rotation:0};}
  for(const symbol of s.symbols){const from=rect(symbol),center=map({x:from.x+from.width/2,y:from.y+from.height/2,width:0,height:0},original,target),scale=target.height/original.height;symbol.bounds={x:center.x-from.width*scale/2,y:center.y-from.height*scale/2,width:from.width*scale,height:from.height*scale};const owner=card.frames.find(frame=>frame.designLayerId===symbol.bossTitleOwner);symbol.bossTitleOwnerBounds={...owner.bounds,rotation:0};if(owner.sectionAppearance?.iconBounds)owner.sectionAppearance.iconBounds=copy(symbol.bounds);}
  for(const [key,field] of Object.entries(card.text||{})){if(!['title','mana'].includes(key)&&!['title','mana'].includes(field.standardRole)&&!s.peers.some(frame=>frame.designLayerId===field.frameAnchor?.id))continue;Object.assign(field,map(field,original,target));if(field.frameAnchor){const frame=s.peers.find(frame=>frame.designLayerId===field.frameAnchor.id);if(frame)field.frameAnchor.last={...frame.bounds,rotation:0};}}
  s.owner.titleResizeContainer={bounds:copy(target),titleIds:s.peers.map(ensureDesignLayerId),pinlineIds:pieces.map(ensureDesignLayerId)};
 }
 async function confirm(){
  const s=session;if(!s||s.committing)return;
  if(JSON.stringify(s.original)===JSON.stringify(s.draft)){await cancel();return;}
  s.pending=copy(s.draft);await runPreview(s);if(session!==s||s.committing||s.previewError)return;
  s.committing=true;
  try{await rebuildFrameLayerList();commitDesignUndoSnapshot(s.snapshot,s.kind==='title'?'Resize title container':'Resize rules container');close();RulesRange.refresh();drawFrames();drawTextBuffer();}
  catch(error){reset(s);s.committing=false;message(error.message);drawFrames();}
 }
 function mount(){
  previewCanvas.addEventListener('pointerdown',event=>{if(!session)return;event.stopImmediatePropagation();event.preventDefault();if(session.committing||event.button!==0)return;const p=layoutHighlightPoint(event),edge=edgeAt(p);if(edge){drag={edge,point:p,bounds:copy(session.draft),pointerId:event.pointerId};previewCanvas.setPointerCapture?.(event.pointerId);}},true);
  previewCanvas.addEventListener('pointermove',event=>{if(!session)return;event.stopImmediatePropagation();const p=layoutHighlightPoint(event);if(drag){const rx=cardCanvas.width/previewCanvas.width/card.width,ry=cardCanvas.height/previewCanvas.height/card.height;session.draft=resized(drag.bounds,drag.edge,(p.x-drag.point.x)*rx,(p.y-drag.point.y)*ry,mirrored(),card.width,card.height);refresh();requestPreview();}previewCanvas.style.cursor=cursor(drag?.edge||edgeAt(p));},true);
  for(const name of ['pointerup','pointercancel'])previewCanvas.addEventListener(name,event=>{if(!session)return;event.stopImmediatePropagation();if(name==='pointercancel'&&drag){session.draft=drag.bounds;refresh();requestPreview();}drag=null;},true);
  for(const name of ['dblclick','contextmenu'])previewCanvas.addEventListener(name,event=>{if(session){event.stopImmediatePropagation();event.preventDefault();}},true);
  document.addEventListener('keydown',event=>{if(!session||session.committing)return;if(event.key==='Escape'){cancel();event.preventDefault();}else if(event.ctrlKey&&(event.key==='z'||event.key==='y')){event.preventDefault();event.stopImmediatePropagation();}},true);
  window.addEventListener('creatortabchanged',cancel);window.addEventListener('frameworkspacechanged',cancel);
 }
 function restore(frame,definition){if(!frame.resizeContainerRaster&&!definition.resizeContainerRaster&&!frame.resizeContainer&&!definition.resizeContainer&&!frame.titleResizeContainer&&!definition.titleResizeContainer)return;for(const key of ['componentKind','resizeContainer','titleResizeContainer','resizeContainerRaster','fixedAppearance','ogBounds','maskCanvasBounds','assetId','flipX','flipY','colorOverlayCheck','hslHue','hslSaturation','hslLightness']){if(definition[key]===undefined)delete frame[key];else frame[key]=copy(definition[key]);}frame.src=definition.src;frame.masks=copy(definition.masks||[]);load(frame.src).then(image=>{frame.image=image;return Promise.all(frame.masks.map(async mask=>{mask.image=await load(mask.src);}));}).then(drawFrames);}
 window.ContainerResizeTools={fitSections,migrate,connectedBounds,open,openTitle:()=>open('title'),cancel,draw,isOpen:()=>!!session,restore,resized,map,slices,cursor,flushPreview:()=>runPreview(session)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
