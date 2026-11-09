@echo off
chcp 65001 > nul
cls
echo ====================================================
echo   DESACTIVAR INICIO AUTOMATICO - TALLER JHOS
echo ====================================================
echo.
powershell -NoProfile -Command "Remove-Item '$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Taller Jhos - Servidor Automatico.lnk' -Force -ErrorAction SilentlyContinue"
echo [OK] Se ha removido el inicio automatico.
echo.
pause