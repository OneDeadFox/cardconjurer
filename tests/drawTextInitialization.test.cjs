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
  console.log('PASS: early text redraw waits for initialization; initialized text renders normally.');
})().catch(error => {console.error(error); process.exitCode = 1;});
