(function () {
	'use strict';
	var tool = 'select';
	var start = null;
	var editorArea = null;
	var editorUndo = null;
	var suspended = false;
	var counters = {text:0, image:0};

	function designActive() {
		var section = document.querySelector('#creator-menu-frame');
		return window.activeFrameWorkspace === 'design' && section && !section.classList.contains('hidden');
	}
	function point(event) { return layoutHighlightPoint(event); }
	function normalizedBounds(a, b) {
		var x1=Math.min(a.x,b.x), y1=Math.min(a.y,b.y), x2=Math.max(a.x,b.x), y2=Math.max(a.y,b.y);
		var rx=cardCanvas.width/previewCanvas.width/card.width, ry=cardCanvas.height/previewCanvas.height/card.height;
		var bounds={x:x1*rx,y:y1*ry,width:Math.max(10/card.width,(x2-x1)*rx),height:Math.max(10/card.height,(y2-y1)*ry)};
		return window.RulesRange?RulesRange.snapBounds(bounds):bounds;
	}
	function pointBounds(p, kind) {
		var rx=cardCanvas.width/previewCanvas.width/card.width, ry=cardCanvas.height/previewCanvas.height/card.height;
		var width=kind==='text'?.36:.25, height=kind==='text'?.09:.22;
		var bounds={x:Math.max(0,Math.min(1-width,p.x*rx)),y:Math.max(0,Math.min(1-height,p.y*ry)),width:width,height:height};
		return window.RulesRange?RulesRange.snapBounds(bounds,'move'):bounds;
	}
	function uniqueLabel(kind) {
		counters[kind]++;
		var base=kind==='text'?'Text Field ':'Image Container ';
		return base+counters[kind];
	}
	async function create(kind, bounds) {
		var before=createDesignStateSnapshot();
		if (kind==='range') {
			RulesRange.add(bounds);
			return;
		}
		var label=uniqueLabel(kind);
		if (kind==='text') {
			var key=customTemplateFieldKey(label,'custom-text',Object.keys(card.text||{}));
			var item={name:label,csvFieldLabel:label,customField:true,text:'',x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,size:.035,fontSize:0,font:'mplantin',color:'black',align:'left',rotation:0};
			card.text=card.text||{}; var definition={}; definition[key]=item; loadTextOptions(definition,false);
			var index=Object.keys(card.text).indexOf(key); document.querySelectorAll('#text-options .text-option')[index]?.click();
			openEditor({kind:'text',key:key,target:item,rectangle:previewLayoutBounds(item)});
		} else {
			var keys=(card.frames||[]).map(function(frame){return frame.csvImageFieldKey||'';});
			var imageKey=customTemplateFieldKey(label,'custom-image',keys);
			var frame={name:label,csvFieldLabel:label,csvImageFieldKey:imageKey,customField:true,designCreated:true,src:'/img/blank.png',noThumb:true,masks:[],bounds:bounds,opacity:100,rotation:0};
			card.frames=card.frames||[]; card.frames.unshift(frame); await addFrame([],frame); selectedFrame=frame;
			openEditor({kind:'frame',key:imageKey,target:frame,rectangle:previewLayoutBounds(bounds)});
		}
		commitDesignUndoSnapshot(before,'Create '+kind);
		if(window.RulesRange)RulesRange.refreshElements();
		drawCard();
	}
	function rangeFor(area) { return (card.rulesRanges||[]).find(function(r){return r.id===area.key;}); }
	function boundsFor(area) { return area.kind==='frame'?area.target.bounds:area.target; }
	function input(id,value) { var e=document.querySelector('#canvas-element-'+id); if(e)e.value=value; }
	function openEditor(area) {
		if (!area || !['text','frame','rulesRange'].includes(area.kind)) return false;
		if (editorArea && editorUndo) closeEditor();
		editorArea=area; editorUndo=createDesignStateSnapshot();
		var range=area.kind==='rulesRange'?rangeFor(area):null, target=boundsFor(area);
		document.querySelector('#canvas-element-title').textContent=area.kind==='text'?'Text Box':area.kind==='frame'?(area.target.csvImageFieldKey?'Image Container':'Frame Component'):'Rules Range';
		input('name',range?range.name:(area.kind==='frame'?(area.target.csvFieldLabel||area.target.name):(area.target.name||area.key)));
		input('x',Math.round(target.x*card.width)); input('y',Math.round(target.y*card.height));
		input('width',Math.round(target.width*card.width)); input('height',Math.round(target.height*card.height));
		input('rotation',Number(range?range.rotation:(area.kind==='frame'?area.target.rotation:area.target.rotation))||0);
		var flow=document.querySelector('#canvas-element-flow-row'); if(flow)flow.hidden=!range;
		var style=document.querySelector('#canvas-element-text-style');if(style)style.hidden=area.kind!=='text';
		if(area.kind==='text')refreshTextStyle(area.key);
		if(range) input('flow',range.direction||'vertical');
		['auto','uniform'].forEach(function(kind){var row=document.querySelector('#canvas-element-'+kind+'-row'),box=document.querySelector('#canvas-element-'+kind+(kind==='auto'?'-size':'-text'));if(row)row.hidden=!range;if(box&&range)box.checked=kind==='auto'?!!range.autoSizeModules:!!range.uniformTextSize;});
		document.querySelector('#canvas-element-editor').classList.add('opened'); return true;
	}
	function applyEditor(event) {
		if(!editorArea||!event?.target)return;
		var id=event.target.id,range=editorArea.kind==='rulesRange'?rangeFor(editorArea):null,target=boundsFor(editorArea);
		var geometry={ 'canvas-element-x':'x','canvas-element-y':'y','canvas-element-width':'width','canvas-element-height':'height' };
		if(geometry[id]){
			var axis=geometry[id],value=Number(event.target.value),size=axis==='x'||axis==='width'?card.width:card.height;
			if(!Number.isFinite(value))return;
			target[axis]=(axis==='width'||axis==='height'?Math.max(10,value):value)/size;
			if(window.RulesRange)RulesRange.snapBounds(target,axis==='x'?'left':axis==='y'?'top':axis==='width'?'right':'bottom',range?.id,range?null:{kind:editorArea.kind,key:editorArea.kind==='frame'?ensureDesignLayerId(editorArea.target):editorArea.key});
			['x','y','width','height'].forEach(function(key){input(key,Math.round(target[key]*(key==='x'||key==='width'?card.width:card.height)));});
			if(window.RulesRange){if(range)RulesRange.syncElements();else RulesRange.updateElementRelative(editorArea.kind==='frame'?'frame':'text',editorArea.kind==='frame'?ensureDesignLayerId(editorArea.target):editorArea.key,{resizeVertical:axis==='height'});}
			if(editorArea.kind==='frame')drawFrames();else drawTextBuffer();drawCard();return;
		}
		if(id==='canvas-element-name'){
			var name=event.target.value.trim();if(!name)return;
			if(range){range.name=name;RulesRange.refresh();}
			else{editorArea.target.name=name;editorArea.target.csvFieldLabel=name;if(editorArea.kind==='text'){var textIndex=Object.keys(card.text).indexOf(editorArea.key),option=document.querySelector('#text-options')?.children[textIndex];if(option)option.textContent=name;}else{var frameIndex=card.frames.indexOf(editorArea.target),heading=document.querySelector('#frame-list')?.children[frameIndex]?.querySelector('h4');if(heading)heading.textContent=name;}}
			return;
		}
		if(id==='canvas-element-rotation'){(range||editorArea.target).rotation=Number(event.target.value)||0;drawCard();return;}
		if(range&&['canvas-element-flow','canvas-element-auto-size','canvas-element-uniform-text'].includes(id)){
			range.direction=document.querySelector('#canvas-element-flow').value;
			range.autoSizeModules=!!document.querySelector('#canvas-element-auto-size').checked;
			range.uniformTextSize=!!document.querySelector('#canvas-element-uniform-text').checked;
			RulesRange.syncElements();RulesRange.refresh();return;
		}
		if(editorArea.kind==='text'&&id.startsWith('canvas-style-')&&id!=='canvas-style-family'&&window.RulesTextStyles){
			var styles={'canvas-style-font':'font','canvas-style-font-size':'fontSize','canvas-style-size':'size','canvas-style-align':'align','canvas-style-color':'color','canvas-style-line-spacing':'lineSpacing','canvas-style-kerning':'kerning','canvas-style-shadow-x':'shadowX','canvas-style-shadow-y':'shadowY','canvas-style-outline':'outlineWidth','canvas-style-one-line':'oneLine','canvas-style-top':'noVerticalCenter'},property=styles[id];
			if(!property)return;var value=event.target.type==='checkbox'?event.target.checked:event.target.type==='number'?Number(event.target.value):event.target.value;
			if(event.target.type==='number'&&!Number.isFinite(value))return;
			if(property==='size')value=Math.max(.001,value);
			var changed={};changed[property]=value;RulesTextStyles.update(editorArea.key,changed,false);
		}
	}
	function refreshTextStyle(key){if(!window.RulesTextStyles)return;var field=card.text[key],list=document.querySelector('#canvas-style-font');if(!field||!list)return;if(!list.options.length)list.innerHTML=RulesTextStyles.fontOptions();if(field.font&&!RulesTextStyles.fonts.includes(field.font)){var option=document.createElement('option');option.value=field.font;option.textContent=field.font;list.appendChild(option);}list.value=field.font||'mplantin';[['font-size',field.fontSize||0],['size',field.size||.038],['align',field.align||'left'],['color',/^#[\da-f]{6}$/i.test(field.color||'')?field.color:({white:'#ffffff',black:'#000000',red:'#ff0000',blue:'#0000ff',green:'#008000'}[String(field.color||'').toLowerCase()]||'#000000')],['line-spacing',field.lineSpacing||0],['kerning',field.kerning||0],['shadow-x',field.shadowX||0],['shadow-y',field.shadowY||0],['outline',field.outlineWidth||0]].forEach(function(pair){var input=document.querySelector('#canvas-style-'+pair[0]);if(input)input.value=pair[1];});document.querySelector('#canvas-style-one-line').checked=!!field.oneLine;document.querySelector('#canvas-style-top').checked=!!field.noVerticalCenter;var family=document.querySelector('#canvas-style-family');family.replaceChildren();var none=document.createElement('option');none.value='';none.textContent='No family';family.appendChild(none);RulesTextStyles.options(key).forEach(function(item){var opt=document.createElement('option');opt.value=item.id;opt.textContent=item.name;family.appendChild(opt);if(item.selected)family.value=item.id;});family.disabled=!RulesTextStyles.options(key).length;renderFamilyCandidates(key);}
	function renderFamilyCandidates(key){var container=document.querySelector('#canvas-style-members');if(!container||!window.RulesTextStyles)return;container.replaceChildren();var family=document.querySelector('#canvas-style-family').value;var title=document.createElement('p');title.textContent='Text fields in this family (this field is always included):';container.appendChild(title);var source=document.createElement('label'),sourceCheck=document.createElement('input');sourceCheck.type='checkbox';sourceCheck.checked=true;sourceCheck.disabled=true;sourceCheck.value=key;source.appendChild(sourceCheck);source.appendChild(document.createTextNode(' '+(card.text[key]?.name||key)+' (current field)'));container.appendChild(source);var candidates=RulesTextStyles.candidates(key);if(!candidates.length){var empty=document.createElement('p');empty.textContent='Attach another module text field to this range first.';container.appendChild(empty);}candidates.forEach(function(candidate){var label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=candidate.key;check.checked=!!family&&candidate.familyId===family;label.appendChild(check);label.appendChild(document.createTextNode(' '+candidate.label));container.appendChild(label);});document.querySelector('#canvas-style-save-members').disabled=!family;}
	function selectedFamilyKeys(){return Array.from(document.querySelectorAll('#canvas-style-members input:checked')).map(function(input){return input.value;});}
	function closeEditor(suppressReturn) { if(editorUndo)commitDesignUndoSnapshot(editorUndo,'Edit canvas element'); editorUndo=null; editorArea=null; document.querySelector('#canvas-element-editor').classList.remove('opened'); if(suppressReturn!==true)window.dispatchEvent(new Event('canvaselementclosed')); }
	function fullEditor() { if(!editorArea)return; if(editorArea.kind==='text'){var i=Object.keys(card.text).indexOf(editorArea.key);activateCreatorEditorTab('text');var option=document.querySelector('#text-options')?.children[i];if(option)option.click();if(i>=0)textboxEditor();} else if(editorArea.kind==='frame'){selectedFrame=editorArea.target;activateCreatorEditorTab('frame');var i=card.frames.indexOf(editorArea.target);var e=document.querySelector('#frame-list')?.children[i];if(e)frameElementDoubleClicked({target:e});} else {activateCreatorEditorTab('frame');RulesRange.select(editorArea.key);} window.RulesTextStyles?.cancelReturnToModule();closeEditor(true); suspend(); }
	function toolColor(kind){return kind==='text'?'#43d9ff':kind==='image'?'#ff59d6':'#b784ff';}
	function choose(next){tool=next;document.querySelectorAll('[data-canvas-tool]').forEach(function(b){b.classList.toggle('active',b.dataset.canvasTool===tool);});previewCanvas.classList.toggle('canvas-tool-crosshair',tool!=='select');var draft=document.querySelector('#canvas-design-draft');if(draft&&tool!=='select'){var color=toolColor(tool);draft.style.borderColor=color;draft.style.background=color+'33';}}
	function suspend(){suspended=true;choose('select');document.querySelector('.canvas-design-toolbar')?.classList.remove('opened');document.querySelector('#canvas-design-menu')?.classList.remove('opened');}
	function resume(){suspended=false;document.querySelector('.canvas-design-toolbar')?.classList.toggle('opened',designActive());}
	function showMenu(event){if(!designActive())return;event.preventDefault();var hit=layoutHighlightHit(point(event),true);if(hit&&openEditor(hit.area))return;var menu=document.querySelector('#canvas-design-menu');menu.dataset.x=point(event).x;menu.dataset.y=point(event).y;menu.style.left=Math.min(event.clientX,innerWidth-230)+'px';menu.style.top=Math.min(event.clientY,innerHeight-180)+'px';menu.classList.add('opened');}
	function menuCreate(kind){var menu=document.querySelector('#canvas-design-menu');var p={x:Number(menu.dataset.x),y:Number(menu.dataset.y)};menu.classList.remove('opened');create(kind,pointBounds(p,kind));}
	function buildUI(){
		if (document.querySelector('#canvas-element-editor')) return;
		document.body.insertAdjacentHTML('beforeend',`<div class="canvas-design-toolbar"><button class="input active" data-canvas-tool="select">Select</button><button class="input" data-canvas-tool="text">Text</button><button class="input" data-canvas-tool="image">Image</button><button class="input" data-canvas-tool="range">Range</button></div><div id="canvas-design-menu" class="canvas-design-menu"><button class="input" data-create="text">Add Text Box Here</button><button class="input" data-create="image">Add Image Container Here</button><button class="input" data-create="range">Add Rules Range Here</button></div><div id="canvas-design-draft" class="canvas-design-draft"></div><div id="canvas-element-editor" class="canvas-element-editor"><h2 id="canvas-element-title" class="canvas-element-editor-title">Element</h2><h2 class="canvas-element-editor-close">X</h2><label class="wide">Name<input id="canvas-element-name" class="input"></label><label>X<input id="canvas-element-x" class="input" type="number"></label><label>Y<input id="canvas-element-y" class="input" type="number"></label><label>Width<input id="canvas-element-width" class="input" type="number" min="10"></label><label>Height<input id="canvas-element-height" class="input" type="number" min="10"></label><label>Rotation<input id="canvas-element-rotation" class="input" type="number"></label><div id="canvas-element-text-style" class="wide"><h3>Text Style</h3><label>Card font<select id="canvas-style-font" class="input"></select></label><label>Font-size override (px)<input id="canvas-style-font-size" class="input" type="number" step="1"></label><label>Base size (card-height ratio)<input id="canvas-style-size" class="input" type="number" step="0.001" min="0.001"></label><label>Alignment<select id="canvas-style-align" class="input"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label><label>Text color<input id="canvas-style-color" class="input" type="color"></label><label>Line spacing<input id="canvas-style-line-spacing" class="input" type="number" step="0.05"></label><label>Letter spacing (card-width ratio)<input id="canvas-style-kerning" class="input" type="number" step="0.0001"></label><label>Shadow X (card-width ratio)<input id="canvas-style-shadow-x" class="input" type="number" step="0.0001"></label><label>Shadow Y (card-height ratio)<input id="canvas-style-shadow-y" class="input" type="number" step="0.0001"></label><label>Outline width (card-height ratio)<input id="canvas-style-outline" class="input" type="number" step="0.0001" min="0"></label><label><input id="canvas-style-one-line" type="checkbox"> Single line</label><label><input id="canvas-style-top" type="checkbox"> Top aligned</label><label>Style family<select id="canvas-style-family" class="input"></select></label><div id="canvas-style-members" class="wide" role="group" aria-label="Text fields in this style family"></div><button type="button" class="input" id="canvas-style-create-family">Create Family from Selected Fields</button><button type="button" class="input" id="canvas-style-save-members">Update Family Members</button></div><label id="canvas-element-flow-row">Module Flow<select id="canvas-element-flow" class="input"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label><label id="canvas-element-auto-row" class="wide">Auto-size modules to text<input id="canvas-element-auto-size" type="checkbox"></label><label id="canvas-element-uniform-row" class="wide">Uniform text size across modules<input id="canvas-element-uniform-text" type="checkbox"></label><button id="canvas-element-full" class="input wide">Open Full Editor</button></div>`);
		function updateVisibility(){document.querySelector('.canvas-design-toolbar').classList.toggle('opened',designActive()&&!suspended);if(!designActive()||suspended){choose('select');document.querySelector('#canvas-design-menu').classList.remove('opened');}}
		function contextChanged(){suspended=false;updateVisibility();}
		document.querySelectorAll('[data-canvas-tool]').forEach(function(b){b.onclick=function(){choose(b.dataset.canvasTool);};});document.querySelectorAll('[data-create]').forEach(function(b){b.onclick=function(){menuCreate(b.dataset.create);};});
		document.querySelectorAll('#canvas-element-editor input,#canvas-element-editor select').forEach(function(e){e.onchange=applyEditor;});document.querySelector('.canvas-element-editor-close').onclick=closeEditor;document.querySelector('#canvas-element-full').onclick=fullEditor;
		document.querySelector('#canvas-style-family').onchange=function(){if(!editorArea||editorArea.kind!=='text')return;RulesTextStyles.joinFamily(editorArea.key,this.value,false);refreshTextStyle(editorArea.key);};
		document.querySelector('#canvas-style-create-family').onclick=function(){if(!editorArea||editorArea.kind!=='text')return;RulesTextStyles.createFamily(editorArea.key,false,selectedFamilyKeys());refreshTextStyle(editorArea.key);};
		document.querySelector('#canvas-style-save-members').onclick=function(){if(!editorArea||editorArea.kind!=='text')return;var id=document.querySelector('#canvas-style-family').value;if(!id)return;RulesTextStyles.setFamilyMembers(editorArea.key,id,selectedFamilyKeys(),false);refreshTextStyle(editorArea.key);};
		var editor=document.querySelector('#canvas-element-editor'),handle=editor.querySelector('.canvas-element-editor-title');handle.addEventListener('pointerdown',function(e){var rect=editor.getBoundingClientRect(),ox=e.clientX-rect.left,oy=e.clientY-rect.top;function move(m){editor.style.left=Math.max(0,Math.min(innerWidth-editor.offsetWidth,m.clientX-ox))+'px';editor.style.top=Math.max(0,Math.min(innerHeight-editor.offsetHeight,m.clientY-oy))+'px';}function stop(){document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop);}document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop);e.preventDefault();});
		function updateDraft(e){if(!start)return;var canvasRect=previewCanvas.getBoundingClientRect(),beginX=canvasRect.left+start.x*canvasRect.width/previewCanvas.width,beginY=canvasRect.top+start.y*canvasRect.height/previewCanvas.height;var draft=document.querySelector('#canvas-design-draft'),left=Math.max(canvasRect.left,Math.min(beginX,e.clientX)),top=Math.max(canvasRect.top,Math.min(beginY,e.clientY)),right=Math.min(canvasRect.right,Math.max(beginX,e.clientX)),bottom=Math.min(canvasRect.bottom,Math.max(beginY,e.clientY));draft.style.left=left+'px';draft.style.top=top+'px';draft.style.width=Math.max(1,right-left)+'px';draft.style.height=Math.max(1,bottom-top)+'px';draft.classList.add('opened');}
		function finishDraft(e){if(!start)return;var canvasRect=previewCanvas.getBoundingClientRect(),clientX=Math.max(canvasRect.left,Math.min(canvasRect.right,e.clientX)),clientY=Math.max(canvasRect.top,Math.min(canvasRect.bottom,e.clientY)),begin=start,end=point({clientX:clientX,clientY:clientY}),kind=tool;start=null;document.querySelector('#canvas-design-draft').classList.remove('opened');create(kind,normalizedBounds(begin,end));choose('select');e.preventDefault();}
		previewCanvas.addEventListener('contextmenu',showMenu);previewCanvas.addEventListener('pointerdown',function(e){if(tool==='select'||e.button!==0||!designActive())return;start=point(e);updateDraft(e);e.stopImmediatePropagation();e.preventDefault();},{capture:true});
		document.addEventListener('pointermove',updateDraft);document.addEventListener('pointerup',finishDraft);
		document.addEventListener('pointerdown',function(e){if(!e.target.closest('#canvas-design-menu'))document.querySelector('#canvas-design-menu').classList.remove('opened');});
		window.addEventListener('frameworkspacechanged',contextChanged);window.addEventListener('creatortabchanged',contextChanged);updateVisibility();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',buildUI);
	else buildUI();
	window.CanvasDesignTools={openEditor:openEditor,closeEditor:closeEditor,choose:choose,suspend:suspend,resume:resume};
})();
