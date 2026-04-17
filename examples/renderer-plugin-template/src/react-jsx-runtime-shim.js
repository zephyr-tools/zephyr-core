// Reads React's jsx-runtime from the host app's window global. Zephyr sets
// `window.__zephyrJsxRuntime` in `src/renderer/main.tsx` before the app mounts.
// Without it the plugin bundle can't render JSX — fail loudly with a clear
// message instead of a cryptic destructuring TypeError.
const rt = /** @type {Record<string, unknown>} */ (globalThis).__zephyrJsxRuntime;
if (!rt) {
  throw new Error(
    'Zephyr plugin: window.__zephyrJsxRuntime is not defined. This bundle is intended to run inside Zephyr, which publishes react/jsx-runtime on window.__zephyrJsxRuntime before the app mounts.',
  );
}
export const { jsx, jsxs, Fragment } = rt;
