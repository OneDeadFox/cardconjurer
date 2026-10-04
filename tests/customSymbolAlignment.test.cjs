const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const creator=fs.readFileSync('js/creator-23.js','utf8');
const section=(from,to)=>creator.slice(creator.indexOf(from),creator.indexOf(to,creator.indexOf(from)));
const images=[];
function context2d(){return {font:'58px mplantin',clearRect(){},fillText(){},strokeText(){},drawImage(image,x,y,width,height){images.push({image,x,y,width,height,font:this.font});},measureText(text){const size=parseFloat(this.font);return {width:String(text).length*size*.45,actualBoundingBoxAscent:size*.65,actualBoundingBoxDescent:0};}};}
const inputs=new Map();
const ctx={console,Map,Set,savedFont:null,params:new URLSearchParams(),mana:new Map(),builtInManaSymbolNames:new Set(['w']),
  Image:class{constructor(){this.naturalWidth=512;this.naturalHeight=585;}set src(value){this.source=value;this.onload();}},
  card:{width:1500,height:2100,marginX:0,marginY:0,frames:[],text:{}},
  document:{querySelector(selector){if(!inputs.has(selector))inputs.set(selector,{value:'',checked:false});return inputs.get(selector);}},
  drawTextBuffer(){},FontLoadTracker:{track(){}},
  paragraphCanvas:{},lineCanvas:{},paragraphContext:context2d(),lineContext:context2d(),prePTContext:context2d(),
  navigator:{userAgent:'Chrome'},getManaSymbol:key=>ctx.mana.get(key),
};ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(section('function scaleX(','function normalizeCardOrientation('),ctx);
vm.runInContext(section('var CARD_TEXT_IMPORT_MAX_REDUCTION','function drawTextBuffer('),ctx);
vm.runInContext(section('const customManaSymbolNames','function clearCustomManaSymbols('),ctx);
vm.runInContext(section('var justifyWidth =','CanvasRenderingContext2D.prototype'),ctx);
(async()=>{
  await ctx.registerCustomManaSymbol('stage','data:image/png;base64,test');
  const symbol=ctx.mana.get('stage');
  assert.equal(symbol.width/symbol.height,512/585,'custom symbol retains its original proportions');
  const field={name:'2 - Cost',text:'4{stage}:',x:0,y:0,width:.4,height:.08,size:.0277,font:'mplantin',oneLine:true};ctx.card.text.cost=field;
  await ctx.writeText(field,context2d());
  let rendered=images.filter(item=>item.image===symbol.image).at(-1);
  assert.ok(rendered,'real text writer renders the custom symbol inline');
  const size=parseFloat(rendered.font),canvasMargin=300;
  assert.ok(Math.abs(rendered.y+rendered.height/2-(canvasMargin+size*.7-size*.65/2))<.001,'symbol’s center aligns with the measured numeral center');
  assert.ok(Math.abs(rendered.width/rendered.height-512/585)<.001);
  await ctx.registerCustomManaSymbol('stage','data:image/png;base64,test',{scale:1.2,verticalOffset:.1});
  images.length=0;await ctx.writeText(field,context2d());
  rendered=images.filter(item=>item.image===ctx.mana.get('stage').image).at(-1);
  assert.ok(Math.abs(rendered.height-size*.78*1.2)<.001,'saved symbol scale is applied');
  assert.ok(Math.abs(rendered.y+rendered.height/2-(canvasMargin+size*.7-size*.65/2+size*.1))<.001,'saved vertical adjustment is relative to font size');
  const drawCtx=vm.createContext({});vm.runInContext(section('function drawFrameLayerImage(','function drawFrameLayerMask('),drawCtx);
  const calls=[],canvasContext={save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},rect(){},clip(){},drawImage(...args){calls.push(args);}};
  const image={naturalWidth:200,naturalHeight:100};
  drawCtx.drawFrameLayerImage(canvasContext,image,10,20,100,100,{imageFit:'fit'});
  assert.deepEqual(calls.pop().slice(1),[-50,-25,100,50],'Fit preserves image proportions inside the container');
  drawCtx.drawFrameLayerImage(canvasContext,image,10,20,100,100,{imageFit:'fill'});
  assert.deepEqual(calls.pop().slice(1),[-100,-50,200,100],'Fill preserves proportions while cropping');
  drawCtx.drawFrameLayerImage(canvasContext,image,10,20,100,100,{});
  assert.deepEqual(calls.pop().slice(1),[10,20,100,100],'existing frames keep their original stretch behavior');
  console.log('PASS: inline custom-symbol proportions, numeral alignment, per-symbol adjustments and frame image fitting.');
})().catch(error=>{console.error(error);process.exitCode=1;});
