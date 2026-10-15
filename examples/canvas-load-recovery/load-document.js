// Application example for Fabric 7.4.0. Run one load at a time per canvas.
export async function loadDocument(canvas, json, signal) {
  const renderOnAddRemove = canvas.renderOnAddRemove;
  try {
    await canvas.loadFromJSON(json, (_serialized, _instance, error) => {
      // A missing top-level image otherwise may be omitted without rejection.
      if (error) throw error;
    }, { signal });
    canvas.requestRenderAll();
    return { status: 'loaded' };
  } catch (error) {
    return { status: signal?.aborted ? 'cancelled' : 'failed', error };
  } finally {
    // Preserve an application's explicit false setting, too.
    canvas.renderOnAddRemove = renderOnAddRemove;
  }
}
