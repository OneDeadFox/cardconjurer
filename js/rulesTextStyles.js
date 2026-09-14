(function () {
	'use strict';
	// These are card-face fonts shipped by css/style-9.css, not browser UI fonts.
	const fonts = ['mplantin','mplantini','plantinsemibold','plantinsemibolditalic','belerenb','belerenbsc','matrix','matrixb','matrixbsc','goudymedieval','gothammedium','gothambold','phyrexian','phyrexianold','invocation','invocation-text','souvenir','palatino','fritz-quadrata'];
	const properties = ['font','fontSize','size','align','color','lineSpacing','kerning','shadowX','shadowY','outlineWidth','oneLine','noVerticalCenter'];
	let currentModule=null,returnToModule=false;
	function location(key){for(const range of card.rulesRanges||[])for(const module of range.modules||[])for(const entry of module.elements||[])if(entry.kind==='text'&&entry.key===key)return {range,module,entry};return null;}
	function copyStyle(field){const result={};properties.forEach(key=>{if(field[key]!==undefined)result[key]=field[key];});return result;}
	function applyStyle(field,style){properties.forEach(key=>{if(style[key]!==undefined)field[key]=style[key];});}
	function options(key){const found=location(key),families=found?.range.textFamilies||{};return Object.entries(families).map(([id,family])=>({id,name:family.name,selected:id===found.entry.textFamilyId}));}
	function candidates(key){const found=location(key);if(!found)return [];return found.range.modules.flatMap(module=>(module.elements||[]).filter(entry=>entry.kind==='text'&&entry.key!==key&&card.text?.[entry.key]).map(entry=>({key:entry.key,label:module.name+' — '+(card.text[entry.key].name||entry.key),familyId:entry.textFamilyId||''})));}
	function update(key,style,record=true){const field=card.text?.[key];if(!field)return;const before=record&&typeof createDesignStateSnapshot==='function'?createDesignStateSnapshot():null;applyStyle(field,style);const found=location(key),family=found?.range.textFamilies?.[found.entry.textFamilyId];if(family){family.style=copyStyle(field);for(const module of found.range.modules)for(const entry of module.elements||[])if(entry.kind==='text'&&entry.textFamilyId===found.entry.textFamilyId&&card.text[entry.key])applyStyle(card.text[entry.key],family.style);}if(window.RulesRange)RulesRange.syncElements();if(typeof drawTextBuffer==='function')drawTextBuffer();if(before&&typeof commitDesignUndoSnapshot==='function')commitDesignUndoSnapshot(before,'Edit module text style');refreshModule();}
	function createFamily(key,record=true,members=[]){const found=location(key);if(!found)return null;const name=prompt('Name this text style family:',(card.text[key]?.name||'Text')+' Style');if(!name?.trim())return null;const before=record?createDesignStateSnapshot():null;found.range.textFamilies=found.range.textFamilies||{};const id='text-family-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);found.range.textFamilies[id]={name:name.trim(),style:copyStyle(card.text[key])};setFamilyMembers(key,id,[key].concat(members),false);if(before)commitDesignUndoSnapshot(before,'Create text style family');refreshModule();return id;}
	function setFamilyMembers(key,id,members,record=true){const found=location(key),family=found?.range.textFamilies?.[id];if(!family)return;const before=record?createDesignStateSnapshot():null,selected=new Set([key].concat(members||[]));found.range.modules.forEach(module=>(module.elements||[]).forEach(entry=>{if(entry.kind!=='text'||!card.text?.[entry.key])return;if(entry.textFamilyId===id&&!selected.has(entry.key))entry.textFamilyId='';if(selected.has(entry.key)){entry.textFamilyId=id;applyStyle(card.text[entry.key],family.style);}}));if(window.RulesRange)RulesRange.syncElements();if(typeof drawTextBuffer==='function')drawTextBuffer();if(before)commitDesignUndoSnapshot(before,'Edit text style family members');refreshModule();}
	function joinFamily(key,id,record=true){const found=location(key);if(!found)return;const before=record?createDesignStateSnapshot():null;const family=found.range.textFamilies?.[id];if(id&& !family)return;found.entry.textFamilyId=id||'';if(family)applyStyle(card.text[key],family.style);RulesRange.syncElements();drawTextBuffer();if(before)commitDesignUndoSnapshot(before,'Change text style family');refreshModule();}
	function fontOptions(){return fonts.map(font=>'<option value="'+font+'">'+font+'</option>').join('');}
	function ensureUI(){if(document.querySelector('#rules-module-editor'))return;const panel=document.createElement('div');panel.id='rules-module-editor';panel.className='rules-module-editor';panel.hidden=true;panel.innerHTML='<div class="rules-module-dialog readable-background padding"><button class="input" id="rules-module-close" type="button">Close</button><h2>Module Editor</h2><p>Preview of attached fields and image layers. Select an element to edit its settings.</p><div id="rules-module-preview" class="rules-module-preview"></div><select id="rules-module-elements" class="input"></select><div class="input-grid"><button id="rules-module-edit" class="input">Edit Selected Element</button><button id="rules-module-add-text" class="input">Add Text Field</button><button id="rules-module-add-image" class="input">Add Image Layer</button></div><p id="rules-module-help">To attach another existing element, use Attach Element in the Rules Range panel.</p></div>';document.body.appendChild(panel);const style=document.createElement('style');style.textContent='.rules-module-editor:not([hidden]){position:fixed;inset:0;background:#000a;z-index:2000;display:flex;align-items:center;justify-content:center}.rules-module-dialog{width:min(560px,92vw);max-height:90vh;overflow:auto}.rules-module-preview{position:relative;height:230px;margin:12px 0;background:#27212e;border:1px solid #9974b2;overflow:hidden}.rules-module-preview .module-part{position:absolute;box-sizing:border-box;border:1px solid #f6b55c;color:white;background:#754988aa;overflow:hidden;font-size:12px;cursor:pointer}.rules-module-preview .module-part.image{border-color:#ff59d6;background:#4b3c51aa}.rules-module-preview .module-part img{width:100%;height:100%}';document.head.appendChild(style);panel.querySelector('#rules-module-close').onclick=()=>panel.hidden=true;panel.querySelector('#rules-module-elements').onchange=()=>renderPreview();panel.querySelector('#rules-module-edit').onclick=editSelected;panel.querySelector('#rules-module-add-text').onclick=()=>addElement('text');panel.querySelector('#rules-module-add-image').onclick=()=>addElement('frame');}
	function openModule(){const range=RulesRange.getSelected(),module=RulesRange.getSelectedModule();if(!range||!module)return;currentModule={rangeId:range.id,moduleId:module.id};ensureUI();document.querySelector('#rules-module-editor').hidden=false;refreshModule();}
	window.addEventListener('canvaselementclosed',function(){if(!returnToModule)return;returnToModule=false;const panel=document.querySelector('#rules-module-editor');if(panel&&active()){panel.hidden=false;refreshModule();}});
	function active(){const range=(card.rulesRanges||[]).find(item=>item.id===currentModule?.rangeId),module=range?.modules.find(item=>item.id===currentModule?.moduleId);return range&&module?{range,module}:null;}
	function refreshModule(){const panel=document.querySelector('#rules-module-editor');if(!panel||panel.hidden)return;const found=active();if(!found){panel.hidden=true;return;}const select=panel.querySelector('#rules-module-elements'),previous=select.value;select.replaceChildren();found.module.elements.forEach((entry,index)=>{const item=document.createElement('option');item.value=index;item.textContent=(entry.kind==='text'?'Text: ':'Image: ')+(entry.kind==='text'?card.text?.[entry.key]?.name:card.frames.find(frame=>frame.designLayerId===entry.key)?.name||entry.key);if(entry.kind==='text'&&entry.textFamilyId&&found.range.textFamilies?.[entry.textFamilyId])item.textContent+=' [Style: '+found.range.textFamilies[entry.textFamilyId].name+']';select.appendChild(item);});if([...select.options].some(option=>option.value===previous))select.value=previous;renderPreview();}
	function renderPreview(){
		const found=active(),preview=document.querySelector('#rules-module-preview');
		if(!found||!preview)return;
		preview.replaceChildren();
		const layout=RulesRange.getModuleLayouts(found.range).find(item=>item.module.id===found.module.id),bounds=layout?.bounds;
		if(!bounds)return;
		const selected=Number(document.querySelector('#rules-module-elements')?.value);
		found.module.elements.forEach((entry,index)=>{
			const target=entry.kind==='text'?card.text?.[entry.key]:card.frames.find(frame=>frame.designLayerId===entry.key);
			if(!target)return;
			const b=entry.kind==='text'?target:target.bounds,part=document.createElement('div');
			part.className='module-part '+(entry.kind==='text'?'text':'image');
			positionPart(part,b,bounds);
			part.style.outline=index===selected?'2px solid white':'';
			part.textContent=entry.kind==='text'?(target.name||entry.key)+(entry.textFamilyId&&found.range.textFamilies?.[entry.textFamilyId]?' · '+found.range.textFamilies[entry.textFamilyId].name:''):'';
			if(entry.kind!=='text'&&target.src){const img=document.createElement('img');img.src=target.src;img.alt=target.name||'';part.appendChild(img);}
			['top-left','top','top-right','right','bottom-right','bottom','bottom-left','left'].forEach(action=>{const handle=document.createElement('span');handle.className='module-resize-handle';handle.dataset.action=action;handle.title='Resize '+action.replace('-',' ');part.appendChild(handle);});
			const remove=document.createElement('button');remove.type='button';remove.className='module-delete';remove.textContent='×';remove.title=entry.owned?'Delete this module element':'Detach this element from the module';remove.onpointerdown=e=>e.stopPropagation();remove.onclick=e=>{e.stopPropagation();RulesRange.removeModuleElement(found.module.id,index);refreshModule();};part.appendChild(remove);
			part.onpointerdown=e=>beginPreviewDrag(e,part,entry,index,bounds);
			part.ondblclick=()=>{document.querySelector('#rules-module-elements').value=index;editSelected();};
			preview.appendChild(part);
		});
	}
	function positionPart(part,b,moduleBounds){part.style.left=((b.x-moduleBounds.x)/moduleBounds.width*100)+'%';part.style.top=((b.y-moduleBounds.y)/moduleBounds.height*100)+'%';part.style.width=(b.width/moduleBounds.width*100)+'%';part.style.height=(b.height/moduleBounds.height*100)+'%';}
	function beginPreviewDrag(event,part,entry,index,moduleBounds){
		if(event.button!==0||event.target.closest('.module-delete'))return;
		const target=entry.kind==='text'?card.text?.[entry.key]:card.frames.find(frame=>frame.designLayerId===entry.key);
		if(!target)return;
		const bounds=entry.kind==='text'?target:target.bounds,original={x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},before=createDesignStateSnapshot(),preview=document.querySelector('#rules-module-preview'),rect=preview.getBoundingClientRect(),action=event.target.dataset.action||'move',startX=event.clientX,startY=event.clientY;
		const select=document.querySelector('#rules-module-elements');select.value=index;
		preview.querySelectorAll('.module-part').forEach(item=>item.style.outline=item===part?'2px solid white':'');
		part.setPointerCapture(event.pointerId);
		function move(e){
			const dx=(e.clientX-startX)/rect.width*moduleBounds.width,dy=(e.clientY-startY)/rect.height*moduleBounds.height,next={...original};
			if(action==='move'){next.x+=dx;next.y+=dy;}
			else{
				if(action.includes('left')){next.x+=dx;next.width=Math.max(10/card.width,original.width-dx);}
				if(action.includes('right'))next.width=Math.max(10/card.width,original.width+dx);
				if(action.includes('top')){next.y+=dy;next.height=Math.max(10/card.height,original.height-dy);}
				if(action.includes('bottom'))next.height=Math.max(10/card.height,original.height+dy);
			}
			RulesRange.snapBounds(next,action,'',{kind:entry.kind,key:entry.key});
			Object.assign(bounds,next);positionPart(part,bounds,moduleBounds);
			if(entry.kind==='frame')drawFrames();else drawTextBuffer();
		}
		function finish(e){
			part.removeEventListener('pointermove',move);part.removeEventListener('pointerup',finish);part.removeEventListener('pointercancel',cancel);
			if(part.hasPointerCapture(e.pointerId))part.releasePointerCapture(e.pointerId);
			RulesRange.updateElementRelative(entry.kind,entry.key,{resizeVertical:action.includes('top')||action.includes('bottom')});
			RulesRange.syncElements();commitDesignUndoSnapshot(before,'Move or resize module element');refreshModule();
		}
		function cancel(e){part.removeEventListener('pointermove',move);part.removeEventListener('pointerup',finish);part.removeEventListener('pointercancel',cancel);if(part.hasPointerCapture(e.pointerId))part.releasePointerCapture(e.pointerId);Object.assign(bounds,original);RulesRange.syncElements();refreshModule();}
		part.addEventListener('pointermove',move);part.addEventListener('pointerup',finish);part.addEventListener('pointercancel',cancel);
		event.preventDefault();
	}
	function editSelected(){const found=active(),entry=found?.module.elements[Number(document.querySelector('#rules-module-elements')?.value)];if(!entry)return;const target=entry.kind==='text'?card.text?.[entry.key]:card.frames.find(frame=>frame.designLayerId===entry.key);if(!target)return;document.querySelector('#rules-module-editor').hidden=true;returnToModule=true;if(!CanvasDesignTools.openEditor({kind:entry.kind==='text'?'text':'frame',key:entry.key,target,rectangle:null})){returnToModule=false;document.querySelector('#rules-module-editor').hidden=false;}}
	async function addElement(kind){const found=active();if(!found)return;const before=createDesignStateSnapshot(),layout=RulesRange.getModuleLayouts(found.range).find(item=>item.module.id===found.module.id),b=layout.bounds,keyName=kind==='text'?'Module Text':'Module Image';let key;if(kind==='text'){key=customTemplateFieldKey(keyName,'custom-text',Object.keys(card.text||{}));const definition={};definition[key]={name:keyName,text:'',x:b.x,y:b.y,width:b.width,height:.04,size:.03,font:'mplantin',fontSize:0,customField:true};loadTextOptions(definition,false);}else{const frame={name:keyName,src:'/img/blank.png',masks:[],bounds:{x:b.x,y:b.y,width:b.width,height:.04},opacity:100,designCreated:true,customField:true,noThumb:true};ensureDesignLayerId(frame);card.frames.unshift(frame);await addFrame([],frame);key=frame.designLayerId;}found.module.elements.push({kind,key,owned:true,offset:{x:0,y:0,width:b.width*card.width,height:.04*card.height}});RulesRange.syncElements();commitDesignUndoSnapshot(before,'Add module element');refreshModule();}
	window.RulesTextStyles={fonts,fontOptions,options,candidates,update,createFamily,joinFamily,setFamilyMembers,openModule,refreshModule,cancelReturnToModule:()=>{returnToModule=false;}};
})();
