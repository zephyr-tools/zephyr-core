// @ts-check
/** @type {import('../plugins/zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Notes',
  version: '1.0.0',
  setup(zephyr) {
    // Notes are stored under the single 'notes' key as { [releaseId]: {text, updatedAt} }.
    // The value isn't user-configurable via Settings UI, so we skip settings.register()
    // and accept the one-time set() warning that fires on first save.

    /** @param {unknown} payload @returns {Record<string, unknown>} */
    function asObject(payload) {
      if (payload == null || typeof payload !== 'object') {
        throw new Error('payload must be an object');
      }
      return /** @type {Record<string, unknown>} */ (payload);
    }

    /**
     * Read persisted notes into a null-prototype map so keys like "__proto__"
     * are safe. Each entry is shape-validated — corrupt values in settings.json
     * (manual edits, schema drift) are coerced or skipped rather than trusted.
     */
    function readNotes() {
      const notes = /** @type {Record<string, { text: string; updatedAt: number }>} */ (
        Object.create(null)
      );
      const raw = zephyr.settings.get('notes');
      if (raw == null || typeof raw !== 'object') return notes;
      for (const [key, value] of Object.entries(/** @type {object} */ (raw))) {
        if (value == null || typeof value !== 'object') continue;
        const v = /** @type {Record<string, unknown>} */ (value);
        notes[key] = {
          text: typeof v.text === 'string' ? v.text : '',
          updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
        };
      }
      return notes;
    }

    // Serialize read-modify-write of the notes blob so two concurrent IPC
    // handlers can't both read the same snapshot, modify, and race each
    // other's zephyr.settings.set() — last-writer-wins would drop updates.
    /** @type {Promise<unknown>} */
    let writeChain = Promise.resolve();
    /** @template T @param {() => Promise<T>} task @returns {Promise<T>} */
    function withWriteLock(task) {
      const next = writeChain.then(task);
      writeChain = next.catch(() => undefined);
      return next;
    }

    zephyr.ipc.handle('my-plugin:list-notes', () => readNotes());

    zephyr.ipc.handle('my-plugin:save-note', async (payload) => {
      const p = asObject(payload);
      const releaseId = typeof p.releaseId === 'string' ? p.releaseId.trim() : '';
      const text = typeof p.text === 'string' ? p.text : '';
      if (!releaseId) throw new Error('save-note: releaseId must be a non-empty string');

      await withWriteLock(async () => {
        const notes = readNotes();
        if (text.trim()) {
          notes[releaseId] = { text: text.trim(), updatedAt: Date.now() };
        } else {
          delete notes[releaseId];
        }
        await zephyr.settings.set('notes', notes);
      });
    });

    zephyr.ipc.handle('my-plugin:delete-note', async (payload) => {
      const p = asObject(payload);
      const releaseId = typeof p.releaseId === 'string' ? p.releaseId.trim() : '';
      if (!releaseId) throw new Error('delete-note: releaseId must be a non-empty string');

      await withWriteLock(async () => {
        const notes = readNotes();
        if (!(releaseId in notes)) return;
        delete notes[releaseId];
        await zephyr.settings.set('notes', notes);
      });
    });

    zephyr.hooks.onDownloadComplete((job) => {
      console.log(
        `[Notes] Download complete: ${job.name} (scan: ${job.scanStatus ?? 'unknown'})`,
      );
    });
  },
};
