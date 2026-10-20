/* All document processing is local. A fresh worker releases native PDF memory after each file. */
globalThis.ShrinqCompressorUtil = (() => {
  const engineURL = new URL('pdf-engine.js', document.currentScript.src);
  let engineReady;
  function loadPdfEngine() {
    if (globalThis.ShrinqPdfWorkerSource) return Promise.resolve(globalThis.ShrinqPdfWorkerSource);
    if (!engineReady) {
      engineReady = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = engineURL.href;
        script.onload = () => {
          script.remove();
          if (globalThis.ShrinqPdfWorkerSource) resolve(globalThis.ShrinqPdfWorkerSource);
          else reject(Error('PDF engine did not initialize.'));
        };
        script.onerror = () => {
          script.remove();
          reject(Error('PDF engine could not load. Keep the complete shrinq-compressor-util folder next to the page.'));
        };
        document.head.append(script);
      }).catch(error => { engineReady = null; throw error; });
    }
    return engineReady;
  }
  let queue = Promise.resolve();
  const api = {
    version: 3,
    async compress(blob, type = blob.type, options = {}) {
      const {quality = 0.5, maxImageSide = 2000} = options;
      if (!Number.isFinite(quality) || quality < 0.1 || quality > 1 ||
          !Number.isInteger(maxImageSide) || maxImageSide < 100 || maxImageSide > 10000) {
        throw Error('Quality must be between 0.1 and 1; maxImageSide must be an integer between 100 and 10000.');
      }
      const settings = {quality, maxImageSide};
      if (type === 'application/pdf') {
        const run = queue.then(() => api.compressPdf(blob, settings));
        queue = run.catch(() => {});
        return run;
      }
      if (!['image/jpeg', 'image/webp', 'image/png'].includes(type)) return blob;
      const image = await createImageBitmap(blob), canvas = document.createElement('canvas');
      try {
        if (image.width * image.height > 64000000) throw Error('This image exceeds the 64 megapixel processing limit.');
        const scale = Math.min(1, maxImageSide / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw Error('Your browser could not initialize image processing.');
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = await new Promise((resolve, reject) => canvas.toBlob(result =>
          result?.type === type ? resolve(result) : reject(Error('Unsupported image encoding.')), type, quality));
        return result.size < blob.size ? result : blob;
      } finally { image.close(); canvas.width = canvas.height = 0; }
    },
    async compressPdf(blob, options = {}) {
      const source = await loadPdfEngine();
      const bytes = await blob.arrayBuffer();
      return new Promise((resolve, reject) => {
        const workerURL = URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
        let worker;
        try { worker = new Worker(workerURL); }
        catch (error) { URL.revokeObjectURL(workerURL); reject(error); return; }
        let finished = false, sent = false;
        const finish = (error, output) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(workerURL);
          error ? reject(error) : resolve(new Blob([output], {type: 'application/pdf'}));
        };
        const timer = setTimeout(() => finish(Error('PDF compression timed out.')), 180000);
        worker.onmessage = ({data}) => {
          if (finished) return;
          if (data.ready) {
            if (!sent) { sent = true; worker.postMessage({bytes, options}, [bytes]); }
            return;
          }
          if (!data.error && !(data.bytes instanceof Uint8Array)) {
            finish(Error('Invalid PDF engine result.')); return;
          }
          data.error ? finish(Error(data.error)) : finish(null, data.bytes);
        };
        worker.onerror = () => finish(Error('PDF engine could not load. Keep the complete shrinq-compressor-util folder next to the page and use a browser with WebAssembly support.'));
        worker.onmessageerror = () => finish(Error('Could not read the PDF engine result.'));
      });
    }
  };
  return api;
})();
