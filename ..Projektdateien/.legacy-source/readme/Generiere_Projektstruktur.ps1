# Definiere die Funktion zum Anzeigen der Verzeichnisstruktur
function Show-DirectoryStructure {
    param (
        [string]$Path,
        [int]$Level = 0,
        [System.IO.StreamWriter]$Writer,
        [string]$Indent = ""
    )
    
    $items = Get-ChildItem -Path $Path -Force | Where-Object { 
        ($_.FullName -notmatch '\\coverage\\lcov-report\\' -or $_.FullName -eq "$Path\coverage\lcov-report") -and 
        ($_.FullName -notmatch '\\.git\\' -or $_.FullName -eq "$Path\.git") -and
        ($_.FullName -notmatch '\\node_modules\\' -or $_.FullName -eq "$Path\node_modules")
    }
    $itemCount = $items.Count
    $currentItem = 0

    foreach ($item in $items) {
        $currentItem++
        $symbol = if ($currentItem -eq $itemCount) { "└──" } else { "├──" }
        $newIndent = if ($currentItem -eq $itemCount) { "$Indent    " } else { "$Indent│   " }

        if ($item.PSIsContainer) {
            $Writer.WriteLine("$Indent$symbol $($item.Name)/")
            if ($item.Name -ne "lcov-report" -and $item.Name -ne ".git" -and $item.Name -ne "node_modules") {
                Show-DirectoryStructure -Path $item.FullName -Level ($Level + 1) -Writer $Writer -Indent $newIndent
            } else {
                $Writer.WriteLine("$newIndent[Hier wurde der Rest ausgelassen.]")
            }
        } else {
            $Writer.WriteLine("$Indent$symbol $($item.Name)")
        }
    }
}

# Definiere den Pfad des Startverzeichnisses
$startPath = "C:\Users\Christoph\Code\HTMLProjects\Erfassung der Therapiedauer"

# Definiere den Pfad der Ausgabedatei direkt
$outputDir = "C:\Users\Christoph\Code\HTMLProjects\Erfassung der Therapiedauer\readme"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir
}
$outputFile = Join-Path -Path $outputDir -ChildPath "Projektstruktur.txt"

# Erstelle einen StreamWriter
$writer = [System.IO.StreamWriter]::new($outputFile, $false)

# Schreibe den Namen des Rootverzeichnisses
$writer.WriteLine("Erfassung der Therapiedauer/")

# Schreibe die Verzeichnisstruktur in die Ausgabedatei
Show-DirectoryStructure -Path $startPath -Writer $writer

# Schließe den StreamWriter
$writer.Close()

Write-Host "Die Verzeichnisstruktur wurde in '$outputFile' gespeichert."
