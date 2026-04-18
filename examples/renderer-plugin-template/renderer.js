// src/react-shim.js
var React = (
  /** @type {typeof import('react') | undefined} */
  /** @type {Record<string, unknown>} */
  globalThis.__zephyrReact
);
if (!React) {
  throw new Error(
    "Zephyr plugin: window.__zephyrReact is not defined. This bundle is intended to run inside Zephyr, which publishes React on window.__zephyrReact before the app mounts."
  );
}
var {
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
  version
} = React;

// src/react-jsx-runtime-shim.js
var rt = (
  /** @type {Record<string, unknown>} */
  globalThis.__zephyrJsxRuntime
);
if (!rt) {
  throw new Error(
    "Zephyr plugin: window.__zephyrJsxRuntime is not defined. This bundle is intended to run inside Zephyr, which publishes react/jsx-runtime on window.__zephyrJsxRuntime before the app mounts."
  );
}
var { jsx, jsxs, Fragment: Fragment2 } = rt;

// src/renderer.jsx
function useNotes() {
  const [notes, setNotes] = useState(
    /** @type {Record<string, { text: string; updatedAt: number }>} */
    {}
  );
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const next = await window.api.invokePlugin("my-plugin:list-notes");
      setNotes(next ?? {});
    } catch (err) {
      console.error("[Notes] list-notes failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { notes, loading, refresh };
}
function NotesSection({ release }) {
  const { notes, refresh } = useNotes();
  const existing = notes[release.id];
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState(
    /** @type {'idle' | 'saving' | 'saved' | 'error'} */
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const saveTimerRef = useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */
    null
  );
  function clearSaveTimer() {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }
  useEffect(() => {
    setDraft(existing?.text ?? "");
    setStatus("idle");
    setErrorMessage("");
  }, [release.id, existing?.text]);
  useEffect(() => clearSaveTimer, []);
  async function save() {
    clearSaveTimer();
    setStatus("saving");
    setErrorMessage("");
    try {
      await window.api.invokePlugin("my-plugin:save-note", {
        releaseId: release.id,
        text: draft
      });
      await refresh();
      setStatus("saved");
    } catch (err) {
      console.error("[Notes] save failed:", err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        setStatus("idle");
      }, 1200);
    }
  }
  const dirty = draft.trim() !== (existing?.text ?? "");
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-stack", children: [
    /* @__PURE__ */ jsx(
      "textarea",
      {
        className: "zephyr-textarea",
        value: draft,
        onChange: (e) => setDraft(e.target.value),
        placeholder: `Write a note about ${release.title}\u2026`,
        rows: 4,
        style: { resize: "vertical" }
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsx("span", { className: "zephyr-text-subtle", style: { fontSize: 11 }, children: status === "error" ? `Save failed: ${errorMessage}` : existing ? `Last updated ${new Date(existing.updatedAt).toLocaleString()}` : "No note saved yet for this release" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: save,
          disabled: !dirty || status === "saving",
          className: `zephyr-button ${dirty ? "zephyr-button--primary" : ""}`,
          children: status === "saving" ? "Saving\u2026" : status === "saved" ? "Saved!" : status === "error" ? "Retry" : existing ? "Update" : "Save note"
        }
      )
    ] })
  ] });
}
function NotesPage({ release }) {
  const { notes, loading, refresh } = useNotes();
  const entries = Object.entries(notes).sort(
    ([, a], [, b]) => b.updatedAt - a.updatedAt
  );
  async function remove(releaseId) {
    await window.api.invokePlugin("my-plugin:delete-note", { releaseId });
    await refresh();
  }
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-stack--md", style: { padding: 24, maxWidth: 720, margin: "0 auto" }, children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h2", { className: "zephyr-text-primary", style: { fontSize: 22, fontWeight: 700, margin: 0 }, children: "Your notes" }),
      /* @__PURE__ */ jsx("p", { className: "zephyr-text-muted", style: { marginTop: 4 }, children: "Personal notes you've saved about releases. Open any release's detail page to add one." })
    ] }),
    release && /* @__PURE__ */ jsxs("div", { className: "zephyr-card zephyr-row", style: { justifyContent: "space-between" }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "zephyr-label", children: "Last viewed" }),
        /* @__PURE__ */ jsx("div", { className: "zephyr-text-primary", style: { marginTop: 4 }, children: release.title })
      ] }),
      /* @__PURE__ */ jsx("span", { className: "zephyr-pill", children: release.id })
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "zephyr-text-subtle", children: "Loading\u2026" }) : entries.length === 0 ? /* @__PURE__ */ jsx("div", { className: "zephyr-card", style: { textAlign: "center" }, children: /* @__PURE__ */ jsx("p", { className: "zephyr-text-muted", style: { margin: 0 }, children: 'No notes yet. Pick a release from the grid, scroll to the "Notes" section at the bottom of its detail page, and your note will show up here.' }) }) : /* @__PURE__ */ jsx("ul", { className: "zephyr-stack", style: { listStyle: "none", padding: 0, margin: 0 }, children: entries.map(([releaseId, note]) => {
      const isCurrent = release?.id === releaseId;
      return /* @__PURE__ */ jsxs("li", { className: "zephyr-card zephyr-stack", children: [
        /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxs("span", { className: "zephyr-label", children: [
            isCurrent ? "\u2605 Current release \xB7 " : "",
            releaseId
          ] }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => remove(releaseId),
              className: "zephyr-button zephyr-button--danger",
              style: { fontSize: 11 },
              children: "Delete"
            }
          )
        ] }),
        /* @__PURE__ */ jsx("p", { className: "zephyr-text-secondary", style: { whiteSpace: "pre-wrap", margin: 0 }, children: note.text }),
        /* @__PURE__ */ jsx("span", { className: "zephyr-text-subtle", style: { fontSize: 11 }, children: new Date(note.updatedAt).toLocaleString() })
      ] }, releaseId);
    }) })
  ] });
}
var detailSections = [
  {
    id: "my-plugin:notes",
    title: "Notes",
    component: NotesSection
  }
];
var routes = [
  {
    id: "my-plugin:home",
    navLabel: "My Notes",
    component: () => Promise.resolve({ default: NotesPage })
  }
];
export {
  detailSections,
  routes
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3JlYWN0LXNoaW0uanMiLCAic3JjL3JlYWN0LWpzeC1ydW50aW1lLXNoaW0uanMiLCAic3JjL3JlbmRlcmVyLmpzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLy8gUmVhZHMgUmVhY3QgZnJvbSB0aGUgaG9zdCBhcHAncyB3aW5kb3cgZ2xvYmFsIHNvIHRoZSBwbHVnaW4gc2hhcmVzXG4vLyB0aGUgc2FtZSBSZWFjdCBpbnN0YW5jZSAocmVxdWlyZWQgZm9yIGhvb2tzIHRvIHdvcmsgY29ycmVjdGx5KS5cbi8vXG4vLyBaZXBoeXIgc2V0cyBgd2luZG93Ll9femVwaHlyUmVhY3RgIGluIGBzcmMvcmVuZGVyZXIvbWFpbi50c3hgIGJlZm9yZSB0aGVcbi8vIGFwcCBtb3VudHMuIElmIGl0J3MgbWlzc2luZywgdGhlIHBsdWdpbiBpcyBiZWluZyBsb2FkZWQgb3V0c2lkZSBvZiBaZXBoeXJcbi8vIChvciBiZWZvcmUgdGhlIGhvc3QgaGFzIGluaXRpYWxpemVkKSBhbmQgbm9uZSBvZiB0aGUgZXhwb3J0cyB3b3VsZCB3b3JrLlxuY29uc3QgUmVhY3QgPSAvKiogQHR5cGUge3R5cGVvZiBpbXBvcnQoJ3JlYWN0JykgfCB1bmRlZmluZWR9ICovIChcbiAgLyoqIEB0eXBlIHtSZWNvcmQ8c3RyaW5nLCB1bmtub3duPn0gKi8gKGdsb2JhbFRoaXMpLl9femVwaHlyUmVhY3Rcbik7XG5pZiAoIVJlYWN0KSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAnWmVwaHlyIHBsdWdpbjogd2luZG93Ll9femVwaHlyUmVhY3QgaXMgbm90IGRlZmluZWQuIFRoaXMgYnVuZGxlIGlzIGludGVuZGVkIHRvIHJ1biBpbnNpZGUgWmVwaHlyLCB3aGljaCBwdWJsaXNoZXMgUmVhY3Qgb24gd2luZG93Ll9femVwaHlyUmVhY3QgYmVmb3JlIHRoZSBhcHAgbW91bnRzLicsXG4gICk7XG59XG5cbi8vIEZ1bGwgUmVhY3QgMTkgc3VyZmFjZSBzbyBwbHVnaW5zIGNhbiBpbXBvcnQgYW55IGhvb2svY29tcG9uZW50IHdpdGhvdXRcbi8vIHRoZSBzaGltIHNpbGVudGx5IHJldHVybmluZyB1bmRlZmluZWQuIElmIFJlYWN0IGFkZHMgbmV3IGV4cG9ydHMsIHVwZGF0ZVxuLy8gdGhpcyBsaXN0IFx1MjAxNCBhbnl0aGluZyBub3QgbGlzdGVkIGhlcmUgYmVjb21lcyBgdW5kZWZpbmVkYCBpbiBwbHVnaW4gY29kZS5cbmV4cG9ydCBjb25zdCB7XG4gIC8vIEhvb2tzXG4gIHVzZVN0YXRlLFxuICB1c2VFZmZlY3QsXG4gIHVzZUxheW91dEVmZmVjdCxcbiAgdXNlSW5zZXJ0aW9uRWZmZWN0LFxuICB1c2VSZWYsXG4gIHVzZU1lbW8sXG4gIHVzZUNhbGxiYWNrLFxuICB1c2VDb250ZXh0LFxuICB1c2VSZWR1Y2VyLFxuICB1c2VJZCxcbiAgdXNlVHJhbnNpdGlvbixcbiAgdXNlRGVmZXJyZWRWYWx1ZSxcbiAgdXNlSW1wZXJhdGl2ZUhhbmRsZSxcbiAgdXNlU3luY0V4dGVybmFsU3RvcmUsXG4gIHVzZURlYnVnVmFsdWUsXG4gIHVzZU9wdGltaXN0aWMsXG4gIHVzZUFjdGlvblN0YXRlLFxuICB1c2UsXG4gIC8vIENvbXBvbmVudHMgKyBjcmVhdG9yc1xuICBDb21wb25lbnQsXG4gIFB1cmVDb21wb25lbnQsXG4gIEZyYWdtZW50LFxuICBTdHJpY3RNb2RlLFxuICBTdXNwZW5zZSxcbiAgUHJvZmlsZXIsXG4gIC8vIEFQSXNcbiAgY3JlYXRlQ29udGV4dCxcbiAgY3JlYXRlRWxlbWVudCxcbiAgY2xvbmVFbGVtZW50LFxuICBjcmVhdGVSZWYsXG4gIGZvcndhcmRSZWYsXG4gIG1lbW8sXG4gIGxhenksXG4gIHN0YXJ0VHJhbnNpdGlvbixcbiAgaXNWYWxpZEVsZW1lbnQsXG4gIENoaWxkcmVuLFxuICB2ZXJzaW9uLFxufSA9IFJlYWN0O1xuZXhwb3J0IGRlZmF1bHQgUmVhY3Q7XG4iLCAiLy8gUmVhZHMgUmVhY3QncyBqc3gtcnVudGltZSBmcm9tIHRoZSBob3N0IGFwcCdzIHdpbmRvdyBnbG9iYWwuIFplcGh5ciBzZXRzXG4vLyBgd2luZG93Ll9femVwaHlySnN4UnVudGltZWAgaW4gYHNyYy9yZW5kZXJlci9tYWluLnRzeGAgYmVmb3JlIHRoZSBhcHAgbW91bnRzLlxuLy8gV2l0aG91dCBpdCB0aGUgcGx1Z2luIGJ1bmRsZSBjYW4ndCByZW5kZXIgSlNYIFx1MjAxNCBmYWlsIGxvdWRseSB3aXRoIGEgY2xlYXJcbi8vIG1lc3NhZ2UgaW5zdGVhZCBvZiBhIGNyeXB0aWMgZGVzdHJ1Y3R1cmluZyBUeXBlRXJyb3IuXG5jb25zdCBydCA9IC8qKiBAdHlwZSB7UmVjb3JkPHN0cmluZywgdW5rbm93bj59ICovIChnbG9iYWxUaGlzKS5fX3plcGh5ckpzeFJ1bnRpbWU7XG5pZiAoIXJ0KSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAnWmVwaHlyIHBsdWdpbjogd2luZG93Ll9femVwaHlySnN4UnVudGltZSBpcyBub3QgZGVmaW5lZC4gVGhpcyBidW5kbGUgaXMgaW50ZW5kZWQgdG8gcnVuIGluc2lkZSBaZXBoeXIsIHdoaWNoIHB1Ymxpc2hlcyByZWFjdC9qc3gtcnVudGltZSBvbiB3aW5kb3cuX196ZXBoeXJKc3hSdW50aW1lIGJlZm9yZSB0aGUgYXBwIG1vdW50cy4nLFxuICApO1xufVxuZXhwb3J0IGNvbnN0IHsganN4LCBqc3hzLCBGcmFnbWVudCB9ID0gcnQ7XG4iLCAiaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JztcblxuLy8gTm90ZXMgcGx1Z2luIFx1MjAxNCBleGVyY2lzZXMgZGV0YWlsU2VjdGlvbnMsIHJvdXRlcywgSVBDIHJvdW5kLXRyaXBzLCBhbmQgdGhlXG4vLyBgLnplcGh5ci0qYCBVSSBraXQuIFN0b3JhZ2UgaXMgb3duZWQgYnkgaW5kZXguanM7IHRoZSByZW5kZXJlciBvbmx5IGRyaXZlcyBJUEMuXG5cbmZ1bmN0aW9uIHVzZU5vdGVzKCkge1xuICBjb25zdCBbbm90ZXMsIHNldE5vdGVzXSA9IHVzZVN0YXRlKC8qKiBAdHlwZSB7UmVjb3JkPHN0cmluZywgeyB0ZXh0OiBzdHJpbmc7IHVwZGF0ZWRBdDogbnVtYmVyIH0+fSAqLyAoe30pKTtcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG5cbiAgY29uc3QgcmVmcmVzaCA9IHVzZUNhbGxiYWNrKGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbmV4dCA9IGF3YWl0IHdpbmRvdy5hcGkuaW52b2tlUGx1Z2luKCdteS1wbHVnaW46bGlzdC1ub3RlcycpO1xuICAgICAgc2V0Tm90ZXMobmV4dCA/PyB7fSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTm90ZXNdIGxpc3Qtbm90ZXMgZmFpbGVkOicsIGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfSwgW10pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgcmVmcmVzaCgpO1xuICB9LCBbcmVmcmVzaF0pO1xuXG4gIHJldHVybiB7IG5vdGVzLCBsb2FkaW5nLCByZWZyZXNoIH07XG59XG5cbi8vIERldGFpbCBzZWN0aW9uIFx1MjAxNCByZW5kZXJzIGJlbG93IHRvcnJlbnQgcmVzdWx0cy5cblxuZnVuY3Rpb24gTm90ZXNTZWN0aW9uKHsgcmVsZWFzZSB9KSB7XG4gIGNvbnN0IHsgbm90ZXMsIHJlZnJlc2ggfSA9IHVzZU5vdGVzKCk7XG4gIGNvbnN0IGV4aXN0aW5nID0gbm90ZXNbcmVsZWFzZS5pZF07XG4gIGNvbnN0IFtkcmFmdCwgc2V0RHJhZnRdID0gdXNlU3RhdGUoJycpO1xuICBjb25zdCBbc3RhdHVzLCBzZXRTdGF0dXNdID0gdXNlU3RhdGUoXG4gICAgLyoqIEB0eXBlIHsnaWRsZScgfCAnc2F2aW5nJyB8ICdzYXZlZCcgfCAnZXJyb3InfSAqLyAoJ2lkbGUnKSxcbiAgKTtcbiAgY29uc3QgW2Vycm9yTWVzc2FnZSwgc2V0RXJyb3JNZXNzYWdlXSA9IHVzZVN0YXRlKCcnKTtcbiAgLy8gU3RvcmVkIGluIGEgcmVmIHNvIHJhcGlkIHN1Y2Nlc3NpdmUgc2F2ZXMgY2FuIGNhbmNlbCB0aGUgcHJldmlvdXMgdGltZXJcbiAgLy8gYmVmb3JlIHNjaGVkdWxpbmcgYSBuZXcgb25lIFx1MjAxNCBvdGhlcndpc2UgYSBzdGFsZSB0aW1lciBmbGlwcyBzdGF0dXMgdG9cbiAgLy8gJ2lkbGUnIG1pZC1yZXF1ZXN0LlxuICBjb25zdCBzYXZlVGltZXJSZWYgPSB1c2VSZWYoLyoqIEB0eXBlIHtSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IG51bGx9ICovIChudWxsKSk7XG5cbiAgZnVuY3Rpb24gY2xlYXJTYXZlVGltZXIoKSB7XG4gICAgaWYgKHNhdmVUaW1lclJlZi5jdXJyZW50ICE9PSBudWxsKSB7XG4gICAgICBjbGVhclRpbWVvdXQoc2F2ZVRpbWVyUmVmLmN1cnJlbnQpO1xuICAgICAgc2F2ZVRpbWVyUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgc2V0RHJhZnQoZXhpc3Rpbmc/LnRleHQgPz8gJycpO1xuICAgIHNldFN0YXR1cygnaWRsZScpO1xuICAgIHNldEVycm9yTWVzc2FnZSgnJyk7XG4gIH0sIFtyZWxlYXNlLmlkLCBleGlzdGluZz8udGV4dF0pO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiBjbGVhclNhdmVUaW1lciwgW10pO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHNhdmUoKSB7XG4gICAgY2xlYXJTYXZlVGltZXIoKTtcbiAgICBzZXRTdGF0dXMoJ3NhdmluZycpO1xuICAgIHNldEVycm9yTWVzc2FnZSgnJyk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHdpbmRvdy5hcGkuaW52b2tlUGx1Z2luKCdteS1wbHVnaW46c2F2ZS1ub3RlJywge1xuICAgICAgICByZWxlYXNlSWQ6IHJlbGVhc2UuaWQsXG4gICAgICAgIHRleHQ6IGRyYWZ0LFxuICAgICAgfSk7XG4gICAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgICBzZXRTdGF0dXMoJ3NhdmVkJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbTm90ZXNdIHNhdmUgZmFpbGVkOicsIGVycik7XG4gICAgICBzZXRFcnJvck1lc3NhZ2UoZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpKTtcbiAgICAgIHNldFN0YXR1cygnZXJyb3InKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2F2ZVRpbWVyUmVmLmN1cnJlbnQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgc2F2ZVRpbWVyUmVmLmN1cnJlbnQgPSBudWxsO1xuICAgICAgICBzZXRTdGF0dXMoJ2lkbGUnKTtcbiAgICAgIH0sIDEyMDApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGRpcnR5ID0gZHJhZnQudHJpbSgpICE9PSAoZXhpc3Rpbmc/LnRleHQgPz8gJycpO1xuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItc3RhY2tcIj5cbiAgICAgIDx0ZXh0YXJlYVxuICAgICAgICBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dGFyZWFcIlxuICAgICAgICB2YWx1ZT17ZHJhZnR9XG4gICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0RHJhZnQoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICBwbGFjZWhvbGRlcj17YFdyaXRlIGEgbm90ZSBhYm91dCAke3JlbGVhc2UudGl0bGV9XHUyMDI2YH1cbiAgICAgICAgcm93cz17NH1cbiAgICAgICAgc3R5bGU9e3sgcmVzaXplOiAndmVydGljYWwnIH19XG4gICAgICAvPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItcm93XCIgc3R5bGU9e3sganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJyB9fT5cbiAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtc3VidGxlXCIgc3R5bGU9e3sgZm9udFNpemU6IDExIH19PlxuICAgICAgICAgIHtzdGF0dXMgPT09ICdlcnJvcidcbiAgICAgICAgICAgID8gYFNhdmUgZmFpbGVkOiAke2Vycm9yTWVzc2FnZX1gXG4gICAgICAgICAgICA6IGV4aXN0aW5nXG4gICAgICAgICAgICAgID8gYExhc3QgdXBkYXRlZCAke25ldyBEYXRlKGV4aXN0aW5nLnVwZGF0ZWRBdCkudG9Mb2NhbGVTdHJpbmcoKX1gXG4gICAgICAgICAgICAgIDogJ05vIG5vdGUgc2F2ZWQgeWV0IGZvciB0aGlzIHJlbGVhc2UnfVxuICAgICAgICA8L3NwYW4+XG4gICAgICAgIDxidXR0b25cbiAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICBvbkNsaWNrPXtzYXZlfVxuICAgICAgICAgIGRpc2FibGVkPXshZGlydHkgfHwgc3RhdHVzID09PSAnc2F2aW5nJ31cbiAgICAgICAgICBjbGFzc05hbWU9e2B6ZXBoeXItYnV0dG9uICR7ZGlydHkgPyAnemVwaHlyLWJ1dHRvbi0tcHJpbWFyeScgOiAnJ31gfVxuICAgICAgICA+XG4gICAgICAgICAge3N0YXR1cyA9PT0gJ3NhdmluZydcbiAgICAgICAgICAgID8gJ1NhdmluZ1x1MjAyNidcbiAgICAgICAgICAgIDogc3RhdHVzID09PSAnc2F2ZWQnXG4gICAgICAgICAgICAgID8gJ1NhdmVkISdcbiAgICAgICAgICAgICAgOiBzdGF0dXMgPT09ICdlcnJvcidcbiAgICAgICAgICAgICAgICA/ICdSZXRyeSdcbiAgICAgICAgICAgICAgICA6IGV4aXN0aW5nXG4gICAgICAgICAgICAgICAgICA/ICdVcGRhdGUnXG4gICAgICAgICAgICAgICAgICA6ICdTYXZlIG5vdGUnfVxuICAgICAgICA8L2J1dHRvbj5cbiAgICAgIDwvZGl2PlxuICAgIDwvZGl2PlxuICApO1xufVxuXG4vLyBGdWxsLXBhZ2Ugcm91dGUgXHUyMDE0IG9wZW5zIGZyb20gdGhlIGhlYWRlciBuYXYuIGByZWxlYXNlYCBpcyB0aGUgbGFzdC12aWV3ZWRcbi8vIG9uZSB0aGlzIHNlc3Npb24gKG9yIHVuZGVmaW5lZCksIHVzZWQgaGVyZSB0byBoaWdobGlnaHQgdGhlIGFjdGl2ZSBub3RlLlxuXG5mdW5jdGlvbiBOb3Rlc1BhZ2UoeyByZWxlYXNlIH0pIHtcbiAgY29uc3QgeyBub3RlcywgbG9hZGluZywgcmVmcmVzaCB9ID0gdXNlTm90ZXMoKTtcbiAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKG5vdGVzKS5zb3J0KFxuICAgIChbLCBhXSwgWywgYl0pID0+IGIudXBkYXRlZEF0IC0gYS51cGRhdGVkQXQsXG4gICk7XG5cbiAgYXN5bmMgZnVuY3Rpb24gcmVtb3ZlKHJlbGVhc2VJZCkge1xuICAgIGF3YWl0IHdpbmRvdy5hcGkuaW52b2tlUGx1Z2luKCdteS1wbHVnaW46ZGVsZXRlLW5vdGUnLCB7IHJlbGVhc2VJZCB9KTtcbiAgICBhd2FpdCByZWZyZXNoKCk7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXN0YWNrLS1tZFwiIHN0eWxlPXt7IHBhZGRpbmc6IDI0LCBtYXhXaWR0aDogNzIwLCBtYXJnaW46ICcwIGF1dG8nIH19PlxuICAgICAgPGRpdj5cbiAgICAgICAgPGgyIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXByaW1hcnlcIiBzdHlsZT17eyBmb250U2l6ZTogMjIsIGZvbnRXZWlnaHQ6IDcwMCwgbWFyZ2luOiAwIH19PlxuICAgICAgICAgIFlvdXIgbm90ZXNcbiAgICAgICAgPC9oMj5cbiAgICAgICAgPHAgY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtbXV0ZWRcIiBzdHlsZT17eyBtYXJnaW5Ub3A6IDQgfX0+XG4gICAgICAgICAgUGVyc29uYWwgbm90ZXMgeW91J3ZlIHNhdmVkIGFib3V0IHJlbGVhc2VzLiBPcGVuIGFueSByZWxlYXNlJ3MgZGV0YWlsIHBhZ2UgdG8gYWRkIG9uZS5cbiAgICAgICAgPC9wPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIHtyZWxlYXNlICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItY2FyZCB6ZXBoeXItcm93XCIgc3R5bGU9e3sganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJyB9fT5cbiAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItbGFiZWxcIj5MYXN0IHZpZXdlZDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1wcmltYXJ5XCIgc3R5bGU9e3sgbWFyZ2luVG9wOiA0IH19PntyZWxlYXNlLnRpdGxlfTwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci1waWxsXCI+e3JlbGVhc2UuaWR9PC9zcGFuPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG5cbiAgICAgIHtsb2FkaW5nID8gKFxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIj5Mb2FkaW5nXHUyMDI2PC9wPlxuICAgICAgKSA6IGVudHJpZXMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1jYXJkXCIgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJyB9fT5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1tdXRlZFwiIHN0eWxlPXt7IG1hcmdpbjogMCB9fT5cbiAgICAgICAgICAgIE5vIG5vdGVzIHlldC4gUGljayBhIHJlbGVhc2UgZnJvbSB0aGUgZ3JpZCwgc2Nyb2xsIHRvIHRoZSBcIk5vdGVzXCIgc2VjdGlvbiBhdCB0aGVcbiAgICAgICAgICAgIGJvdHRvbSBvZiBpdHMgZGV0YWlsIHBhZ2UsIGFuZCB5b3VyIG5vdGUgd2lsbCBzaG93IHVwIGhlcmUuXG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICkgOiAoXG4gICAgICAgIDx1bCBjbGFzc05hbWU9XCJ6ZXBoeXItc3RhY2tcIiBzdHlsZT17eyBsaXN0U3R5bGU6ICdub25lJywgcGFkZGluZzogMCwgbWFyZ2luOiAwIH19PlxuICAgICAgICAgIHtlbnRyaWVzLm1hcCgoW3JlbGVhc2VJZCwgbm90ZV0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGlzQ3VycmVudCA9IHJlbGVhc2U/LmlkID09PSByZWxlYXNlSWQ7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICA8bGkga2V5PXtyZWxlYXNlSWR9IGNsYXNzTmFtZT1cInplcGh5ci1jYXJkIHplcGh5ci1zdGFja1wiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXJvd1wiIHN0eWxlPXt7IGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicgfX0+XG4gICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ6ZXBoeXItbGFiZWxcIj5cbiAgICAgICAgICAgICAgICAgICAge2lzQ3VycmVudCA/ICdcdTI2MDUgQ3VycmVudCByZWxlYXNlIFx1MDBCNyAnIDogJyd9XG4gICAgICAgICAgICAgICAgICAgIHtyZWxlYXNlSWR9XG4gICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiByZW1vdmUocmVsZWFzZUlkKX1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLWJ1dHRvbiB6ZXBoeXItYnV0dG9uLS1kYW5nZXJcIlxuICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogMTEgfX1cbiAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgRGVsZXRlXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zZWNvbmRhcnlcIiBzdHlsZT17eyB3aGl0ZVNwYWNlOiAncHJlLXdyYXAnLCBtYXJnaW46IDAgfX0+XG4gICAgICAgICAgICAgICAgICB7bm90ZS50ZXh0fVxuICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIiBzdHlsZT17eyBmb250U2l6ZTogMTEgfX0+XG4gICAgICAgICAgICAgICAgICB7bmV3IERhdGUobm90ZS51cGRhdGVkQXQpLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC91bD5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmV4cG9ydCBjb25zdCBkZXRhaWxTZWN0aW9ucyA9IFtcbiAge1xuICAgIGlkOiAnbXktcGx1Z2luOm5vdGVzJyxcbiAgICB0aXRsZTogJ05vdGVzJyxcbiAgICBjb21wb25lbnQ6IE5vdGVzU2VjdGlvbixcbiAgfSxcbl07XG5cbmV4cG9ydCBjb25zdCByb3V0ZXMgPSBbXG4gIHtcbiAgICBpZDogJ215LXBsdWdpbjpob21lJyxcbiAgICBuYXZMYWJlbDogJ015IE5vdGVzJyxcbiAgICBjb21wb25lbnQ6ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGRlZmF1bHQ6IE5vdGVzUGFnZSB9KSxcbiAgfSxcbl07XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBTUEsSUFBTTtBQUFBO0FBQUE7QUFBQSxFQUNvQyxXQUFZO0FBQUE7QUFFdEQsSUFBSSxDQUFDLE9BQU87QUFDVixRQUFNLElBQUk7QUFBQSxJQUNSO0FBQUEsRUFDRjtBQUNGO0FBS08sSUFBTTtBQUFBO0FBQUEsRUFFWDtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEs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
