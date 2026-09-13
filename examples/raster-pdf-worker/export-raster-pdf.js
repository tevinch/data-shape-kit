export function exportRasterPdf(pages, options = {}, { signal, timeoutMs = 60000 } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new RangeError('timeoutMs must be a positive finite number.'));
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Export cancelled.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-worker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (error, buffer) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
      if (buffer !== undefined) resolve(buffer); else reject(error);
    };
    const abort = () => finish(signal.reason ?? new DOMException('Export cancelled.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('PDF export timed out.')), timeoutMs);
    worker.onmessage = ({ data }) => {
      if (data?.buffer instanceof ArrayBuffer) finish(null, data.buffer);
      else finish(new Error(data?.error || 'The PDF worker returned an invalid result.'));
    };
    worker.onerror = event => {
      event.preventDefault();
      finish(new Error(event.message || 'The PDF worker failed to load or run.'));
    };
    worker.onmessageerror = () => finish(new Error('The PDF worker result could not be read.'));
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    // Clone inputs so cancellation and failures never detach the caller's images.
    try { worker.postMessage({ pages, options }); } catch (error) { finish(error); }
  });
}
