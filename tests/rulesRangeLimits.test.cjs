const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={card:{width:1000,height:1000,text:{},frames:[]},document:{querySelector:()=>null},console,addEventListener(){}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('js/rulesRange.js','utf8'),context);
const range={id:'test',bounds:{x:0,y:0,width:1,height:.5},modules:[{id:'a',sizing:'flex',size:1,maxSize:100},{id:'b',sizing:'flex',size:1}]};
let layouts=context.RulesRange.getModuleLayouts(range);assert.equal(layouts[0].pixels,100);assert.equal(layouts[1].pixels,400);assert.equal(layouts[1].bounds.y,.1);
range.modules[0].minSize=80;range.modules[1].maxSize=200;layouts=context.RulesRange.getModuleLayouts(range);assert.equal(layouts[0].pixels,100);assert.equal(layouts[1].pixels,200,'Maximums may leave unused space');
range.modules[0].minSize=300;range.modules[1].minSize=300;layouts=context.RulesRange.getModuleLayouts(range);assert.equal(layouts[0].pixels,300);assert.equal(layouts[1].pixels,300);assert.equal(range.fitOverflow,true,'Conflicting minimums are reported');
const saved=JSON.parse(JSON.stringify(range));assert.equal(saved.modules[0].minSize,300);assert.equal(saved.modules[1].maxSize,300,'Limits survive serialization');
console.log('PASS: range height limits, redistribution, unused space, overflow and serialization.');
