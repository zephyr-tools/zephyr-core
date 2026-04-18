// @ts-check
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {{ name: string; displayName: string; description: string; icon?: string; iconGray?: string; hidden: boolean }} SchemaDef
 * @typedef {{ id: string; displayName: string; description: string; iconUrl: string | null; earned: boolean; unlockedAt: number | null }} AchievementUnlock
 * @typedef {{ infoHash: string; title: string; savePath: string; executablePath?: string; appId: number | null; schema: SchemaDef[]; unlocks: AchievementUnlock[]; achievementFiles: string[]; watching: boolean; lastChecked: number | null; detectionNote: string | null }} WatchedGame
 * @typedef {{ gameTitle: string; appId: number | null; achievementId: string; achievementName: string; achievementDesc: string; iconUrl: string | null; unlockedAt: number | null }} AchievementNotification
 */

const TAG = '[achievement-watcher]';

/** @type {import('../zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Achievement Watcher',
  version: '1.0.0',
  setup(zephyr) {
    zephyr.settings.register({
      key: 'steamApiKey',
      label: 'Steam API Key',
      type: 'password',
      hint: 'Required to fetch achievement names and icons. Get yours at steamcommunity.com/dev/apikey',
    });

    /** @type {Map<string, WatchedGame>} */
    const games = new Map();

    /** @type {AchievementNotification[]} */
    const pendingNotifications = [];

    /** @type {Map<string, import('node:fs').FSWatcher[]>} */
    const activeWatchers = new Map();

    // ── IPC handlers ────────────────────────────────────────────────────────

    zephyr.ipc.handle('achievement-watcher:get-all', () =>
      [...games.values()].map((g) => ({
        infoHash: g.infoHash,
        title: g.title,
        appId: g.appId,
        total: g.schema.length,
        earned: g.unlocks.filter((u) => u.earned).length,
        unlocks: g.unlocks,
        watching: g.watching,
        lastChecked: g.lastChecked,
        detectionNote: g.detectionNote,
      })),
    );

    zephyr.ipc.handle('achievement-watcher:get-game', (payload) => {
      const p = asRecord(payload);
      const game = typeof p.infoHash === 'string' ? games.get(p.infoHash) : undefined;
      if (!game) return null;
      return {
        infoHash: game.infoHash,
        title: game.title,
        appId: game.appId,
        schema: game.schema,
        unlocks: game.unlocks,
        watching: game.watching,
        lastChecked: game.lastChecked,
        detectionNote: game.detectionNote,
      };
    });

    zephyr.ipc.handle('achievement-watcher:poll-notifications', () =>
      pendingNotifications.splice(0),
    );

    zephyr.ipc.handle('achievement-watcher:rescan', async (payload) => {
      const p = asRecord(payload);
      const game = typeof p.infoHash === 'string' ? games.get(p.infoHash) : undefined;
      if (!game) return { ok: false, error: 'Game not tracked' };
      console.log(`${TAG} Manual rescan requested for "${game.title}"`);
      await rescanGame(game);
      return { ok: true };
    });

    zephyr.ipc.handle('achievement-watcher:watch-entry', async (payload) => {
      const p = asRecord(payload);
      if (typeof p.infoHash !== 'string') return { ok: false, error: 'Missing infoHash' };
      const entry = zephyr.library.get(p.infoHash);
      if (!entry) return { ok: false, error: 'Library entry not found' };
      if (!games.has(entry.id)) await setupGame(entry);
      return { ok: true, watching: games.get(entry.id)?.watching ?? false };
    });

    // ── Hooks ────────────────────────────────────────────────────────────────

    zephyr.hooks.onLibraryEntryComplete(async (entry) => {
      console.log(`${TAG} onLibraryEntryComplete: "${entry.releaseTitle}" status=${entry.installStatus} exe=${entry.executablePath ?? 'none'}`);
      await setupGame(entry).catch((err) => {
        console.error(`${TAG} setupGame failed for "${entry.releaseTitle}":`, err.message);
      });
    });

    zephyr.hooks.onAppReady(async () => {
      const { entries } = zephyr.library.list(1, 500);
      const verified = entries.filter((e) => e.installStatus === 'verified');
      console.log(`${TAG} onAppReady: ${entries.length} library entries, ${verified.length} verified`);
      for (const entry of verified) {
        await setupGame(entry).catch((err) => {
          console.error(`${TAG} setupGame failed for "${entry.releaseTitle}":`, err.message);
        });
      }
    });

    // ── Core logic ───────────────────────────────────────────────────────────

    /** @param {import('../zephyr-plugin').LibraryEntry} entry */
    async function setupGame(entry) {
      if (games.has(entry.id)) {
        console.log(`${TAG} "${entry.releaseTitle}" already registered — skipping`);
        return;
      }

      const dir = entry.savePath || (entry.executablePath ? path.dirname(entry.executablePath) : null);
      if (!dir) {
        console.warn(`${TAG} "${entry.releaseTitle}" has no savePath or executablePath — cannot scan`);
        return;
      }

      console.log(`${TAG} Setting up "${entry.releaseTitle}" — dir=${dir}`);

      /** @type {WatchedGame} */
      const game = {
        infoHash: entry.id,
        title: entry.releaseTitle,
        savePath: dir,
        executablePath: entry.executablePath,
        appId: null,
        schema: [],
        unlocks: [],
        achievementFiles: [],
        watching: false,
        lastChecked: null,
        detectionNote: null,
      };

      games.set(entry.id, game);

      game.appId = await findSteamAppId(dir, entry.executablePath, entry.releaseTitle);
      console.log(`${TAG} "${entry.releaseTitle}" appId=${game.appId ?? 'not found'}`);

      const searchDirs = buildSearchDirs(dir, entry.executablePath);
      console.log(`${TAG} "${entry.releaseTitle}" searching ${searchDirs.length} dir(s):`, searchDirs);
      game.achievementFiles = await detectAchievementFiles(searchDirs, entry.releaseTitle, game.appId);
      console.log(`${TAG} "${entry.releaseTitle}" achievement files found (${game.achievementFiles.length}):`, game.achievementFiles);

      if (game.achievementFiles.length === 0 && game.appId == null) {
        game.detectionNote = 'No achievement files detected — install a Steam emulator first';
        console.warn(`${TAG} "${entry.releaseTitle}" — no achievement files and no AppID, giving up`);
        return;
      }

      await refreshSchema(game);

      game.unlocks = await parseAllAchievements(game.achievementFiles, game.schema);
      game.lastChecked = Date.now();
      console.log(`${TAG} "${entry.releaseTitle}" baseline: ${game.unlocks.filter((u) => u.earned).length}/${game.unlocks.length} earned`);

      if (game.achievementFiles.length > 0) {
        await startWatcher(game);
      }

      console.log(`${TAG} "${game.title}" ready — appId=${game.appId ?? 'none'}, files=${game.achievementFiles.length}, watching=${game.watching}, schema=${game.schema.length}`);
    }

    /** @param {WatchedGame} game */
    async function refreshSchema(game) {
      if (!game.appId) {
        console.log(`${TAG} "${game.title}" no appId — skipping schema fetch`);
        return;
      }
      if (game.schema.length > 0) return;
      const key = String(zephyr.settings.get('steamApiKey') ?? '');
      if (!key) {
        console.warn(`${TAG} "${game.title}" no Steam API key — achievement names will show as IDs`);
        return;
      }
      console.log(`${TAG} "${game.title}" fetching Steam schema for appId=${game.appId}`);
      const result = await fetchSteamSchema(game.appId, key).catch((err) => {
        console.error(`${TAG} "${game.title}" schema fetch failed:`, err.message);
        return /** @type {SchemaDef[]} */ ([]);
      });
      game.schema = result;
      console.log(`${TAG} "${game.title}" schema loaded: ${game.schema.length} achievements`);
    }

    /** @param {WatchedGame} game */
    async function rescanGame(game) {
      await refreshSchema(game);
      const prevByid = new Map(game.unlocks.map((u) => [u.id, u.earned]));
      game.unlocks = await parseAllAchievements(game.achievementFiles, game.schema);
      game.lastChecked = Date.now();

      const newUnlocks = game.unlocks.filter((u) => u.earned && !prevByid.get(u.id));
      if (newUnlocks.length > 0) {
        console.log(`${TAG} "${game.title}" ${newUnlocks.length} new unlock(s):`, newUnlocks.map((u) => u.displayName));
        for (const unlock of newUnlocks) {
          pendingNotifications.push({
            gameTitle: game.title,
            appId: game.appId,
            achievementId: unlock.id,
            achievementName: unlock.displayName,
            achievementDesc: unlock.description,
            iconUrl: unlock.iconUrl,
            unlockedAt: unlock.unlockedAt,
          });
        }
      }

      const earned = game.unlocks.filter((u) => u.earned).length;
      console.log(`${TAG} "${game.title}" rescan complete: ${earned}/${game.unlocks.length} earned`);
    }

    /** @param {WatchedGame} game */
    async function startWatcher(game) {
      const { watch } = await import('node:fs');
      const dirs = [...new Set(game.achievementFiles.map((f) => path.dirname(f)))];

      /** @type {ReturnType<typeof setTimeout> | null} */
      let debounce = null;
      const onChange = (/** @type {string} */ eventType, /** @type {string | null} */ filename) => {
        console.log(`${TAG} "${game.title}" fs event: ${eventType} ${filename ?? ''}`);
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          debounce = null;
          rescanGame(game).catch((err) =>
            console.error(`${TAG} "${game.title}" rescan error:`, err.message),
          );
        }, 600);
      };

      const watchers = dirs
        .map((dir) => {
          try {
            const w = watch(dir, { recursive: false }, onChange);
            console.log(`${TAG} "${game.title}" watching dir: ${dir}`);
            return w;
          } catch (err) {
            console.warn(`${TAG} "${game.title}" failed to watch dir ${dir}:`, /** @type {Error} */ (err).message);
            return null;
          }
        })
        .filter(/** @returns {x is import('node:fs').FSWatcher} */ (x) => x != null);

      if (watchers.length > 0) {
        game.watching = true;
        activeWatchers.set(game.infoHash, watchers);
      } else {
        console.warn(`${TAG} "${game.title}" could not start any file watchers`);
      }
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

    /**
     * @param {string[]} searchDirs
     * @param {string} title
     * @param {number | null} appId
     * @returns {Promise<string[]>}
     */
    async function detectAchievementFiles(searchDirs, title, appId) {
      const found = /** @type {string[]} */ ([]);

      for (const dir of searchDirs) {
        const candidates = [
          'steam_settings/achievements.json',
          'achievements.json',
          'achievements.ini',
          'CODEX/achievements.ini',
          'CODEX/achievements.json',
          'ALI213.ini',
          'valve.ini',
          'SteamConfig.ini',
          'cream_api.ini',
          ...(appId ? [`steam_settings/${appId}.json`] : []),
        ];

        for (const rel of candidates) {
          const full = path.join(dir, rel);
          try {
            await fs.access(full);
            if (!found.includes(full)) {
              console.log(`${TAG} Found achievement file: ${full}`);
              found.push(full);
            }
          } catch {}
        }

        try {
          const dirents = await fs.readdir(dir, { withFileTypes: true });
          for (const dirent of dirents) {
            if (!dirent.isDirectory()) continue;
            if (!/^(codex|empress|steam|steam_settings|emu|crack|ali213|goldberg|skidrow|rld|reloaded)$/i.test(dirent.name)) continue;
            for (const rel of ['achievements.ini', 'achievements.json']) {
              const full = path.join(dir, dirent.name, rel);
              try {
                await fs.access(full);
                if (!found.includes(full)) {
                  console.log(`${TAG} Found achievement file (subdir): ${full}`);
                  found.push(full);
                }
              } catch {}
            }
          }
        } catch {}

        // Deep recursive search for named emulator configs buried in subdirs
        // (e.g. tenoke.ini at Bo_Data/Plugins/x86_64/tenoke.ini)
        for (const target of ['tenoke.ini', 'hiu.ini', 'rune.ini']) {
          await findNamedRecursive(dir, target, 5, found);
        }
      }

      if (found.length === 0) {
        const geminiKey = String(zephyr.app.getSettings().geminiApiKey ?? '');
        if (geminiKey) {
          console.log(`${TAG} Pattern matching found nothing for "${title}" — asking Gemini`);
          const geminiCandidates = await geminiDetectAchievementFiles(searchDirs, title, geminiKey);
          console.log(`${TAG} Gemini suggested ${geminiCandidates.length} file(s) for "${title}":`, geminiCandidates);
          for (const f of geminiCandidates) {
            if (!found.includes(f)) found.push(f);
          }
        } else {
          console.log(`${TAG} Pattern matching found nothing for "${title}" and no Gemini key set`);
        }
      }

      return found;
    }

    /**
     * @param {string[]} searchDirs
     * @param {string} title
     * @param {string} apiKey
     * @returns {Promise<string[]>}
     */
    async function geminiDetectAchievementFiles(searchDirs, title, apiKey) {
      const { net } = await import('electron');
      const listings = [];

      for (const dir of searchDirs) {
        try {
          const dirents = await fs.readdir(dir, { withFileTypes: true });
          const lines = dirents.map((d) => (d.isDirectory() ? `[dir] ${d.name}` : d.name)).join('\n');
          listings.push(`Directory: ${dir}\n${lines}`);
          for (const dirent of dirents) {
            if (!dirent.isDirectory()) continue;
            try {
              const sub = await fs.readdir(path.join(dir, dirent.name));
              listings.push(`Directory: ${path.join(dir, dirent.name)}\n${sub.join('\n')}`);
            } catch {}
          }
        } catch {}
      }

      if (listings.length === 0) {
        console.warn(`${TAG} Gemini: could not read any directories for "${title}"`);
        return [];
      }

      const prompt = `You are analyzing the install directory of the PC game "${title}" to find achievement tracking files used by Steam emulators (Goldberg, CODEX, ALI213, SmartSteamEmu, CreamAPI, EMPRESS).

Directory listings:

${listings.join('\n\n')}

Identify files that are likely Steam achievement tracking files. These are typically named:
- achievements.json, achievements.ini (in game root or an emulator sub-directory)
- <numeric AppID>.json (a numeric filename in steam_settings/)
- ALI213.ini, valve.ini, SteamConfig.ini, cream_api.ini
- Files inside folders named codex, goldberg, steam_settings, steam, emu, etc.

Return ONLY a JSON array of absolute file paths. If none are likely, return []. No explanation, no markdown.`;

      try {
        const res = await net.fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0 },
            }),
          },
        );
        if (!res.ok) {
          console.error(`${TAG} Gemini HTTP ${res.status} for "${title}"`);
          return [];
        }
        const data = /** @type {any} */ (await res.json());
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          console.warn(`${TAG} Gemini returned non-array for "${title}":`, text);
          return [];
        }

        const verified = [];
        for (const f of parsed) {
          if (typeof f !== 'string') continue;
          try {
            await fs.access(f);
            verified.push(f);
          } catch {
            console.warn(`${TAG} Gemini suggested "${f}" but it does not exist`);
          }
        }
        return verified;
      } catch (err) {
        console.error(`${TAG} Gemini request failed for "${title}":`, /** @type {Error} */ (err).message);
        return [];
      }
    }

    // ── Achievement parsing ───────────────────────────────────────────────────

    /**
     * @param {string[]} files
     * @param {SchemaDef[]} schema
     * @returns {Promise<AchievementUnlock[]>}
     */
    async function parseAllAchievements(files, schema) {
      /** @type {Map<string, AchievementUnlock>} */
      const byId = new Map();

      for (const file of files) {
        try {
          const ext = path.extname(file).toLowerCase();
          const parsed =
            ext === '.json'
              ? await parseJsonAchievements(file, schema)
              : await parseIniAchievements(file, schema);
          console.log(`${TAG} Parsed ${parsed.length} entries from ${file} (${parsed.filter((a) => a.earned).length} earned)`);
          for (const ach of parsed) {
            const existing = byId.get(ach.id);
            if (!existing || (ach.earned && !existing.earned)) {
              byId.set(ach.id, ach);
            }
          }
        } catch (err) {
          console.error(`${TAG} Failed to parse ${file}:`, /** @type {Error} */ (err).message);
        }
      }

      for (const def of schema) {
        if (!byId.has(def.name)) {
          byId.set(def.name, {
            id: def.name,
            displayName: def.displayName,
            description: def.description,
            iconUrl: def.icon ?? null,
            earned: false,
            unlockedAt: null,
          });
        }
      }

      return [...byId.values()];
    }

    /**
     * @param {string} file
     * @param {SchemaDef[]} schema
     * @returns {Promise<AchievementUnlock[]>}
     */
    async function parseJsonAchievements(file, schema) {
      const raw = /** @type {Record<string, unknown>} */ (JSON.parse(await fs.readFile(file, 'utf8')));
      return Object.entries(raw).map(([id, data]) => {
        const d = /** @type {Record<string, unknown>} */ (data ?? {});
        const def = schema.find((s) => s.name === id);
        return {
          id,
          displayName: def?.displayName ?? id,
          description: def?.description ?? '',
          iconUrl: def?.icon ?? null,
          earned: !!(d.earned || d.achieved || d.Achieved),
          unlockedAt:
            typeof d.earned_time === 'number'
              ? d.earned_time
              : typeof d.unlock_time === 'number'
                ? d.unlock_time
                : typeof d.UnlockTime === 'number'
                  ? d.UnlockTime
                  : null,
        };
      });
    }

    /**
     * @param {string} file
     * @param {SchemaDef[]} schema
     * @returns {Promise<AchievementUnlock[]>}
     */
    async function parseIniAchievements(file, schema) {
      const content = await fs.readFile(file, 'utf8');
      const results = [];
      const sectionRe = /^\[([^\]]+)\]\s*$([\s\S]*?)(?=^\[[^\]]+\]|\s*$)/gm;
      let m;
      while ((m = sectionRe.exec(content)) !== null) {
        const name = m[1].trim();
        const body = m[2];
        if (!/Achieved\s*=/i.test(body)) continue;
        const earned = /Achieved\s*=\s*1/i.test(body);
        const timeMatch = body.match(/UnlockTime\s*=\s*(\d+)/i);
        const def = schema.find((s) => s.name === name);
        results.push({
          id: name,
          displayName: def?.displayName ?? name,
          description: def?.description ?? '',
          iconUrl: def?.icon ?? null,
          earned,
          unlockedAt: timeMatch ? parseInt(timeMatch[1], 10) : null,
        });
      }
      return results;
    }

    /**
     * Recursively search `dir` up to `depth` levels deep for a file named `target`.
     * Appends found absolute paths to `out`, skipping duplicates.
     * @param {string} dir
     * @param {string} target
     * @param {number} depth
     * @param {string[]} out
     */
    async function findNamedRecursive(dir, target, depth, out) {
      if (depth <= 0) return;
      let dirents;
      try {
        dirents = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const dirent of dirents) {
        const full = path.join(dir, dirent.name);
        if (dirent.isFile() && dirent.name.toLowerCase() === target.toLowerCase()) {
          if (!out.includes(full)) {
            console.log(`${TAG} Found achievement file (recursive): ${full}`);
            out.push(full);
          }
        } else if (dirent.isDirectory()) {
          await findNamedRecursive(full, target, depth - 1, out);
        }
      }
    }

    // ── Steam API ────────────────────────────────────────────────────────────

    /**
     * @param {number} appId
     * @param {string} apiKey
     * @returns {Promise<SchemaDef[]>}
     */
    async function fetchSteamSchema(appId, apiKey) {
      const { net } = await import('electron');
      const res = await net.fetch(
        `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey}&appid=${appId}&l=english`,
      );
      if (!res.ok) {
        console.error(`${TAG} Steam schema HTTP ${res.status} for appId=${appId}`);
        return [];
      }
      const data = /** @type {any} */ (await res.json());
      const raw = data?.game?.availableGameStats?.achievements ?? [];
      return raw.map(
        /** @param {any} a */ (a) => ({
          name: String(a.name),
          displayName: String(a.displayName ?? a.name),
          description: String(a.description ?? ''),
          icon: typeof a.icon === 'string' ? a.icon : undefined,
          iconGray: typeof a.icongray === 'string' ? a.icongray : undefined,
          hidden: a.hidden === 1,
        }),
      );
    }

    // ── Utility ──────────────────────────────────────────────────────────────

    /** @param {unknown} v @returns {Record<string, unknown>} */
    function asRecord(v) {
      return v != null && typeof v === 'object' ? /** @type {any} */ (v) : {};
    }
  },
};
