const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../compressor.js'), 'utf8');
function bootWorker() {
  const workers = [], timers = new Set();
  class Worker {
    constructor(url, options) { this.url = url; this.options = options; this.sent = []; workers.push(this); }
    postMessage(...args) { this.sent.push(args); }
    terminate() { this.terminated = true; }
  }
  const runtime = vm.createContext({Blob, URL, Worker, Uint8Array, ShrinqPdfWorkerSource: '/* test worker */',
    document: {currentScript: {src: 'https://example.test/tools/shrinq-compressor-util/compressor.js'}},
    setTimeout(callback) { timers.add(callback); return callback; }, clearTimeout(callback) { timers.delete(callback); }
  });
  vm.runInContext(script, runtime);
  return {api: runtime.ShrinqCompressorUtil, workers, timers};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('PDF bytes wait for the engine ready handshake and worker memory is released on completion', async () => {
  const {api, workers, timers} = bootWorker();
  const pending = api.compress(new Blob(['PDF data'], {type: 'application/pdf'}));
  await tick();
  const worker = workers[0];
  assert.equal(worker.options, undefined, 'The self-contained worker uses a classic Blob URL.');
  assert.match(worker.url, /^blob:/);
  assert.equal(worker.sent.length, 0, 'Sending during module/WASM initialization can lose the file');
  worker.onmessage({data: {ready: true}});
  assert.equal(worker.sent.length, 1);
  const [input, transfer] = worker.sent[0];
  assert.equal(Buffer.from(input.bytes).toString(), 'PDF data'); assert.strictEqual(transfer[0], input.bytes);
  worker.onmessage({data: {bytes: new Uint8Array([65, 66])}});
  const result = await pending;
  assert.equal(await result.text(), 'AB'); assert.equal(result.type, 'application/pdf');
  assert.ok(worker.terminated); assert.equal(timers.size, 0);
});

test('PDFs are processed sequentially and a worker failure does not stall the next file', async () => {
  const {api, workers, timers} = bootWorker();
  const first = api.compress(new Blob(['first']), 'application/pdf').catch(error => error);
  const second = api.compress(new Blob(['second']), 'application/pdf');
  await tick(); assert.equal(workers.length, 1);
  workers[0].onerror();
  assert.match((await first).message, /PDF engine could not load/);
  await tick(); assert.equal(workers.length, 2); assert.ok(workers[0].terminated);
  workers[1].onmessage({data: {ready: true}});
  workers[1].onmessage({data: {bytes: new Uint8Array([67])}});
  assert.equal(await (await second).text(), 'C'); assert.ok(workers[1].terminated); assert.equal(timers.size, 0);
});

test('PDF settings reach the worker, duplicate ready messages are ignored and timeout releases memory', async () => {
  const {api, workers, timers} = bootWorker();
  const pending = api.compress(new Blob(['PDF']), 'application/pdf', {quality: 0.8, maxImageSide: 3000}).catch(error => error);
  await tick();
  const worker = workers[0];
  worker.onmessage({data: {ready: true}});
  worker.onmessage({data: {ready: true}});
  assert.equal(worker.sent.length, 1);
  assert.equal(worker.sent[0][0].options.quality, 0.8);
  assert.equal(worker.sent[0][0].options.maxImageSide, 3000);
  [...timers][0]();
  assert.match((await pending).message, /timed out/);
  assert.ok(worker.terminated);
  assert.equal(timers.size, 0);
});

test('invalid settings reject before a worker is created', async () => {
  const {api, workers} = bootWorker();
  for (const options of [{quality: NaN}, {quality: 0}, {maxImageSide: 99}, {maxImageSide: 2000.5}]) {
    await assert.rejects(api.compress(new Blob(['PDF']), 'application/pdf', options), /Quality must/);
  }
  assert.equal(workers.length, 0);
});
