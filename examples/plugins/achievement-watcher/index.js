// @ts-check
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import net from 'node:net';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { app, Notification } from 'electron';

const execFileAsync = promisify(execFile);

/**
 * execFile wrapper that hides the transient console window Electron would
 * otherwise pop up for every spawned PowerShell/where/etc. Without this, users
 * see a black flash with any stderr output rendered in red.
 * @param {string} file
 * @param {string[]} args
 */
function exec(file, args) {
  return execFileAsync(file, args, { windowsHide: true });
}

/**
 * @typedef {{ gameId: string; title: string; total: number; earned: number }} GameSummary
 * @typedef {{ infoHash: string; title: string; appId: number | null; total: number; earned: number; watching: boolean; lastChecked: number | null; detectionNote: string | null; unlocks?: any[] }} GamesCache
 * @typedef {{ name: string; displayName: string; description: string; icon?: string; iconGray?: string; hidden: boolean }} SchemaDef
 */

const TAG = '[achievement-watcher]';
const __pluginDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('../zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Achievement Watcher',
  version: '1.0.0',
  setup(zephyr) {
    const dataDir = path.join(app.getPath('userData'), 'achievement-watcher');

    zephyr.settings.register({
      key: 'steamApiKey',
      label: 'Steam API Key',
      type: 'password',
      hint: 'Required to fetch achievement names and icons. Get yours at steamcommunity.com/dev/apikey',
    });

    /** @type {Map<string, GamesCache>} */
    const gamesCache = new Map();

    /** @type {any} */
    let wsClient = null;
    let wsReady = false;

    // ── Config management ────────────────────────────────────────────────────

    /** @returns {Promise<{ token: string; port: number }>} */
    async function readOrCreateConfig() {
      await fs.mkdir(dataDir, { recursive: true });
      const configPath = path.join(dataDir, 'config.json');
      try {
        const raw = await fs.readFile(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.token === 'string' && typeof parsed.port === 'number') {
          return parsed;
        }
      } catch {}
      const config = { token: randomUUID(), port: 37265 };
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`${TAG} Created new config.json with auth token`);
      return config;
    }

    // ── WebSocket client (connects to the service) ───────────────────────────

    /** @param {{ token: string; port: number }} config */
    function connectToService(config) {
      const _require = createRequire(import.meta.url);
      // Pass absolute path so Node resolves from the bundled service/node_modules
      /** @type {any} */
      const wsModule = _require(path.join(__pluginDir, 'service', 'node_modules', 'ws'));
      const WsClass = wsModule.WebSocket ?? wsModule.default ?? wsModule;

      wsReady = false;

      function tryConnect() {
        if (wsClient) {
          try { wsClient.close(); } catch {}
          wsClient = null;
        }

        const ws = new WsClass(`ws://127.0.0.1:${config.port}`);
        wsClient = ws;

        ws.on('open', () => {
          console.log(`${TAG} Connected to achievement service`);
          ws.send(JSON.stringify({ type: 'client:identify', role: 'zephyr', token: config.token }));
          wsReady = true;
        });

        ws.on('message', (/** @type {any} */ data) => {
          let msg;
          try {
            msg = JSON.parse(data.toString());
          } catch {
            return;
          }
          handleServiceMessage(msg);
        });

        ws.on('close', () => {
          console.log(`${TAG} Service connection closed — reconnecting in 5s`);
          wsReady = false;
          wsClient = null;
          setTimeout(tryConnect, 5000);
        });

        ws.on('error', (/** @type {Error} */ err) => {
          // Error is followed by close, reconnect handled there
          console.warn(`${TAG} WS client error:`, err.message);
        });
      }

      tryConnect();
    }

    /** @param {any} msg */
    function handleServiceMessage(msg) {
      switch (msg.type) {
        case 'state:sync': {
          // Populate gamesCache from summaries
          if (Array.isArray(msg.games)) {
            for (const summary of msg.games) {
              const existing = gamesCache.get(summary.gameId);
              gamesCache.set(summary.gameId, {
                infoHash: summary.gameId,
                title: summary.title,
                appId: existing?.appId ?? null,
                total: summary.total,
                earned: summary.earned,
                watching: true,
                lastChecked: existing?.lastChecked ?? null,
                detectionNote: existing?.detectionNote ?? null,
                unlocks: Array.isArray(summary.achievements) ? summary.achievements : existing?.unlocks,
              });
            }
          }
          break;
        }

        case 'achievement:unlock': {
          showSystemNotification({
            achievementName: msg.achievementName || msg.achievementId,
            achievementDesc: msg.achievementDesc,
            gameTitle: msg.gameTitle,
          });
          const game = gamesCache.get(msg.gameId);
          if (game) {
            game.lastChecked = Date.now();
            if (Array.isArray(game.unlocks)) {
              const ach = game.unlocks.find((u) => u.id === msg.achievementId);
              if (ach && !ach.earned) {
                ach.earned = true;
                ach.unlockedAt = Math.floor(msg.unlockedAt / 1000);
                game.earned = game.unlocks.filter((u) => u.earned).length;
              } else if (!ach) {
                game.earned = (game.earned ?? 0) + 1;
              }
            } else {
              game.earned = (game.earned ?? 0) + 1;
            }
          }
          console.log(`${TAG} achievement:unlock "${msg.achievementName}" in "${msg.gameTitle}"`);
          break;
        }

        case 'schema:update': {
          const game = gamesCache.get(msg.gameId);
          if (game) {
            game.total = msg.total;
            game.earned = msg.earned;
            if (Array.isArray(msg.achievements)) {
              game.unlocks = msg.achievements;
            }
          }
          break;
        }
      }
    }

    /**
     * Fire a Windows system toast (Action Center / bottom-right of screen).
     * Best-effort — silently skipped when notifications aren't supported.
     * @param {{ achievementName: string; achievementDesc?: string | null; gameTitle?: string | null }} item
     */
    function showSystemNotification(item) {
      try {
        if (!Notification.isSupported()) return;
        const title = `Achievement Unlocked — ${item.achievementName}`;
        const bodyParts = [];
        if (item.gameTitle) bodyParts.push(item.gameTitle);
        if (item.achievementDesc) bodyParts.push(item.achievementDesc);
        new Notification({
          title,
          body: bodyParts.join(' · '),
          silent: false,
        }).show();
      } catch (err) {
        console.error(`${TAG} system notification failed:`, /** @type {Error} */ (err).message);
      }
    }

    /** @param {object} msg */
    function sendToService(msg) {
      if (wsClient && wsReady) {
        try {
          wsClient.send(JSON.stringify(msg));
        } catch (err) {
          console.warn(`${TAG} sendToService failed:`, /** @type {Error} */ (err).message);
        }
      }
    }

    // ── IPC handlers ─────────────────────────────────────────────────────────

    zephyr.ipc.handle('achievement-watcher:get-all', () =>
      [...gamesCache.values()].map((g) => ({
        infoHash: g.infoHash,
        title: g.title,
        appId: g.appId,
        total: g.total,
        earned: g.earned,
        watching: g.watching,
        lastChecked: g.lastChecked,
        detectionNote: g.detectionNote,
        unlocks: g.unlocks ?? [],
      })),
    );

    zephyr.ipc.handle('achievement-watcher:get-game', (payload) => {
      const p = asRecord(payload);
      const game = typeof p.infoHash === 'string' ? gamesCache.get(p.infoHash) : undefined;
      return game ?? null;
    });

    zephyr.ipc.handle('achievement-watcher:test-notification', () => {
      // Route the test through the service so it flows through the exact
      // same pipeline as a real unlock:
      //   service broadcasts achievement:unlock → plugin fires system
      //   toast + in-app card; widget renders its own DOM toast if pinned.
      // Silent no-op if the WS isn't connected (in which case the user
      // already sees the "Service installed but not running" banner).
      sendToService({ type: 'test:notification' });
      return { ok: !!wsReady };
    });

    zephyr.ipc.handle('achievement-watcher:rescan', (payload) => {
      const p = asRecord(payload);
      if (typeof p.infoHash === 'string') {
        sendToService({ type: 'state:request' });
        console.log(`${TAG} Manual rescan: sent state:request to service`);
        return { ok: true };
      }
      return { ok: false, error: 'Missing infoHash' };
    });

    zephyr.ipc.handle('achievement-watcher:watch-entry', async (payload) => {
      const p = asRecord(payload);
      if (typeof p.infoHash !== 'string') return { ok: false, error: 'Missing infoHash' };
      const entry = zephyr.library.get(p.infoHash);
      if (!entry) return { ok: false, error: 'Library entry not found' };
      await sendGameRegister(entry);
      return { ok: true, watching: gamesCache.has(entry.id) };
    });

    zephyr.ipc.handle('achievement-watcher:get-status', async () => {
      let serviceInstalled = false;
      let widgetInstalled = false;

      try {
        const { stdout } = await exec('powershell.exe', [
          '-NoProfile', '-Command',
          'if (Get-ScheduledTask -TaskName "ZephyrAchievementWatcher" -ErrorAction SilentlyContinue) { Write-Output "INSTALLED" }',
        ]);
        serviceInstalled = stdout.includes('INSTALLED');
      } catch {}

      try {
        const { stdout } = await exec('powershell.exe', [
          '-NoProfile', '-Command',
          'Get-AppxPackage -Name "ZephyrAchievementWatcher" | Select-Object -ExpandProperty Name',
        ]);
        widgetInstalled = stdout.trim().length > 0;
      } catch {}

      // The scheduled task action is a powershell launcher that spawns node and
      // exits — so Get-ScheduledTask's State is always "Ready" even when the
      // service is actively running. The reliable signal is whether the WS
      // client is connected (or, if not yet attempted, whether the port is held).
      const serviceRunning = wsClient != null && wsReady;

      return {
        serviceInstalled,
        serviceRunning,
        widgetInstalled,
        connected: wsClient != null && wsReady,
      };
    });

    zephyr.ipc.handle('achievement-watcher:start-service', async () => {
      try {
        const config = await readOrCreateConfig();
        await exec('powershell.exe', [
          '-NoProfile', '-Command',
          'Start-ScheduledTask -TaskName "ZephyrAchievementWatcher"',
        ]);
        const ready = await waitForServicePort(config.port, 10_000);
        if (!ready) {
          return {
            ok: false,
            error: `Task started but nothing bound 127.0.0.1:${config.port} within 10s — check Task Scheduler's Last Run Result for ZephyrAchievementWatcher.`,
          };
        }
        if (!wsClient || !wsReady) connectToService(config);
        return { ok: true };
      } catch (err) {
        console.error(`${TAG} start-service failed:`, /** @type {Error} */ (err).message);
        return { ok: false, error: /** @type {Error} */ (err).message };
      }
    });

    zephyr.ipc.handle('achievement-watcher:install-service', async () => {
      try {
        await fs.mkdir(dataDir, { recursive: true });
        const config = await readOrCreateConfig();
        const servicePath = path.join(__pluginDir, 'service', 'index.js');

        // Find node.exe on PATH — Electron's bundled node can't run standalone.
        let nodeExe = 'node';
        try {
          const { stdout } = await exec('where.exe', ['node']);
          nodeExe = stdout.trim().split(/\r?\n/)[0]?.trim() ?? 'node';
        } catch {}

        // Task Scheduler launches via a VBS launcher (wscript.exe //B //NoLogo):
        //   Execute:  wscript.exe
        //   Argument: //B //NoLogo "<launcherPath>"
        //
        // The VBS runs node.exe with WshShell.Run window-style 0 (hidden) and
        // bWaitOnReturn=True so wscript.exe stays alive while the service runs.
        // Task Scheduler can then detect exit/failure and apply the restart policy.
        // Using wscript.exe avoids the console window that node.exe (a console
        // subsystem app) would otherwise get when Task Scheduler spawns it in the
        // interactive session — that window would stay open for the life of the
        // service, which is what the user sees as "PowerShell staying open".
        //
        // Task settings:
        //   AtLogon trigger                 → auto-starts at every sign-in
        //   ExecutionTimeLimit 0            → never time-sliced out
        //   RestartCount 3 / 1 min          → respawn if node exits non-zero
        //   DontStopIfGoingOnBatteries etc. → keep running on laptops
        //   MultipleInstances IgnoreNew     → avoid double-bind on port 37265
        const launcherPath = path.join(dataDir, 'launch-service.vbs');
        const safeNode = nodeExe.replace(/"/g, '""');
        const safeSvc = servicePath.replace(/"/g, '""');
        const safeData = dataDir.replace(/"/g, '""');
        const vbsContent = [
          'Set WshShell = CreateObject("WScript.Shell")',
          // Window style 0 = hidden; True = wait for node to exit so Task Scheduler
          // tracks the real process lifetime and can restart on failure.
          `WshShell.Run Chr(34) & "${safeNode}" & Chr(34) & " " & Chr(34) & "${safeSvc}" & Chr(34) & " " & Chr(34) & "${safeData}" & Chr(34), 0, True`,
        ].join('\r\n');
        await fs.writeFile(launcherPath, vbsContent, 'utf8');

        const wscriptArg = `//B //NoLogo "${launcherPath}"`;
        const registerCmd = [
          '$n = "ZephyrAchievementWatcher"',
          `$exe = 'wscript.exe'`,
          `$arg = '${wscriptArg.replace(/'/g, "''")}'`,
          '$a = New-ScheduledTaskAction -Execute $exe -Argument $arg',
          '$t = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME',
          '$s = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Seconds 0) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable',
          '$p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited',
          'Register-ScheduledTask -TaskName $n -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null',
          'Start-ScheduledTask -TaskName $n',
        ].join('; ');

        // Clean up any legacy PS launcher from older installs so config.json is
        // the only source of truth for the token going forward.
        await fs
          .rm(path.join(dataDir, 'service-run.ps1'), { force: true })
          .catch(() => undefined);

        await exec('powershell.exe', ['-NoProfile', '-Command', registerCmd]);

        // Wait up to 10s for the service to actually come up (port 37265 bound).
        // Task scheduler returns immediately after spawning the launcher, so we
        // need to verify the node process is alive and listening — otherwise
        // the UI would claim "running" while the WS connect is about to fail.
        const ready = await waitForServicePort(config.port, 10_000);
        if (!ready) {
          return {
            ok: false,
            error: `Service installed but did not bind 127.0.0.1:${config.port} within 10s — check Task Scheduler's "Last Run Result" for ZephyrAchievementWatcher.`,
          };
        }

        connectToService(config);
        return { ok: true };
      } catch (err) {
        console.error(`${TAG} install-service failed:`, /** @type {Error} */ (err).message);
        return { ok: false, error: /** @type {Error} */ (err).message };
      }
    });

    zephyr.ipc.handle('achievement-watcher:install-widget', async () => {
      try {
        const cerPath = path.join(__pluginDir, 'widget', 'AchievementWidget.cer');
        // Packaged: widget/AchievementWidget.msix — dev fallback: build output
        let appxPath = path.join(__pluginDir, 'widget', 'AchievementWidget.msix');
        if (!await fs.access(appxPath).then(() => true).catch(() => false)) {
          const buildOut = path.join(__pluginDir, 'widget', 'AchievementWidget', 'bin');
          const found = await findMsix(buildOut);
          if (found) appxPath = found;
        }
        const configPath = path.join(dataDir, 'config.json');

        // Elevated script:
        // 1. Import cert → Trusted Root (needs admin)
        // 2. Install MSIX via Add-AppxPackage
        // 3. Query real PFN → CheckNetIsolation loopback exemption
        // 4. Copy config.json to widget's LocalState
        const resultPath = path.join(app.getPath('temp'), `aw-widget-result-${Date.now()}.txt`);
        const ps1Lines = [
          `$result = '${resultPath.replace(/'/g, "''")}'`,
          'try {',
          '  $ErrorActionPreference = "Stop"',
          `  Import-Certificate -FilePath '${cerPath.replace(/'/g, "''")}' -CertStoreLocation Cert:\\LocalMachine\\Root | Out-Null`,
          `  Add-AppxPackage -Path '${appxPath.replace(/'/g, "''")}'`,
          '  $pfn = (Get-AppxPackage -Name "ZephyrAchievementWatcher").PackageFamilyName',
          '  if ($pfn) {',
          '    CheckNetIsolation.exe LoopbackExempt -a -n="$pfn" | Out-Null',
          '    $ls = "$env:LOCALAPPDATA\\Packages\\$pfn\\LocalState"',
          '    New-Item -ItemType Directory -Force -Path $ls | Out-Null',
          `    Copy-Item -Path '${configPath.replace(/'/g, "''")}' -Destination "$ls\\config.json" -Force`,
          '  }',
          '  Set-Content -Path $result -Value "OK"',
          '} catch {',
          '  Set-Content -Path $result -Value $_.Exception.Message',
          '}',
        ].join('\r\n');

        const tmp = path.join(app.getPath('temp'), `aw-widget-${Date.now()}.ps1`);
        await fs.writeFile(tmp, ps1Lines, 'utf8');
        try {
          // Use array form for -ArgumentList to avoid path-quoting issues
          await exec('powershell.exe', [
            '-NoProfile', '-Command',
            `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${tmp.replace(/'/g, "''")}')`,
          ]);
        } finally {
          await fs.rm(tmp, { force: true }).catch(() => {});
        }

        const result = await fs.readFile(resultPath, 'utf8').catch(() => 'No output from install script');
        await fs.rm(resultPath, { force: true }).catch(() => {});
        if (result.trim() !== 'OK') {
          console.error(`${TAG} install-widget elevated script failed:`, result.trim());
          return { ok: false, error: result.trim() };
        }

        console.log(`${TAG} Widget installed successfully`);
        return { ok: true };
      } catch (err) {
        console.error(`${TAG} install-widget failed:`, /** @type {Error} */ (err).message);
        return { ok: false, error: /** @type {Error} */ (err).message };
      }
    });

    // ── Hooks ────────────────────────────────────────────────────────────────

    zephyr.hooks.onAppReady(async () => {
      const config = await readOrCreateConfig().catch((err) => {
        console.error(`${TAG} readOrCreateConfig failed:`, err.message);
        return null;
      });

      if (config) {
        connectToService(config);
      }

      const { entries } = zephyr.library.list(1, 500);
      const verified = entries.filter((e) => e.installStatus === 'verified');
      console.log(`${TAG} onAppReady: ${entries.length} library entries, ${verified.length} verified`);
      for (const entry of verified) {
        await sendGameRegister(entry).catch((err) => {
          console.error(`${TAG} sendGameRegister failed for "${entry.releaseTitle}":`, err.message);
        });
      }
    });

    zephyr.hooks.onLibraryEntryComplete(async (entry) => {
      console.log(`${TAG} onLibraryEntryComplete: "${entry.releaseTitle}" status=${entry.installStatus}`);
      if (wsReady) {
        await sendGameRegister(entry).catch((err) => {
          console.error(`${TAG} sendGameRegister failed for "${entry.releaseTitle}":`, err.message);
        });
      }
    });

    zephyr.hooks.onUninstall(async () => {
      console.log(`${TAG} onUninstall: tearing down service + widget`);

      // Close the WS client so the plugin stops holding a connection.
      try {
        if (wsClient) wsClient.close();
      } catch {}
      wsClient = null;
      wsReady = false;

      // Unregister the scheduled task (per-user; no elevation needed).
      try {
        await exec('powershell.exe', [
          '-NoProfile', '-Command',
          'Stop-ScheduledTask -TaskName "ZephyrAchievementWatcher" -ErrorAction SilentlyContinue; ' +
            'Unregister-ScheduledTask -TaskName "ZephyrAchievementWatcher" -Confirm:$false -ErrorAction SilentlyContinue',
        ]);
        console.log(`${TAG} Scheduled task removed`);
      } catch (err) {
        console.error(`${TAG} Failed to unregister scheduled task:`, /** @type {Error} */ (err).message);
      }

      // Uninstall the widget MSIX + drop loopback exemption. Needs elevation.
      // Skipped silently if the package is not installed.
      try {
        const { stdout } = await exec('powershell.exe', [
          '-NoProfile', '-Command',
          '(Get-AppxPackage -Name "ZephyrAchievementWatcher" | Select-Object -First 1 -ExpandProperty PackageFamilyName)',
        ]);
        const pfn = stdout.trim();
        if (pfn) {
          const ps1Lines = [
            '$ErrorActionPreference = "SilentlyContinue"',
            'Get-AppxPackage -Name "ZephyrAchievementWatcher" | Remove-AppxPackage',
            `CheckNetIsolation.exe LoopbackExempt -d -n="${pfn}" | Out-Null`,
          ].join('\r\n');
          const tmp = path.join(app.getPath('temp'), `aw-uninstall-${Date.now()}.ps1`);
          await fs.writeFile(tmp, ps1Lines, 'utf8');
          try {
            await exec('powershell.exe', [
              '-NoProfile', '-Command',
              `Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${tmp.replace(/'/g, "''")}')`,
            ]);
            console.log(`${TAG} Widget MSIX uninstalled`);
          } finally {
            await fs.rm(tmp, { force: true }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`${TAG} Failed to uninstall widget:`, /** @type {Error} */ (err).message);
      }

      // Remove the plugin's external data directory (config.json, cached game state).
      try {
        await fs.rm(dataDir, { recursive: true, force: true });
        console.log(`${TAG} Data directory removed`);
      } catch (err) {
        console.error(`${TAG} Failed to remove dataDir:`, /** @type {Error} */ (err).message);
      }
    });

    // ── Game register helper ──────────────────────────────────────────────────

    /** @param {import('../zephyr-plugin').LibraryEntry} entry */
    async function sendGameRegister(entry) {
      const dir = entry.savePath || (entry.executablePath ? path.dirname(entry.executablePath) : null);
      if (!dir) {
        console.warn(`${TAG} "${entry.releaseTitle}" has no savePath or executablePath — cannot register`);
        return;
      }

      const appId = await findSteamAppId(dir, entry.executablePath, entry.releaseTitle);
      const steamApiKey = String(zephyr.settings.get('steamApiKey') ?? '');

      if (!gamesCache.has(entry.id)) {
        gamesCache.set(entry.id, {
          infoHash: entry.id,
          title: entry.releaseTitle,
          appId,
          total: 0,
          earned: 0,
          watching: false,
          lastChecked: null,
          detectionNote: null,
        });
      }

      sendToService({
        type: 'game:register',
        infoHash: entry.id,
        title: entry.releaseTitle,
        savePath: dir,
        executablePath: entry.executablePath,
        steamAppId: appId,
        steamApiKey: steamApiKey || undefined,
      });
    }

    // ── Discovery ────────────────────────────────────────────────────────────

    /**
     * @param {string} installDir
     * @param {string | undefined} executablePath
     * @returns {string[]}
     */
    function buildSearchDirs(installDir, executablePath) {
      const dirs = [installDir];
      if (executablePath) {
        const exeDir = path.dirname(executablePath);
        if (exeDir !== installDir) dirs.push(exeDir);
        const parent = path.dirname(exeDir);
        if (parent !== installDir && parent !== exeDir) dirs.push(parent);
      }
      return dirs;
    }

    /**
     * @param {string} installDir
     * @param {string | undefined} executablePath
     * @param {string} title
     * @returns {Promise<number | null>}
     */
    async function findSteamAppId(installDir, executablePath, title) {
      const searchDirs = buildSearchDirs(installDir, executablePath);

      for (const dir of searchDirs) {
        for (const rel of ['steam_appid.txt', 'steam_settings/steam_appid.txt']) {
          try {
            const raw = await fs.readFile(path.join(dir, rel), 'utf8');
            const id = parseInt(raw.trim(), 10);
            if (!isNaN(id) && id > 0) {
              console.log(`${TAG} AppID ${id} from ${path.join(dir, rel)}`);
              return id;
            }
          } catch {}
        }
      }

      for (const dir of searchDirs) {
        try {
          const files = await fs.readdir(dir);
          for (const file of files) {
            if (!file.toLowerCase().endsWith('.ini')) continue;
            try {
              const content = await fs.readFile(path.join(dir, file), 'utf8');
              const m = content.match(/\bAppId\s*=\s*(\d{4,10})/i);
              if (m) {
                const id = parseInt(m[1], 10);
                if (!isNaN(id) && id > 0) {
                  console.log(`${TAG} AppID ${id} from ${path.join(dir, file)} (ini)`);
                  return id;
                }
              }
            } catch {}
          }
        } catch {}
      }

      console.log(`${TAG} AppID not found locally for "${title}", trying Steam store search`);
      return searchSteamForAppId(title);
    }

    /** @param {string} title @returns {Promise<number | null>} */
    async function searchSteamForAppId(title) {
      const { net } = await import('electron');
      try {
        const res = await net.fetch(
          `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`,
        );
        if (!res.ok) {
          console.warn(`${TAG} Steam store search HTTP ${res.status} for "${title}"`);
          return null;
        }
        const data = /** @type {any} */ (await res.json());
        if (Array.isArray(data?.items) && data.items.length > 0) {
          const id = typeof data.items[0].id === 'number' ? data.items[0].id : null;
          console.log(`${TAG} Steam store search "${title}" → appId=${id ?? 'none'} (top result: "${data.items[0].name}")`);
          return id;
        }
        console.log(`${TAG} Steam store search "${title}" → no results`);
      } catch (err) {
        console.warn(`${TAG} Steam store search failed for "${title}":`, /** @type {Error} */ (err).message);
      }
      return null;
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    /** @param {unknown} v @returns {Record<string, unknown>} */
    function asRecord(v) {
      return v != null && typeof v === 'object' ? /** @type {any} */ (v) : {};
    }

    /**
     * Poll 127.0.0.1:<port> until something is listening or the timeout elapses.
     * Returns true on first successful TCP handshake, false if the timeout hits first.
     * @param {number} port
     * @param {number} timeoutMs
     */
    async function waitForServicePort(port, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const ok = await new Promise((resolve) => {
          const sock = net.connect({ host: '127.0.0.1', port }, () => {
            sock.end();
            resolve(true);
          });
          sock.once('error', () => resolve(false));
          sock.setTimeout(500, () => {
            sock.destroy();
            resolve(false);
          });
        });
        if (ok) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    }

    /** Recursively find the first .msix file under a directory. @returns {Promise<string|null>} */
    async function findMsix(/** @type {string} */ dir) {
      /** @type {string|null} */
      let result = null;
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
      for (const e of entries) {
        if (e.isDirectory()) {
          result = await findMsix(path.join(dir, e.name));
          if (result) return result;
        } else if (e.name.endsWith('.msix')) {
          return path.join(dir, e.name);
        }
      }
      return null;
    }
  },
};
