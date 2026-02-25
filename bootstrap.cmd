@echo off
:: FLOCK 安装程序入口
:: 双击此文件即可启动安装
chcp 65001 >nul 2>&1
title FLOCK Installer

echo.
echo  正在启动 FLOCK 安装程序...
echo.

:: 检查 PowerShell 5.1+
powershell -NoProfile -Command "if ($PSVersionTable.PSVersion.Major -lt 5) { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [错误] 需要 PowerShell 5.1 或更高版本。
    echo  请更新 Windows 或访问: https://aka.ms/wmf5download
    pause
    exit /b 1
)

:: 以 Bypass 执行策略运行 bootstrap.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap.ps1"
set EXIT_CODE=%errorlevel%

if %EXIT_CODE% neq 0 (
    echo.
    echo  安装未完成，请查看上方错误信息。
    pause
    exit /b %EXIT_CODE%
)

pause
