// Standard M15 field geometry, expressed in the source artwork's full-card coordinates.
(function(){
 'use strict';
 const templates={
  mana:{name:'Mana Cost',text:'',x:.0854,y:.0613,width:.8438,height:71/2100,oneLine:true,size:71/1638,align:'right',shadowX:-.001,shadowY:.0029,manaCost:true,manaSpacing:0},
  title:{name:'Title',text:'',x:.0854,y:.0522,width:.8292,height:.0543,oneLine:true,font:'belerenb',size:.0381},
  type:{name:'Type',text:'',x:.0854,y:.5664,width:.8292,height:.0543,oneLine:true,font:'belerenb',size:.0324},
  rules:{name:'Rules / Flavor Text',text:'',x:.086,y:.6303,width:.828,height:.2875,font:'mplantin',size:.0362},
  pt:{name:'Power/Toughness',text:'',x:.7928,y:.902,width:.1367,height:.0372,size:.0372,font:'belerenbsc',oneLine:true,align:'center'}
 };
 const groups={title:['title','mana'],type:['type'],rules:['rules'],pt:['pt']};
 const regions={title:{x:.06,y:.045,width:.88,height:.066},type:{x:.06,y:.56,width:.88,height:.064},rules:{x:.07,y:.62,width:.86,height:.305},pt:{x:.78,y:.891,width:.16,height:.06}};
 const clone=x=>JSON.parse(JSON.stringify(x));
 function transform(frame){const b=frame.bounds||{};return {x:b.x||0,y:b.y||0,width:b.width||1,height:b.height||1,rotation:Number(frame.rotation)||0};}
 function rotate(x,y,cx,cy,degrees){const a=degrees*Math.PI/180,dx=(x-cx)*card.width,dy=(y-cy)*card.height;return {x:cx+(dx*Math.cos(a)-dy*Math.sin(a))/card.width,y:cy+(dx*Math.sin(a)+dy*Math.cos(a))/card.height};}
 function remap(field,from,to,point){let cx=field.x+(point?0:field.width/2),cy=field.y+(point?0:field.height/2);let p=rotate(cx,cy,from.x+from.width/2,from.y+from.height/2,-(from.rotation||0));p={x:to.x+(p.x-from.x)*to.width/from.width,y:to.y+(p.y-from.y)*to.height/from.height};p=rotate(p.x,p.y,to.x+to.width/2,to.y+to.height/2,to.rotation||0);field.width*=to.width/from.width;field.height*=to.height/from.height;field.x=p.x-(point?0:field.width/2);field.y=p.y-(point?0:field.height/2);if(field.size)field.size*=to.height/from.height;if(!point)field.rotation=(Number(field.rotation)||0)+(to.rotation||0)-(from.rotation||0);}
 function attach(field,frame){field.frameAnchor={id:ensureDesignLayerId(frame),last:transform(frame)};}
 function sync(){let changed=false,symbol=false;const entries=Object.values(card.text||{}).concat(card.setSymbolBounds?[card.setSymbolBounds]:[]);entries.forEach(field=>{const a=field.frameAnchor;if(!a)return;const frame=card.frames.find(f=>ensureDesignLayerId(f)===a.id);if(!frame)return;const to=transform(frame);if(JSON.stringify(to)===JSON.stringify(a.last))return;const isSymbol=field===card.setSymbolBounds;remap(field,a.last,to,isSymbol);a.last=to;changed=true;symbol=symbol||isSymbol;});if(symbol&&typeof resetSetSymbol==='function')resetSetSymbol();return changed;}
 function nativeLayout(frame){
  const layout={text:clone(templates),symbol:{x:.9213,y:.591,width:.12,height:.041,vertical:'center',horizontal:'right'}};
  const saved=frame.designTextLayout;
  if(saved){Object.keys(templates).forEach(role=>{if(saved.text?.[role]){const field=saved.text[role];['x','y','width','height','size','font','align','color','oneLine'].forEach(key=>{if(field[key]!==undefined)layout.text[role][key]=field[key];});}});if(saved.setSymbolBounds)layout.symbol=clone(saved.setSymbolBounds);}
  else {
   const pack=frame.designSourcePack||'',src=frame.src||'';
   if(['Class','ClassRange','ClassUB','StoneCutterDeluxeClass'].includes(pack)||/\/class\//i.test(src)){
    const stone=pack==='StoneCutterDeluxeClass';layout.text.type.y=stone?.8572:.8481;
    layout.symbol={x:.9227,y:stone?.885:.8739,width:.12,height:.0381,vertical:'center',horizontal:'right'};
   }
  }
  // Placement metadata belongs to the new frame, never an older text anchor.
  delete layout.symbol.frameAnchor;return layout;
 }
 function insert(frame,kind,cropped){if(!frame||!groups[kind])return;sync();const before=createDesignStateSnapshot(),id=ensureDesignLayerId(frame),from=cropped?regions[kind]:{x:0,y:0,width:1,height:1},to=transform(frame),fields={},native=cropped?{text:templates,symbol:{x:.9213,y:.591,width:.12,height:.041,vertical:'center',horizontal:'right'}}:nativeLayout(frame);
  groups[kind].forEach(role=>{let key=Object.keys(card.text||{}).find(k=>card.text[k].frameAnchor?.id===id&&card.text[k].standardRole===role);if(!key)key=!card.text[role]?.frameAnchor?role:role+'-'+id;const old=card.text[key];let field=clone(native.text[role]);field.text=old?.text||'';field.standardRole=role;field.customField=true;remap(field,from,to,false);attach(field,frame);fields[key]=field;});loadTextOptions(fields,false);
  if(kind==='type'){card.setSymbolBounds=clone(native.symbol);remap(card.setSymbolBounds,from,to,true);attach(card.setSymbolBounds,frame);resetSetSymbol();}
  drawTextBuffer();drawCard();commitDesignUndoSnapshot(before,'Insert standard frame fields');
 }
 function duplicate(source,copy){const id=ensureDesignLayerId(source),newId=ensureDesignLayerId(copy),fields={};Object.entries(card.text).forEach(([key,text])=>{if(text.frameAnchor?.id!==id)return;const field=clone(text);field.frameAnchor.id=newId;fields[key+'-'+newId]=field;});if(Object.keys(fields).length)loadTextOptions(fields,false);}
 function mount(container,frame){let panel=container.querySelector('.frame-standard-fields');if(!panel){panel=document.createElement('div');panel.className='frame-standard-fields wide';panel.innerHTML='<h3>Add standard fields</h3><label>Preset<select class="input preset-kind"><option value="title">Title and mana cost</option><option value="type">Type line and set symbol</option><option value="rules">Rules and flavor text</option><option value="pt">Power / toughness</option></select></label><label>Artwork layout<select class="input preset-layout"><option value="full">Full-card artwork (source frame placement)</option><option value="cropped">Cropped component</option></select></label><p>Uses the source frame’s field placement, adjusted to this layer’s position and size. Existing standard text is preserved. The type preset positions the current rarity-colored set symbol.</p><button type="button" class="input preset-add">Insert fields</button>';container.appendChild(panel);}
  panel.hidden=!frame;if(!frame)return;const name=(frame.componentLabel||frame.name||'').toLowerCase();panel.querySelector('.preset-kind').value=/power|toughness|\bpt\b/.test(name)?'pt':/type/.test(name)?'type':/rules|text/.test(name)?'rules':'title';panel.querySelector('.preset-add').onclick=()=>insert(frame,panel.querySelector('.preset-kind').value,panel.querySelector('.preset-layout').value==='cropped');
 }
 window.FrameTextPresets={insert,sync,duplicate,mount,remap,templates};
})();
