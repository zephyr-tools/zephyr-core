// @ts-check
/** @type {import('../plugins/zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Notes',
  version: '1.0.0',
  setup(zephyr) {
    // Notes are stored in a single object keyed by release id. We use
    // `zephyr.settings.set('notes', …)` for disk persistence without
    // registering a matching UI field — notes aren't user-configurable
    // in the Settings dialog, so no register() call. A one-time console
    // warning on first save is expected and harmless.

    /**
     * Validate that the payload is a non-null object. Plugin IPC handlers
     * receive `unknown` from the renderer and should verify shapes before
     * indexing into them — a malformed payload shouldn't crash the host.
     * @param {unknown} payload
     * @returns {Record<string, unknown>}
     */
    function asObject(payload) {
      if (payload == null || typeof payload !== 'object') {
        throw new Error('payload must be an object');
      }
      return /** @type {Record<string, unknown>} */ (payload);
    }

    function readNotes() {
      // Use a null-prototype object so release IDs like "__proto__" or
      // "constructor" can't mutate Object.prototype or collide with inherited
      // properties. Standard hygiene for dictionaries keyed by untrusted input.
      const notes = /** @type {Record<string, { text: string; updatedAt: number }>} */ (
        Object.create(null)
      );
      const raw = zephyr.settings.get('notes');
      if (raw == null || typeof raw !== 'object') return notes;
      // Copy only own enumerable properties — skip any inherited prototype noise.
      for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
        notes[key] = /** @type {{ text: string; updatedAt: number }} */ (value);
      }
      return notes;
    }

    zephyr.ipc.handle('my-plugin:list-notes', () => readNotes());

    zephyr.ipc.handle('my-plugin:save-note', async (payload) => {
      const p = asObject(payload);
      const releaseId = typeof p.releaseId === 'string' ? p.releaseId.trim() : '';
      const text = typeof p.text === 'string' ? p.text : '';
      if (!releaseId) throw new Error('save-note: releaseId must be a non-empty string');

      const notes = readNotes();
      if (text.trim()) {
        notes[releaseId] = { text: text.trim(), updatedAt: Date.now() };
      } else {
        delete notes[releaseId];
      }
      await zephyr.settings.set('notes', notes);
    });

    zephyr.ipc.handle('my-plugin:delete-note', async (payload) => {
      const p = asObject(payload);
      const releaseId = typeof p.releaseId === 'string' ? p.releaseId.trim() : '';
      if (!releaseId) throw new Error('delete-note: releaseId must be a non-empty string');

      const notes = readNotes();
      if (!(releaseId in notes)) return;
      delete notes[releaseId];
      await zephyr.settings.set('notes', notes);
    });

    // Demonstrates the core hook: `onDownloadComplete` fires after the
    // virus scan resolves, so `job.scanStatus` is already final.
    zephyr.hooks.onDownloadComplete((job) => {
      console.log(
        `[Notes] Download complete: ${job.name} (scan: ${job.scanStatus ?? 'unknown'})`,
      );
    });
  },
};
