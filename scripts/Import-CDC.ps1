$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'docs\AETHER_First_Life_CDC_v0.1.docx'
$archive = [System.IO.Compression.ZipFile]::OpenRead($sourcePath)
try {
    $reader = [System.IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
    [xml]$document = $reader.ReadToEnd()
    $reader.Dispose()
    $ns = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
    $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    function Get-ParagraphText($paragraph) {
        $parts = foreach ($node in $paragraph.SelectNodes('.//w:t | .//w:br | .//w:tab', $ns)) {
            switch ($node.LocalName) {
                't' { $node.InnerText }
                'br' { "`n" }
                'tab' { "`t" }
            }
        }
        return ($parts -join '')
    }
    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add('<!-- Transcription du document source AETHER_First_Life_CDC_v0.1.docx. Contenu conserve ; mise en forme Markdown. -->')
    $lines.Add('')
    $inCode = $false
    foreach ($node in $document.SelectSingleNode('//w:body', $ns).ChildNodes) {
        if ($node.LocalName -eq 'p') {
            $text = Get-ParagraphText $node
            if (-not $text) { continue }
            $styleNode = $node.SelectSingleNode('w:pPr/w:pStyle', $ns)
            $style = if ($styleNode) { $styleNode.GetAttribute('val', $ns.LookupNamespace('w')) } else { '' }
            if ($style -eq 'CodeAETHER') {
                if (-not $inCode) { $lines.Add('```text'); $inCode = $true }
                $lines.Add($text)
                continue
            }
            if ($inCode) { $lines.Add('```'); $lines.Add(''); $inCode = $false }
            switch ($style) {
                'Title' { $lines.Add('# ' + $text) }
                'Heading2' { $lines.Add('## ' + $text) }
                'Heading3' { $lines.Add('### ' + $text) }
                'ListBullet' { $lines.Add('- ' + $text) }
                default { $lines.Add($text) }
            }
            $lines.Add('')
        } elseif ($node.LocalName -eq 'tbl') {
            if ($inCode) { $lines.Add('```'); $lines.Add(''); $inCode = $false }
            $firstRow = $true
            foreach ($row in $node.SelectNodes('w:tr', $ns)) {
                $cells = foreach ($cell in $row.SelectNodes('w:tc', $ns)) {
                    $paragraphs = foreach ($paragraph in $cell.SelectNodes('w:p', $ns)) { Get-ParagraphText $paragraph }
                    (($paragraphs -join '<br>').Replace('|', '\|').Replace("`n", '<br>'))
                }
                $lines.Add('| ' + ($cells -join ' | ') + ' |')
                if ($firstRow) { $lines.Add('| ' + (($cells | ForEach-Object { '---' }) -join ' | ') + ' |'); $firstRow = $false }
            }
            $lines.Add('')
        }
    }
    if ($inCode) { $lines.Add('```') }
    [System.IO.File]::WriteAllText((Join-Path $projectRoot 'docs\CDC.md'), ($lines -join "`n") + "`n", [System.Text.UTF8Encoding]::new($false))
    Write-Output 'docs/CDC.md transcribed from the original Word document.'
} finally {
    $archive.Dispose()
}
