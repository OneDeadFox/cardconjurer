/* Editable dungeon wall junctions. Coordinates/settings are stored on rooms for save/undo. */
(function () {
 'use strict';
 var directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]},dialog,editing;
 function rooms(){return window.DungeonModules.modules();}
 function near(a,b){return Math.abs(a-b)<.001;}
 function collect(segments){
  segments=segments||DungeonModules.wallSegments(rooms());var nodes=[];
  rooms().forEach(function(room){var b=room.bounds;[['tl',b.x,b.y],['tr',b.x+b.width,b.y],['br',b.x+b.width,b.y+b.height],['bl',b.x,b.y+b.height]].forEach(function(p){
   var x=p[1]*card.width,y=p[2]*card.height,n=nodes.find(function(v){return near(v.x,x)&&near(v.y,y);});
   if(!n){n={x:x,y:y,refs:[],arms:{},settings:{style:'square',size:.02,fades:{}}};nodes.push(n);}n.refs.push({room:room,key:p[0]});
   var settings=room.cornerStyles?.[p[0]];if(settings&&(!n.settings.stamp||settings.stamp>=n.settings.stamp))n.settings=settings;
  });});
  nodes.forEach(function(n){segments.forEach(function(s){var h=s.axis==='horizontal',pos=h?n.x:n.y;if(!near(s.position,h?n.y:n.x)||pos<s.start-.001||pos>s.end+.001)return;
   var cuts=[s.start,s.end];nodes.forEach(function(other){if(near(h?other.y:other.x,s.position)){var value=h?other.x:other.y;if(value>s.start&&value<s.end)cuts.push(value);}});
   var before=cuts.filter(function(v){return v<pos-.001;}),after=cuts.filter(function(v){return v>pos+.001;});
   if(before.length)n.arms[h?'left':'up']=pos-Math.max.apply(null,before);if(after.length)n.arms[h?'right':'down']=Math.min.apply(null,after)-pos;
  });n.radius=Math.max(0,Math.min((Number(n.settings.size)||.02)*card.height,...Object.values(n.arms).map(function(v){return v*.45;})));});return nodes;
 }
 function curved(n,a,b){var r=n.radius,A=[n.x+a[0]*r,n.y+a[1]*r],B=[n.x+b[0]*r,n.y+b[1]*r],p=[A];
  if(n.settings.style==='rounded'){for(var i=1;i<12;i++){var t=i/12,u=1-t;p.push([u*u*A[0]+2*u*t*n.x+t*t*B[0],u*u*A[1]+2*u*t*n.y+t*t*B[1]]);}}
  else if(n.settings.style==='inward')p.push([n.x+(a[0]+b[0])*r,n.y+(a[1]+b[1])*r]);
  p.push(B);return p;
 }
 function geometry(segments){
  var nodes=collect(segments),edges=[];
  function at(x,y){return nodes.find(function(n){return near(n.x,x)&&near(n.y,y);});}
  function custom(n){return n&&n.settings.style!=='square'&&n.radius>0;}
  segments.forEach(function(s){var h=s.axis==='horizontal',cuts=[s.start,s.end];nodes.forEach(function(n){var p=h?n.x:n.y;if(near(h?n.y:n.x,s.position)&&p>s.start+.001&&p<s.end-.001)cuts.push(p);});cuts.sort(function(a,b){return a-b;});
   for(var i=1;i<cuts.length;i++){var A=h?[cuts[i-1],s.position]:[s.position,cuts[i-1]],B=h?[cuts[i],s.position]:[s.position,cuts[i]],a=at(...A),b=at(...B);if(custom(a))A[h?0:1]+=a.radius;if(custom(b))B[h?0:1]-=b.radius;edges.push([A,B]);}
  });
  nodes.forEach(function(n){if(!custom(n))return;var arms=Object.keys(n.arms);for(var i=0;i<arms.length;i++)for(var j=i+1;j<arms.length;j++){var a=directions[arms[i]],b=directions[arms[j]];if(a[0]*b[0]+a[1]*b[1]===0)edges.push(curved(n,a,b));}});
  function same(a,b){return near(a[0],b[0])&&near(a[1],b[1]);}
  var used=new Set(),paths=[];edges.forEach(function(e,index){if(used.has(index))return;used.add(index);var p=e.slice();
   function extend(front){while(true){var tip=front?p[0]:p[p.length-1],neighbors=[];edges.forEach(function(o,k){if(same(tip,o[0])||same(tip,o[o.length-1]))neighbors.push(k);});if(neighbors.length!==2)break;var next=neighbors.find(function(k){return !used.has(k);});if(next===undefined)break;used.add(next);var o=edges[next].slice();if(!same(tip,o[0]))o.reverse();if(front)p=o.slice(1).reverse().concat(p);else p=p.concat(o.slice(1));}}
   extend(false);extend(true);paths.push(p);
  });return {nodes:nodes,paths:paths};
 }
 function trace(ctx,model){ctx.beginPath();model.paths.forEach(function(p){ctx.moveTo(...p[0]);p.slice(1).forEach(function(q){ctx.lineTo(...q);});if(near(p[0][0],p[p.length-1][0])&&near(p[0][1],p[p.length-1][1]))ctx.closePath();});}
 function clipRooms(ctx,model){ctx.beginPath();rooms().forEach(function(room){var points=[];[['tl','down','right'],['tr','left','down'],['br','up','left'],['bl','right','up']].forEach(function(spec){var n=model.nodes.find(function(v){return v.refs.some(function(ref){return ref.room===room&&ref.key===spec[0];});});if(n.settings.style!=='square'&&n.radius>0)points.push(...curved(n,directions[spec[1]],directions[spec[2]]));else points.push([n.x,n.y]);});ctx.moveTo(...points[0]);points.slice(1).forEach(function(p){ctx.lineTo(...p);});ctx.closePath();});ctx.clip();}
 function applyFades(ctx){ctx.save();ctx.translate(scaleX(0),scaleY(0));ctx.globalCompositeOperation='destination-out';var width=Math.max(3,card.height*.006)+6;
  collect().forEach(function(n){Object.keys(n.arms).forEach(function(arm){var f=n.settings.fades?.[arm];if(!f?.enabled)return;var d=directions[arm],start=n.settings.style==='square'?width/2:n.radius,available=n.arms[arm]-start;if(available<=0)return;var length=Math.min(available,Math.max(1,(Number(f.length)||.04)*card.height)),x=n.x+d[0]*start,y=n.y+d[1]*start,g=ctx.createLinearGradient(x,y,x+d[0]*length,y+d[1]*length);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,1)');ctx.fillStyle=g;ctx.fillRect(d[0]?Math.min(x,n.x+d[0]*n.arms[arm]):x-width/2,d[1]?Math.min(y,n.y+d[1]*n.arms[arm]):y-width/2,d[0]?available:width,d[1]?available:width);});});ctx.restore();
 }
 function active(){return card.version==='dungeonModules'&&shouldDrawLayoutHighlights()&&activeFrameDesignMode!=='frames'&&layoutHighlightEnabled('layout-highlight-rules-ranges');}
 function preview(n){return {x:(n.x+scaleX(0))*previewCanvas.width/cardCanvas.width,y:(n.y+scaleY(0))*previewCanvas.height/cardCanvas.height};}
 function drawHandles(){if(!active())return;previewContext.save();collect().forEach(function(n){var p=preview(n);previewContext.beginPath();previewContext.arc(p.x,p.y,5,0,Math.PI*2);previewContext.fillStyle='#80ffcc';previewContext.fill();previewContext.strokeStyle='#163d30';previewContext.lineWidth=1;previewContext.stroke();});previewContext.restore();}
 function hit(point){return active()?collect().find(function(n){var p=preview(n);return Math.hypot(point.x-p.x,point.y-p.y)<=8;}):null;}
 function resolve(){return collect().find(function(n){return n.refs.some(function(r){return r.room.id===editing?.roomId&&r.key===editing.key;});});}
 function setSettings(n,patch){var before=createDesignStateSnapshot(),settings=Object.assign({},n.settings,patch,{stamp:Date.now()});n.refs.forEach(function(ref){ref.room.cornerStyles=ref.room.cornerStyles||{};ref.room.cornerStyles[ref.key]=JSON.parse(JSON.stringify(settings));});DungeonModules.render();commitDesignUndoSnapshot(before,'Edit dungeon corner');refreshEditor();}
 function close(){if(dialog?.open)dialog.close();editing=null;window.CanvasDesignTools?.resume();}
 function refreshEditor(){if(!dialog?.open)return;var n=resolve();if(!n){close();return;}dialog.querySelectorAll('[data-style]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.style===n.settings.style));});dialog.querySelector('#corner-size').value=Math.round((n.settings.size||.02)*card.height);var select=dialog.querySelector('#corner-arm'),old=select.value;select.replaceChildren();Object.keys(n.arms).forEach(function(a){var o=document.createElement('option');o.value=a;o.textContent=a[0].toUpperCase()+a.slice(1);select.appendChild(o);});if(n.arms[old])select.value=old;updateFade();}
 function updateFade(){var n=resolve();if(!n)return;var f=n.settings.fades?.[dialog.querySelector('#corner-arm').value];dialog.querySelector('#corner-fade').checked=!!f?.enabled;dialog.querySelector('#corner-length').value=Math.round((f?.length||.04)*card.height);}
 function mount(){if(dialog)return;dialog=document.createElement('dialog');dialog.className='dungeon-corner-editor';dialog.innerHTML='<button type="button" id="corner-close" aria-label="Close corner editor">×</button><h3>Wall corner</h3><p>Choose a shape. Shared corners update together.</p><div class="corner-presets"></div><label>Corner size (pixels)<input id="corner-size" type="number" min="1" max="1000"></label><h4>Transition</h4><label>Wall end<select id="corner-arm"></select></label><label><input id="corner-fade" type="checkbox"> Fade this end into the background</label><label>Fade length (pixels)<input id="corner-length" type="number" min="1" max="10000"></label><p>The selected arm fades outward from the corner toward the next junction or doorway.</p><button type="button" id="corner-reset">Reset corner</button> <button type="button" id="corner-tab">Go to Dungeon tab</button>';
  [['square','Square','M10 44V10H44'],['rounded','Rounded','M10 44V30Q10 10 30 10H44'],['beveled','Beveled','M10 44V30L30 10H44'],['inward','Inward cut','M10 44V30H30V10H44']].forEach(function(s){var b=document.createElement('button');b.type='button';b.dataset.style=s[0];b.innerHTML='<svg viewBox="0 0 54 54" aria-hidden="true"><path d="'+s[2]+'" fill="none" stroke="currentColor" stroke-width="6"/></svg>'+s[1];b.onclick=function(){var n=resolve();if(n)setSettings(n,{style:s[0]});};dialog.querySelector('.corner-presets').appendChild(b);});
  document.body.appendChild(dialog);dialog.querySelector('#corner-close').onclick=close;dialog.addEventListener('cancel',function(e){e.preventDefault();close();});dialog.querySelector('#corner-size').onchange=function(){var n=resolve();if(n)setSettings(n,{size:Math.max(1,Math.min(1000,Number(this.value)||1))/card.height});};dialog.querySelector('#corner-arm').onchange=updateFade;
  function fadeChanged(){var n=resolve();if(!n)return;var fades=JSON.parse(JSON.stringify(n.settings.fades||{}));fades[dialog.querySelector('#corner-arm').value]={enabled:dialog.querySelector('#corner-fade').checked,length:Math.max(1,Math.min(10000,Number(dialog.querySelector('#corner-length').value)||1))/card.height};setSettings(n,{fades:fades});}
  dialog.querySelector('#corner-fade').onchange=fadeChanged;dialog.querySelector('#corner-length').onchange=fadeChanged;dialog.querySelector('#corner-reset').onclick=function(){var n=resolve();if(n)setSettings(n,{style:'square',size:.02,fades:{}});};dialog.querySelector('#corner-tab').onclick=function(){close();activateCreatorEditorTab('dungeon');};
  window.addEventListener('creatortabchanged',function(){if(dialog.open)close();});window.addEventListener('frameworkspacechanged',function(){if(dialog.open)close();});
 }
 function open(n){mount();editing={roomId:n.refs[0].room.id,key:n.refs[0].key};window.CanvasDesignTools?.suspend();dialog.showModal();refreshEditor();}
 window.DungeonCorners={collect:collect,geometry:geometry,trace:trace,clipRooms:clipRooms,applyFades:applyFades,drawHandles:drawHandles,hit:hit,open:open,close:close,refreshEditor:refreshEditor,setSettings:setSettings};
})();
