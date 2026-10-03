const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const creator = fs.readFileSync('js/creator-23.js', 'utf8');
const builder = fs.readFileSync('js/csvCardBuilder.js', 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
function section(source, from, to) { return source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from))); }
function context2d() {
  return {font:'76px mplantin', clearRect(){}, drawImage(){}, fillText(){}, strokeText(){},
    measureText(text) { return {width:String(text).length * parseFloat(this.font) * .45}; }};
}
const inputs = new Map();
const ctx = {
  console, setTimeout(){}, savedFont:null, params:new URLSearchParams(),
  card:{width:1500,height:2100,marginX:0,marginY:0,text:{},frames:[]},
  document:{querySelector(selector) {
    if (!inputs.has(selector)) inputs.set(selector, {value:'',checked:false});
    return inputs.get(selector);
  }},
  resetCardIrregularities:async()=>{}, autoFitArt(){}, resetSetSymbol(){}, resetWatermark(){},
  loadFramePack(){}, loadTextOptions(text) {
    for (const key of Object.keys(text)) text[key].text=ctx.card.text[key]?.text || '';
    ctx.card.text=text;
  },
  FontLoadTracker:{track(){}}, setSymbol:{src:'/img/blank.png'},
  paragraphCanvas:{},lineCanvas:{},paragraphContext:context2d(),lineContext:context2d(),
  prePTContext:context2d(),
};
ctx.window=ctx;
vm.createContext(ctx);
vm.runInContext(section(creator, 'function scaleX(', 'function normalizeCardOrientation('), ctx);
vm.runInContext(section(creator, 'var CARD_TEXT_COLLISION_MINIMUM_REDUCTION', 'function drawTextBuffer('), ctx);
vm.runInContext(section(creator, 'var justifyWidth =', 'CanvasRenderingContext2D.prototype'), ctx);
vm.runInContext(fs.readFileSync('js/frames/packM15Regular-1.js','utf8'), ctx);
const loadRegular=inputs.get('#loadFrameVersion').onclick;
function drawRules() {
  const placements=[];
  ctx.resetCardTextFitState();
  ctx.writeText(ctx.card.text.rules, {drawImage(canvas,x,y){placements.push({x,y});}});
  return {placements,fit:clone(ctx.cardTextFitResults)};
}
(async()=>{
  await loadRegular();
  const freshDefinitions=clone(ctx.card.text);
  ctx.card.frames=[clone(ctx.availableFrames.find(f=>f.name==='White Power/Toughness'))];
  ctx.card.text.rules.text='Short ability text';
  const blankPT=drawRules();
  ctx.card.text.pt.text='2/2';
  assert.deepEqual(drawRules(),blankPT,'a visible P/T frame reserves the same space with or without P/T text');
  const area=ctx.getCardTextCollisionFit(ctx.card.text.rules,1242,604);
  assert.equal(area.height,604,'P/T must not shorten the full rules area or change its centering');
  assert.ok(area.regions.length,'visible P/T frame remains a collision obstacle');
  assert.equal(ctx.cardTextLinesOverlapRegions([{left:0,right:800,top:550,bottom:600}],area.regions,0,0),false,
    'short last line can use the space to the left of P/T');
  assert.equal(ctx.cardTextLinesOverlapRegions([{left:0,right:1242,top:550,bottom:600}],area.regions,0,0),true,
    'long last line cannot cross the P/T frame');

  // A full-height paragraph with a short final line retains the baseline font;
  // extending that line into the box must cause a fit retry.
  ctx.card.text.rules={name:'Rules Text',x:0,y:0,width:1,height:.30,size:.0362,
    noVerticalCenter:true,text:Array(7).fill('word '.repeat(7).trim()).join('\n')};
  ctx.card.frames[0].bounds={x:.75,y:.26,width:.20,height:.08};
  assert.equal(drawRules().fit.length,0,'short lines stay full size beside the box');
  ctx.card.text.rules.text += ' word'.repeat(10);
  const crowded=drawRules();
  assert.ok(crowded.fit.some(f=>f.reduction>0),'actual overlap triggers font reduction');

  // Reloading a regular layout replaces previous edits while keeping card text.
  ctx.card.text.rules.fontSize=-12;
  await loadRegular();
  for (const key of Object.keys(freshDefinitions)) {
    const current=clone(ctx.card.text[key]);current.text='';
    assert.deepEqual(current,freshDefinitions[key],'Load Frame restores fresh '+key+' geometry/style');
  }

  // Exercise the real preview pipeline with a cached layout, after another
  // frame has changed dimensions/version/symbol and art geometry.
  Object.assign(ctx, {
    applyNamedProjectTemplate:async()=>{}, applyBuiltInFrameTemplate:async()=>{},
    loadCardData:async data=>{ctx.card=clone(data);return true;},
    applyMappedOrientation:async()=>{},setInputValue(){},selectedTextIndex:0,
    applyMappedArt:async()=>{},waitForCardFonts:async()=>{},applyMappedFrame:async()=>{},
    applyMappedSetSymbol:async()=>{},applyMappedImageFields:async()=>[],applyMappedFeatures(){},
    hasOwn:(o,k)=>Object.hasOwn(o,k),drawText:async()=>{}, activeTransformLayout:false,
  });
  vm.runInContext(section(builder,'async function applyPreviewToCurrentCard(', '\n\tfunction ',),ctx);
  const baseline={width:1500,height:2100,version:'m15Regular',text:clone(ctx.card.text),frames:[],
    artBounds:{x:.0767,y:.1129,width:.8476,height:.4429},
    setSymbolBounds:{x:.9213,y:.591,width:.12,height:.041},csvImport:{}};
  ctx.card={...clone(baseline),width:2100,height:1500,version:'other',artBounds:{x:0,y:0,width:1,height:1}};
  await ctx.applyPreviewToCurrentCard({appliedBuiltInLayout:'M15Regular-1',card:baseline,warnings:[]});
  assert.deepEqual(clone(ctx.card),baseline,'cached CSV preview restores the whole layout, not just text');
  console.log('PASS: regular frame defaults/reload, cached CSV layout restoration, stable P/T centering and line-aware collision fit.');
})().catch(error=>{console.error(error);process.exitCode=1;});
