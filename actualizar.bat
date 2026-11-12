@echo off
title Taller Jhos - Actualizar
chcp 65001 > nul
cd /d "C:\Users\celulab\Desktop\taller-app"
cls
echo ====================================================
echo        ACTUALIZANDO TALLER JHOS (aplica mejoras)
echo ====================================================
echo.
echo 1/3 Deteniendo el servidor...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo 2/3 Compilando la nueva version (tarda 1 a 2 minutos)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] La compilacion fallo. Revisa el mensaje de arriba.
    pause
    exit /b 1
)
echo 3/3 Iniciando el servidor...
start "Taller Jhos - Servidor" /min cmd /c "cd /d C:\Users\celulab\Desktop\taller-app && npm start"
ping 127.0.0.1 -n 5 > nul
start http://localhost:3000
echo.
echo Listo. La aplicacion quedo actualizada.
ping 127.0.0.1 -n 4 > nul
