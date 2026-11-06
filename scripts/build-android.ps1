$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  $microsoftJdkRoot = Join-Path $env:ProgramFiles "Microsoft"
  $javaHome = Get-ChildItem -LiteralPath $microsoftJdkRoot -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $javaHome -or -not (Test-Path -LiteralPath (Join-Path $javaHome "bin\java.exe"))) {
  throw "OpenJDK 21 was not found. Set JAVA_HOME before building."
}

$androidSdk = Join-Path $appRoot ".android-tools\sdk"
if (-not (Test-Path -LiteralPath $androidSdk)) {
  throw "Android SDK was not found at $androidSdk"
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:Path = "$javaHome\bin;$androidSdk\platform-tools;$env:Path"

Push-Location (Join-Path $appRoot "android")
try {
  $localGradle = Join-Path $appRoot ".android-tools\gradle-8.14.3\bin\gradle.bat"
  if (Test-Path -LiteralPath $localGradle) {
    & $localGradle assembleDebug
  } else {
    & ".\gradlew.bat" assembleDebug
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Android build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$apk = Join-Path $appRoot "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) {
  throw "APK was not produced."
}

Write-Host "APK: $apk"
