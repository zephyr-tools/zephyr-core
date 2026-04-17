// @ts-check
/** @type {import('../plugins/zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'My Plugin',
  version: '1.0.0',
  setup(zephyr) {
    // Register the IPC handler invoked by the NotesSection component.
    zephyr.ipc.handle('my-plugin:save-note', (payload) => {
      const { id, note } = /** @type {{ id: string; note: string }} */ (payload);
      console.log(`[my-plugin] Saving note for ${id}:`, note);
      // Persist via zephyr.settings or your own storage.
    });
  },
};
