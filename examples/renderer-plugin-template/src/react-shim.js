// Reads React from the host app's window global so the plugin shares
// the same React instance (required for hooks to work correctly).
const React = window.__zephyrReact;
export const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  createContext,
  createElement,
  Fragment,
  forwardRef,
  memo,
} = React;
export default React;
