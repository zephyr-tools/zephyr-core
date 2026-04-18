const React = /** @type {typeof import('react') | undefined} */ (
  /** @type {Record<string, unknown>} */ (globalThis).__zephyrReact
);
if (!React) {
  throw new Error(
    'Zephyr plugin: window.__zephyrReact is not defined. This bundle is intended to run inside Zephyr, which publishes React on window.__zephyrReact before the app mounts.',
  );
}

export const {
  useState, useEffect, useLayoutEffect, useInsertionEffect, useRef, useMemo, useCallback,
  useContext, useReducer, useId, useTransition, useDeferredValue, useImperativeHandle,
  useSyncExternalStore, useDebugValue, useOptimistic, useActionState, use,
  Component, PureComponent, Fragment, StrictMode, Suspense, Profiler,
  createContext, createElement, cloneElement, createRef, forwardRef, memo, lazy,
  startTransition, isValidElement, Children, version,
} = React;
export default React;
