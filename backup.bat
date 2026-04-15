@echo off
chcp 65001 >nul
echo ========================================
echo   chan-theory-h5 完整备份脚本
echo ========================================
echo.

set BACKUP_DIR=C:\Users\34856\chan-theory-h5\backup
set DATE_STR=%DATE:~0,4%-%DATE:~5,2%-%DATE:~8,2%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [1/4] 正在压缩项目源码...
powershell -Command "Compress-Archive -Path 'C:\Users\34856\chan-theory-h5\client\src','C:\Users\34856\chan-theory-h5\server' -DestinationPath '%BACKUP_DIR%\chan-theory-h5-src-%DATE_STR%.zip' -Force"

echo [2/4] 正在备份预警数据...
copy /Y "C:\Users\34856\chan-theory-h5\server\data\alerts.json" "%BACKUP_DIR%\alerts.json"

echo [3/4] 正在备份配置文件...
copy /Y "C:\Users\34856\chan-theory-h5\client\vite.config.js" "%BACKUP_DIR%\vite.config.js"
copy /Y "C:\Users\34856\chan-theory-h5\client\package.json" "%BACKUP_DIR%\client-package.json"
copy /Y "C:\Users\34856\chan-theory-h5\server\package.json" "%BACKUP_DIR%\server-package.json"

echo [4/4] 正在生成备份清单...
powershell -Command "Get-ChildItem '%BACKUP_DIR%' | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize | Out-File -FilePath '%BACKUP_DIR%\backup-manifest-%DATE_STR%.txt'"

echo.
echo ========================================
echo   备份完成！
echo ========================================
echo 备份目录: %BACKUP_DIR%
echo.
dir /b "%BACKUP_DIR%"
echo.
echo 访问地址: https://chan-theory-h5.loca.lt
echo 隧道进程: localtunnel (需本机运行)
echo ========================================
pause
