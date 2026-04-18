/**
 * Package an example plugin into a distributable .zip.
 *
 * Usage:
 *   node scripts/package-plugin.mjs <plugin-dir> [--id <id>] [--out <dir>] [--skip-widget]
 *   npm run package:plugin -- <plugin-dir> [--id <id>] [--out <dir>] [--skip-widget]
 *
 * Build steps (run automatically before zipping):
 * 1. If the plugin dir has a package.json with a `build` script, runs
 *    `npm install` (if node_modules missing) then `npm run build`.
 *    This is how Layer-2 plugins produce their `renderer.js` bundle.
 * 2. If a `service/` subdirectory has a `package.json`, runs
 *    `npm install --omit=dev` inside it to populate `service/node_modules`.
 *    Those modules ARE included in the zip (runtime dependencies).
 * 3. If a `widget/` subdirectory contains a `.vcxproj` file (C++/WinRT
 *    AppContainer widget), builds with MSBuild (VS Build Tools 2026) and
 *    packages with makeappx.exe + signtool.exe. Falls back to legacy
 *    `.csproj` (requires VS UWP workload). The resulting .msix and .cer are
 *    copied to `widget/AchievementWidget.msix` / `.cer`. Skipped gracefully
 *    when MSBuild is not found; use --skip-widget to suppress the warning.
 *
 * Zip layout:
 * - Plugin ID comes from --id, else package.json `zephyr.pluginId`, else dir basename.
 * - index.js is required.
 * - Top-level `node_modules/` is always excluded (dev-only build tools).
 * - Any subdir with its own `package.json` has its `node_modules/` included
 *   (these are bundled runtime deps, e.g. `service/node_modules`).
 * - `widget/` only contributes .appx and .cer files — C# source is excluded.
 * - Writes to examples/dist/<pluginId>.zip by default.
 */
import { execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Arg parsing ───────────────────────────────────────────────────────────────
const raw = process.argv.slice(2);
const positional = [];
const flags = new Map();
for (let i = 0; i < raw.length; i++) {
  const a = raw[i];
  if (a.startsWith('--')) {
    flags.set(a.slice(2), raw[i + 1] ?? true);
    i++;
  } else {
    positional.push(a);
  }
}

if (positional.length === 0) {
  console.error(
    'Usage: node scripts/package-plugin.mjs <plugin-dir> [--id <id>] [--out <dir>] [--skip-widget]',
  );
  process.exit(1);
}

const pluginDir = resolve(positional[0]);
if (!existsSync(pluginDir) || !statSync(pluginDir).isDirectory()) {
  console.error(`Plugin directory not found: ${pluginDir}`);
  process.exit(1);
}

const outDir = resolve(flags.get('out') ?? join(root, 'examples/dist'));
const skipWidget = flags.has('skip-widget');

// ── Read optional manifest ────────────────────────────────────────────────────
let manifestId = null;
let hasBuild = false;
const pkgJsonPath = join(pluginDir, 'package.json');
if (existsSync(pkgJsonPath)) {
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    manifestId = pkg?.zephyr?.pluginId ?? null;
    hasBuild = typeof pkg?.scripts?.build === 'string';
  } catch (err) {
    console.error(`Could not parse ${pkgJsonPath}:`, err.message);
    process.exit(1);
  }
}

const pluginId = flags.get('id') ?? manifestId ?? basename(pluginDir);
if (typeof pluginId !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(pluginId)) {
  console.error(
    `Invalid plugin ID "${pluginId}". Must match ^[a-z0-9][a-z0-9-]*$ (lowercase letters, digits, hyphens).`,
  );
  process.exit(1);
}

// ── Step 1: Renderer build ────────────────────────────────────────────────────
if (hasBuild) {
  const nodeModules = join(pluginDir, 'node_modules');
  if (!existsSync(nodeModules)) {
    console.log(`→ Installing build deps for ${basename(pluginDir)}`);
    execSync('npm install', { cwd: pluginDir, stdio: 'inherit', shell: true });
  }
  console.log(`→ Building ${basename(pluginDir)}`);
  execSync('npm run build', { cwd: pluginDir, stdio: 'inherit', shell: true });
}

if (!existsSync(join(pluginDir, 'index.js'))) {
  console.error(`Packaging failed: ${pluginDir} has no index.js`);
  process.exit(1);
}

