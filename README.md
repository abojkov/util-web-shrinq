# Shrinq

A single-page file compressor built with HTML, Bootstrap 5.3.3, CSS and vanilla
JavaScript. File processing stays in the browser. No build step, package install,
account, backend or external runtime requests are needed.

## Open the app

Double-click `index.html` to open it in your browser. No localhost, server,
installation or terminal command is needed. Keep `assets/` and
`shrinq-compressor-util/` alongside the HTML file.

PDF compression works directly from `file://`. Its engine loads as a local
classic script with embedded WebAssembly and runs in a Blob worker. Images use
the browser's built-in image processing. Everything works offline.

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
processing behavior with a canvas test double. They also execute the bundled PDF
engine with network access disabled and exercise loading from a `file://` page.
Browser visual and end-to-end checks remain separate.

## Licenses

Bootstrap is MIT licensed; its license is in `assets/vendor/bootstrap.LICENSE`.
The bundled MuPDF engine is AGPL-3.0-or-later. See the utility's
[license and provenance](shrinq-compressor-util/vendor/README.txt).
