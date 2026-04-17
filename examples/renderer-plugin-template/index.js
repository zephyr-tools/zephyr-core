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

    zephyr.ipc.handle('my-plugin:list-notes', () => {
      const notes = /** @type {Record<string, { text: string; updatedAt: number }> | null} */ (
        zephyr.settings.get('notes')
      );
      return notes ?? {};
    });

    zephyr.ipc.handle('my-plugin:save-note', async (payload) => {
      const { releaseId, text } = /** @type {{ releaseId: string; text: string }} */ (payload);
      const current = /** @type {Record<string, { text: string; updatedAt: number }> | null} */ (
        zephyr.settings.get('notes')
      );
      const notes = { ...(current ?? {}) };
      if (text.trim()) {
        notes[releaseId] = { text: text.trim(), updatedAt: Date.now() };
      } else {
        delete notes[releaseId];
      }
      await zephyr.settings.set('notes', notes);
    });

    zephyr.ipc.handle('my-plugin:delete-note', async (payload) => {
      const { releaseId } = /** @type {{ releaseId: string }} */ (payload);
      const current = /** @type {Record<string, { text: string; updatedAt: number }> | null} */ (
        zephyr.settings.get('notes')
      );
      if (!current || !(releaseId in current)) return;
      const { [releaseId]: _dropped, ...rest } = current;
      await zephyr.settings.set('notes', rest);
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