// ── Step 2: Service runtime deps ──────────────────────────────────────────────
const serviceDir = join(pluginDir, 'service');
if (existsSync(join(serviceDir, 'package.json'))) {
  const serviceModules = join(serviceDir, 'node_modules');
  if (!existsSync(serviceModules)) {
    console.log('→ Installing service runtime deps (npm install --omit=dev)');
    execSync('npm install --omit=dev', { cwd: serviceDir, stdio: 'inherit', shell: true });
  } else {
    console.log('→ service/node_modules present — skipping install');
  }
}

// ── Step 3: Widget build ──────────────────────────────────────────────────────
const widgetDir = join(pluginDir, 'widget');
if (existsSync(widgetDir) && !skipWidget) {
  const csprojFiles = [];
  const vcxprojFiles = [];
  function findCsproj(dir) {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) findCsproj(abs);
      else if (entry.endsWith('.csproj')) csprojFiles.push(abs);
      else if (entry.endsWith('.vcxproj')) vcxprojFiles.push(abs);
    }
  }
  findCsproj(widgetDir);

  if (vcxprojFiles.length > 0) {
    // ── C++/WinRT AppContainer widget (.vcxproj) ────────────────────────────
    const msbuild = findMsBuildV180();
    if (!msbuild) {
      console.warn('  ⚠ Skipping .vcxproj widget — MSBuild (VS Build Tools 2026) not found.');
    } else {
      const pfxPath = join(widgetDir, 'AchievementWidget.pfx');
      const cerPath = join(widgetDir, 'AchievementWidget.cer');
      console.log('→ Ensuring signing certificate in current-user store');
      const certPs1 = [
        '$ErrorActionPreference = "Stop"',
        '$subject = "CN=ZephyrDev"',
        '$friendly = "Zephyr Achievement Widget"',
        `$pfx = '${pfxPath.replace(/'/g, "''")}'`,
        `$cer = '${cerPath.replace(/'/g, "''")}'`,
        '$pfxPwd = ConvertTo-SecureString -String "ZephyrWidget!" -Force -AsPlainText',
        '$cert = Get-ChildItem -Path "Cert:\\CurrentUser\\My" | Where-Object { $_.Subject -eq $subject -and $_.FriendlyName -eq $friendly } | Select-Object -First 1',
        'if (-not $cert) {',
        '  if (Test-Path $pfx) {',
        '    $cert = Import-PfxCertificate -FilePath $pfx -CertStoreLocation "Cert:\\CurrentUser\\My" -Password $pfxPwd',
        '  } else {',
        '    $cert = New-SelfSignedCertificate -Type Custom -Subject $subject -KeyUsage DigitalSignature -FriendlyName $friendly `',
        '      -CertStoreLocation "Cert:\\CurrentUser\\My" `',
        '      -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}")',
        '    Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pfxPwd | Out-Null',
        '    Export-Certificate -Cert $cert -FilePath $cer | Out-Null',
        '  }',
        '}',
        'Write-Output $cert.Thumbprint',
      ].join('\r\n');
      mkdirSync(outDir, { recursive: true });
      const certScript = join(outDir, '_gen-cert.ps1');
      writeFileSync(certScript, certPs1, 'utf8');
      let certThumbprint = '';
      try {
        certThumbprint = execSync(
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${certScript}"`,
          { encoding: 'utf8', shell: true },
        ).trim();
        console.log(`  ✓ Certificate ready (thumbprint: ${certThumbprint.slice(0, 8)}...)`);
      } finally {
        try { unlinkSync(certScript); } catch {}
      }

      // Generate placeholder PNG assets if missing
      const assetsDir = join(dirname(vcxprojFiles[0] ?? ''), 'Assets');
      const REQUIRED_ASSETS = [
        ['Square44x44Logo.png',   44,  44],
        ['Square150x150Logo.png', 150, 150],
        ['Wide310x150Logo.png',   310, 150],
        ['StoreLogo.png',          50,  50],
        ['SplashScreen.png',      620, 300],
      ];
      const missingAssets = REQUIRED_ASSETS.filter(([name]) => !existsSync(join(assetsDir, name)));
      if (missingAssets.length > 0) {
        console.log(`→ Generating ${missingAssets.length} placeholder PNG asset(s)`);
        const assetLines = [
          'Add-Type -AssemblyName System.Drawing',
          `New-Item -ItemType Directory -Force -Path '${assetsDir.replace(/'/g, "''")}' | Out-Null`,
          ...missingAssets.map(([name, w, h]) => {
            const dest = join(assetsDir, String(name)).replace(/'/g, "''");
            return `$b=New-Object System.Drawing.Bitmap(${w},${h}); $b.Save('${dest}',[System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()`;
          }),
        ];
        const assetScript = join(outDir, '_gen-assets.ps1');
        writeFileSync(assetScript, assetLines.join('\r\n'), 'utf8');
        try {
          execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${assetScript}"`, {
            stdio: 'inherit', shell: true,
          });
        } finally {
          try { unlinkSync(assetScript); } catch {}
        }
      }

      for (const vcxproj of vcxprojFiles) {
        const projDir = dirname(vcxproj);
        console.log(`→ Building C++/WinRT widget: ${relative(pluginDir, vcxproj)}`);
        const vcTargets = join(
          'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools',
          'MSBuild\\Microsoft\\VC\\v180\\',
        );
        const vtEnv = `VCTargetsPath=${vcTargets}`;
        execSync(
          `"${msbuild}" "${vcxproj}" /p:Configuration=Release /p:Platform=x64 /nologo /v:minimal`,
          { cwd: projDir, stdio: 'inherit', shell: true, env: { ...process.env, VCTargetsPath: vcTargets } },
        );

        // Stage the package layout and create MSIX
        const binDir = join(projDir, 'bin', 'x64', 'Release');
        const stageDir = join(projDir, 'obj', 'x64', 'Release', '_msix_stage');
        const msixOut = join(projDir, 'bin', 'x64', 'Release', 'AchievementWidget.msix');
        mkdirSync(stageDir, { recursive: true });

        // Copy manifest + exe + WinMD
        copyFileSync(join(projDir, 'Package.appxmanifest'), join(stageDir, 'AppxManifest.xml'));
        copyFileSync(join(binDir, 'AchievementWidget.exe'), join(stageDir, 'AchievementWidget.exe'));
        const winmdSrc = join(binDir, 'Microsoft.Gaming.XboxGameBar.winmd');
        if (existsSync(winmdSrc)) {
          copyFileSync(winmdSrc, join(stageDir, 'Microsoft.Gaming.XboxGameBar.winmd'));
        }

        // Copy asset folders
        for (const folder of ['Assets', 'web', 'GameBar']) {
          const src = join(projDir, folder);
          if (existsSync(src)) copyDirSync(src, join(stageDir, folder));
        }

        const makeappx = findMakeAppx();
        const signtool = findSignTool();
        if (!makeappx) {
          console.warn('  ⚠ makeappx.exe not found — cannot package MSIX');
        } else {
          execSync(
            `"${makeappx}" pack /d "${stageDir}" /p "${msixOut}" /nv /o`,
            { stdio: 'inherit', shell: true },
          );
          if (signtool && certThumbprint) {
            execSync(
              `"${signtool}" sign /fd sha256 /sha1 ${certThumbprint} "${msixOut}"`,
              { stdio: 'inherit', shell: true },
            );
          } else if (signtool && existsSync(pfxPath)) {
            execSync(
              `"${signtool}" sign /fd sha256 /f "${pfxPath}" /p "ZephyrWidget!" "${msixOut}"`,
              { stdio: 'inherit', shell: true },
            );
          }

          const dest = join(widgetDir, 'AchievementWidget.msix');
          copyFileSync(msixOut, dest);
          console.log(`  ✓ Packaged → widget/AchievementWidget.msix`);
        }
      }

      if (certThumbprint) {
        try {
          execSync(
            `powershell.exe -NoProfile -Command "Remove-Item 'Cert:\\CurrentUser\\My\\${certThumbprint}' -ErrorAction SilentlyContinue"`,
            { shell: true, stdio: 'ignore' },
          );
        } catch {}
      }
    }
  } else if (csprojFiles.length > 0) {
    const msbuild = findMsBuild();
    {
      // Ensure signing cert is in the current-user store; capture thumbprint for build.
      // Windows App SDK targets require the cert to be in the store — file+password doesn't work.
      const pfxPath = join(widgetDir, 'AchievementWidget.pfx');
      const cerPath = join(widgetDir, 'AchievementWidget.cer');
      console.log('→ Ensuring signing certificate in current-user store');
      const certPs1 = [
        '$ErrorActionPreference = "Stop"',
        '$subject = "CN=ZephyrDev"',
        '$friendly = "Zephyr Achievement Widget"',
        `$pfx = '${pfxPath.replace(/'/g, "''")}'`,
        `$cer = '${cerPath.replace(/'/g, "''")}'`,
        '$pfxPwd = ConvertTo-SecureString -String "ZephyrWidget!" -Force -AsPlainText',
        // Try to find existing cert in store
        '$cert = Get-ChildItem -Path "Cert:\\CurrentUser\\My" | Where-Object { $_.Subject -eq $subject -and $_.FriendlyName -eq $friendly } | Select-Object -First 1',
        'if (-not $cert) {',
        '  if (Test-Path $pfx) {',
        '    $cert = Import-PfxCertificate -FilePath $pfx -CertStoreLocation "Cert:\\CurrentUser\\My" -Password $pfxPwd',
        '  } else {',
        '    $cert = New-SelfSignedCertificate -Type Custom -Subject $subject -KeyUsage DigitalSignature -FriendlyName $friendly `',
        '      -CertStoreLocation "Cert:\\CurrentUser\\My" `',
        '      -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}")',
        '    Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pfxPwd | Out-Null',
        '    Export-Certificate -Cert $cert -FilePath $cer | Out-Null',
        '  }',
        '}',
        'Write-Output $cert.Thumbprint',
      ].join('\r\n');
      mkdirSync(outDir, { recursive: true });
      const certScript = join(outDir, '_gen-cert.ps1');
      writeFileSync(certScript, certPs1, 'utf8');
      let certThumbprint = '';
      try {
        certThumbprint = execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${certScript}"`, {
          encoding: 'utf8', shell: true,
        }).trim();
        console.log(`  ✓ Certificate ready (thumbprint: ${certThumbprint.slice(0, 8)}...)`);
      } finally {
        try { unlinkSync(certScript); } catch {}
      }

      // Generate placeholder PNG assets if any are missing
      const assetsDir = join(dirname(csprojFiles[0] ?? ''), 'Assets');
      const REQUIRED_ASSETS = [
        ['Square44x44Logo.png',   44,  44],
        ['Square150x150Logo.png', 150, 150],
        ['Wide310x150Logo.png',   310, 150],
        ['StoreLogo.png',          50,  50],
        ['SplashScreen.png',      620, 300],
      ];
      const missingAssets = REQUIRED_ASSETS.filter(([name]) => !existsSync(join(assetsDir, name)));
      if (missingAssets.length > 0) {
        console.log(`→ Generating ${missingAssets.length} placeholder PNG asset(s)`);
        const assetLines = [
          'Add-Type -AssemblyName System.Drawing',
          `New-Item -ItemType Directory -Force -Path '${assetsDir.replace(/'/g, "''")}' | Out-Null`,
          ...missingAssets.map(([name, w, h]) => {
            const dest = join(assetsDir, String(name)).replace(/'/g, "''");
            return `$b=New-Object System.Drawing.Bitmap(${w},${h}); $b.Save('${dest}',[System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()`;
          }),
        ];
        const assetScript = join(outDir, '_gen-assets.ps1');
        writeFileSync(assetScript, assetLines.join('\r\n'), 'utf8');
        try {
          execSync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${assetScript}"`, {
            stdio: 'inherit', shell: true,
          });
        } finally {
          try { unlinkSync(assetScript); } catch {}
        }
      }

      const msbuildXamlVer = msbuild ? findXamlTargetsVersion(msbuild) : '17.0';
      for (const csproj of csprojFiles) {
        console.log(`→ Building widget: ${relative(pluginDir, csproj)}`);
        const isSdkStyle = readFileSync(csproj, 'utf8').includes('Sdk=');
        if (isSdkStyle) {
          const thumbprintFlag = certThumbprint ? `--property:PackageCertificateThumbprint=${certThumbprint}` : '';
          execSync(
            `dotnet build "${csproj}" -c Release -r win-x86 --property:GenerateAppxPackageOnBuild=true --property:AppxBundle=Never --property:UapAppxPackageBuildMode=SideloadOnly ${thumbprintFlag} --nologo`,
            { cwd: dirname(csproj), stdio: 'inherit', shell: true },
          );
        } else {
          if (!msbuild) {
            console.warn(`  ⚠ Skipping legacy .csproj — MSBuild not found. Install Visual Studio with UWP workload or use --skip-widget.`);
            continue;
          }
          const signProps = certThumbprint
            ? `/p:AppxPackageSigningEnabled=true /p:PackageCertificateThumbprint=${certThumbprint}`
            : '';
          execSync(
            `"${msbuild}" "${csproj}" /restore /p:Configuration=Release /p:Platform=x64 /p:AppxBundle=Never /p:UapAppxPackageBuildMode=SideloadOnly /p:VisualStudioVersion=${msbuildXamlVer} ${signProps} /nologo /v:minimal`,
            { cwd: dirname(csproj), stdio: 'inherit', shell: true },
          );
        }

        // Search both AppPackages (legacy msbuild) and bin/ (dotnet SDK) for output
        const projDir = dirname(csproj);
        const appxFiles = [
          ...findRecursive(join(projDir, 'AppPackages'), ['.appx', '.appxbundle', '.msix']),
          ...findRecursive(join(projDir, 'bin'), ['.appx', '.appxbundle', '.msix']),
        ];
        const cerFiles = [
          ...findRecursive(join(projDir, 'AppPackages'), ['.cer']),
          ...findRecursive(join(projDir, 'bin'), ['.cer']),
        ];

        if (appxFiles.length === 0) {
          console.warn(`  ⚠ No .appx/.msix found after build — check build output`);
        }
        for (const f of appxFiles.slice(0, 1)) {
          const ext = f.endsWith('.msix') ? '.msix' : '.appx';
          const dest = join(widgetDir, `AchievementWidget${ext}`);
          copyFileSync(f, dest);
          console.log(`  ✓ ${relative(pluginDir, f)} → widget/AchievementWidget${ext}`);
        }
        for (const f of cerFiles.slice(0, 1)) {
          const dest = join(widgetDir, 'AchievementWidget.cer');
          copyFileSync(f, dest);
          console.log(`  ✓ ${relative(pluginDir, f)} → widget/AchievementWidget.cer`);
        }
      }
      // Remove cert from store after signing (cleanup)
      if (certThumbprint) {
        try {
          execSync(
            `powershell.exe -NoProfile -Command "Remove-Item 'Cert:\\CurrentUser\\My\\${certThumbprint}' -ErrorAction SilentlyContinue"`,
            { shell: true, stdio: 'ignore' },
          );
        } catch {}
      }
    }
  }
}

