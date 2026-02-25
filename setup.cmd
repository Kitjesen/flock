@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

echo.
echo  =========================================
echo   FLOCK  ^|  Claude Max x OpenClaw
echo   一键部署飞书 AI 助手
echo  =========================================
echo.

REM ── [1/2] Node.js ─────────────────────────────────────────────────

set "NODE_EXE="

REM Check PATH first
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f "delims=" %%i in ('where node 2^>nul') do (
        set "NODE_EXE=%%i"
        goto :node_found
    )
)

REM Check common install paths
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    goto :node_found
)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files (x86)\nodejs\node.exe"
    goto :node_found
)

REM Not found — install via winget
echo  [1/2] Node.js 未安装，正在通过 winget 安装...
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] winget 安装失败，请手动安装 Node.js:
    echo      https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Re-check after install
if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_EXE=C:\Program Files\nodejs\node.exe"
    echo  [1/2] Node.js 安装完成。
    goto :node_found
)

REM PATH not refreshed yet — ask user to re-run
echo.
echo  [1/2] Node.js 已安装，请关闭此窗口后重新运行 setup.cmd
echo.
pause
exit /b 0

:node_found
echo  [1/2] Node.js OK  ^(%NODE_EXE%^)

REM ── [2/2] Git ─────────────────────────────────────────────────────

where git >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :git_found
if exist "C:\Program Files\Git\bin\git.exe" goto :git_found
if exist "D:\Program Files\Git\bin\git.exe" goto :git_found

echo  [2/2] Git 未安装，正在通过 winget 安装...
winget install -e --id Git.Git --silent --accept-source-agreements --accept-package-agreements
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] winget 安装失败，请手动安装 Git for Windows:
    echo      https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

where git >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :git_found
if exist "C:\Program Files\Git\bin\git.exe" goto :git_found

echo.
echo  [2/2] Git 已安装，请关闭此窗口后重新运行 setup.cmd
echo.
pause
exit /b 0

:git_found
echo  [2/2] Git OK
echo.

REM ── Run FLOCK installer ───────────────────────────────────────────

"%NODE_EXE%" "%~dp0install.js"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if %EXIT_CODE% NEQ 0 (
    echo  安装失败，请检查上方错误信息。
    pause
    exit /b %EXIT_CODE%
)

REM install.js 已自动打开浏览器，这里等用户看到后再关闭窗口
pause
