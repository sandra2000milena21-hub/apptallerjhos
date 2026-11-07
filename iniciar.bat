@echo off
title Taller App - Servidor Local
chcp 65001 > nul
cls

echo ====================================================
echo           SISTEMA DE TALLER DE REPARACIONES
echo                      TALLER JHOS
echo ====================================================
echo.
echo Iniciando el servidor local...
echo.
echo   - Desde este PC:  http://localhost:3000
echo   - Desde tu iPad:   http://192.168.20.97:3000
echo.
echo Presiona Ctrl + C en esta ventana para detener.
echo ====================================================
echo.

:: Abrir el navegador en 3 segundos
start "" /b cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:3000"

:: Iniciar Next.js
npm start

pause
