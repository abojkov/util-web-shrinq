import {compressPdfBytes} from './pdf-compression-core.mjs';

self.onmessage = ({data}) => {
  try {
    const bytes = compressPdfBytes(new Uint8Array(data.bytes), data.options);
    self.postMessage({bytes}, [bytes.buffer]);
  } catch (error) {
    self.postMessage({error: error.message || 'PDF compression failed.'});
  }
};

// Engine initialization is asynchronous: accept data only after this handshake.
self.postMessage({ready: true});
