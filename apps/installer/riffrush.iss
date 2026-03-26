; ============================================================================
; RiffRush Engine — Windows Installer
; Requires: Inno Setup 6 (https://jrsoftware.org/isinfo.php)
;
; Build manually (from project root, after building the exe):
;   ISCC /DMyAppVersion=0.1.0 apps\installer\riffrush.iss
;
; Build via CI (see .github/workflows/release.yml):
;   node apps/engine/scripts/build-exe.js --full
;   ISCC /DMyAppVersion=%TAG% apps/installer/riffrush.iss
;
; Output: dist\RiffRush-Engine-Setup-{version}.exe
; ============================================================================

; Allow /DMyAppVersion=x.y.z to be passed on the command line.
; Falls back to "0.1.0" when building locally without a tag.
#ifndef MyAppVersion
  #define MyAppVersion "0.1.0"
#endif

#define MyAppName       "RiffRush Engine"
#define MyAppPublisher  "RiffRush"
#define MyAppExeName    "riffrush-engine.exe"
#define MyAppURL        "https://github.com/Halaszle/RiffRush"
#define MyAppGUID       "{A3F8C2D1-5B4E-4F7A-9C3D-8E1B6F2A0D4C}"

; ── Output path is always dist/ relative to the project root ─────────────────
#define DistDir "..\..\dist"

[Setup]
; AppId is a stable GUID used to detect previous installations.
; Never change it after the first public release.
AppId={{#MyAppGUID}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases

; Installation defaults — user can override in the wizard.
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes

; No elevation needed — engine is a per-user desktop tool.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline

; Output
OutputDir={#DistDir}
OutputBaseFilename=RiffRush-Engine-Setup-{#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes

; Installer appearance
WizardStyle=modern
WizardSizePercent=100
SetupIconFile=
DisableWelcomePage=no
DisableProgramGroupPage=auto

; Uninstaller
UninstallDisplayName={#MyAppName} {#MyAppVersion}
UninstallDisplayIcon={app}\{#MyAppExeName}

; Version metadata embedded in the installer exe
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} {#MyAppVersion} Installer
VersionInfoProductName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

; ── Components ───────────────────────────────────────────────────────────────
; - engine    : the WebSocket server exe (always installed)
; - bridge    : optional native WASAPI capture bridge for low-latency guitar input
; - autostart : optional Windows login auto-start via the Run registry key
[Components]
Name: "engine";    Description: "RiffRush Engine (WebSocket server, required)";                   Types: full compact custom; Flags: fixed
Name: "bridge";    Description: "Native Capture Bridge — low-latency WASAPI input (recommended)"; Types: full
Name: "autostart"; Description: "Start the engine automatically when Windows starts";              Types: full

; ── Files ────────────────────────────────────────────────────────────────────
[Files]
; Engine executable (always required)
Source: "{#DistDir}\{#MyAppExeName}";           DestDir: "{app}"; Components: engine; Flags: ignoreversion

; Native capture bridge — skipped silently if the file does not exist.
; The bridge is built separately with: node apps/engine/scripts/build-exe.js --full
Source: "{#DistDir}\native-capture-bridge.exe"; DestDir: "{app}"; Components: bridge; Flags: ignoreversion skipifsourcedoesntexist

; ── Start Menu shortcuts ──────────────────────────────────────────────────────
[Icons]
; Main shortcut
Name: "{group}\{#MyAppName}";             Filename: "{app}\{#MyAppExeName}"; Comment: "Start the RiffRush Engine WebSocket server (ws://127.0.0.1:3210/ws)"
; Uninstaller shortcut in Start Menu
Name: "{group}\Uninstall {#MyAppName}";   Filename: "{uninstallexe}"

; ── Registry — optional auto-start ───────────────────────────────────────────
; Writes to HKCU so no administrator rights are required.
; The value is removed cleanly on uninstall (uninsdeletevalue flag).
[Registry]
Root: HKCU; \
  Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; \
  ValueName: "{#MyAppName}"; \
  ValueData: """{app}\{#MyAppExeName}"""; \
  Components: autostart; \
  Flags: uninsdeletevalue

; ── Post-install run ─────────────────────────────────────────────────────────
; The user can tick "Start RiffRush Engine now" on the final installer page.
[Run]
Filename: "{app}\{#MyAppExeName}"; \
  Description: "Start {#MyAppName} now"; \
  Flags: nowait postinstall skipifsilent

; ── Custom messages ───────────────────────────────────────────────────────────
[Messages]
BeveledLabel=RiffRush {#MyAppVersion}

; Post-install info page shown after a successful installation.
[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  InfoMsg: String;
begin
  if CurStep = ssPostInstall then begin
    InfoMsg :=
      'RiffRush Engine has been installed successfully.' + #13#10 + #13#10 +
      'The engine starts a local WebSocket server at:' + #13#10 +
      '  ws://127.0.0.1:3210/ws' + #13#10 + #13#10 +
      'Keep the engine window open while practising in the RiffRush web app.' + #13#10 +
      'You can close it by pressing Ctrl+C in the console window.';
    MsgBox(InfoMsg, mbInformation, MB_OK);
  end;
end;
