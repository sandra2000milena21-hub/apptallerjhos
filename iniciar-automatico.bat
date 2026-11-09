@echo off
title Taller Jhos - Servidor Automatico
chcp 65001 > nul
cd /d "C:\Users\celulab\Desktop\taller-app"

REM Esperar 3 segundos para que Windows termine de inicializar adaptadores de red
ping 127.0.0.1 -n 4 > nul

REM Comprobar si ya esta en ejecucion
curl.exe -s -o nul -m 1 http://localhost:3000/login
if %ERRORLEVEL% EQU 0 exit /b 0

REM Liberar puerto 3000 si habia quedado bloqueado
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Abrir el navegador en 3 segundos
start "" /b cmd /c "ping 127.0.0.1 -n 4 > nul && start http://localhost:3000"

REM Iniciar Next.js
call npm start