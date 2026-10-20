const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../compressor.js'), 'utf8');
function boot({width = 4000, height = 2000, encodedSize = 10, canvasContext = true} = {}) {
  const state = {closed: false};
  const canvas = {getContext() { return canvasContext ? {drawImage() {state.drawn = true;}} : null; },
    toBlob(callback, type, quality) {
      Object.assign(state, {width: this.width, height: this.height, type, quality});
      callback(new Blob([new Uint8Array(encodedSize)], {type}));
    }};
  const runtime = vm.createContext({Blob, URL, Uint8Array,
    createImageBitmap: async () => ({width, height, close() {state.closed = true;}}),
    document: {currentScript: {src: 'https://example.test/compressor.js'}, createElement: () => canvas}
  });
  vm.runInContext(script, runtime);
  return {api: runtime.ShrinqCompressorUtil, state, canvas};
}
test('PNG resizing keeps its format, aspect ratio and releases image memory', async () => {
  const {api, state, canvas} = boot();
  const result = await api.compress(new Blob([new Uint8Array(100)], {type: 'image/png'}));
  assert.equal(result.type, 'image/png');
  assert.equal(result.size, 10);
  assert.equal(state.width, 2000); assert.equal(state.height, 1000);
  assert.ok(state.closed); assert.ok(state.drawn);
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
});
test('JPEG options control quality and dimensions; larger output retains original', async () => {
  const {api, state} = boot({encodedSize: 200});
  const original = new Blob([new Uint8Array(100)], {type: 'image/jpeg'});
  assert.strictEqual(await api.compress(original, original.type, {quality: 0.3, maxImageSide: 1400}), original);
  assert.equal(state.quality, 0.3); assert.equal(state.width, 1400); assert.equal(state.height, 700);
});
test('oversized images and unavailable canvas fail explicitly and release image memory', async () => {
  for (const options of [{width: 10000, height: 10000}, {canvasContext: false}]) {
    const {api, state, canvas} = boot(options);
    await assert.rejects(api.compress(new Blob(['image'], {type: 'image/png'})), /64 megapixel|initialize image/);
    assert.ok(state.closed); assert.equal(canvas.width, 0);
  }
});
