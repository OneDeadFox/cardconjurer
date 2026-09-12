(function () {
	'use strict';
	var tool = 'select';
	var start = null;
	var editorArea = null;
	var editorUndo = null;
	var counters = {text:0, image:0};

	function designActive() {
		var section = document.querySelector('#creator-menu-frame');
		return window.activeFrameWorkspace === 'design' && section && !section.classList.contains('hidden');
	}
	function point(event) { return layoutHighlightPoint(event); }
	function normalizedBounds(a, b) {
		var x1=Math.min(a.x,b.x), y1=Math.min(a.y,b.y), x2=Math.max(a.x,b.x), y2=Math.max(a.y,b.y);
		var rx=cardCanvas.width/previewCanvas.width/card.width, ry=cardCanvas.height/previewCanvas.height/card.height;
		return {x:x1*rx,y:y1*ry,width:Math.max(10/card.width,(x2-x1)*rx),height:Math.max(10/card.height,(y2-y1)*ry)};
	}
	function pointBounds(p, kind) {
		var rx=cardCanvas.width/previewCanvas.width/card.width, ry=cardCanvas.height/previewCanvas.height/card.height;
		var width=kind==='text'?.36:.25, height=kind==='text'?.09:.22;
		return {x:Math.max(0,Math.min(1-width,p.x*rx)),y:Math.max(0,Math.min(1-height,p.y*ry)),width:width,height:height};
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
		if(range) input('flow',range.direction||'vertical');
		document.querySelector('#canvas-element-editor').classList.add('opened'); return true;
	}
	function applyEditor() {
		if(!editorArea)return; var range=editorArea.kind==='rulesRange'?rangeFor(editorArea):null, target=boundsFor(editorArea);
		var val=function(id){return Number(document.querySelector('#canvas-element-'+id).value)||0;};
		target.x=val('x')/card.width; target.y=val('y')/card.height; target.width=Math.max(10,val('width'))/card.width; target.height=Math.max(10,val('height'))/card.height;
		var name=document.querySelector('#canvas-element-name').value.trim(); var rotation=val('rotation'); if(range){range.name=name||range.name;range.direction=document.querySelector('#canvas-element-flow').value;range.rotation=rotation;RulesRange.refresh();}
		else if(editorArea.kind==='frame'){editorArea.target.rotation=rotation;if(name){editorArea.target.name=name;editorArea.target.csvFieldLabel=name;var frameIndex=card.frames.indexOf(editorArea.target);var heading=document.querySelector('#frame-list')?.children[frameIndex]?.querySelector('h4');if(heading)heading.textContent=name;}} else {editorArea.target.rotation=rotation;if(name){editorArea.target.name=name;editorArea.target.csvFieldLabel=name;var textIndex=Object.keys(card.text).indexOf(editorArea.key);var option=document.querySelector('#text-options')?.children[textIndex];if(option)option.textContent=name;}}
		drawTextBuffer(); drawFrames(); drawCard();
	}
	function closeEditor() { if(editorUndo)commitDesignUndoSnapshot(editorUndo,'Edit canvas element'); editorUndo=null; editorArea=null; document.querySelector('#canvas-element-editor').classList.remove('opened'); }
	function fullEditor() { if(!editorArea)return; if(editorArea.kind==='text'){var i=Object.keys(card.text).indexOf(editorArea.key);activateCreatorEditorTab('text');var option=document.querySelector('#text-options')?.children[i];if(option)option.click();if(i>=0)textboxEditor();} else if(editorArea.kind==='frame'){selectedFrame=editorArea.target;activateCreatorEditorTab('frame');var i=card.frames.indexOf(editorArea.target);var e=document.querySelector('#frame-list')?.children[i];if(e)frameElementClicked({target:e});} else {activateCreatorEditorTab('frame');RulesRange.select(editorArea.key);} closeEditor(); }
	function choose(next){tool=next;document.querySelectorAll('[data-canvas-tool]').forEach(function(b){b.classList.toggle('active',b.dataset.canvasTool===tool);});previewCanvas.classList.toggle('canvas-tool-crosshair',tool!=='select');}
	function showMenu(event){if(!designActive())return;event.preventDefault();var hit=layoutHighlightHit(point(event),true);if(hit&&openEditor(hit.area))return;var menu=document.querySelector('#canvas-design-menu');menu.dataset.x=point(event).x;menu.dataset.y=point(event).y;menu.style.left=Math.min(event.clientX,innerWidth-230)+'px';menu.style.top=Math.min(event.clientY,innerHeight-180)+'px';menu.classList.add('opened');}
	function menuCreate(kind){var menu=document.querySelector('#canvas-design-menu');var p={x:Number(menu.dataset.x),y:Number(menu.dataset.y)};menu.classList.remove('opened');create(kind,pointBounds(p,kind));}
	function buildUI(){
		if (document.querySelector('#canvas-element-editor')) return;
		document.body.insertAdjacentHTML('beforeend',`<div class="canvas-design-toolbar"><button class="input active" data-canvas-tool="select">Select</button><button class="input" data-canvas-tool="text">Text</button><button class="input" data-canvas-tool="image">Image</button><button class="input" data-canvas-tool="range">Range</button></div><div id="canvas-design-menu" class="canvas-design-menu"><button class="input" data-create="text">Add Text Box Here</button><button class="input" data-create="image">Add Image Container Here</button><button class="input" data-create="range">Add Rules Range Here</button></div><div id="canvas-design-draft" class="canvas-design-draft"></div><div id="canvas-element-editor" class="canvas-element-editor"><h2 id="canvas-element-title" class="canvas-element-editor-title">Element</h2><h2 class="canvas-element-editor-close">X</h2><label class="wide">Name<input id="canvas-element-name" class="input"></label><label>X<input id="canvas-element-x" class="input" type="number"></label><label>Y<input id="canvas-element-y" class="input" type="number"></label><label>Width<input id="canvas-element-width" class="input" type="number" min="10"></label><label>Height<input id="canvas-element-height" class="input" type="number" min="10"></label><label>Rotation<input id="canvas-element-rotation" class="input" type="number"></label><label id="canvas-element-flow-row">Module Flow<select id="canvas-element-flow" class="input"><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></select></label><button id="canvas-element-full" class="input wide">Open Full Editor</button></div>`);
		function updateVisibility(){document.querySelector('.canvas-design-toolbar').classList.toggle('opened',designActive());if(!designActive()){choose('select');document.querySelector('#canvas-design-menu').classList.remove('opened');}}
		document.querySelectorAll('[data-canvas-tool]').forEach(function(b){b.onclick=function(){choose(b.dataset.canvasTool);};});document.querySelectorAll('[data-create]').forEach(function(b){b.onclick=function(){menuCreate(b.dataset.create);};});
		document.querySelectorAll('#canvas-element-editor input,#canvas-element-editor select').forEach(function(e){e.onchange=applyEditor;});document.querySelector('.canvas-element-editor-close').onclick=closeEditor;document.querySelector('#canvas-element-full').onclick=fullEditor;
		var editor=document.querySelector('#canvas-element-editor'),handle=editor.querySelector('.canvas-element-editor-title');handle.addEventListener('pointerdown',function(e){var rect=editor.getBoundingClientRect(),ox=e.clientX-rect.left,oy=e.clientY-rect.top;function move(m){editor.style.left=Math.max(0,Math.min(innerWidth-editor.offsetWidth,m.clientX-ox))+'px';editor.style.top=Math.max(0,Math.min(innerHeight-editor.offsetHeight,m.clientY-oy))+'px';}function stop(){document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop);}document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop);e.preventDefault();});
		function updateDraft(e){if(!start)return;var canvasRect=previewCanvas.getBoundingClientRect(),beginX=canvasRect.left+start.x*canvasRect.width/previewCanvas.width,beginY=canvasRect.top+start.y*canvasRect.height/previewCanvas.height;var draft=document.querySelector('#canvas-design-draft'),left=Math.max(canvasRect.left,Math.min(beginX,e.clientX)),top=Math.max(canvasRect.top,Math.min(beginY,e.clientY)),right=Math.min(canvasRect.right,Math.max(beginX,e.clientX)),bottom=Math.min(canvasRect.bottom,Math.max(beginY,e.clientY));draft.style.left=left+'px';draft.style.top=top+'px';draft.style.width=Math.max(1,right-left)+'px';draft.style.height=Math.max(1,bottom-top)+'px';draft.classList.add('opened');}
		function finishDraft(e){if(!start)return;var canvasRect=previewCanvas.getBoundingClientRect(),clientX=Math.max(canvasRect.left,Math.min(canvasRect.right,e.clientX)),clientY=Math.max(canvasRect.top,Math.min(canvasRect.bottom,e.clientY)),begin=start,end=point({clientX:clientX,clientY:clientY}),kind=tool;start=null;document.querySelector('#canvas-design-draft').classList.remove('opened');create(kind,normalizedBounds(begin,end));choose('select');e.preventDefault();}
		previewCanvas.addEventListener('contextmenu',showMenu);previewCanvas.addEventListener('pointerdown',function(e){if(tool==='select'||e.button!==0||!designActive())return;start=point(e);updateDraft(e);e.stopImmediatePropagation();e.preventDefault();},{capture:true});
		document.addEventListener('pointermove',updateDraft);document.addEventListener('pointerup',finishDraft);
		document.addEventListener('pointerdown',function(e){if(!e.target.closest('#canvas-design-menu'))document.querySelector('#canvas-design-menu').classList.remove('opened');});
		window.addEventListener('frameworkspacechanged',updateVisibility);updateVisibility();
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',buildUI);
	else buildUI();
	window.CanvasDesignTools={openEditor:openEditor,closeEditor:closeEditor,choose:choose};
})();
