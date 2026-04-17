import { useState } from 'react';

// ── Detail section example ────────────────────────────────────────────────────
// Renders below torrent results on the game detail page.
// Receives the full Release object as a prop.

function NotesSection({ release }) {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  function save() {
    window.api.invokePlugin('my-plugin:save-note', { id: release.id, note });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`Notes for ${release.title}…`}
        rows={3}
        style={{
          background: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 8,
          color: '#e4e4e7',
          fontSize: 13,
          padding: '8px 10px',
          resize: 'vertical',
          width: '100%',
        }}
      />
      <button
        onClick={save}
        style={{
          alignSelf: 'flex-start',
          background: saved ? '#16a34a' : '#7c3aed',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          padding: '6px 14px',
        }}
      >
        {saved ? 'Saved!' : 'Save note'}
      </button>
    </div>
  );
}

// ── Full-page route example ───────────────────────────────────────────────────
// Registered as a top-level nav page in the app header.

function MyPluginPage({ release }) {
  return (
    <div style={{ padding: 24, color: '#e4e4e7' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>My Plugin</h2>
      {release ? (
        <p style={{ color: '#a1a1aa', fontSize: 14 }}>
          Last viewed: <strong style={{ color: '#e4e4e7' }}>{release.title}</strong>
        </p>
      ) : (
        <p style={{ color: '#71717a', fontSize: 14 }}>No release selected.</p>
      )}
    </div>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const detailSections = [
  {
    title: 'My Notes',
    component: NotesSection,
  },
];

export const routes = [
  {
    id: 'my-plugin',
    navLabel: 'My Plugin',
    component: () => Promise.resolve({ default: MyPluginPage }),
  },
];
