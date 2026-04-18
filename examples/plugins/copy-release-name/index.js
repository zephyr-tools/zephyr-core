// @ts-check
/** @type {import('../zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Copy Release Name',
  version: '1.0.0',
  setup(zephyr) {
    zephyr.ui.addDetailButton({ label: 'Copy Name', action: 'copy-name:run' });

    zephyr.ipc.handle('copy-name:run', async (release) => {
      const { clipboard } = await import('electron');
      const r = /** @type {{ name: string }} */ (release);
      clipboard.writeText(r.name);
    });
  },
};
