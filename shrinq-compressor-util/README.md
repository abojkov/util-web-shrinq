# ShrinqCompressorUtil

Copy this entire folder into another application. It contains the browser API,
PDF worker, MuPDF engine, licenses and standalone tests. No Garage code, npm
installation, build step, backend or document uploads are required.

## Browser usage

Keep the folder beside your HTML file, preserving its internal layout. Open the
HTML file directly in your browser and load the classic script before calling
the API:

```html
<script src="./shrinq-compressor-util/compressor.js"></script>
<script>
  async function compressFile(file) {
    const compressed = await ShrinqCompressorUtil.compress(file);
    return compressed; // Blob: save it, download it or pass it to your own app.
  }
</script>
```

`ShrinqCompressorUtil.compress(blob, mimeType = blob.type, options = {})` returns `Promise<Blob>`.
Pass a MIME type explicitly when the input Blob has no type:

```js
const result = await ShrinqCompressorUtil.compress(blob, 'application/pdf');
const url = URL.createObjectURL(result);
const link = document.createElement('a');
link.href = url;
link.download = 'compressed.pdf';
link.click();
// Revoke the URL after the download has started and you no longer need it.
```

- PDF: image compression at 50% JPEG quality, up to 2000 pixels on the longest
  side, plus native stream compression and resource deduplication. Text, links,
  page layout and transparency resources are preserved.
- JPEG/WebP: 50% quality, up to 2000 pixels on the longest side.
- PNG: lossless re-encoding with transparency, resized to the configured maximum
  side when needed. The quality value does not affect PNG encoding. Animated
  images are flattened to a still.
- Other MIME types: returned unchanged.
- Results are kept only when smaller. Signed and password-protected PDFs retain
  their original bytes. Invalid PDFs and worker failures reject the promise.

PDF processing requires WebAssembly and Blob workers. Direct `file://` opening
is supported without a server or network connection. The engine loads lazily
from `pdf-engine.js`, a classic script containing the worker code and embedded
WebAssembly. PDF requests run sequentially and release the worker and its Blob
URL after each file. Worker startup/processing times out after three minutes.
Images above 64 megapixels exceed the native processing limit.

`ShrinqCompressorUtil.version` is the processing revision (currently `3`). The module
is stateless: your application owns file names, storage, upload limits, hashes
and backups. Track this version alongside saved results if you want to avoid
recompressing an already optimized file. Keep source files when original quality
is needed. The module does not impose Garage's 30 MB upload limit.

The engine path resolves relative to `compressor.js`, so the folder can be
placed under any local or hosted path. The self-contained browser bundle is
about 14 MB and loads only when a PDF is compressed.

## Node.js usage

The PDF core is also an ES module and works without a browser or worker:

```js
import {readFile, writeFile} from 'node:fs/promises';
import {compressPdfBytes} from './shrinq-compressor-util/pdf-compression-core.mjs';

const result = compressPdfBytes(await readFile('input.pdf'));
await writeFile('output.pdf', result);
```

`compressPdfBytes(Uint8Array, options = {})` returns a `Uint8Array` synchronously. Run it in your
own worker or job queue when blocking the application's main thread is unsuitable.

## Compression settings (revision 3)

Both APIs accept `{quality, maxImageSide}`. Defaults remain `0.5` and `2000`.
Quality must be a finite number from `0.1` to `1`; maxImageSide must be an integer
from `100` to `10000`. Invalid options reject (or throw in the synchronous core).

```js
const result = await ShrinqCompressorUtil.compress(file, file.type, {
  quality: 0.8,
  maxImageSide: 3000
});
```

The worker's internal protocol now sends `{bytes: ArrayBuffer, options}` after
the ready handshake. Copy the whole folder together when upgrading. Existing
calls to the public API without options keep their original defaults.

## Folder contents

| Path | Purpose |
| --- | --- |
| `compressor.js` | Browser entry point: `ShrinqCompressorUtil` |
| `pdf-engine.js` | Generated browser bundle with embedded WebAssembly |
| `pdf-compression-worker.mjs` | Worker source and ready handshake |
| `scripts/build-pdf-engine.cjs` | Rebuilds the browser bundle without dependencies |
| `pdf-compression-core.mjs` | PDF optimization using the native engine |
| `vendor/mupdf/` | MuPDF JavaScript, WebAssembly and license |
| `vendor/README.txt` | Pinned version and source/build provenance |
| `tests/` | Tests that run independently of Garage and its sample PDFs |

## Rebuild the browser engine

The generated `pdf-engine.js` is included, so users do not need a build step.
After changing the PDF core, worker source or vendored engine, regenerate it:

```sh
node scripts/build-pdf-engine.cjs
```

The builder adapts ESM boundaries inside isolated closures and embeds the native
WebAssembly bytes. Upstream engine files remain unchanged. No external modules,
fetches or file requests are needed inside the worker.

## Tests

With Node.js, from this folder:

```sh
node --test tests/*.test.cjs
```

No test dependencies are needed. Garage additionally runs regression tests against
its large sample PDFs and tests its own attachment storage/backup integration.

## Third-party license

The bundled MuPDF.js 1.28.1 engine is **AGPL-3.0-or-later**. Copy its license and
source/build provenance with the module when reusing or distributing it. See
[vendor/mupdf/LICENSE](vendor/mupdf/LICENSE) and [vendor/README.txt](vendor/README.txt).
