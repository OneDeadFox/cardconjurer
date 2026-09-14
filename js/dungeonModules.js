// Spatial room modules for the experimental dungeon frame. Coordinates are card-relative;
// the dungeon renderer converts them to the original AFR grid when drawing walls.
(function () {
	'use strict';
	var selectedId = '';
	var sample = [[0,0,16,2],[0,2,8,4],[8,2,8,4],[0,6,5,5],[5,6,6,5],[11,6,5,5],[0,11,8,4],[8,11,8,4],[0,15,16,4]];
	function grid() { return {cell: card.height * .0381, x:card.width * .0734, y:card.height * .1377}; }
	function fromGrid(x,y,w,h) { var g=grid(); return {x:(g.x+x*g.cell)/card.width,y:(g.y+y*g.cell)/card.height,width:w*g.cell/card.width,height:h*g.cell/card.height}; }
	function toGrid(bounds) { var g=grid(); return {x:Math.round((bounds.x*card.width-g.x)/g.cell),y:Math.round((bounds.y*card.height-g.y)/g.cell),w:Math.max(2,Math.round(bounds.width*card.width/g.cell)),h:Math.max(2,Math.round(bounds.height*card.height/g.cell))}; }
	function modules() { return card.dungeonModules = Array.isArray(card.dungeonModules)?card.dungeonModules:[]; }
	function selected() { return modules().find(function(room){return room.id===selectedId;}) || modules()[0] || null; }
	function id() { return 'dungeon-room-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); }
	function snapshot() { return typeof createDesignStateSnapshot==='function'?createDesignStateSnapshot():null; }
	function commit(before,label) { if (before && typeof commitDesignUndoSnapshot==='function') commitDesignUndoSnapshot(before,label); }
	function field(room) { return card.text?.[room.textKey]; }
	function addRoom(bounds,name,text) {
		var key='dungeonRoomModule'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
		var room={id:id(),name:name||'Room '+(modules().length+1),bounds:bounds,textKey:key};
		modules().push(room);selectedId=room.id;
		var definition={};definition[key]={name:room.name,text:text||room.name+'{lns}{fontmplantin}{fontsize-8}Effect.',x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,font:'belerenb',size:.0324,align:'center',customField:true};
		loadTextOptions(definition,false);
		syncRoom(room);
		return room;
	}
	function initialize() {
		card.dungeonModules=[];
		sample.forEach(function(values){addRoom(fromGrid.apply(null,values));});
		selectedId=modules()[0]?.id||'';
	}
	function syncRoom(room) {
		var box=room.bounds, text=field(room);
		if (!text) return;
		var g=grid(),insetX=g.cell*.5/card.width,insetY=g.cell*.5/card.height;
		text.x=box.x+insetX;text.y=box.y+insetY;
		text.width=Math.max(g.cell/card.width,box.width-2*insetX);
		text.height=Math.max(g.cell/card.height,box.height-2*insetY);
	}
	function syncAll() { modules().forEach(syncRoom);if(typeof drawTextBuffer==='function')drawTextBuffer(); }
	function snapRoom(room) {
		var p=toGrid(room.bounds);
		p.w=Math.min(p.w,16);p.h=Math.min(p.h,18);
		p.x=Math.max(0,Math.min(16-p.w,p.x));p.y=Math.max(0,Math.min(18-p.h,p.y));
		Object.assign(room.bounds,fromGrid(p.x,p.y,p.w,p.h));
		syncRoom(room);
	}
	// Exactly one centered opening on each nonzero shared segment; corner contact is ignored.
	function doorways(list) {
		var output=[],epsilon=.00001;
		for(var i=0;i<list.length;i++)for(var j=i+1;j<list.length;j++) {
			var a=toGrid(list[i].bounds),b=toGrid(list[j].bounds);
			var overlapX=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
			var overlapY=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
			if(overlapX>epsilon && (a.y+a.h===b.y || b.y+b.h===a.y)) output.push({axis:'horizontal',x:Math.max(a.x,b.x)+overlapX/2,y:a.y+a.h===b.y?b.y:a.y});
			if(overlapY>epsilon && (a.x+a.w===b.x || b.x+b.w===a.x)) output.push({axis:'vertical',x:a.x+a.w===b.x?b.x:a.x,y:Math.max(a.y,b.y)+overlapY/2});
		}
		return output;
	}
	function render() { if(card.version!=='dungeonModules')return;syncAll();if(typeof dungeonEdited==='function')dungeonEdited(); refresh(); }
	function refresh() {
		var panel=document.querySelector('#dungeon-modules-panel');if(!panel || card.version!=='dungeonModules')return;
		var list=panel.querySelector('#dungeon-module-list');if(!list)return;
		list.replaceChildren();modules().forEach(function(room){var option=document.createElement('option');option.value=room.id;option.textContent=room.name;list.appendChild(option);});
		var room=selected();if(room)selectedId=room.id;
		list.value=selectedId;
		var p=room?toGrid(room.bounds):null;
		panel.querySelector('#dungeon-module-name').value=room?.name||'';
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).value=p?.[axis]??'';});
	}
	function mount() {
		var tab=document.querySelector('#creator-menu-dungeon');if(!tab)return;
		var input=tab.querySelector('#dungeon-input');if(input)input.closest('.readable-background')?.classList.add('hidden');
		var existing=tab.querySelector('#dungeon-modules-panel');
		if(card.version!=='dungeonModules') {
			if(input)input.closest('.readable-background')?.classList.remove('hidden');
			if(existing)existing.hidden=true;
			return;
		}
		if(existing){existing.hidden=false;refresh();return;}
		var panel=document.createElement('div');panel.id='dungeon-modules-panel';panel.className='readable-background padding margin-bottom';
		panel.innerHTML='<h4>Room modules (prototype)</h4><p>Select a room here or drag its outline in Frame Design. Doorways appear at the midpoint of a shared wall.</p><select id="dungeon-module-list" class="input" size="7"></select><label>Name <input id="dungeon-module-name" class="input"></label><div class="dungeon-module-coordinates"><label>X <input type="number" id="dungeon-module-x" class="input"></label><label>Y <input type="number" id="dungeon-module-y" class="input"></label><label>Width <input type="number" min="2" id="dungeon-module-w" class="input"></label><label>Height <input type="number" min="2" id="dungeon-module-h" class="input"></label></div><button type="button" id="dungeon-module-add">Add room</button> <button type="button" id="dungeon-module-copy">Duplicate room</button> <button type="button" id="dungeon-module-remove">Delete room</button>';
		tab.prepend(panel);
		panel.querySelector('#dungeon-module-list').onchange=function(event){selectedId=event.target.value;refresh();drawCard();};
		panel.querySelector('#dungeon-module-name').onchange=function(event){var room=selected();if(!room)return;var before=snapshot();room.name=event.target.value.trim()||room.name;if(field(room))field(room).name=room.name;refresh();drawCard();commit(before,'Rename dungeon room');};
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).onchange=function(){var room=selected();if(!room)return;var before=snapshot(),p=toGrid(room.bounds),value=Number(this.value);if(Number.isFinite(value))p[axis]=Math.round(value);Object.assign(room.bounds,fromGrid(p.x,p.y,p.w,p.h));snapRoom(room);render();commit(before,'Edit dungeon room');};});
		panel.querySelector('#dungeon-module-add').onclick=function(){var before=snapshot(),source=selected(),p=source?toGrid(source.bounds):{x:0,y:0,w:5,h:4};addRoom(fromGrid(Math.min(16-p.w,p.x),Math.min(18-p.h,p.y+p.h),p.w,p.h));render();commit(before,'Add dungeon room');};
		panel.querySelector('#dungeon-module-copy').onclick=function(){var source=selected();if(!source)return;var before=snapshot(),p=toGrid(source.bounds),copy=addRoom(fromGrid(Math.min(16-p.w,p.x+p.w),p.y,p.w,p.h),source.name+' Copy',field(source)?.text);var text=field(copy),original=field(source);if(text&&original){Object.assign(text,JSON.parse(JSON.stringify(original)));text.name=copy.name;syncRoom(copy);}render();commit(before,'Duplicate dungeon room');};
		panel.querySelector('#dungeon-module-remove').onclick=function(){var room=selected();if(!room)return;remove(room.id);};
		refresh();
	}
	function remove(roomId) { var before=snapshot(),index=modules().findIndex(function(room){return room.id===roomId;});if(index<0)return;var room=modules().splice(index,1)[0];delete card.text[room.textKey];selectedId=modules()[Math.min(index,modules().length-1)]?.id||'';loadTextOptions(card.text,true);render();commit(before,'Delete dungeon room'); }
	window.DungeonModules={initialize:initialize,mount:mount,render:render,refresh:refresh,modules:modules,selected:selected,select:function(roomId){selectedId=roomId;refresh();},remove:remove,snapRoom:snapRoom,syncRoom:syncRoom,doorways:doorways,toGrid:toGrid,grid:grid};
})();
