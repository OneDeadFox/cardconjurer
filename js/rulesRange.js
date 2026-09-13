(function () {
	'use strict';
	var selectedRangeId='',selectedModuleId='',rangeCounter=0,moduleCounter=0;
	function clone(value){return JSON.parse(JSON.stringify(value));}
	function nextId(prefix,counter){return prefix+'-'+Date.now().toString(36)+'-'+counter.toString(36);}
	function nextRangeId(){rangeCounter++;return nextId('rules-range',rangeCounter);}
	function nextModuleId(){moduleCounter++;return nextId('rules-module',moduleCounter);}
	function normalizeModule(module,index){module.id=String(module.id||nextModuleId());module.name=String(module.name||'Module '+((index||0)+1));module.sizing=module.sizing==='fixed'?'fixed':'flex';module.size=Math.max(1,Number(module.size)||(module.sizing==='fixed'?80:1));module.elements=Array.isArray(module.elements)?module.elements:[];return module;}
	function normalizeRange(range,index){range.id=String(range.id||nextRangeId());range.name=String(range.name||'Rules Range '+((index||0)+1));range.direction=range.direction==='horizontal'?'horizontal':'vertical';range.rotation=Number(range.rotation)||0;range.bounds=range.bounds||{x:.12,y:.55,width:.76,height:.3};range.bounds.x=Number(range.bounds.x)||0;range.bounds.y=Number(range.bounds.y)||0;range.bounds.width=Math.max(10/Math.max(Number(card.width)||1,1),Number(range.bounds.width)||.76);range.bounds.height=Math.max(10/Math.max(Number(card.height)||1,1),Number(range.bounds.height)||.3);range.modules=Array.isArray(range.modules)?range.modules:[];range.modules.forEach(normalizeModule);return range;}
	function ranges(){if(!window.card)return[];card.rulesRanges=Array.isArray(card.rulesRanges)?card.rulesRanges:[];card.rulesRanges.forEach(normalizeRange);return card.rulesRanges;}
	function selected(){var list=ranges(),match=list.find(function(range){return range.id===selectedRangeId;});if(!match&&list.length){match=list[0];selectedRangeId=match.id;}return match||null;}
	function selectedModule(){var range=selected();if(!range)return null;var match=range.modules.find(function(module){return module.id===selectedModuleId;});if(!match&&range.modules.length){match=range.modules[0];selectedModuleId=match.id;}return match||null;}
	function status(message,error){var element=document.querySelector('#rules-range-status');if(element){element.textContent=message;element.style.color=error?'#ff8f8f':'';}}
	function setInput(id,value){var input=document.querySelector('#'+id);if(input)input.value=value;}
	function pixelValue(value,dimension){return Math.round((Number(value)||0)*Math.max(Number(dimension)||1,1));}
	function snapshot(){return typeof createDesignStateSnapshot==='function'?createDesignStateSnapshot():null;}
	function commit(before,label){if(typeof commitDesignUndoSnapshot==='function')commitDesignUndoSnapshot(before,label);}
	function refreshModules(){var list=document.querySelector('#rules-range-module-list');if(!list)return;var range=selected(),modules=range?range.modules:[],module=selectedModule();list.innerHTML='';if(!modules.length){var empty=document.createElement('option');empty.value='';empty.textContent='No modules';list.appendChild(empty);list.disabled=true;selectedModuleId='';}else{list.disabled=false;modules.forEach(function(item){var option=document.createElement('option');option.value=item.id;option.textContent=item.name+' — '+(item.sizing==='fixed'?item.size+' px':'flex '+item.size);list.appendChild(option);});list.value=module.id;}['rules-range-module-name','rules-range-module-sizing','rules-range-module-size'].forEach(function(id){var input=document.querySelector('#'+id);if(input)input.disabled=!module;});setInput('rules-range-module-name',module?module.name:'');setInput('rules-range-module-sizing',module?module.sizing:'flex');setInput('rules-range-module-size',module?module.size:'');var size=document.querySelector('#rules-range-module-size');if(size)size.placeholder=module&&module.sizing==='fixed'?'Pixels':'Flex weight';refreshElements();}
	function refreshInputs(){var range=selected(),disabled=!range;['rules-range-name','rules-range-x','rules-range-y','rules-range-width','rules-range-height'].forEach(function(id){var input=document.querySelector('#'+id);if(input)input.disabled=disabled;});if(!range){setInput('rules-range-name','');['x','y','width','height'].forEach(function(key){setInput('rules-range-'+key,'');});refreshModules();status('No rules range selected.');return;}setInput('rules-range-name',range.name);setInput('rules-range-x',pixelValue(range.bounds.x,card.width));setInput('rules-range-y',pixelValue(range.bounds.y,card.height));setInput('rules-range-width',pixelValue(range.bounds.width,card.width));setInput('rules-range-height',pixelValue(range.bounds.height,card.height));refreshModules();status('Selected “'+range.name+'” with '+range.modules.length+' module'+(range.modules.length===1?'':'s')+'.');}
	function refresh(){var list=document.querySelector('#rules-range-list');if(!list)return;var current=selected();list.innerHTML='';if(!ranges().length){var empty=document.createElement('option');empty.value='';empty.textContent='No rules ranges';list.appendChild(empty);list.disabled=true;selectedRangeId='';}else{list.disabled=false;ranges().forEach(function(range){var option=document.createElement('option');option.value=range.id;option.textContent=range.name;list.appendChild(option);});list.value=current.id;}refreshInputs();if(typeof drawCard==='function')drawCard();}
	function add(bounds){if(!window.card)return;var before=snapshot(),index=ranges().length,range=normalizeRange({id:nextRangeId(),name:'Rules Range '+(index+1),direction:'vertical',bounds:bounds||{x:.12,y:.55,width:.76,height:.3},modules:[]},index);ranges().push(range);selectedRangeId=range.id;selectedModuleId='';refresh();commit(before,'Add rules range');}
	function remove(id,ask){var range=id?ranges().find(function(item){return item.id===id;}):selected();if(!range||(ask!==false&&!confirm('Remove the rules range “'+range.name+'”? Its modules and duplicated elements will also be removed.')))return false;var before=snapshot(),removedModules=range.modules.slice();card.rulesRanges=ranges().filter(function(item){return item.id!==range.id;});removeOwnedElements(removedModules);selectedRangeId=card.rulesRanges.length?card.rulesRanges[0].id:'';selectedModuleId='';refresh();commit(before,'Remove rules range');return true;}
	function removeSelected(){return remove('',true);}
	function select(id){if(ranges().some(function(range){return range.id===id;})){selectedRangeId=id;selectedModuleId='';}refresh();}
	function renameSelected(value){var range=selected(),next=String(value||'').trim();if(!range||!next||next===range.name)return;var before=snapshot();range.name=next;refresh();commit(before,'Rename rules range');}
	function numberInput(id,fallback){var value=Number(document.querySelector('#'+id)?.value);return Number.isFinite(value)?value:fallback;}
	function updateBounds(){var range=selected();if(!range)return;var before=snapshot(),width=Math.max(Number(card.width)||1,1),height=Math.max(Number(card.height)||1,1);range.bounds.x=numberInput('rules-range-x',range.bounds.x*width)/width;range.bounds.y=numberInput('rules-range-y',range.bounds.y*height)/height;range.bounds.width=Math.max(10,numberInput('rules-range-width',range.bounds.width*width))/width;range.bounds.height=Math.max(10,numberInput('rules-range-height',range.bounds.height*height))/height;syncElements();refreshInputs();if(typeof drawCard==='function')drawCard();commit(before,'Resize rules range');}
	function addModule(){var range=selected();if(!range)return;var before=snapshot(),module=normalizeModule({name:'Module '+(range.modules.length+1),sizing:'flex',size:1,elements:[]},range.modules.length);range.modules.push(module);selectedModuleId=module.id;syncElements();refresh();commit(before,'Add rules module');}
	async function duplicateSelectedModule(){
		var range=selected(),source=selectedModule();if(!range||!source)return;
		var before=snapshot(),copy=clone(source);copy.id=nextModuleId();copy.name=source.name+' Copy';copy.elements=[];
		range.modules.splice(range.modules.indexOf(source)+1,0,copy);selectedModuleId=copy.id;
		for(const original of source.elements){
			var target=elementTarget(original);if(!target)continue;
			var entry=clone(original);
			if(original.kind==='text'){
				var name=(target.name||'Text')+' Copy',key=customTemplateFieldKey(name,'custom-text',Object.keys(card.text||{})),definition={};
				definition[key]=clone(target);definition[key].name=name;definition[key].csvFieldLabel=name;definition[key].customField=true;
				loadTextOptions(definition,false);entry.key=key;
			}else{
				var frame=typeof cloneDesignFrameDefinition==='function'?cloneDesignFrameDefinition(target):clone(target);
				frame.name=(frame.name||'Image')+' Copy';frame.csvFieldLabel=frame.name;frame.designCreated=true;frame.customField=true;
				frame.csvImageFieldKey=customTemplateFieldKey(frame.name,'custom-image',(card.frames||[]).map(function(item){return item.csvImageFieldKey||'';}));
				delete frame.designLayerId;delete frame.editorDefaults;ensureDesignLayerId(frame);
				card.frames.unshift(frame);await addFrame([],frame);entry.key=frame.designLayerId;
			}
			entry.owned=true;
			copy.elements.push(entry);
		}
		syncElements();refresh();commit(before,'Duplicate rules module');
		var nameInput=document.querySelector('#rules-range-module-name');nameInput?.focus();nameInput?.select();
	}
	function removeSelectedModule(){
		var range=selected(),module=selectedModule();if(!range||!module)return;
		var before=snapshot(),index=range.modules.indexOf(module);
		range.modules.splice(index,1);
		removeOwnedElements([module]);
		selectedModuleId=range.modules[Math.min(index,range.modules.length-1)]?.id||'';
		syncElements();refresh();commit(before,'Remove rules module');
	}
	function removeOwnedElements(modules){
		var removedText=false,removedFrames=false;
		modules.flatMap(function(module){return module.elements;}).filter(function(entry){return entry.owned;}).forEach(function(entry){
			if(allAttachments().some(function(other){return other.kind===entry.kind&&other.key===entry.key;}))return;
			if(entry.kind==='text'){
				if(card.text?.[entry.key]){delete card.text[entry.key];removedText=true;}
			}else{
				var frame=elementTarget(entry),frameIndex=card.frames.indexOf(frame);
				if(frameIndex>=0){card.frames.splice(frameIndex,1);document.querySelector('#frame-list')?.children[frameIndex]?.remove();if(typeof selectedFrame!=='undefined'&&selectedFrame===frame)selectedFrame=null;removedFrames=true;}
			}
		});
		if(removedText){
			if(Object.keys(card.text).length)loadTextOptions(card.text,true);
			else {var list=document.querySelector('#text-options');if(list)list.innerHTML='';if(typeof drawText==='function')drawText();}
		}
		if(removedFrames&&typeof drawFrames==='function')drawFrames();
	}
	function selectModule(id){var range=selected();if(range&&range.modules.some(function(module){return module.id===id;}))selectedModuleId=id;refreshModules();}
	function updateModule(){var module=selectedModule();if(!module)return;var before=snapshot(),name=document.querySelector('#rules-range-module-name')?.value.trim(),sizing=document.querySelector('#rules-range-module-sizing')?.value,size=Number(document.querySelector('#rules-range-module-size')?.value),nextSizing=sizing==='fixed'?'fixed':'flex';if(name)module.name=name;if(nextSizing!==module.sizing)size=nextSizing==='fixed'?80:1;module.sizing=nextSizing;module.size=Math.max(1,Number.isFinite(size)?size:module.size);syncElements();refresh();commit(before,'Edit rules module');}
	function moveSelectedModule(delta){var range=selected(),module=selectedModule();if(!range||!module)return;var index=range.modules.indexOf(module),next=Math.max(0,Math.min(range.modules.length-1,index+Number(delta)));if(next===index)return;var before=snapshot();range.modules.splice(index,1);range.modules.splice(next,0,module);syncElements();refresh();commit(before,'Reorder rules module');}
	function elementTarget(entry){return entry.kind==='text'?card.text?.[entry.key]:(card.frames||[]).find(function(frame){return frame.designLayerId===entry.key;});}
	function elementBounds(entry){var target=elementTarget(entry);return target&&(entry.kind==='text'?target:target.bounds);}
	function allAttachments(){return ranges().flatMap(function(range){return range.modules.flatMap(function(module){return module.elements;});});}
	function refreshElements(){
		var available=document.querySelector('#rules-range-element-list'),attached=document.querySelector('#rules-range-attached-list');
		if(!available||!attached)return;
		var previous=available.value,previousAttached=attached.value,used=new Set(allAttachments().map(function(entry){return entry.kind+':'+entry.key;}));
		available.innerHTML='';attached.innerHTML='';
		function option(list,value,label){var item=document.createElement('option');item.value=value;item.textContent=label;list.appendChild(item);}
		Object.entries(card.text||{}).forEach(function(pair){if(!used.has('text:'+pair[0]))option(available,'text:'+pair[0],'Text: '+(pair[1].name||pair[0]));});
		(card.frames||[]).forEach(function(frame){if(!frame.designLayerId&&typeof ensureDesignLayerId==='function')ensureDesignLayerId(frame);if(frame.designLayerId&&!used.has('frame:'+frame.designLayerId))option(available,'frame:'+frame.designLayerId,'Image: '+(frame.name||'Frame layer'));});
		if(Array.from(available.options).some(function(item){return item.value===previous;}))available.value=previous;
		var module=selectedModule();(module?.elements||[]).forEach(function(entry,index){var target=elementTarget(entry);option(attached,String(index),(entry.kind==='text'?'Text: ':'Image: ')+(target?.name||entry.key));});
		if(Array.from(attached.options).some(function(item){return item.value===previousAttached;}))attached.value=previousAttached;
		available.disabled=!module||!available.options.length;attached.disabled=!module||!attached.options.length;
		refreshAttachedInputs();
	}
	function selectedAttachment(){var module=selectedModule(),list=document.querySelector('#rules-range-attached-list');if(!module||!list||!list.options.length)return null;return module.elements[Number(list.value)]||null;}
	function offsetBounds(bounds,container){return{x:(bounds.x-container.x)*card.width,y:(bounds.y-container.y)*card.height,width:bounds.width*card.width,height:bounds.height*card.height};}
	function applyOffset(bounds,container,offset){bounds.x=container.x+offset.x/card.width;bounds.y=container.y+offset.y/card.height;bounds.width=offset.width/card.width;bounds.height=offset.height/card.height;}
	function refreshAttachedInputs(){
		var entry=selectedAttachment(),range=selected(),module=selectedModule();
		var layout=range&&module?moduleLayouts(range).find(function(item){return item.module.id===module.id;}):null;
		if(entry&&!entry.offset&&layout){
			var bounds=elementBounds(entry);
			if(entry.relative){entry.offset={x:entry.relative.x*layout.bounds.width*card.width,y:entry.relative.y*layout.bounds.height*card.height,width:entry.relative.width*layout.bounds.width*card.width,height:entry.relative.height*layout.bounds.height*card.height};delete entry.relative;}
			else if(bounds)entry.offset=offsetBounds(bounds,layout.bounds);
		}
		['x','y','width','height'].forEach(function(axis){var input=document.querySelector('#rules-range-attached-'+axis);if(!input)return;input.disabled=!entry;input.value=entry?.offset?Math.round(entry.offset[axis]*100)/100:'';});
	}
	function updateAttachedOffsets(){var entry=selectedAttachment();if(!entry)return;var before=snapshot();entry.offset=entry.offset||{x:0,y:0,width:10,height:10};['x','y','width','height'].forEach(function(axis){var input=document.querySelector('#rules-range-attached-'+axis),value=Number(input?.value);if(Number.isFinite(value))entry.offset[axis]=axis==='width'||axis==='height'?Math.max(1,value):value;});syncElements();refreshAttachedInputs();commit(before,'Edit module anchor');}
	function relativeBounds(bounds,container){return{x:(bounds.x-container.x)/container.width,y:(bounds.y-container.y)/container.height,width:bounds.width/container.width,height:bounds.height/container.height};}
	function applyRelative(bounds,container,relative){bounds.x=container.x+relative.x*container.width;bounds.y=container.y+relative.y*container.height;bounds.width=relative.width*container.width;bounds.height=relative.height*container.height;}
	function attachSelectedElement(){
		var module=selected(),active=selectedModule(),value=document.querySelector('#rules-range-element-list')?.value;
		if(!module||!active||!value)return;
		var separator=value.indexOf(':'),entry={kind:value.slice(0,separator),key:value.slice(separator+1)},bounds=elementBounds(entry),layout=moduleLayouts(module).find(function(item){return item.module.id===active.id;});
		if(!bounds||!layout||!layout.bounds.width||!layout.bounds.height)return;
		var before=snapshot();entry.offset=offsetBounds(bounds,layout.bounds);active.elements.push(entry);refreshElements();commit(before,'Attach module element');
	}
	function detachSelectedElement(){var module=selectedModule(),index=Number(document.querySelector('#rules-range-attached-list')?.value);if(!module||!Number.isInteger(index)||index<0||index>=module.elements.length)return;var before=snapshot();module.elements.splice(index,1);refreshElements();commit(before,'Detach module element');}
	function syncElements(){
		var changedText=false,changedFrames=false;
		ranges().forEach(function(range){moduleLayouts(range).forEach(function(layout){layout.module.elements.forEach(function(entry){var bounds=elementBounds(entry);if(!bounds)return;if(entry.offset)applyOffset(bounds,layout.bounds,entry.offset);else if(entry.relative)applyRelative(bounds,layout.bounds,entry.relative);else return;if(entry.kind==='text')changedText=true;else changedFrames=true;});});});
		if(changedFrames&&typeof drawFrames==='function')drawFrames();
		if(changedText&&typeof drawTextBuffer==='function')drawTextBuffer();
	}
	function updateElementRelative(kind,key){var range=ranges().find(function(item){return item.modules.some(function(module){return module.elements.some(function(entry){return entry.kind===kind&&entry.key===key;});});});if(!range)return;var layout=moduleLayouts(range).find(function(item){return item.module.elements.some(function(entry){return entry.kind===kind&&entry.key===key;});}),entry=layout.module.elements.find(function(item){return item.kind===kind&&item.key===key;}),bounds=elementBounds(entry);if(bounds&&layout.bounds.width&&layout.bounds.height){entry.offset=offsetBounds(bounds,layout.bounds);delete entry.relative;}}
	function updateAllRelative(){ranges().forEach(function(range){moduleLayouts(range).forEach(function(layout){layout.module.elements.forEach(function(entry){updateElementRelative(entry.kind,entry.key);});});});}
	function removeElementReferences(kind,key){ranges().forEach(function(range){range.modules.forEach(function(module){module.elements=module.elements.filter(function(entry){return entry.kind!==kind||entry.key!==key;});});});refreshElements();}
	function snapBounds(bounds,action,excludedRangeId){
		if(!bounds)return bounds;
		var guidesX=[],guidesY=[];
		ranges().forEach(function(range){
			if(range.id===excludedRangeId)return;
			var boxes=[range.bounds].concat(moduleLayouts(range).map(function(item){return item.bounds;}));
			boxes.forEach(function(box){guidesX.push(box.x,box.x+box.width);guidesY.push(box.y,box.y+box.height);});
		});
		var threshold=8,mode=action||'resize';
		function nearest(value,guides,dimension){var result=null,distance=threshold/dimension;guides.forEach(function(guide){var delta=guide-value;if(Math.abs(delta)<distance){distance=Math.abs(delta);result=delta;}});return result;}
		function axis(position,length,guides,dimension,startEdge,endEdge){
			var start=bounds[position],end=start+bounds[length],snapStart=nearest(start,guides,dimension),snapEnd=nearest(end,guides,dimension);
			if(mode==='move'){bounds[position]+=snapStart!==null&&(snapEnd===null||Math.abs(snapStart)<=Math.abs(snapEnd))?snapStart:(snapEnd||0);return;}
			var updateStart=mode==='resize'||mode.includes(startEdge),updateEnd=mode==='resize'||mode.includes(endEdge);
			if(updateStart&&snapStart!==null){bounds[position]+=snapStart;bounds[length]-=snapStart;}
			if(updateEnd&&snapEnd!==null)bounds[length]+=snapEnd;
			bounds[length]=Math.max(10/dimension,bounds[length]);
		}
		axis('x','width',guidesX,card.width,'left','right');axis('y','height',guidesY,card.height,'top','bottom');
		return bounds;
	}
	function moduleLayouts(range){range=normalizeRange(range||{},0);var vertical=range.direction!=='horizontal',axisPixels=vertical?range.bounds.height*card.height:range.bounds.width*card.width,fixed=range.modules.reduce(function(sum,module){return sum+(module.sizing==='fixed'?module.size:0);},0),flexWeight=range.modules.reduce(function(sum,module){return sum+(module.sizing==='flex'?module.size:0);},0),overflow=fixed>axisPixels,fixedScale=overflow&&fixed?axisPixels/fixed:1,remaining=Math.max(0,axisPixels-fixed),cursor=0;return range.modules.map(function(module){var pixels=module.sizing==='fixed'?module.size*fixedScale:(flexWeight?remaining*module.size/flexWeight:0),fraction=axisPixels>0?pixels/axisPixels:0,bounds={x:range.bounds.x,y:range.bounds.y,width:range.bounds.width,height:range.bounds.height};if(vertical){bounds.y+=range.bounds.height*cursor;bounds.height=range.bounds.height*fraction;}else{bounds.x+=range.bounds.width*cursor;bounds.width=range.bounds.width*fraction;}cursor+=fraction;return{module:module,bounds:bounds,pixels:pixels,overflow:overflow};});}
	window.RulesRange={add:add,remove:remove,removeSelected:removeSelected,select:select,renameSelected:renameSelected,updateBounds:updateBounds,refresh:refresh,refreshInputs:refreshInputs,refreshElements:refreshElements,refreshAttachedInputs:refreshAttachedInputs,updateAttachedOffsets:updateAttachedOffsets,snapBounds:snapBounds,getSelected:selected,getSelectedModule:selectedModule,getAll:ranges,getModuleLayouts:moduleLayouts,addModule:addModule,duplicateSelectedModule:duplicateSelectedModule,removeSelectedModule:removeSelectedModule,selectModule:selectModule,updateModule:updateModule,moveSelectedModule:moveSelectedModule,attachSelectedElement:attachSelectedElement,detachSelectedElement:detachSelectedElement,syncElements:syncElements,updateElementRelative:updateElementRelative,updateAllRelative:updateAllRelative,removeElementReferences:removeElementReferences,clone:clone};
	window.addEventListener('frameworkspacechanged',refresh);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
