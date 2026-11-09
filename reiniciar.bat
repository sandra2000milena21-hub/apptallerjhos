@echo off
chcp 65001 > nul
cls
echo ====================================================
echo          REINICIANDO SERVIDOR TALLER JHOS
echo ====================================================
echo.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)
start "Taller Jhos - Servidor" /min cmd /c "cd /d C:\Users\celulab\Desktop\taller-app && npm start"
echo Servidor reiniciado exitosamente en segundo plano.
ping 127.0.0.1 -n 3 > nul