import type { BrowserWindow } from 'electron';
import electronUpdater, { type UpdateInfo } from 'electron-updater';

const { autoUpdater } = electronUpdater;

/**
 * Initialises the auto-updater. Call once after the main window is created.
 *
 * Lifecycle:
 *  1. Silently check GitHub Releases on launch (and every 4 hours).
 *  2. Download in the background when a new version is found.
 *  3. Push `update:available` to renderer so it can show a notification.
 *  4. Renderer calls `update:install` when the user clicks "Restart".
 */
export function initAutoUpdater(getWindow: () => BrowserWindow | null): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    getWindow()?.webContents.send('update:available', {
      version: info.version,
      releaseNotes:
        typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => n.note).join('\n')
            : undefined,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    getWindow()?.webContents.send('update:downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] error:', err);
  });

  // Initial check — wait a few seconds so the window is fully loaded.
  setTimeout(
    () =>
      autoUpdater
        .checkForUpdates()
        .catch((err) => console.error('[auto-updater] initial check failed:', err)),
    5_000,
  );

  // Re-check every 4 hours while the app is running.
  setInterval(
    () =>
      autoUpdater
        .checkForUpdates()
        .catch((err) => console.error('[auto-updater] periodic check failed:', err)),
    4 * 60 * 60 * 1_000,
  );
}

/** Manually trigger an update check. */
export async function checkForUpdate(): Promise<void> {
  await autoUpdater.checkForUpdates();
}

/** Quit and install the downloaded update. */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}
