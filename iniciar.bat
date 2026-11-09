@echo off
title Taller Jhos - Servidor Local
chcp 65001 > nul
cd /d "C:\Users\celulab\Desktop\taller-app"
cls

echo ====================================================
echo           SISTEMA DE TALLER DE REPARACIONES
echo                      TALLER JHOS
echo ====================================================
echo.

REM 1. Comprobar si el servidor ya esta en ejecucion
curl.exe -s -o nul -m 1 http://localhost:3000/login
if %ERRORLEVEL% EQU 0 (
    echo [OK] El servidor ya esta encendido y funcionando.
    echo Abriendo la aplicacion en el navegador...
    start http://localhost:3000
    ping 127.0.0.1 -n 3 > nul
    exit /b 0
)

echo Iniciando el servidor local de Taller Jhos...
echo.
echo   - Desde este PC:  http://localhost:3000
powershell -NoProfile -Command "Write-Host '  - Desde tu iPad:  http://DESKTOP-EHAOJI9.local:3000'; $ip = (Get-NetIPAddress -InterfaceAlias @('Wi-Fi*','Ethernet*') -AddressFamily IPv4).IPAddress; if ($ip) { Write-Host ('  - O por IP:      http://' + $ip + ':3000') }"
echo.
echo Presiona Ctrl + C para detener el servidor.
echo ====================================================
echo.

REM 2. Liberar el puerto 3000 si habia quedado un proceso colgado
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM 3. Abrir el navegador automaticamente una vez este listo
start "" /b cmd /c "ping 127.0.0.1 -n 4 > nul && start http://localhost:3000"

REM 4. Iniciar Next.js
call npm start

pause