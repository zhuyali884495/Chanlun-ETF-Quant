@echo off
:: Kill existing processes on ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3099" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul
:: Start server
cd /d C:\Users\34856\chan-theory-h5\server
start /B node index.js > server.log 2>&1
timeout /t 1 /nobreak >nul
echo Server started
