// Spatial room modules for the experimental dungeon frame. Bounds are continuous card-relative
// coordinates; the original AFR cell dimensions are only used to seed the sample arrangement.
(function () {
	'use strict';
	var selectedId = '';
	var sample = [[0,0,16,2],[0,2,8,4],[8,2,8,4],[0,6,5,5],[5,6,6,5],[11,6,5,5],[0,11,8,4],[8,11,8,4],[0,15,16,4]];
	function grid() { return {cell: card.height * .0381, x:card.width * .0734, y:card.height * .1377}; }
	function fromGrid(x,y,w,h) { var g=grid(); return {x:(g.x+x*g.cell)/card.width,y:(g.y+y*g.cell)/card.height,width:w*g.cell/card.width,height:h*g.cell/card.height}; }
	function toGrid(bounds) { var g=grid(); return {x:(bounds.x*card.width-g.x)/g.cell,y:(bounds.y*card.height-g.y)/g.cell,w:bounds.width*card.width/g.cell,h:bounds.height*card.height/g.cell}; }
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
		card.dungeonLayoutLocked=false;
		card.dungeonWallTexture='';
		card.dungeonWallColor='B';card.dungeonPadding=null;
		card.dungeonAutoFit=false;card.dungeonAutoFitBounds=null;card.dungeonHeightLock=null;
		sample.forEach(function(values){addRoom(fromGrid.apply(null,values));});
		selectedId=modules()[0]?.id||'';
	}
	function roomPadding(room) {
		var box=room.bounds,explicit=Number.isFinite(room.padding)?room.padding:card.dungeonPadding;
		var value=Number.isFinite(explicit)?Math.max(0,explicit):grid().cell*.5;
		return {x:Math.min(value,Number.isFinite(explicit)?Math.max(0,(box.width*card.width-10)/2):box.width*card.width*.12),
			y:Math.min(value,Number.isFinite(explicit)?Math.max(0,(box.height*card.height-10)/2):box.height*card.height*.12),value:value,explicit:Number.isFinite(explicit)};
	}
	function setPadding(value,all) {
		value=Math.max(0,Number(value)||0);var room=selected();if(!all&&!room)return;
		var before=snapshot();if(all){card.dungeonPadding=value;modules().forEach(function(r){delete r.padding;});}else room.padding=value;
		render();commit(before,all?'Set padding for all dungeon rooms':'Set room padding');
	}
	function syncRoom(room) {
		var box=room.bounds,text=field(room);if(!text)return;var pad=roomPadding(room);
		text.x=box.x+pad.x/card.width;text.y=box.y+pad.y/card.height;
		text.width=Math.max(10/card.width,box.width-2*pad.x/card.width);
		text.height=Math.max(10/card.height,box.height-2*pad.y/card.height);
	}
	function syncAll() { modules().forEach(syncRoom);if(typeof drawTextBuffer==='function')drawTextBuffer(); }
	function currentEnvelope() {
		var list=modules();return list.length?{top:Math.min(...list.map(room=>room.bounds.y)),bottom:Math.max(...list.map(room=>room.bounds.y+room.bounds.height))}:null;
	}
	function rememberRoomHeight(room) {
		if(!room.autoFitOriginalBounds)room.autoFitOriginalBounds={y:room.bounds.y,height:room.bounds.height};
	}
	function setHeightLock(enabled) {
		var before=snapshot();card.dungeonHeightLock=enabled?currentEnvelope():null;
		render();commit(before,'Toggle dungeon height lock');
	}
	function setRoomLock(enabled) {
		var room=selected();if(!room)return;var before=snapshot();
		room.geometryLocked=!!enabled;
		if(enabled)room.lockedBounds=JSON.parse(JSON.stringify(room.bounds));else delete room.lockedBounds;
		render();commit(before,'Toggle room position and size lock');
	}
	function setAutoFit(enabled) {
		enabled=!!enabled;if(enabled===!!card.dungeonAutoFit)return;
		var before=snapshot();card.dungeonAutoFit=enabled;
		if(enabled){
			modules().forEach(rememberRoomHeight);
			card.dungeonAutoFitBounds=currentEnvelope();
		}else{
			modules().forEach(function(room){
				if(room.autoFitOriginalBounds){if(!room.geometryLocked)Object.assign(room.bounds,room.autoFitOriginalBounds);delete room.autoFitOriginalBounds;}
				var text=field(room);if(text&&room.autoFitFont){text.rangeFontReduction=room.autoFitFont.reduction;text.rangeUniformTextSize=room.autoFitFont.uniform;}delete room.autoFitFont;
			});
			card.dungeonAutoFitBounds=null;card.dungeonAutoFitOverflow=false;
		}
		render();commit(before,'Toggle dungeon text fitting');
	}
	function reflow() {
		if(card.version!=='dungeonModules'||!card.dungeonAutoFit||!modules().length||!window.RulesRange?.measureModuleText)return false;
		var list=modules(),height=card.height,levels=[];
		list.forEach(function(room){if(room.geometryLocked&&room.lockedBounds)Object.assign(room.bounds,room.lockedBounds);rememberRoomHeight(room);});
		list.forEach(function(room){levels.push(room.bounds.y*height,(room.bounds.y+room.bounds.height)*height);});
		levels.sort(function(a,b){return a-b;});levels=levels.filter(function(value,i){return !i||value-levels[i-1]>.001;});
		var envelope=card.dungeonHeightLock||card.dungeonAutoFitBounds||(card.dungeonAutoFitBounds={top:levels[0]/height,bottom:levels[levels.length-1]/height});
		var available=Math.max(1,(envelope.bottom-envelope.top)*height),common=Infinity;
		function index(value){return levels.findIndex(function(level){return Math.abs(level-value)<.001;});}
		var records=list.map(function(room){var text=field(room),box=room.bounds,base=text?((Number(text.size)||.038)*height+(parseInt(text.fontSize||'0',10)||0)):0;
			if(text){common=Math.min(common,Math.max(1,base));if(!room.autoFitFont)room.autoFitFont={reduction:Number(text.rangeFontReduction)||0,uniform:!!text.rangeUniformTextSize};}
			return {room:room,text:text,base:base,start:index(box.y*height),end:index((box.y+box.height)*height)};
		});
		if(!Number.isFinite(common))common=.0324*height;
		function solve(reduction){
			var padding=grid().cell*.5;
			records.forEach(function(record){var box=record.room.bounds,pad=roomPadding(record.room),inset=pad.x,width=Math.max(10,box.width*card.width-2*inset);
				var measured=record.text?RulesRange.measureModuleText(record.text,width,record.base-common+reduction):0;
				record.minimum=Math.max(20,(pad.explicit?measured+2*pad.value:Math.min(measured/.76,measured+2*padding)));
			});
			var positions=[0];
			for(var i=1;i<levels.length;i++){
				var occupied=records.some(function(record){return record.start<i&&record.end>=i;});
				positions[i]=positions[i-1]+(occupied?1:levels[i]-levels[i-1]);
				records.forEach(function(record){if(record.end===i)positions[i]=Math.max(positions[i],positions[record.start]+record.minimum);});
			}
			return positions;
		}
		var hasLocks=records.some(function(r){return r.room.geometryLocked;});
		function constrain(raw) {
			if(!hasLocks){if(card.dungeonHeightLock){var total=raw[raw.length-1];if(total>0)return raw.map(function(p){return p*available/total;});}return raw;}
			// Fixed row boundaries preserve shared walls alongside locked rooms.
			var pins=new Map([[0,0]]);
			if(card.dungeonHeightLock)pins.set(levels.length-1,available);
			records.forEach(function(r){if(r.room.geometryLocked){pins.set(r.start,levels[r.start]-envelope.top*height);pins.set(r.end,levels[r.end]-envelope.top*height);}});
			var anchors=Array.from(pins.entries()).sort(function(a,b){return a[0]-b[0];}),output=raw.slice();
			for(var a=0;a<anchors.length-1;a++){var left=anchors[a],right=anchors[a+1],span=raw[right[0]]-raw[left[0]];
				for(var i=left[0];i<=right[0];i++)output[i]=left[1]+(right[1]-left[1])*(span>0?(raw[i]-raw[left[0]])/span:(i-left[0])/(right[0]-left[0]));
			}
			var last=anchors[anchors.length-1];for(var i=last[0];i<raw.length;i++)output[i]=last[1]+raw[i]-raw[last[0]];
			return output;
		}
		function overflow(raw,positions){return raw[raw.length-1]>available+.01&&!hasLocks || positions[positions.length-1]>available+.01 || records.some(function(r){return positions[r.end]-positions[r.start]<r.minimum-.01;});}
		var reduction=0,raw=solve(0),positions=constrain(raw),limit=Math.min(25,Math.max(0,Math.floor(common-1)));
		while(overflow(raw,positions)&&reduction<limit){raw=solve(++reduction);positions=constrain(raw);}
		card.dungeonAutoFitOverflow=overflow(raw,positions);
		var changed=false;
		records.forEach(function(record){var box=record.room.bounds,y=envelope.top+positions[record.start]/height,h=(positions[record.end]-positions[record.start])/height;
			if(!record.room.geometryLocked&&(Math.abs(box.y-y)>1e-8||Math.abs(box.height-h)>1e-8))changed=true;
			if(!record.room.geometryLocked){box.y=y;box.height=h;}
			if(record.text){var adjustment=record.base-common+reduction;if(record.text.rangeFontReduction!==adjustment||!record.text.rangeUniformTextSize)changed=true;record.text.rangeFontReduction=adjustment;record.text.rangeUniformTextSize=true;}
			syncRoom(record.room);
		});
		return changed;
	}
	function snapRoom(room,action) {
		if(room.geometryLocked){if(room.lockedBounds)Object.assign(room.bounds,room.lockedBounds);return;}
		var box=room.bounds,threshold=8,move=action==='move',left=action?.includes('left')||move,right=action?.includes('right')||move,top=action?.includes('top')||move,bottom=action?.includes('bottom')||move;
		var px={x:box.x*card.width,y:box.y*card.height,w:box.width*card.width,h:box.height*card.height};
		modules().forEach(function(other){if(other===room)return;var peer={x:other.bounds.x*card.width,y:other.bounds.y*card.height,w:other.bounds.width*card.width,h:other.bounds.height*card.height};
			if(Math.min(px.y+px.h,peer.y+peer.h)-Math.max(px.y,peer.y)>1){
				if(right&&Math.abs(px.x+px.w-peer.x)<threshold){if(move)px.x=peer.x-px.w;else px.w=peer.x-px.x;}
				else if(left&&Math.abs(px.x-(peer.x+peer.w))<threshold){var edge=peer.x+peer.w;if(!move)px.w+=px.x-edge;px.x=edge;}
			}
			if(Math.min(px.x+px.w,peer.x+peer.w)-Math.max(px.x,peer.x)>1){
				if(bottom&&Math.abs(px.y+px.h-peer.y)<threshold){if(move)px.y=peer.y-px.h;else px.h=peer.y-px.y;}
				else if(top&&Math.abs(px.y-(peer.y+peer.h))<threshold){var edge=peer.y+peer.h;if(!move)px.h+=px.y-edge;px.y=edge;}
			}
		});
		px.w=Math.max(20,Math.min(card.width,px.w));px.h=Math.max(20,Math.min(card.height,px.h));
		px.x=Math.max(0,Math.min(card.width-px.w,px.x));px.y=Math.max(0,Math.min(card.height-px.h,px.y));
		Object.assign(box,{x:px.x/card.width,y:px.y/card.height,width:px.w/card.width,height:px.h/card.height});
		syncRoom(room);
	}
	// Only rooms above/below each other connect; side walls remain solid.
	function doorways(list) {
		var output=[],epsilon=.0000001;
		for(var i=0;i<list.length;i++)for(var j=i+1;j<list.length;j++) {
			var a=list[i].bounds,b=list[j].bounds,overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
			if(overlapX>epsilon && (Math.abs(a.y+a.height-b.y)<epsilon || Math.abs(b.y+b.height-a.y)<epsilon))output.push({axis:'horizontal',x:Math.max(a.x,b.x)+overlapX/2,y:Math.abs(a.y+a.height-b.y)<epsilon?b.y:a.y,span:overlapX});
		}
		return output;
	}
	// Merge coincident room sides before cutting doors. Sprite tiles have different internal
	// offsets for opposite walls, so positioning one sprite per room produces doubled dividers.
	function wallSegments(list) {
		var groups=[],epsilon=.001;
		function add(axis,position,start,end) {
			var group=groups.find(function(item){return item.axis===axis&&Math.abs(item.position-position)<epsilon;});
			if(!group){group={axis:axis,position:position,intervals:[]};groups.push(group);}
			group.intervals.push([start,end]);
		}
		list.forEach(function(room){var b=room.bounds,x=b.x*card.width,y=b.y*card.height,w=b.width*card.width,h=b.height*card.height;
			add('horizontal',y,x,x+w);add('horizontal',y+h,x,x+w);
			add('vertical',x,y,y+h);add('vertical',x+w,y,y+h);
		});
		var doors=doorways(list),segments=[];
		groups.forEach(function(group){
			var merged=[];group.intervals.sort(function(a,b){return a[0]-b[0];}).forEach(function(interval){var last=merged[merged.length-1];if(last&&interval[0]<=last[1]+epsilon)last[1]=Math.max(last[1],interval[1]);else merged.push(interval.slice());});
			doors.forEach(function(door){if(door.axis!==group.axis)return;var horizontal=door.axis==='horizontal',position=horizontal?door.y*card.height:door.x*card.width;if(Math.abs(position-group.position)>epsilon)return;
				var center=horizontal?door.x*card.width:door.y*card.height,span=door.span*(horizontal?card.width:card.height),half=Math.min(card.height*.0381,span*.5)/2;
				var start=center-half,end=center+half,next=[];
				merged.forEach(function(interval){if(end<=interval[0]||start>=interval[1])next.push(interval);else{if(start>interval[0])next.push([interval[0],start]);if(end<interval[1])next.push([end,interval[1]]);}});merged=next;
			});
			merged.forEach(function(interval){if(interval[1]-interval[0]>epsilon)segments.push({axis:group.axis,position:group.position,start:interval[0],end:interval[1]});});
		});
		return segments;
	}
	function drawWalls(mask,fx) {
		var segments=wallSegments(modules()),thickness=Math.max(3,card.height*.006);
		var edges=segments.map(function(segment){return segment.axis==='horizontal'?[[segment.start,segment.position],[segment.end,segment.position]]:[[segment.position,segment.start],[segment.position,segment.end]];});
		function same(a,b){return Math.abs(a[0]-b[0])<.001&&Math.abs(a[1]-b[1])<.001;}
		// Join touching endpoints into polylines so miter joins fill the outer corner.
		// Door ends have no touching neighbor and retain their original butt caps.
		var used=new Set(),paths=[];
		edges.forEach(function(edge,index){if(used.has(index))return;used.add(index);var points=edge.slice();
			function extend(front){while(true){var tip=front?points[0]:points[points.length-1],neighbors=[];
				edges.forEach(function(other,i){if(same(tip,other[0])||same(tip,other[1]))neighbors.push(i);});
				if(neighbors.length!==2)break;
				var next=neighbors.find(function(i){return !used.has(i);});if(next===undefined)break;
				used.add(next);var other=edges[next],point=same(tip,other[0])?other[1]:other[0];if(front)points.unshift(point);else points.push(point);
			}}
			extend(false);extend(true);paths.push(points);
		});
		var cornerModel=window.DungeonCorners?.geometry(segments);
		function path(context){if(cornerModel){DungeonCorners.trace(context,cornerModel);return;}context.beginPath();paths.forEach(function(points){context.moveTo(points[0][0],points[0][1]);for(var i=1;i<points.length;i++)context.lineTo(points[i][0],points[i][1]);if(same(points[0],points[points.length-1]))context.closePath();});}
		// A single path prevents repeated shading at shared boundaries and junctions.
		mask.save();fx.save();
		var marginX=scaleX(0),marginY=scaleY(0);
		mask.translate(marginX,marginY);fx.translate(marginX,marginY);
		mask.lineCap=fx.lineCap='butt';mask.lineJoin=fx.lineJoin='miter';
		path(mask);mask.strokeStyle='#fff';mask.lineWidth=thickness;mask.stroke();
		// Keep outlines only where they face a room. The union includes both sides of
		// shared walls, but excludes the outward side of each exterior boundary.
		fx.save();if(cornerModel){DungeonCorners.clipRooms(fx,cornerModel);}else{fx.beginPath();
		modules().forEach(function(room){var b=room.bounds;fx.rect(b.x*card.width,b.y*card.height,b.width*card.width,b.height*card.height);});
		fx.clip();}
		path(fx);fx.strokeStyle='rgba(0,0,0,.55)';fx.lineWidth=thickness+3;fx.stroke();
		// Clear the interior completely; reusing the translucent outline color leaves a dark tint.
		fx.globalCompositeOperation='destination-out';fx.strokeStyle='#fff';fx.lineWidth=Math.max(1,thickness-2);fx.stroke();
		fx.globalCompositeOperation='source-over';
		fx.restore();
		// Door markers stay white above the wall texture and point down on either wall axis.
		doorways(modules()).forEach(function(door){
			var x=door.x*card.width,y=door.y*card.height;
			var opening=Math.min(card.height*.0381,door.span*(door.axis==='horizontal'?card.width:card.height)*.5);
			var width=Math.min(thickness*1.5,opening*.65),height=width*.8;
			fx.beginPath();fx.moveTo(x-width/2,y-height/2);fx.lineTo(x+width/2,y-height/2);fx.lineTo(x,y+height/2);fx.closePath();
			fx.fillStyle='#fff';fx.fill();fx.strokeStyle='rgba(0,0,0,.65)';fx.lineWidth=Math.min(1.5,width*.08);fx.stroke();
		});
		fx.restore();mask.restore();
	}
	function render() { if(card.version!=='dungeonModules')return;reflow();syncAll();if(typeof dungeonEdited==='function')dungeonEdited(); refresh(); }
	function refresh() {
		window.DungeonCorners?.refreshEditor();
		var panel=document.querySelector('#dungeon-modules-panel');if(!panel || card.version!=='dungeonModules')return;
		var layoutLock=panel.querySelector('#dungeon-layout-lock');if(layoutLock)layoutLock.checked=!!card.dungeonLayoutLocked;
		var lock=panel.querySelector('#dungeon-module-height-lock');if(lock)lock.checked=!!card.dungeonHeightLock;
		var lockInfo=panel.querySelector('#dungeon-module-height-info');if(lockInfo)lockInfo.textContent=card.dungeonHeightLock?'Locked height: '+Math.round((card.dungeonHeightLock.bottom-card.dungeonHeightLock.top)*card.height)+' px.':'Lock the current total height before auto-fitting to redistribute space within it.';
		var fit=panel.querySelector('#dungeon-module-auto-fit');if(fit)fit.checked=!!card.dungeonAutoFit;
		var fitStatus=panel.querySelector('#dungeon-module-fit-status');if(fitStatus)fitStatus.textContent=card.dungeonAutoFit?(card.dungeonAutoFitOverflow?'Text exceeds the available height at the minimum shared font size. Shorten text, reduce padding, or unlock and enlarge rooms.':(card.dungeonHeightLock?'Room heights are distributed within the locked total height.':'Room heights follow text; turn off Auto-fit to restore the previous heights.')):'';
		var list=panel.querySelector('#dungeon-module-list');if(!list)return;
		list.replaceChildren();modules().forEach(function(room){var option=document.createElement('option');option.value=room.id;option.textContent=room.name+(room.geometryLocked?' (locked)':'');list.appendChild(option);});
		var room=selected();if(room)selectedId=room.id;
		list.value=selectedId;
		var p=room?{x:room.bounds.x*card.width,y:room.bounds.y*card.height,w:room.bounds.width*card.width,h:room.bounds.height*card.height}:null;
		panel.querySelector('#dungeon-module-name').value=room?.name||'';
		panel.querySelector('#dungeon-room-lock').checked=!!room?.geometryLocked;
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).disabled=!!room?.geometryLocked;});
		panel.querySelector('#dungeon-room-padding').value=room?Math.round(roomPadding(room).value*10)/10:0;
		panel.querySelector('#dungeon-all-padding').value=Number.isFinite(card.dungeonPadding)?card.dungeonPadding:Math.round(grid().cell*5)/10;
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).value=p?Math.round(p[axis]*10)/10:'';});
		var color=document.querySelector('#dungeon-color');if(color){var custom=color.querySelector('[value="custom"]');if(!custom){custom=document.createElement('option');custom.value='custom';custom.textContent='Custom texture';color.appendChild(custom);}custom.disabled=!card.dungeonWallTexture;color.value=card.dungeonWallColor==='custom'&&card.dungeonWallTexture?'custom':(card.dungeonWallColor||'B');}
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
		var color=document.querySelector('#dungeon-color');
		if(color&&!color.dataset.moduleColorReady){color.dataset.moduleColorReady='true';color.addEventListener('change',function(){if(card.version==='dungeonModules')card.dungeonWallColor=color.value;});}
		if(existing){existing.hidden=false;refresh();return;}
		var panel=document.createElement('div');panel.id='dungeon-modules-panel';panel.className='readable-background padding margin-bottom';
		panel.innerHTML='<h4>Room modules (prototype)</h4><p>Rooms have free-form dimensions in card pixels. Drag in Frame Design; nearby walls snap together. Only upper and lower shared walls gain a doorway.</p><label><input type="checkbox" id="dungeon-layout-lock"> Lock dungeon layout</label><p>Prevents loading a replacement frame layout. Adding frame elements always keeps the dungeon.</p><label><input type="checkbox" id="dungeon-module-height-lock"> Lock overall dungeon height</label><p id="dungeon-module-height-info"></p><label><input type="checkbox" id="dungeon-module-auto-fit"> Auto-fit room heights and use a uniform text size</label><p id="dungeon-module-fit-status"></p><select id="dungeon-module-list" class="input" size="7"></select><label>Name <input id="dungeon-module-name" class="input"></label><label><input type="checkbox" id="dungeon-room-lock"> Lock selected room position and size</label><label>Selected room padding (px)<input id="dungeon-room-padding" type="number" min="0" step="1" class="input"></label><label>All-room padding (px)<input id="dungeon-all-padding" type="number" min="0" step="1" class="input"></label><button id="dungeon-apply-padding" type="button">Apply padding to all rooms</button><div class="dungeon-module-coordinates"><label>X (px) <input type="number" step="0.1" id="dungeon-module-x" class="input"></label><label>Y (px) <input type="number" step="0.1" id="dungeon-module-y" class="input"></label><label>Width (px) <input type="number" step="0.1" min="20" id="dungeon-module-w" class="input"></label><label>Height (px) <input type="number" step="0.1" min="20" id="dungeon-module-h" class="input"></label></div><button type="button" id="dungeon-module-add">Add room</button> <button type="button" id="dungeon-module-copy">Duplicate room</button> <button type="button" id="dungeon-module-remove">Delete room</button><hr><label>Wall texture <input type="file" id="dungeon-module-texture" accept="image/*" class="input"></label><button type="button" id="dungeon-module-texture-clear">Remove uploaded texture</button><p>Upload a full-card image; its colors fill the walls while the wall outlines stay on top. Large images can exceed browser save storage.</p>';
		tab.prepend(panel);
		panel.querySelector('#dungeon-room-lock').onchange=function(){setRoomLock(this.checked);};
		panel.querySelector('#dungeon-room-padding').onchange=function(){setPadding(this.value,false);};
		panel.querySelector('#dungeon-apply-padding').onclick=function(){setPadding(panel.querySelector('#dungeon-all-padding').value,true);};
		panel.querySelector('#dungeon-layout-lock').onchange=function(){var before=snapshot();card.dungeonLayoutLocked=this.checked;commit(before,'Toggle dungeon layout lock');};
		panel.querySelector('#dungeon-module-height-lock').onchange=function(){setHeightLock(this.checked);};
		panel.querySelector('#dungeon-module-auto-fit').onchange=function(){setAutoFit(this.checked);};
		panel.querySelector('#dungeon-module-list').onchange=function(event){selectedId=event.target.value;refresh();drawCard();};
		panel.querySelector('#dungeon-module-name').onchange=function(event){var room=selected();if(!room)return;var before=snapshot();room.name=event.target.value.trim()||room.name;if(field(room))field(room).name=room.name;refresh();drawCard();commit(before,'Rename dungeon room');};
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).onchange=function(){var room=selected();if(!room||room.geometryLocked)return;var before=snapshot(),value=Number(this.value);if(Number.isFinite(value)){var key={x:'x',y:'y',w:'width',h:'height'}[axis],dimension=axis==='x'||axis==='w'?card.width:card.height;room.bounds[key]=value/dimension;}snapRoom(room,axis==='w'?'right':axis==='h'?'bottom':'move');render();commit(before,'Edit dungeon room');};});
		panel.querySelector('#dungeon-module-add').onclick=function(){var before=snapshot(),source=selected(),box=source?.bounds||{x:.1,y:.15,width:.3,height:.2};var newBox={x:box.x,y:Math.min(1-box.height,box.y+box.height),width:box.width,height:box.height};addRoom(newBox);render();commit(before,'Add dungeon room');};
		panel.querySelector('#dungeon-module-copy').onclick=function(){var source=selected();if(!source)return;var before=snapshot(),box=source.bounds,copy=addRoom({x:Math.min(1-box.width,box.x+box.width),y:box.y,width:box.width,height:box.height},source.name+' Copy',field(source)?.text);if(Number.isFinite(source.padding))copy.padding=source.padding;copy.cornerStyles=JSON.parse(JSON.stringify(source.cornerStyles||{}));var text=field(copy),original=field(source);if(text&&original){Object.assign(text,JSON.parse(JSON.stringify(original)));text.name=copy.name;if(source.autoFitFont)copy.autoFitFont=JSON.parse(JSON.stringify(source.autoFitFont));syncRoom(copy);}render();commit(before,'Duplicate dungeon room');};
		panel.querySelector('#dungeon-module-remove').onclick=function(){var room=selected();if(!room)return;remove(room.id);};
		panel.querySelector('#dungeon-module-texture').onchange=function(){var file=this.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){alert('Please upload an image file.');return;}var before=snapshot(),reader=new FileReader();reader.onload=function(){var image=new Image();image.onload=function(){card.dungeonWallTexture=reader.result;card.dungeonWallColor='custom';window.dungeonTextureCustom=image;document.querySelector('#dungeon-color').value='custom';render();commit(before,'Change dungeon wall texture');};image.onerror=function(){alert('This image could not be loaded as a wall texture.');};image.src=reader.result;};reader.readAsDataURL(file);};
		panel.querySelector('#dungeon-module-texture-clear').onclick=function(){if(!card.dungeonWallTexture)return;var before=snapshot();card.dungeonWallTexture='';if(card.dungeonWallColor==='custom')card.dungeonWallColor='B';window.dungeonTextureCustom=null;panel.querySelector('#dungeon-module-texture').value='';render();commit(before,'Remove dungeon wall texture');};
		refresh();
	}
	function remove(roomId) { var before=snapshot(),index=modules().findIndex(function(room){return room.id===roomId;});if(index<0)return;var room=modules().splice(index,1)[0];delete card.text[room.textKey];selectedId=modules()[Math.min(index,modules().length-1)]?.id||'';loadTextOptions(card.text,true);render();commit(before,'Delete dungeon room'); }
	window.DungeonModules={initialize:initialize,mount:mount,render:render,reflow:reflow,setAutoFit:setAutoFit,setRoomLock:setRoomLock,setHeightLock:setHeightLock,setPadding:setPadding,roomPadding:roomPadding,refresh:refresh,modules:modules,selected:selected,select:function(roomId){selectedId=roomId;refresh();},remove:remove,snapRoom:snapRoom,syncRoom:syncRoom,doorways:doorways,wallSegments:wallSegments,drawWalls:drawWalls,toGrid:toGrid,grid:grid};
})();
