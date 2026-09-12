# Build the UNICO Nurse APK with the Android SDK's own tools (no Gradle, no download).
#
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Server "https://nurse.yourhospital.org"
#
# Output: build\UNICO-Nurse.apk (signed with a debug key so it installs on any phone via
# "Install unknown apps" / adb install). For Play Store distribution sign it with the
# hospital's release key instead (see README.md).
param(
  [string]$Server = "http://10.150.188.105:8081",   # the server the phone should open
  [string]$Sdk = "$env:LOCALAPPDATA\Android\Sdk",
  [string]$BuildTools = "",                            # e.g. 37.0.0 (default: newest installed)
  [string]$Platform = "",                              # e.g. android-36.1 (default: newest installed)
  [string]$Java = "C:\Program Files\Android\Android Studio\jbr\bin",
  [string]$Keystore = "",                              # release keystore (default: a debug key is generated)
  [string]$KeyAlias = "androiddebugkey",
  [string]$StorePass = "android",
  [string]$KeyPass = "android"
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
if (-not $BuildTools) { $BuildTools = (Get-ChildItem "$Sdk\build-tools" | Sort-Object Name -Descending | Select-Object -First 1).Name }
if (-not $Platform) { $Platform = (Get-ChildItem "$Sdk\platforms" | Sort-Object Name -Descending | Select-Object -First 1).Name }
$bt = "$Sdk\build-tools\$BuildTools"
$androidJar = "$Sdk\platforms\$Platform\android.jar"
$javac = "$Java\javac.exe"; $javaExe = "$Java\java.exe"; $keytool = "$Java\keytool.exe"
foreach ($p in @("$bt\aapt2.exe", "$bt\zipalign.exe", "$bt\lib\d8.jar", "$bt\lib\apksigner.jar", $androidJar, $javac)) { if (-not (Test-Path $p)) { throw "Missing: $p" } }
$version = ([xml](Get-Content AndroidManifest.xml)).manifest.versionName
$minSdk = ([xml](Get-Content AndroidManifest.xml)).manifest.'uses-sdk'.minSdkVersion
Write-Host "UNICO Nurse v$version  ->  server $Server"
Write-Host "build-tools $BuildTools · $Platform · min SDK $minSdk"

# 0. clean
if (Test-Path build) { Remove-Item -Recurse -Force build }
New-Item -ItemType Directory -Force build\gen, build\classes, build\dex, build\src\health\unico\nurse | Out-Null

# 1. the one generated source: default server + version
@"
package health.unico.nurse;
public final class BuildInfo {
    public static final String DEFAULT_SERVER = "$Server";
    public static final String VERSION = "$version";
    private BuildInfo() {}
}
"@ | ForEach-Object { [System.IO.File]::WriteAllText("$root\build\src\health\unico\nurse\BuildInfo.java", $_, (New-Object System.Text.UTF8Encoding $false)) }   # no BOM: javac rejects it

# 2. resources -> res.zip, then link into a resource-only APK + R.java
& "$bt\aapt2.exe" compile --dir res -o build\res.zip
if ($LASTEXITCODE) { throw "aapt2 compile failed" }
& "$bt\aapt2.exe" link -o build\base.apk -I $androidJar --manifest AndroidManifest.xml -A assets --java build\gen --auto-add-overlay build\res.zip
if ($LASTEXITCODE) { throw "aapt2 link failed" }

# 3. compile Java (release 17 class files; d8 turns them into dex)
$sources = @(Get-ChildItem -Recurse -Filter *.java src, build\gen, build\src | ForEach-Object { $_.FullName })
& $javac --release 17 -encoding UTF-8 -Xlint:-options -cp $androidJar -d build\classes @sources
if ($LASTEXITCODE) { throw "javac failed" }
$classes = @(Get-ChildItem -Recurse -Filter *.class build\classes | ForEach-Object { $_.FullName })
& $javaExe -cp "$bt\lib\d8.jar" com.android.tools.r8.D8 --release --lib $androidJar --min-api $minSdk --output build\dex @classes
if ($LASTEXITCODE) { throw "d8 failed" }

# 4. put classes.dex into the APK (stored uncompressed is fine; zipalign fixes offsets)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open((Resolve-Path build\base.apk).Path, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.CreateEntry("classes.dex", [System.IO.Compression.CompressionLevel]::Optimal)
  $in = [System.IO.File]::OpenRead((Resolve-Path build\dex\classes.dex).Path); $out = $entry.Open(); $in.CopyTo($out); $out.Dispose(); $in.Dispose()
} finally { $zip.Dispose() }

# 5. align + sign
& "$bt\zipalign.exe" -f -p 4 build\base.apk build\aligned.apk
if ($LASTEXITCODE) { throw "zipalign failed" }
if (-not $Keystore) {
  $Keystore = "$root\build\debug.keystore"
  & $keytool -genkeypair -keystore $Keystore -alias $KeyAlias -storepass $StorePass -keypass $KeyPass -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=UNICO Nurse debug, O=UNICO, C=BD" | Out-Null
}
& $javaExe -jar "$bt\lib\apksigner.jar" sign --ks $Keystore --ks-key-alias $KeyAlias --ks-pass "pass:$StorePass" --key-pass "pass:$KeyPass" --out build\UNICO-Nurse.apk build\aligned.apk
if ($LASTEXITCODE) { throw "apksigner failed" }
& $javaExe -jar "$bt\lib\apksigner.jar" verify --print-certs build\UNICO-Nurse.apk | Select-Object -First 3
$size = [math]::Round((Get-Item build\UNICO-Nurse.apk).Length / 1KB)
Write-Host "OK  build\UNICO-Nurse.apk  ($size KB)"
