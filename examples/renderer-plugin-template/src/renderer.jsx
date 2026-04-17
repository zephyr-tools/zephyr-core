import { useState } from 'react';

// Plugin UI is styled via the Zephyr Plugin UI Kit (see PLUGINS.md):
//   - CSS variables under `--zephyr-*` for use in inline styles
//   - Class names under `.zephyr-*` for common primitives
// Tailwind classes from the host app are NOT available in plugin bundles.

// ── Detail section example ────────────────────────────────────────────────────
// Renders below torrent results on the game detail page.
// Receives the full Release object as a prop.

function NotesSection({ release }) {
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  async function save() {
    await window.api.invokePlugin('my-plugin:save-note', { id: release.id, note });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="zephyr-stack">
      <textarea
        className="zephyr-textarea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`Notes for ${release.title}…`}
        rows={3}
        style={{ resize: 'vertical' }}
      />
      <button
        type="button"
        onClick={save}
        className={`zephyr-button ${saved ? '' : 'zephyr-button--primary'}`}
        style={saved ? { background: 'var(--zephyr-success)', color: '#fff' } : undefined}
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
    <div className="zephyr-stack--md" style={{ padding: 24 }}>
      <h2 className="zephyr-text-primary" style={{ fontSize: 20, fontWeight: 700 }}>
        My Plugin
      </h2>
      {release ? (
        <p className="zephyr-text-muted">
          Last viewed: <strong className="zephyr-text-primary">{release.title}</strong>
        </p>
      ) : (
        <p className="zephyr-text-subtle">No release selected.</p>
      )}
    </div>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────

export const detailSections = [
  {
    id: 'my-plugin:notes',
    title: 'My Notes',
    component: NotesSection,
  },
];

export const routes = [
  {
    id: 'my-plugin:home',
    navLabel: 'My Plugin',
    component: () => Promise.resolve({ default: MyPluginPage }),
  },
];
