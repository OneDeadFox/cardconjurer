const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/creator-23.js'), 'utf8');
const drawText = source.slice(source.indexOf('async function drawText() {'), source.indexOf('\nvar justifyWidth ='));
const calls = [];
const context = vm.createContext({
  card: {},
  window: {FrameTextPresets: {sync: () => calls.push('sync')}},
  textCanvas: {width: 750, height: 1050},
  prePTCanvas: {width: 750, height: 1050},
  textContext: {clearRect: () => calls.push('clear text')},
  prePTContext: {clearRect: () => calls.push('clear pt')},
  resetCardTextFitState: () => calls.push('reset'),
  writeText: async text => calls.push(text.text),
  publishCardTextFitState: () => calls.push('publish'),
  redrawFrames: false,
  drawCard: () => calls.push('draw card'),
});
vm.runInContext(drawText, context);

(async () => {
  for (const card of [{}, {text: null}, null]) {
    const before = JSON.stringify(card);
    context.card = card;
    await context.drawText();
    assert.deepEqual(calls, [], 'early redraw must wait for text initialization');
    assert.equal(JSON.stringify(card), before, 'early redraw must preserve the frame initialization sentinel');
  }
  context.card = {version: 'm15Regular', text: {rules: {text: 'Initialized rules'}}};
  await context.drawText();
  assert.deepEqual(calls, ['sync', 'clear text', 'clear pt', 'reset', 'Initialized rules', 'publish', 'draw card']);
  calls.length=0;
  context.card.text={rules:{text:'Main rules'},prototype:{text:'Prototype rules'}};
  context.cardTextFitResults=[];
  context.resetCardTextFitState=()=>{calls.push('reset');context.cardTextFitResults=[];};
  context.writeText=async field=>{calls.push(field.text);const key=field===context.card.text.rules?'rules':'prototype';context.cardTextFitResults.push({key,failed:key==='prototype'});};
  context.window.FrameSectionTools={fitUniformText:async fits=>{assert.equal(await fits(context.card.text.rules,'rules'),true);assert.equal(await fits(context.card.text.prototype,'prototype'),false);calls.push('fit uniform');}};
  await context.drawText();
  assert.ok(calls.indexOf('fit uniform')<calls.indexOf('clear text'),'Shared sizing uses renderer fit results before the final canvas is cleared and redrawn');
  assert.equal(calls.filter(call=>call==='publish').length,1,'Only the completed render publishes fit results');
  assert.equal(calls.filter(call=>call==='Main rules').length,2);assert.equal(calls.filter(call=>call==='Prototype rules').length,2);
  console.log('PASS: early text redraw waits for initialization; initialized text renders normally.');
})().catch(error => {console.error(error); process.exitCode = 1;});
