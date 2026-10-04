const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/creator-23.js','utf8'),start=source.indexOf('function writeText(textObject, targetContext) {'),end=source.indexOf('\n\ttextWidth = collisionFit.width;',start);
const prefix=source.slice(start,end)+'\n}';
for(const text of ['', ' \n\t']){
 const records=[];
 const context={scaleX:v=>v*2814,scaleY:v=>v*2010,scaleWidth:v=>v*2814,scaleHeight:v=>v*2010,getCardTextCollisionFit:()=>({key:'prototype',width:2000,height:8}),recordCardTextFit:(...args)=>records.push(args)};
 vm.createContext(context);vm.runInContext(prefix,context);
 const field={text,x:.1,y:.9,width:.8,height:8/2010,size:.05068,rangeUniformTextSize:true,rangeFontReduction:20};
 context.writeText(field,{});
 assert.equal(records.length,1);assert.equal(records[0][4],false,'An empty 8px field fits without shrinking the shared font');assert.equal(records[0][2],records[0][3],'Empty fields add no extra reduction');assert.equal(field.rangeFontReduction,20,'Existing shared sizing remains intact');
}
console.log('PASS: blank and whitespace-only fields fit without phantom line height or extra font shrink.');
