#!/usr/bin/env node
/**
 * FLOCK Installer v1.1.0
 * Claude Max × OpenClaw — 一键部署飞书 AI 助手
 * https://github.com/Kitjesen/flock
 */

'use strict';

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const os   = require('os');

// ── ANSI ─────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',  bold:   '\x1b[1m',  dim:    '\x1b[2m',
  red:    '\x1b[31m', green:  '\x1b[32m', yellow: '\x1b[33m',
  blue:   '\x1b[34m', cyan:   '\x1b[36m', white:  '\x1b[37m',
  bgCyan: '\x1b[46m',
};
const G = s => `${C.green}${s}${C.reset}`;
const R = s => `${C.red}${s}${C.reset}`;
const Y = s => `${C.yellow}${s}${C.reset}`;
const D = s => `${C.dim}${s}${C.reset}`;
const B = s => `${C.bold}${s}${C.reset}`;
const CY = s => `${C.cyan}${s}${C.reset}`;

// ── Banner ────────────────────────────────────────────────────────
function banner() {
  const w = 72;
  const line = '─'.repeat(w);
  console.log(`
${C.cyan}${C.bold}
  ███████╗██╗      ██████╗  ██████╗██╗  ██╗
  ██╔════╝██║     ██╔═══██╗██╔════╝██║ ██╔╝
  █████╗  ██║     ██║   ██║██║     █████╔╝
  ██╔══╝  ██║     ██║   ██║██║     ██╔═██╗
  ██║     ███████╗╚██████╔╝╚██████╗██║  ██╗
  ╚═╝     ╚══════╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝
${C.reset}${D('  Claude Max × OpenClaw  |  一键部署飞书 AI 助手  |  v1.0.0')}
  ${line}
`);
}

// ── Version ───────────────────────────────────────────────────────
const VERSION = '1.1.0';

// ── Step / Log helpers ────────────────────────────────────────────
let _step = 0;
const TOTAL_STEPS = 9;

function step(name) {
  _step++;
  const tag = `[${_step}/${TOTAL_STEPS}]`;
  console.log(`\n${C.bold}${C.cyan}  ${tag}  ${name}${C.reset}`);
  console.log(`  ${'─'.repeat(52)}`);
}
function ok(msg)   { console.log(`  ${G('✓')}  ${msg}`); }
function skip(msg) { console.log(`  ${D('→  已跳过: ' + msg)}`); }
function info(msg) { console.log(`  ${CY('ℹ')}  ${msg}`); }
function warn(msg) { console.log(`  ${Y('⚠')}  ${msg}`); }
function die(msg)  {
  console.log(`\n  ${R('✗')}  ${R(msg)}`);
  console.log(`\n  ${R('安装中止。')} 请修复上述错误后重新运行。\n`);
  process.exit(1);
}

// ── Shell helpers ─────────────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe', ...opts }).trim();
  } catch { return null; }
}
function must(cmd, label) {
  const r = run(cmd);
  if (r === null) die(`${label} 失败，请检查环境。\n    命令: ${cmd}`);
  return r;
}
function portListening(port) {
  const r = run(`netstat -ano | findstr ":${port} "`);
  return r && r.includes('LISTENING');
}

// ── Paths ─────────────────────────────────────────────────────────
const HOME          = os.homedir().replace(/\\/g, '/');
const OPENCLAW_DIR  = `${HOME}/.openclaw`;
const OPENCLAW_JSON = `${OPENCLAW_DIR}/openclaw.json`;
const ECOSYSTEM_CFG = `${OPENCLAW_DIR}/ecosystem.config.cjs`;
const LOGS_DIR      = `${OPENCLAW_DIR}/logs`;
const INSTALLER_DIR = __dirname.replace(/\\/g, '/');
const PATCHES_DIR   = `${INSTALLER_DIR}/patches`;

// npm global prefix
function npmGlobalDir() {
  return run('npm root -g') || 'C:/Users/default/AppData/Roaming/npm/node_modules';
}

