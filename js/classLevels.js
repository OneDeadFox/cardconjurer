(function () {
	'use strict';
	const variants = {w:'White',u:'Blue',b:'Black',r:'Red',g:'Green',m:'Multicolor',a:'Artifact',l:'Land',c:'Colorless',custom:'Custom'};
	let selectedId = '', busy = false;
	const clone = value => JSON.parse(JSON.stringify(value));
	const uid = prefix => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
	function isRange(range) { return card?.version === 'classRange' && (range?.kind === 'class' || range?.id?.startsWith('class-rules-')); }
	function range() { return (card?.rulesRanges || []).find(isRange); }
	function target(entry) { return entry.kind === 'text' ? card.text?.[entry.key] : card.frames.find(frame => frame.designLayerId === entry.key); }
	function role(entry) {
		if (entry.role) return entry.role;
		if (entry.kind === 'frame' && target(entry)?.classRangeBanner) return 'banner';
		if (entry.collisionRole === 'cost') return 'cost';
		if (entry.collisionRole === 'name') return 'title';
		const name = target(entry)?.name || '';
		return / - Cost(?: Copy)*$/.test(name) ? 'cost' : / - Name(?: Copy)*$/.test(name) ? 'title' : / - Text(?: Copy)*$/.test(name) ? 'ability' : 'extra';
	}
	function selected() { const r=range(); return r?.modules.find(level => level.id === selectedId) || r?.modules[0]; }
	function select(id) {
		const r=range(); if (!r?.modules.some(level => level.id === id)) return;
		selectedId=id; RulesRange.select(r.id); RulesRange.selectModule(id); refresh(); drawCard();
	}
	function initialize(r) {
		if (!isRange(r)) return;
		r.kind='class'; r.visualFamilies=r.visualFamilies || {};
		r.modules.forEach((level,index) => {
			level.level=index+1;
			level.elements.forEach(entry => { entry.role=role(entry); entry.owned=true; });
		});
		if (!r.laterLevelDesign && r.modules[1]) r.laterLevelDesign=captureDesign(r.modules[1]);
		if (!r.visualVariant) {
			const base=card.frames.find(frame => /\/img\/frames\/class\/(?:nyx\/)?[wubrgmalc]\.png$/.test(frame.src));
			r.visualVariant=base?.src.match(/([wubrgmalc])\.png$/)?.[1] || 'w';
		}
		refresh();
	}
	function captureDesign(level) {
		return {sizing:level.sizing,size:level.size,elements:level.elements.map(entry => {
			const item=target(entry); if (!item) return null;
			const copy=clone(entry); delete copy.textFamilyId;
			return {entry:copy,definition:entry.kind==='frame'?cloneDesignFrameDefinition(item):clone(item)};
		}).filter(Boolean)};
	}
	async function construct(design, number, clearContent) {
		const level={id:uid('class-level'),name:'Level '+number,level:number,sizing:design.sizing,size:design.size,elements:[]};
		for (const item of design.elements) {
			const entry=clone(item.entry), definition=clone(item.definition);
			delete entry.textFamilyId; entry.owned=true;
			if (entry.kind==='text') {
				entry.key=customTemplateFieldKey('Level '+number+' '+(entry.role||'Text'),'custom-text',Object.keys(card.text||{}));
				definition.name=number+' - '+({cost:'Cost',title:'Name',ability:'Text'}[entry.role] || definition.name);
				definition.csvFieldLabel=definition.name; definition.customField=true;
				delete definition.rangeClip;
				if (clearContent && entry.role!=='title') definition.text='';
				if (entry.role==='title' && /^Level\s+\d+$/i.test(definition.text||'')) definition.text='Level '+number;
				const content=definition.text||'';
				loadTextOptions({[entry.key]:definition},false);
				// The legacy textbox loader restores cached text for reused keys.
				// New levels must use the content chosen by Add/Duplicate instead.
				card.text[entry.key].text=content;
			} else {
				delete definition.designLayerId; delete definition.editorDefaults;
				if(definition.visualFamilyId && range()?.visualFamilies?.[definition.visualFamilyId]){
					const id=uid('class-appearance');range().visualFamilies[id]=clone(range().visualFamilies[definition.visualFamilyId]);definition.visualFamilyId=id;
				}
				definition.name=entry.role==='banner'?'Level '+number+' Header':definition.name;
				if (definition.csvImageFieldKey) definition.csvImageFieldKey=customTemplateFieldKey(definition.name,'custom-image',card.frames.map(frame=>frame.csvImageFieldKey||''));
				ensureDesignLayerId(definition); entry.key=definition.designLayerId;
				card.frames.unshift(definition); await addFrame([],definition);
			}
			level.elements.push(entry);
		}
		return level;
	}
	function renumber(r) {
		r.modules.forEach((level,index) => {
			level.level=index+1;
			if (/^Level\s+\d+(?: Copy)*$/i.test(level.name)) level.name='Level '+level.level;
			level.elements.forEach(entry => {
				entry.role=role(entry); const item=target(entry); if (!item) return;
				if (entry.role==='title' && /^Level\s+\d+$/i.test(item.text||'')) item.text='Level '+level.level;
				if (entry.kind==='text' && ['title','cost','ability'].includes(entry.role)) {
					item.name=level.level+' - '+({title:'Name',cost:'Cost',ability:'Text'}[entry.role]);
					item.csvFieldLabel=item.name;
				}
				if(entry.role==='banner' && /^Level\s+\d+ Header$/.test(item.name||''))item.name='Level '+level.level+' Header';
			});
		});
	}
	function finish(before,label) {
		const r=range(); if(r)renumber(r);
		RulesRange.syncElements(); RulesRange.refresh();
		if (card.text && Object.keys(card.text).length) loadTextOptions(card.text,true);
		commitDesignUndoSnapshot(before,label); refresh(); RulesTextStyles.refreshModule(); drawCard();
	}
	async function add(duplicate=false) {
		const r=range(); if(!r || busy || r.modules.length>=4)return;
		initialize(r); busy=true; refresh();
		const before=createDesignStateSnapshot();
		try {
			const source=duplicate?selected():r.modules[r.modules.length-1];
			const design=duplicate&&source?captureDesign(source):source?.elements.some(entry=>role(entry)==='banner')?captureDesign(source):r.laterLevelDesign;
			if(!design)throw new Error('This layout needs a later-level design before another level can be added.');
			const number=r.modules.length+1, level=await construct(design,number,!duplicate);
			if(duplicate && source)r.modules.splice(r.modules.indexOf(source)+1,0,level);else r.modules.push(level);
			selectedId=level.id; finish(before,duplicate?'Duplicate Class level':'Add Class level');
		} catch(error) {
			await applyDesignStateSnapshot(before); report(error.message);
		} finally {busy=false; refresh();}
	}
	function remove(id=selected()?.id) {
		const r=range(),level=r?.modules.find(item=>item.id===id); if(!level || busy)return;
		if(r.modules.length===1){report('Keep one starting level in the Class area.');return;}
		const before=createDesignStateSnapshot(),index=r.modules.indexOf(level);
		r.modules.splice(index,1); RulesRange.removeOwnedElements([level]);
		selectedId=r.modules[Math.min(index,r.modules.length-1)]?.id||'';
		finish(before,'Remove Class level');
	}
	function move(delta) {
		const r=range(),level=selected(); if(!r||!level||busy)return;
		const index=r.modules.indexOf(level),next=index+delta;
		if(next<0||next>=r.modules.length)return;
		const before=createDesignStateSnapshot();r.modules.splice(index,1);r.modules.splice(next,0,level);finish(before,'Reorder Class levels');
	}
	function open(id=selected()?.id) {select(id);CanvasDesignTools.closeEditor(true);CanvasDesignTools.suspend();RulesTextStyles.openModule();}
	function contains(kind,key) {return !!range()?.modules.some(level=>level.elements.some(entry=>entry.kind===kind&&entry.key===key));}
	function attachCreatedElement(kind,key,bounds) {
		const r=range();if(!r)return false;
		const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
		const layout=RulesRange.getModuleLayouts(r).find(item=>x>=item.bounds.x&&x<=item.bounds.x+item.bounds.width&&y>=item.bounds.y&&y<=item.bounds.y+item.bounds.height);
		if(!layout)return false;
		layout.module.elements.push({kind,key,role:'extra',owned:true,offset:{x:(bounds.x-layout.bounds.x)*card.width,y:(bounds.y-layout.bounds.y)*card.height,width:bounds.width*card.width,height:bounds.height*card.height}});
		selectedId=layout.module.id;RulesRange.syncElements();refresh();return true;
	}
	function report(message) {const el=document.querySelector('#class-level-status');if(el)el.textContent=message;}
	function drawHighlights(r) {
		RulesRange.getModuleLayouts(r).forEach((layout,index) => {
			drawLayoutHighlightBox(layout.bounds,layout.module.id===selected()?.id?'#e5ceff':'#b784ff','Level '+(layout.module.level||index+1),{
				kind:'classLevel',key:layout.module.id,target:layout.bounds,deletable:r.modules.length>1
			});
		});
	}
	function hit(point,includeInterior=false) {
		const r=range();if(!r)return null;
		for(const area of layoutHighlightHitAreas.filter(area=>area.kind==='classLevel')){
			if(area.closeRectangle && pointInsideLayoutRectangle(point,area.closeRectangle))return {area,action:'delete'};
			if(pointInsideLayoutRectangle(point,area.labelRectangle))return {area,action:'select'};
			const level=r.modules.find(item=>item.id===area.key),banner=level?.elements.find(entry=>role(entry)==='banner');
			if(banner && pointInsideLayoutRectangle(point,previewLayoutBounds(target(banner).bounds)))return {area,action:'select'};
			const rect=area.rectangle,threshold=Math.max(7,previewCanvas.width/145);
			if(pointInsideLayoutRectangle(point,rect,threshold) &&
				Math.min(Math.abs(point.x-rect.x),Math.abs(point.x-rect.x-rect.width),Math.abs(point.y-rect.y),Math.abs(point.y-rect.y-rect.height))<threshold)return {area,action:'select'};
		}
		if(includeInterior)for(const level of r.modules)for(const entry of level.elements.slice().reverse()){
			if(entry.kind!=='text')continue;const item=target(entry),rectangle=item&&previewLayoutBounds(item);
			if(rectangle&&pointInsideLayoutRectangle(point,rectangle))return {area:{kind:'text',key:entry.key,target:item,rectangle},action:'open'};
		}
		return null;
	}
	function reloadImage(frame,source) {
		frame.src=source;frame.noThumb=true;
		const image=new Image();image.crossOrigin='anonymous';
		image.onload=()=>{drawFrames();RulesTextStyles.refreshModule();};
		image.onerror=()=>report('An appearance image could not load. Replace that image to repair it.');
		frame.image=image; image.src=fixUri(source);
		const row=Array.from(document.querySelector('#frame-list')?.children||[]).find(row=>row.dataset.designLayerId===frame.designLayerId);
		if(row?.querySelector('img'))row.querySelector('img').src=fixUri(source);
	}
	function family(frame) {return range()?.visualFamilies?.[frame.visualFamilyId];}
	function appearance(frame,key) {return family(frame)?.variants[key];}
	function frameAdded(frame) {
		const r=range(),key=frame.src.match(/\/class\/(?:nyx\/)?([wubrgmalc])\.png$/)?.[1];
		if(r&&key){frame.classBaseFrame=true;r.visualVariant=key;refresh();}
	}
	function restoreAppearance(frame,definition) {
		for(const key of ['visualFamilyId','fixedAppearance','imageFit','classRangeBanner','classBaseFrame']){
			if(definition[key]===undefined)delete frame[key];else frame[key]=definition[key];
		}
		if(definition.assetId)frame.assetId=definition.assetId;else delete frame.assetId;
		if(frame.src!==definition.src)reloadImage(frame,definition.src);
	}
	function applyVariant(key) {
		const r=range();if(!r||!variants[key])return;
		const before=createDesignStateSnapshot();r.visualVariant=key;let missing=0;
		for(const frame of card.frames){
			if(frame.fixedAppearance)continue;
			const custom=appearance(frame,key);
			if(custom){if(custom.assetId)frame.assetId=custom.assetId;else delete frame.assetId;reloadImage(frame,custom.src);continue;}
			if(frame.visualFamilyId){missing++;continue;}
			if(key!=='custom' && /\/img\/frames\/class\/(?:nyx\/)?[wubrgmalc]\.png$/.test(frame.src)){
				reloadImage(frame,frame.src.replace(/[wubrgmalc]\.png$/,key+'.png'));delete frame.assetId;
			}
		}
		commitDesignUndoSnapshot(before,'Change Class appearance');refresh();drawFrames();
		report(missing?missing+' element(s) kept their current image because this appearance is missing.':'Appearance changed; layout and content preserved.');
	}
	async function readFile(file) {
		if(!file || !file.type.startsWith('image/'))throw new Error('Choose an image file.');
		return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The image could not be read.'));reader.readAsDataURL(file);});
	}
	async function replace(frame,source) {
		if(!frame||!range())return;
		const before=createDesignStateSnapshot(),r=range();
		const sectionRole=window.FrameSectionTools?.role(frame);if(sectionRole)frame.componentKind=sectionRole==='title'?'Title':'Rules';
		delete frame.bossSymbolCleared;delete frame.bossSymbolOriginalSource;
		const id=uid('class-appearance');
		r.visualFamilies=r.visualFamilies||{};
		// A replacement creates an independent family for this element.
		r.visualFamilies[id]={variants:{[r.visualVariant||'w']:{src:source}}};
		frame.visualFamilyId=id;delete frame.assetId;reloadImage(frame,source);
		if(!CanvasDesignTools.editsFrame(frame))commitDesignUndoSnapshot(before,'Replace Class element image');refresh();RulesTextStyles.refreshModule();drawFrames();
	}
	async function addAppearance(frame,key,source) {
		if(!frame||!range()||!variants[key])return;
		const before=createDesignStateSnapshot(),r=range();
		if(!frame.visualFamilyId){
			frame.visualFamilyId=uid('class-appearance');
			r.visualFamilies=r.visualFamilies||{};
			r.visualFamilies[frame.visualFamilyId]={variants:{[r.visualVariant||'w']:{src:frame.src,...(frame.assetId?{assetId:frame.assetId}:{})}}};
		}
		family(frame).variants[key]={src:source};
		if(key===r.visualVariant&&!frame.fixedAppearance){delete frame.assetId;reloadImage(frame,source);}
		if(!CanvasDesignTools.editsFrame(frame))commitDesignUndoSnapshot(before,'Add Class element appearance');refresh();RulesTextStyles.refreshModule();
	}
	function mountImageControls(container,frame) {
		container.querySelector('#class-image-controls')?.remove();if(!range()||!frame)return;
		const panel=document.createElement('section');panel.id='class-image-controls';panel.className='wide class-image-controls';
		panel.innerHTML='<h3>Image</h3><label class="input">Replace image<input type="file" accept="image/*" data-image-replace></label><label>Fit<select class="input" data-image-fit><option value="stretch">Stretch</option><option value="fit">Fit</option><option value="fill">Fill</option></select></label><label><input type="checkbox" data-image-fixed> Keep this appearance when the theme changes</label><details><summary>Other appearances</summary><p>Add a color version of this same element.</p><select class="input" data-image-variant></select><label class="input">Add appearance<input type="file" accept="image/*" data-image-appearance></label><p data-image-available></p></details><details><summary>Replace from existing assets</summary><select class="input" data-image-existing></select><button class="input" type="button" data-image-use>Use selected image</button></details><p data-image-status role="status"></p>';
		container.appendChild(panel);
		const status=message=>panel.querySelector('[data-image-status]').textContent=message;
		panel.querySelector('[data-image-fit]').value=frame.imageFit||'stretch';
		panel.querySelector('[data-image-fit]').onchange=function(){frame.imageFit=this.value;drawFrames();RulesTextStyles.refreshModule();};
		panel.querySelector('[data-image-fixed]').checked=!!frame.fixedAppearance;
		panel.querySelector('[data-image-fixed]').onchange=function(){frame.fixedAppearance=this.checked;};
		const list=panel.querySelector('[data-image-variant]');
		for(const [key,label]of Object.entries(variants)){const option=document.createElement('option');option.value=key;option.textContent=label;list.appendChild(option);}list.value=range().visualVariant||'w';
		const available=()=>panel.querySelector('[data-image-available]').textContent='Available: '+Object.keys(family(frame)?.variants||{}).map(key=>variants[key]).join(', ');
		available();
		for(const [selector,action]of [['[data-image-replace]',source=>replace(frame,source)],['[data-image-appearance]',source=>addAppearance(frame,list.value,source)]]){
			panel.querySelector(selector).onchange=async function(){try{const source=await readFile(this.files[0]);await action(source);available();status('Image saved.');}catch(error){status(error.message);}this.value='';};
		}
		const existing=panel.querySelector('[data-image-existing]'),choices=[];
		card.frames.filter(item=>item!==frame).forEach(item=>choices.push({name:item.name,source:item.src}));
		(window.FrameProjectStore?.getAssets()||[]).filter(asset=>!['custom-symbol','mask','custom-set-symbol'].includes(asset.kind)).forEach(asset=>choices.push({name:asset.name,assetId:asset.id}));
		choices.forEach((item,index)=>{const option=document.createElement('option');option.value=index;option.textContent=item.name;existing.appendChild(option);});
		panel.querySelector('[data-image-use]').disabled=!choices.length;
		panel.querySelector('[data-image-use]').onclick=async()=>{try{
			const choice=choices[Number(existing.value)];let source=choice.assetId?await FrameProjectStore.getAssetSource(choice.assetId):choice.source;
			if(source.startsWith('blob:'))source=await readFile(new File([await (await fetch(source)).blob()],'image.png',{type:'image/png'}));
			await replace(frame,source);available();status('Image replaced.');
		}catch(error){status(error.message);}};
	}
	async function applyDesignToOthers(level) {
		const r=range();if(!r||busy||level===r.modules[0])return;
		busy=true;const before=createDesignStateSnapshot();
		try{
			const design=captureDesign(level);
			for(let index=1;index<r.modules.length;index++){
				const old=r.modules[index];if(old===level)continue;
				const contents={};old.elements.forEach(entry=>{if(entry.kind==='text'&&['title','cost','ability'].includes(role(entry)))contents[role(entry)]=target(entry)?.text||'';});
				const copy=await construct(design,index+1,true);copy.name=old.name;
				copy.elements.forEach(entry=>{if(entry.kind==='text'&&Object.hasOwn(contents,entry.role))target(entry).text=contents[entry.role];});
				r.modules[index]=copy;RulesRange.removeOwnedElements([old]);
			}
			finish(before,'Apply Class level design to other levels');
		}catch(error){await applyDesignStateSnapshot(before);report(error.message);}finally{busy=false;refresh();}
	}
	function refresh() {
		const panel=document.querySelector('#class-level-panel'),r=range();if(!panel)return;
		panel.hidden=!r;
		const generic=document.querySelector('#rules-range-list')?.closest('.readable-background');if(generic)generic.hidden=!!r;
		if(!r)return;
		r.kind='class';r.visualFamilies=r.visualFamilies||{};
		r.modules.forEach((level,index)=>{level.level=index+1;level.elements.forEach(entry=>{entry.role=role(entry);entry.owned=true;});});
		if(!r.laterLevelDesign&&r.modules[1])r.laterLevelDesign=captureDesign(r.modules[1]);
		const active=selected();selectedId=active?.id||'';
		panel.querySelector('#class-variant').value=r.visualVariant||'w';
		panel.querySelector('#class-auto-size').checked=!!r.autoSizeModules;panel.querySelector('#class-uniform-text').checked=!!r.uniformTextSize;
		panel.querySelector('#class-add-level').disabled=busy||r.modules.length>=4;
		const list=panel.querySelector('#class-level-list');list.replaceChildren();
		r.modules.forEach((level,index)=>{
			const section=document.createElement('details');section.className='class-level-row';section.open=level.id===selectedId;
			const summary=document.createElement('summary');summary.textContent='Level '+(index+1)+(level.name!=='Level '+(index+1)?' · '+level.name:'');section.appendChild(summary);
			summary.onclick=event=>{event.preventDefault();select(level.id);};
			const actions=document.createElement('div');actions.className='input-grid';section.appendChild(actions);
			for(const [label,action,disabled]of [['Edit level',()=>open(level.id),false],['Duplicate level',()=>{select(level.id);add(true);},r.modules.length>=4],['Remove level ×',()=>remove(level.id),r.modules.length===1],['Move up',()=>{select(level.id);move(-1);},index===0],['Move down',()=>{select(level.id);move(1);},index===r.modules.length-1]]){
				const button=document.createElement('button');button.type='button';button.className='input';button.textContent=label;button.disabled=busy||disabled;button.onclick=action;actions.appendChild(button);
			}
			for(const entry of level.elements){const item=target(entry);if(!item)continue;const button=document.createElement('button');button.type='button';button.className='input class-element-row';button.textContent=({banner:'Banner',cost:'Level-up cost',title:'Level title',ability:'Ability'}[role(entry)]||item.name);button.onclick=()=>{open(level.id);RulesTextStyles.selectModuleElement(entry.key);};section.appendChild(button);}
			list.appendChild(section);
		});
	}
	function mount() {
		const generic=document.querySelector('#rules-range-list')?.closest('.readable-background');if(!generic)return;
		const panel=document.createElement('section');panel.id='class-level-panel';panel.className='readable-background padding margin-bottom';panel.hidden=true;
		panel.innerHTML='<h3>Class levels</h3><p>Select a level on the canvas or below. Double-click its banner to edit its design.</p><label>Appearance<select id="class-variant" class="input"></select></label><div id="class-level-list"></div><button id="class-add-level" class="input" type="button">Add level</button><details><summary>Text fitting</summary><label><input id="class-auto-size" type="checkbox"> Fit level heights to text</label><label><input id="class-uniform-text" type="checkbox"> Keep text sizes uniform</label></details><details><summary>Advanced layout</summary><button id="class-range-editor" class="input" type="button">Edit Class area bounds</button><label class="input">Use a custom base frame<input id="class-base-image" type="file" accept="image/*"></label><p>Replaces the base texture while keeping its existing masks and layout.</p></details><p id="class-level-status" role="status"></p>';
		const destination=document.querySelector('#frame-design-class-slot');if(destination)destination.appendChild(panel);else generic.before(panel);
		for(const [key,label]of Object.entries(variants)){const option=document.createElement('option');option.value=key;option.textContent=label;panel.querySelector('#class-variant').appendChild(option);}
		panel.querySelector('#class-variant').onchange=function(){applyVariant(this.value);};
		panel.querySelector('#class-add-level').onclick=()=>add();
		panel.querySelector('#class-range-editor').onclick=()=>{const r=range();CanvasDesignTools.openEditor({kind:'rulesRange',key:r.id,target:r.bounds});};
		for(const id of ['class-auto-size','class-uniform-text'])panel.querySelector('#'+id).onchange=()=>{const r=range();if(!r)return;const before=createDesignStateSnapshot();r.autoSizeModules=panel.querySelector('#class-auto-size').checked;r.uniformTextSize=panel.querySelector('#class-uniform-text').checked;RulesRange.syncElements();commitDesignUndoSnapshot(before,'Change Class text fitting');refresh();};
		panel.querySelector('#class-base-image').onchange=async function(){try{
			const source=await readFile(this.files[0]),r=range(),before=createDesignStateSnapshot();
			const bases=card.frames.filter(frame=>frame.classBaseFrame||/\/img\/frames\/class\/(?:nyx\/)?[wubrgmalc]\.png$/.test(frame.src));
			if(!bases.length)throw new Error('Load a Class base frame first.');
			const id=uid('class-base');r.visualFamilies=r.visualFamilies||{};
			const appearances={custom:{src:source}};
			const original=bases.find(frame=>/\/class\/(?:nyx\/)?[wubrgmalc]\.png$/.test(frame.src));
			if(original)for(const key of Object.keys(variants).filter(key=>key!=='custom'))appearances[key]={src:original.src.replace(/[wubrgmalc]\.png$/,key+'.png')};
			r.visualFamilies[id]={variants:appearances};r.visualVariant='custom';
			for(const frame of bases){frame.classBaseFrame=true;frame.visualFamilyId=id;if(!frame.fixedAppearance){delete frame.assetId;reloadImage(frame,source);}}
			commitDesignUndoSnapshot(before,'Replace Class base appearance');refresh();drawFrames();
		}catch(error){report(error.message);}this.value='';};
		refresh();
	}
	window.ClassLevels={isRange,range,initialize,role,select,selected,open,add,remove,move,refresh,contains,drawHighlights,hit,applyVariant,replace,addAppearance,mountImageControls,restoreAppearance,applyDesignToOthers,frameAdded,attachCreatedElement};
	window.addEventListener('frameworkspacechanged',refresh);window.addEventListener('creatortabchanged',refresh);
	if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
