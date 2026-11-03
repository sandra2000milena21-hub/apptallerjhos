@echo off
title Taller App - Modo Desarrollo
chcp 65001 > nul
cls

echo ====================================================
echo        SISTEMA DE TALLER - MODO DESARROLLO
echo ====================================================
echo.
echo Iniciando en http://localhost:3000...
echo.

start "" /b cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:3000"
npm run dev

pause
