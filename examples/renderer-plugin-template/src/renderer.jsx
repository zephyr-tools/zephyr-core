import { useCallback, useEffect, useRef, useState } from 'react';

// Notes plugin — exercises detailSections, routes, IPC round-trips, and the
// `.zephyr-*` UI kit. Storage is owned by index.js; the renderer only drives IPC.

function useNotes() {
  const [notes, setNotes] = useState(/** @type {Record<string, { text: string; updatedAt: number }>} */ ({}));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.invokePlugin('my-plugin:list-notes');
      setNotes(next ?? {});
    } catch (err) {
      console.error('[Notes] list-notes failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { notes, loading, refresh };
}

// Detail section — renders below torrent results.

function NotesSection({ release }) {
  const { notes, refresh } = useNotes();
  const existing = notes[release.id];
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState(
    /** @type {'idle' | 'saving' | 'saved' | 'error'} */ ('idle'),
  );
  const [errorMessage, setErrorMessage] = useState('');
  // Stored in a ref so rapid successive saves can cancel the previous timer
  // before scheduling a new one — otherwise a stale timer flips status to
  // 'idle' mid-request.
  const saveTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  function clearSaveTimer() {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }

  useEffect(() => {
    setDraft(existing?.text ?? '');
    setStatus('idle');
    setErrorMessage('');
  }, [release.id, existing?.text]);

  useEffect(() => clearSaveTimer, []);

  async function save() {
    clearSaveTimer();
    setStatus('saving');
    setErrorMessage('');
    try {
      await window.api.invokePlugin('my-plugin:save-note', {
        releaseId: release.id,
        text: draft,
      });
      await refresh();
      setStatus('saved');
    } catch (err) {
      console.error('[Notes] save failed:', err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setStatus('error');
    } finally {
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        setStatus('idle');
      }, 1200);
    }
  }

  const dirty = draft.trim() !== (existing?.text ?? '');

  return (
    <div className="zephyr-stack">
      <textarea
        className="zephyr-textarea"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={`Write a note about ${release.title}…`}
        rows={4}
        style={{ resize: 'vertical' }}
      />
      <div className="zephyr-row" style={{ justifyContent: 'space-between' }}>
        <span className="zephyr-text-subtle" style={{ fontSize: 11 }}>
          {status === 'error'
            ? `Save failed: ${errorMessage}`
            : existing
              ? `Last updated ${new Date(existing.updatedAt).toLocaleString()}`
              : 'No note saved yet for this release'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === 'saving'}
          className={`zephyr-button ${dirty ? 'zephyr-button--primary' : ''}`}
        >
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved!'
              : status === 'error'
                ? 'Retry'
                : existing
                  ? 'Update'
                  : 'Save note'}
        </button>
      </div>
    </div>
  );
}

// Full-page route — opens from the header nav. `release` is the last-viewed
// one this session (or undefined), used here to highlight the active note.

function NotesPage({ release }) {
  const { notes, loading, refresh } = useNotes();
  const entries = Object.entries(notes).sort(
    ([, a], [, b]) => b.updatedAt - a.updatedAt,
  );

  async function remove(releaseId) {
    await window.api.invokePlugin('my-plugin:delete-note', { releaseId });
    await refresh();
  }

  return (
    <div className="zephyr-stack--md" style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <div>
        <h2 className="zephyr-text-primary" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Your notes
        </h2>
        <p className="zephyr-text-muted" style={{ marginTop: 4 }}>
          Personal notes you've saved about releases. Open any release's detail page to add one.
        </p>
      </div>

      {release && (
        <div className="zephyr-card zephyr-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="zephyr-label">Last viewed</div>
            <div className="zephyr-text-primary" style={{ marginTop: 4 }}>{release.title}</div>
          </div>
          <span className="zephyr-pill">{release.id}</span>
        </div>
      )}

      {loading ? (
        <p className="zephyr-text-subtle">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="zephyr-card" style={{ textAlign: 'center' }}>
          <p className="zephyr-text-muted" style={{ margin: 0 }}>
            No notes yet. Pick a release from the grid, scroll to the "Notes" section at the
            bottom of its detail page, and your note will show up here.
          </p>
        </div>
      ) : (
        <ul className="zephyr-stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {entries.map(([releaseId, note]) => {
            const isCurrent = release?.id === releaseId;
            return (
              <li key={releaseId} className="zephyr-card zephyr-stack">
                <div className="zephyr-row" style={{ justifyContent: 'space-between' }}>
                  <span className="zephyr-label">
                    {isCurrent ? '★ Current release · ' : ''}
                    {releaseId}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(releaseId)}
                    className="zephyr-button zephyr-button--danger"
                    style={{ fontSize: 11 }}
                  >
                    Delete
                  </button>
                </div>
                <p className="zephyr-text-secondary" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                  {note.text}
                </p>
                <span className="zephyr-text-subtle" style={{ fontSize: 11 }}>
                  {new Date(note.updatedAt).toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const detailSections = [
  {
    id: 'my-plugin:notes',
    title: 'Notes',
    component: NotesSection,
  },
];

export const routes = [
  {
    id: 'my-plugin:home',
    navLabel: 'My Notes',
    component: () => Promise.resolve({ default: NotesPage }),
  },
];
