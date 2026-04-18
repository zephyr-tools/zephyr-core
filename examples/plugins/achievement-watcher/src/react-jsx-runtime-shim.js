const rt = /** @type {Record<string, unknown>} */ (globalThis).__zephyrJsxRuntime;
if (!rt) {
  throw new Error(
    'Zephyr plugin: window.__zephyrJsxRuntime is not defined. This bundle is intended to run inside Zephyr, which publishes react/jsx-runtime on window.__zephyrJsxRuntime before the app mounts.',
  );
}
export const { jsx, jsxs, Fragment } = rt;
