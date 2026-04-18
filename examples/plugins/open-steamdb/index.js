// @ts-check
/** @type {import('../zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Open SteamDB',
  version: '1.0.0',
  setup(zephyr) {
    zephyr.ui.addDetailButton({ label: 'SteamDB', action: 'steamdb:open' });

    zephyr.ipc.handle('steamdb:open', async (release) => {
      const { shell } = await import('electron');
      const r = /** @type {{ title: string }} */ (release);
      await shell.openExternal(
        `https://www.steamdb.info/search/?q=${encodeURIComponent(r.title)}`,
      );
    });
  },
};
