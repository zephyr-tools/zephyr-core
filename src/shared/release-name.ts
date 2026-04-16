/**
 * Heuristic parser that turns scene release names into something a human (and
 * an AI image search) will recognize. Pure functions only — used in both
 * processes.
 */

const TAG_PATTERN =
  /\b(MULTi\d*|REPACK|PROPER|INTERNAL|UPDATE|HOTFIX|DLC|GOTY|REMASTERED|REMASTER|DELUXE|EDITION|COMPLETE|FULL|UNCUT|EXTENDED|DIRECTORS\.?CUT|RIP|GOG|STEAM|EPIC|UPLAY|ORIGIN|DENUVO|EMPRESS|FLT|DARKSiDERS|DARKZER0|TINYISO|PLAZA|CODEX|SKIDROW|RELOADED|HOODLUM|ANOMALY|DODI|FITGIRL|ELAMIGOS|MACOS|LINUX|OSX|WIN64|X64|X86|VR|VR\.READY|EARLY\.ACCESS|BETA|ALPHA|UPDATE\.\w+|v\d[\w.+-]*)\b/i;

const PLATFORM_PATTERN =
  /\b(PSP|PS[12345]|XBOX(?:360|ONE|X|S)?|XB[OX1S]+|NSW|SWITCH|3DS|NDS|WII|WIIU|GC|N64|GBA|GBC|GB|XBLA|PSN|EBOOK|BLURAY|TV|S\d{2}E\d{2}|HDTV|WEB[-.]?DL|WEBRIP|BDRIP|DVDRIP|HDR|2160P|1080P|720P|480P|H264|H265|HEVC|x264|x265)\b/i;

/** Strip the `-GROUP` suffix and return the bare name + group, if any. */
export function splitGroup(name: string): { stem: string; group: string | null } {
  const idx = name.lastIndexOf('-');
  if (idx === -1) return { stem: name, group: null };
  const group = name.slice(idx + 1).trim();
  // Real groups are short alphanumerics. If it looks like a date or sentence, ignore.
  if (!/^[A-Za-z0-9._]{2,20}$/.test(group)) return { stem: name, group: null };
  return { stem: name.slice(0, idx), group };
}

/**
 * Extract a friendly title from a scene release name.
 * Examples:
 *   `Some.Game.MULTi5-RELOADED` -> `Some Game`
 *   `Cyberpunk.2077.v2.1-FLT`   -> `Cyberpunk 2077`
 */
export function parseTitle(name: string): string {
  const { stem } = splitGroup(name);
  const tokens = stem.split(/[._\s]+/);

  const out: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    if (TAG_PATTERN.test(token)) break;
    if (PLATFORM_PATTERN.test(token)) break;
    out.push(token);
  }

  // If we stripped everything, fall back to the original stem.
  const cleaned = out.length > 0 ? out.join(' ') : stem.replace(/[._]+/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

/** Stable, URL-safe id derived from the release name (used when the source has no id). */
export function releaseIdFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return `r${(hash >>> 0).toString(36)}`;
}
