# Pfad der Ausgabedatei relativ zum Skript setzen
$outputFile = Join-Path -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) -ChildPath "Techstack.txt"

# Ausgabe in Techstack.txt speichern
Start-Transcript -Path $outputFile -Append

# Skript ausführen und Ausgaben speichern
try {
    Write-Host "=== Node & npm Versionen ===" -ForegroundColor Green
    node -v
    npm -v

    Write-Host "`n=== Installierte npm Pakete ===" -ForegroundColor Green
    npm list

    Write-Host "`n=== VS Code Extensions ===" -ForegroundColor Green
    code --list-extensions

    Write-Host "`n=== ESLint & Prettier ===" -ForegroundColor Green
    npx eslint --version
    Get-Content .eslintrc.js
    npx prettier --version
    Get-Content .prettierrc

    Write-Host "`n=== Live Server ===" -ForegroundColor Green
    npm list live-server

    Write-Host "`n=== CDN Dependencies ===" -ForegroundColor Green
    Get-ChildItem -Filter *.html -Recurse | Select-String -Pattern "cdn"
}
finally {
    Stop-Transcript
}
