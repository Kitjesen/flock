#Requires -Version 5.1
<#
.SYNOPSIS
  FLOCK 发布打包脚本 — 生成 flock-setup.zip

.DESCRIPTION
  将所有安装所需文件打包到 flock-setup.zip，
  可手动运行或由 GitHub Actions 调用。

.EXAMPLE
  # 本地打包（在项目根目录运行）
  powershell -NoProfile -ExecutionPolicy Bypass -File release.ps1

  # 指定输出路径
  powershell -NoProfile -ExecutionPolicy Bypass -File release.ps1 -OutDir dist
#>

param(
    [string]$OutDir  = $PSScriptRoot,
    [string]$Version = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'

$Root     = $PSScriptRoot
$ZipName  = if ($Version) { "flock-setup-$Version.zip" } else { 'flock-setup.zip' }
$ZipPath  = Join-Path $OutDir $ZipName
$TempDir  = Join-Path $env:TEMP "flock-release-$([System.Guid]::NewGuid().ToString('N').Substring(0,8))"

function wok   { param([string]$m) Write-Host "  [OK]  $m" -ForegroundColor Green }
function winfo { param([string]$m) Write-Host "  ...   $m" -ForegroundColor Cyan }
function werr  { param([string]$m) Write-Host "  [X]   $m" -ForegroundColor Red }

Write-Host ""
Write-Host "  FLOCK Release Builder" -ForegroundColor Cyan
Write-Host "  Output: $ZipPath" -ForegroundColor Cyan
Write-Host ""

# ── 1. 准备暂存目录 ────────────────────────────────────────────────
winfo "创建暂存目录..."
$Staging = Join-Path $TempDir "flock-setup"
New-Item -ItemType Directory -Path $Staging -Force | Out-Null

# ── 2. 需要打包的文件/目录 ──────────────────────────────────────────
$Items = @(
    'install.js',
    'bootstrap.ps1',
    'bootstrap.cmd',
    'setup.cmd',
    'flock.config.json',
    'README.md',
    'patches'
)

# 可选：chat UI（如果存在）
if (Test-Path (Join-Path $Root 'chat')) {
    $Items += 'chat'
}

# 可选：tools（如果存在）
if (Test-Path (Join-Path $Root 'tools')) {
    $Items += 'tools'
}

# ── 3. 复制到暂存目录 ──────────────────────────────────────────────
winfo "复制文件..."
foreach ($item in $Items) {
    $src = Join-Path $Root $item
    if (-not (Test-Path $src)) {
        Write-Host "  [跳过] 未找到: $item" -ForegroundColor Yellow
        continue
    }
    $dst = Join-Path $Staging $item
    if (Test-Path $src -PathType Container) {
        Copy-Item -Path $src -Destination $dst -Recurse -Force
    } else {
        Copy-Item -Path $src -Destination $dst -Force
    }
    wok "  $item"
}

# ── 4. 压缩 ────────────────────────────────────────────────────────
winfo "压缩为 $ZipName..."

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

Compress-Archive -Path (Join-Path $TempDir 'flock-setup') -DestinationPath $ZipPath -Force
$sizekb = [Math]::Round((Get-Item $ZipPath).Length / 1024)
wok "$ZipName ($sizekb KB) → $ZipPath"

# ── 5. 清理 ────────────────────────────────────────────────────────
Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
wok "打包完成！"
Write-Host ""

# 输出 zip 路径供 CI 脚本捕获
Write-Output $ZipPath
