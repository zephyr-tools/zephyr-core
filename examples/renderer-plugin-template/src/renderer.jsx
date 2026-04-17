import { useCallback, useEffect, useState } from 'react';

// Notes plugin template — demonstrates the full renderer API surface:
//   - detailSections   → a textarea per release, below torrent results
//   - routes           → a "My Notes" page listing every saved note
//   - IPC round-trips  → window.api.invokePlugin(...) ↔ zephyr.ipc.handle(...)
//   - UI Kit classes   → `.zephyr-*` classes + `--zephyr-*` CSS variables
//
// Storage lives entirely in the main process: notes are persisted via
// zephyr.settings.set() (see index.js). The renderer never touches disk.

function useNotes() {
  const [notes, setNotes] = useState(/** @type {Record<string, { text: string; updatedAt: number }>} */ ({}));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await window.api.invokePlugin('my-plugin:list-notes');
    setNotes(next ?? {});
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { notes, loading, refresh };
}

// ── Detail section ───────────────────────────────────────────────────────────
// Renders below torrent results on a release detail page. Loads the existing
// note for the release (if any), lets the user edit + save.

function NotesSection({ release }) {
  const { notes, refresh } = useNotes();
  const existing = notes[release.id];
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState(/** @type {'idle' | 'saving' | 'saved'} */ ('idle'));

  useEffect(() => {
    setDraft(existing?.text ?? '');
    setStatus('idle');
  }, [release.id, existing?.text]);

  async function save() {
    setStatus('saving');
    await window.api.invokePlugin('my-plugin:save-note', {
      releaseId: release.id,
      text: draft,
    });
    await refresh();
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 1200);
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
          {existing
            ? `Last updated ${new Date(existing.updatedAt).toLocaleString()}`
            : 'No note saved yet for this release'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || status === 'saving'}
          className={`zephyr-button ${dirty ? 'zephyr-button--primary' : ''}`}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : existing ? 'Update' : 'Save note'}
        </button>
      </div>
    </div>
  );
}

// ── Full-page route ──────────────────────────────────────────────────────────
// Opens from the header nav button. Lists every saved note across all
// releases. `release` is whichever release the user most recently viewed
// (or undefined if none yet this session) — used here to highlight the
// current one.

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

// ── Exports ──────────────────────────────────────────────────────────────────

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