// ── Helpers: copying ──────────────────────────────────────────────────────────

/** Recursively copy a directory tree (no symlinks). */
function copyDirSync(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry), d = join(dest, entry);
    if (statSync(s).isDirectory()) copyDirSync(s, d);
    else copyFileSync(s, d);
  }
}

// ── Walk + filter ─────────────────────────────────────────────────────────────

// Detect subdirs with their own package.json — their node_modules are bundled runtime deps.
const bundledNodeModulesDirs = new Set();
try {
  for (const entry of readdirSync(pluginDir)) {
    const sub = join(pluginDir, entry);
    if (statSync(sub).isDirectory() && existsSync(join(sub, 'package.json'))) {
      bundledNodeModulesDirs.add(entry);
    }
  }
} catch {}

const DENY_NAMES = new Set([
  'dist',
  '.git',
  '.gitignore',
  '.gitattributes',
  '.DS_Store',
  'Thumbs.db',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'esbuild.config.js',
  'rollup.config.js',
]);
const DENY_PATTERNS = [
  /^tsconfig.*\.json$/i,
  /^jsconfig\.json$/i,
  /^vite\.config\./i,
  /^webpack\.config\./i,
];

/**
 * @param {string} name  — entry name being tested
 * @param {string} parentRel — relative path of the parent directory ('' for root)
 */
