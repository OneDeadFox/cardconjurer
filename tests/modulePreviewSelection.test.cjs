const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/rulesTextStyles.js', 'utf8');
const start = source.indexOf('\tfunction beginPreviewDrag(');
const end = source.indexOf('\tfunction editSelected(', start);
let refreshes = 0, commits = 0, relativeUpdates = 0;
const select = {value: '0'}, replace = {disabled: true};
const handlers = new Map();
const part = {style: {}, classList: {toggle() {}}, setPointerCapture() {},
  hasPointerCapture() {return true;}, releasePointerCapture() {},
  addEventListener(name, fn) {handlers.set(name, fn);},
  removeEventListener(name) {handlers.delete(name);}};
const preview = {getBoundingClientRect: () => ({width: 500, height: 250}),
  querySelectorAll: () => [part]};
const frame = {designLayerId: 'banner', bounds: {x: 0, y: 0, width: 1, height: .2}};
const context = {
  card: {width: 1000, height: 1400, frames: [frame], text: {ability: {x: 0, y: .1, width: 1, height: .1}}},
  document: {querySelector: id => ({'#rules-module-elements': select, '#rules-module-replace': replace, '#rules-module-preview': preview})[id]},
  createDesignStateSnapshot: () => ({}), commitDesignUndoSnapshot: () => commits++,
  RulesRange: {snapBounds() {}, syncElements() {}, updateElementRelative() {relativeUpdates++;}},
  refreshModule: () => refreshes++, positionPart() {}, drawFrames() {}, drawTextBuffer() {}
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
function down(entry, index) {
  context.beginPreviewDrag({button: 0, pointerId: 1, clientX: 50, clientY: 50,
    target: {closest: () => null, dataset: {}}, preventDefault() {}}, part, entry, index,
    {x: 0, y: 0, width: 1, height: .2});
}
function emit(name, x = 50, y = 50) {handlers.get(name)({pointerId: 1, clientX: x, clientY: y});}
const banner = {kind: 'frame', key: 'banner'};
down(banner, 1);
assert.equal(replace.disabled, false, 'Image selection immediately enables replacement');
emit('pointermove', 51, 51); emit('pointerup');
assert.equal(select.value, 1);
assert.equal(refreshes, 0, 'Plain clicks preserve the preview DOM for click/double-click dispatch');
assert.equal(commits, 0, 'Selection is not a geometry undo action');
assert.equal(frame.bounds.x, 0, 'Pointer jitter does not move the banner');
down(banner, 1); emit('pointercancel');
assert.equal(refreshes, 0, 'Unmoved cancellation preserves selection controls');
down(banner, 1); emit('pointermove', 75, 50); emit('pointerup');
assert.equal(frame.bounds.x, .05);
assert.equal(relativeUpdates, 1); assert.equal(commits, 1); assert.equal(refreshes, 1);
down(banner, 1); emit('pointermove', 100, 50); emit('pointercancel');
assert.equal(frame.bounds.x, .05, 'Canceled movement restores geometry');
assert.equal(commits, 1);
down({kind: 'text', key: 'ability'}, 0); emit('pointerup');
assert.equal(replace.disabled, true, 'Selecting text disables image replacement');
console.log('Module preview selection and drag regression checks passed');
