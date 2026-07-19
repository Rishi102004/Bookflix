Add-Type -AssemblyName System.Drawing

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$OutDir = Join-Path $Root "project_screenshots"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$Books = Import-Csv (Join-Path $Root "backend\data\books.csv") | Select-Object -First 60

function New-Canvas($w = 1440, $h = 950, $bg = "#111111") {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml($bg))
  return @($bmp, $g)
}

function Brush($hex) { New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function Pen($hex, $width = 1) { New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($hex)), $width }
function Font($size, $style = "Regular") { New-Object System.Drawing.Font "Segoe UI", $size, ([System.Drawing.FontStyle]::$style) }
function Text($g, $text, $x, $y, $size, $color = "#ffffff", $style = "Regular", $w = 1200, $h = 80) {
  $g.DrawString([string]$text, (Font $size $style), (Brush $color), (New-Object System.Drawing.RectangleF $x, $y, $w, $h))
}
function Rect($g, $x, $y, $w, $h, $color) { $g.FillRectangle((Brush $color), $x, $y, $w, $h) }
function Border($g, $x, $y, $w, $h, $color, $width = 1) { $g.DrawRectangle((Pen $color $width), $x, $y, $w, $h) }
function Save($bmp, $g, $name) {
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
function Short($s, $max = 34) {
  if ([string]::IsNullOrWhiteSpace($s)) { return "" }
  if ($s.Length -le $max) { return $s }
  return $s.Substring(0, $max - 3) + "..."
}
function BookCard($g, $book, $x, $y, $w = 170, $h = 250, $badge = "") {
  $colors = @("#243b53", "#5c2d2d", "#264d3b", "#4c3575", "#5a4528", "#2d4059")
  $idx = [Math]::Abs(([string]$book.title).GetHashCode()) % $colors.Count
  Rect $g $x $y $w $h $colors[$idx]
  Rect $g ($x + 8) ($y + 8) ($w - 16) ($h - 16) "#161616"
  $titleSize = $(if ($h -lt 110) { 9 } elseif ($h -lt 180) { 11 } else { 15 })
  $authorSize = $(if ($h -lt 110) { 7 } else { 10 })
  Text $g (Short $book.title 24) ($x + 14) ($y + [Math]::Max(14, [Math]::Floor($h * 0.18))) $titleSize "#f8d98a" "Bold" ($w - 28) ([Math]::Max(28, [Math]::Floor($h * 0.28)))
  Text $g (Short $book.author 24) ($x + 14) ($y + [Math]::Max(42, [Math]::Floor($h * 0.56))) $authorSize "#d1d5db" "Regular" ($w - 28) 32
  Rect $g $x ($y + $h - 38) $w 38 "#000000"
  Text $g (Short $book.genre 22) ($x + 12) ($y + $h - 30) $authorSize "#9ca3af" "Regular" ($w - 24) 20
  if ($badge) {
    Rect $g ($x + $w - 72) $y 72 26 "#f59e0b"
    Text $g $badge ($x + $w - 66) ($y + 4) 9 "#111111" "Bold" 66 20
  }
}

function Figure1 {
  $c = New-Canvas 1440 950 "#f8fafc"; $bmp = $c[0]; $g = $c[1]
  Text $g "Figure 1: System Architecture" 0 45 32 "#111827" "Bold" 1440 60
  $nodes = @(
    @("Client", "Next.js Bookflix UI`nProfile, Browse, Search, Modal"),
    @("FastAPI Server", "REST APIs`n/users /books /search /recommend"),
    @("ML Engine", "Hybrid recommendations`nCF + content similarity"),
    @("CSV Data", "books.csv + ratings.csv`nCatalog and interactions")
  )
  $x = 80
  foreach ($n in $nodes) {
    Rect $g $x 300 260 190 "#ffffff"; Border $g $x 300 260 190 "#d1d5db" 3
    Text $g $n[0] ($x + 24) 330 22 "#111827" "Bold" 220 35
    Text $g $n[1] ($x + 24) 385 14 "#4b5563" "Regular" 220 80
    if ($x -lt 1040) { Text $g "->" ($x + 282) 360 36 "#f59e0b" "Bold" 80 60 }
    $x += 340
  }
  $labels = @("Profile State", "Caching + CORS", "Similarity Scoring", "Admin Metrics")
  for ($i = 0; $i -lt 4; $i++) { Rect $g (180 + $i * 280) 610 230 52 "#111827"; Text $g $labels[$i] (205 + $i * 280) 624 14 "#ffffff" "Bold" 190 28 }
  Save $bmp $g "Figure_1_System_Architecture.png"
}

function Figure2 {
  $c = New-Canvas; $bmp = $c[0]; $g = $c[1]
  Text $g "BOOKFLIX" 48 32 34 "#f59e0b" "Bold" 250 50
  Text $g "Who is reading today?" 390 240 44 "#ffffff" "Regular" 700 70
  $names = @("Chitesh", "Yeshu", "Rishi", "Varun"); $colors = @("#1e3a8a", "#7c2d12", "#065f46", "#581c87")
  for ($i = 0; $i -lt 4; $i++) {
    $x = 290 + $i * 220
    Rect $g $x 380 160 160 $colors[$i]
    Text $g $names[$i].Substring(0,1) ($x + 52) 415 54 "#ffffff" "Bold" 80 80
    Text $g $names[$i] ($x + 22) 562 20 "#a3a3a3" "Regular" 140 36
  }
  Border $g 600 705 240 48 "#777777" 1
  Text $g "MANAGE PROFILES" 628 718 12 "#8b8b8b" "Bold" 190 22
  Save $bmp $g "Figure_2_Profile_Selection_Screen.png"
}

function Figure3 {
  $c = New-Canvas; $bmp = $c[0]; $g = $c[1]; $hero = $Books[0]
  Rect $g 0 0 1440 70 "#090909"; Text $g "BOOKFLIX" 48 18 24 "#f59e0b" "Bold" 185 36
  Text $g "Home     Series     Authors     My List" 245 25 12 "#d1d5db" "Regular" 420 25
  Text $g "Search     Bell     C" 1180 25 12 "#ffffff" "Regular" 210 25
  Rect $g 0 70 1440 555 "#151515"; Rect $g 770 70 670 555 "#262626"
  Text $g (Short $hero.title 30) 52 255 42 "#f59e0b" "Bold" 650 105
  Text $g "$($hero.author)  -  $($hero.year_of_publication)  -  $($hero.publisher)" 54 370 16 "#d1d5db" "Regular" 720 34
  Text $g "A literary journey awaits. Explore the compelling world of this book and discover why readers around the globe are captivated by it." 54 425 14 "#e5e7eb" "Regular" 650 70
  Rect $g 54 525 116 44 "#f59e0b"; Text $g "Read" 88 535 14 "#ffffff" "Bold" 80 24
  Rect $g 188 525 135 44 "#27272a"; Border $g 188 525 135 44 "#555555"; Text $g "Insights" 222 535 14 "#ffffff" "Bold" 90 24
  $titles = @("Recommended for You", "Trending Now", "Popular Series")
  for ($r = 0; $r -lt 3; $r++) {
    $y = 635 + $r * 96
    Text $g $titles[$r] 48 ($y - 34) 18 "#e5e7eb" "Bold" 300 30
    for ($i = 0; $i -lt 7; $i++) { BookCard $g $Books[($r * 8 + $i + 4)] (48 + $i * 192) $y 170 78 ($(if($r -eq 0){"$((92-$i))%"}else{""})) }
  }
  Save $bmp $g "Figure_3_Browse_Page_Hero_And_Carousels.png"
}

function Figure4 {
  $c = New-Canvas; $bmp = $c[0]; $g = $c[1]; $b = $Books[8]
  Rect $g 190 35 1060 880 "#18181b"; Border $g 190 35 1060 880 "#3f3f46" 2
  Rect $g 190 35 1060 330 "#263040"
  Text $g (Short $b.title 38) 230 250 34 "#ffffff" "Bold" 820 55
  Rect $g 230 320 120 42 "#f59e0b"; Text $g "Details" 262 330 13 "#ffffff" "Bold" 75 24
  Rect $g 365 320 170 42 "#4f46e5"; Text $g "Read Online" 390 330 13 "#ffffff" "Bold" 130 24
  Text $g "+   Like   Dislike" 540 329 13 "#ffffff" "Regular" 260 28
  Text $g "92% Match" 230 400 13 "#4ade80" "Bold" 115 25
  Text $g "$($b.year_of_publication)     HD" 330 400 13 "#d1d5db" "Regular" 180 25
  Text $g "Experience the captivating story of $($b.title). A critically acclaimed work that has left an indelible mark on its readers. Dive deep into the pages and explore the vivid imagination of the author." 230 438 16 "#e5e7eb" "Regular" 620 120
  Text $g "Author: $($b.author)`nPublisher: $($b.publisher)`nGenre: $($b.genre)" 905 410 12 "#d1d5db" "Regular" 280 95
  Rect $g 190 585 1060 190 "#111111"; Text $g "AI Reading Insights" 230 610 18 "#f59e0b" "Bold" 300 35
  Rect $g 230 660 280 72 "#18181b"; Border $g 230 660 280 72 "#3f3f46"; Text $g "Estimated Read Time`n~$([Math]::Max(2, [Math]::Floor($b.title.Length / 5))) hours" 248 674 12 "#d1d5db" "Bold" 230 45
  Rect $g 530 660 280 72 "#18181b"; Border $g 530 660 280 72 "#3f3f46"; Text $g "Book Vibe`nAtmospheric by similar readers" 548 674 12 "#d1d5db" "Bold" 230 45
  Rect $g 830 660 360 72 "#312e81"; Border $g 830 660 360 72 "#6366f1"; Text $g "Why you should read this`nHybrid recommendations found a strong match." 848 674 11 "#e0e7ff" "Bold" 325 48
  Text $g "More Like This" 230 805 18 "#e5e7eb" "Bold" 250 30
  for ($i = 0; $i -lt 5; $i++) { BookCard $g $Books[$i + 15] (230 + $i * 150) 845 130 55 "" }
  Save $bmp $g "Figure_4_Book_Detail_Modal_Hybrid_AI_Insights.png"
}

function Figure5 {
  Figure3
  $path = Join-Path $OutDir "Figure_3_Browse_Page_Hero_And_Carousels.png"
  $bmp = [System.Drawing.Bitmap]::FromFile($path); $g = [System.Drawing.Graphics]::FromImage($bmp)
  Rect $g 980 18 320 38 "#000000"; Border $g 980 18 320 38 "#f59e0b"; Text $g "Harry Potter" 1000 27 12 "#ffffff" "Regular" 260 20
  Rect $g 940 70 360 340 "#18181b"; Border $g 940 70 360 340 "#3f3f46"
  for ($i = 0; $i -lt 5; $i++) {
    $b = $Books[$i + 20]; $y = 80 + $i * 64
    Rect $g 952 $y 42 56 "#263040"
    Text $g (Short $b.title 30) 1010 ($y + 6) 11 "#ffffff" "Bold" 250 22
    Text $g (Short $b.author 32) 1010 ($y + 30) 9 "#a3a3a3" "Regular" 250 18
  }
  Save $bmp $g "Figure_5_Navbar_Search_Live_Dropdown.png"
}

function Figure6 {
  $c = New-Canvas 1440 950 "#f4f5f7"; $bmp = $c[0]; $g = $c[1]
  Text $g "Admin Metrics Dashboard" 160 70 30 "#1e3a8a" "Bold" 520 55
  Rect $g 1120 72 145 42 "#e5e7eb"; Text $g "Back to App" 1145 83 12 "#374151" "Bold" 110 22
  Text $g "Live KPIs and ML system interaction monitoring." 160 135 13 "#6b7280" "Regular" 620 30
  $metrics = @(
    @("Total Recommends", "128", "#4f46e5", ""),
    @("A/B Test CTR", "41.7%", "#22c55e", "(53 Clicks)"),
    @("Redis Cache Hits", "24", "#f97316", "Sub-200ms requests"),
    @("Precision (Feedback)", "83.3%", "#3b82f6", "Thumbs up 25   Thumbs down 5")
  )
  for ($i = 0; $i -lt 4; $i++) {
    $x = 160 + $i * 285
    Rect $g $x 230 250 190 "#ffffff"; Border $g $x 230 250 190 "#e5e7eb"
    Text $g $metrics[$i][0] ($x + 26) 260 10 "#6b7280" "Bold" 200 22
    Text $g $metrics[$i][1] ($x + 26) 295 34 $metrics[$i][2] "Bold" 200 58
    Text $g $metrics[$i][3] ($x + 26) 360 10 "#9ca3af" "Regular" 200 28
  }
  Save $bmp $g "Figure_6_Admin_Dashboard_Metrics.png"
}

Figure1
Figure2
Figure3
Figure4
Figure5
Figure6
Write-Output $OutDir
