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
var _style = document.createElement("style");
_style.textContent = `
  #aw-overlay-root {
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    pointer-events: none; display: flex; flex-direction: column-reverse;
    gap: 10px; align-items: flex-end; max-width: 340px;
  }
  .aw-toast { pointer-events: auto; animation: aw-in 0.35s cubic-bezier(0.34,1.56,0.64,1); }
  .aw-toast.aw-out { animation: aw-out 0.25s ease forwards; }
  @keyframes aw-in  { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes aw-out { from { transform: translateX(0); opacity: 1; } to { transform: translateX(120%); opacity: 0; } }
`;
document.head.appendChild(_style);
var _overlayRoot = document.createElement("div");
_overlayRoot.id = "aw-overlay-root";
document.body.appendChild(_overlayRoot);
function _playUnlockSound() {
  try {
    const ctx = new AudioContext();
    const tone = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(1e-3, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };
    const t = ctx.currentTime;
    tone(660, t, 0.12);
    tone(880, t + 0.13, 0.12);
    tone(1100, t + 0.27, 0.4);
  } catch {
  }
}
function _esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function _showToast(notif) {
  const toast = document.createElement("div");
  toast.className = "aw-toast zephyr-card";
  toast.style.cssText = "min-width:260px;max-width:340px;border-left:3px solid var(--zephyr-accent);";
  toast.innerHTML = `
    <div class="zephyr-row" style="gap:10px;align-items:center;">
      ${notif.iconUrl ? `<img src="${_esc(notif.iconUrl)}" style="width:44px;height:44px;border-radius:4px;flex-shrink:0;object-fit:cover;" onerror="this.style.display='none'" />` : '<div style="width:44px;height:44px;border-radius:4px;background:var(--zephyr-border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;">\u{1F3C6}</div>'}
      <div style="flex:1;min-width:0;">
        <div class="zephyr-label" style="margin-bottom:2px;">Achievement Unlocked</div>
        <div class="zephyr-text-primary" style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(notif.achievementName || notif.achievementId)}</div>
        ${notif.achievementDesc ? `<div class="zephyr-text-muted" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(notif.achievementDesc)}</div>` : ""}
        <div class="zephyr-text-subtle" style="font-size:10px;margin-top:1px;">${_esc(notif.gameTitle)}</div>
      </div>
    </div>`;
  _overlayRoot.appendChild(toast);
  _playUnlockSound();
  setTimeout(() => {
    toast.classList.add("aw-out");
    setTimeout(() => toast.remove(), 260);
  }, 6500);
}
setInterval(async () => {
  try {
    const notifications = await window.api.invokePlugin("achievement-watcher:poll-notifications");
    if (Array.isArray(notifications)) {
      for (const n of notifications) _showToast(n);
    }
  } catch {
  }
}, 2e3);
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
  async function rescan(infoHash) {
    await window.api.invokePlugin("achievement-watcher:rescan", { infoHash });
    await refresh();
  }
  return /* @__PURE__ */ jsxs("div", { className: "zephyr-stack--md", style: { padding: 24, maxWidth: 820, margin: "0 auto" }, children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("h2", { className: "zephyr-text-primary", style: { fontSize: 22, fontWeight: 700, margin: 0 }, children: "Achievement Watcher" }),
      /* @__PURE__ */ jsxs("p", { className: "zephyr-text-muted", style: { marginTop: 4 }, children: [
        "Tracks achievement unlocks across installed library games. Add a Steam API Key in",
        " ",
        /* @__PURE__ */ jsx("em", { children: "Settings \u2192 Plugins" }),
        " to fetch achievement names and icons."
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3JlYWN0LXNoaW0uanMiLCAic3JjL3JlYWN0LWpzeC1ydW50aW1lLXNoaW0uanMiLCAic3JjL3JlbmRlcmVyLmpzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgUmVhY3QgPSAvKiogQHR5cGUge3R5cGVvZiBpbXBvcnQoJ3JlYWN0JykgfCB1bmRlZmluZWR9ICovIChcbiAgLyoqIEB0eXBlIHtSZWNvcmQ8c3RyaW5nLCB1bmtub3duPn0gKi8gKGdsb2JhbFRoaXMpLl9femVwaHlyUmVhY3Rcbik7XG5pZiAoIVJlYWN0KSB7XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAnWmVwaHlyIHBsdWdpbjogd2luZG93Ll9femVwaHlyUmVhY3QgaXMgbm90IGRlZmluZWQuIFRoaXMgYnVuZGxlIGlzIGludGVuZGVkIHRvIHJ1biBpbnNpZGUgWmVwaHlyLCB3aGljaCBwdWJsaXNoZXMgUmVhY3Qgb24gd2luZG93Ll9femVwaHlyUmVhY3QgYmVmb3JlIHRoZSBhcHAgbW91bnRzLicsXG4gICk7XG59XG5cbmV4cG9ydCBjb25zdCB7XG4gIHVzZVN0YXRlLCB1c2VFZmZlY3QsIHVzZUxheW91dEVmZmVjdCwgdXNlSW5zZXJ0aW9uRWZmZWN0LCB1c2VSZWYsIHVzZU1lbW8sIHVzZUNhbGxiYWNrLFxuICB1c2VDb250ZXh0LCB1c2VSZWR1Y2VyLCB1c2VJZCwgdXNlVHJhbnNpdGlvbiwgdXNlRGVmZXJyZWRWYWx1ZSwgdXNlSW1wZXJhdGl2ZUhhbmRsZSxcbiAgdXNlU3luY0V4dGVybmFsU3RvcmUsIHVzZURlYnVnVmFsdWUsIHVzZU9wdGltaXN0aWMsIHVzZUFjdGlvblN0YXRlLCB1c2UsXG4gIENvbXBvbmVudCwgUHVyZUNvbXBvbmVudCwgRnJhZ21lbnQsIFN0cmljdE1vZGUsIFN1c3BlbnNlLCBQcm9maWxlcixcbiAgY3JlYXRlQ29udGV4dCwgY3JlYXRlRWxlbWVudCwgY2xvbmVFbGVtZW50LCBjcmVhdGVSZWYsIGZvcndhcmRSZWYsIG1lbW8sIGxhenksXG4gIHN0YXJ0VHJhbnNpdGlvbiwgaXNWYWxpZEVsZW1lbnQsIENoaWxkcmVuLCB2ZXJzaW9uLFxufSA9IFJlYWN0O1xuZXhwb3J0IGRlZmF1bHQgUmVhY3Q7XG4iLCAiY29uc3QgcnQgPSAvKiogQHR5cGUge1JlY29yZDxzdHJpbmcsIHVua25vd24+fSAqLyAoZ2xvYmFsVGhpcykuX196ZXBoeXJKc3hSdW50aW1lO1xuaWYgKCFydCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgJ1plcGh5ciBwbHVnaW46IHdpbmRvdy5fX3plcGh5ckpzeFJ1bnRpbWUgaXMgbm90IGRlZmluZWQuIFRoaXMgYnVuZGxlIGlzIGludGVuZGVkIHRvIHJ1biBpbnNpZGUgWmVwaHlyLCB3aGljaCBwdWJsaXNoZXMgcmVhY3QvanN4LXJ1bnRpbWUgb24gd2luZG93Ll9femVwaHlySnN4UnVudGltZSBiZWZvcmUgdGhlIGFwcCBtb3VudHMuJyxcbiAgKTtcbn1cbmV4cG9ydCBjb25zdCB7IGpzeCwganN4cywgRnJhZ21lbnQgfSA9IHJ0O1xuIiwgIi8vIEFjaGlldmVtZW50IFdhdGNoZXIgXHUyMDE0IHJlbmRlcmVyIGxheWVyXG4vLyBBbGwgc3R5bGluZyB1c2VzIHRoZSBaZXBoeXIgUGx1Z2luIFVJIEtpdCAoLnplcGh5ci0qIC8gLS16ZXBoeXItKikuIFRhaWx3aW5kIGNsYXNzZXMgZG8gTk9UIHdvcmsgaGVyZS5cblxuaW1wb3J0IHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlQ2FsbGJhY2sgfSBmcm9tICdyZWFjdCc7XG5cbi8vIFx1MjUwMFx1MjUwMCBNb2R1bGUtbGV2ZWwgb3ZlcmxheSAoRE9NLW5hdGl2ZSwgYWx3YXlzIGFjdGl2ZSByZWdhcmRsZXNzIG9mIGN1cnJlbnQgcm91dGUpIFx1MjUwMFx1MjUwMFxuXG5jb25zdCBfc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpO1xuX3N0eWxlLnRleHRDb250ZW50ID0gYFxuICAjYXctb3ZlcmxheS1yb290IHtcbiAgICBwb3NpdGlvbjogZml4ZWQ7IGJvdHRvbTogMjRweDsgcmlnaHQ6IDI0cHg7IHotaW5kZXg6IDk5OTk7XG4gICAgcG9pbnRlci1ldmVudHM6IG5vbmU7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW4tcmV2ZXJzZTtcbiAgICBnYXA6IDEwcHg7IGFsaWduLWl0ZW1zOiBmbGV4LWVuZDsgbWF4LXdpZHRoOiAzNDBweDtcbiAgfVxuICAuYXctdG9hc3QgeyBwb2ludGVyLWV2ZW50czogYXV0bzsgYW5pbWF0aW9uOiBhdy1pbiAwLjM1cyBjdWJpYy1iZXppZXIoMC4zNCwxLjU2LDAuNjQsMSk7IH1cbiAgLmF3LXRvYXN0LmF3LW91dCB7IGFuaW1hdGlvbjogYXctb3V0IDAuMjVzIGVhc2UgZm9yd2FyZHM7IH1cbiAgQGtleWZyYW1lcyBhdy1pbiAgeyBmcm9tIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEyMCUpOyBvcGFjaXR5OiAwOyB9IHRvIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApOyBvcGFjaXR5OiAxOyB9IH1cbiAgQGtleWZyYW1lcyBhdy1vdXQgeyBmcm9tIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDApOyBvcGFjaXR5OiAxOyB9IHRvIHsgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDEyMCUpOyBvcGFjaXR5OiAwOyB9IH1cbmA7XG5kb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKF9zdHlsZSk7XG5cbmNvbnN0IF9vdmVybGF5Um9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuX292ZXJsYXlSb290LmlkID0gJ2F3LW92ZXJsYXktcm9vdCc7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKF9vdmVybGF5Um9vdCk7XG5cbmZ1bmN0aW9uIF9wbGF5VW5sb2NrU291bmQoKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgY3R4ID0gbmV3IEF1ZGlvQ29udGV4dCgpO1xuICAgIC8qKiBAcGFyYW0ge251bWJlcn0gZnJlcSBAcGFyYW0ge251bWJlcn0gc3RhcnQgQHBhcmFtIHtudW1iZXJ9IGR1ciAqL1xuICAgIGNvbnN0IHRvbmUgPSAoZnJlcSwgc3RhcnQsIGR1cikgPT4ge1xuICAgICAgY29uc3Qgb3NjID0gY3R4LmNyZWF0ZU9zY2lsbGF0b3IoKTtcbiAgICAgIGNvbnN0IGdhaW4gPSBjdHguY3JlYXRlR2FpbigpO1xuICAgICAgb3NjLmNvbm5lY3QoZ2Fpbik7XG4gICAgICBnYWluLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcbiAgICAgIG9zYy50eXBlID0gJ3NpbmUnO1xuICAgICAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXE7XG4gICAgICBnYWluLmdhaW4uc2V0VmFsdWVBdFRpbWUoMC4yMiwgc3RhcnQpO1xuICAgICAgZ2Fpbi5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoMC4wMDEsIHN0YXJ0ICsgZHVyKTtcbiAgICAgIG9zYy5zdGFydChzdGFydCk7XG4gICAgICBvc2Muc3RvcChzdGFydCArIGR1cik7XG4gICAgfTtcbiAgICBjb25zdCB0ID0gY3R4LmN1cnJlbnRUaW1lO1xuICAgIHRvbmUoNjYwLCB0LCAwLjEyKTtcbiAgICB0b25lKDg4MCwgdCArIDAuMTMsIDAuMTIpO1xuICAgIHRvbmUoMTEwMCwgdCArIDAuMjcsIDAuNCk7XG4gIH0gY2F0Y2gge31cbn1cblxuLyoqIEBwYXJhbSB7c3RyaW5nfSBzICovXG5mdW5jdGlvbiBfZXNjKHMpIHtcbiAgcmV0dXJuIFN0cmluZyhzKVxuICAgIC5yZXBsYWNlKC8mL2csICcmYW1wOycpXG4gICAgLnJlcGxhY2UoLzwvZywgJyZsdDsnKVxuICAgIC5yZXBsYWNlKC8+L2csICcmZ3Q7JylcbiAgICAucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xufVxuXG4vKiogQHBhcmFtIHthbnl9IG5vdGlmICovXG5mdW5jdGlvbiBfc2hvd1RvYXN0KG5vdGlmKSB7XG4gIGNvbnN0IHRvYXN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9ICdhdy10b2FzdCB6ZXBoeXItY2FyZCc7XG4gIHRvYXN0LnN0eWxlLmNzc1RleHQgPVxuICAgICdtaW4td2lkdGg6MjYwcHg7bWF4LXdpZHRoOjM0MHB4O2JvcmRlci1sZWZ0OjNweCBzb2xpZCB2YXIoLS16ZXBoeXItYWNjZW50KTsnO1xuICB0b2FzdC5pbm5lckhUTUwgPSBgXG4gICAgPGRpdiBjbGFzcz1cInplcGh5ci1yb3dcIiBzdHlsZT1cImdhcDoxMHB4O2FsaWduLWl0ZW1zOmNlbnRlcjtcIj5cbiAgICAgICR7bm90aWYuaWNvblVybCA/IGA8aW1nIHNyYz1cIiR7X2VzYyhub3RpZi5pY29uVXJsKX1cIiBzdHlsZT1cIndpZHRoOjQ0cHg7aGVpZ2h0OjQ0cHg7Ym9yZGVyLXJhZGl1czo0cHg7ZmxleC1zaHJpbms6MDtvYmplY3QtZml0OmNvdmVyO1wiIG9uZXJyb3I9XCJ0aGlzLnN0eWxlLmRpc3BsYXk9J25vbmUnXCIgLz5gIDogJzxkaXYgc3R5bGU9XCJ3aWR0aDo0NHB4O2hlaWdodDo0NHB4O2JvcmRlci1yYWRpdXM6NHB4O2JhY2tncm91bmQ6dmFyKC0temVwaHlyLWJvcmRlcik7ZmxleC1zaHJpbms6MDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjIwcHg7XCI+XHVEODNDXHVERkM2PC9kaXY+J31cbiAgICAgIDxkaXYgc3R5bGU9XCJmbGV4OjE7bWluLXdpZHRoOjA7XCI+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ6ZXBoeXItbGFiZWxcIiBzdHlsZT1cIm1hcmdpbi1ib3R0b206MnB4O1wiPkFjaGlldmVtZW50IFVubG9ja2VkPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3M9XCJ6ZXBoeXItdGV4dC1wcmltYXJ5XCIgc3R5bGU9XCJmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjEzcHg7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7d2hpdGUtc3BhY2U6bm93cmFwO1wiPiR7X2VzYyhub3RpZi5hY2hpZXZlbWVudE5hbWUgfHwgbm90aWYuYWNoaWV2ZW1lbnRJZCl9PC9kaXY+XG4gICAgICAgICR7bm90aWYuYWNoaWV2ZW1lbnREZXNjID8gYDxkaXYgY2xhc3M9XCJ6ZXBoeXItdGV4dC1tdXRlZFwiIHN0eWxlPVwiZm9udC1zaXplOjExcHg7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7d2hpdGUtc3BhY2U6bm93cmFwO1wiPiR7X2VzYyhub3RpZi5hY2hpZXZlbWVudERlc2MpfTwvZGl2PmAgOiAnJ31cbiAgICAgICAgPGRpdiBjbGFzcz1cInplcGh5ci10ZXh0LXN1YnRsZVwiIHN0eWxlPVwiZm9udC1zaXplOjEwcHg7bWFyZ2luLXRvcDoxcHg7XCI+JHtfZXNjKG5vdGlmLmdhbWVUaXRsZSl9PC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gO1xuICBfb3ZlcmxheVJvb3QuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICBfcGxheVVubG9ja1NvdW5kKCk7XG4gIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgIHRvYXN0LmNsYXNzTGlzdC5hZGQoJ2F3LW91dCcpO1xuICAgIHNldFRpbWVvdXQoKCkgPT4gdG9hc3QucmVtb3ZlKCksIDI2MCk7XG4gIH0sIDY1MDApO1xufVxuXG4vLyBQb2xsIGZvciBuZXcgYWNoaWV2ZW1lbnQgdW5sb2NrcyBldmVyeSAyIHNlY29uZHNcbnNldEludGVydmFsKGFzeW5jICgpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBub3RpZmljYXRpb25zID0gYXdhaXQgd2luZG93LmFwaS5pbnZva2VQbHVnaW4oJ2FjaGlldmVtZW50LXdhdGNoZXI6cG9sbC1ub3RpZmljYXRpb25zJyk7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkobm90aWZpY2F0aW9ucykpIHtcbiAgICAgIGZvciAoY29uc3QgbiBvZiBub3RpZmljYXRpb25zKSBfc2hvd1RvYXN0KG4pO1xuICAgIH1cbiAgfSBjYXRjaCB7fVxufSwgMjAwMCk7XG5cbi8vIFx1MjUwMFx1MjUwMCBSZWFjdCBob29rcyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gdXNlQWxsR2FtZXMoKSB7XG4gIGNvbnN0IFtnYW1lcywgc2V0R2FtZXNdID0gdXNlU3RhdGUoLyoqIEB0eXBlIHthbnlbXX0gKi8gKFtdKSk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuXG4gIGNvbnN0IHJlZnJlc2ggPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdpbmRvdy5hcGkuaW52b2tlUGx1Z2luKCdhY2hpZXZlbWVudC13YXRjaGVyOmdldC1hbGwnKTtcbiAgICAgIHNldEdhbWVzKEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdCA6IFtdKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1thY2hpZXZlbWVudC13YXRjaGVyXSBnZXQtYWxsIGZhaWxlZDonLCBlcnIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRMb2FkaW5nKGZhbHNlKTtcbiAgICB9XG4gIH0sIFtdKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIHJlZnJlc2goKTtcbiAgICBjb25zdCBpZCA9IHNldEludGVydmFsKHJlZnJlc2gsIDE1MDAwKTtcbiAgICByZXR1cm4gKCkgPT4gY2xlYXJJbnRlcnZhbChpZCk7XG4gIH0sIFtyZWZyZXNoXSk7XG5cbiAgcmV0dXJuIHsgZ2FtZXMsIGxvYWRpbmcsIHJlZnJlc2ggfTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIEFjaGlldmVtZW50IFBhZ2UgKGZ1bGwtcGFnZSByb3V0ZSkgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmZ1bmN0aW9uIEFjaGlldmVtZW50UGFnZSh7IHJlbGVhc2UgfSkge1xuICBjb25zdCB7IGdhbWVzLCBsb2FkaW5nLCByZWZyZXNoIH0gPSB1c2VBbGxHYW1lcygpO1xuXG4gIGFzeW5jIGZ1bmN0aW9uIHJlc2NhbihpbmZvSGFzaCkge1xuICAgIGF3YWl0IHdpbmRvdy5hcGkuaW52b2tlUGx1Z2luKCdhY2hpZXZlbWVudC13YXRjaGVyOnJlc2NhbicsIHsgaW5mb0hhc2ggfSk7XG4gICAgYXdhaXQgcmVmcmVzaCgpO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1zdGFjay0tbWRcIiBzdHlsZT17eyBwYWRkaW5nOiAyNCwgbWF4V2lkdGg6IDgyMCwgbWFyZ2luOiAnMCBhdXRvJyB9fT5cbiAgICAgIDxkaXY+XG4gICAgICAgIDxoMiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1wcmltYXJ5XCIgc3R5bGU9e3sgZm9udFNpemU6IDIyLCBmb250V2VpZ2h0OiA3MDAsIG1hcmdpbjogMCB9fT5cbiAgICAgICAgICBBY2hpZXZlbWVudCBXYXRjaGVyXG4gICAgICAgIDwvaDI+XG4gICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgbWFyZ2luVG9wOiA0IH19PlxuICAgICAgICAgIFRyYWNrcyBhY2hpZXZlbWVudCB1bmxvY2tzIGFjcm9zcyBpbnN0YWxsZWQgbGlicmFyeSBnYW1lcy4gQWRkIGEgU3RlYW0gQVBJIEtleSBpbnsnICd9XG4gICAgICAgICAgPGVtPlNldHRpbmdzIFx1MjE5MiBQbHVnaW5zPC9lbT4gdG8gZmV0Y2ggYWNoaWV2ZW1lbnQgbmFtZXMgYW5kIGljb25zLlxuICAgICAgICA8L3A+XG4gICAgICA8L2Rpdj5cblxuICAgICAge2xvYWRpbmcgPyAoXG4gICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiPlNjYW5uaW5nIGxpYnJhcnlcdTIwMjY8L3A+XG4gICAgICApIDogZ2FtZXMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1jYXJkXCIgc3R5bGU9e3sgdGV4dEFsaWduOiAnY2VudGVyJywgcGFkZGluZzogMzIgfX0+XG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtbXV0ZWRcIiBzdHlsZT17eyBtYXJnaW46IDAgfX0+XG4gICAgICAgICAgICBObyBnYW1lcyB3aXRoIGRldGVjdGFibGUgYWNoaWV2ZW1lbnQgZmlsZXMgZm91bmQgeWV0LiBJbnN0YWxsIGEgZ2FtZSB1c2luZyBhIFN0ZWFtXG4gICAgICAgICAgICBlbXVsYXRvciAoR29sZGJlcmcsIENPREVYLCBldGMuKSBcdTIwMTQgZmlsZXMgYXJlIGRldGVjdGVkIGF1dG9tYXRpY2FsbHkuXG4gICAgICAgICAgPC9wPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICkgOiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXN0YWNrXCI+XG4gICAgICAgICAge2dhbWVzLm1hcCgoZ2FtZSkgPT4gKFxuICAgICAgICAgICAgPEdhbWVDYXJkIGtleT17Z2FtZS5pbmZvSGFzaH0gZ2FtZT17Z2FtZX0gb25SZXNjYW49eygpID0+IHJlc2NhbihnYW1lLmluZm9IYXNoKX0gLz5cbiAgICAgICAgICApKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBHYW1lQ2FyZCh7IGdhbWUsIG9uUmVzY2FuIH0pIHtcbiAgY29uc3QgW2V4cGFuZGVkLCBzZXRFeHBhbmRlZF0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtyZXNjYW5uaW5nLCBzZXRSZXNjYW5uaW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgcGN0ID0gZ2FtZS50b3RhbCA+IDAgPyBNYXRoLnJvdW5kKChnYW1lLmVhcm5lZCAvIGdhbWUudG90YWwpICogMTAwKSA6IDA7XG5cbiAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlUmVzY2FuKCkge1xuICAgIHNldFJlc2Nhbm5pbmcodHJ1ZSk7XG4gICAgYXdhaXQgb25SZXNjYW4oKTtcbiAgICBzZXRSZXNjYW5uaW5nKGZhbHNlKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItY2FyZCB6ZXBoeXItc3RhY2tcIiBzdHlsZT17eyBnYXA6IDEwIH19PlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItcm93XCIgc3R5bGU9e3sganVzdGlmeUNvbnRlbnQ6ICdzcGFjZS1iZXR3ZWVuJywgYWxpZ25JdGVtczogJ2ZsZXgtc3RhcnQnLCBnYXA6IDEyIH19PlxuICAgICAgICA8ZGl2IHN0eWxlPXt7IGZsZXg6IDEsIG1pbldpZHRoOiAwIH19PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtcHJpbWFyeVwiIHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCwgZm9udFNpemU6IDE0IH19PlxuICAgICAgICAgICAge2dhbWUudGl0bGV9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ6ZXBoeXItcm93XCIgc3R5bGU9e3sgZ2FwOiA2LCBtYXJnaW5Ub3A6IDUsIGZsZXhXcmFwOiAnd3JhcCcgfX0+XG4gICAgICAgICAgICB7Z2FtZS53YXRjaGluZyA/IChcbiAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ6ZXBoeXItcGlsbFwiXG4gICAgICAgICAgICAgICAgc3R5bGU9e3sgYmFja2dyb3VuZDogJ3ZhcigtLXplcGh5ci1hY2NlbnQpJywgY29sb3I6ICd2YXIoLS16ZXBoeXItb24tYWNjZW50KScsIGZvbnRTaXplOiAxMCB9fVxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgXHUyNUNGIExpdmVcbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXBpbGxcIiBzdHlsZT17eyBmb250U2l6ZTogMTAgfX0+Tm90IHdhdGNoaW5nPC9zcGFuPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIHtnYW1lLmFwcElkICYmIChcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXBpbGxcIiBzdHlsZT17eyBmb250U2l6ZTogMTAgfX0+QXBwSUQge2dhbWUuYXBwSWR9PC9zcGFuPlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICAgIHtnYW1lLmxhc3RDaGVja2VkICYmIChcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtc3VidGxlXCIgc3R5bGU9e3sgZm9udFNpemU6IDEwIH19PlxuICAgICAgICAgICAgICAgIGNoZWNrZWQge25ldyBEYXRlKGdhbWUubGFzdENoZWNrZWQpLnRvTG9jYWxlVGltZVN0cmluZygpfVxuICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1yb3dcIiBzdHlsZT17eyBnYXA6IDgsIGZsZXhTaHJpbms6IDAsIGFsaWduSXRlbXM6ICdjZW50ZXInIH19PlxuICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LWFjY2VudFwiIHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDcwMCwgZm9udFNpemU6IDE2IH19PlxuICAgICAgICAgICAge2dhbWUuZWFybmVkfVxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtbXV0ZWRcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA0MDAsIGZvbnRTaXplOiAxMiB9fT5cbiAgICAgICAgICAgICAgL3tnYW1lLnRvdGFsfVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInplcGh5ci1idXR0b25cIlxuICAgICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IDExLCBwYWRkaW5nOiAnM3B4IDEwcHgnIH19XG4gICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVSZXNjYW59XG4gICAgICAgICAgICBkaXNhYmxlZD17cmVzY2FubmluZ31cbiAgICAgICAgICA+XG4gICAgICAgICAgICB7cmVzY2FubmluZyA/ICdcdTIwMjYnIDogJ1Jlc2Nhbid9XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAge2dhbWUudG90YWwgPiAwICYmIChcbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cInplcGh5ci1idXR0b25cIlxuICAgICAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogMTEsIHBhZGRpbmc6ICczcHggMTBweCcgfX1cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0RXhwYW5kZWQoKGUpID0+ICFlKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAge2V4cGFuZGVkID8gJ0hpZGUnIDogJ1Nob3cnfVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cblxuICAgICAge2dhbWUudG90YWwgPiAwICYmIChcbiAgICAgICAgPGRpdiBzdHlsZT17eyBoZWlnaHQ6IDUsIGJhY2tncm91bmQ6ICd2YXIoLS16ZXBoeXItYm9yZGVyKScsIGJvcmRlclJhZGl1czogMywgb3ZlcmZsb3c6ICdoaWRkZW4nIH19PlxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIHN0eWxlPXt7XG4gICAgICAgICAgICAgIGhlaWdodDogJzEwMCUnLFxuICAgICAgICAgICAgICB3aWR0aDogYCR7cGN0fSVgLFxuICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiAnbGluZWFyLWdyYWRpZW50KDkwZGVnLCB2YXIoLS16ZXBoeXItYWNjZW50KSwgdmFyKC0temVwaHlyLWFjY2VudC1zdHJvbmcsIHZhcigtLXplcGh5ci1hY2NlbnQpKSknLFxuICAgICAgICAgICAgICBib3JkZXJSYWRpdXM6IDMsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb246ICd3aWR0aCAwLjVzIGVhc2UnLFxuICAgICAgICAgICAgfX1cbiAgICAgICAgICAvPlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG5cbiAgICAgIHtnYW1lLmRldGVjdGlvbk5vdGUgJiYgIWdhbWUud2F0Y2hpbmcgJiYgKFxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1zdWJ0bGVcIiBzdHlsZT17eyBmb250U2l6ZTogMTEsIG1hcmdpbjogMCB9fT5cbiAgICAgICAgICB7Z2FtZS5kZXRlY3Rpb25Ob3RlfVxuICAgICAgICA8L3A+XG4gICAgICApfVxuXG4gICAgICB7ZXhwYW5kZWQgJiYgQXJyYXkuaXNBcnJheShnYW1lLnVubG9ja3MpICYmIGdhbWUudW5sb2Nrcy5sZW5ndGggPiAwICYmIChcbiAgICAgICAgPEFjaGlldmVtZW50R3JpZCB1bmxvY2tzPXtnYW1lLnVubG9ja3N9IC8+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuXG5mdW5jdGlvbiBBY2hpZXZlbWVudEdyaWQoeyB1bmxvY2tzIH0pIHtcbiAgY29uc3QgZWFybmVkID0gdW5sb2Nrcy5maWx0ZXIoKHUpID0+IHUuZWFybmVkKTtcbiAgY29uc3QgdW5lYXJuZWQgPSB1bmxvY2tzLmZpbHRlcigodSkgPT4gIXUuZWFybmVkKTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXN0YWNrXCIgc3R5bGU9e3sgZ2FwOiAxMCwgbWFyZ2luVG9wOiA0LCBib3JkZXJUb3A6ICcxcHggc29saWQgdmFyKC0temVwaHlyLWJvcmRlciknLCBwYWRkaW5nVG9wOiAxMCB9fT5cbiAgICAgIHtlYXJuZWQubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDw+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLWxhYmVsXCI+VW5sb2NrZWQgXHUyMDE0IHtlYXJuZWQubGVuZ3RofTwvc3Bhbj5cbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdncmlkJywgZ3JpZFRlbXBsYXRlQ29sdW1uczogJ3JlcGVhdChhdXRvLWZpbGwsIG1pbm1heCgyMTBweCwgMWZyKSknLCBnYXA6IDYgfX0+XG4gICAgICAgICAgICB7ZWFybmVkLm1hcCgodSkgPT4gKFxuICAgICAgICAgICAgICA8QWNoaWV2ZW1lbnRDaGlwIGtleT17dS5pZH0gYWNoPXt1fSAvPlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvPlxuICAgICAgKX1cbiAgICAgIHt1bmVhcm5lZC5sZW5ndGggPiAwICYmIChcbiAgICAgICAgPD5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ6ZXBoeXItbGFiZWxcIiBzdHlsZT17eyBtYXJnaW5Ub3A6IGVhcm5lZC5sZW5ndGggPiAwID8gOCA6IDAgfX0+XG4gICAgICAgICAgICBMb2NrZWQgXHUyMDE0IHt1bmVhcm5lZC5sZW5ndGh9XG4gICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZGlzcGxheTogJ2dyaWQnLCBncmlkVGVtcGxhdGVDb2x1bW5zOiAncmVwZWF0KGF1dG8tZmlsbCwgbWlubWF4KDIxMHB4LCAxZnIpKScsIGdhcDogNiB9fT5cbiAgICAgICAgICAgIHt1bmVhcm5lZC5tYXAoKHUpID0+IChcbiAgICAgICAgICAgICAgPEFjaGlldmVtZW50Q2hpcCBrZXk9e3UuaWR9IGFjaD17dX0gLz5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8Lz5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbmZ1bmN0aW9uIEFjaGlldmVtZW50Q2hpcCh7IGFjaCB9KSB7XG4gIHJldHVybiAoXG4gICAgPGRpdlxuICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLWNhcmQgemVwaHlyLXJvd1wiXG4gICAgICBzdHlsZT17e1xuICAgICAgICBnYXA6IDgsXG4gICAgICAgIHBhZGRpbmc6ICc3cHggMTBweCcsXG4gICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxuICAgICAgICBvcGFjaXR5OiBhY2guZWFybmVkID8gMSA6IDAuNCxcbiAgICAgICAgYmFja2dyb3VuZDogYWNoLmVhcm5lZCA/ICd2YXIoLS16ZXBoeXItYmctZWxldmF0ZWQpJyA6ICd2YXIoLS16ZXBoeXItYmctc3VyZmFjZSknLFxuICAgICAgICB0cmFuc2l0aW9uOiAnb3BhY2l0eSAwLjJzJyxcbiAgICAgIH19XG4gICAgPlxuICAgICAge2FjaC5pY29uVXJsID8gKFxuICAgICAgICA8aW1nXG4gICAgICAgICAgc3JjPXthY2guaWNvblVybH1cbiAgICAgICAgICBzdHlsZT17eyB3aWR0aDogMzIsIGhlaWdodDogMzIsIGJvcmRlclJhZGl1czogMywgZmxleFNocmluazogMCwgb2JqZWN0Rml0OiAnY292ZXInIH19XG4gICAgICAgICAgYWx0PVwiXCJcbiAgICAgICAgICBvbkVycm9yPXsoZSkgPT4ge1xuICAgICAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgfX1cbiAgICAgICAgLz5cbiAgICAgICkgOiAoXG4gICAgICAgIDxkaXZcbiAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgd2lkdGg6IDMyLFxuICAgICAgICAgICAgaGVpZ2h0OiAzMixcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogMyxcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICd2YXIoLS16ZXBoeXItYm9yZGVyKScsXG4gICAgICAgICAgICBmbGV4U2hyaW5rOiAwLFxuICAgICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxuICAgICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXG4gICAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXG4gICAgICAgICAgICBmb250U2l6ZTogMTYsXG4gICAgICAgICAgfX1cbiAgICAgICAgPlxuICAgICAgICAgIFx1RDgzQ1x1REZDNlxuICAgICAgICA8L2Rpdj5cbiAgICAgICl9XG4gICAgICA8ZGl2IHN0eWxlPXt7IGZsZXg6IDEsIG1pbldpZHRoOiAwIH19PlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtcHJpbWFyeVwiXG4gICAgICAgICAgc3R5bGU9e3sgZm9udFNpemU6IDExLCBmb250V2VpZ2h0OiA2MDAsIG92ZXJmbG93OiAnaGlkZGVuJywgdGV4dE92ZXJmbG93OiAnZWxsaXBzaXMnLCB3aGl0ZVNwYWNlOiAnbm93cmFwJyB9fVxuICAgICAgICA+XG4gICAgICAgICAge2FjaC5kaXNwbGF5TmFtZX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIHthY2guZGVzY3JpcHRpb24gJiYgKFxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiXG4gICAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogMTAsIG92ZXJmbG93OiAnaGlkZGVuJywgdGV4dE92ZXJmbG93OiAnZWxsaXBzaXMnLCB3aGl0ZVNwYWNlOiAnbm93cmFwJyB9fVxuICAgICAgICAgID5cbiAgICAgICAgICAgIHthY2guZGVzY3JpcHRpb259XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICl9XG4gICAgICAgIHthY2guZWFybmVkICYmIGFjaC51bmxvY2tlZEF0ICYmIChcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiIHN0eWxlPXt7IGZvbnRTaXplOiA5IH19PlxuICAgICAgICAgICAge25ldyBEYXRlKGFjaC51bmxvY2tlZEF0ICogMTAwMCkudG9Mb2NhbGVEYXRlU3RyaW5nKCl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICl9XG4gICAgICA8L2Rpdj5cbiAgICAgIHthY2guZWFybmVkICYmIChcbiAgICAgICAgPHNwYW4gc3R5bGU9e3sgY29sb3I6ICd2YXIoLS16ZXBoeXItc3VjY2VzcywgIzIyYzU1ZSknLCBmb250U2l6ZTogMTMsIGZsZXhTaHJpbms6IDAgfX0+XHUyNzEzPC9zcGFuPlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8gXHUyNTAwXHUyNTAwIERldGFpbCBzZWN0aW9uIChzaG93biBvbiByZWxlYXNlIGRldGFpbCBwYWdlKSBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZnVuY3Rpb24gQWNoaWV2ZW1lbnRTZWN0aW9uKHsgcmVsZWFzZSB9KSB7XG4gIGNvbnN0IHsgZ2FtZXMsIGxvYWRpbmcgfSA9IHVzZUFsbEdhbWVzKCk7XG5cbiAgY29uc3QgbWF0Y2ggPSBnYW1lcy5maW5kKChnKSA9PiB7XG4gICAgY29uc3QgYSA9IGcudGl0bGUudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBiID0gcmVsZWFzZS50aXRsZS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBhID09PSBiIHx8IGEuaW5jbHVkZXMoYikgfHwgYi5pbmNsdWRlcyhhKTtcbiAgfSk7XG5cbiAgaWYgKGxvYWRpbmcpIHtcbiAgICByZXR1cm4gPHAgY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtc3VidGxlXCIgc3R5bGU9e3sgZm9udFNpemU6IDEyLCBtYXJnaW46IDAgfX0+TG9hZGluZ1x1MjAyNjwvcD47XG4gIH1cblxuICBpZiAoIW1hdGNoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LW11dGVkXCIgc3R5bGU9e3sgZm9udFNpemU6IDEyLCBtYXJnaW46IDAgfX0+XG4gICAgICAgIE5vdCBpbiBsaWJyYXJ5IG9yIG5vIGFjaGlldmVtZW50IGZpbGVzIGRldGVjdGVkIGZvciB0aGlzIHRpdGxlLlxuICAgICAgPC9wPlxuICAgICk7XG4gIH1cblxuICBjb25zdCBwY3QgPSBtYXRjaC50b3RhbCA+IDAgPyBNYXRoLnJvdW5kKChtYXRjaC5lYXJuZWQgLyBtYXRjaC50b3RhbCkgKiAxMDApIDogMDtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXN0YWNrXCIgc3R5bGU9e3sgZ2FwOiAxMiB9fT5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiemVwaHlyLXJvd1wiIHN0eWxlPXt7IGp1c3RpZnlDb250ZW50OiAnc3BhY2UtYmV0d2VlbicsIGFsaWduSXRlbXM6ICdjZW50ZXInIH19PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInplcGh5ci1yb3dcIiBzdHlsZT17eyBnYXA6IDgsIGFsaWduSXRlbXM6ICdiYXNlbGluZScgfX0+XG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtYWNjZW50XCIgc3R5bGU9e3sgZm9udFdlaWdodDogNzAwLCBmb250U2l6ZTogMjIgfX0+XG4gICAgICAgICAgICB7bWF0Y2guZWFybmVkfVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ6ZXBoeXItdGV4dC1tdXRlZFwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMyB9fT4vIHttYXRjaC50b3RhbH0gYWNoaWV2ZW1lbnRzPC9zcGFuPlxuICAgICAgICAgIHttYXRjaC50b3RhbCA+IDAgJiYgKFxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiemVwaHlyLXRleHQtc3VidGxlXCIgc3R5bGU9e3sgZm9udFNpemU6IDEyIH19Pih7cGN0fSUpPC9zcGFuPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgICB7bWF0Y2gud2F0Y2hpbmcgPyAoXG4gICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInplcGh5ci1waWxsXCJcbiAgICAgICAgICAgIHN0eWxlPXt7IGJhY2tncm91bmQ6ICd2YXIoLS16ZXBoeXItYWNjZW50KScsIGNvbG9yOiAndmFyKC0temVwaHlyLW9uLWFjY2VudCknLCBmb250U2l6ZTogMTAgfX1cbiAgICAgICAgICA+XG4gICAgICAgICAgICBcdTI1Q0YgTGl2ZVxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ6ZXBoeXItcGlsbFwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMCB9fT5Ob3Qgd2F0Y2hpbmc8L3NwYW4+XG4gICAgICAgICl9XG4gICAgICA8L2Rpdj5cblxuICAgICAge21hdGNoLnRvdGFsID4gMCAmJiAoXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgaGVpZ2h0OiA2LCBiYWNrZ3JvdW5kOiAndmFyKC0temVwaHlyLWJvcmRlciknLCBib3JkZXJSYWRpdXM6IDMsIG92ZXJmbG93OiAnaGlkZGVuJyB9fT5cbiAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICBzdHlsZT17e1xuICAgICAgICAgICAgICBoZWlnaHQ6ICcxMDAlJyxcbiAgICAgICAgICAgICAgd2lkdGg6IGAke3BjdH0lYCxcbiAgICAgICAgICAgICAgYmFja2dyb3VuZDogJ2xpbmVhci1ncmFkaWVudCg5MGRlZywgdmFyKC0temVwaHlyLWFjY2VudCksIHZhcigtLXplcGh5ci1hY2NlbnQtc3Ryb25nLCB2YXIoLS16ZXBoeXItYWNjZW50KSkpJyxcbiAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAzLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uOiAnd2lkdGggMC41cyBlYXNlJyxcbiAgICAgICAgICAgIH19XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICB7bWF0Y2guZGV0ZWN0aW9uTm90ZSAmJiAoXG4gICAgICAgIDxwIGNsYXNzTmFtZT1cInplcGh5ci10ZXh0LXN1YnRsZVwiIHN0eWxlPXt7IGZvbnRTaXplOiAxMSwgbWFyZ2luOiAwIH19PnttYXRjaC5kZXRlY3Rpb25Ob3RlfTwvcD5cbiAgICAgICl9XG5cbiAgICAgIHtBcnJheS5pc0FycmF5KG1hdGNoLnVubG9ja3MpICYmIG1hdGNoLnVubG9ja3MubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgIDxBY2hpZXZlbWVudEdyaWQgdW5sb2Nrcz17bWF0Y2gudW5sb2Nrc30gLz5cbiAgICAgICl9XG4gICAgPC9kaXY+XG4gICk7XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBFeHBvcnRzIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgY29uc3QgZGV0YWlsU2VjdGlvbnMgPSBbXG4gIHtcbiAgICBpZDogJ2FjaGlldmVtZW50LXdhdGNoZXI6cHJvZ3Jlc3MnLFxuICAgIHRpdGxlOiAnQWNoaWV2ZW1lbnRzJyxcbiAgICBjb21wb25lbnQ6IEFjaGlldmVtZW50U2VjdGlvbixcbiAgfSxcbl07XG5cbmV4cG9ydCBjb25zdCByb3V0ZXMgPSBbXG4gIHtcbiAgICBpZDogJ2FjaGlldmVtZW50LXdhdGNoZXI6aG9tZScsXG4gICAgbmF2TGFiZWw6ICdBY2hpZXZlbWVudHMnLFxuICAgIGNvbXBvbmVudDogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHsgZGVmYXVsdDogQWNoaWV2ZW1lbnRQYWdlIH0pLFxuICB9LFxuXTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxJQUFNO0FBQUE7QUFBQTtBQUFBLEVBQ29DLFdBQVk7QUFBQTtBQUV0RCxJQUFJLENBQUMsT0FBTztBQUNWLFFBQU0sSUFBSTtBQUFBLElBQ1I7QUFBQSxFQUNGO0FBQ0Y7QUFFTyxJQUFNO0FBQUEsRUFDWDtBQUFBLEVBQVU7QUFBQSxFQUFXO0FBQUEsRUFBaUI7QUFBQSxFQUFvQjtBQUFBLEVBQVE7QUFBQSxFQUFTO0FBQUEsRUFDM0U7QUFBQSxFQUFZO0FBQUEsRUFBWTtBQUFBLEVBQU87QUFBQSxFQUFlO0FBQUEsRUFBa0I7QUFBQSxFQUNoRTtBQUFBLEVBQXNCO0FBQUEsRUFB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
