@echo off
chcp 65001 >nul
echo ========================================
echo   chan-theory-h5 服务启动脚本
echo   包含: 后端API + 前端(带认证) + 隧道
echo ========================================
echo.

:: 启动后端 API 服务 (port 3099)
echo [1/3] 启动后端 API 服务 (port 3099)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3099.*LISTENING"') do (
    echo    后端已运行 (PID %%a)
    goto :start_frontend
)
start /min cmd /c "cd /d C:\Users\34856\chan-theory-h5\server && node index.js"
echo    后端已启动
:start_frontend

:: 启动前端服务 (port 5173, 带HTTP Basic Auth)
echo [2/3] 启动前端服务 (port 5173, 带访问凭证)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do (
    echo    前端已运行 (PID %%a)
    goto :start_tunnel
)
start /min cmd /c "node C:\Users\34856\chan-theory-h5\server\static.js"
echo    前端已启动
:start_tunnel

:: 启动 serveo 隧道
echo [3/3] 启动 serveo 隧道...
start /min cmd /c "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R chan-theory-h5:80:localhost:5173 serveo.net"
echo.

:: 等待隧道建立
timeout /t 5 /nobreak >nul

echo ========================================
echo   启动完成！
echo ========================================
echo.
echo 访问地址: https://chan-theory-h5.serveo.net
echo (或使用 serveo 分配的其他 URL)
echo.
echo 访问凭证:
echo   用户名: zhu
echo   密 码: 2026chan
echo.
echo 注意: serveo URL 在隧道重启后会变化
echo       如需固定 URL，请注册 serveo.net 账号
echo ========================================
echo.
echo 按任意键打开管理面板...
pause >nul
