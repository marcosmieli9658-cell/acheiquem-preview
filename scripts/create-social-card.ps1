param()

# Generate a purpose-built social card with Windows' bundled drawing API.
# No reference-image crop, external asset, font installation or new dependency.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot 'dist\assets\social-preview.png'
$fontPath = Join-Path $projectRoot 'dist\assets\fonts\nunito-sans.ttf'
$bitmap = New-Object System.Drawing.Bitmap 1200, 630
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile($fontPath)
$family = $fonts.Families[0]
$resources = [System.Collections.Generic.List[System.IDisposable]]::new()
function Color-Brush([string]$hex) {
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
  $resources.Add($brush)
  return $brush
}
function Label([string]$text, [single]$size, [single]$x, [single]$y, $brush, [bool]$bold = $false) {
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $font = [System.Drawing.Font]::new($family, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
  try { $graphics.DrawString($text, $font, $brush, $x, $y) } finally { $font.Dispose() }
}
try {
  $blue = Color-Brush '#245af2'
  $white = Color-Brush '#ffffff'
  $coral = Color-Brush '#ff805d'
  $pale = Color-Brush '#e9f0ff'
  $navy = Color-Brush '#132b4b'
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#245af2'))
  Label 'Achei' 40 66 51 $white $true
  Label 'Quem' 40 170 51 $coral $true
  Label 'VALE DO PARAÍBA · SP' 20 869 67 $white $true
  Label 'Bora tirar isso' 85 62 170 $white $true
  Label 'da lista?' 85 62 267 $coral $true
  Label 'Profissionais de serviços.' 31 67 389 $white
  Label 'Perto de você, no Vale do Paraíba paulista.' 28 67 432 $pale

  # A simplified magnifying-glass/person mark, drawn for this card.
  $ring = [System.Drawing.Pen]::new($white, 22)
  $handle = [System.Drawing.Pen]::new($white, 28)
  $handle.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $handle.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $resources.Add($ring)
  $resources.Add($handle)
  $graphics.DrawLine($handle, 1047, 321, 1109, 383)
  $graphics.FillEllipse($blue, 864, 150, 224, 224)
  $graphics.DrawEllipse($ring, 875, 161, 202, 202)
  $graphics.FillEllipse($coral, 947, 200, 58, 58)
  $body = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $body.AddBezier(912, 309, 947, 260, 1005, 260, 1040, 309)
  $body.AddBezier(1040, 309, 1004, 352, 946, 352, 912, 309)
  $body.CloseFigure()
  $graphics.FillPath($white, $body)
  $body.Dispose()

  $graphics.FillRectangle($white, 70, 532, 409, 43)
  Label 'PRÉVIA · DADOS FICTÍCIOS' 21 88 538 $navy $true
  Label 'acheiquem.pages.dev' 22 868 540 $white
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output 'Generated dist/assets/social-preview.png (1200 x 630).'
} finally {
  foreach ($resource in $resources) { $resource.Dispose() }
  $fonts.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
