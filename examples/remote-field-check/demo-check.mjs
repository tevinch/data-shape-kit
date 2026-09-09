/** A local simulation. No network requests or stored data. */
export function demoCheck(value, { signal }) {
  return new Promise((resolve, reject) => {
    let timer;
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    }
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    if (value === 'timeout') return;
    timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      if (value === 'offline') reject(new Error('Simulated service failure.'));
      else resolve(value === 'taken' ? 'This example slug is already in use.' : null);
    }, value === 'slow' ? 1400 : 400);
  });
}
