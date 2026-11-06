param(
  [ValidateSet("all", "installer", "portable")]
  [string]$Target = "all"
)

$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$builder = Join-Path $appRoot "node_modules\.bin\electron-builder.cmd"
$cache = Join-Path $appRoot ".electron-builder-cache"
$temp = Join-Path $appRoot ".desktop-tmp"
$packageJson = [IO.File]::ReadAllText(
  (Join-Path $appRoot "package.json"),
  [Text.Encoding]::UTF8
)
$package = $packageJson | ConvertFrom-Json
$version = $package.version
$output = Join-Path $appRoot "release-desktop"

New-Item -ItemType Directory -Force -Path $cache | Out-Null
New-Item -ItemType Directory -Force -Path $temp | Out-Null

if (-not $env:ELECTRON_MIRROR) {
  $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
}
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
  $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
}

$env:ELECTRON_BUILDER_CACHE = $cache
$env:TEMP = $temp
$env:TMP = $temp

Push-Location $appRoot
try {
  if ($Target -in @("all", "installer")) {
    & $builder --win nsis --x64 --config.artifactName='Rixu-Desktop-Setup-${version}-${arch}.${ext}'
    if ($LASTEXITCODE -ne 0) {
      throw "Desktop installer build failed."
    }
    $source = Join-Path $output "Rixu-Desktop-Setup-$version-x64.exe"
    $artifactPath = Join-Path $output "$(([char]0x65E5).ToString() + ([char]0x5E8F).ToString())-Desktop-Setup-$version-x64.exe"
    Copy-Item -LiteralPath $source -Destination $artifactPath -Force
    if (Test-Path -LiteralPath "$source.blockmap") {
      Copy-Item -LiteralPath "$source.blockmap" -Destination "$artifactPath.blockmap" -Force
      Remove-Item -LiteralPath "$source.blockmap" -Force
    }
    Remove-Item -LiteralPath $source -Force
  }

  if ($Target -in @("all", "portable")) {
    & $builder --win portable --x64 --config.artifactName='Rixu-Desktop-Portable-${version}-${arch}.${ext}'
    if ($LASTEXITCODE -ne 0) {
      throw "Desktop portable build failed."
    }
    $source = Join-Path $output "Rixu-Desktop-Portable-$version-x64.exe"
    $artifactPath = Join-Path $output "$(([char]0x65E5).ToString() + ([char]0x5E8F).ToString())-Desktop-Portable-$version-x64.exe"
    Copy-Item -LiteralPath $source -Destination $artifactPath -Force
    Remove-Item -LiteralPath $source -Force
  }
} finally {
  Pop-Location
}

Write-Host "Desktop builds completed in release-desktop."
