# FLOCK

**Claude Max × OpenClaw — 一键部署飞书 AI 助手**

用 Claude 订阅额度（Claude Max）驱动的飞书智能助手，无需 Anthropic API Key。

```
OpenClaw Gateway (飞书入口)
    ↓
claude-max-api-proxy (本地 OpenAI 兼容代理)
    ↓
claude CLI 子进程 (Claude Code CLI)
    ↓
Anthropic API (通过订阅 OAuth，非 API Key)
```

---

## 快速安装

### 方式 1：PowerShell 一行命令（推荐，全自动）

以**管理员身份**打开 PowerShell，运行：

```powershell
irm https://raw.githubusercontent.com/Kitjesen/flock/main/bootstrap.ps1 | iex
```

脚本会自动下载最新安装包、安装 Node.js（如缺失）、配置所有服务，并在桌面创建「启动 FLOCK」快捷方式。

### 方式 2：下载安装包双击安装

1. 前往 [Releases](https://github.com/Kitjesen/flock/releases/latest) 下载 `flock-setup-vX.X.X.zip`
2. 解压到任意目录（如 `C:\flock`）
3. 双击 `bootstrap.cmd` — 无需管理员权限

### 方式 3：从源码运行（开发者）

```bat
git clone https://github.com/Kitjesen/flock.git
cd flock
setup.cmd
```

---

## 安装后

```powershell
# 首次登录（仅需一次）
claude auth login

# 查看服务状态
pm2 status

# 日常启动：双击桌面「启动 FLOCK」快捷方式
```

浏览器访问：`http://127.0.0.1:18789`（飞书 Gateway 管理页）

---

## 系统要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Windows | 10/11 | 仅支持 Windows（需内置 winget） |
| Claude Code CLI | 最新 | 由安装程序自动安装 |
| Claude 订阅 | Max 或 Pro | 需要在 CLI 完成登录 |

> Node.js 和 Git 会由安装程序自动检测并安装，无需手动准备。

---

## 安装器做了什么

`install.js` 自动完成以下 8 个步骤：

| 步骤 | 内容 |
|------|------|
| 1 | 检查 Node.js / claude CLI / OpenClaw 前置条件 |
| 2 | 安装 / 验证 OpenClaw Gateway |
| 3 | 安装 claude-max-api-proxy 并应用 Windows 补丁 |
| 4 | 安装 PM2 进程管理器（崩溃自动重启） |
| 5 | 写入 ecosystem.config.cjs，注册开机自启 |
| 6 | 配置 OpenClaw 指向本地 maxproxy |
| 7 | 启动所有服务并端到端验证 |
| 8 | 写入 start-all.cmd，创建桌面快捷方式 |

**已安装的组件会自动跳过**，重复运行安全。

---

## 配置文件

编辑 `flock.config.json` 自定义端口和路径：

```json
{
  "gitBashPath": "D:\\Program Files\\Git\\bin\\bash.exe",
  "nodePath":    "C:\\Program Files\\nodejs\\node.exe",
  "model":       "claude-sonnet-4-6",
  "proxyPort":   3456,
  "gatewayPort": 18789,
  "chatPort":    3457
}
```

---

## 日常管理

```bash
# 查看服务状态
pm2 status

# 查看代理日志（实时）
pm2 logs maxproxy

# 重启代理
pm2 restart maxproxy

# 重启 Gateway
openclaw gateway restart

# 查看所有 session
openclaw sessions
```

---

## Windows 补丁说明

`patches/` 目录包含对 `claude-max-api-proxy` 的 4 处修补：

| 文件 | 修复内容 |
|------|---------|
| `manager.js` | Windows `spawn` ENOENT、ENAMETOOLONG、CLAUDECODE 嵌套、图片 stream-json |
| `openai-to-cli.js` | 模型 ID 映射、content 数组解析、图片提取 |
| `cli-to-openai.js` | 空 `modelUsage` 导致的 undefined crash |
| `routes.js` | `imageParts` 传递给子进程 |

`npm update claude-max-api-proxy` 后重新运行安装程序即可重新应用补丁。

---

## 支持的能力

| 功能 | 状态 |
|------|------|
| 文字对话 | ✅ |
| 多轮上下文 | ✅ |
| 流式输出 | ✅ |
| 图片识别 | ✅ |
| 工具调用 (feishu_doc 等) | 🚧 开发中 |

---

## 发布新版本（维护者）

```powershell
# 本地打包（测试用）
powershell -ExecutionPolicy Bypass -File release.ps1

# 发布到 GitHub（自动触发 CI 打包 + Release）
git tag v1.0.1
git push origin v1.0.1
```

---

*FLOCK v1.0.0*