function shouldInclude(name, parentRel) {
  // node_modules at root level: always excluded (dev-only build tools).
  // node_modules inside a bundled subdir: included (runtime deps).
  if (name === 'node_modules') {
    return bundledNodeModulesDirs.has(parentRel);
  }

  // widget/ root: only .appx/.msix and .cer are distribution artifacts; skip all source.
  if (parentRel === 'widget') {
    return /\.(appx|msix|cer)$/i.test(name);
  }
  // Nothing inside widget subdirectories (they're source, not built output).
  if (parentRel.startsWith('widget/')) {
    return false;
  }

  if (DENY_NAMES.has(name)) return false;
  if (DENY_PATTERNS.some((p) => p.test(name))) return false;
  return true;
}

/** @type {Record<string, Uint8Array>} */
const files = {};

function walk(dir, rel = '') {
  for (const entry of readdirSync(dir)) {
    if (!shouldInclude(entry, rel)) continue;
    const abs = join(dir, entry);
    const relPath = rel ? `${rel}/${entry}` : entry;
    const s = statSync(abs);
    if (s.isDirectory()) {
      walk(abs, relPath);
    } else if (s.isFile()) {
      files[`${pluginId}/${relPath}`] = new Uint8Array(readFileSync(abs));
    }
  }
}
walk(pluginDir);

