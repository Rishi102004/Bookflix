$Path = 'c:\Users\Rishikesh\OneDrive\Desktop\REPPP.docx'

$wdSectionBreakContinuous = 3
$wdAlignPageNumberCenter = 1
$wdPageNumberStyleArabic = 0
$wdPageNumberStyleLowercaseRoman = 2
$wdHeaderFooterPrimary = 1
$wdHeaderFooterFirstPage = 2
$wdHeaderFooterEvenPages = 3
$wdFieldPage = 33

function Clean-PageFields($Footer) {
  try {
    for ($i = $Footer.Range.Fields.Count; $i -ge 1; $i--) {
      $field = $Footer.Range.Fields.Item($i)
      if ($field.Type -eq $wdFieldPage) {
        $field.Delete()
      }
    }
  } catch {}
}

function Add-CenteredPageNumber($Footer, $NumberStyle, $Restart, $StartNumber) {
  try {
    $Footer.LinkToPrevious = $false
    Clean-PageFields $Footer
    $Footer.PageNumbers.NumberStyle = $NumberStyle
    $Footer.PageNumbers.RestartNumberingAtSection = $Restart
    if ($Restart) {
      $Footer.PageNumbers.StartingNumber = $StartNumber
    }
    $Footer.PageNumbers.Add($wdAlignPageNumberCenter, $false) | Out-Null
  } catch {}
}

function Remove-PageNumbers($Footer) {
  try {
    $Footer.LinkToPrevious = $false
    Clean-PageFields $Footer
  } catch {}
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
  $doc = $word.Documents.Open($Path, $false, $false)

  # Locate the real Introduction heading, not the TOC entry.
  $introPara = $null
  for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
    $p = $doc.Paragraphs.Item($i)
    $txt = ($p.Range.Text -replace "[`r`n`t]", '').Trim()
    if ($txt -eq '1. INTRODUCTION') {
      $introPara = $p
      break
    }
  }
  if ($null -eq $introPara) {
    throw 'Could not find the "1. INTRODUCTION" heading.'
  }

  # If acknowledgement/abstract content is in the same section as Introduction,
  # split immediately before Introduction without adding a new page.
  $introSection = $introPara.Range.Sections.Item(1)
  $needsBreak = $false
  for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
    $p = $doc.Paragraphs.Item($i)
    if ($p.Range.Start -ge $introPara.Range.Start) { break }
    if ($p.Range.Start -ge $introSection.Range.Start) {
      $txt = ($p.Range.Text -replace "[`r`n`t]", '').Trim()
      if ($txt.Length -gt 0) {
        $needsBreak = $true
        break
      }
    }
  }

  if ($needsBreak) {
    $split = $doc.Range($introPara.Range.Start, $introPara.Range.Start)
    $split.InsertBreak($wdSectionBreakContinuous)
  }

  # Re-locate Introduction after inserting the section break.
  $introPara = $null
  for ($i = 1; $i -le $doc.Paragraphs.Count; $i++) {
    $p = $doc.Paragraphs.Item($i)
    $txt = ($p.Range.Text -replace "[`r`n`t]", '').Trim()
    if ($txt -eq '1. INTRODUCTION') {
      $introPara = $p
      break
    }
  }
  $introSectionIndex = $introPara.Range.Sections.Item(1).Index

  # Cover page: no page number.
  $cover = $doc.Sections.Item(1)
  foreach ($idx in @($wdHeaderFooterPrimary, $wdHeaderFooterFirstPage, $wdHeaderFooterEvenPages)) {
    Remove-PageNumbers $cover.Footers.Item($idx)
  }

  # Preliminary pages after cover and before Introduction: Roman numbering.
  for ($s = 2; $s -lt $introSectionIndex; $s++) {
    $section = $doc.Sections.Item($s)
    $restart = ($s -eq 2)
    foreach ($idx in @($wdHeaderFooterPrimary, $wdHeaderFooterFirstPage, $wdHeaderFooterEvenPages)) {
      Add-CenteredPageNumber $section.Footers.Item($idx) $wdPageNumberStyleLowercaseRoman $restart 1
    }
  }

  # Introduction onward: Arabic numbering starting at 1.
  for ($s = $introSectionIndex; $s -le $doc.Sections.Count; $s++) {
    $section = $doc.Sections.Item($s)
    $restart = ($s -eq $introSectionIndex)
    foreach ($idx in @($wdHeaderFooterPrimary, $wdHeaderFooterFirstPage, $wdHeaderFooterEvenPages)) {
      Add-CenteredPageNumber $section.Footers.Item($idx) $wdPageNumberStyleArabic $restart 1
    }
  }

  # Update the manual Table of Contents page-number column.
  $toc = $doc.Tables.Item(1)
  $updates = @{
    2 = 'iii'  # Acknowledgement
    3 = 'iv'   # Abstract
    4 = '1'    # Introduction
    5 = '2'    # Problem Statement
    6 = '4'    # Objectives
    7 = '5'    # Dataset Used
    8 = '7'    # Methodology
    9 = '10'   # Results and Discussion
    10 = '15'  # Applications
    11 = '16'  # Conclusion
    12 = '17'  # References
  }
  foreach ($row in $updates.Keys) {
    $cellRange = $toc.Cell($row, 3).Range
    $cellRange.End = $cellRange.End - 1
    $cellRange.Text = $updates[$row]
  }

  $doc.Save()
  $doc.Close($false)
}
finally {
  $word.Quit()
}

Write-Output "Fixed page numbers and TOC in $Path"
