const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const modules = Promise.all([
  import(pathToFileURL(path.join(__dirname, '../pdf-compression-core.mjs')).href),
  import(pathToFileURL(path.join(__dirname, '../vendor/mupdf/mupdf.mjs')).href)
]);

function bytes(doc, options = 'compress=no') {
  const output = doc.saveToBuffer(options);
  try { return output.asUint8Array().slice(); } finally { output.destroy(); }
}
function text(page) {
  const content = page.toStructuredText();
  try { return content.asText(); } finally { content.destroy(); }
}

test('native image decoding handles CMYK and color-key transparency, while text and links survive rewriting', async () => {
  const [{compressPdfBytes}, {default: m}] = await modules;
  const doc = new m.PDFDocument(), size = 128;
  try {
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4; pixels[i] = x; pixels[i + 1] = y; pixels[i + 2] = 200; pixels[i + 3] = 0;
    }
    const cmyk = doc.addRawStream(pixels, {Type: 'XObject', Subtype: 'Image', ColorSpace: 'DeviceCMYK', Width: size, Height: size, BitsPerComponent: 8});
    const rgba = new Uint8Array(size * size * 3);
    for (let i = 0; i < size * size; i++) { rgba[i * 3] = i % 256; rgba[i * 3 + 1] = 128; rgba[i * 3 + 2] = 255; }
    const keyed = doc.addRawStream(rgba, {Type: 'XObject', Subtype: 'Image', ColorSpace: 'DeviceRGB', Width: size, Height: size, BitsPerComponent: 8, Mask: [0, 40, 128, 128, 255, 255]});
    const font = new m.Font('Helvetica'), fontRef = doc.addSimpleFont(font, 'Latin'); font.destroy();
    const pageRef = doc.addPage([0, 0, 400, 400], 0, {Font: {F1: fontRef}, XObject: {A: cmyk, B: keyed}},
      'BT /F1 16 Tf 20 360 Td (Selectable invoice text) Tj ET\nq 120 0 0 120 20 100 cm /A Do Q\nq 120 0 0 120 180 100 cm /B Do Q');
    doc.insertPage(-1, pageRef);
    const page = doc.loadPage(0), link = page.createLink([20, 20, 200, 50], 'https://example.com'); link.destroy(); page.destroy();
    const input = bytes(doc), output = compressPdfBytes(input), result = new m.PDFDocument(output);
    try {
      const p = result.loadPage(0), original = doc.loadPage(0);
      try {
        assert.equal(text(p), text(original));
        const links = p.getLinks(); assert.equal(links[0].getURI(), 'https://example.com'); links.forEach(link => link.destroy());
        const pix = p.toPixmap(m.Matrix.identity, m.ColorSpace.DeviceRGB, false); assert.ok(pix.asPNG().length); pix.destroy();
        const imageA = p.getObject().get('Resources', 'XObject', 'A');
        const imageB = p.getObject().get('Resources', 'XObject', 'B');
        assert.equal(imageA.get('ColorSpace').asName(), 'DeviceRGB');
        assert.equal(imageA.get('Filter').asName(), 'DCTDecode');
        assert.ok(imageB.get('SMask').isIndirect(), 'Color-key transparency must survive as an alpha mask');
        imageA.destroy(); imageB.destroy();
      } finally { p.destroy(); original.destroy(); }
    } finally { result.destroy(); }
  } finally { doc.destroy(); }
});

test('signed and password-protected PDFs retain original bytes; invalid PDFs fail explicitly', async () => {
  const [{compressPdfBytes}, {default: m}] = await modules;
  const doc = new m.PDFDocument();
  try {
    doc.insertPage(-1, doc.addPage([0, 0, 100, 100], 0, {}, ''));
    const encrypted = bytes(doc, 'encrypt=aes-256,user-password=secret,owner-password=owner');
    assert.strictEqual(compressPdfBytes(encrypted), encrypted);
    const signature = doc.addObject({Type: 'Sig', ByteRange: [0, 10, 20, 30]});
    doc.getTrailer().get('Root').put('TestSignature', signature);
    const signed = bytes(doc);
    assert.strictEqual(compressPdfBytes(signed), signed);
    assert.throws(() => compressPdfBytes(new Uint8Array([1, 2, 3])));
  } finally { doc.destroy(); }
});
