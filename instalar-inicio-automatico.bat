@echo off
chcp 65001 > nul
cls
echo ====================================================
echo    CONFIGURAR INICIO AUTOMATICO - TALLER JHOS
echo ====================================================
echo.
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Taller Jhos - Servidor Automatico.lnk'); $s.TargetPath = 'C:\Users\celulab\Desktop\taller-app\iniciar-automatico.bat'; $s.WorkingDirectory = 'C:\Users\celulab\Desktop\taller-app'; $s.WindowStyle = 7; if (Test-Path 'C:\Program Files\nodejs\node.exe') { $s.IconLocation = 'C:\Program Files\nodejs\node.exe,0' }; $s.Save()"
echo [OK] El servidor de Taller Jhos se iniciara automaticamente cada vez que enciendas el PC.
echo.
pause