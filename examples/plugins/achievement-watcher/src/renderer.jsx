// Achievement Watcher — renderer layer
// All styling uses the Zephyr Plugin UI Kit (.zephyr-* / --zephyr-*). Tailwind classes do NOT work here.

import { useState, useEffect, useCallback } from 'react';

// ── Module-level overlay (DOM-native, always active regardless of current route) ──

const _style = document.createElement('style');
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

const _overlayRoot = document.createElement('div');
_overlayRoot.id = 'aw-overlay-root';
document.body.appendChild(_overlayRoot);

function _playUnlockSound() {
  try {
    const ctx = new AudioContext();
    /** @param {number} freq @param {number} start @param {number} dur */
    const tone = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    };
    const t = ctx.currentTime;
    tone(660, t, 0.12);
    tone(880, t + 0.13, 0.12);
    tone(1100, t + 0.27, 0.4);
  } catch {}
}

/** @param {string} s */
function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {any} notif */
function _showToast(notif) {
  const toast = document.createElement('div');
  toast.className = 'aw-toast zephyr-card';
  toast.style.cssText =
    'min-width:260px;max-width:340px;border-left:3px solid var(--zephyr-accent);';
  toast.innerHTML = `
    <div class="zephyr-row" style="gap:10px;align-items:center;">
      ${notif.iconUrl ? `<img src="${_esc(notif.iconUrl)}" style="width:44px;height:44px;border-radius:4px;flex-shrink:0;object-fit:cover;" onerror="this.style.display='none'" />` : '<div style="width:44px;height:44px;border-radius:4px;background:var(--zephyr-border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;">🏆</div>'}
      <div style="flex:1;min-width:0;">
        <div class="zephyr-label" style="margin-bottom:2px;">Achievement Unlocked</div>
        <div class="zephyr-text-primary" style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(notif.achievementName || notif.achievementId)}</div>
        ${notif.achievementDesc ? `<div class="zephyr-text-muted" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(notif.achievementDesc)}</div>` : ''}
        <div class="zephyr-text-subtle" style="font-size:10px;margin-top:1px;">${_esc(notif.gameTitle)}</div>
      </div>
    </div>`;
  _overlayRoot.appendChild(toast);
  _playUnlockSound();
  setTimeout(() => {
    toast.classList.add('aw-out');
    setTimeout(() => toast.remove(), 260);
  }, 6500);
}

// Poll for new achievement unlocks every 2 seconds
setInterval(async () => {
  try {
    const notifications = await window.api.invokePlugin('achievement-watcher:poll-notifications');
    if (Array.isArray(notifications)) {
      for (const n of notifications) _showToast(n);
    }
  } catch {}
}, 2000);

// ── React hooks ──────────────────────────────────────────────────────────────

