# Achievement Watcher — Game Bar Widget

A C# UWP AppContainer widget that appears in Xbox Game Bar (Win+G) and shows
achievement unlock toasts, connecting to the Zephyr achievement-watcher service
over a local WebSocket.

## Why C# UWP?

Xbox Game Bar's `microsoft.gameBarUIExtension` requires an **AppContainer** app
built against the UWP XAML pipeline — Microsoft's `WidgetSampleCS` is the
canonical reference. The earlier attempt to build this as a pure C++/WinRT
AppContainer EXE via base VS Build Tools did not work: Game Bar requires the
XAML Application activation model, which is produced only by the UWP build
targets (XAML compiler, activation factory generation, PRI resources).

## Prerequisites

| Tool | Location |
|---|---|
| Visual Studio 2022/2026 (any edition, incl. Build Tools) with the **Universal Windows Platform Build Tools** workload | — |
| Windows SDK 10.0.19041.0 or later | `C:\Program Files (x86)\Windows Kits\10\` |
| `makeappx.exe` + `signtool.exe` | `...\Windows Kits\10\bin\<ver>\x64\` |

Install the UWP workload on VS Build Tools 2026:

```powershell
"C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_buildtools.exe" `
  modify --installPath "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools" `
  --add Microsoft.VisualStudio.Workload.UniversalBuildTools --quiet --norestart
```

NuGet packages (restored automatically by `dotnet` / `msbuild`):

- `Microsoft.Gaming.XboxGameBar` — the widget SDK
- `Microsoft.NETCore.UniversalWindowsPlatform` — UWP .NET runtime
- `Microsoft.UI.Xaml` — WinUI 2, provides the `WebView2` XAML control

## Architecture

```
App.xaml / App.xaml.cs
    — Application subclass; OnActivated handles ms-gamebarwidget://
      protocol activation and constructs an XboxGameBarWidget bound to a
      Frame that navigates to Widget.

Widget.xaml / Widget.xaml.cs
    — Page hosting a muxc:WebView2 control.
    — On navigation: reads LocalState\config.json, forwards it to widget.js
      via CoreWebView2.PostWebMessageAsJson (so JS gets {port, token}).
    — Receives { type: "notify", title, body } messages from the webview
      and surfaces them as Game Bar toasts via
      XboxGameBarWidgetNotificationManager.

web/
    — The widget's HTML/JS/CSS content. Loaded via a virtual host
      mapping (https://widget.local/) so fetch/WebSocket APIs behave.
    — widget.js connects to ws://127.0.0.1:<port> and renders toasts.

Package.appxmanifest
    — AppContainer, Identity "ZephyrAchievementWatcher", CN=ZephyrDev.
    — microsoft.gameBarUIExtension (Type="Standard", resizable 400×400).
    — activatableClass.proxyStub block for Game Bar private WinRT interfaces.
```

## Building

### From Zephyr repo root (recommended)

```powershell
npm run package:plugin -- examples/plugins/achievement-watcher
```

This will:
1. Build `renderer.js` (Layer-2 Zephyr plugin UI)
2. Install service runtime deps
3. Ensure the `CN=ZephyrDev` signing cert exists in `Cert:\CurrentUser\My`,
   exporting `widget/AchievementWidget.pfx` and `.cer` if freshly generated
4. Generate any missing placeholder PNG assets
5. Build `AchievementWidget.csproj` with MSBuild (Release|x64, sideload mode,
   signed with the cert thumbprint)
6. Copy the output `.msix` and `.cer` to `widget/AchievementWidget.msix` / `.cer`
7. Zip everything to `examples/dist/achievement-watcher.zip`

### Manual (widget only)

```powershell
$msbuild = & "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe" `
  -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe
& $msbuild AchievementWidget\AchievementWidget.csproj `
  /p:Configuration=Release /p:Platform=x64 `
  /p:AppxBundle=Never /p:UapAppxPackageBuildMode=SideloadOnly `
  /p:AppxPackageSigningEnabled=true /p:PackageCertificateThumbprint=<thumbprint>
```

## Installing (via Zephyr)

With the achievement-watcher plugin installed in Zephyr, open its settings
page and click **Install Widget**. This runs an elevated PowerShell that:

1. Imports `AchievementWidget.cer` to the machine Trusted Root CA store
2. Installs the MSIX via `Add-AppxPackage`
3. Exempts the package family from network loopback restrictions
   (`CheckNetIsolation.exe LoopbackExempt -a -n=<PFN>`) so `widget.js`
   can connect to the service's local WebSocket
4. Copies `config.json` (containing `{port, token}`) to the package's
   `LocalState` folder

## Runtime flow

```
Zephyr plugin (main/index.js)
    ↓  writes config.json to dataDir
    ↓  on "Install Widget", elevated PS copies config.json → LocalState
Service (plugin/service)
    ↑ WebSocket server on 127.0.0.1:<port> with token auth
Widget (AchievementWidget MSIX, AppContainer)
    ↑ Widget.xaml.cs reads LocalState\config.json, posts {port,token} to JS
    ↑ widget.js connects WebSocket, renders toasts, posts { type:"notify" }
    ↑ C# host surfaces Game Bar toast via XboxGameBarWidgetNotificationManager
```

## Key files

| File | Purpose |
|---|---|
| `AchievementWidget/AchievementWidget.csproj` | UWP C# project (AppContainer, x64) |
| `AchievementWidget/App.xaml`, `App.xaml.cs` | Application; handles Game Bar widget activation |
| `AchievementWidget/Widget.xaml`, `Widget.xaml.cs` | WebView2 host page + notification bridge |
| `AchievementWidget/Package.appxmanifest` | MSIX manifest (microsoft.gameBarUIExtension) |
| `AchievementWidget/web/` | HTML/CSS/JS served inside the widget's WebView2 |
| `AchievementWidget/GameBar/` | Public folder exposed to Game Bar (notification assets) |
| `AchievementWidget/Properties/Default.rd.xml` | .NET Native runtime directives |
| `AchievementWidget.msix` | Built signed package (output of `package:plugin`) |
| `AchievementWidget.cer` | Public cert for trusting the self-signed package |
| `AchievementWidget.pfx` | Signing certificate (password: `ZephyrWidget!`) |
