// Achievement Watcher — renderer layer
// All styling uses the Zephyr Plugin UI Kit (.zephyr-* / --zephyr-*). Tailwind classes do NOT work here.
// Achievement unlock notifications are delivered via the Windows notification API (Electron.Notification)
// from the main process — no in-app toast overlay needed here.

import { useState, useEffect, useCallback } from 'react';

// ── React hooks ──────────────────────────────────────────────────────────────

function useServiceStatus() {
  const [status, setStatus] = useState(/** @type {{ serviceInstalled: boolean; serviceRunning: boolean; widgetInstalled: boolean; connected: boolean } | null} */ (null));

  useEffect(() => {
    async function poll() {
      try {
        const s = await window.api.invokePlugin('achievement-watcher:get-status');
        setStatus(s);
      } catch {}
    }
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  return status;
}

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
  const status = useServiceStatus();
  const [installing, setInstalling] = useState(/** @type {'service' | 'widget' | 'start' | null} */ (null));

  async function rescan(infoHash) {
    await window.api.invokePlugin('achievement-watcher:rescan', { infoHash });
    await refresh();
  }

  async function installService() {
    setInstalling('service');
    try {
      await window.api.invokePlugin('achievement-watcher:install-service');
    } catch (err) {
      console.error('[achievement-watcher] install-service failed:', err);
    } finally {
      setInstalling(null);
    }
  }

  async function installWidget() {
    setInstalling('widget');
    try {
      await window.api.invokePlugin('achievement-watcher:install-widget');
    } catch (err) {
      console.error('[achievement-watcher] install-widget failed:', err);
    } finally {
      setInstalling(null);
    }
  }

  async function startService() {
    setInstalling('start');
    try {
      await window.api.invokePlugin('achievement-watcher:start-service');
    } catch (err) {
      console.error('[achievement-watcher] start-service failed:', err);
    } finally {
      setInstalling(null);
    }
  }

  return (
    <div className="zephyr-stack--md" style={{ padding: 24, maxWidth: 820, margin: '0 auto' }}>
      <div className="zephyr-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h2 className="zephyr-text-primary" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Achievement Watcher
          </h2>
          <p className="zephyr-text-muted" style={{ marginTop: 4 }}>
            Tracks achievement unlocks across installed library games. Add a Steam API Key in{' '}
            <em>Settings → Plugins</em> to fetch achievement names and icons.
          </p>
        </div>
        <button
          type="button"
          className="zephyr-button"
          style={{ flexShrink: 0, fontSize: 12 }}
          onClick={() => window.api.invokePlugin('achievement-watcher:test-notification')}
        >
          Test notification
        </button>
      </div>

      {status && !status.serviceInstalled && (
        <div className="zephyr-card" style={{ borderLeft: '3px solid var(--zephyr-accent)', padding: 16 }}>
          <div className="zephyr-text-primary" style={{ fontWeight: 700, marginBottom: 6 }}>
            Achievement Service not installed
          </div>
          <p className="zephyr-text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
            The background service watches your achievement files even while Zephyr is closed, and
            delivers unlock notifications to the Game Bar widget during gameplay.
          </p>
          <button
            type="button"
            className="zephyr-button"
            onClick={installService}
            disabled={installing === 'service'}
          >
            {installing === 'service' ? 'Installing…' : 'Install Achievement Service'}
          </button>
        </div>
      )}

      {status && status.serviceInstalled && !status.serviceRunning && (
        <div className="zephyr-card" style={{ borderLeft: '3px solid var(--zephyr-accent)', padding: 16 }}>
          <div className="zephyr-text-primary" style={{ fontWeight: 700, marginBottom: 4 }}>
            Service installed but not running
          </div>
          <p className="zephyr-text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
            The achievement service isn't listening. Start it now — it'll auto-start at every
            login thereafter. If starting fails repeatedly, check Task Scheduler's{' '}
            <em>Last Run Result</em> for <em>ZephyrAchievementWatcher</em>.
          </p>
          <button
            type="button"
            className="zephyr-button"
            onClick={startService}
            disabled={installing === 'start'}
          >
            {installing === 'start' ? 'Starting…' : 'Start Service'}
          </button>
        </div>
      )}

      {status && status.serviceInstalled && !status.widgetInstalled && (
        <div className="zephyr-card" style={{ borderLeft: '3px solid var(--zephyr-border)', padding: 16 }}>
          <div className="zephyr-text-primary" style={{ fontWeight: 700, marginBottom: 6 }}>
            Game Bar widget not installed
          </div>
          <p className="zephyr-text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
            Install the Game Bar widget to see achievement toast notifications while playing in
            full-screen exclusive mode.
          </p>
          <button
            type="button"
            className="zephyr-button"
            onClick={installWidget}
            disabled={installing === 'widget'}
          >
            {installing === 'widget' ? 'Installing…' : 'Install Game Bar Widget'}
          </button>
        </div>
      )}

      {status && status.serviceInstalled && status.widgetInstalled && (
        <div className="zephyr-card" style={{ borderLeft: '3px solid var(--zephyr-border)', padding: 12 }}>
          <div className="zephyr-text-primary" style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
            Pin the widget to Game Bar
          </div>
          <p className="zephyr-text-muted" style={{ margin: 0, fontSize: 12 }}>
            Press <strong>Win+G</strong> to open Game Bar, find <em>Achievement Watcher</em>, then
            click the <strong>Pin</strong> icon. The widget must be pinned to show notifications
            while you play.
          </p>
        </div>
      )}

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
