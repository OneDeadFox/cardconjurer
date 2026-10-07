// Spatial room modules for the experimental dungeon frame. Bounds are continuous card-relative
// coordinates; the original AFR cell dimensions are only used to seed the sample arrangement.
(function () {
	'use strict';
	var selectedId = '';
	var pipelineProfiles=new WeakMap();
	var pipelineShapes=new WeakMap();
	var wallRasterCache=new Map();
	// Shade the union of the walls, rather than overlapping independently shaded
	// rectangles. At a junction, an outline belongs on an exposed edge only.
	function paintPipelineWalls(context,material,segments,cornerModel,trace){
		var canvas=document.createElement('canvas');canvas.width=card.width;canvas.height=card.height;
		var shape=canvas.getContext('2d');if(!shape.createImageData)return false;
		var key=JSON.stringify([card.width,card.height,material,[material.top.anchor,material.bottom.anchor,material.left?.anchor,material.right?.anchor],segments,cornerModel?.paths]);
		if(wallRasterCache.has(key)){context.drawImage(wallRasterCache.get(key),0,0);return true;}
		var placement=material.samplePlacement||material.placement;
		var bottom=Math.max(...modules().map(r=>r.bounds.y+r.bounds.height))*card.height,left=Math.min(...modules().map(r=>r.bounds.x))*card.width;
		function profileAt(horizontal,x,y){return horizontal?(Math.abs(y-bottom)<=material.bottom.length*unit(true)+2?material.bottom:material.top):(Math.abs(x-left)<=(material.left?.length||0)*unit(false)+2?material.left:material.right)||material.top;}
		function unit(horizontal){return horizontal?card.height*(placement.height||1)/material.sourceHeight:card.width*(placement.width||1)/material.sourceWidth;}
		var widths=[material.top.length*unit(true),material.bottom.length*unit(true)];if(material.left)widths.push(material.left.length*unit(false));if(material.right)widths.push(material.right.length*unit(false));
		var envelope=card.dungeonPipelineEnvelope,nativeJoins=[],nativeCorners=[];
		function near(a,b){return Math.abs(a-b)<1;}
		if(material.rendered&&envelope&&cornerModel){
			var outerRight=envelope.right*card.width,outerTop=envelope.top*card.height,footerY=envelope.footerTop*card.height;
			cornerModel.nodes.forEach(function(n){
				if(n.settings.style==='t-right'&&near(n.x,left)&&near(n.y,footerY))nativeJoins.push({node:n,arm:'up',horizontal:false});
				if(n.settings.style==='t-down'&&near(n.y,outerTop)&&near(n.x,envelope.artDivider*card.width))nativeJoins.push({node:n,arm:'left',horizontal:true});
				if(n.settings.style==='square'&&((near(n.y,bottom)&&(near(n.x,left)||near(n.x,outerRight)))||(near(n.x,outerRight)&&near(n.y,outerTop))))nativeCorners.push(n);
			});
		}

		shape.strokeStyle='#fff';shape.lineWidth=Math.min(...widths);shape.lineCap='butt';shape.lineJoin='miter';if(!cornerModel){trace(shape);shape.stroke();}
		// Respect edited rounded/beveled/T geometry throughout the colored walls.
		var paths=cornerModel?.paths||segments.map(function(s){return s.axis==='horizontal'?[[s.start,s.position],[s.end,s.position]]:[[s.position,s.start],[s.position,s.end]];});
		paths.forEach(function(path){for(var i=1;i<path.length;i++){var a=path[i-1],b=path[i];var horizontal=Math.abs(a[1]-b[1])<.01,vertical=Math.abs(a[0]-b[0])<.01;if(!horizontal&&!vertical){shape.lineWidth=Math.min(...widths);shape.beginPath();shape.moveTo(a[0],a[1]);shape.lineTo(b[0],b[1]);shape.stroke();continue;}
			var profile=profileAt(horizontal,(a[0]+b[0])/2,(a[1]+b[1])/2),scale=unit(horizontal),offset=(profile.length/2-profile.anchor)*scale;
			shape.lineWidth=profile.length*scale;shape.beginPath();shape.moveTo(a[0]+(horizontal?0:offset),a[1]+(horizontal?offset:0));shape.lineTo(b[0]+(horizontal?0:offset),b[1]+(horizontal?offset:0));shape.stroke();
		}});
		shape.fillStyle='#fff';cornerModel?.nodes.forEach(function(n){if(Object.keys(n.arms).length<2||!(/^(square|t-)/.test(n.settings.style)))return;var hp=profileAt(true,n.x,n.y),vp=profileAt(false,n.x,n.y);shape.fillRect(n.x-vp.anchor*unit(false),n.y-hp.anchor*unit(true),vp.length*unit(false),hp.length*unit(true));});
		var coverage=shape.getImageData(0,0,canvas.width,canvas.height),output=shape.createImageData(canvas.width,canvas.height),data=coverage.data,w=canvas.width,h=canvas.height,limit=Math.ceil(Math.max(...widths))+2;
		// Existing frame strokes continue through these two junctions. Include
		// that continuation when shading, without painting another capped stub.
		nativeJoins.forEach(function(join){var n=join.node,p=profileAt(join.horizontal,n.x,n.y),u=unit(join.horizontal),reach=n.radius+limit*2;if(join.horizontal)shape.fillRect(n.x-reach,n.y-p.anchor*u,reach*2,p.length*u);else shape.fillRect(n.x-p.anchor*u,n.y-reach,p.length*u,reach*2);});
		var distanceData=nativeJoins.length?shape.getImageData(0,0,w,h).data:data;
		function distance(x,y,dx,dy){var d=0;while(d<limit){x+=dx;y+=dy;d++;if(x<0||y<0||x>=w||y>=h||distanceData[(y*w+x)*4+3]<64)break;}return d-.5;}
		var parsed=new WeakMap();function colors(profile){var result=parsed.get(profile);if(!result){result=profile.map(function(stops){return stops.map(function(s){return {position:s.position,rgba:s.color.match(/[\d.]+/g).map(Number)};});});parsed.set(profile,result);}return result;}
		function color(profile,index,position){var stops=colors(profile)[Math.max(0,Math.min(profile.length-1,index))],a=stops[0],b=stops[stops.length-1];for(var i=1;i<stops.length;i++){if(position<=stops[i].position){a=stops[i-1];b=stops[i];break;}}var t=Math.max(0,Math.min(1,(position-a.position)/(b.position-a.position||1)));return a.rgba.map(function(v,i){return v+(b.rgba[i]-v)*t;});}
		var tables=new WeakMap(),sy=unit(true),sx=unit(false);
		function table(profile,horizontal){var old=tables.get(profile),span=horizontal?w:h;if(old&&old.span===span)return old.data;var data=new Uint8ClampedArray(profile.length*span*4);for(var row=0;row<profile.length;row++)for(var position=0;position<span;position++){var relative=(position/span-(horizontal?(placement.x||0):(placement.y||0)))/(horizontal?(placement.width||1):(placement.height||1)),rgba=color(profile,row,relative),i=(row*span+position)*4;data[i]=rgba[0];data[i+1]=rgba[1];data[i+2]=rgba[2];data[i+3]=rgba[3]*255;}tables.set(profile,{span:span,data:data});return data;}
		var horizontalTables=new Map(),verticalTables=new Map();[material.top,material.bottom].forEach(function(p){horizontalTables.set(p,table(p,true));});[material.left,material.right].filter(Boolean).forEach(function(p){verticalTables.set(p,table(p,false));});
		for(var y=0;y<h;y++){var hp=profileAt(true,0,y),ht=horizontalTables.get(hp);for(var x=0;x<w;x++){var i=(y*w+x)*4;if(!data[i+3])continue;
			var vp=profileAt(false,x,y),dt=distance(x,y,0,-1)/sy,db=distance(x,y,0,1)/sy,dl=distance(x,y,-1,0)/sx,dr=distance(x,y,1,0)/sx;
			var profile=hp,depth=dt,side=0,position=x,span=w,lookup=ht,best=dt/Math.max(.5,hp.anchor),fraction=db/Math.max(.5,hp.length-hp.anchor);
			if(fraction<best){best=fraction;depth=db;side=1;}
			fraction=dl/Math.max(.5,vp.anchor);if(fraction<best){best=fraction;profile=vp;depth=dl;side=0;position=y;span=h;lookup=verticalTables.get(vp)||table(vp,false);}
			fraction=dr/Math.max(.5,vp.length-vp.anchor);if(fraction<best){profile=vp;depth=dr;side=1;position=y;span=h;lookup=verticalTables.get(vp)||table(vp,false);}
			depth=Math.min(depth,side?profile.length-profile.anchor-.5:profile.anchor-.5);var index=side?profile.length-1-Math.floor(depth):Math.floor(depth),j=(Math.max(0,Math.min(profile.length-1,index))*span+position)*4;
			output.data[i]=lookup[j];output.data[i+1]=lookup[j+1];output.data[i+2]=lookup[j+2];output.data[i+3]=data[i+3]*lookup[j+3]/255;
		}}

		shape.putImageData(output,0,0);
		// Carry the art-side lower outline through the entire final-row boundary,
		// including the arms of the T; each doorway remains an opening.
		if(envelope&&material.underline){var y=envelope.footerTop*card.height,p=material.top,u=unit(true),depth=material.underline.depth*u;shape.strokeStyle=material.underline.color;shape.lineWidth=depth;shape.lineCap='butt';
			segments.filter(function(s){return s.axis==='horizontal'&&near(s.position,y);}).forEach(function(s){var start=s.start,end=s.end;if(near(start,left))start+=((material.left?.length||0)-(material.left?.anchor||0))*unit(false);if(near(end,envelope.right*card.width))end-=(material.right?.anchor||0)*unit(false);if(end>start){shape.beginPath();shape.moveTo(start,y+material.underline.offset*u);shape.lineTo(end,y+material.underline.offset*u);shape.stroke();}});
		}
		// The composed frame already contains the correctly colored native
		// pipeline and rounded title/type corners at these exact coordinates.
		// Reveal it once, avoiding a second square stroke over the curved artwork.

		nativeCorners.forEach(function(n){
			var hp=profileAt(true,n.x,n.y),vp=profileAt(false,n.x,n.y),rx=Math.max(vp.length*unit(false)*3,hp.length*unit(true)*2),ry=Math.max(hp.length*unit(true)*2,vp.length*unit(false)*2);
			rx=Math.min(rx,(n.arms.left||n.arms.right||Infinity)*.45);ry=Math.min(ry,(n.arms.up||n.arms.down||Infinity)*.45);
			var dx=n.arms.right?1:-1,dy=n.arms.down?1:-1;
			var innerX=n.x+(dx>0?vp.length-vp.anchor:-vp.anchor)*unit(false),innerY=n.y+(dy>0?hp.length-hp.anchor:-hp.anchor)*unit(true);
			// Keep the native rounded outside, but carry each adjacent inner shadow
			// through the revealed patch. Some uploaded pipelines contain only color
			// here; the dark edge belongs to the generated wall or frame beneath it.
			function edge(horizontal){
				var expected=horizontal?innerY:innerX,radius=Math.max(2,Math.ceil((horizontal?hp.length*unit(true):vp.length*unit(false))*.6)),runs=[];
				for(var q=Math.floor(expected-radius);q<=Math.ceil(expected+radius);q++){
					var x=Math.round(horizontal?n.x+dx*(rx+2):q),y=Math.round(horizontal?q:n.y+dy*(ry+2));if(x<0||y<0||x>=w||y>=h)continue;
					var rgba=shape.getImageData(x,y,1,1).data;
					if((rgba[3]<180||Math.max(rgba[0],rgba[1],rgba[2])>=90)&&window.frameCanvas?.getContext)rgba=window.frameCanvas.getContext('2d').getImageData(x+(Number(card.marginX)||0)*w,y+(Number(card.marginY)||0)*h,1,1).data;
					if(rgba[3]>180&&Math.max(rgba[0],rgba[1],rgba[2])<90){var last=runs[runs.length-1];if(last&&last.end===q)last.end=q+1;else runs.push({start:q,end:q+1,color:'rgba('+rgba[0]+','+rgba[1]+','+rgba[2]+','+(rgba[3]/255)+')'});}
				}
				return runs.filter(function(r){return r.end-r.start<=radius;}).sort(function(a,b){return Math.abs((a.start+a.end)/2-expected)-Math.abs((b.start+b.end)/2-expected);})[0];
			}
			var horizontal=edge(true),vertical=edge(false);
			shape.clearRect(n.x-rx,n.y-ry,rx*2,ry*2);
			var joinX=vertical?(vertical.start+vertical.end)/2:innerX,joinY=horizontal?(horizontal.start+horizontal.end)/2:innerY;
			shape.lineCap='square';
			if(horizontal){shape.strokeStyle=horizontal.color;shape.lineWidth=horizontal.end-horizontal.start;shape.beginPath();shape.moveTo(joinX,joinY);shape.lineTo(n.x+dx*rx,joinY);shape.stroke();}
			if(vertical){shape.strokeStyle=vertical.color;shape.lineWidth=vertical.end-vertical.start;shape.beginPath();shape.moveTo(joinX,joinY);shape.lineTo(joinX,n.y+dy*ry);shape.stroke();}
		});
		wallRasterCache.set(key,canvas);if(wallRasterCache.size>3)wallRasterCache.delete(wallRasterCache.keys().next().value);context.drawImage(canvas,0,0);return true;
	}
	// Sample a long horizontal stroke from the active pipeline artwork. This
	// carries custom textures, bevel colors, and its already-composed split mask.
	function pipelineProfile(frameOverride,renderedOverride,data){
		data=data||card;
		var frame=frameOverride||(data.frames||[]).find(function(f){return !f.hidden&&/pipeline|pinline/i.test(f.componentKind||f.componentLabel||f.name||'')&&(f.image?.naturalWidth||f.image?.width);});
		if(!frame||data.dungeonWallColor==='custom')return null;
		var image=frame.image,rendered=renderedOverride===undefined?window.frameCanvas:renderedOverride,profile=rendered?null:pipelineProfiles.get(image);
		if(!profile)try{
			var canvas=document.createElement('canvas');canvas.width=(image.naturalWidth||image.width);canvas.height=Math.round(canvas.width*(image.naturalHeight||image.height)/(image.naturalWidth||image.width));
			var ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);var pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,w=canvas.width,h=canvas.height;
			function bands(axis){var runs=[],length=axis==='horizontal'?h:w,span=axis==='horizontal'?w:h;
				for(var a=0;a<length;a++){var count=0;for(var b=Math.floor(span*.25);b<span*.75;b++){var x=axis==='horizontal'?b:a,y=axis==='horizontal'?a:b;if(pixels[(y*w+x)*4+3]>100)count++;}
					if(count>span*.35){var last=runs[runs.length-1];if(last&&last.end===a)last.end++;else runs.push({start:a,end:a+1});}}
				return runs.filter(function(run){return run.end-run.start>=2&&run.end-run.start<length*.08;});}
			var geometry=pipelineShapes.get(image);if(!geometry||geometry.source!==image.src||geometry.width!==w||geometry.height!==h){geometry={source:image.src,width:w,height:h,horizontal:bands('horizontal'),vertical:bands('vertical')};pipelineShapes.set(image,geometry);}
			var horizontal=geometry.horizontal,vertical=geometry.vertical;if(!horizontal.length)return null;
			// Geometry comes from the uploaded pipeline mask. Expanding its sampled
			// bevel must never change the anchor (or move rooms on each redraw).
			var top=horizontal.find(function(b){return (b.start+b.end)/2/h>.07;})||horizontal[0],bottom=horizontal.find(function(b){return (b.start+b.end)/2/h>.65;})||horizontal[horizontal.length-1];
			var sourceBounds=vertical.length&&horizontal.length>=3?{x:(vertical[0].start+vertical[0].end)/2/w,right:(vertical[vertical.length-1].start+vertical[vertical.length-1].end)/2/w,top:(top.start+top.end)/2/h,bottom:(bottom.start+bottom.end)/2/h}:null;
			var samplePixels=pixels,hasRenderedFrame=false,placement=frame.bounds||{x:0,y:0,width:1,height:1};
			if(rendered?.width){var full=document.createElement('canvas');full.width=w;full.height=h;var fullCtx=full.getContext('2d');fullCtx.drawImage(rendered,(Number(data.marginX)||0)*data.width,(Number(data.marginY)||0)*data.height,data.width,data.height,0,0,w,h);var finalPixels=fullCtx.getImageData(0,0,w,h).data;
				if(finalPixels.some(function(value,i){return i%4===3&&value>100;})){
					samplePixels=finalPixels;hasRenderedFrame=true;
					// Sample within the authored strip. Frame background colors and shadows
					// do not define thickness; they may extend far beyond the pipeline.
					function projectBand(run,axis){var limit=axis==='horizontal'?h:w,origin=(axis==='horizontal'?placement.y:placement.x)||0,scale=(axis==='horizontal'?placement.height:placement.width)||1,start=origin*limit+run.start*scale,end=origin*limit+run.end*scale;return {start:Math.round(start),end:Math.max(Math.round(start)+1,Math.round(end)),anchor:(start+end)/2};}
					top=projectBand(top,'horizontal');bottom=projectBand(bottom,'horizontal');vertical=vertical.map(function(run){return projectBand(run,'vertical');});
					placement={x:0,y:0,width:1,height:1};
				}
			}
			function sample(run,axis){var result=[],span=axis==='horizontal'?w:h;for(var a=run.start;a<run.end;a++){var colors=[];for(var b=Math.floor(span*.15);b<=span*.85;b+=Math.max(1,Math.floor(span*.025))){var x=axis==='horizontal'?b:a,y=axis==='horizontal'?a:b,i=(y*w+x)*4;colors.push({position:b/span,color:'rgba('+samplePixels[i]+','+samplePixels[i+1]+','+samplePixels[i+2]+','+(samplePixels[i+3]/255)+')'});}result.push(colors);}result.anchor=(run.anchor===undefined?(run.start+run.end)/2:run.anchor)-run.start;return result;}
			profile={sourceWidth:w,sourceHeight:h,top:sample(top,'horizontal'),bottom:sample(bottom,'horizontal'),left:vertical.length?sample(vertical[0],'vertical'):null,right:vertical.length?sample(vertical[vertical.length-1],'vertical'):null,
				bounds:sourceBounds,samplePlacement:placement,rendered:hasRenderedFrame};
			// Use the dark lower edge beside the art as the reference for this run.
			var depth=0,outline=null;for(var row=profile.top.length-1;row>=Math.floor(profile.top.length*.6);row--){var stop=profile.top[row].reduce(function(best,s){return Math.abs(s.position-.3)<Math.abs(best.position-.3)?s:best;}),rgba=stop.color.match(/[\d.]+/g).map(Number);if(rgba[3]<.5||Math.max(rgba[0],rgba[1],rgba[2])>90)break;depth++;outline=stop.color;}
			if(depth)profile.underline={depth:depth,color:outline,offset:profile.top.length-profile.top.anchor-depth/2};
			// Prefer the actual outline below the art when the template supplies it.
			// It may sit just outside the colored strip; copy only that thin dark
			// edge, without letting neighboring background pixels resize the wall.
			if(hasRenderedFrame&&data.dungeonModules?.length){var rooms=data.dungeonModules,footer=rooms.slice().sort(function(a,b){return b.bounds.width-a.bounds.width;})[0],others=rooms.filter(function(r){return r!==footer;}),divider=others.length?Math.min(...others.map(function(r){return r.bounds.x;})):footer.bounds.x;
				if(divider>footer.bounds.x+.05){var center=footer.bounds.y*h,edge=center+profile.top.length-profile.top.anchor,radius=Math.max(3,Math.round(h*.002)),runs=[];
					for(var y=Math.max(0,Math.floor(edge-radius));y<Math.min(h,Math.ceil(edge+radius));y++){var dark=[];[.25,.375,.5,.625,.75].forEach(function(t){var x=Math.round((footer.bounds.x+(divider-footer.bounds.x)*t)*w),i=(y*w+x)*4;if(samplePixels[i+3]>180&&Math.max(samplePixels[i],samplePixels[i+1],samplePixels[i+2])<80)dark.push([samplePixels[i],samplePixels[i+1],samplePixels[i+2]]);});if(dark.length>=4){var last=runs[runs.length-1];if(last&&last.end===y)last.end++;else runs.push({start:y,end:y+1,color:'rgb('+dark[0].join(',')+')'});}}
					var run=runs.filter(function(r){return r.end-r.start<=Math.max(3,profile.top.length*.4);}).sort(function(a,b){return Math.abs((a.start+a.end)/2-edge)-Math.abs((b.start+b.end)/2-edge);})[0];if(run)profile.underline={depth:run.end-run.start,color:run.color,offset:(run.start+run.end)/2-center};
				}
			}
			pipelineProfiles.set(image,profile);
		}catch(error){return null;}
		var b=frame.bounds||{x:0,y:0,width:1,height:1};return Object.assign({},profile,{placement:b});
	}
	function capturePipelineMaterial(source,frame,data){
		var material=pipelineProfile(Object.assign({},frame,{image:source}),null,data);
		if(material)material.anchors=['top','bottom','left','right'].map(function(k){return material[k]?.anchor;});
		return material;
	}
	function paintPipelineColors(context,material,segments,corners,trace){
		var frame=(card.frames||[]).find(function(f){return !f.hidden&&f.dungeonPipelineMaterials;});
		var colors=frame?.dungeonPipelineMaterials;
		if(!colors?.left||!colors?.right)return paintPipelineWalls(context,material,segments,corners,trace);
		var layers=[colors.left,colors.right].map(function(saved){
			var profile=Object.assign({},saved,{rendered:material.rendered,underline:material.underline,placement:frame.bounds||saved.placement,samplePlacement:frame.bounds||saved.samplePlacement});
			['top','bottom','left','right'].forEach(function(k,i){if(profile[k])profile[k].anchor=saved.anchors[i];});
			var layer=document.createElement('canvas');layer.width=card.width;layer.height=card.height;
			paintPipelineWalls(layer.getContext('2d'),profile,segments,corners,trace);return layer;
		});
		// Build both complete wall systems, then put the masked right color above
		// the first. The mask is in card coordinates, including vertical walls.
		var weights=document.createElement('canvas');weights.width=colors.mask.length;weights.height=1;
		var wc=weights.getContext('2d'),pixels=wc.createImageData(weights.width,1);
		colors.mask.forEach(function(alpha,x){pixels.data[x*4+3]=alpha;});wc.putImageData(pixels,0,0);
		var right=layers[1].getContext('2d');right.globalCompositeOperation='destination-in';right.drawImage(weights,0,0,card.width,card.height);right.globalCompositeOperation='source-over';
		context.drawImage(layers[0],0,0);context.drawImage(layers[1],0,0);return true;
	}

	function alignPipelineBounds(material){
		if(!material?.bounds||!modules().length)return;
		var list=modules(),footer=list.slice().sort(function(a,b){return b.bounds.width-a.bounds.width;})[0],left=Math.min(...list.map(r=>r.bounds.x)),right=Math.max(...list.map(r=>r.bounds.x+r.bounds.width)),top=Math.min(...list.map(r=>r.bounds.y));
		if(footer.bounds.y<=top||footer.bounds.width<right-left-.001)return;
		var p=material.placement,b=material.bounds,target={x:(p.x||0)+b.x*(p.width||1),right:(p.x||0)+b.right*(p.width||1),top:(p.y||0)+b.top*(p.height||1),bottom:(p.y||0)+b.bottom*(p.height||1)},fixed=footer.bounds.y,oldFixed=fixed;
		if(target.top>=fixed||target.bottom<=fixed)return;
		var previous=card.dungeonPipelineEnvelope;
		if(previous&&modules().every(function(r){return r.pipelineAligned===5;})&&['x','right','top','bottom'].every(function(k){return Math.abs(previous[k]-target[k])<1e-8;}))return;
		// Save the wide final row's upper edge independently of text fitting.
		if(previous&&previous.footerId===footer.id)fixed=previous.footerTop;
		var upper=list.filter(function(room){return room!==footer;}),divider=Math.min(...upper.map(function(room){return room.bounds.x;}));
		// The art boundary is an authored divider, not a fraction of the full card
		// width. Resize the room column between that divider and the right edge.
		if(divider<=target.x||divider>=target.right)return;
		card.dungeonPipelineEnvelope=Object.assign({},target,{footerId:footer.id,footerTop:fixed,artDivider:divider});
		var oldDivider=Math.min(...upper.map(function(room){return room.bounds.x;}));
		function columnX(x){return divider+(x-oldDivider)*(target.right-divider)/(right-oldDivider);}
		list.forEach(function(room){var box=room.bounds,end=box.y+box.height;
			if(room===footer){box.x=target.x;box.width=target.right-target.x;box.y=fixed;box.height=target.bottom-fixed;}
			else{var endX=columnX(box.x+box.width);box.x=columnX(box.x);box.width=endX-box.x;box.y=target.top+(box.y-top)*(fixed-target.top)/(oldFixed-top);box.height=(end-top)*(fixed-target.top)/(oldFixed-top)+target.top-box.y;}
			if(room.lockedBounds)room.lockedBounds=JSON.parse(JSON.stringify(box));if(room.autoFitOriginalBounds)room.autoFitOriginalBounds={y:box.y,height:box.height};
			if(room.csvRowBounds){var old=room.csvRowBounds;room.csvRowBounds=room===footer?{x:target.x,width:target.right-target.x}:{x:columnX(old.x),width:columnX(old.x+old.width)-columnX(old.x)};}
			room.pipelineAligned=5;syncRoom(room);
		});
		if(card.dungeonHeightLock)card.dungeonHeightLock={top:target.top,bottom:target.bottom};if(card.dungeonAutoFitBounds)card.dungeonAutoFitBounds={top:target.top,bottom:target.bottom};
		var art=card.artBounds;if(art){art.x=target.x;art.y=target.top;art.width=Math.min(...list.filter(r=>r!==footer).map(r=>r.bounds.x))-target.x;art.height=fixed-target.top;}
	}

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
		var definition={};definition[key]={name:room.name,text:text||room.name+'{lns}{fontmplantin}{fontsize-8}Effect.',x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,font:'mplantin',size:.0324,align:'center',customField:true};
		loadTextOptions(definition,false);
		syncRoom(room);
		return room;
	}
	// One CSV cell describes rows; IDs survive repeated previews and saved templates.
	function applyCsvRooms(data,fields,warnings) {
		if(data.version!=='dungeonModules'||!Array.isArray(data.dungeonModules))return false;
		warnings=warnings||[];
		var list=data.dungeonModules.slice().sort(function(a,b){return a.bounds.y-b.bounds.y||a.bounds.x-b.bounds.x;}),rows=[];
		list.forEach(function(room){var row=rows.find(function(r){return Math.abs(r[0].bounds.y-room.bounds.y)<.001;});if(row)row.push(room);else rows.push([room]);});
		var value=String(fields.dungeonRooms||'').trim(),mapping;
		if(value){
			mapping=value.split(';').map(function(row){return row.trim().split('|').map(function(n){if(!/^\d+$/.test(n.trim())||Number(n)<1||Number(n)>12)throw Error('Dungeon Rooms requires Ability numbers from 1 to 12.');return Number(n);});});
			if(mapping.length!==rows.length)throw Error('Dungeon Rooms requires '+rows.length+' rows separated by semicolons.');
			mapping.forEach(function(row,i){if(row.length>2||row.length===2&&(i<1||i>3))throw Error('Only dungeon rows 2, 3 and 4 can split into two rooms.');});
		}
		// Imported neighboring rows share one boundary, including rounded saved coordinates.
		rows.forEach(function(row,i){if(!i)return;var previous=rows[i-1][0].bounds,edge=previous.y+previous.height;
			if(Math.abs(edge-row[0].bounds.y)<.001)row.forEach(function(room){var b=room.bounds,end=b.y+b.height;b.y=edge;b.height=end-edge;});
		});
		// Older Embark templates saved the default full-card art bounds.
		// Infer only the left opening bounded by narrower rows and a wide footer.
		var artBox=data.artBounds;
		if(!artBox||(artBox.x===0&&artBox.y===0&&artBox.width===1&&artBox.height===1)){
			var footer=rows[rows.length-1]?.[0],upper=rows.slice(0,-1).flat();
			if(footer&&upper.length){
				var left=footer.bounds.x,right=Math.min(...upper.map(function(r){return r.bounds.x;})),top=Math.min(...upper.map(function(r){return r.bounds.y;})),bottom=footer.bounds.y;
				if(right-left>.1&&bottom>top&&upper.every(function(r){return r.bounds.y+r.bounds.height<=bottom+.001;})){
					var halfWall=.003,halfWallX=halfWall*data.height/data.width;
					data.artBounds={x:left+halfWallX,y:top,width:right-left-2*halfWallX,height:bottom-top-halfWall};
				}
			}
		}
		var next=[],counter=0;
		rows.forEach(function(row,index){
			row.sort(function(a,b){return a.bounds.x-b.bounds.x;});
			var x=Math.min(...row.map(function(r){return r.bounds.x;})),right=Math.max(...row.map(function(r){return r.bounds.x+r.bounds.width;})),y=row[0].bounds.y,h=Math.max(...row.map(function(r){return r.bounds.height;}));
			var numbers=mapping?mapping[index]:row.map(function(){return ++counter;});
			if(mapping)counter+=numbers.length;
			var rowId=row[0].csvRowId||row[0].id;
			numbers.forEach(function(number,column){
				var original=row[column]||row[0],room=JSON.parse(JSON.stringify(original)),isNew=!row[column];
				if(isNew){room.id=rowId+'-right';room.textKey=original.textKey+'Right';delete room.cornerStyles;}
				var text=JSON.parse(JSON.stringify(data.text[original.textKey]||{size:.0324,align:'center',customField:true}));
				room.name='Room '+(next.length+1);room.csvRowId=rowId;room.csvRowBounds={x:x,width:right-x};room.csvAbility=number;
				room.bounds={x:x+column*(right-x)/numbers.length,y:y,width:(right-x)/numbers.length,height:h};
				if(room.geometryLocked)room.lockedBounds=JSON.parse(JSON.stringify(room.bounds));
				if(room.autoFitOriginalBounds)room.autoFitOriginalBounds={y:y,height:h};
				delete room.autoFitFont;delete text.rangeFontReduction;delete text.rangeUniformTextSize;
				text.name=room.name;text.csvFieldLabel=room.name;text.font='mplantin';
				if(mapping||Object.prototype.hasOwnProperty.call(fields,'ability'+number)){
					text.text=String(fields['ability'+number]||'').trim();
					if(mapping&&!Object.prototype.hasOwnProperty.call(fields,'ability'+number))warnings.push(room.name+' references Ability '+number+', but that column is not mapped.');
				}
				data.text[room.textKey]=text;next.push(room);syncRoom(room,data);
			});
		});
		var keys=new Set(next.map(function(room){return room.textKey;}));list.forEach(function(room){if(!keys.has(room.textKey))delete data.text[room.textKey];});
		data.dungeonModules=next;return true;
	}
	function initialize() {
		card.dungeonModules=[];
		card.dungeonLayoutLocked=false;
		card.dungeonWallTexture='';
		card.dungeonWallColor='B';card.dungeonPadding=null;card.dungeonVerticalPadding=null;
		card.dungeonAutoFit=false;card.dungeonAutoFitBounds=null;card.dungeonHeightLock=null;card.dungeonPipelineEnvelope=null;
		sample.forEach(function(values){addRoom(fromGrid.apply(null,values));});
		selectedId=modules()[0]?.id||'';
	}
	function verticalPadding(room) {
		return room.verticalPadding||card.dungeonVerticalPadding||{};
	}
	function setVerticalPadding(top,bottom,auto,all) {
		var room=selected();if(!all&&!room)return;var before=snapshot();
		var settings={top:Math.max(0,Number(top)||0),bottom:Math.max(0,Number(bottom)||0),auto:!!auto};
		if(all){card.dungeonVerticalPadding=settings;modules().forEach(function(r){delete r.verticalPadding;});}else room.verticalPadding=settings;
		render();commit(before,all?'Set all room vertical padding':'Set room vertical padding');
	}
	function roomPadding(room,data=card) {
		var box=room.bounds,explicit=Number.isFinite(room.padding)?room.padding:data.dungeonPadding;
		var value=Number.isFinite(explicit)?Math.max(0,explicit):data.height*.0381*.5,vertical=(room.verticalPadding||data.dungeonVerticalPadding||{});
		var y=Math.min(value,Number.isFinite(explicit)?Math.max(0,(box.height*data.height-10)/2):box.height*data.height*.12);
		var top=Number.isFinite(vertical.top)?vertical.top:y,bottom=Number.isFinite(vertical.bottom)?vertical.bottom:y;
		var sum=top+bottom,limit=Math.max(0,box.height*data.height-10),ratio=sum>limit?limit/sum:1;
		return {x:Math.min(value,Number.isFinite(explicit)?Math.max(0,(box.width*data.width-10)/2):box.width*data.width*.12),
			y:y,top:top*ratio,bottom:bottom*ratio,requestedTop:Number.isFinite(vertical.top)?vertical.top:value,requestedBottom:Number.isFinite(vertical.bottom)?vertical.bottom:value,
			value:value,explicit:Number.isFinite(explicit)||Number.isFinite(vertical.top)||Number.isFinite(vertical.bottom),auto:!!vertical.auto};
	}
	function setPadding(value,all) {
		value=Math.max(0,Number(value)||0);var room=selected();if(!all&&!room)return;
		var before=snapshot();if(all){card.dungeonPadding=value;modules().forEach(function(r){delete r.padding;});}else room.padding=value;
		render();commit(before,all?'Set padding for all dungeon rooms':'Set room padding');
	}
	function syncRoom(room,data=card) {
		var box=room.bounds,text=data.text?.[room.textKey];if(!text)return;var pad=roomPadding(room,data);
		if(pad.auto&&window.RulesRange?.measureModuleText){
			var width=Math.max(10,box.width*data.width-2*pad.x),measured=RulesRange.measureModuleText(text,width,Number(text.rangeFontReduction)||0);
			var extra=Math.max(0,box.height*data.height-pad.top-pad.bottom-measured)/2;
			pad.top+=extra;pad.bottom+=extra;
		}
		text.x=box.x+pad.x/data.width;text.y=box.y+pad.top/data.height;
		text.width=Math.max(10/data.width,box.width-2*pad.x/data.width);
		text.height=Math.max(10/data.height,box.height-(pad.top+pad.bottom)/data.height);
	}
	function syncAll() { modules().forEach(function(room){syncRoom(room);});if(typeof drawTextBuffer==='function')drawTextBuffer(); }
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
		if(card.version==='dungeonModules')alignPipelineBounds(pipelineProfile());
		if(card.version!=='dungeonModules'||!card.dungeonAutoFit||!modules().length||!window.RulesRange?.measureModuleText)return false;
		var list=modules(),height=card.height,levels=[];
		list.forEach(function(room){if(room.geometryLocked&&room.lockedBounds)Object.assign(room.bounds,room.lockedBounds);rememberRoomHeight(room);});
		list.forEach(function(room){levels.push(room.bounds.y*height,(room.bounds.y+room.bounds.height)*height);});
		levels.sort(function(a,b){return a-b;});levels=levels.filter(function(value,i){return !i||value-levels[i-1]>.001;});
		var envelope=card.dungeonPipelineEnvelope||card.dungeonHeightLock||card.dungeonAutoFitBounds||(card.dungeonAutoFitBounds={top:levels[0]/height,bottom:levels[levels.length-1]/height});
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
				record.minimum=Math.max(20,(pad.explicit?measured+pad.requestedTop+pad.requestedBottom:Math.min(measured/.76,measured+2*padding)));
			});
			var positions=[0];
			for(var i=1;i<levels.length;i++){
				var occupied=records.some(function(record){return record.start<i&&record.end>=i;});
				positions[i]=positions[i-1]+(occupied?1:levels[i]-levels[i-1]);
				records.forEach(function(record){if(record.end===i)positions[i]=Math.max(positions[i],positions[record.start]+record.minimum);});
			}
			return positions;
		}
		var hasLocks=records.some(function(r){return r.room.geometryLocked;}),pipeline=card.dungeonPipelineEnvelope;
		function constrain(raw) {
			if(!hasLocks&&!pipeline){if(card.dungeonHeightLock){var total=raw[raw.length-1];if(total>0)return raw.map(function(p){return p*available/total;});}return raw;}
			// Fixed row boundaries preserve shared walls alongside locked rooms.
			var pins=new Map([[0,0]]);
			if(card.dungeonHeightLock||pipeline)pins.set(levels.length-1,available);
			if(pipeline){var footer=records.find(function(r){return r.room.id===pipeline.footerId;});if(footer)pins.set(footer.start,(pipeline.footerTop-envelope.top)*height);}
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
		if(room.csvRowId){var peers=modules().filter(function(r){return r.csvRowId===room.csvRowId;}),locked=peers.find(function(r){return r.geometryLocked&&r.lockedBounds;});if(locked){box.y=locked.lockedBounds.y;box.height=locked.lockedBounds.height;}peers.forEach(function(peer,i){peer.bounds.y=box.y;peer.bounds.height=box.height;if(peers.length===2&&room.csvRowBounds){peer.bounds.x=room.csvRowBounds.x+i*room.csvRowBounds.width/2;peer.bounds.width=room.csvRowBounds.width/2;}syncRoom(peer);});}
		syncRoom(room);
	}
	// Only rooms above/below each other connect; side walls remain solid.
	function doorways(list) {
		var output=[],epsilon=.001;
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
		var material=pipelineProfile();alignPipelineBounds(material);
		var segments=wallSegments(modules()),thickness=material?material.top.length/material.sourceHeight*((material.samplePlacement||material.placement).height||1)*card.height:Math.max(3,card.height*.006);
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
		if(!material){path(mask);mask.strokeStyle='#fff';mask.lineWidth=thickness;mask.stroke();}
		if(material&&!paintPipelineColors(mask,material,segments,cornerModel,path)){
			// Fill joined corners with the material's core. Outlines belong only to
			// the directional strips below; painting a second outline leaves spurs
			// where horizontal and vertical source strokes have different widths.
			var place=material.placement,core=material.top[Math.floor(material.top.length/2)],gradient=mask.createLinearGradient((place.x||0)*card.width,0,((place.x||0)+(place.width||1))*card.width,0);
			core.forEach(function(stop){gradient.addColorStop(stop.position,stop.color);});
			var widths=[thickness];if(material.left)widths.push(material.left.length/material.sourceWidth*(place.width||1)*card.width);if(material.right)widths.push(material.right.length/material.sourceWidth*(place.width||1)*card.width);widths.push(material.bottom.length/material.sourceHeight*(place.height||1)*card.height);
			path(mask);mask.strokeStyle=gradient;mask.lineWidth=Math.max(1,Math.min(...widths));mask.stroke();
			// Sample each edge in its native direction; do not mirror the lower bevel.
			var outerBottom=Math.max(...modules().map(r=>r.bounds.y+r.bounds.height))*card.height,outerLeft=Math.min(...modules().map(r=>r.bounds.x))*card.width;
			segments.forEach(function(segment){var horizontal=segment.axis==='horizontal',profile=horizontal?(Math.abs(segment.position-outerBottom)<1?material.bottom:material.top):(Math.abs(segment.position-outerLeft)<1?material.left:material.right);if(!profile)return;
				var edgeThickness=profile.length/(horizontal?material.sourceHeight:material.sourceWidth)*(horizontal?(material.placement.height||1)*card.height:(material.placement.width||1)*card.width);
				profile.forEach(function(stops,index){var offset=(index+.5)/profile.length*edgeThickness-edgeThickness/2,p=material.placement,gradient=horizontal?mask.createLinearGradient((p.x||0)*card.width,0,((p.x||0)+(p.width||1))*card.width,0):mask.createLinearGradient(0,(p.y||0)*card.height,0,((p.y||0)+(p.height||1))*card.height);stops.forEach(function(stop){gradient.addColorStop(stop.position,stop.color);});
					mask.beginPath();if(horizontal){mask.moveTo(segment.start,segment.position+offset);mask.lineTo(segment.end,segment.position+offset);}else{mask.moveTo(segment.position+offset,segment.start);mask.lineTo(segment.position+offset,segment.end);}mask.strokeStyle=gradient;mask.lineWidth=edgeThickness/profile.length+.5;mask.stroke();});
			});
		}
		// Keep outlines only where they face a room. The union includes both sides of
		// shared walls, but excludes the outward side of each exterior boundary.
		if(!material){fx.save();if(cornerModel){DungeonCorners.clipRooms(fx,cornerModel);}else{fx.beginPath();
		modules().forEach(function(room){var b=room.bounds;fx.rect(b.x*card.width,b.y*card.height,b.width*card.width,b.height*card.height);});
		fx.clip();}
		path(fx);fx.strokeStyle='rgba(0,0,0,.55)';fx.lineWidth=thickness+3;fx.stroke();
		// Clear the interior completely; reusing the translucent outline color leaves a dark tint.
		fx.globalCompositeOperation='destination-out';fx.strokeStyle='#fff';fx.lineWidth=Math.max(1,thickness-2);fx.stroke();
		fx.globalCompositeOperation='source-over';
		fx.restore();}
		// Door markers stay white above the wall texture and point down on either wall axis.
		doorways(modules()).forEach(function(door){
			var x=door.x*card.width,y=door.y*card.height;
			var opening=Math.min(card.height*.0381,door.span*(door.axis==='horizontal'?card.width:card.height)*.5);
			var width=Math.min(thickness*1.5,opening*.65),height=width*.8;
			fx.beginPath();fx.moveTo(x-width/2,y-height/2);fx.lineTo(x+width/2,y-height/2);fx.lineTo(x,y+height/2);fx.closePath();
			fx.fillStyle='#fff';fx.fill();fx.strokeStyle='rgba(0,0,0,.65)';fx.lineWidth=Math.min(1.5,width*.08);fx.stroke();
		});
		fx.restore();mask.restore();
		return !!material;
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
		var roomPad=room?roomPadding(room):{requestedTop:0,requestedBottom:0,auto:false},allPad=card.dungeonVerticalPadding||{};
		['top','bottom'].forEach(function(side){panel.querySelector('#dungeon-room-'+side).value=Math.round(roomPad[side==='top'?'requestedTop':'requestedBottom']*10)/10;panel.querySelector('#dungeon-all-'+side).value=Number.isFinite(allPad[side])?allPad[side]:panel.querySelector('#dungeon-all-padding').value;});
		panel.querySelector('#dungeon-room-distribute').checked=roomPad.auto;panel.querySelector('#dungeon-all-distribute').checked=!!allPad.auto;
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).value=p?Math.round(p[axis]*10)/10:'';});
		var color=document.querySelector('#dungeon-color');if(color){var custom=color.querySelector('[value="custom"]');if(!custom){custom=document.createElement('option');custom.value='custom';custom.textContent='Custom texture';color.appendChild(custom);}custom.disabled=!card.dungeonWallTexture;color.value=card.dungeonWallColor==='custom'&&card.dungeonWallTexture?'custom':(card.dungeonWallColor||'B');}
	}
	function mount() {
		var tab=document.querySelector('#creator-menu-dungeon');if(!tab)return;
		var input=tab.querySelector('#dungeon-input');if(input)input.closest('.readable-background')?.classList.add('hidden');
		var existing=document.querySelector('#dungeon-modules-panel');
		if(card.version!=='dungeonModules') {
			if(input)input.closest('.readable-background')?.classList.remove('hidden');
			if(existing)existing.hidden=true;
			return;
		}
		var color=document.querySelector('#dungeon-color');
		if(color&&!color.dataset.moduleColorReady){color.dataset.moduleColorReady='true';color.addEventListener('change',function(){if(card.version==='dungeonModules')card.dungeonWallColor=color.value;});}
		if(existing){existing.hidden=false;refresh();return;}
		var panel=document.createElement('div');panel.id='dungeon-modules-panel';panel.className='readable-background padding margin-bottom';
		panel.innerHTML='<h4>Room modules (prototype)</h4><p>Rooms have free-form dimensions in card pixels. Drag in Frame Design; nearby walls snap together. Only upper and lower shared walls gain a doorway.</p><label><input type="checkbox" id="dungeon-layout-lock"> Lock dungeon layout</label><p>Prevents loading a replacement frame layout. Adding frame elements always keeps the dungeon.</p><label><input type="checkbox" id="dungeon-module-height-lock"> Lock overall dungeon height</label><p id="dungeon-module-height-info"></p><label><input type="checkbox" id="dungeon-module-auto-fit"> Auto-fit room heights and use a uniform text size</label><p id="dungeon-module-fit-status"></p><select id="dungeon-module-list" class="input" size="7"></select><label>Name <input id="dungeon-module-name" class="input"></label><label><input type="checkbox" id="dungeon-room-lock"> Lock selected room position and size</label><label>Selected room padding (px)<input id="dungeon-room-padding" type="number" min="0" step="1" class="input"></label><label>All-room padding (px)<input id="dungeon-all-padding" type="number" min="0" step="1" class="input"></label><button id="dungeon-apply-padding" type="button">Apply padding to all rooms</button><h5>Vertical padding (overrides base padding)</h5><label>Selected room: top padding (px)<input id="dungeon-room-top" type="number" min="0" step="1" class="input"></label><label>Selected room: bottom padding (px)<input id="dungeon-room-bottom" type="number" min="0" step="1" class="input"></label><label><input id="dungeon-room-distribute" type="checkbox"> Selected room: distribute extra vertical space evenly</label><label>All rooms: top padding (px)<input id="dungeon-all-top" type="number" min="0" step="1" class="input"></label><label>All rooms: bottom padding (px)<input id="dungeon-all-bottom" type="number" min="0" step="1" class="input"></label><label><input id="dungeon-all-distribute" type="checkbox"> All rooms: distribute extra vertical space evenly</label><button id="dungeon-apply-vertical" type="button">Apply vertical padding to all rooms</button><p>Top and bottom values are minimum padding when redistribution is enabled.</p><div class="dungeon-module-coordinates"><label>X (px) <input type="number" step="0.1" id="dungeon-module-x" class="input"></label><label>Y (px) <input type="number" step="0.1" id="dungeon-module-y" class="input"></label><label>Width (px) <input type="number" step="0.1" min="20" id="dungeon-module-w" class="input"></label><label>Height (px) <input type="number" step="0.1" min="20" id="dungeon-module-h" class="input"></label></div><button type="button" id="dungeon-module-add">Add room</button> <button type="button" id="dungeon-module-copy">Duplicate room</button> <button type="button" id="dungeon-module-remove">Delete room</button><hr><label>Wall texture <input type="file" id="dungeon-module-texture" accept="image/*" class="input"></label><button type="button" id="dungeon-module-texture-clear">Remove uploaded texture</button><p>Upload a full-card image; its colors fill the walls while the wall outlines stay on top. Large images can exceed browser save storage.</p>';
		var destination=document.querySelector('#frame-design-dungeon-slot');if(destination)destination.appendChild(panel);else tab.prepend(panel);
		panel.querySelector('#dungeon-room-lock').onchange=function(){setRoomLock(this.checked);};
		function applyVertical(scope){setVerticalPadding(panel.querySelector('#dungeon-'+scope+'-top').value,panel.querySelector('#dungeon-'+scope+'-bottom').value,panel.querySelector('#dungeon-'+scope+'-distribute').checked,scope==='all');}
		['top','bottom','distribute'].forEach(function(key){panel.querySelector('#dungeon-room-'+key).onchange=function(){applyVertical('room');};});
		panel.querySelector('#dungeon-apply-vertical').onclick=function(){applyVertical('all');};
		panel.querySelector('#dungeon-room-padding').onchange=function(){setPadding(this.value,false);};
		panel.querySelector('#dungeon-apply-padding').onclick=function(){setPadding(panel.querySelector('#dungeon-all-padding').value,true);};
		panel.querySelector('#dungeon-layout-lock').onchange=function(){var before=snapshot();card.dungeonLayoutLocked=this.checked;commit(before,'Toggle dungeon layout lock');};
		panel.querySelector('#dungeon-module-height-lock').onchange=function(){setHeightLock(this.checked);};
		panel.querySelector('#dungeon-module-auto-fit').onchange=function(){setAutoFit(this.checked);};
		panel.querySelector('#dungeon-module-list').onchange=function(event){selectedId=event.target.value;refresh();drawCard();};
		panel.querySelector('#dungeon-module-name').onchange=function(event){var room=selected();if(!room)return;var before=snapshot();room.name=event.target.value.trim()||room.name;if(field(room))field(room).name=room.name;refresh();drawCard();commit(before,'Rename dungeon room');};
		['x','y','w','h'].forEach(function(axis){panel.querySelector('#dungeon-module-'+axis).onchange=function(){var room=selected();if(!room||room.geometryLocked)return;var before=snapshot(),value=Number(this.value);if(Number.isFinite(value)){var key={x:'x',y:'y',w:'width',h:'height'}[axis],dimension=axis==='x'||axis==='w'?card.width:card.height;room.bounds[key]=value/dimension;}snapRoom(room,axis==='w'?'right':axis==='h'?'bottom':'move');render();commit(before,'Edit dungeon room');};});
		panel.querySelector('#dungeon-module-add').onclick=function(){var before=snapshot(),source=selected(),box=source?.bounds||{x:.1,y:.15,width:.3,height:.2};var newBox={x:box.x,y:Math.min(1-box.height,box.y+box.height),width:box.width,height:box.height};addRoom(newBox);render();commit(before,'Add dungeon room');};
		panel.querySelector('#dungeon-module-copy').onclick=function(){var source=selected();if(!source)return;var before=snapshot(),box=source.bounds,copy=addRoom({x:Math.min(1-box.width,box.x+box.width),y:box.y,width:box.width,height:box.height},source.name+' Copy',field(source)?.text);if(Number.isFinite(source.padding))copy.padding=source.padding;if(source.verticalPadding)copy.verticalPadding=JSON.parse(JSON.stringify(source.verticalPadding));copy.cornerStyles=JSON.parse(JSON.stringify(source.cornerStyles||{}));var text=field(copy),original=field(source);if(text&&original){Object.assign(text,JSON.parse(JSON.stringify(original)));text.name=copy.name;if(source.autoFitFont)copy.autoFitFont=JSON.parse(JSON.stringify(source.autoFitFont));syncRoom(copy);}render();commit(before,'Duplicate dungeon room');};
		panel.querySelector('#dungeon-module-remove').onclick=function(){var room=selected();if(!room)return;remove(room.id);};
		panel.querySelector('#dungeon-module-texture').onchange=function(){var file=this.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){alert('Please upload an image file.');return;}var before=snapshot(),reader=new FileReader();reader.onload=function(){var image=new Image();image.onload=function(){card.dungeonWallTexture=reader.result;card.dungeonWallColor='custom';window.dungeonTextureCustom=image;document.querySelector('#dungeon-color').value='custom';render();commit(before,'Change dungeon wall texture');};image.onerror=function(){alert('This image could not be loaded as a wall texture.');};image.src=reader.result;};reader.readAsDataURL(file);};
		panel.querySelector('#dungeon-module-texture-clear').onclick=function(){if(!card.dungeonWallTexture)return;var before=snapshot();card.dungeonWallTexture='';if(card.dungeonWallColor==='custom')card.dungeonWallColor='B';window.dungeonTextureCustom=null;panel.querySelector('#dungeon-module-texture').value='';render();commit(before,'Remove dungeon wall texture');};
		refresh();
	}
	function remove(roomId) { var before=snapshot(),index=modules().findIndex(function(room){return room.id===roomId;});if(index<0)return;var room=modules().splice(index,1)[0];delete card.text[room.textKey];selectedId=modules()[Math.min(index,modules().length-1)]?.id||'';loadTextOptions(card.text,true);render();commit(before,'Delete dungeon room'); }
	window.DungeonModules={capturePipelineMaterial:capturePipelineMaterial,applyCsvRooms:applyCsvRooms,initialize:initialize,mount:mount,render:render,reflow:reflow,setAutoFit:setAutoFit,setRoomLock:setRoomLock,setHeightLock:setHeightLock,setPadding:setPadding,setVerticalPadding:setVerticalPadding,roomPadding:roomPadding,refresh:refresh,modules:modules,selected:selected,select:function(roomId){selectedId=roomId;refresh();},remove:remove,snapRoom:snapRoom,syncRoom:syncRoom,doorways:doorways,wallSegments:wallSegments,drawWalls:drawWalls,toGrid:toGrid,grid:grid};
})();
