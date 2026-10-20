import mupdf from './vendor/mupdf/mupdf.mjs';

export const PDF_QUALITY = 50;
export const MAX_IMAGE_SIDE = 2000;

// Decode images through MuPDF, preserving page content and transparency resources.
// Its writer compresses streams, removes unused objects and deduplicates resources.
export function compressPdfBytes(input, {quality = PDF_QUALITY / 100, maxImageSide = MAX_IMAGE_SIDE} = {}) {
  if (!Number.isFinite(quality) || quality < 0.1 || quality > 1 ||
      !Number.isInteger(maxImageSide) || maxImageSide < 100 || maxImageSide > 10000) {
    throw Error('Invalid PDF compression settings.');
  }
  const doc = new mupdf.PDFDocument(input);
  try {
    if (doc.needsPassword()) return input;
    const count = doc.countObjects(), maskIds = new Set();
    for (let i = 1; i < count; i++) {
      const obj = doc.newIndirect(i), owned = [];
      const get = key => { const value = obj.get(key); owned.push(value); return value; };
      try {
        if (get('ByteRange').isArray() || get('FT').asName() === 'Sig') return input;
        for (const key of ['SMask', 'Mask']) {
          const mask = get(key);
          if (mask.isIndirect()) maskIds.add(mask.asIndirect());
        }
      } finally { owned.reverse().forEach(value => value.destroy()); obj.destroy(); }
    }
    for (let i = 1; i < count; i++) {
      const obj = doc.newIndirect(i), owned = [];
      const own = value => { owned.push(value); return value; };
      const get = key => own(obj.get(key));
      try {
        if (!obj.isStream() || get('Subtype').asName() !== 'Image' ||
            get('ImageMask').asBoolean() || maskIds.has(i)) continue;
        const image = own(doc.loadImage(obj));
        if (image.getWidth() * image.getHeight() > 64000000) {
          throw Error('A PDF image exceeds the 64 megapixel processing limit.');
        }
        const pixmap = own(image.toPixmap());
        let rgb = own(pixmap.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, !!pixmap.getAlpha()));
        let alpha;
        // Color-key/JPX alpha must become a soft mask after JPEG encoding.
        if (rgb.getAlpha()) {
          alpha = own(new mupdf.Pixmap(mupdf.ColorSpace.DeviceGray, rgb.getBounds(), false));
          const opaque = own(new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, rgb.getBounds(), false));
          const source = rgb.getPixels(), colors = opaque.getPixels(), mask = alpha.getPixels();
          for (let p = 0; p < mask.length; p++) {
            const a = source[p * 4 + 3]; mask[p] = a;
            for (let c = 0; c < 3; c++) colors[p * 3 + c] = a ? Math.min(255, Math.round(source[p * 4 + c] * 255 / a)) : 0;
          }
          rgb = opaque;
        }
        const w = rgb.getWidth(), h = rgb.getHeight(), scale = Math.min(1, maxImageSide / Math.max(w, h));
        const resize = pix => scale < 1 ? own(pix.warp([[0, 0], [w, 0], [w, h], [0, h]],
          Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)))) : pix;
        rgb = resize(rgb);
        const jpeg = rgb.asJPEG(Math.round(quality * 100)), previous = own(obj.readRawStream());
        if (jpeg.length >= previous.getLength()) continue;
        let softMask;
        if (alpha) {
          alpha = resize(alpha);
          softMask = own(doc.addImage(own(new mupdf.Image(alpha))));
        }
        // Update the existing stream dictionary in place; replacing it can lose
        // the stream identity during the native writer's deduplication pass.
        obj.put('Width', rgb.getWidth()); obj.put('Height', rgb.getHeight());
        obj.put('ColorSpace', own(doc.newName('DeviceRGB')));
        obj.put('BitsPerComponent', 8); obj.put('Filter', own(doc.newName('DCTDecode')));
        obj.delete('Decode'); obj.delete('DecodeParms'); obj.delete('SMaskInData');
        if (softMask) { obj.delete('Mask'); obj.put('SMask', softMask); }
        obj.writeRawStream(jpeg);
      } finally { owned.reverse().forEach(value => value.destroy()); obj.destroy(); }
    }
    const output = doc.saveToBuffer('garbage=4,compress=yes,compress-fonts=yes,compress-images=yes,objstms=yes');
    try {
      return output.getLength() < input.byteLength ? output.asUint8Array().slice() : input;
    } finally { output.destroy(); }
  } finally { doc.destroy(); }
}
