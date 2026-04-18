// @ts-check
/** @type {import('../zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Open PCGamingWiki',
  version: '1.0.0',
  setup(zephyr) {
    zephyr.ui.addDetailButton({ label: 'PCGamingWiki', action: 'pcgw:open' });

    zephyr.ipc.handle('pcgw:open', async (release) => {
      const { shell } = await import('electron');
      const r = /** @type {{ title: string }} */ (release);
      await shell.openExternal(
        `https://www.pcgamingwiki.com/w/index.php?search=${encodeURIComponent(r.title)}`,
      );
    });
  },
};
