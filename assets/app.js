(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const presets = {
    gentle: {quality: 0.8, maxImageSide: 3000},
    balanced: {quality: 0.5, maxImageSide: 2000},
    strong: {quality: 0.3, maxImageSide: 1400}
  };
  const types = {pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};
  let selected = null, mime = '', busy = false, downloadURL = null, previewURL = null, dragDepth = 0;
  const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(2)} MB`;
  const announce = message => { $('status').textContent = message; };
  function error(message) { $('error').textContent = message; $('error').hidden = !message; }
  function revokeURLs() {
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    if (previewURL) URL.revokeObjectURL(previewURL);
    downloadURL = previewURL = null;
  }
  function clearResult() {
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    downloadURL = null;
    $('download-button').removeAttribute('href');
    $('result').hidden = true;
    $('compress-button').hidden = false;
  }
  function reset() {
    if (busy) return;
    revokeURLs(); selected = null; mime = '';
    $('file-input').value = '';
    $('selected-panel').hidden = true;
    $('drop-zone').hidden = false;
    clearResult(); error('');
    announce('Ready for another file.');
    $('choose-button').focus();
  }
  function select(files) {
    if (busy || !files.length) return;
    if (files.length !== 1) { error('One at a time, please. Choose a single PDF, JPG, PNG or WebP.'); return; }
    const file = files[0];
    const extension = file.name.split('.').pop().toLowerCase();
    const type = types[extension] || (Object.values(types).includes(file.type) ? file.type : '');
    if (!type) { error('This file type isn’t supported yet. Try a PDF, JPG, PNG or WebP.'); return; }
    if (!file.size) { error('This file is empty. Please choose a different file.'); return; }
    if (file.size > 100 * 1024 ** 2) { error('This file is over 100 MB. Please choose a smaller file.'); return; }
    revokeURLs(); clearResult(); error('');
    selected = file; mime = type;
    $('file-name').textContent = file.name;
    $('file-meta').textContent = `${size(file.size)} · ${type === 'application/pdf' ? 'PDF document' : type.split('/')[1].toUpperCase() + ' image'}`;
    $('file-preview').replaceChildren();
    if (type.startsWith('image/')) {
      previewURL = URL.createObjectURL(file);
      const image = new Image(); image.src = previewURL; image.alt = '';
      $('file-preview').append(image);
    } else {
      $('file-preview').innerHTML = '<svg class="icon"><use href="#file"/></svg>';
    }
    $('drop-zone').hidden = true;
    $('selected-panel').hidden = false;
    announce(`${file.name} selected. Ready to compress.`);
    $('compress-button').focus();
  }
  $('choose-button').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', event => select(event.target.files));
  $('remove-button').addEventListener('click', reset);
  $('another-button').addEventListener('click', reset);
  $('preset-fieldset').addEventListener('change', () => {
    if (!busy && selected) { clearResult(); error(''); announce('Compression level changed. Ready to compress again.'); }
  });
  document.addEventListener('dragover', event => {
    if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
  });
  document.addEventListener('drop', event => {
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault(); dragDepth = 0; $('drop-zone').classList.remove('dragging'); select(event.dataTransfer.files);
    }
  });
  $('drop-zone').addEventListener('dragenter', event => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault(); dragDepth++; $('drop-zone').classList.add('dragging');
  });
  $('drop-zone').addEventListener('dragleave', () => {
    if (--dragDepth <= 0) { dragDepth = 0; $('drop-zone').classList.remove('dragging'); }
  });
  $('compress-button').addEventListener('click', async () => {
    if (!selected || busy) return;
    busy = true; error('');
    $('preset-fieldset').disabled = true;
    $('remove-button').disabled = true;
    $('compress-button').hidden = true;
    $('processing').hidden = false;
    $('selected-panel').setAttribute('aria-busy', 'true');
    const message = mime === 'application/pdf' ? 'Optimizing your PDF… Large files may take a moment.' : 'Making your image lighter…';
    $('processing-message').textContent = message; announce(message);
    try {
      if (location.protocol === 'file:') throw Error('Open Shrinq through a local web server. See the README for the one-line start command.');
      // Give the browser a frame to paint the working state before image decoding.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const preset = document.querySelector('input[name="preset"]:checked').value;
      const output = await ShrinqCompressorUtil.compress(selected, mime, presets[preset]);
      const saved = selected.size - output.size;
      downloadURL = URL.createObjectURL(output);
      $('original-size').textContent = size(selected.size);
      $('result-size').textContent = size(output.size);
      $('saving-badge').textContent = saved > 0 ? `${((saved / selected.size) * 100).toFixed(1)}% smaller` : 'Already optimized';
      $('result-title').textContent = saved > 0 ? 'A little lighter. Ready to go.' : 'Some files are already just right.';
      $('result-note').textContent = saved > 0
        ? `${size(saved)} saved. ${mime === 'image/png' ? 'PNG transparency is preserved; large images may be resized.' : 'Images may lose some detail or resolution at this setting.'}`
        : 'We couldn’t make this file smaller at this setting, so your original is preserved. Signed or password-protected PDFs are kept unchanged.';
      const base = selected.name.replace(/\.[^.]+$/, '');
      const extension = mime === 'application/pdf' ? 'pdf' : mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
      $('download-button').href = downloadURL;
      $('download-button').download = saved > 0 ? `${base}-shrinq.${extension}` : selected.name;
      $('download-button').firstChild.textContent = saved > 0 ? 'Download smaller file ' : 'Download original ';
      $('result').hidden = false;
      announce(`${$('result-title').textContent} ${$('saving-badge').textContent}.`);
    } catch (failure) {
      error(failure.message || 'Something went wrong. Please try a different file.');
      $('compress-button').hidden = false;
    } finally {
      busy = false;
      $('processing').hidden = true;
      $('preset-fieldset').disabled = false;
      $('remove-button').disabled = false;
      $('selected-panel').removeAttribute('aria-busy');
      if (!$('result').hidden) $('download-button').focus();
    }
  });
  window.addEventListener('pagehide', revokeURLs);
})();
