@echo off
chcp 65001 > nul
cls
echo ====================================================
echo           DETENIENDO SERVIDOR TALLER JHOS
echo ====================================================
echo.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Servidor detenido correctamente (puerto 3000 liberado).
ping 127.0.0.1 -n 3 > nul