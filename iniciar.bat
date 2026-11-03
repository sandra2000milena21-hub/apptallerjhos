@echo off
title Taller App - Servidor Local
chcp 65001 > nul
cls

echo ====================================================
echo           SISTEMA DE TALLER DE REPARACIONES
echo ====================================================
echo.
echo Iniciando el servidor local...
echo Modo 100%% Gratuito (Base de datos y fotos en este PC)
echo.

:: Abrir el navegador en 3 segundos
start "" /b cmd /c "timeout /t 3 /nobreak > nul && start http://localhost:3000"

:: Iniciar Next.js
npm start

pause
