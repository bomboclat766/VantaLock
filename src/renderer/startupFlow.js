(function exposeStartupFlow(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.VantaLockStartupFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createStartupFlow() {
  function finishStartup({ route, dismiss, onError }) {
    try {
      route();
    } catch (error) {
      onError(error);
    } finally {
      dismiss();
    }
  }

  return { finishStartup };
});
