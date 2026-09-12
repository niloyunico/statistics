# UNICO Nurse — Android APK

A small native shell (one Activity, one hardened WebView) around the Nurse App the
server serves at `/app`. The phone keeps only the server address; sign-in, sessions,
roles and every screen come from the server, so an APK never goes stale when the app
is updated — the next launch simply loads the new build.

## Build

Needs the Android SDK (build-tools + one platform) and the JDK bundled with Android
Studio. No Gradle and no downloads.

```powershell
cd android\nurse-app
powershell -ExecutionPolicy Bypass -File build.ps1 -Server "https://nurse.yourhospital.org"
```

Output: `build\UNICO-Nurse.apk`, signed with a generated debug key (fine for sideloading
and for testing on the emulator). For a store or MDM release pass the hospital's key:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1 -Server "https://nurse.yourhospital.org" `
  -Keystore C:\keys\unico-release.jks -KeyAlias unico -StorePass "***" -KeyPass "***"
```

`-Server` is only the default; the first screen of the app lets the user change it,
and the app shows that screen again whenever the server cannot be reached.

## Install / test

```powershell
adb install -r build\UNICO-Nurse.apk
adb shell am start -n health.unico.nurse/.MainActivity
```

On the emulator the host PC is `http://10.0.2.2:8081`; on a phone use the PC's LAN
address (`http://192.168.x.x:8081`) or the deployed https server.

## Security notes

- JavaScript can only call `UNICOApp.setServer/getServer/getVersion`; nothing else of
  the phone is exposed to web content.
- Only pages on the configured server host load inside the app; every other link
  (`tel:`, `mailto:`, WhatsApp, other websites) is handed to the phone.
- `file://` content is never loaded from web pages; file and content access are off.
- Mixed content is blocked. Plain `http` is allowed only for LAN/emulator use; a public
  server must be `https`.
- Backups are disabled, so the session cookie is not copied into device backups.
