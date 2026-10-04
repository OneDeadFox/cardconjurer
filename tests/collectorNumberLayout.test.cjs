const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('js/creator-23.js','utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function collectorInfoRenderFields('),source.indexOf('async function bottomInfoEdited(')),context);
const fields={midLeft:{text:'{elemidinfo-set} • {elemidinfo-language}'},topLeft:{text:'{elemidinfo-number}',x:.0647,y:.9377,width:.8707,size:.0171,rotation:90},rarity:{text:'{loadx}{elemidinfo-rarity}'}};
const before=JSON.stringify(fields),output=context.collectorInfoRenderFields(fields,'001/001'),number=output.find(([key])=>key==='topLeft')[1];assert.equal(number.text,'{elemidinfo-number}  {elemidinfo-rarity}');assert.equal(number.collectorNumberInline,true);assert.equal(number.rotation,90);assert.equal(number.x,fields.topLeft.x);assert.ok(!output.some(([key])=>key==='rarity'));assert.equal(JSON.stringify(fields),before,'Rendering must not rewrite the saved collector layout');
for(const value of ['0001/1000','1/1'])assert.equal(context.collectorInfoRenderFields(fields,value).length,2);
assert.equal(context.collectorInfoRenderFields(fields,'001').length,3,'Non-total collector numbers keep their existing format');
const modern={...fields,topLeft:{text:'{elemidinfo-rarity} {kerning3}{elemidinfo-number}{kerning0}'}};assert.equal(context.collectorInfoRenderFields(modern,'001/001').length,3,'Modern/custom ordering remains unchanged');assert.equal(context.collectorInfoRenderFields(null,'001/001').length,0);
// The renderer uses the combined row's literal number rather than character justification.
assert.ok(source.includes("wordToWrite.includes('/') && !textObject.collectorNumberInline"));
console.log('PASS: collector number/total and rarity share one naturally spaced row, preserving layout, rotation and custom formats.');