if (!(`${pluginId}/index.js` in files)) {
  console.error(`Packaged output is missing ${pluginId}/index.js after filtering`);
  process.exit(1);
}

// ── Write zip ─────────────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `${pluginId}.zip`);
const zipBytes = zipSync(files);
writeFileSync(zipPath, zipBytes);

const count = Object.keys(files).length;
const sizeKb = (zipBytes.byteLength / 1024).toFixed(1);
console.log(`✓ Packaged ${pluginId} (${count} files, ${sizeKb} KB) → ${relative(root, zipPath)}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Locate MSBuild.exe via vswhere or well-known paths. Returns null if not found. */
function findMsBuild() {
  // Try vswhere (ships with Visual Studio 2017+)
  const vswhere =
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
  if (existsSync(vswhere)) {
    try {
      const result = execSync(
        `"${vswhere}" -latest -requires Microsoft.Component.MSBuild -find MSBuild\\**\\Bin\\MSBuild.exe`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
      )
        .trim()
        .split(/\r?\n/)[0]
        .trim();
      if (result && existsSync(result)) return result;
    } catch {}
  }

  // Fallback: well-known paths for VS 2019 / 2022
  for (const vs of ['2022', '2019']) {
    for (const edition of ['Enterprise', 'Professional', 'Community', 'BuildTools']) {
      for (const base of [
        'C:\\Program Files\\Microsoft Visual Studio',
        'C:\\Program Files (x86)\\Microsoft Visual Studio',
      ]) {
        const p = join(base, vs, edition, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

/**
 * Find the installed WindowsXaml MSBuild targets version (e.g. "17.0").
 * VS 2025 sets $(VisualStudioVersion)=18.0 but UWP targets are still at v17.0.
 */
function findXamlTargetsVersion(msbuildPath) {
  // MSBuild.exe is at .../MSBuild/Current/Bin/MSBuild.exe
  // Extensions are at .../MSBuild/Microsoft/WindowsXaml/vX.Y/
  const xamlBase = join(dirname(msbuildPath), '..', '..', 'Microsoft', 'WindowsXaml');
  try {
    const versions = readdirSync(xamlBase)
      .filter(
        (d) =>
          /^v\d+\.\d+$/.test(d) &&
          existsSync(join(xamlBase, d, 'Microsoft.Windows.UI.Xaml.CSharp.targets')),
      )
      .sort()
      .reverse();
    if (versions.length > 0) return versions[0].slice(1); // strip leading 'v'
  } catch {}
  return '17.0';
}

/**
 * Recursively find files with given extensions under a directory.
 * @param {string} dir
 * @param {string[]} exts
 * @returns {string[]}
 */
function findRecursive(dir, exts) {
  if (!existsSync(dir)) return [];
  const found = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) found.push(...findRecursive(abs, exts));
    else if (exts.some((e) => entry.endsWith(e))) found.push(abs);
  }
  return found;
}

/** Locate MSBuild from VS 2026 Build Tools (for C++/WinRT vcxproj builds). */
function findMsBuildV180() {
  for (const base of [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\18\\BuildTools',
    'C:\\Program Files\\Microsoft Visual Studio\\18\\Community',
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\Community',
  ]) {
    const p = join(base, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
    if (existsSync(p)) return p;
  }
  return null;
}

/** Locate makeappx.exe from the Windows SDK. */
function findMakeAppx() {
  const kitsRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!existsSync(kitsRoot)) return null;
  const vers = readdirSync(kitsRoot).filter((v) => /^\d+\.\d+\.\d+\.\d+$/.test(v)).sort().reverse();
  for (const v of vers) {
    const p = join(kitsRoot, v, 'x64', 'makeappx.exe');
    if (existsSync(p)) return p;
  }
  return null;
}

/** Locate signtool.exe from the Windows SDK. */
function findSignTool() {
  const kitsRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!existsSync(kitsRoot)) return null;
  const vers = readdirSync(kitsRoot).filter((v) => /^\d+\.\d+\.\d+\.\d+$/.test(v)).sort().reverse();
  for (const v of vers) {
    const p = join(kitsRoot, v, 'x64', 'signtool.exe');
    if (existsSync(p)) return p;
  }
  return null;
}