function useAllGames() {
  const [games, setGames] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await window.api.invokePlugin('achievement-watcher:get-all');
      setGames(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('[achievement-watcher] get-all failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  return { games, loading, refresh };
}

// ── Achievement Page (full-page route) ───────────────────────────────────────

function AchievementPage({ release }) {
  const { games, loading, refresh } = useAllGames();

  async function rescan(infoHash) {
    await window.api.invokePlugin('achievement-watcher:rescan', { infoHash });
    await refresh();
  }

  return (
    <div className="zephyr-stack--md" style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div>
        <h2 className="zephyr-text-primary" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Achievement Watcher
        </h2>
        <p className="zephyr-text-muted" style={{ marginTop: 4 }}>
          Tracks achievement unlocks across installed library games. Add a Steam API Key in{' '}
          <em>Settings → Plugins</em> to fetch achievement names and icons.
        </p>
      </div>

      {loading ? (
        <p className="zephyr-text-subtle">Scanning library…</p>
      ) : games.length === 0 ? (
        <div className="zephyr-card" style={{ textAlign: 'center', padding: 32 }}>
          <p className="zephyr-text-muted" style={{ margin: 0 }}>
            No games with detectable achievement files found yet. Install a game using a Steam
            emulator (Goldberg, CODEX, etc.) — files are detected automatically.
          </p>
        </div>
      ) : (
        <div className="zephyr-stack">
          {games.map((game) => (
            <GameCard key={game.infoHash} game={game} onRescan={() => rescan(game.infoHash)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GameCard({ game, onRescan }) {
  const [expanded, setExpanded] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const pct = game.total > 0 ? Math.round((game.earned / game.total) * 100) : 0;

  async function handleRescan() {
    setRescanning(true);
    await onRescan();
    setRescanning(false);
  }

  return (
    <div className="zephyr-card zephyr-stack" style={{ gap: 10 }}>
      <div className="zephyr-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="zephyr-text-primary" style={{ fontWeight: 700, fontSize: 14 }}>
            {game.title}
          </div>
          <div className="zephyr-row" style={{ gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {game.watching ? (
              <span
                className="zephyr-pill"
                style={{ background: 'var(--zephyr-accent)', color: 'var(--zephyr-on-accent)', fontSize: 10 }}
              >
                ● Live
              </span>
            ) : (
              <span className="zephyr-pill" style={{ fontSize: 10 }}>Not watching</span>
            )}
            {game.appId && (
              <span className="zephyr-pill" style={{ fontSize: 10 }}>AppID {game.appId}</span>
            )}
            {game.lastChecked && (
              <span className="zephyr-text-subtle" style={{ fontSize: 10 }}>
                checked {new Date(game.lastChecked).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        <div className="zephyr-row" style={{ gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <span className="zephyr-text-accent" style={{ fontWeight: 700, fontSize: 16 }}>
            {game.earned}
            <span className="zephyr-text-muted" style={{ fontWeight: 400, fontSize: 12 }}>
              /{game.total}
            </span>
          </span>
          <button
            type="button"
            className="zephyr-button"
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={handleRescan}
            disabled={rescanning}
          >
            {rescanning ? '…' : 'Rescan'}
          </button>
          {game.total > 0 && (
            <button
              type="button"
              className="zephyr-button"
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? 'Hide' : 'Show'}
            </button>
          )}
        </div>
      </div>

      {game.total > 0 && (
        <div style={{ height: 5, background: 'var(--zephyr-border)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--zephyr-accent), var(--zephyr-accent-strong, var(--zephyr-accent)))',
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      )}

      {game.detectionNote && !game.watching && (
        <p className="zephyr-text-subtle" style={{ fontSize: 11, margin: 0 }}>
          {game.detectionNote}
        </p>
      )}

      {expanded && Array.isArray(game.unlocks) && game.unlocks.length > 0 && (
        <AchievementGrid unlocks={game.unlocks} />
      )}
    </div>
  );
}

function AchievementGrid({ unlocks }) {
  const earned = unlocks.filter((u) => u.earned);
  const unearned = unlocks.filter((u) => !u.earned);

  return (
    <div className="zephyr-stack" style={{ gap: 10, marginTop: 4, borderTop: '1px solid var(--zephyr-border)', paddingTop: 10 }}>
      {earned.length > 0 && (
        <>
          <span className="zephyr-label">Unlocked — {earned.length}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
            {earned.map((u) => (
              <AchievementChip key={u.id} ach={u} />
            ))}
          </div>
        </>
      )}
      {unearned.length > 0 && (
        <>
          <span className="zephyr-label" style={{ marginTop: earned.length > 0 ? 8 : 0 }}>
            Locked — {unearned.length}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 6 }}>
            {unearned.map((u) => (
              <AchievementChip key={u.id} ach={u} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AchievementChip({ ach }) {
  return (
    <div
      className="zephyr-card zephyr-row"
      style={{
        gap: 8,
        padding: '7px 10px',
        alignItems: 'center',
        opacity: ach.earned ? 1 : 0.4,
        background: ach.earned ? 'var(--zephyr-bg-elevated)' : 'var(--zephyr-bg-surface)',
        transition: 'opacity 0.2s',
      }}
    >
      {ach.iconUrl ? (
        <img
          src={ach.iconUrl}
          style={{ width: 32, height: 32, borderRadius: 3, flexShrink: 0, objectFit: 'cover' }}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 3,
            background: 'var(--zephyr-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          🏆
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="zephyr-text-primary"
          style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {ach.displayName}
        </div>
        {ach.description && (
          <div
            className="zephyr-text-subtle"
            style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {ach.description}
          </div>
        )}
        {ach.earned && ach.unlockedAt && (
          <div className="zephyr-text-subtle" style={{ fontSize: 9 }}>
            {new Date(ach.unlockedAt * 1000).toLocaleDateString()}
          </div>
        )}
      </div>
      {ach.earned && (
        <span style={{ color: 'var(--zephyr-success, #22c55e)', fontSize: 13, flexShrink: 0 }}>✓</span>
      )}
    </div>
  );
}

// ── Detail section (shown on release detail page) ─────────────────────────────

function AchievementSection({ release }) {
  const { games, loading } = useAllGames();

  const match = games.find((g) => {
    const a = g.title.toLowerCase();
    const b = release.title.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  });

  if (loading) {
    return <p className="zephyr-text-subtle" style={{ fontSize: 12, margin: 0 }}>Loading…</p>;
  }

  if (!match) {
    return (
      <p className="zephyr-text-muted" style={{ fontSize: 12, margin: 0 }}>
        Not in library or no achievement files detected for this title.
      </p>
    );
  }

  const pct = match.total > 0 ? Math.round((match.earned / match.total) * 100) : 0;

  return (
    <div className="zephyr-stack" style={{ gap: 12 }}>
      <div className="zephyr-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="zephyr-row" style={{ gap: 8, alignItems: 'baseline' }}>
          <span className="zephyr-text-accent" style={{ fontWeight: 700, fontSize: 22 }}>
            {match.earned}
          </span>
          <span className="zephyr-text-muted" style={{ fontSize: 13 }}>/ {match.total} achievements</span>
          {match.total > 0 && (
            <span className="zephyr-text-subtle" style={{ fontSize: 12 }}>({pct}%)</span>
          )}
        </div>
        {match.watching ? (
          <span
            className="zephyr-pill"
            style={{ background: 'var(--zephyr-accent)', color: 'var(--zephyr-on-accent)', fontSize: 10 }}
          >
            ● Live
          </span>
        ) : (
          <span className="zephyr-pill" style={{ fontSize: 10 }}>Not watching</span>
        )}
      </div>

      {match.total > 0 && (
        <div style={{ height: 6, background: 'var(--zephyr-border)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--zephyr-accent), var(--zephyr-accent-strong, var(--zephyr-accent)))',
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      )}

      {match.detectionNote && (
        <p className="zephyr-text-subtle" style={{ fontSize: 11, margin: 0 }}>{match.detectionNote}</p>
      )}

      {Array.isArray(match.unlocks) && match.unlocks.length > 0 && (
        <AchievementGrid unlocks={match.unlocks} />
      )}
    </div>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const detailSections = [
  {
    id: 'achievement-watcher:progress',
    title: 'Achievements',
    component: AchievementSection,
  },
];

export const routes = [
  {
    id: 'achievement-watcher:home',
    navLabel: 'Achievements',
    component: () => Promise.resolve({ default: AchievementPage }),
  },
];
