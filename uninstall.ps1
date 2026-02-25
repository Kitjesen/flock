#Requires -Version 5.1
<#
.SYNOPSIS
  FLOCK 卸载程序

.DESCRIPTION
  停止所有服务，移除快捷方式，清理配置文件。
  可选择是否保留对话历史（Chat UI localStorage 保留在浏览器中）。

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File uninstall.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function wok  { param([string]$m) Write-Host "  [OK]  $m" -ForegroundColor Green }
function winfo{ param([string]$m) Write-Host "  ...   $m" -ForegroundColor Cyan }
function wwarn{ param([string]$m) Write-Host "  [!]   $m" -ForegroundColor Yellow }

Write-Host ""
Write-Host "  FLOCK 卸载程序" -ForegroundColor Cyan
Write-Host "  $('─' * 44)" -ForegroundColor Cyan
Write-Host ""

# ── 确认 ────────────────────────────────────────────────────────
$confirm = Read-Host "  确定要卸载 FLOCK？(输入 yes 继续)"
if ($confirm -ne 'yes') { Write-Host "  已取消。"; exit 0 }
Write-Host ""

# ── 1. 停止 PM2 进程 ────────────────────────────────────────────
winfo "停止 PM2 进程..."
& pm2 stop maxproxy flock-chat 2>$null | Out-Null
& pm2 delete maxproxy flock-chat 2>$null | Out-Null
& pm2 save 2>$null | Out-Null
wok "PM2 进程已停止"

# ── 2. 停止 OpenClaw Gateway ────────────────────────────────────
winfo "停止 OpenClaw Gateway..."
& openclaw gateway stop 2>$null | Out-Null
wok "Gateway 已停止"

# ── 3. 移除 PM2 开机自启（仅当已安装时）──────────────────────
winfo "移除 PM2 开机自启..."
$startupKey = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
$existing = Get-ItemProperty -Path $startupKey -Name "pm2" -ErrorAction SilentlyContinue
if ($existing) {
    Remove-ItemProperty -Path $startupKey -Name "pm2" -ErrorAction SilentlyContinue
    wok "已移除开机自启"
} else {
    wok "无开机自启项（跳过）"
}

# ── 4. 删除桌面快捷方式 ────────────────────────────────────────
winfo "删除桌面快捷方式..."
$lnk = "$env:USERPROFILE\Desktop\启动 FLOCK.lnk"
if (Test-Path $lnk) {
    Remove-Item $lnk -Force
    wok "桌面快捷方式已删除"
} else {
    wok "未找到快捷方式（跳过）"
}

# ── 5. 询问是否清理 ~/.openclaw 配置 ───────────────────────────
Write-Host ""
$keepCfg = Read-Host "  是否保留 ~/.openclaw 中的配置和日志？(y/n，默认 y)"
if ($keepCfg -eq 'n') {
    $ocDir = "$env:USERPROFILE\.openclaw"
    if (Test-Path $ocDir) {
        Remove-Item $ocDir -Recurse -Force -ErrorAction SilentlyContinue
        wok "~/.openclaw 已删除"
    }
} else {
    wok "保留配置目录 ~/.openclaw"
}

# ── 6. 询问是否卸载全局 npm 包 ─────────────────────────────────
Write-Host ""
$rmPkgs = Read-Host "  是否卸载全局 npm 包 (pm2, flock)？(y/n，默认 n)"
if ($rmPkgs -eq 'y') {
    winfo "npm uninstall -g pm2 flock ..."
    & npm uninstall -g pm2 2>$null | Out-Null
    & npm uninstall -g flock 2>$null | Out-Null
    wok "全局包已卸载（OpenClaw 需手动卸载）"
}

# ── 完成 ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  $('─' * 44)" -ForegroundColor Cyan
wok "FLOCK 已卸载完成。"
Write-Host ""
Write-Host "  注：claude CLI、Node.js、Git 等系统工具未被移除。" -ForegroundColor Gray
Write-Host "  如需完全清理请手动运行:" -ForegroundColor Gray
Write-Host "    winget uninstall OpenJS.NodeJS.LTS" -ForegroundColor Gray
Write-Host ""
