// Reads React from the host app's window global so the plugin shares
// the same React instance (required for hooks to work correctly).
//
// Zephyr sets `window.__zephyrReact` in `src/renderer/main.tsx` before the
// app mounts. If it's missing, the plugin is being loaded outside of Zephyr
// (or before the host has initialized) and none of the exports would work.
const React = /** @type {typeof import('react') | undefined} */ (
  /** @type {Record<string, unknown>} */ (globalThis).__zephyrReact
);
if (!React) {
  throw new Error(
    'Zephyr plugin: window.__zephyrReact is not defined. This bundle is intended to run inside Zephyr, which publishes React on window.__zephyrReact before the app mounts.',
  );
}

// Full React 19 surface so plugins can import any hook/component without
// the shim silently returning undefined. If React adds new exports, update
// this list — anything not listed here becomes `undefined` in plugin code.
export const {
  // Hooks
  useState,
  useEffect,
  useLayoutEffect,
  useInsertionEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  useReducer,
  useId,
  useTransition,
  useDeferredValue,
  useImperativeHandle,
  useSyncExternalStore,
  useDebugValue,
  useOptimistic,
  useActionState,
  use,
  // Components + creators
  Component,
  PureComponent,
  Fragment,
  StrictMode,
  Suspense,
  Profiler,
  // APIs
  createContext,
  createElement,
  cloneElement,
  createRef,
  forwardRef,
  memo,
  lazy,
  startTransition,
  isValidElement,
  Children,
  version,
} = React;
export default React;
