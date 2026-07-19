$Path = 'c:\Users\Rishikesh\OneDrive\Desktop\REPPP.docx'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-ZipText($Zip, $Name) {
  $entry = $Zip.GetEntry($Name)
  if ($null -eq $entry) { throw "Missing $Name" }
  $reader = New-Object System.IO.StreamReader($entry.Open())
  try { return $reader.ReadToEnd() } finally { $reader.Close() }
}

function Write-ZipText($Zip, $Name, $Text) {
  $old = $Zip.GetEntry($Name)
  if ($null -ne $old) { $old.Delete() }
  $entry = $Zip.CreateEntry($Name, [System.IO.Compression.CompressionLevel]::Optimal)
  $writer = New-Object System.IO.StreamWriter($entry.Open(), [System.Text.UTF8Encoding]::new($false))
  try { $writer.Write($Text) } finally { $writer.Close() }
}

function Add-Ns($Doc) {
  $nsm = New-Object System.Xml.XmlNamespaceManager($Doc.NameTable)
  $nsm.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $nsm.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  return $nsm
}

function W-El($Doc, $Name) {
  return $Doc.CreateElement('w', $Name, 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
}

function Set-WAttr($Doc, $El, $Name, $Value) {
  $attr = $Doc.CreateAttribute('w', $Name, 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $attr.Value = $Value
  $El.Attributes.Append($attr) | Out-Null
}

function Set-RAttr($Doc, $El, $Name, $Value) {
  $attr = $Doc.CreateAttribute('r', $Name, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $attr.Value = $Value
  $El.Attributes.Append($attr) | Out-Null
}

function Remove-ChildrenByLocalName($El, $LocalName) {
  $remove = @()
  foreach ($child in $El.ChildNodes) {
    if ($child.LocalName -eq $LocalName -and $child.NamespaceURI -eq 'http://schemas.openxmlformats.org/wordprocessingml/2006/main') {
      $remove += $child
    }
  }
  foreach ($child in $remove) { $El.RemoveChild($child) | Out-Null }
}

function Ensure-FooterRef($Doc, $SectPr, $Rid) {
  Remove-ChildrenByLocalName $SectPr 'footerReference'
  $ref = W-El $Doc 'footerReference'
  Set-WAttr $Doc $ref 'type' 'default'
  Set-RAttr $Doc $ref 'id' $Rid
  $SectPr.PrependChild($ref) | Out-Null
}

function Set-PgNum($Doc, $SectPr, $Fmt, $Start) {
  Remove-ChildrenByLocalName $SectPr 'pgNumType'
  $pg = W-El $Doc 'pgNumType'
  if ($Fmt) { Set-WAttr $Doc $pg 'fmt' $Fmt }
  if ($Start) { Set-WAttr $Doc $pg 'start' $Start }
  $SectPr.AppendChild($pg) | Out-Null
}

function Paragraph-Text($P, $Nsm) {
  $parts = @()
  foreach ($t in $P.SelectNodes(".//*[local-name()='t']")) { $parts += $t.InnerText }
  return (($parts -join '') -replace '\s+', ' ').Trim()
}

function Set-CellText($Cell, $Nsm, $Value) {
  $texts = @($Cell.SelectNodes(".//*[local-name()='t']"))
  if ($texts.Count -eq 0) { throw 'TOC cell has no text node.' }
  $texts[0].InnerText = $Value
  for ($i = 1; $i -lt $texts.Count; $i++) {
    $texts[$i].InnerText = ''
  }
}

$zip = [System.IO.Compression.ZipFile]::Open($Path, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $docXml = New-Object System.Xml.XmlDocument
  $docXml.PreserveWhitespace = $true
  $docXml.LoadXml((Read-ZipText $zip 'word/document.xml'))
  $nsm = Add-Ns $docXml

  $body = $docXml.SelectSingleNode("//*[local-name()='body']")
  $paragraphs = @($body.SelectNodes("*[local-name()='p']"))

  $introP = $null
  foreach ($p in $paragraphs) {
    if ((Paragraph-Text $p $nsm) -eq '1. INTRODUCTION') {
      $introP = $p
      break
    }
  }
  if ($null -eq $introP) { throw 'Could not find 1. INTRODUCTION paragraph.' }

  $sectPrs = @($docXml.SelectNodes("//*[local-name()='sectPr']"))
  $hasBreakBeforeIntro = $false
  $prev = $introP.PreviousSibling
  while ($null -ne $prev -and $prev.NodeType -ne [System.Xml.XmlNodeType]::Element) { $prev = $prev.PreviousSibling }
  if ($null -ne $prev -and $prev.LocalName -eq 'p' -and $null -ne $prev.SelectSingleNode("*[local-name()='pPr']/*[local-name()='sectPr']")) {
    $hasBreakBeforeIntro = $true
  }

  if (-not $hasBreakBeforeIntro) {
    $sourceSect = $sectPrs[$sectPrs.Count - 1].CloneNode($true)
    Ensure-FooterRef $docXml $sourceSect 'rId9'
    Set-PgNum $docXml $sourceSect 'lowerRoman' $null

    $breakP = W-El $docXml 'p'
    $pPr = W-El $docXml 'pPr'
    $pPr.AppendChild($sourceSect) | Out-Null
    $breakP.AppendChild($pPr) | Out-Null
    $body.InsertBefore($breakP, $introP) | Out-Null
  }

  $sectPrs = @($docXml.SelectNodes("//*[local-name()='sectPr']"))

  # Section 1: cover page, no page number/footer reference.
  Remove-ChildrenByLocalName $sectPrs[0] 'footerReference'
  Remove-ChildrenByLocalName $sectPrs[0] 'pgNumType'

  # Section 2 begins after cover: lower roman starting at i.
  Ensure-FooterRef $docXml $sectPrs[1] 'rId9'
  Set-PgNum $docXml $sectPrs[1] 'lowerRoman' '1'

  # All remaining preliminary sections before the final section continue lower roman.
  for ($i = 2; $i -lt ($sectPrs.Count - 1); $i++) {
    Ensure-FooterRef $docXml $sectPrs[$i] 'rId9'
    Set-PgNum $docXml $sectPrs[$i] 'lowerRoman' $null
  }

  # Final section starts at Introduction: Arabic page 1.
  Ensure-FooterRef $docXml $sectPrs[$sectPrs.Count - 1] 'rId17'
  Set-PgNum $docXml $sectPrs[$sectPrs.Count - 1] 'decimal' '1'

  # Manual Table of Contents: update page-number column.
  $toc = @($docXml.SelectNodes("//*[local-name()='tbl']"))[0]
  $rows = @($toc.SelectNodes("*[local-name()='tr']"))
  $updates = @{
    1 = 'iii'
    2 = 'iv'
    3 = '1'
    4 = '2'
    5 = '4'
    6 = '5'
    7 = '7'
    8 = '10'
    9 = '15'
    10 = '16'
    11 = '17'
  }
  foreach ($idx in $updates.Keys) {
    $cells = @($rows[$idx].SelectNodes("*[local-name()='tc']"))
    Set-CellText $cells[2] $nsm $updates[$idx]
  }

  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
  $settings.OmitXmlDeclaration = $false
  $settings.Indent = $false
  $sw = New-Object System.IO.StringWriter
  $xw = [System.Xml.XmlWriter]::Create($sw, $settings)
  $docXml.Save($xw)
  $xw.Close()
  $documentText = $sw.ToString() -replace 'encoding="utf-16"', 'encoding="UTF-8"'
  Write-ZipText $zip 'word/document.xml' $documentText
}
finally {
  $zip.Dispose()
}

Write-Output "Fixed REPPP.docx page numbers and TOC XML."
