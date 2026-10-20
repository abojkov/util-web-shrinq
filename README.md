# Shrinq

A single-page file compressor built with HTML, Bootstrap 5.3.3, CSS and vanilla
JavaScript. File processing stays in the browser. No build step, package install,
account, backend or external runtime requests are needed.

## Run locally

From the project root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open **http://127.0.0.1:8080**. Opening `index.html` directly with `file://` is not
supported by PDF module workers. Deploy the whole directory to any static HTTP(S)
host, preserving the utility and vendor folders. Serve `.mjs` as JavaScript and
`.wasm` as `application/wasm` (Python's server handles these).

## Features

- Select or drop one PDF, JPEG, PNG or WebP, up to 100 MB.
- Three compression presets: Easy does it (80% / 3000 px), Just right (50% /
  2000 px), Go small (30% / 1400 px).
- Before/after sizes, savings, image thumbnail and an explicit download.
- Responsive layout, keyboard controls and accessible processing/error feedback.
- Local Bootstrap CSS and SVG icons; no CDN, fonts or analytics requests.

JPEG/WebP encoding is lossy. PNG encoding remains PNG with transparency; the
resolution cap may reduce its dimensions. PNG ignores the quality value. PDF
image compression is lossy; text, links and page layout are preserved. Files
are never enlarged: if a result isn't smaller, the original is returned. Signed
and password-protected PDFs stay unchanged. Images above 64 megapixels are
rejected. Animated images are not supported; image processing produces a still.
Compression savings depend on the input and are not guaranteed.

## Project files

- `index.html`: page and accessible controls.
- `assets/styles.css`: responsive design and Bootstrap customization.
- `assets/app.js`: file selection, settings, processing and downloads.
- `shrinq-compressor-util/`: reusable browser compressor and bundled PDF engine.

## Tests

Node.js is only needed to run the utility tests:

```sh
node --test shrinq-compressor-util/tests/*.test.cjs
```

These cover the native PDF engine, worker lifecycle/settings/failures and image
processing behavior with a canvas test double. Browser visual and end-to-end
checks remain separate.

## Licenses

Bootstrap is MIT licensed; its license is in `assets/vendor/bootstrap.LICENSE`.
The bundled MuPDF engine is AGPL-3.0-or-later. See the utility's
[license and provenance](shrinq-compressor-util/vendor/README.txt).
