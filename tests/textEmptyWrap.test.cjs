const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// Exercise the production writer, recording actual paragraph line placement.
const source=fs.readFileSync('js/creator-23.js','utf8');
const writer=source.slice(source.indexOf('function writeText('),source.indexOf('CanvasRenderingContext2D.prototype.fillTextArc'));
function render(text,width=95,oneLine=false){
 const lines=[],ink=[];
 const widths={Destroy:65,target:55,noncreature:96,'permanent.':97,' ':5,Exact:95};
 const lineContext={font:'',measureText(word){return {width:widths[word]??word.length*10};},clearRect(){ink.length=0;},fillText(word){ink.push(word);},drawImage(){},save(){},restore(){}};
 const paragraphContext={clearRect(){lines.length=0;},drawImage(canvas,x,y){lines.push({text:ink.join(''),y});}};
 const ctx={console,card:{version:'dungeonModules',frames:[]},scaleX:x=>x||0,scaleY:y=>y||0,scaleWidth:x=>x||0,scaleHeight:y=>y||0,
  paragraphCanvas:{},lineCanvas:{},paragraphContext,lineContext,savedFont:null,
  document:{querySelector:()=>({checked:false,value:'x'})},FontLoadTracker:{track(){}},splitCJKCharacters:x=>x,prescanRubySize:()=>null,
  getCardTextCollisionFit:(t,w,h)=>({width:w,height:h,regions:[]}),cardTextInkBounds:()=>({top:0,bottom:20}),cardTextLinesOverlapRegions:()=>false,recordCardTextFit(){}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(writer,ctx);
 ctx.writeText({name:'Room',text,width,height:500,size:20,align:'center',oneLine}, {drawImage(){}});
 return lines;
}
const result=render('Destroy target noncreature permanent.');
assert.deepEqual(result.map(l=>l.text.trim()),['Destroy','target','noncreature','permanent.']);
assert.deepEqual(result.map(l=>l.y),[0,20,40,60],'Narrow room words must not insert an empty row');
assert.deepEqual(render('Exact').map(l=>l.text),['Exact'],'Exact-width first word fits without a blank first line');
assert.deepEqual(render('Destroy\n\ntarget',200).map(l=>l.y),[0,27,54],'Explicit paragraph breaks are preserved');
assert.deepEqual(render('Destroy target',200).map(l=>l.text),['Destroy target'],'Ordinary wrapping is unchanged');
console.log('PASS: production text writer handles oversized and exact-width words without blank rows, preserving explicit breaks.');
