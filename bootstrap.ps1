#Requires -Version 5.1
<#
.SYNOPSIS
  FLOCK 安装程序 — Claude Max × OpenClaw — 一键部署飞书 AI 助手

.DESCRIPTION
  自动完成所有安装步骤：
    - 检查 / 安装 Node.js (via winget)
    - 下载 FLOCK 安装包 (首次 / 更新)
    - 安装 OpenClaw Gateway、claude-max-api-proxy、PM2
    - 应用 Windows 补丁、配置开机自启
    - 写入 start-all.cmd 并创建桌面快捷方式

.EXAMPLE
  # ── 方式 1：PowerShell 一行命令（推荐）────────────────────────
  irm https://raw.githubusercontent.com/YOUR_ORG/flock/main/bootstrap.ps1 | iex

  # ── 方式 2：双击解压包中的 bootstrap.cmd ───────────────────────
  .\bootstrap.cmd
#>

# ═══════════════ 配置（发布前更新这两行）═══════════════════════════
$RELEASE_ZIP_URL = 'https://github.com/Kitjesen/flock/releases/latest/download/flock-setup.zip'
$BOOTSTRAP_RAW   = 'https://raw.githubusercontent.com/Kitjesen/flock/main/bootstrap.ps1'
# ════════════════════════════════════════════════════════════════════

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'   # 加速 Invoke-WebRequest

$MIN_NODE  = 18
$PRODUCT   = 'FLOCK'

# ── 颜色工具 ───────────────────────────────────────────────────────
function wok   { param([string]$m) Write-Host "  $([char]0x2713)  $m" -ForegroundColor Green }
function winfo { param([string]$m) Write-Host "  i  $m" -ForegroundColor Cyan }
function wwarn { param([string]$m) Write-Host "  !  $m" -ForegroundColor Yellow }
function werr  { param([string]$m) Write-Host "  X  $m" -ForegroundColor Red }

function Exit-Err {
    param([string]$Msg)
    Write-Host ""
    werr $Msg
    Write-Host ""
    Write-Host "  安装中止。修复上述问题后重新运行。" -ForegroundColor Red
    Write-Host ""
    # 如果是双击运行则暂停
    if ($Host.UI.RawUI.WindowTitle -ne '') { Read-Host "  按 Enter 退出" | Out-Null }
    exit 1
}

function sh {
    param([string]$Cmd)
    try { return (Invoke-Expression $Cmd 2>&1) } catch { return $null }
}

# ── Banner ────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +============================================================+" -ForegroundColor Cyan
Write-Host "  |  FLOCK  *  Claude Max x OpenClaw  *  Feishu AI Assistant  |" -ForegroundColor Cyan
Write-Host "  |  Installer v1.0                                            |" -ForegroundColor Cyan
Write-Host "  +============================================================+" -ForegroundColor Cyan
Write-Host ""

# ════════════════════════════════════════════════════════════════════
# STEP 1 — 定位工作目录（piped vs file）
# ════════════════════════════════════════════════════════════════════
Write-Host "  [1/4]  定位安装包" -ForegroundColor White
Write-Host "  $('+' * 52)"

$IsPiped = ([string]::IsNullOrEmpty($PSScriptRoot))
$WorkDir = $null
$TempDir = $null

