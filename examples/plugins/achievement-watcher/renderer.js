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
  Component,
  PureComponent,
  Fragment,
  StrictMode,
  Suspense,
  Profiler,
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
function useServiceStatus() {
  const [status, setStatus] = useState(
    /** @type {{ serviceInstalled: boolean; serviceRunning: boolean; widgetInstalled: boolean; connected: boolean } | null} */
    null
  );
  useEffect(() => {
    async function poll() {
      try {
        const s = await window.api.invokePlugin("achievement-watcher:get-status");
        setStatus(s);
      } catch {
      }
    }
    poll();
    const id = setInterval(poll, 1e4);
    return () => clearInterval(id);
  }, []);
  return status;
}
function useAllGames() {
  const [games, setGames] = useState(
    /** @type {any[]} */
    []
  );
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      const result = await window.api.invokePlugin("achievement-watcher:get-all");
      setGames(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("[achievement-watcher] get-all failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15e3);
    return () => clearInterval(id);
  }, [refresh]);
  return { games, loading, refresh };
}
function AchievementPage({ release }) {
  const { games, loading, refresh } = useAllGames();
  const status = useServiceStatus();
  const [installing, setInstalling] = useState(
    /** @type {'service' | 'widget' | 'start' | null} */
    null
  );
  async function rescan(infoHash) {
    await window.api.invokePlugin("achievement-watcher:rescan", { infoHash });
    await refresh();
  }
  async function installService() {
    setInstalling("service");
    try {
      await window.api.invokePlugin("achievement-watcher:install-service");
    } catch (err) {
      console.error("[achievement-watcher] install-service failed:", err);
    } finally {
      setInstalling(null);
    }
  }
  async function installWidget() {
    setInstalling("widget");
    try {
      await window.api.invokePlugin("achievement-watcher:install-widget");
    } catch (err) {
      console.error("[achievement-watcher] install-widget failed:", err);
    } finally {
      setInstalling(null);
    }
  }
  async function startService() {
    setInstalling("start");
    try {
      await window.api.invokePlugin("achievement-watcher:start-service");
    } catch (err) {
      console.error("[achievement-watcher] start-service failed:", err);
    } finally {
      setInstalling(null);
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-stack--md", style: { padding: 24, maxWidth: 820, margin: "0 auto" }, children: [
    /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "zephyr-text-primary", style: { fontSize: 22, fontWeight: 700, margin: 0 }, children: "Achievement Watcher" }),
        /* @__PURE__ */ jsxs("p", { className: "zephyr-text-muted", style: { marginTop: 4 }, children: [
          "Tracks achievement unlocks across installed library games. Add a Steam API Key in",
          " ",
          /* @__PURE__ */ jsx("em", { children: "Settings \u2192 Plugins" }),
          " to fetch achievement names and icons."
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "zephyr-button",
          style: { flexShrink: 0, fontSize: 12 },
          onClick: () => window.api.invokePlugin("achievement-watcher:test-notification"),
          children: "Test notification"
        }
      )
    ] }),
    status && !status.serviceInstalled && /* @__PURE__ */ jsxs("div", { className: "zephyr-card", style: { borderLeft: "3px solid var(--zephyr-accent)", padding: 16 }, children: [
      /* @__PURE__ */ jsx("div", { className: "zephyr-text-primary", style: { fontWeight: 700, marginBottom: 6 }, children: "Achievement Service not installed" }),
      /* @__PURE__ */ jsx("p", { className: "zephyr-text-muted", style: { margin: "0 0 12px", fontSize: 13 }, children: "The background service watches your achievement files even while Zephyr is closed, and delivers unlock notifications to the Game Bar widget during gameplay." }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "zephyr-button",
          onClick: installService,
          disabled: installing === "service",
          children: installing === "service" ? "Installing\u2026" : "Install Achievement Service"
        }
      )
    ] }),
    status && status.serviceInstalled && !status.serviceRunning && /* @__PURE__ */ jsxs("div", { className: "zephyr-card", style: { borderLeft: "3px solid var(--zephyr-accent)", padding: 16 }, children: [
      /* @__PURE__ */ jsx("div", { className: "zephyr-text-primary", style: { fontWeight: 700, marginBottom: 4 }, children: "Service installed but not running" }),
      /* @__PURE__ */ jsxs("p", { className: "zephyr-text-muted", style: { margin: "0 0 12px", fontSize: 13 }, children: [
        "The achievement service isn't listening. Start it now \u2014 it'll auto-start at every login thereafter. If starting fails repeatedly, check Task Scheduler's",
        " ",
        /* @__PURE__ */ jsx("em", { children: "Last Run Result" }),
        " for ",
        /* @__PURE__ */ jsx("em", { children: "ZephyrAchievementWatcher" }),
        "."
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "zephyr-button",
          onClick: startService,
          disabled: installing === "start",
          children: installing === "start" ? "Starting\u2026" : "Start Service"
        }
      )
    ] }),
    status && status.serviceInstalled && !status.widgetInstalled && /* @__PURE__ */ jsxs("div", { className: "zephyr-card", style: { borderLeft: "3px solid var(--zephyr-border)", padding: 16 }, children: [
      /* @__PURE__ */ jsx("div", { className: "zephyr-text-primary", style: { fontWeight: 700, marginBottom: 6 }, children: "Game Bar widget not installed" }),
      /* @__PURE__ */ jsx("p", { className: "zephyr-text-muted", style: { margin: "0 0 12px", fontSize: 13 }, children: "Install the Game Bar widget to see achievement toast notifications while playing in full-screen exclusive mode." }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "zephyr-button",
          onClick: installWidget,
          disabled: installing === "widget",
          children: installing === "widget" ? "Installing\u2026" : "Install Game Bar Widget"
        }
      )
    ] }),
    status && status.serviceInstalled && status.widgetInstalled && /* @__PURE__ */ jsxs("div", { className: "zephyr-card", style: { borderLeft: "3px solid var(--zephyr-border)", padding: 12 }, children: [
      /* @__PURE__ */ jsx("div", { className: "zephyr-text-primary", style: { fontWeight: 600, marginBottom: 4, fontSize: 13 }, children: "Pin the widget to Game Bar" }),
      /* @__PURE__ */ jsxs("p", { className: "zephyr-text-muted", style: { margin: 0, fontSize: 12 }, children: [
        "Press ",
        /* @__PURE__ */ jsx("strong", { children: "Win+G" }),
        " to open Game Bar, find ",
        /* @__PURE__ */ jsx("em", { children: "Achievement Watcher" }),
        ", then click the ",
        /* @__PURE__ */ jsx("strong", { children: "Pin" }),
        " icon. The widget must be pinned to show notifications while you play."
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("p", { className: "zephyr-text-subtle", children: "Scanning library\u2026" }) : games.length === 0 ? /* @__PURE__ */ jsx("div", { className: "zephyr-card", style: { textAlign: "center", padding: 32 }, children: /* @__PURE__ */ jsx("p", { className: "zephyr-text-muted", style: { margin: 0 }, children: "No games with detectable achievement files found yet. Install a game using a Steam emulator (Goldberg, CODEX, etc.) \u2014 files are detected automatically." }) }) : /* @__PURE__ */ jsx("div", { className: "zephyr-stack", children: games.map((game) => /* @__PURE__ */ jsx(GameCard, { game, onRescan: () => rescan(game.infoHash) }, game.infoHash)) })
  ] });
}
function GameCard({ game, onRescan }) {
  const [expanded, setExpanded] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const pct = game.total > 0 ? Math.round(game.earned / game.total * 100) : 0;
  async function handleRescan() {
    setRescanning(true);
    await onRescan();
    setRescanning(false);
  }
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-card zephyr-stack", style: { gap: 10 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ jsx("div", { className: "zephyr-text-primary", style: { fontWeight: 700, fontSize: 14 }, children: game.title }),
        /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { gap: 6, marginTop: 5, flexWrap: "wrap" }, children: [
          game.watching ? /* @__PURE__ */ jsx(
            "span",
            {
              className: "zephyr-pill",
              style: { background: "var(--zephyr-accent)", color: "var(--zephyr-on-accent)", fontSize: 10 },
              children: "\u25CF Live"
            }
          ) : /* @__PURE__ */ jsx("span", { className: "zephyr-pill", style: { fontSize: 10 }, children: "Not watching" }),
          game.appId && /* @__PURE__ */ jsxs("span", { className: "zephyr-pill", style: { fontSize: 10 }, children: [
            "AppID ",
            game.appId
          ] }),
          game.lastChecked && /* @__PURE__ */ jsxs("span", { className: "zephyr-text-subtle", style: { fontSize: 10 }, children: [
            "checked ",
            new Date(game.lastChecked).toLocaleTimeString()
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { gap: 8, flexShrink: 0, alignItems: "center" }, children: [
        /* @__PURE__ */ jsxs("span", { className: "zephyr-text-accent", style: { fontWeight: 700, fontSize: 16 }, children: [
          game.earned,
          /* @__PURE__ */ jsxs("span", { className: "zephyr-text-muted", style: { fontWeight: 400, fontSize: 12 }, children: [
            "/",
            game.total
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "zephyr-button",
            style: { fontSize: 11, padding: "3px 10px" },
            onClick: handleRescan,
            disabled: rescanning,
            children: rescanning ? "\u2026" : "Rescan"
          }
        ),
        game.total > 0 && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "zephyr-button",
            style: { fontSize: 11, padding: "3px 10px" },
            onClick: () => setExpanded((e) => !e),
            children: expanded ? "Hide" : "Show"
          }
        )
      ] })
    ] }),
    game.total > 0 && /* @__PURE__ */ jsx("div", { style: { height: 5, background: "var(--zephyr-border)", borderRadius: 3, overflow: "hidden" }, children: /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--zephyr-accent), var(--zephyr-accent-strong, var(--zephyr-accent)))",
          borderRadius: 3,
          transition: "width 0.5s ease"
        }
      }
    ) }),
    game.detectionNote && !game.watching && /* @__PURE__ */ jsx("p", { className: "zephyr-text-subtle", style: { fontSize: 11, margin: 0 }, children: game.detectionNote }),
    expanded && Array.isArray(game.unlocks) && game.unlocks.length > 0 && /* @__PURE__ */ jsx(AchievementGrid, { unlocks: game.unlocks })
  ] });
}
function AchievementGrid({ unlocks }) {
  const earned = unlocks.filter((u) => u.earned);
  const unearned = unlocks.filter((u) => !u.earned);
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-stack", style: { gap: 10, marginTop: 4, borderTop: "1px solid var(--zephyr-border)", paddingTop: 10 }, children: [
    earned.length > 0 && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsxs("span", { className: "zephyr-label", children: [
        "Unlocked \u2014 ",
        earned.length
      ] }),
      /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 6 }, children: earned.map((u) => /* @__PURE__ */ jsx(AchievementChip, { ach: u }, u.id)) })
    ] }),
    unearned.length > 0 && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsxs("span", { className: "zephyr-label", style: { marginTop: earned.length > 0 ? 8 : 0 }, children: [
        "Locked \u2014 ",
        unearned.length
      ] }),
      /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 6 }, children: unearned.map((u) => /* @__PURE__ */ jsx(AchievementChip, { ach: u }, u.id)) })
    ] })
  ] });
}
function AchievementChip({ ach }) {
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "zephyr-card zephyr-row",
      style: {
        gap: 8,
        padding: "7px 10px",
        alignItems: "center",
        opacity: ach.earned ? 1 : 0.4,
        background: ach.earned ? "var(--zephyr-bg-elevated)" : "var(--zephyr-bg-surface)",
        transition: "opacity 0.2s"
      },
      children: [
        ach.iconUrl ? /* @__PURE__ */ jsx(
          "img",
          {
            src: ach.iconUrl,
            style: { width: 32, height: 32, borderRadius: 3, flexShrink: 0, objectFit: "cover" },
            alt: "",
            onError: (e) => {
              e.currentTarget.style.display = "none";
            }
          }
        ) : /* @__PURE__ */ jsx(
          "div",
          {
            style: {
              width: 32,
              height: 32,
              borderRadius: 3,
              background: "var(--zephyr-border)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16
            },
            children: "\u{1F3C6}"
          }
        ),
        /* @__PURE__ */ jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "zephyr-text-primary",
              style: { fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              children: ach.displayName
            }
          ),
          ach.description && /* @__PURE__ */ jsx(
            "div",
            {
              className: "zephyr-text-subtle",
              style: { fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
              children: ach.description
            }
          ),
          ach.earned && ach.unlockedAt && /* @__PURE__ */ jsx("div", { className: "zephyr-text-subtle", style: { fontSize: 9 }, children: new Date(ach.unlockedAt * 1e3).toLocaleDateString() })
        ] }),
        ach.earned && /* @__PURE__ */ jsx("span", { style: { color: "var(--zephyr-success, #22c55e)", fontSize: 13, flexShrink: 0 }, children: "\u2713" })
      ]
    }
  );
}
function AchievementSection({ release }) {
  const { games, loading } = useAllGames();
  const match = games.find((g) => {
    const a = g.title.toLowerCase();
    const b = release.title.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  });
  if (loading) {
    return /* @__PURE__ */ jsx("p", { className: "zephyr-text-subtle", style: { fontSize: 12, margin: 0 }, children: "Loading\u2026" });
  }
  if (!match) {
    return /* @__PURE__ */ jsx("p", { className: "zephyr-text-muted", style: { fontSize: 12, margin: 0 }, children: "Not in library or no achievement files detected for this title." });
  }
  const pct = match.total > 0 ? Math.round(match.earned / match.total * 100) : 0;
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-stack", style: { gap: 12 }, children: [
    /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { justifyContent: "space-between", alignItems: "center" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "zephyr-row", style: { gap: 8, alignItems: "baseline" }, children: [
        /* @__PURE__ */ jsx("span", { className: "zephyr-text-accent", style: { fontWeight: 700, fontSize: 22 }, children: match.earned }),
        /* @__PURE__ */ jsxs("span", { className: "zephyr-text-muted", style: { fontSize: 13 }, children: [
          "/ ",
          match.total,
          " achievements"
        ] }),
        match.total > 0 && /* @__PURE__ */ jsxs("span", { className: "zephyr-text-subtle", style: { fontSize: 12 }, children: [
          "(",
          pct,
          "%)"
        ] })
      ] }),
      match.watching ? /* @__PURE__ */ jsx(
        "span",
        {
          className: "zephyr-pill",
          style: { background: "var(--zephyr-accent)", color: "var(--zephyr-on-accent)", fontSize: 10 },
          children: "\u25CF Live"
        }
      ) : /* @__PURE__ */ jsx("span", { className: "zephyr-pill", style: { fontSize: 10 }, children: "Not watching" })
    ] }),
    match.total > 0 && /* @__PURE__ */ jsx("div", { style: { height: 6, background: "var(--zephyr-border)", borderRadius: 3, overflow: "hidden" }, children: /* @__PURE__ */ jsx(
      "div",
      {
        style: {
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--zephyr-accent), var(--zephyr-accent-strong, var(--zephyr-accent)))",
          borderRadius: 3,
          transition: "width 0.5s ease"
        }
      }
    ) }),
    match.detectionNote && /* @__PURE__ */ jsx("p", { className: "zephyr-text-subtle", style: { fontSize: 11, margin: 0 }, children: match.detectionNote }),
    Array.isArray(match.unlocks) && match.unlocks.length > 0 && /* @__PURE__ */ jsx(AchievementGrid, { unlocks: match.unlocks })
  ] });
}
var detailSections = [
  {
    id: "achievement-watcher:progress",
    title: "Achievements",
    component: AchievementSection
  }
];
var routes = [
  {
    id: "achievement-watcher:home",
    navLabel: "Achievements",
    component: () => Promise.resolve({ default: AchievementPage })
  }
];
export {
  detailSections,
  routes
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3JlYWN0LXNoaW0uanMiLCAic3JjL3JlYWN0LWpzeC1ydW50aW1lLXNoaW0uanMiLCAic3JjL3JlbmRlcmVyLmpzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgUmVhY3QgPSAvKiogQHR5cGUge3R5cGVvZiBpbXBvcnQoJ3JlYWN0JykgfCB1bmRlZmluZWR9ICovIChcbiAgLyoqIEB0eXBlIHtSZWNvcmQ8c3RyaW5nLCB1bmtub3duPn0gKi8gKGdsb2JhbFRoaXMpLl9femVwaHlyUmVhY3Rcbik7XG5pZiAoIVJlYWN0KSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAnWmVwaHlyIHBsdWdpbjogd2luZG93Ll9femVwaHlyUmVhY3QgaXMgbm90IGRlZmluZWQuIFRoaXMgYnVuZGxlIGlzIGludGVuZGVkIHRvIHJ1biBpbnNpZGUgWmVwaHlyLCB3aGljaCBwdWJsaXNoZXMgUmVhY3Qgb24gd2luZG93Ll9femVwaHlyUmVhY3QgYmVmb3JlIHRoZSBhcHAgbW91bnRzLicsXG4gICk7XG59XG5cbmV4cG9ydCBjb25zdCB7XG4gIHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZUxheW91dEVmZmVjdCwgdXNlSW5zZXJ0aW9uRWZmZWN0LCB1c2VSZWYsIHVzZU1lbW8sIHVzZUNhbGxiYWNrLFxuICB1c2VDb250ZXh0LCB1c2VSZWR1Y2VyLCB1c2VJZCwgdXNlVHJhbnNpdGlvbiwgdXNlRGVmZXJyZWRWYWx1ZSwgdXNlSW1wZXJhdGl2ZUhhbmRsZSxcbiAgdXNlU3luY0V4dGVybmFsU3RvcmUsIHVzZURlYnVnVmFsdWUsIHVzZU9wdGltaXN0aWMsIHVzZUFjdGlvblN0YXRlLCB1c2UsXG4gIENvbXBvbmVudCwgUHVyZUNvbXBvbmVudCwgRnJhZ21lbnQsIFN0cmljdE1vZGUsIFN1c3BlbnNlLCBQcm9maWxlcixcbiAgY3JlYXRlQ29udGV4dCwgY3JlYXRlRWxlbWVudCwgY2xvbmVFbGVtZW50LCBjcmVhdGVSZWYsIGZvcndhcmRSZWYsIG1lbW8sIGxhenksXG4gIHN0YXJ0VHJhbnNpdGlvbiwgaXNWYWxpZEVsZW1lbnQsIENoaWxkcmVuLCB2ZXJzaW9uLFxufSA9IFJlYWN0O1xuZXhwb3J0IGRlZmF1bHQgUmVhY3Q7XG4iLCAiY29uc3QgcnQgPSAvKiogQHR5cGUge1JlY29yZDxzdHJpbmcsIHVua25vd24+fSAqLyAoZ2xvYmFsVGhpcykuX196ZXBoeXJKc3hSdW50aW1lO1xuaWYgKCFydCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgJ1plcGh5ciBwbHVnaW46IHdpbmRvdy5fX3plcGh5ckpzeFJ1bnRpbWUgaXMgbm90IGRlZmluZWQuIFRoaXMgYnVuZGxlIGlzIGludGVuZGVkIHRvIHJ1biBpbnNpZGUgWmVwaHlyLCB3aGljaCBwdWJsaXNoZXMgcmVhY3QvanN4LXJ1bnRpbWUgb24gd2luZG93Ll9femVwaHlySnN4UnVudGltZSBiZWZvcmUgdGhlIGFwcCBtb3VudHMuJyxcbiAgKTtcbn1cbmV4cG9ydCBjb25zdCB7IGpzeCwganN4cywgRnJhZ21lbnQgfSA9IHJ0O1xuIiwgIi8vIEFjaGlldmVtZW50IFdhdGNoZXIgXHUyMDE0IHJlbmRlcmVyIGxheWVyXG4vLyBBbGwgc3R5bGluZyB1c2VzIHRoZSBaZXBoeXIgUGx1Z2luIFVJIEtpdCAoLnplcGh5ci0qIC8gLS16ZXBoeXItKikuIFRhaWx3aW5kIGNsYXNzZXMgZG8gTk9UIHdvcmsgaGVyZS5cbi8vIEFjaGlldmVtZW50IHVubG9jayBub3RpZmljYXRpb25zIGFyZSBkZWxpdmVyZWQgdmlhIHRoZSBXaW5kb3dzIG5vdGlmaWNhdGlvbiBBUEkgKEVsZWN0cm9uLk5vdGlmaWNhdGlvbilcbi8vIGZyb20gdGhlIG1haW4gcHJvY2VzcyBcdTIwMTQgbm8gaW4tYXBwIHRvYXN0IG92ZXJsYXkgbmVlZGVkIGhlcmUuXG5cbmltcG9ydCB7IHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZUNhbGxiYWNrIH0gZnJvbSAncmVhY3QnO1xuXG4vLyBcdTI1MDBcdTI1MDAgUmVhY3QgaG9va3MgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIHVzZVNlcnZpY2VTdGF0dXMoKSB7XG4gIGNvbnN0IFtzdGF0dXMsIHNldFN0YXR1c10gPSB1c2VTdGF0ZSgvKiogQHR5cGUge3sgc2VydmljZUluc3RhbGxlZDogYm9vbGVhbjsgc2VydmljZVJ1bm5pbmc6IGJvb2xlYW47IHdpZGdldEluc3RhbGxlZDogYm9vbGVhbjsgY29ubmVjdGVkOiBib29sZWFuIH0gfCBudWxsfSAqLyAobnVsbCkpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgYXN5bmMgZnVuY3Rpb24gcG9sbCgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHMgPSBhd2FpdCB3aW5kb3cuYXBpLmludm9rZVBsdWdpbignYWNoaWV2ZW1lbnQtd2F0Y2hlcjpnZXQtc3RhdHVzJyk7XG4gICAgICAgIHNldFN0YXR1cyhzKTtcbiAgICAgIH0gY2F0Y2gge31cbiAgICB9XG4gICAgcG9sbCgpO1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwocG9sbCwgMTAwMDApO1xuICAgIHJldHVybiAoKSA9PiBjbGVhckludGVydmFsKGlkKTtcbiAgfSwgW10pO1xuXG4gIHJldHVybiBzdGF0dXM7XG59XG5cbmZ1bmN0aW9uIHVzZUFsbEdhbWVzKCkge1xuICBjb25zdCBbZ2FtZXMsIHNldEdhbWVzXSA9IHVzZVN0YXRlKC8qKiBAdHlwZSB7YW55W119ICovIChbXSkpO1xuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSB1c2VTdGF0ZSh0cnVlKTtcblxuICBjb25zdCByZWZyZXNoID0gdXNlQ2FsbGJhY2soYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB3aW5kb3cuYXBpLmludm9rZVBsdWdpbignYWNoaWV2ZW1lbnQtd2F0Y2hlcjpnZXQtYWxsJyk7XG4gICAgICBzZXRHYW1lcyhBcnJheS5pc0FycmF5KHJlc3VsdCkgPyByZXN1bHQgOiBbXSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbYWNoaWV2ZW1lbnQtd2F0Y2hlcl0gZ2V0LWFsbCBmYWlsZWQ6JywgZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0TG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9LCBbXSk7XG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICByZWZyZXNoKCk7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbChyZWZyZXNoLCAxNTAwMCk7XG4gICAgcmV0dXJuICgpID0+IGNsZWFySW50ZXJ2YWwoaWQpO1xuICB9LCBbcmVmcmVzaF0pO1xuXG4gIHJldHVybiB7IGdhbWVzLCBsb2FkaW5nLCByZWZyZXNoIH07XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBBY2hpZXZlbWVudCBQYWdlIChmdWxsLXBhZ2Ugcm91dGUpIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5mdW5jdGlvbiBBY2hpZXZlbWVudFBhZ2UoeyByZWxlYXNlIH0pIHtcbiAgY29uc3QgeyBnYW1lcywgbG9hZGluZywgcmVmcmVzaCB9ID0gdXNlQWxsR2FtZXMoKTtcbiAgY29uc3Qgc3RhdHVzID0gdXNlU2VydmljZVN0YXR1cygpO1xuICBjb25zdCBbaW5zdGFsbGluZywgc2V0SW5zdGFsbGluZ10gPSB1c2VTdGF0ZSgvKiogQHR5cGUgeydzZXJ2aWNlJyB8ICd3aWRnZXQnIHwgJ3N0YXJ0JyB8IG51bGx9ICovIChudWxsKSk7XG5cbiAgYXN5bmMgZnVuY3Rpb24gcmVzY2FuKGluZm9IYXNoKSB7XG4gICAgYXdhaXQgd2luZG93LmFwaS5pbnZva2VQbHVnaW4oJ2FjaGlldmVtZW50LXdhdGNoZXI6cmVzY2FuJywgeyBpbmZvSGFzaCB9KTtcbiAgICBhd2FpdCByZWZyZXNoKCk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBpbnN0YWxsU2VydmljZSgpIHtcbiAgICBzZXRJbnN0YWxsaW5nKCdzZXJ2aWNlJyk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHdpbmRvdy5hcGkuaW52b2tlUGx1Z2luKCdhY2hpZXZlbWVudC13YXRjaGVyOmluc3RhbGwtc2VydmljZScpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcignW2FjaGlldmVtZW50LXdhdGNoZXJdIGluc3RhbGwtc2VydmljZSBmYWlsZWQ6JywgZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SW5zdGFsbGluZyhudWxsKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBpbnN0YWxsV2lkZ2V0KCkge1xuICAgIHNldEluc3RhbGxpbmcoJ3dpZGdldCcpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB3aW5kb3cuYXBpLmludm9rZVBsdWdpbignYWNoaWV2ZW1lbnQtd2F0Y2hlcjppbnN0YWxsLXdpZGdldCcpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcignW2FjaGlldmVtZW50LXdhdGNoZXJdIGluc3RhbGwtd2lkZ2V0IGZhaWxlZDonLCBlcnIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJbnN0YWxsaW5nKG51bGwpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIHN0YXJ0U2VydmljZSgpIHtcbiAgICBzZXRJbnN0YWxsaW5nKCdzdGFydCcpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB3aW5kb3cuYXBpLmludm9rZVBsdWdpbignYWNoaWV2ZW1lbnQtd2F0Y2hlcjpzdGFydC1zZXJ2aWNlJyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdbYWNoaWV2ZW1lbnQtd2F0Y2hlcl0gc3RhcnQtc2VydmljZSBmYWlsZWQ6JywgZXJyKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0SW5zdGFsbGluZyhudWxsKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXN0YWNrLS1tZFwiIHN0eWxlPXt7IHBhZGRpbmc6IDI0LCBtYXhXaWR0aDogODIwLCBtYXJnaW46ICcwIGF1dG8nIH19PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItcm93XCIgc3R5bGU9e3sganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLCBnYXA6IDEyIH19PlxuICAgICAgICA8ZGl2PlxuICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1wcmltYXJ5XCIgc3R5bGU9e3sgZm9udFNpemU6IDIyLCBmb250V2VpZ2h0OiA3MDAsIG1hcmdpbjogMCB9fT5cbiAgICAgICAgICAgIEFjaGlldmVtZW50IFdhdGNoZXJcbiAgICAgICAgICA8L2gyPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgbWFyZ2luVG9wOiA0IH19PlxuICAgICAgICAgICAgVHJhY2tzIGFjaGlldmVtZW50IHVubG9ja3MgYWNyb3NzIGluc3RhbGxlZCBsaWJyYXJ5IGdhbWVzLiBBZGQgYSBTdGVhbSBBUEkgS2V5IGlueycgJ31cbiAgICAgICAgICAgIDxlbT5TZXR0aW5ncyBcdTIxOTIgUGx1Z2luczwvZW0+IHRvIGZldGNoIGFjaGlldmVtZW50IG5hbWVzIGFuZCBpY29ucy5cbiAgICAgICAgICA8L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLWJ1dHRvblwiXG4gICAgICAgICAgc3R5bGU9e3sgZmxleFNocmluazogMCwgZm9udFNpemU6IDEyIH19XG4gICAgICAgICAgb25DbGljaz17KCkgPT4gd2luZG93LmFwaS5pbnZva2VQbHVnaW4oJ2FjaGlldmVtZW50LXdhdGNoZXI6dGVzdC1ub3RpZmljYXRpb24nKX1cbiAgICAgICAgPlxuICAgICAgICAgIFRlc3Qgbm90aWZpY2F0aW9uXG4gICAgICAgIDwvYnV0dG9uPlxuICAgICAgPC9kaXY+XG5cbiAgICAgIHtzdGF0dXMgJiYgIXN0YXR1cy5zZXJ2aWNlSW5zdGFsbGVkICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItY2FyZFwiIHN0eWxlPXt7IGJvcmRlckxlZnQ6ICczcHggc29saWQgdmFyKC0temVwaHlyLWFjY2VudCknLCBwYWRkaW5nOiAxNiB9fT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXByaW1hcnlcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIG1hcmdpbkJvdHRvbTogNiB9fT5cbiAgICAgICAgICAgIEFjaGlldmVtZW50IFNlcnZpY2Ugbm90IGluc3RhbGxlZFxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgbWFyZ2luOiAnMCAwIDEycHgnLCBmb250U2l6ZTogMTMgfX0+XG4gICAgICAgICAgICBUaGUgYmFja2dyb3VuZCBzZXJ2aWNlIHdhdGNoZXMgeW91ciBhY2hpZXZlbWVudCBmaWxlcyBldmVuIHdoaWxlIFplcGh5ciBpcyBjbG9zZWQsIGFuZFxuICAgICAgICAgICAgZGVsaXZlcnMgdW5sb2NrIG5vdGlmaWNhdGlvbnMgdG8gdGhlIEdhbWUgQmFyIHdpZGdldCBkdXJpbmcgZ2FtZXBsYXkuXG4gICAgICAgICAgPC9wPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLWJ1dHRvblwiXG4gICAgICAgICAgICBvbkNsaWNrPXtpbnN0YWxsU2VydmljZX1cbiAgICAgICAgICAgIGRpc2FibGVkPXtpbnN0YWxsaW5nID09PSAnc2VydmljZSd9XG4gICAgICAgICAgPlxuICAgICAgICAgICAge2luc3RhbGxpbmcgPT09ICdzZXJ2aWNlJyA/ICdJbnN0YWxsaW5nXHUyMDI2JyA6ICdJbnN0YWxsIEFjaGlldmVtZW50IFNlcnZpY2UnfVxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG5cbiAgICAgIHtzdGF0dXMgJiYgc3RhdHVzLnNlcnZpY2VJbnN0YWxsZWQgJiYgIXN0YXR1cy5zZXJ2aWNlUnVubmluZyAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLWNhcmRcIiBzdHlsZT17eyBib3JkZXJMZWZ0OiAnM3B4IHNvbGlkIHZhcigtLXplcGh5ci1hY2NlbnQpJywgcGFkZGluZzogMTYgfX0+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1wcmltYXJ5XCIgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwLCBtYXJnaW5Cb3R0b206IDQgfX0+XG4gICAgICAgICAgICBTZXJ2aWNlIGluc3RhbGxlZCBidXQgbm90IHJ1bm5pbmdcbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1tdXRlZFwiIHN0eWxlPXt7IG1hcmdpbjogJzAgMCAxMnB4JywgZm9udFNpemU6IDEzIH19PlxuICAgICAgICAgICAgVGhlIGFjaGlldmVtZW50IHNlcnZpY2UgaXNuJ3QgbGlzdGVuaW5nLiBTdGFydCBpdCBub3cgXHUyMDE0IGl0J2xsIGF1dG8tc3RhcnQgYXQgZXZlcnlcbiAgICAgICAgICAgIGxvZ2luIHRoZXJlYWZ0ZXIuIElmIHN0YXJ0aW5nIGZhaWxzIHJlcGVhdGVkbHksIGNoZWNrIFRhc2sgU2NoZWR1bGVyJ3N7JyAnfVxuICAgICAgICAgICAgPGVtPkxhc3QgUnVuIFJlc3VsdDwvZW0+IGZvciA8ZW0+WmVwaHlyQWNoaWV2ZW1lbnRXYXRjaGVyPC9lbT4uXG4gICAgICAgICAgPC9wPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLWJ1dHRvblwiXG4gICAgICAgICAgICBvbkNsaWNrPXtzdGFydFNlcnZpY2V9XG4gICAgICAgICAgICBkaXNhYmxlZD17aW5zdGFsbGluZyA9PT0gJ3N0YXJ0J31cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7aW5zdGFsbGluZyA9PT0gJ3N0YXJ0JyA/ICdTdGFydGluZ1x1MjAyNicgOiAnU3RhcnQgU2VydmljZSd9XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cblxuICAgICAge3N0YXR1cyAmJiBzdGF0dXMuc2VydmljZUluc3RhbGxlZCAmJiAhc3RhdHVzLndpZGdldEluc3RhbGxlZCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLWNhcmRcIiBzdHlsZT17eyBib3JkZXJMZWZ0OiAnM3B4IHNvbGlkIHZhcigtLXplcGh5ci1ib3JkZXIpJywgcGFkZGluZzogMTYgfX0+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1wcmltYXJ5XCIgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwLCBtYXJnaW5Cb3R0b206IDYgfX0+XG4gICAgICAgICAgICBHYW1lIEJhciB3aWRnZXQgbm90IGluc3RhbGxlZFxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgbWFyZ2luOiAnMCAwIDEycHgnLCBmb250U2l6ZTogMTMgfX0+XG4gICAgICAgICAgICBJbnN0YWxsIHRoZSBHYW1lIEJhciB3aWRnZXQgdG8gc2VlIGFjaGlldmVtZW50IHRvYXN0IG5vdGlmaWNhdGlvbnMgd2hpbGUgcGxheWluZyBpblxuICAgICAgICAgICAgZnVsbC1zY3JlZW4gZXhjbHVzaXZlIG1vZGUuXG4gICAgICAgICAgPC9wPlxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLWJ1dHRvblwiXG4gICAgICAgICAgICBvbkNsaWNrPXtpbnN0YWxsV2lkZ2V0fVxuICAgICAgICAgICAgZGlzYWJsZWQ9e2luc3RhbGxpbmcgPT09ICd3aWRnZXQnfVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtpbnN0YWxsaW5nID09PSAnd2lkZ2V0JyA/ICdJbnN0YWxsaW5nXHUyMDI2JyA6ICdJbnN0YWxsIEdhbWUgQmFyIFdpZGdldCd9XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cblxuICAgICAge3N0YXR1cyAmJiBzdGF0dXMuc2VydmljZUluc3RhbGxlZCAmJiBzdGF0dXMud2lkZ2V0SW5zdGFsbGVkICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItY2FyZFwiIHN0eWxlPXt7IGJvcmRlckxlZnQ6ICczcHggc29saWQgdmFyKC0temVwaHlyLWJvcmRlciknLCBwYWRkaW5nOiAxMiB9fT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXByaW1hcnlcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA2MDAsIG1hcmdpbkJvdHRvbTogNCwgZm9udFNpemU6IDEzIH19PlxuICAgICAgICAgICAgUGluIHRoZSB3aWRnZXQgdG8gR2FtZSBCYXJcbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1tdXRlZFwiIHN0eWxlPXt7IG1hcmdpbjogMCwgZm9udFNpemU6IDEyIH19PlxuICAgICAgICAgICAgUHJlc3MgPHN0cm9uZz5XaW4rRzwvc3Ryb25nPiB0byBvcGVuIEdhbWUgQmFyLCBmaW5kIDxlbT5BY2hpZXZlbWVudCBXYXRjaGVyPC9lbT4sIHRoZW5cbiAgICAgICAgICAgIGNsaWNrIHRoZSA8c3Ryb25nPlBpbjwvc3Ryb25nPiBpY29uLiBUaGUgd2lkZ2V0IG11c3QgYmUgcGlubmVkIHRvIHNob3cgbm90aWZpY2F0aW9uc1xuICAgICAgICAgICAgd2hpbGUgeW91IHBsYXkuXG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG5cbiAgICAgIHtsb2FkaW5nID8gKFxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIj5TY2FubmluZyBsaWJyYXJ5XHUyMDI2PC9wPlxuICAgICAgKSA6IGdhbWVzLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItY2FyZFwiIHN0eWxlPXt7IHRleHRBbGlnbjogJ2NlbnRlcicsIHBhZGRpbmc6IDMyIH19PlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgbWFyZ2luOiAwIH19PlxuICAgICAgICAgICAgTm8gZ2FtZXMgd2l0aCBkZXRlY3RhYmxlIGFjaGlldmVtZW50IGZpbGVzIGZvdW5kIHlldC4gSW5zdGFsbCBhIGdhbWUgdXNpbmcgYSBTdGVhbVxuICAgICAgICAgICAgZW11bGF0b3IgKEdvbGRiZXJnLCBDT0RFWCwgZXRjLikgXHUyMDE0IGZpbGVzIGFyZSBkZXRlY3RlZCBhdXRvbWF0aWNhbGx5LlxuICAgICAgICAgIDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICApIDogKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1zdGFja1wiPlxuICAgICAgICAgIHtnYW1lcy5tYXAoKGdhbWUpID0+IChcbiAgICAgICAgICAgIDxHYW1lQ2FyZCBrZXk9e2dhbWUuaW5mb0hhc2h9IGdhbWU9e2dhbWV9IG9uUmVzY2FuPXsoKSA9PiByZXNjYW4oZ2FtZS5pbmZvSGFzaCl9IC8+XG4gICAgICAgICAgKSl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gR2FtZUNhcmQoeyBnYW1lLCBvblJlc2NhbiB9KSB7XG4gIGNvbnN0IFtleHBhbmRlZCwgc2V0RXhwYW5kZWRdID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbcmVzY2FubmluZywgc2V0UmVzY2FubmluZ10gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IHBjdCA9IGdhbWUudG90YWwgPiAwID8gTWF0aC5yb3VuZCgoZ2FtZS5lYXJuZWQgLyBnYW1lLnRvdGFsKSAqIDEwMCkgOiAwO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVJlc2NhbigpIHtcbiAgICBzZXRSZXNjYW5uaW5nKHRydWUpO1xuICAgIGF3YWl0IG9uUmVzY2FuKCk7XG4gICAgc2V0UmVzY2FubmluZyhmYWxzZSk7XG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLWNhcmQgemVwaHlyLXN0YWNrXCIgc3R5bGU9e3sgZ2FwOiAxMCB9fT5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXJvd1wiIHN0eWxlPXt7IGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdmbGV4LXN0YXJ0JywgZ2FwOiAxMiB9fT5cbiAgICAgICAgPGRpdiBzdHlsZT17eyBmbGV4OiAxLCBtaW5XaWR0aDogMCB9fT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXByaW1hcnlcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIGZvbnRTaXplOiAxNCB9fT5cbiAgICAgICAgICAgIHtnYW1lLnRpdGxlfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXJvd1wiIHN0eWxlPXt7IGdhcDogNiwgbWFyZ2luVG9wOiA1LCBmbGV4V3JhcDogJ3dyYXAnIH19PlxuICAgICAgICAgICAge2dhbWUud2F0Y2hpbmcgPyAoXG4gICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLXBpbGxcIlxuICAgICAgICAgICAgICAgIHN0eWxlPXt7IGJhY2tncm91bmQ6ICd2YXIoLS16ZXBoeXItYWNjZW50KScsIGNvbG9yOiAndmFyKC0temVwaHlyLW9uLWFjY2VudCknLCBmb250U2l6ZTogMTAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIFx1MjVDRiBMaXZlXG4gICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci1waWxsXCIgc3R5bGU9e3sgZm9udFNpemU6IDEwIH19Pk5vdCB3YXRjaGluZzwvc3Bhbj5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICB7Z2FtZS5hcHBJZCAmJiAoXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci1waWxsXCIgc3R5bGU9e3sgZm9udFNpemU6IDEwIH19PkFwcElEIHtnYW1lLmFwcElkfTwvc3Bhbj5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICB7Z2FtZS5sYXN0Q2hlY2tlZCAmJiAoXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMCB9fT5cbiAgICAgICAgICAgICAgICBjaGVja2VkIHtuZXcgRGF0ZShnYW1lLmxhc3RDaGVja2VkKS50b0xvY2FsZVRpbWVTdHJpbmcoKX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItcm93XCIgc3R5bGU9e3sgZ2FwOiA4LCBmbGV4U2hyaW5rOiAwLCBhbGlnbkl0ZW1zOiAnY2VudGVyJyB9fT5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1hY2NlbnRcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA3MDAsIGZvbnRTaXplOiAxNiB9fT5cbiAgICAgICAgICAgIHtnYW1lLmVhcm5lZH1cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgZm9udFdlaWdodDogNDAwLCBmb250U2l6ZTogMTIgfX0+XG4gICAgICAgICAgICAgIC97Z2FtZS50b3RhbH1cbiAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJ6ZXBoeXItYnV0dG9uXCJcbiAgICAgICAgICAgIHN0eWxlPXt7IGZvbnRTaXplOiAxMSwgcGFkZGluZzogJzNweCAxMHB4JyB9fVxuICAgICAgICAgICAgb25DbGljaz17aGFuZGxlUmVzY2FufVxuICAgICAgICAgICAgZGlzYWJsZWQ9e3Jlc2Nhbm5pbmd9XG4gICAgICAgICAgPlxuICAgICAgICAgICAge3Jlc2Nhbm5pbmcgPyAnXHUyMDI2JyA6ICdSZXNjYW4nfVxuICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgIHtnYW1lLnRvdGFsID4gMCAmJiAoXG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ6ZXBoeXItYnV0dG9uXCJcbiAgICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IDExLCBwYWRkaW5nOiAnM3B4IDEwcHgnIH19XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldEV4cGFuZGVkKChlKSA9PiAhZSl9XG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIHtleHBhbmRlZCA/ICdIaWRlJyA6ICdTaG93J31cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIHtnYW1lLnRvdGFsID4gMCAmJiAoXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgaGVpZ2h0OiA1LCBiYWNrZ3JvdW5kOiAndmFyKC0temVwaHlyLWJvcmRlciknLCBib3JkZXJSYWRpdXM6IDMsIG92ZXJmbG93OiAnaGlkZGVuJyB9fT5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBoZWlnaHQ6ICcxMDAlJyxcbiAgICAgICAgICAgICAgd2lkdGg6IGAke3BjdH0lYCxcbiAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCg5MGRlZywgdmFyKC0temVwaHlyLWFjY2VudCksIHZhcigtLXplcGh5ci1hY2NlbnQtc3Ryb25nLCB2YXIoLS16ZXBoeXItYWNjZW50KSkpJyxcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAzLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnd2lkdGggMC41cyBlYXNlJyxcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICB7Z2FtZS5kZXRlY3Rpb25Ob3RlICYmICFnYW1lLndhdGNoaW5nICYmIChcbiAgICAgICAgPHAgY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtc3VidGxlXCIgc3R5bGU9e3sgZm9udFNpemU6IDExLCBtYXJnaW46IDAgfX0+XG4gICAgICAgICAge2dhbWUuZGV0ZWN0aW9uTm90ZX1cbiAgICAgICAgPC9wPlxuICAgICAgKX1cblxuICAgICAge2V4cGFuZGVkICYmIEFycmF5LmlzQXJyYXkoZ2FtZS51bmxvY2tzKSAmJiBnYW1lLnVubG9ja3MubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxBY2hpZXZlbWVudEdyaWQgdW5sb2Nrcz17Z2FtZS51bmxvY2tzfSAvPlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuZnVuY3Rpb24gQWNoaWV2ZW1lbnRHcmlkKHsgdW5sb2NrcyB9KSB7XG4gIGNvbnN0IGVhcm5lZCA9IHVubG9ja3MuZmlsdGVyKCh1KSA9PiB1LmVhcm5lZCk7XG4gIGNvbnN0IHVuZWFybmVkID0gdW5sb2Nrcy5maWx0ZXIoKHUpID0+ICF1LmVhcm5lZCk7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1zdGFja1wiIHN0eWxlPXt7IGdhcDogMTAsIG1hcmdpblRvcDogNCwgYm9yZGVyVG9wOiAnMXB4IHNvbGlkIHZhcigtLXplcGh5ci1ib3JkZXIpJywgcGFkZGluZ1RvcDogMTAgfX0+XG4gICAgICB7ZWFybmVkLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICA8PlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci1sYWJlbFwiPlVubG9ja2VkIFx1MjAxNCB7ZWFybmVkLmxlbmd0aH08L3NwYW4+XG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZ3JpZCcsIGdyaWRUZW1wbGF0ZUNvbHVtbnM6ICdyZXBlYXQoYXV0by1maWxsLCBtaW5tYXgoMjEwcHgsIDFmcikpJywgZ2FwOiA2IH19PlxuICAgICAgICAgICAge2Vhcm5lZC5tYXAoKHUpID0+IChcbiAgICAgICAgICAgICAgPEFjaGlldmVtZW50Q2hpcCBrZXk9e3UuaWR9IGFjaD17dX0gLz5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8Lz5cbiAgICAgICl9XG4gICAgICB7dW5lYXJuZWQubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLWxhYmVsXCIgc3R5bGU9e3sgbWFyZ2luVG9wOiBlYXJuZWQubGVuZ3RoID4gMCA/IDggOiAwIH19PlxuICAgICAgICAgICAgTG9ja2VkIFx1MjAxNCB7dW5lYXJuZWQubGVuZ3RofVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdncmlkJywgZ3JpZFRlbXBsYXRlQ29sdW1uczogJ3JlcGVhdChhdXRvLWZpbGwsIG1pbm1heCgyMTBweCwgMWZyKSknLCBnYXA6IDYgfX0+XG4gICAgICAgICAgICB7dW5lYXJuZWQubWFwKCh1KSA9PiAoXG4gICAgICAgICAgICAgIDxBY2hpZXZlbWVudENoaXAga2V5PXt1LmlkfSBhY2g9e3V9IC8+XG4gICAgICAgICAgICApKX1cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC8+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBBY2hpZXZlbWVudENoaXAoeyBhY2ggfSkge1xuICByZXR1cm4gKFxuICAgIDxkaXZcbiAgICAgIGNsYXNzTmFtZT1cInplcGh5ci1jYXJkIHplcGh5ci1yb3dcIlxuICAgICAgc3R5bGU9e3tcbiAgICAgICAgZ2FwOiA4LFxuICAgICAgICBwYWRkaW5nOiAnN3B4IDEwcHgnLFxuICAgICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcbiAgICAgICAgb3BhY2l0eTogYWNoLmVhcm5lZCA/IDEgOiAwLjQsXG4gICAgICAgIGJhY2tncm91bmQ6IGFjaC5lYXJuZWQgPyAndmFyKC0temVwaHlyLWJnLWVsZXZhdGVkKScgOiAndmFyKC0temVwaHlyLWJnLXN1cmZhY2UpJyxcbiAgICAgICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgMC4ycycsXG4gICAgICB9fVxuICAgID5cbiAgICAgIHthY2guaWNvblVybCA/IChcbiAgICAgICAgPGltZ1xuICAgICAgICAgIHNyYz17YWNoLmljb25Vcmx9XG4gICAgICAgICAgc3R5bGU9e3sgd2lkdGg6IDMyLCBoZWlnaHQ6IDMyLCBib3JkZXJSYWRpdXM6IDMsIGZsZXhTaHJpbms6IDAsIG9iamVjdEZpdDogJ2NvdmVyJyB9fVxuICAgICAgICAgIGFsdD1cIlwiXG4gICAgICAgICAgb25FcnJvcj17KGUpID0+IHtcbiAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgIH19XG4gICAgICAgIC8+XG4gICAgICApIDogKFxuICAgICAgICA8ZGl2XG4gICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgIHdpZHRoOiAzMixcbiAgICAgICAgICAgIGhlaWdodDogMzIsXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IDMsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAndmFyKC0temVwaHlyLWJvcmRlciknLFxuICAgICAgICAgICAgZmxleFNocmluazogMCxcbiAgICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICAgICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLFxuICAgICAgICAgICAgZm9udFNpemU6IDE2LFxuICAgICAgICAgIH19XG4gICAgICAgID5cbiAgICAgICAgICBcdUQ4M0NcdURGQzZcbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuICAgICAgPGRpdiBzdHlsZT17eyBmbGV4OiAxLCBtaW5XaWR0aDogMCB9fT5cbiAgICAgICAgPGRpdlxuICAgICAgICAgIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXByaW1hcnlcIlxuICAgICAgICAgIHN0eWxlPXt7IGZvbnRTaXplOiAxMSwgZm9udFdlaWdodDogNjAwLCBvdmVyZmxvdzogJ2hpZGRlbicsIHRleHRPdmVyZmxvdzogJ2VsbGlwc2lzJywgd2hpdGVTcGFjZTogJ25vd3JhcCcgfX1cbiAgICAgICAgPlxuICAgICAgICAgIHthY2guZGlzcGxheU5hbWV9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7YWNoLmRlc2NyaXB0aW9uICYmIChcbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIlxuICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IDEwLCBvdmVyZmxvdzogJ2hpZGRlbicsIHRleHRPdmVyZmxvdzogJ2VsbGlwc2lzJywgd2hpdGVTcGFjZTogJ25vd3JhcCcgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7YWNoLmRlc2NyaXB0aW9ufVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgICB7YWNoLmVhcm5lZCAmJiBhY2gudW5sb2NrZWRBdCAmJiAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIiBzdHlsZT17eyBmb250U2l6ZTogOSB9fT5cbiAgICAgICAgICAgIHtuZXcgRGF0ZShhY2gudW5sb2NrZWRBdCAqIDEwMDApLnRvTG9jYWxlRGF0ZVN0cmluZygpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgICB7YWNoLmVhcm5lZCAmJiAoXG4gICAgICAgIDxzcGFuIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0temVwaHlyLXN1Y2Nlc3MsICMyMmM1NWUpJywgZm9udFNpemU6IDEzLCBmbGV4U2hyaW5rOiAwIH19Plx1MjcxMzwvc3Bhbj5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBEZXRhaWwgc2VjdGlvbiAoc2hvd24gb24gcmVsZWFzZSBkZXRhaWwgcGFnZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIEFjaGlldmVtZW50U2VjdGlvbih7IHJlbGVhc2UgfSkge1xuICBjb25zdCB7IGdhbWVzLCBsb2FkaW5nIH0gPSB1c2VBbGxHYW1lcygpO1xuXG4gIGNvbnN0IG1hdGNoID0gZ2FtZXMuZmluZCgoZykgPT4ge1xuICAgIGNvbnN0IGEgPSBnLnRpdGxlLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgYiA9IHJlbGVhc2UudGl0bGUudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gYSA9PT0gYiB8fCBhLmluY2x1ZGVzKGIpIHx8IGIuaW5jbHVkZXMoYSk7XG4gIH0pO1xuXG4gIGlmIChsb2FkaW5nKSB7XG4gICAgcmV0dXJuIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMiwgbWFyZ2luOiAwIH19PkxvYWRpbmdcdTIwMjY8L3A+O1xuICB9XG5cbiAgaWYgKCFtYXRjaCkge1xuICAgIHJldHVybiAoXG4gICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1tdXRlZFwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMiwgbWFyZ2luOiAwIH19PlxuICAgICAgICBOb3QgaW4gbGlicmFyeSBvciBubyBhY2hpZXZlbWVudCBmaWxlcyBkZXRlY3RlZCBmb3IgdGhpcyB0aXRsZS5cbiAgICAgIDwvcD5cbiAgICApO1xuICB9XG5cbiAgY29uc3QgcGN0ID0gbWF0Y2gudG90YWwgPiAwID8gTWF0aC5yb3VuZCgobWF0Y2guZWFybmVkIC8gbWF0Y2gudG90YWwpICogMTAwKSA6IDA7XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1zdGFja1wiIHN0eWxlPXt7IGdhcDogMTIgfX0+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1yb3dcIiBzdHlsZT17eyBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLCBhbGlnbkl0ZW1zOiAnY2VudGVyJyB9fT5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItcm93XCIgc3R5bGU9e3sgZ2FwOiA4LCBhbGlnbkl0ZW1zOiAnYmFzZWxpbmUnIH19PlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LWFjY2VudFwiIHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCwgZm9udFNpemU6IDIyIH19PlxuICAgICAgICAgICAge21hdGNoLmVhcm5lZH1cbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtbXV0ZWRcIiBzdHlsZT17eyBmb250U2l6ZTogMTMgfX0+LyB7bWF0Y2gudG90YWx9IGFjaGlldmVtZW50czwvc3Bhbj5cbiAgICAgICAgICB7bWF0Y2gudG90YWwgPiAwICYmIChcbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMiB9fT4oe3BjdH0lKTwvc3Bhbj5cbiAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cbiAgICAgICAge21hdGNoLndhdGNoaW5nID8gKFxuICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJ6ZXBoeXItcGlsbFwiXG4gICAgICAgICAgICBzdHlsZT17eyBiYWNrZ3JvdW5kOiAndmFyKC0temVwaHlyLWFjY2VudCknLCBjb2xvcjogJ3ZhcigtLXplcGh5ci1vbi1hY2NlbnQpJywgZm9udFNpemU6IDEwIH19XG4gICAgICAgICAgPlxuICAgICAgICAgICAgXHUyNUNGIExpdmVcbiAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXBpbGxcIiBzdHlsZT17eyBmb250U2l6ZTogMTAgfX0+Tm90IHdhdGNoaW5nPC9zcGFuPlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG5cbiAgICAgIHttYXRjaC50b3RhbCA+IDAgJiYgKFxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGhlaWdodDogNiwgYmFja2dyb3VuZDogJ3ZhcigtLXplcGh5ci1ib3JkZXIpJywgYm9yZGVyUmFkaXVzOiAzLCBvdmVyZmxvdzogJ2hpZGRlbicgfX0+XG4gICAgICAgICAgPGRpdlxuICAgICAgICAgICAgc3R5bGU9e3tcbiAgICAgICAgICAgICAgaGVpZ2h0OiAnMTAwJScsXG4gICAgICAgICAgICAgIHdpZHRoOiBgJHtwY3R9JWAsXG4gICAgICAgICAgICAgIGJhY2tncm91bmQ6ICdsaW5lYXItZ3JhZGllbnQoOTBkZWcsIHZhcigtLXplcGh5ci1hY2NlbnQpLCB2YXIoLS16ZXBoeXItYWNjZW50LXN0cm9uZywgdmFyKC0temVwaHlyLWFjY2VudCkpKScsXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogMyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbjogJ3dpZHRoIDAuNXMgZWFzZScsXG4gICAgICAgICAgICB9fVxuICAgICAgICAgIC8+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cblxuICAgICAge21hdGNoLmRldGVjdGlvbk5vdGUgJiYgKFxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIiBzdHlsZT17eyBmb250U2l6ZTogMTEsIG1hcmdpbjogMCB9fT57bWF0Y2guZGV0ZWN0aW9uTm90ZX08L3A+XG4gICAgICApfVxuXG4gICAgICB7QXJyYXkuaXNBcnJheShtYXRjaC51bmxvY2tzKSAmJiBtYXRjaC51bmxvY2tzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICA8QWNoaWV2ZW1lbnRHcmlkIHVubG9ja3M9e21hdGNoLnVubG9ja3N9IC8+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG4vLyBcdTI1MDBcdTI1MDAgRXhwb3J0cyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGNvbnN0IGRldGFpbFNlY3Rpb25zID0gW1xuICB7XG4gICAgaWQ6ICdhY2hpZXZlbWVudC13YXRjaGVyOnByb2dyZXNzJyxcbiAgICB0aXRsZTogJ0FjaGlldmVtZW50cycsXG4gICAgY29tcG9uZW50OiBBY2hpZXZlbWVudFNlY3Rpb24sXG4gIH0sXG5dO1xuXG5leHBvcnQgY29uc3Qgcm91dGVzID0gW1xuICB7XG4gICAgaWQ6ICdhY2hpZXZlbWVudC13YXRjaGVyOmhvbWUnLFxuICAgIG5hdkxhYmVsOiAnQWNoaWV2ZW1lbnRzJyxcbiAgICBjb21wb25lbnQ6ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGRlZmF1bHQ6IEFjaGlldmVtZW50UGFnZSB9KSxcbiAgfSxcbl07XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsSUFBTTtBQUFBO0FBQUE7QUFBQSxFQUNvQyxXQUFZO0FBQUE7QUFFdEQsSUFBSSxDQUFDLE9BQU87QUFDVixRQUFN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
