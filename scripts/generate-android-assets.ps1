$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$appRoot = Split-Path -Parent $PSScriptRoot
$resRoot = Join-Path $appRoot "android\app\src\main\res"
$background = [System.Drawing.ColorTranslator]::FromHtml("#17211F")
$teal = [System.Drawing.ColorTranslator]::FromHtml("#55C7B5")
$white = [System.Drawing.Color]::White

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Logo {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$Size,
    [bool]$Transparent = $false
  )

  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $inset = $Size * 0.2
  $boxSize = $Size - ($inset * 2)
  $stroke = [Math]::Max(2, $Size * 0.045)
  $pen = New-Object System.Drawing.Pen($white, $stroke)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $path = New-RoundedRectanglePath -X $inset -Y $inset -Width $boxSize -Height $boxSize -Radius ($Size * 0.075)
  $Graphics.DrawPath($pen, $path)

  $lineStart = $Size * 0.32
  $lineEnd = $Size * 0.68
  foreach ($ratio in @(0.38, 0.5, 0.62)) {
    $y = $Size * $ratio
    $Graphics.DrawLine($pen, $lineStart, $y, $lineEnd, $y)
  }

  $dotBrush = New-Object System.Drawing.SolidBrush($teal)
  $dotSize = $Size * 0.05
  $Graphics.FillEllipse(
    $dotBrush,
    $Size * 0.25,
    ($Size * 0.5) - ($dotSize / 2),
    $dotSize,
    $dotSize
  )

  $path.Dispose()
  $pen.Dispose()
  $dotBrush.Dispose()
}

function Save-Icon {
  param(
    [string]$Path,
    [int]$Size,
    [string]$Shape = "square"
  )
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)

  if ($Shape -eq "circle") {
    $brush = New-Object System.Drawing.SolidBrush($background)
    $graphics.FillEllipse($brush, 0, 0, $Size, $Size)
    $brush.Dispose()
  } else {
    $radius = [Math]::Max(2, $Size * 0.18)
    $roundedPath = New-RoundedRectanglePath -X 0 -Y 0 -Width $Size -Height $Size -Radius $radius
    $brush = New-Object System.Drawing.SolidBrush($background)
    $graphics.FillPath($brush, $roundedPath)
    $brush.Dispose()
    $roundedPath.Dispose()
  }

  Draw-Logo -Graphics $graphics -Size $Size -Transparent $true
  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

foreach ($density in @("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi")) {
  $iconPath = Join-Path $resRoot "mipmap-$density\ic_launcher.png"
  $roundPath = Join-Path $resRoot "mipmap-$density\ic_launcher_round.png"
  $foregroundPath = Join-Path $resRoot "mipmap-$density\ic_launcher_foreground.png"

  $iconImage = [System.Drawing.Image]::FromFile($iconPath)
  $size = [int]$iconImage.Width
  $iconImage.Dispose()
  Save-Icon -Path $iconPath -Size $size -Shape square
  Save-Icon -Path $roundPath -Size $size -Shape circle

  $foregroundImage = [System.Drawing.Image]::FromFile($foregroundPath)
  $foregroundSize = [int]$foregroundImage.Width
  $foregroundImage.Dispose()
  $bitmap = New-Object System.Drawing.Bitmap($foregroundSize, $foregroundSize)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Draw-Logo -Graphics $graphics -Size $foregroundSize -Transparent $true
  $bitmap.Save($foregroundPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$splashFiles = Get-ChildItem (Join-Path $resRoot "drawable*") -Filter "splash.png" -Recurse
foreach ($file in $splashFiles) {
  $source = [System.Drawing.Image]::FromFile($file.FullName)
  $width = $source.Width
  $height = $source.Height
  $source.Dispose()

  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($background)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $logoSize = [Math]::Min($width, $height) * 0.28
  $logoX = ($width - $logoSize) / 2
  $logoY = ($height * 0.42) - ($logoSize / 2)
  $graphics.TranslateTransform($logoX, $logoY)
  Draw-Logo -Graphics $graphics -Size $logoSize -Transparent $true
  $graphics.ResetTransform()

  $fontSize = [Math]::Max(16, $logoSize * 0.2)
  $font = New-Object System.Drawing.Font("Microsoft YaHei UI", $fontSize, [System.Drawing.FontStyle]::Regular)
  $brush = New-Object System.Drawing.SolidBrush($white)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, ($height * 0.56), $width, ($logoSize * 0.5))
  $appLabel = ([char]0x65E5).ToString() + ([char]0x5E8F).ToString()
  $graphics.DrawString($appLabel, $font, $brush, $rect, $format)

  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
  $graphics.Dispose()
  $bitmap.Save($file.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Write-Host "Android launcher icons and splash screens generated."
