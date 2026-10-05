// Shared color families for saved layouts; artwork changes never replace geometry.
(function(){
 'use strict';
 const palette={w:'White',u:'Blue',b:'Black',r:'Red',g:'Green',c:'Colorless',m:'Multicolor',a:'Artifact',l:'Land'};
 const copy=value=>JSON.parse(JSON.stringify(value,(key,item)=>key==='image'?undefined:item));
 function config(data){return data.templateThemes||{enabled:false,families:[]};}
 function records(data){return [...(config(data).families||[]).flatMap(family=>Object.values(family.variants||{})),...(data.frames||[]).flatMap(frame=>frame.templateTheme?.masks||[])];}
 function colors(value){const text=String(value||'').trim().toLowerCase();if(!text)return[];if(/^(multi|multicolor|multicolored)$/.test(text))return['m'];const names=Object.fromEntries(Object.entries(palette).map(([key,name])=>[name.toLowerCase(),key]));const found=[];for(const token of text.split(/[^a-z]+/).filter(Boolean)){if(names[token])found.push(names[token]);else if(/^[wubrgcmal]+$/.test(token))found.push(...token);else throw Error('Unknown frame color: '+token);}return [...new Set(found)];}
 function selection(fields){const specified=String(fields.color||'').trim();const leftColors=colors(fields.frameLeftColor||''),rightColors=colors(fields.frameRightColor||'');if(leftColors.length>1||rightColors.length>1)throw Error('Frame Left/Right Color each require one color.');const left=leftColors[0],right=rightColors[0];if(left)return{left,right:right||'',requested:true};if(right)throw Error('Frame Right Color requires Frame Left Color.');const identity=String(fields.colorIdentity||'').trim();const base=colors(identity||specified);if(!base.length)return{requested:false};return{left:base.length>2?'m':base[0],right:base.length===2?base[1]:'',requested:true};}
 function image(src){return new Promise((resolve,reject)=>{const value=new Image();value.crossOrigin='anonymous';value.onload=()=>resolve(value);value.onerror=()=>reject(Error('Could not load a theme asset.'));value.src=typeof fixUri==='function'?fixUri(src):src;});}
 function canvas(w,h){const value=document.createElement('canvas');value.width=Math.max(1,Math.round(w));value.height=Math.max(1,Math.round(h));return value;}
 async function raster(record,region){const src=await image(record.src),w=src.naturalWidth||src.width,h=src.naturalHeight||src.height,b=region||{x:0,y:0,width:1,height:1},result=canvas(w*b.width,h*b.height);result.getContext('2d').drawImage(src,w*b.x,h*b.y,w*b.width,h*b.height,0,0,result.width,result.height);return result;}
 // Color uploads may still contain the unexpanded pipeline. Match its strokes
 // to the saved raster, rather than treating the layer bounds as the artwork shape.
 function pipelineShape(source){
  const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
  let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  if(right<=left||bottom<=top)return null;
  const runs=[],middle=Math.floor((left+right)/2);
  for(let y=top;y<bottom;y++)if(pixels[(y*source.width+middle)*4+3]>16){const last=runs[runs.length-1];if(last&&last[1]===y)last[1]=y+1;else runs.push([y,y+1]);}
  const edge=Math.min(24,(right-left)/4);
  return{x:[left,left+edge,right-edge,right],y:runs.length>=2?[top,...runs.slice(0,-1).flatMap(run=>run).filter(y=>y>top&&y<runs[runs.length-1][0]),runs[runs.length-1][0],bottom]:[top,bottom]};
 }
 function fitPipeline(source,reference,repairTop=0){
  const from=pipelineShape(source),to=pipelineShape(reference);if(!from||!to)return source;
  if(from.y.length!==to.y.length){from.y=[from.y[0],from.y[from.y.length-1]];to.y=[to.y[0],to.y[to.y.length-1]];}
  if(repairTop){to.y=to.y.map((value,index)=>index?value+repairTop:value);}
  const output=canvas(reference.width,reference.height+repairTop),ctx=output.getContext('2d');
  for(let x=0;x<from.x.length-1;x++)for(let y=0;y<from.y.length-1;y++)ctx.drawImage(source,from.x[x],from.y[y],from.x[x+1]-from.x[x],from.y[y+1]-from.y[y],to.x[x],to.y[y],to.x[x+1]-to.x[x],to.y[y+1]-to.y[y]);
  if(repairTop)return output;
  // The reference supplies coverage once; multiplying two antialiased edges
  // would darken/thin the saved stroke every time a template is recolored.
  const pixels=ctx.getImageData(0,0,output.width,output.height),coverage=reference.getContext('2d').getImageData(0,0,reference.width,reference.height).data;
  for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]?coverage[i]:0;ctx.putImageData(pixels,0,0);return output;
 }
 async function compose(family,link,choice,data,frame){
  const left=link.side==='right'?(choice.right||choice.left):choice.left,right=link.side==='full'?choice.right:'';
  const a=family.variants?.[left],b=right?family.variants?.[right]:null;
  if(!a||right&&!b)throw Error('Asset family “'+family.name+'” is missing '+(!a?palette[left]:palette[right])+'.');
  let source=await raster(a,link.sourceRegion),second=b?await raster(b,link.sourceRegion):null;
  if(frame.resizeContainerRaster&&/pinline|pipeline/i.test(frame.componentKind||frame.name||'')){const reference=await raster(frame);source=fitPipeline(source,reference);if(second)second=fitPipeline(second,reference);}
  if(!b)return source.toDataURL();
  const normalized=canvas(source.width,source.height);normalized.getContext('2d').drawImage(second,0,0,source.width,source.height);
  const ctx=source.getContext('2d'),first=ctx.getImageData(0,0,source.width,source.height),other=normalized.getContext('2d').getImageData(0,0,source.width,source.height),mask=await image('/img/frames/maskRightHalf.png'),weights=canvas(source.width,source.height);const bounds=frame.bounds||{x:0,y:0,width:1,height:1};weights.getContext('2d').drawImage(mask,bounds.x*mask.width,bounds.y*mask.height,bounds.width*mask.width,bounds.height*mask.height,0,0,source.width,source.height);const alpha=weights.getContext('2d').getImageData(0,0,source.width,source.height).data;
  for(let i=0;i<first.data.length;i+=4){const t=alpha[i+3]/255,aa=first.data[i+3]/255*(1-t),ba=other.data[i+3]/255*t,total=aa+ba;for(let j=0;j<3;j++)first.data[i+j]=total?(first.data[i+j]*aa+other.data[i+j]*ba)/total:0;first.data[i+3]=total*255;}ctx.putImageData(first,0,0);return source.toDataURL();
 }
 // Explicit custom links take precedence; otherwise known stock recipes need no family setup.
 function stockRecipe(frame,data){
  if(frame.stockThemeRecipe)return copy(frame.stockThemeRecipe);
  if(/(?:m15PT|\/pt)[WUBRGMALCV]\.png$/i.test(frame.src||''))return{kind:'pt',source:frame.src};
  const prototypeOwner=(data.frames||[]).find(owner=>(frame.designLayerId&&owner.sectionModule?.partId===frame.designLayerId)||(frame.prototypePiece?.owner&&owner.designLayerId===frame.prototypePiece.owner));
  if(prototypeOwner)return{kind:'prototype',owner:prototypeOwner.designLayerId,piece:frame.prototypePiece?.kind};
  if(frame.sectionCrown)return{kind:'crown'};
  if(/^\/img\/frames\/m15\/regular\/m15Frame[WUBRGMALC]\.png$/.test(frame.src||''))return{kind:'legacyRegular',source:frame.src};
  if(/^\/img\/frames\/.*\/crowns\/.*[WUBRGMALC]\.png$/i.test(frame.src||''))return{kind:'colorAsset',source:frame.src};
  if(/^\/img\/frames\/class\/(?:ub\/)?(?:nyx\/)?[wubrgmalc]\.png$/i.test(frame.src||''))return{kind:'class',source:frame.src};
  const catalog=window.FrameSectionCatalog?.styles||[],appearance=frame.sectionAppearance;
  if(appearance&&appearance.style!=='browse'&&catalog.some(style=>style.id===appearance.style))return{kind:'section',style:appearance.style,role:appearance.role};
  const native=catalog.find(style=>Object.values(style.variants).some(variant=>variant.src===(frame.bossSymbolOriginalSource||frame.src)));
  if(native&&!frame.resizeContainerRaster&&!frame.bossSymbolCleared)return{kind:'native',style:native.id};
  let role=frame.componentKind==='Title'?'title':frame.componentKind==='Type'?'type':null;
  if(!role&&(data.frames||[]).some(owner=>owner.resizeContainer?.typeIds?.includes(frame.designLayerId)))role='type';
  const style=native||catalog.find(style=>style.sourcePack===frame.designSourcePack);
  if(role&&style)return{kind:'section',style:style.id,role};
  return null;
 }
 // Shared identity rules apply to stock sections and linked custom artwork alike.
 function elementRole(frame,recipe){
  if(recipe?.kind==='prototype')return 'prototype';
  if(recipe?.kind==='pt')return 'pt';
  if(frame.sectionCrown||recipe?.kind==='crown')return 'crown';
  const explicit=frame.sectionAppearance?.role||recipe?.role||frame.componentKind;
  const masks=(frame.masks||[]).filter(mask=>!/^(left|right) half$/i.test(mask.name||''));
  const value=String(explicit||masks[0]?.name||frame.name||'').toLowerCase();
  if(/prototype/.test(value))return 'prototype';
  if(/power|toughness|^pt$/.test(value))return 'pt';
  if(/crown/.test(value))return 'crown';
  if(/pinline|pipeline/.test(value))return 'pinline';
  if(/rules|text boxes/.test(value))return 'rules';
  if(/title/.test(value))return 'title';
  if(/type/.test(value))return 'type';
  return 'frame';
 }
 function coloredArtifact(data,choice){return /\bartifact\b/i.test(data.text?.type?.text||'')&&/[wubrgm]/.test(choice.left||'');}
 function elementChoice(frame,data,choice,recipe){
  const role=elementRole(frame,recipe);
  if(role==='frame'&&coloredArtifact(data,choice))return{...choice,left:'a',right:''};
  if(!choice.right)return choice;
  return ['pinline','rules','crown'].includes(role)?choice:{...choice,left:'m',right:''};
 }
 // Whole stock frames contain several roles. Recolor their masked regions in
 // place so a saved full-frame/right-half layer cannot cover the split accents.
 async function wholeStockArtwork(frame,data,choice,recipe){
  let variants,available;
  if(recipe.kind==='class'){
   variants=Object.fromEntries(Object.keys(palette).map(key=>[key,{src:recipe.source.replace(/[wubrgmalc]\.png$/i,key+'.png')} ]));
   available=[['pinline','maskPinlines'],['rules','maskRules'],['rules','maskTextBoxes'],['title','maskTitle'],['type','maskType']].map(([role,file])=>({role,src:'/img/frames/class/masks/'+file+'.png'}));
  }else if(recipe.kind==='legacyRegular'){
   variants=Object.fromEntries(Object.keys(palette).map(key=>[key,{src:recipe.source.replace(/[WUBRGMALC]\.png$/,key.toUpperCase()+'.png')}]));
   available=['Pinline','Rules','Title','Type'].map(role=>({role:role.toLowerCase(),src:'/img/frames/m15/regular/m15Mask'+role+'.png'}));
  }else{
   const style=window.FrameSectionCatalog.styles.find(item=>item.id===recipe.style);variants=style.variants;
   available=(variants[choice.left]?.masks||Object.values(variants)[0].masks||[]).map(mask=>({role:elementRole({name:mask.name}),src:mask.src})).filter(mask=>['pinline','rules','title','type'].includes(mask.role));
  }
  const family={name:'Stock '+recipe.kind,variants};
  if((frame.masks||[]).some(mask=>!/^(left|right) half$/i.test(mask.name||'')))return{src:await compose(family,{side:'full'},elementChoice(frame,data,choice,recipe),data,frame),masks:copy(frame.masks||[])};
  const base=elementChoice({componentKind:'Frame'},data,choice,recipe);
  const output=await raster({src:await compose(family,{side:'full'},base,data,frame)}),ctx=output.getContext('2d');
  if(choice.right||coloredArtifact(data,choice))for(const mask of available){
   const local=elementChoice({componentKind:mask.role},data,choice,recipe);
   if(local.left===base.left&&local.right===base.right)continue;
   const layer=await raster({src:await compose(family,{side:'full'},local,data,frame)});
   const weights=canvas(output.width,output.height);weights.getContext('2d').drawImage(await image(mask.src),0,0,output.width,output.height);
   const before=ctx.getImageData(0,0,output.width,output.height),after=layer.getContext('2d').getImageData(0,0,output.width,output.height).data,alpha=weights.getContext('2d').getImageData(0,0,output.width,output.height).data;
   for(let i=0;i<before.data.length;i+=4){const t=alpha[i+3]/255,a=before.data[i+3]*(1-t),b=after[i+3]*t,total=a+b;for(let channel=0;channel<3;channel++)before.data[i+channel]=total?(before.data[i+channel]*a+after[i+channel]*b)/total:0;before.data[i+3]=total;}ctx.putImageData(before,0,0);
  }
  return{src:output.toDataURL(),masks:copy(frame.masks||[])};
 }
 function unlink(frame){delete frame.templateTheme;}
 async function stockArtwork(frame,data,choice,recipe){
  if(['native','class','legacyRegular'].includes(recipe.kind))return wholeStockArtwork(frame,data,choice,recipe);
  if(recipe.kind==='colorAsset'){const suffix=recipe.source.match(/([WUBRGMALC])\.png$/i)[1];const variants=Object.fromEntries([choice.left,choice.right].filter(Boolean).map(color=>[color,{src:recipe.source.replace(/[WUBRGMALC]\.png$/i,(suffix===suffix.toUpperCase()?color.toUpperCase():color)+'.png')} ]));return{src:await compose({name:frame.name,variants},{side:'full'},choice,data,frame),masks:copy(frame.masks||[])};}
  if(recipe.kind==='pt'){
   const type=String(data.text?.type?.text||'').toLowerCase(),key=choice.left==='m'||choice.right?'m':/[wubrg]/.test(choice.left)?choice.left:/vehicle/.test(type)?'v':/artifact/.test(type)?'a':choice.left==='l'?'c':choice.left;
   const src=recipe.source.replace(/[WUBRGMALCV]\.png$/i,key.toUpperCase()+'.png');await image(src);return{src,masks:copy(frame.masks||[])};
  }
  const catalog=window.FrameSectionCatalog?.styles||[];let variants={},masks=[];
  for(const color of [choice.left,choice.right].filter(Boolean)){
   let src;
   if(recipe.kind==='prototype'){
    const owner=data.frames.find(item=>item.designLayerId===recipe.owner),rendered=await FrameSectionTools.renderPrototype(color,'',owner?.sectionModule?.pinlines!==false);src=recipe.piece?rendered.extras[recipe.piece].src:rendered.src;
   }else if(recipe.kind==='crown'){
    const owner=data.frames.find(item=>item.designLayerId===frame.sectionCrown.owner),type=frame.sectionCrown.type;
    const style=catalog.find(item=>item.id===(type&&type!=='auto'?type:owner?.sectionAppearance?.crownStyle||owner?.sectionAppearance?.style||stockRecipe(owner||{},data)?.style||(data.version==='battle'?'battle':'regular')));
    if(!style)throw Error('Cannot identify the stock crown style.');
    src=await FrameSectionTools.renderCrownArtwork(style,color,frame.sectionCrown.pinlines,frame.sectionCrown.backing);
   }else{
    const style=catalog.find(item=>item.id===recipe.style);if(!style?.variants[color])throw Error('Stock '+recipe.style+' has no '+palette[color]+' asset.');
    if(recipe.kind==='native'){src=style.variants[color].src;masks=copy(frame.masks||[]);}
    else src=(await FrameSectionTools.renderStyle(style,recipe.role,color,'',!!frame.sectionAppearance?.pinlines,false,{clearSymbol:!!frame.bossSymbolCleared})).src;
   }
   if(frame.resizeContainerRaster&&window.ContainerResizeTools){const bitmap=await image(src);src=ContainerResizeTools.slices(bitmap,frame.bounds.width*data.width,frame.bounds.height*data.height).toDataURL();}
   variants[color]={src};
  }
  return{src:await compose({name:'Stock '+(recipe.style||recipe.kind),variants},{side:'full'},choice,data,frame),masks};
 }
 function pipelineDuplicates(data){
  const frames=data.frames||[],duplicates=new Map();
  const pipeline=frame=>/pinline|pipeline/i.test(frame.componentKind||frame.name||'');
  const half=frame=>/\b(left|right) half\b/i.test(frame.name||'')||(frame.masks||[]).some(mask=>/^(left|right) half$/i.test(mask.name||''));
  const stem=frame=>String(frame.name||'').toLowerCase().replace(/^(white|blue|black|red|green|multicolou?red?|colorless|artifact)\s+/,'').replace(/\s*[—–-]\s*(left|right) half\b/g,'').replace(/completed\b/g,'complete').replace(/\s+/g,' ').trim();
  const aligned=(a,b)=>['x','y','width','height'].every(key=>Math.abs(Number(a.bounds?.[key]??(key==='width'||key==='height'?1:0))-Number(b.bounds?.[key]??(key==='width'||key==='height'?1:0)))<.00001)&&Math.abs(Number(a.rotation||0)-Number(b.rotation||0))<.00001;
  for(const owner of frames){
   if(!pipeline(owner)||owner.hidden||owner.templateTheme?.side!=='full')continue;
   for(const companion of frames){
    if(companion===owner||!pipeline(companion)||!half(companion)||!aligned(owner,companion)||stem(owner)!==stem(companion))continue;
    if(companion.templateTheme&&companion.templateTheme.familyId!==owner.templateTheme.familyId)continue;
    duplicates.set(companion,owner);
   }
  }
  return duplicates;
 }
 async function apply(data,fields,warnings=[]){
  const settings=config(data),autoStock=settings.autoStock!==false;if(!settings.enabled&&!autoStock)return data;const choice=selection(fields);if(!choice.requested)return data;
  const duplicates=settings.enabled?pipelineDuplicates(data):new Map(),changes=[];
  for(const frame of data.frames||[]){
   if(duplicates.has(frame))continue;
   const link=settings.enabled&&frame.templateTheme,recipe=stockRecipe(frame,data),localChoice=elementChoice(frame,data,choice,recipe);
   const classRange=(data.rulesRanges||[]).find(range=>frame.visualFamilyId&&range.visualFamilies?.[frame.visualFamilyId]);
   if(!link&&classRange&&!frame.fixedAppearance){const family=classRange.visualFamilies[frame.visualFamilyId];if(family.variants?.[localChoice.left]&&(!localChoice.right||family.variants?.[localChoice.right]))changes.push({frame,src:await compose({...family,name:frame.name},{side:'full'},localChoice,data,frame),masks:copy(frame.masks||[]),choice:localChoice});else warnings.push('Class appearance for '+frame.name+' is missing '+palette[localChoice.left]+(localChoice.right?' / '+palette[localChoice.right]:'')+'; its saved image was retained.');continue;}
   if(link){const family=settings.families.find(family=>family.id===link.familyId);if(!family)throw Error('Missing asset family for '+frame.name+'.');changes.push({frame,src:await compose(family,link,localChoice,data,frame),masks:copy(link.masks||[]),recipe,choice:localChoice});continue;}
   if(autoStock&&recipe)changes.push({frame,...await stockArtwork(frame,data,['native','class','legacyRegular'].includes(recipe.kind)?choice:localChoice,recipe),recipe,choice:localChoice});
  }
  if(!changes.length){if(settings.enabled)warnings.push('No linked custom layers or recognized stock elements were found for color switching.');return data;}
  for(const {frame,src,masks,recipe,choice} of changes){frame.src=src;delete frame.image;delete frame.assetId;frame.masks=masks;if(recipe)frame.stockThemeRecipe=recipe;if(frame.sectionAppearance){frame.sectionAppearance.left=choice.left;frame.sectionAppearance.right=choice.right;}if(frame.sectionCrown){frame.sectionCrown.left=choice.left;frame.sectionCrown.right=choice.right;}if(recipe?.kind==='prototype'){const owner=data.frames.find(item=>item.designLayerId===recipe.owner);if(owner?.sectionModule){owner.sectionModule.left=choice.left;owner.sectionModule.right=choice.right;}}}
  for(const [companion,owner] of duplicates){companion.templateThemeDuplicate=companion.templateThemeDuplicate||{owner:owner.designLayerId,originalHidden:!!companion.hidden};companion.hidden=true;}
  for(const range of data.rulesRanges||[])if(range.kind==='class')range.visualVariant=choice.right?'m':choice.left;
  data.csvImport=data.csvImport||{};data.csvImport.templateColors=[choice.left,choice.right].filter(Boolean);return data;
 }
 const fieldLabel=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
 function mapFields(data,values,warnings){for(const [label,lines] of Object.entries(values||{})){const matches=Object.values(data.text||{}).filter(field=>fieldLabel(field.csvFieldLabel||field.name)===label);if(matches.length!==1){warnings.push('Template field “'+label+'” '+(matches.length?'is ambiguous; give the fields distinct labels.':'was not found.'));continue;}matches[0].text=lines.join('\n');}}
 function refresh(){const panel=document.querySelector('#template-theme-tools');if(!panel)return;const settings=config(card),layer=panel.querySelector('[data-layer]'),family=panel.querySelector('[data-family]'),oldLayer=layer.value,oldFamily=family.value;layer.innerHTML='';family.innerHTML='';for(const frame of card.frames||[]){const option=document.createElement('option');option.value=ensureDesignLayerId(frame);option.textContent=frame.name;layer.appendChild(option);}for(const item of settings.families){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;family.appendChild(option);}if([...layer.options].some(item=>item.value===oldLayer))layer.value=oldLayer;if([...family.options].some(item=>item.value===oldFamily))family.value=oldFamily;panel.querySelector('[data-enabled]').checked=!!settings.enabled;panel.querySelector('[data-auto-stock]').checked=settings.autoStock!==false;showFamily();showLayer();}
 function save(action,label){const before=createDesignStateSnapshot();card.templateThemes=card.templateThemes||{enabled:false,families:[]};action(card.templateThemes);commitDesignUndoSnapshot(before,label);refresh();}
 function selectedFamily(){const panel=document.querySelector('#template-theme-tools');return config(card).families.find(family=>family.id===panel.querySelector('[data-family]').value);}
 function showFamily(){const panel=document.querySelector('#template-theme-tools'),family=selectedFamily();panel.querySelector('[data-status]').textContent=family?'Available colors: '+Object.keys(family.variants||{}).map(key=>palette[key]).join(', '):'Create an asset family, then upload its color versions.';}
 function showLayer(){const panel=document.querySelector('#template-theme-tools'),frame=card.frames.find(frame=>frame.designLayerId===panel.querySelector('[data-layer]').value),link=frame?.templateTheme;if(link&&[...panel.querySelector('[data-family]').options].some(option=>option.value===link.familyId)){panel.querySelector('[data-family]').value=link.familyId;showFamily();}panel.querySelector('[data-unlink]').disabled=!link;panel.querySelector('[data-side]').value=link?.side||'full';panel.querySelector('[data-region]').checked=!!link?.sourceRegion;for(const key of ['x','y','width','height'])panel.querySelector('[data-'+key+']').value=link?.sourceRegion?.[key]??(key==='width'||key==='height'?1:0);}
 function mount(){const slot=document.querySelector('#frame-design-element-tools > .frame-design-section-body');if(!slot)return;const panel=document.createElement('details');panel.id='template-theme-tools';panel.className='frame-design-subsection';panel.innerHTML='<summary>Template Colors</summary><div class="frame-design-section-body"><label><input type="checkbox" data-enabled> Enable custom family color switching</label><label><input type="checkbox" data-auto-stock checked> Automatically color recognized stock elements from CSV</label><p>Families contain interchangeable color artwork. Linking a layer preserves its position, size and text behavior.</p><label>Asset family<select class="input" data-family></select></label><input class="input" data-name placeholder="New family name, e.g. Boss Pinline"><button class="input" type="button" data-create>Create Asset Family</button><label>Upload color<select class="input" data-color></select><input class="input" type="file" accept="image/*" data-upload></label><p data-status aria-live="polite"></p><label>Frame layer<select class="input" data-layer></select></label><button class="input" type="button" data-capture>Use Layer Artwork for Selected Color</button><button class="input" type="button" data-stock>Add Available Stock Colors</button><label>Color behavior<select class="input" data-side><option value="full">Single color or blended two colors</option><option value="left">Left color (keep existing masks)</option><option value="right">Right color (keep existing masks)</option></select></label><details><summary>Source region (advanced)</summary><p>Use this when uploading a complete frame rather than an image of this element. Coordinates are fractions of the source image, from 0 to 1. Each color version must use the same source layout.</p><label><input type="checkbox" data-region> Crop a region of the uploaded image</label><div class="input-grid"><input type="number" min="0" max="1" step=".001" class="input" data-x aria-label="Source X"><input type="number" min="0" max="1" step=".001" class="input" data-y aria-label="Source Y"><input type="number" min=".001" max="1" step=".001" class="input" data-width aria-label="Source width"><input type="number" min=".001" max="1" step=".001" class="input" data-height aria-label="Source height"></div></details><div class="input-grid"><button class="input" type="button" data-link>Link Layer to Family</button><button class="input" type="button" data-unlink>Remove Family from Layer</button></div><p>Save or export the frame project after linking assets. CSV uses Template plus Color, or explicit Frame Left Color / Frame Right Color. More than two colors use the Multicolor variant.</p></div>';slot.appendChild(panel);
  for(const [key,label] of Object.entries(palette)){const option=document.createElement('option');option.value=key;option.textContent=label;panel.querySelector('[data-color]').appendChild(option);}
  panel.querySelector('[data-family]').onchange=showFamily;panel.querySelector('[data-layer]').onchange=showLayer;
  panel.querySelector('[data-auto-stock]').onchange=event=>save(settings=>{settings.autoStock=event.target.checked;},'Change automatic stock colors');
  panel.querySelector('[data-enabled]').onchange=event=>save(settings=>{settings.enabled=event.target.checked;},'Change template color switching');
  panel.querySelector('[data-create]').onclick=()=>{const name=panel.querySelector('[data-name]').value.trim();if(!name)return;const id='theme-'+Date.now().toString(36);save(settings=>settings.families.push({id,name,variants:{}}),'Create color family');panel.querySelector('[data-family]').value=id;showFamily();};
  panel.querySelector('[data-upload]').onchange=async event=>{const family=selectedFamily(),file=event.target.files[0],color=panel.querySelector('[data-color]').value;if(!family||!file)return;try{const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});await image(src);save(()=>{family.variants[color]={name:family.name+' '+palette[color],src};},'Add color variant');}catch(error){panel.querySelector('[data-status]').textContent=error.message||'Could not load the asset.';}event.target.value='';};
  panel.querySelector('[data-capture]').onclick=()=>{const frame=card.frames.find(frame=>frame.designLayerId===panel.querySelector('[data-layer]').value),family=selectedFamily(),color=panel.querySelector('[data-color]').value;if(!frame||!family)return;save(()=>{family.variants[color]={name:family.name+' '+palette[color],src:frame.src};},'Capture color variant');};
  panel.querySelector('[data-stock]').onclick=async()=>{const frame=card.frames.find(frame=>frame.designLayerId===panel.querySelector('[data-layer]').value),family=selectedFamily();if(!frame||!family)return;const variants={};try{for(const color of Object.keys(palette)){let src;if(frame.sectionAppearance?.role==='rules'&&frame.sectionAppearance.style!=='browse'){const style=window.FrameSectionCatalog?.styles.find(item=>item.id===frame.sectionAppearance.style);if(!style?.variants[color])continue;src=(await FrameSectionTools.renderStyle(style,'rules',color,'',!!frame.sectionAppearance.pinlines,false)).src;}else if(card.frames.some(owner=>owner.sectionModule?.partId===frame.designLayerId)||frame.prototypePiece){const style=window.FrameSectionCatalog?.styles.find(item=>item.id==='prototype');if(!style?.variants[color])continue;const owner=card.frames.find(owner=>(frame.designLayerId&&owner.sectionModule?.partId===frame.designLayerId)||(frame.prototypePiece?.owner&&owner.designLayerId===frame.prototypePiece.owner)),rendered=await FrameSectionTools.renderPrototype(color,'',owner?.sectionModule?.pinlines!==false);src=frame.prototypePiece?rendered.extras[frame.prototypePiece.kind].src:rendered.src;}else if(/(?:m15PT|\/pt)[WUBRGMALC]\.png$/i.test(frame.src)){src=frame.src.replace(/[WUBRGMALC]\.png$/i,color.toUpperCase()+'.png');try{await image(src);}catch{continue;}}else throw Error('For this custom layer, upload matching color images or capture its artwork for each color.');if(frame.resizeContainerRaster&&frame.image&&window.ContainerResizeTools){const uploaded=await image(src);src=ContainerResizeTools.slices(uploaded,frame.image.naturalWidth||frame.image.width,frame.image.naturalHeight||frame.image.height).toDataURL();}variants[color]={name:family.name+' '+palette[color],src};}if(!Object.keys(variants).length)throw Error('No stock color variants are available for this layer.');save(()=>Object.assign(family.variants,variants),'Add stock color variants');}catch(error){panel.querySelector('[data-status]').textContent=error.message;}};
  panel.querySelector('[data-link]').onclick=()=>{const frame=card.frames.find(frame=>frame.designLayerId===panel.querySelector('[data-layer]').value),family=selectedFamily();if(!frame||!family)return;let sourceRegion;if(panel.querySelector('[data-region]').checked){sourceRegion=Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(panel.querySelector('[data-'+key+']').value)]));if(Object.values(sourceRegion).some(value=>!Number.isFinite(value))||sourceRegion.x<0||sourceRegion.y<0||sourceRegion.width<=0||sourceRegion.height<=0||sourceRegion.x+sourceRegion.width>1||sourceRegion.y+sourceRegion.height>1){panel.querySelector('[data-status]').textContent='The source region must fit inside the image.';return;}}save(()=>{const recipe=stockRecipe(frame,card);if(recipe)frame.stockThemeRecipe=recipe;frame.templateTheme={familyId:family.id,side:panel.querySelector('[data-side]').value,sourceRegion,masks:copy(frame.masks||[])};},'Link frame color family');};
  panel.querySelector('[data-unlink]').onclick=()=>{const frame=card.frames.find(frame=>frame.designLayerId===panel.querySelector('[data-layer]').value);if(frame)save(()=>unlink(frame),'Remove family from layer');};refresh();
 }
 function restore(frame,definition){if((frame.templateTheme||definition.templateTheme)&&frame.src!==definition.src){frame.src=definition.src;frame.masks=copy(definition.masks||[]);if(definition.assetId)frame.assetId=definition.assetId;else delete frame.assetId;Promise.all([image(frame.src).then(asset=>frame.image=asset),...frame.masks.map(async mask=>mask.image=await image(mask.src))]).then(()=>{if(typeof drawFrames==='function')drawFrames();}).catch(error=>console.error(error));}if(definition.templateTheme)frame.templateTheme=copy(definition.templateTheme);else delete frame.templateTheme;if(definition.stockThemeRecipe)frame.stockThemeRecipe=copy(definition.stockThemeRecipe);else delete frame.stockThemeRecipe;}
 window.TemplateThemes={apply,records,colors,selection,fieldLabel,mapFields,refresh,restore,stockRecipe,stockArtwork,unlink,pipelineDuplicates,fitPipeline,elementChoice};window.addEventListener('frameprojectschanged',refresh);window.addEventListener('frameworkspacechanged',refresh);window.addEventListener('creatortabchanged',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
