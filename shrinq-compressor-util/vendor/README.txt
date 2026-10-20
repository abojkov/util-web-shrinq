MuPDF.js 1.28.1 -- Artifex Software, Inc.
License: AGPL-3.0-or-later (see mupdf/LICENSE).
Official repository: https://github.com/ArtifexSoftware/mupdf
Corresponding source: https://github.com/ArtifexSoftware/mupdf/tree/1.28.1
WASM bindings and build tooling: platform/wasm/ in that source tree.
Published artifact: https://www.npmjs.com/package/mupdf/v/1.28.1
npm tarball SHA-1: c66d2714bafa1f5c14e076504ed43d5e07bbb3e7

Bundled files: dist/mupdf.js, dist/mupdf-wasm.js, dist/mupdf-wasm.wasm, LICENSE.
JavaScript files are renamed .mjs; the one relative import in mupdf.mjs is
adjusted from mupdf-wasm.js to mupdf-wasm.mjs. No engine code is otherwise changed.
The engine and its corresponding source are distributed under the license above.

Shrinq browser packaging: ../scripts/build-pdf-engine.cjs generates
../pdf-engine.js from these files and the local PDF core/worker sources.
It adapts ESM boundaries into isolated async closures, substitutes the loader's
import.meta.url with an inert base URL and embeds the unchanged WASM bytes as
base64. wasmBinary is supplied explicitly, so no network loading is performed.
The original files above remain available for source inspection and Node use.