// ── Load config ────────────────────────────────────────────────────
function loadConfig() {
  const cfgPath = path.join(INSTALLER_DIR, 'flock.config.json');
  const defaults = {
    gitBashPath:  'D:\\Program Files\\Git\\bin\\bash.exe',
    nodePath:     'C:\\Program Files\\nodejs\\node.exe',
    model:        'claude-sonnet-4-6',
    proxyPort:    3456,
    gatewayPort:  18789,
    chatPort:     3457,
  };
  if (!fs.existsSync(cfgPath)) {
    info(`未找到 flock.config.json，使用默认配置`);
    return defaults;
  }
  try {
    const user = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return { ...defaults, ...user };
  } catch {
    warn('flock.config.json 解析失败，使用默认配置');
    return defaults;
  }
}

// ── Step 1: 检查前置条件 ──────────────────────────────────────────
function checkPrereqs(cfg) {
  step('检查前置条件');

  // Node.js
  const nodeVer = run('node --version');
  if (!nodeVer) die('Node.js 未安装，请先安装 Node.js 18+');
  const major = parseInt(nodeVer.replace('v',''));
  if (major < 18) die(`Node.js 版本 ${nodeVer} 过低，需要 18+`);
  ok(`Node.js ${nodeVer}`);

  // Git
  const gitVer = run('git --version');
  if (!gitVer) die('Git 未安装。请先安装 Git for Windows: https://git-scm.com/download/win');
  ok(`Git: ${gitVer.split(' ').slice(-1)[0]}`);

  // Claude Code CLI
  const claudeVer = run('claude --version');
  if (!claudeVer) {
    die('Claude Code CLI 未安装。\n    请运行: npm install -g @anthropic-ai/claude-code\n    并完成 auth: claude auth login');
  }
  ok(`Claude Code CLI: ${claudeVer}`);

  // Git Bash path — auto-detect common install locations
  const gitBashCfg = cfg.gitBashPath.replace(/\\\\/g, '\\');
  const gitBashCandidates = [
    gitBashCfg,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'D:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  const foundGitBash = gitBashCandidates.find(p => fs.existsSync(p));
  if (!foundGitBash) {
    warn(`Git bash 未找到，请在 clawmax.config.json 中更新 gitBashPath`);
  } else {
    if (foundGitBash !== gitBashCfg) {
      cfg.gitBashPath = foundGitBash;
      info(`Git bash 自动检测: ${foundGitBash}`);
    } else {
      ok(`Git bash: ${foundGitBash}`);
    }
  }
}

// ── Step 2: OpenClaw ──────────────────────────────────────────────
function ensureOpenclaw() {
  step('安装 / 验证 OpenClaw');

  const ver = run('openclaw --version');
  if (ver) {
    skip(`OpenClaw 已安装 (${ver})`);
    return;
  }

  info('正在安装 OpenClaw...');
  const result = run('npm install -g openclaw', { stdio: 'inherit' });
  const ver2 = run('openclaw --version');
  if (!ver2) die('OpenClaw 安装失败');
  ok(`OpenClaw ${ver2} 安装成功`);
}

// ── Step 3: claude-max-api-proxy + 补丁 ──────────────────────────
function ensureProxy(cfg) {
  step('安装 claude-max-api-proxy 并应用 Windows 补丁');

  const npmDir   = npmGlobalDir();
  const proxyDir = `${npmDir}/claude-max-api-proxy`;
  const distDir  = `${proxyDir}/dist`;

  // 安装包
  if (!fs.existsSync(proxyDir)) {
    info('正在安装 claude-max-api-proxy...');
    must('npm install -g claude-max-api-proxy', '安装 claude-max-api-proxy');
    ok('claude-max-api-proxy 安装完成');
  } else {
    skip('claude-max-api-proxy 已安装');
  }

  // 应用补丁
  const patchMap = [
    { src: 'manager.js',      dst: `${distDir}/subprocess/manager.js`,    desc: 'Windows spawn + stdin + CLAUDECODE strip + 图片 stream-json' },
    { src: 'openai-to-cli.js',dst: `${distDir}/adapter/openai-to-cli.js`, desc: '模型 ID 映射 + content 数组 + 图片提取' },
    { src: 'cli-to-openai.js',dst: `${distDir}/adapter/cli-to-openai.js`, desc: '空 modelUsage 保护' },
    { src: 'routes.js',       dst: `${distDir}/server/routes.js`,          desc: 'imageParts 传递' },
  ];

  let applied = 0;
  for (const p of patchMap) {
    const srcFile = path.join(PATCHES_DIR, p.src);
    if (!fs.existsSync(srcFile)) {
      warn(`补丁文件缺失: patches/${p.src}，跳过`);
      continue;
    }
    const srcHash = require('crypto').createHash('md5').update(fs.readFileSync(srcFile)).digest('hex');
    const dstHash = fs.existsSync(p.dst)
      ? require('crypto').createHash('md5').update(fs.readFileSync(p.dst)).digest('hex')
      : '';

    if (srcHash === dstHash) {
      skip(`${p.src} 补丁已是最新`);
    } else {
      fs.mkdirSync(path.dirname(p.dst), { recursive: true });
      fs.copyFileSync(srcFile, p.dst);
      ok(`${p.src}: ${p.desc}`);
      applied++;
    }
  }

  if (applied > 0) ok(`已应用 ${applied} 处补丁`);
}

// ── Step 4: PM2 进程管理 ──────────────────────────────────────────
function ensurePm2(cfg) {
  step('配置 PM2 进程管理');

  // 安装 PM2
  if (!run('pm2 --version')) {
    info('正在安装 PM2...');
    must('npm install -g pm2', '安装 PM2');
  }
  const pm2ver = run('pm2 --version').split('\n').pop().trim();
  ok(`PM2 ${pm2ver}`);

  // pm2-windows-startup
  const npmDir = npmGlobalDir();
  if (!fs.existsSync(`${npmDir}/pm2-windows-startup`)) {
    info('正在安装 pm2-windows-startup...');
    must('npm install -g pm2-windows-startup', '安装 pm2-windows-startup');
    run('pm2-startup install');
    ok('PM2 开机自启已注册');
  } else {
    skip('pm2-windows-startup 已安装');
  }

  // ecosystem.config.cjs
  fs.mkdirSync(LOGS_DIR, { recursive: true });
  const npmDir2   = npmGlobalDir();
  const proxyMain = `${npmDir2}/claude-max-api-proxy/dist/server/standalone.js`.replace(/\//g,'\\\\');
  const nodePath  = cfg.nodePath.replace(/\\/g,'\\\\');
  const gitBash   = cfg.gitBashPath.replace(/\\/g,'\\\\');
  const logsDir   = LOGS_DIR.replace(/\//g,'\\\\');

  const chatMain = `${INSTALLER_DIR}/chat/server.js`.replace(/\//g,'\\\\');

  const ecoContent = `module.exports = {
  apps: [
    {
      name: "maxproxy",
      script: "${proxyMain}",
      interpreter: "${nodePath}",
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: "10s",
      out_file: "${logsDir}\\\\maxproxy-out.log",
      error_file: "${logsDir}\\\\maxproxy-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        CLAUDECODE: "",
        CLAUDE_CODE_GIT_BASH_PATH: "${gitBash}",
        NODE_ENV: "production",
      },
    },
    {
      name: "flock-chat",
      script: "${chatMain}",
      interpreter: "${nodePath}",
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: "5s",
      out_file: "${logsDir}\\\\flock-chat-out.log",
      error_file: "${logsDir}\\\\flock-chat-err.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      env: {
        CHAT_PORT: "${cfg.chatPort}",
        PROXY_PORT: "${cfg.proxyPort}",
        NODE_ENV: "production",
      },
    },
  ],
};\n`;

  fs.writeFileSync(ECOSYSTEM_CFG, ecoContent, 'utf8');
  ok(`ecosystem.config.cjs 已写入 ${OPENCLAW_DIR}`);
}

// ── Step 5: 配置 openclaw.json ────────────────────────────────────
function configureOpenclaw(cfg) {
  step('配置 OpenClaw (maxproxy provider)');

  if (!fs.existsSync(OPENCLAW_JSON)) {
    die(`openclaw.json 未找到: ${OPENCLAW_JSON}\n    请先运行 openclaw gateway start 初始化配置`);
  }

  let oc;
  try {
    oc = JSON.parse(fs.readFileSync(OPENCLAW_JSON, 'utf8'));
  } catch {
    die('openclaw.json 解析失败');
  }

  let dirty = false;

  // providers lives under models.providers (NOT at root level)
  oc.models = oc.models || {};
  oc.models.providers = oc.models.providers || {};
  if (!oc.models.providers.maxproxy) {
    oc.models.providers.maxproxy = {
      baseUrl: `http://127.0.0.1:${cfg.proxyPort}/v1`,
      apiKey:  'max-subscription',
      api:     'openai-completions',
      authHeader: false,
      models: [
        { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Max)', reasoning: false, input: ['text','image'], contextWindow: 200000, maxTokens: 16384 },
        { id: 'claude-opus-4-6',   name: 'Claude Opus 4.6 (Max)',   reasoning: true,  input: ['text','image'], contextWindow: 200000, maxTokens: 16384 },
      ],
    };
    dirty = true;
    ok('maxproxy provider 已添加 (models.providers)');
  } else {
    skip('maxproxy provider 已存在');
  }

  // auth profile
  oc.auth = oc.auth || {};
  oc.auth.profiles = oc.auth.profiles || {};
  if (!oc.auth.profiles['maxproxy:default']) {
    oc.auth.profiles['maxproxy:default'] = { provider: 'maxproxy', mode: 'api_key' };
    dirty = true;
    ok('maxproxy auth profile 已添加');
  }

  // agents default model
  oc.agents = oc.agents || {};
  oc.agents.defaults = oc.agents.defaults || {};
  oc.agents.defaults.model = oc.agents.defaults.model || {};
  const targetModel = `maxproxy/${cfg.model}`;
  if (oc.agents.defaults.model.primary !== targetModel) {
    oc.agents.defaults.model.primary = targetModel;
    dirty = true;
    ok(`默认模型设为 ${targetModel}`);
  } else {
    skip(`默认模型已是 ${targetModel}`);
  }

  if (dirty) {
    // backup
    const bak = `${OPENCLAW_JSON}.clawmax.bak`;
    if (!fs.existsSync(bak)) fs.copyFileSync(OPENCLAW_JSON, bak);
    fs.writeFileSync(OPENCLAW_JSON, JSON.stringify(oc, null, 2), 'utf8');
    ok('openclaw.json 已保存');
  }
}

// ── Step 6: 启动服务 ──────────────────────────────────────────────
function startServices(cfg) {
  step('启动服务');

  // maxproxy via PM2
  const pmStatus = run('pm2 jlist') || '';
  if (pmStatus.includes('"maxproxy"') && pmStatus.includes('"online"')) {
    run('pm2 restart maxproxy');
    ok('MaxProxy 已重启 (PM2)');
  } else {
    run(`pm2 start "${ECOSYSTEM_CFG}" --only maxproxy`);
    ok('MaxProxy 已启动 (PM2)');
  }

  // flock-chat via PM2
  if (pmStatus.includes('"flock-chat"') && pmStatus.includes('"online"')) {
    run('pm2 restart flock-chat');
    ok('FLOCK Chat 已重启 (PM2)');
  } else {
    run(`pm2 start "${ECOSYSTEM_CFG}" --only flock-chat`);
    ok('FLOCK Chat 已启动 (PM2)');
  }
  run('pm2 save');

  // 等待端口
  let proxyUp = false;
  for (let i = 0; i < 10; i++) {
    if (portListening(cfg.proxyPort)) { proxyUp = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
  }
  if (!proxyUp) warn(`MaxProxy 端口 ${cfg.proxyPort} 未就绪，请稍后检查 pm2 logs maxproxy`);
  else ok(`MaxProxy :${cfg.proxyPort} 监听中`);

  let chatUp = false;
  for (let i = 0; i < 8; i++) {
    if (portListening(cfg.chatPort)) { chatUp = true; break; }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 600);
  }
  if (!chatUp) warn(`Chat UI 端口 ${cfg.chatPort} 未就绪，请稍后检查 pm2 logs flock-chat`);
  else ok(`Chat UI   :${cfg.chatPort} 监听中`);

  // OpenClaw Gateway — use restart (preserves auth token pairing)
  info('重启 OpenClaw Gateway...');
  run('openclaw gateway restart');

  let gwUp = false;
  for (let i = 0; i < 15; i++) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
    if (portListening(cfg.gatewayPort)) { gwUp = true; break; }
  }
  if (!gwUp) warn(`Gateway 端口 ${cfg.gatewayPort} 未就绪，请稍后运行 openclaw gateway restart`);
  else ok(`Gateway :${cfg.gatewayPort} 监听中`);
}

// ── Step 7: 验证 ──────────────────────────────────────────────────
async function verify(cfg) {
  step('端对端验证');

  // 发一个 ping 请求
  info('发送测试请求到 MaxProxy...');

  const body = JSON.stringify({
    model: cfg.model,
    stream: false,
    messages: [{ role: 'user', content: '请用一个词回应：pong' }],
  });

  const result = await new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: cfg.proxyPort,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer max-subscription',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          resolve(d.choices?.[0]?.message?.content || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(30000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });

  if (result) {
    ok(`Claude 响应: "${result.slice(0, 60)}"`);
  } else {
    warn('测试请求未收到响应，但服务可能仍在启动中。');
    warn('手动验证: pm2 logs maxproxy');
  }
}

// ── Success box ───────────────────────────────────────────────────
function success(cfg) {
  const w = 60;
  const box = (s) => `  ║  ${s.padEnd(w - 2)}║`;
  console.log(`
  ${C.green}╔${'═'.repeat(w)}╗
  ║  ${'🎉 安装完成！'.padEnd(w - 2)}║
  ║${''.padEnd(w + 2)}║
${box(` Chat UI:   http://127.0.0.1:${cfg.chatPort}  ← 打开这个`)}
${box(` Gateway:   http://127.0.0.1:${cfg.gatewayPort}`)}
${box(` MaxProxy:  http://127.0.0.1:${cfg.proxyPort}`)}
${box(` 默认模型:  maxproxy/${cfg.model}`)}
  ║${''.padEnd(w + 2)}║
${box(` 日志:  pm2 logs flock-chat`)}
${box(` 状态:  pm2 status`)}
  ╚${'═'.repeat(w)}╝${C.reset}
`);
  // 自动在浏览器中打开 Chat UI
  run(`cmd /c start http://127.0.0.1:${cfg.chatPort}`);
}

// ── Step 8: 写入 start-all.cmd + 桌面快捷方式 ────────────────────
function createShortcuts(cfg) {
  step('创建启动脚本 & 桌面快捷方式');

  // 8-a  写入 start-all.cmd（UTF-8 + chcp 65001，不再需要 GBK）
  const gp   = cfg.gatewayPort;
  const pp   = cfg.proxyPort;
  const cp   = cfg.chatPort;
  const eco  = ECOSYSTEM_CFG.replace(/\//g, '\\');

  const startAll = [
    '@echo off',
    'chcp 65001 >nul 2>&1',
    'title FLOCK — OpenClaw + MaxProxy 启动器',
    'echo.',
    'echo ============================================',
    'echo   FLOCK  |  Claude Max x OpenClaw',
    'echo ============================================',
    'echo.',
    ':: [1/2] MaxProxy via PM2 -----------------------------------',
    'echo [1/2] 启动 MaxProxy (PM2)...',
    'pm2 describe maxproxy >nul 2>&1',
    'if %errorlevel%==0 (',
    '    pm2 restart maxproxy >nul 2>&1',
    '    echo       [OK] MaxProxy 已重启',
    ') else (',
    `    pm2 start "${eco}" >nul 2>&1`,
    '    echo       [OK] MaxProxy 已启动',
    ')',
    'pm2 save >nul 2>&1',
    'timeout /t 3 /nobreak >nul',
    '',
    ':: [2/2] OpenClaw Gateway -----------------------------------',
    `echo [2/2] 启动 OpenClaw Gateway (port ${gp})...`,
    'openclaw gateway stop >nul 2>&1',
    'timeout /t 2 /nobreak >nul',
    `for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":${gp} " 2^>nul') do (`,
    '    taskkill /PID %%p /F >nul 2>&1',
    ')',
    'timeout /t 2 /nobreak >nul',
    'openclaw gateway start >nul 2>&1',
    'timeout /t 5 /nobreak >nul',
    '',
    `netstat -ano | findstr ":${gp} " >nul 2>&1`,
    'if %errorlevel%==0 (echo       [OK] Gateway 已启动) else (echo       [WARN] Gateway 未能启动)',
    '',
    'echo.',
    'echo ============================================',
    `echo   Gateway:  http://127.0.0.1:${gp}`,
    `echo   MaxProxy: http://127.0.0.1:${pp}`,
    `echo   Chat UI:  http://127.0.0.1:${cp}`,
    'echo   PM2 日志: pm2 logs maxproxy',
    'echo ============================================',
    'echo.',
    'pause',
    '',
  ].join('\r\n');

  const startAllPath = path.join(OPENCLAW_DIR, 'start-all.cmd').replace(/\//g, '\\');
  fs.writeFileSync(startAllPath, startAll, 'utf8');
  ok(`start-all.cmd 已写入: ${startAllPath}`);

  // 8-b  桌面快捷方式（用 PowerShell WScript.Shell）
  const desktop  = path.join(os.homedir(), 'Desktop').replace(/\//g, '\\');
  const lnkPath  = path.join(desktop, '启动 FLOCK.lnk').replace(/\//g, '\\');
  const iconPath = startAllPath;  // 使用 cmd 图标

  // PS1 one-liner，字符串内不含单引号
  const psCmd = [
    `$sh  = New-Object -ComObject WScript.Shell`,
    `$lnk = $sh.CreateShortcut('${lnkPath}')`,
    `$lnk.TargetPath       = 'C:\\Windows\\System32\\cmd.exe'`,
    `$lnk.Arguments        = '/c "' + '${startAllPath}' + '"'`,
    `$lnk.WorkingDirectory = '${OPENCLAW_DIR.replace(/\//g,'\\')}'`,
    `$lnk.WindowStyle      = 1`,
    `$lnk.Save()`,
  ].join('; ');

  const r = run(`powershell -NoProfile -Command "${psCmd}"`);
  if (r === null) {
    warn('桌面快捷方式创建失败（无权限或路径问题），请手动创建');
  } else {
    ok(`桌面快捷方式: 启动 FLOCK.lnk`);
  }
}

// ── Step 9: 注册 flock CLI 全局命令 ──────────────────────────────
function installFlockCli() {
  step('注册 flock CLI 全局命令');
  const r = run('npm link --silent', { cwd: INSTALLER_DIR });
  if (r === null) {
    // fallback: 直接把 bin/flock.js 拷到 openclaw dir 并设 PATH
    const src = path.join(INSTALLER_DIR, 'bin', 'flock.js');
    const dst = path.join(OPENCLAW_DIR,  'flock.js');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      warn('npm link 失败，已手动复制 flock.js 到 ~/.openclaw/');
      info(`运行命令: node "${dst}" <命令>`);
    } else {
      warn('flock CLI 注册失败，请手动运行: npm link');
    }
  } else {
    ok('flock CLI 已注册，可全局使用 `flock` 命令');
    info('示例: flock status / flock doctor / flock update');
  }
}

// ── Check for newer version (non-blocking) ───────────────────────
async function checkForUpdates() {
  try {
    const data = await new Promise((resolve, reject) => {
      const req = http.get(
        { hostname:'api.github.com', path:'/repos/Kitjesen/flock/releases/latest',
          headers:{ 'User-Agent':'flock-installer' }, timeout:4000 },
        res => {
          let body = '';
          res.on('data', c => body += c);
          res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
    const latest = data?.tag_name?.replace(/^v/, '');
    if (latest && latest !== VERSION) {
      console.log(`\n  ${Y('⚡')}  ${Y(`新版本可用: v${latest}（当前: v${VERSION}）`)}  运行 flock update 升级\n`);
    }
  } catch { /* 离线或访问失败，静默跳过 */ }
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  banner();
  const cfg = loadConfig();

  // 非阻塞更新检查
  checkForUpdates().catch(() => {});

  try {
    checkPrereqs(cfg);
    ensureOpenclaw();
    ensureProxy(cfg);
    ensurePm2(cfg);
    configureOpenclaw(cfg);
    startServices(cfg);
    await verify(cfg);
    createShortcuts(cfg);
    installFlockCli();
    success(cfg);
  } catch (err) {
    console.log(`\n  ${R('✗  ' + (err.message || String(err)))}\n`);
    process.exit(1);
  }
}

main();
