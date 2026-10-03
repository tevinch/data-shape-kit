/** Save full Quill 2 HTML snapshots after user edits become idle. */
export function attachIdleSave(quill, { save, delay = 5000, onStatus = () => {} }) {
  let timer;
  let revision = 0;
  let ready = false;
  let active = false;
  let disposed = false;

  const notify = (state, error) => {
    if (!disposed) onStatus(state, error);
  };

  async function drain() {
    if (disposed || active || !ready) return;
    ready = false;
    active = true;
    const sendingRevision = revision;
    try {
      const html = quill.getSemanticHTML();
      notify('saving');
      await save(html);
      notify(sendingRevision === revision ? 'saved' : 'waiting');
    } catch (error) {
      notify('error', error);
    } finally {
      active = false;
      if (ready && !disposed) void drain();
    }
  }

  function saveNow() {
    if (disposed) return;
    clearTimeout(timer);
    revision++;
    ready = true;
    void drain();
  }

  const changed = (_delta, _old, source) => {
    if (disposed || source !== 'user') return;
    revision++;
    ready = false;
    clearTimeout(timer);
    notify('waiting');
    timer = setTimeout(() => {
      ready = true;
      void drain();
    }, delay);
  };

  quill.on('text-change', changed);
  return {
    saveNow,
    dispose() {
      disposed = true;
      ready = false;
      clearTimeout(timer);
      quill.off('text-change', changed);
    },
  };
}
