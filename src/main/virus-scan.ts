import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ScanStatus } from '@shared/types';
import { net } from 'electron';

const DEFENDER_PATH = 'C:\\Program Files\\Windows Defender\\MpCmdRun.exe';
const VT_API_BASE = 'https://www.virustotal.com/api/v3';

/** Extensions worth hash-checking on VirusTotal. */
const EXECUTABLE_EXTS = new Set([
  '.exe',
  '.msi',
  '.bat',
  '.cmd',
  '.ps1',
  '.dll',
  '.scr',
  '.com',
  '.vbs',
  '.js',
  '.wsf',
]);

export interface ScanResult {
  status: ScanStatus;
  info?: string;
}

// ---- Windows Defender -----------------------------------------------------

async function defenderAvailable(): Promise<boolean> {
  try {
    await fsp.access(DEFENDER_PATH, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function scanWithDefender(targetPath: string): Promise<ScanResult> {
  if (!(await defenderAvailable())) {
    return { status: 'error', info: 'Windows Defender not found' };
  }

  return new Promise((resolve) => {
    execFile(
      DEFENDER_PATH,
      ['-Scan', '-ScanType', '3', '-File', targetPath, '-DisableRemediation'],
      { timeout: 300_000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (!error) {
          resolve({ status: 'clean' });
        } else if ((error as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
          resolve({ status: 'error', info: 'Defender scan timed out' });
        } else {
          const code = error.code as unknown as number;
          if (code === 2) {
            // Parse threat details from stdout
            const details = parseDefenderOutput(stdout);
            resolve({ status: 'threat', info: details });
          } else {
            resolve({ status: 'clean' });
          }
        }
      },
    );
  });
}

/** Extract threat names and file paths from MpCmdRun stdout. */
function parseDefenderOutput(stdout: string): string {
  const threats: string[] = [];
  const lines = stdout.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    // MpCmdRun outputs "Threat  : ThreatName"
    const threatMatch = /^Threat\s*:\s*(.+)/i.exec(line);
    if (threatMatch?.[1]) {
      const name = threatMatch[1].trim();
      // Look ahead for the file path
      const fileLine = lines[i + 1]?.trim() ?? '';
      const fileMatch = /^file\s*:\s*(.+)/i.exec(fileLine);
      const file = fileMatch?.[1]?.trim();
      threats.push(file ? `${name} in ${path.basename(file)}` : name);
    }
  }
  if (threats.length > 0) {
    return `Windows Defender: ${threats.join('; ')}`;
  }
  return 'Windows Defender detected a threat';
}

// ---- VirusTotal hash lookup -----------------------------------------------

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk: Buffer) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

interface VtEngineResult {
  category: string;
  engine_name: string;
  result: string | null;
}

interface VtResponse {
  data?: {
    attributes?: {
      last_analysis_stats?: {
        malicious?: number;
        suspicious?: number;
        undetected?: number;
      };
      last_analysis_results?: Record<string, VtEngineResult>;
    };
  };
}

async function checkVirusTotalHash(
  sha256: string,
  apiKey: string,
  fileName: string,
): Promise<ScanResult | null> {
  const res = await net.fetch(`${VT_API_BASE}/files/${sha256}`, {
    headers: { 'x-apikey': apiKey },
  });

  if (res.status === 404) return null; // Not in VT database — skip
  if (!res.ok) return null; // API error — don't block on this

  const body = (await res.json()) as VtResponse;
  const attrs = body.data?.attributes;
  const stats = attrs?.last_analysis_stats;
  const malicious = (stats?.malicious ?? 0) + (stats?.suspicious ?? 0);
  const total = malicious + (stats?.undetected ?? 0);

  if (malicious > 0) {
    // Extract the top detections: engine → threat name
    const detections: string[] = [];
    const results = attrs?.last_analysis_results;
    if (results) {
      for (const [, engine] of Object.entries(results)) {
        if (
          (engine.category === 'malicious' || engine.category === 'suspicious') &&
          engine.result
        ) {
          detections.push(`${engine.engine_name}: ${engine.result}`);
        }
      }
    }
    const top = detections.slice(0, 5).join('; ');
    const suffix = detections.length > 5 ? ` (+${detections.length - 5} more)` : '';
    return {
      status: 'threat',
      info: `VirusTotal: ${malicious}/${total} detections in ${fileName} — ${top}${suffix}`,
    };
  }

  return { status: 'clean' };
}

async function checkVirusTotal(targetPath: string, apiKey: string): Promise<ScanResult | null> {
  const stat = await fsp.stat(targetPath).catch(() => null);
  if (!stat) return null;

  const filesToCheck: string[] = [];

  if (stat.isDirectory()) {
    const entries = await fsp.readdir(targetPath, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && EXECUTABLE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        filesToCheck.push(path.join(entry.parentPath, entry.name));
      }
    }
  } else if (EXECUTABLE_EXTS.has(path.extname(targetPath).toLowerCase())) {
    filesToCheck.push(targetPath);
  }

  // Check up to 5 executables (rate-limit friendly for VT free tier)
  for (const file of filesToCheck.slice(0, 5)) {
    const hash = await sha256File(file);
    const result = await checkVirusTotalHash(hash, apiKey, path.basename(file));
    if (result?.status === 'threat') return result;
  }

  return filesToCheck.length > 0 ? { status: 'clean' } : null;
}

// ---- Public entry point ---------------------------------------------------

export async function scanDownload(
  savePath: string,
  name: string,
  vtApiKey: string | null,
): Promise<ScanResult> {
  const targetPath = path.join(savePath, name);

  // 1. Windows Defender — always runs, scans entire directory tree
  const defenderResult = await scanWithDefender(targetPath).catch(
    (): ScanResult => ({ status: 'error', info: 'Defender scan failed' }),
  );

  if (defenderResult.status === 'threat') return defenderResult;

  // 2. VirusTotal hash check — only if API key is set & Defender passed
  if (vtApiKey) {
    try {
      const vtResult = await checkVirusTotal(targetPath, vtApiKey);
      if (vtResult?.status === 'threat') return vtResult;

      // Combine both results into the info string
      const vtClean = vtResult?.status === 'clean';
      return {
        status: defenderResult.status === 'clean' ? 'clean' : defenderResult.status,
        info: vtClean ? 'Defender + VirusTotal: clean' : (defenderResult.info ?? 'Defender: clean'),
      };
    } catch {
      // VT failed — still return Defender result
    }
  }

  return {
    status: defenderResult.status,
    info: defenderResult.info ?? 'Windows Defender: clean',
  };
}