if ($IsPiped) {
    # 通过管道运行 → 下载 release zip
    winfo "从网络下载安装包..."
    $TempDir = Join-Path $env:TEMP "flock-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    $ZipFile = Join-Path $TempDir "flock-setup.zip"
    try {
        Invoke-WebRequest -Uri $RELEASE_ZIP_URL -OutFile $ZipFile -UseBasicParsing
        $sizekb = [Math]::Round((Get-Item $ZipFile).Length / 1024)
        wok "下载完成 (${sizekb} KB)"
    } catch {
        Exit-Err "下载失败: $_`n`n  请检查网络或手动下载:`n  $RELEASE_ZIP_URL"
    }

    winfo "解压..."
    Expand-Archive -Path $ZipFile -DestinationPath $TempDir -Force

    # 找 install.js（zip 内可能有一层子目录）
    $jsFile = Get-ChildItem -Path $TempDir -Recurse -Filter "install.js" |
              Where-Object { -not ($_.FullName -match 'node_modules') } |
              Select-Object -First 1
    if (-not $jsFile) { Exit-Err "安装包损坏：未找到 install.js" }
    $WorkDir = $jsFile.DirectoryName
    wok "解压到: $WorkDir"
} else {
    # 本地文件运行（双击 bootstrap.cmd）
    $WorkDir = $PSScriptRoot
    $jsFile  = Join-Path $WorkDir "install.js"
    if (-not (Test-Path $jsFile)) {
        Exit-Err "未找到 install.js。请确保在 flock-setup 解压目录中运行。"
    }
    wok "本地包: $WorkDir"
}

# ════════════════════════════════════════════════════════════════════
# STEP 2 — 检查 / 安装 Node.js
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [2/4]  检查 Node.js (需要 v$MIN_NODE+)" -ForegroundColor White
Write-Host "  $('+' * 52)"

function Get-NodeMajor {
    $v = sh "node --version"
    if ($v -match '^v(\d+)') { return [int]$Matches[1] }
    return 0
}

$nodeMajor = Get-NodeMajor

if ($nodeMajor -ge $MIN_NODE) {
    wok "Node.js v$nodeMajor (满足要求)"
} elseif ($nodeMajor -gt 0) {
    Exit-Err "Node.js v$nodeMajor 版本过低，需要 v$MIN_NODE+`n  请升级后重新运行: https://nodejs.org/"
} else {
    winfo "未检测到 Node.js，尝试通过 winget 安装..."

    $wg = sh "winget --version"
    if (-not $wg) {
        Exit-Err "未找到 winget。请手动安装 Node.js $MIN_NODE+:`n  https://nodejs.org/"
    }

    winfo "执行: winget install OpenJS.NodeJS.LTS ..."
    winget install -e --id OpenJS.NodeJS.LTS --silent `
          --accept-source-agreements --accept-package-agreements | Out-Null

    # 刷新 PATH
    $machinePath = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $userPath    = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    $env:PATH    = "$machinePath;$userPath"

    $nodeMajor = Get-NodeMajor
    if ($nodeMajor -lt $MIN_NODE) {
        Exit-Err "Node.js 安装后仍未就绪。请重启终端后重新运行此脚本。"
    }
    wok "Node.js v$nodeMajor 安装成功"
}

# ════════════════════════════════════════════════════════════════════
# STEP 3 — 运行 install.js
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [3/4]  运行安装程序 (install.js)" -ForegroundColor White
Write-Host "  $('+' * 52)"
winfo "工作目录: $WorkDir"

$savedLocation = Get-Location
Set-Location $WorkDir
try {
    node (Join-Path $WorkDir "install.js")
    $exitCode = $LASTEXITCODE
} finally {
    Set-Location $savedLocation
}

if ($exitCode -ne 0) {
    Exit-Err "install.js 退出码 $exitCode — 请查看上方错误信息"
}

# ════════════════════════════════════════════════════════════════════
# STEP 4 — 收尾
# ════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  [4/4]  完成" -ForegroundColor White
Write-Host "  $('+' * 52)"
wok "$PRODUCT 安装 / 更新完成"
Write-Host ""
Write-Host "  后续操作：" -ForegroundColor White
Write-Host "    1. Claude Code 登录（仅首次）：claude auth login"   -ForegroundColor Gray
Write-Host "    2. Chat UI 已在浏览器自动打开 (port 3457)"           -ForegroundColor Gray
Write-Host "    3. 查看服务状态：pm2 status"                         -ForegroundColor Gray
Write-Host "    4. 下次启动：双击桌面「启动 FLOCK」快捷方式"          -ForegroundColor Gray
Write-Host ""

# 清理临时目录
if ($TempDir -and (Test-Path $TempDir)) {
    Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
