const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const creator=fs.readFileSync('js/creator-23.js','utf8'),section=(from,to)=>creator.slice(creator.indexOf(from),creator.indexOf(to,creator.indexOf(from)));
function context2d(){return {font:'58px mplantin',clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},fillText(){},strokeText(){},drawImage(){},measureText(text){const size=parseFloat(this.font);return {width:String(text).length*size*.45,actualBoundingBoxAscent:size*.65,actualBoundingBoxDescent:size*.1};}};}
const ctx={console,Map,Set,savedFont:null,mana:new Map(),FontLoadTracker:{track(){}},paragraphCanvas:{},lineCanvas:{},paragraphContext:context2d(),lineContext:context2d(),prePTContext:context2d(),navigator:{userAgent:'Chrome'},getManaSymbol(){},card:{width:2814,height:2010,marginX:0,marginY:0,text:{},frames:[]},document:{querySelector:()=>({checked:false,value:''})}};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(section('function scaleX(','function normalizeCardOrientation('),ctx);
vm.runInContext(section('var CARD_TEXT_IMPORT_MAX_REDUCTION','function drawTextBuffer('),ctx);
vm.runInContext(section('var justifyWidth =','CanvasRenderingContext2D.prototype'),ctx);
const field={name:'Prototype Rules',csvFieldLabel:'Loot Box',sectionField:'prototype',text:'Search your library for an artifact card, a creature card, and a land card. Put them onto the battlefield tapped.',x:.1,y:.75,width:.8,height:.18,size:.0295};
ctx.card.text['prototype-layer-random']=field;
const badge={name:'Multicolored Power/Toughness',bounds:{x:.78,y:.83,width:.14,height:.1},opacity:100};ctx.card.frames=[badge];
for(const data of [field,{...field,sectionField:undefined},{name:'Renamed text',standardRole:'rules'},{name:'Rules',csvFieldLabel:'custom',sectionField:'prototype'}])assert.equal(ctx.cardTextSemanticRole(data,'random-id'),'rules','Custom labels and generated IDs retain rules semantics');
assert.equal(ctx.cardTextSemanticRole({name:'Prototype Mana Cost',manaCost:true}),'mana');assert.equal(ctx.cardTextSemanticRole({name:'Prototype Power/Toughness'},'pt2'),'pt');
const fit=ctx.getCardTextCollisionFit(field,ctx.scaleWidth(field.width),ctx.scaleHeight(field.height));assert.equal(fit.regions.length,1);assert.deepEqual(Array.from(fit.obstacles),['Power/Toughness Box']);
const obstacle=fit.regions[0],full=ctx.scaleWidth(field.width),above=ctx.cardTextLineAvailableWidth(fit.regions,0,30,full,0),beside=ctx.cardTextLineAvailableWidth(fit.regions,obstacle.top+1,30,full,0);assert.equal(above,full,'Lines above the badge retain full width');assert.ok(beside<full,'Only lines beside the visible P/T asset are shortened');
ctx.writeText(field,context2d());let rendered=ctx.cardTextFitResults.find(item=>item.key==='prototype-layer-random');assert.equal(rendered.failed,false,'Actual renderer fits the prototype text safely');assert.ok(rendered.obstacles.includes('Power/Toughness Box'));
// The frame asset remains the obstacle even without a P/T text field.
assert.equal(Object.keys(ctx.card.text).length,1);badge.bounds.x=.7;const moved=ctx.getCardTextCollisionFit(field,full,ctx.scaleHeight(field.height));assert.ok(moved.regions[0].left<obstacle.left,'Wrapping follows the moved badge');badge.hidden=true;assert.equal(ctx.getCardTextCollisionFit(field,full,ctx.scaleHeight(field.height)).regions.length,0,'Hidden badges do not reserve space');
console.log('PASS: Boss Prototype/Loot Box fields wrap around visible P/T assets with generated keys, renamed labels and moved badges.');
