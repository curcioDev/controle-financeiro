$projectDir = "c:\Users\mlbba\Desktop\controle-financeiro"
$batPath = Join-Path $projectDir "start-app.bat"
$startupPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\StartControleFinanceiro.lnk"
$desktopPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Start Controle Financeiro.lnk"

function Create-Shortcut {
    param($Path, $TargetPath, $WorkingDirectory)
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($Path)
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.WorkingDirectory = $WorkingDirectory
    $Shortcut.WindowStyle = 7 # Minimized
    $Shortcut.Save()
}

echo "Criando atalho na pasta de inicialização..."
Create-Shortcut -Path $startupPath -TargetPath $batPath -WorkingDirectory $projectDir

echo "Criando atalho na área de trabalho..."
Create-Shortcut -Path $desktopPath -TargetPath $batPath -WorkingDirectory $projectDir

echo "Concluído! O sistema iniciará automaticamente ao ligar o PC."
