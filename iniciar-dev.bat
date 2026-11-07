@echo off
title Taller App - Modo Desarrollo
chcp 65001 > nul
cls

echo ====================================================
echo        SISTEMA DE TALLER - MODO DESARROLLO
echo                      TALLER JHOS
echo ====================================================
echo.
echo Iniciando el servidor de desarrollo...
echo.
echo   - Desde este PC:  http://localhost:3000
echo   - Desde tu iPad:   http://192.168.20.97:3000
echo.
echo ====================================================
echo.

start "" /b cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:3000"
npm run dev

pause
