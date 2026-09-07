Add-Type -AssemblyName System.Drawing

function Generate-NexusIcon([int]$size, [string]$path, [bool]$isMaskable) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background color - Royal Dark
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#090d16'))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Ambient Gold Glow
    $glowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 245, 158, 11))
    $glowSize = [int]($size * 0.75)
    $glowX = [int](($size - $glowSize) / 2)
    $glowY = [int](($size - $glowSize) / 2)
    $g.FillEllipse($glowBrush, $glowX, $glowY, $glowSize, $glowSize)

    # Inner Glow
    $glowBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 251, 191, 36))
    $glowSize2 = [int]($size * 0.45)
    $glowX2 = [int](($size - $glowSize2) / 2)
    $glowY2 = [int](($size - $glowSize2) / 2)
    $g.FillEllipse($glowBrush2, $glowX2, $glowY2, $glowSize2, $glowSize2)

    # Scale factor for crown
    $scale = $size / 512.0
    if ($isMaskable) {
        $scale = $scale * 0.72 # Safe zone padding for Android adaptive maskable icons
    }

    $cx = [float]($size / 2.0)
    $cy = [float](($size / 2.0) - (15.0 * $scale))

    # Crown Polygon Points
    $p1 = New-Object System.Drawing.PointF([float]($cx - 140.0 * $scale), [float]($cy - 60.0 * $scale))
    $p2 = New-Object System.Drawing.PointF([float]($cx - 90.0 * $scale),  [float]($cy + 20.0 * $scale))
    $p3 = New-Object System.Drawing.PointF([float]($cx),                 [float]($cy - 110.0 * $scale))
    $p4 = New-Object System.Drawing.PointF([float]($cx + 90.0 * $scale),  [float]($cy + 20.0 * $scale))
    $p5 = New-Object System.Drawing.PointF([float]($cx + 140.0 * $scale), [float]($cy - 60.0 * $scale))
    $p6 = New-Object System.Drawing.PointF([float]($cx + 105.0 * $scale), [float]($cy + 85.0 * $scale))
    $p7 = New-Object System.Drawing.PointF([float]($cx - 105.0 * $scale), [float]($cy + 85.0 * $scale))
    $pts = [System.Drawing.PointF[]]@($p1, $p2, $p3, $p4, $p5, $p6, $p7)

    # Crown Gradient Fill
    $rect = New-Object System.Drawing.RectangleF([float]($cx - 150.0 * $scale), [float]($cy - 120.0 * $scale), [float](300.0 * $scale), [float](220.0 * $scale))
    $goldGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.ColorTranslator]::FromHtml('#fbbf24'),
        [System.Drawing.ColorTranslator]::FromHtml('#d97706'),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $g.FillPolygon($goldGrad, $pts)

    # Crown Base Band
    $bandBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.RectangleF([float]($cx - 110.0 * $scale), [float]($cy + 92.0 * $scale), [float](220.0 * $scale), [float](24.0 * $scale))),
        [System.Drawing.ColorTranslator]::FromHtml('#fef08a'),
        [System.Drawing.ColorTranslator]::FromHtml('#b45309'),
        [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
    )
    $g.FillRectangle($bandBrush, [float]($cx - 105.0 * $scale), [float]($cy + 92.0 * $scale), [float](210.0 * $scale), [float](24.0 * $scale))

    # Crown jewels (circles on tips)
    $jewelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#fef08a'))
    $tipRadius = [float](14.0 * $scale)
    $g.FillEllipse($jewelBrush, [float]($cx - 140.0 * $scale - $tipRadius), [float]($cy - 60.0 * $scale - $tipRadius), [float]($tipRadius * 2), [float]($tipRadius * 2))
    $g.FillEllipse($jewelBrush, [float]($cx - $tipRadius), [float]($cy - 110.0 * $scale - $tipRadius), [float]($tipRadius * 2), [float]($tipRadius * 2))
    $g.FillEllipse($jewelBrush, [float]($cx + 140.0 * $scale - $tipRadius), [float]($cy - 60.0 * $scale - $tipRadius), [float]($tipRadius * 2), [float]($tipRadius * 2))

    # Center Royal Ruby in the crown
    $rubyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#f43f5e'))
    $rubySize = [float](22.0 * $scale)
    $g.FillEllipse($rubyBrush, [float]($cx - $rubySize / 2), [float]($cy + 25.0 * $scale - $rubySize / 2), $rubySize, $rubySize)

    # "NEXUS" text below crown
    if ($size -ge 192) {
        $fontFamily = New-Object System.Drawing.FontFamily('Arial')
        $fontSize = [float](36.0 * $scale)
        if ($isMaskable) { $fontSize = [float](32.0 * $scale) }
        $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold)
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#fde047'))
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textY = [float]($cy + (145.0 * $scale))
        $g.DrawString('NEXUS', $font, $textBrush, [float]$cx, [float]$textY, $sf)
    }

    # Save PNG
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $path"
}

Generate-NexusIcon 192 'D:\dark\client\public\icon-192.png' $false
Generate-NexusIcon 192 'D:\dark\client\public\icon-maskable-192.png' $true
Generate-NexusIcon 512 'D:\dark\client\public\icon-512.png' $false
Generate-NexusIcon 512 'D:\dark\client\public\icon-maskable-512.png' $true
Generate-NexusIcon 180 'D:\dark\client\public\apple-touch-icon.png' $false
Generate-NexusIcon 64  'D:\dark\client\public\favicon.png' $false
