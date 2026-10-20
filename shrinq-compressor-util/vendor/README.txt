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
