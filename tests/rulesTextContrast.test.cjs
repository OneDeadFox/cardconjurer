const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createCanvas}=require('@napi-rs/canvas');
const source=fs.readFileSync('js/creator-23.js','utf8');
const cardCanvas=createCanvas(1000,600),background=cardCanvas.getContext('2d');
const rules={name:'Rules Text',x:0,y:0,width:1,height:.5};
const prototype={name:'Loot Box',sectionField:'prototype',x:0,y:.5,width:1,height:.5};
const title={name:'Title',oneLine:true,x:0,y:0,width:1,height:.5};
const card={text:{rules,prototype,title}};
const context={card,cardCanvas,document:{createElement:()=>createCanvas(15,9)},
 scaleX:x=>x*1000,scaleY:y=>y*600,scaleWidth:x=>x*1000,scaleHeight:y=>y*600,
 cardTextSemanticRole:(field)=>field===title?'title':'rules'};
context.window=context;vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('window.CardRulesTextColors ='),source.indexOf('async function drawTextOnce')),context);
function paint(top,bottom){background.fillStyle=top;background.fillRect(0,0,1000,300);background.fillStyle=bottom;background.fillRect(0,300,1000,300);}
paint('#183321','#d5cbaf');
assert.equal(context.sampleCardRulesTextColors(),true);
assert.equal(context.CardRulesTextColors.get(rules),'white');
assert.equal(context.CardRulesTextColors.get(prototype),'black','Prototype is sampled independently');
assert.equal(context.CardRulesTextColors.get(title),undefined,'Title is unchanged');
assert.equal(context.sampleCardRulesTextColors(),false,'Stable background does not schedule another redraw');
paint('#d9d9d9','#222222');context.sampleCardRulesTextColors();
assert.equal(context.CardRulesTextColors.get(rules),'black','Moving or replacing art recalculates contrast');
assert.equal(context.CardRulesTextColors.get(prototype),'white');
// Gold-tinted medium background, without the old white text inflating brightness.
paint('#8b7448','#222222');context.sampleCardRulesTextColors();
assert.equal(context.CardRulesTextColors.get(rules),'black','Medium gold rules backgrounds use black');
paint('#111111','#111111');context.sampleCardRulesTextColors();
paint('#8b7448','#222222');context.sampleCardRulesTextColors();
assert.equal(context.CardRulesTextColors.get(rules),'black','Gold switches to black even after a dark card chose white');
// Actual source-over transparent rules box over dark artwork.
paint('#111111','#111111');background.fillStyle='rgba(255,255,255,.6)';background.fillRect(0,0,1000,300);
context.sampleCardRulesTextColors();assert.equal(context.CardRulesTextColors.get(rules),'black');
rules.autoTextColor=false;context.sampleCardRulesTextColors();assert.equal(context.CardRulesTextColors.get(rules),undefined);
delete rules.autoTextColor;
context.cardRulesColorSample={getContext:()=>({clearRect(){},drawImage(){},getImageData(){throw Error('SecurityError');}})};
assert.doesNotThrow(()=>context.sampleCardRulesTextColors(),'Unreadable images do not break export');
assert.equal(context.CardRulesTextColors.get(prototype),undefined);
assert.ok(source.indexOf('textColor = window.CardRulesTextColors')<source.indexOf("textColor = possibleCode.replace('fontcolor'"),'Inline manual color codes take precedence');
console.log('PASS: independent rules/prototype contrast, art changes, transparency, stable redraws, manual overrides, and unreadable-image fallback.');
