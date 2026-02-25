#!/usr/bin/env node
/**
 * flock CLI — 日常管理命令
 *
 *  flock status   查看服务状态
 *  flock doctor   诊断所有组件
 *  flock update   更新到最新版本
 *  flock logs     实时查看 MaxProxy 日志
 *  flock open     浏览器打开 Chat UI
 *  flock stop     停止所有服务
 *  flock restart  重启所有服务
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const http  = require('http');
const path  = require('path');
const os    = require('os');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};
const G  = s => `${C.green}${s}${C.reset}`;
const R  = s => `${C.red}${s}${C.reset}`;
const Y  = s => `${C.yellow}${s}${C.reset}`;
const CY = s => `${C.cyan}${s}${C.reset}`;
const B  = s => `${C.bold}${s}${C.reset}`;

function sh(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim(); }
  catch { return null; }
}

function ping(port) {
  return new Promise(resolve => {
    const req = http.get({ hostname:'127.0.0.1', port, path:'/v1/models',
      headers:{ Authorization:'Bearer max-subscription' }, timeout:2500 }, res => {
      resolve(res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const CFG_PATH = path.join(os.homedir(), '.openclaw', 'flock.config.json');
function loadCfg() {
  try { return JSON.parse(require('fs').readFileSync(CFG_PATH, 'utf8')); }
  catch { return { proxyPort: 3456, gatewayPort: 18789, chatPort: 3457 }; }
}

// ── Commands ─────────────────────────────────────────────────────

async function cmdStatus() {
  console.log(`\n  ${B('FLOCK — 服务状态')}\n  ${'─'.repeat(44)}`);
  const cfg = loadCfg();

  // PM2
  const pm2 = sh('pm2 jlist');
  const procs = pm2 ? JSON.parse(pm2).filter(p => ['maxproxy','flock-chat'].includes(p.name)) : [];
  for (const p of procs) {
    const icon = p.pm2_env.status === 'online' ? G('●') : R('●');
    console.log(`  ${icon}  ${p.name.padEnd(14)} ${p.pm2_env.status}   pid ${p.pid}   ↺ ${p.pm2_env.restart_time}x`);
  }
  if (!procs.length) console.log(`  ${R('●')}  PM2 进程未运行`);

  // Ports
  const portChecks = [
    ['MaxProxy',   cfg.proxyPort],
    ['Chat UI',    cfg.chatPort],
  ];
  for (const [name, port] of portChecks) {
    const ok = await ping(port);
    console.log(`  ${ok ? G('●') : R('●')}  ${name.padEnd(14)} http://127.0.0.1:${port}`);
  }

  // Gateway
  const gwListening = sh(`netstat -ano | findstr ":${cfg.gatewayPort} "`)?.includes('LISTENING');
  console.log(`  ${gwListening ? G('●') : R('●')}  ${'Gateway'.padEnd(14)} http://127.0.0.1:${cfg.gatewayPort}`);

  console.log();
}

async function cmdDoctor() {
  console.log(`\n  ${B('FLOCK Doctor — 组件诊断')}\n  ${'─'.repeat(44)}`);
  let pass = 0, fail = 0;

  function check(label, result, hint) {
    if (result) { console.log(`  ${G('✓')}  ${label}`); pass++; }
    else        { console.log(`  ${R('✗')}  ${label}${hint ? `\n      ${Y('→ ' + hint)}` : ''}`); fail++; }
  }

  const node = sh('node --version');
  check('Node.js',     !!node && parseInt(node.slice(1)) >= 18, `需要 v18+，当前: ${node || '未找到'}`);

  const oc = sh('openclaw --version');
  check('OpenClaw CLI',  !!oc,  'openclaw 未找到，请重新运行 install.js');

  const pm2 = sh('pm2 --version');
  check('PM2',           !!pm2, 'npm install -g pm2');

  const cfg = loadCfg();
  check('MaxProxy (HTTP)',  await ping(cfg.proxyPort),   `未监听 :${cfg.proxyPort}，运行 pm2 start maxproxy`);
  check('Chat UI (HTTP)',   await ping(cfg.chatPort),    `未监听 :${cfg.chatPort}，运行 pm2 start flock-chat`);

  const gwOk = !!sh(`netstat -ano | findstr ":${cfg.gatewayPort} "`)?.includes('LISTENING');
  check('Gateway', gwOk, `未监听 :${cfg.gatewayPort}，运行 openclaw gateway start`);

  const claudeOk = sh('claude --version');
  check('Claude CLI', !!claudeOk, 'npm install -g @anthropic-ai/claude-code');

  console.log(`\n  ${pass} 通过  ${fail > 0 ? R(fail + ' 失败') : G('0 失败')}\n`);
  process.exit(fail > 0 ? 1 : 0);
}

function cmdLogs() {
  console.log(`  ${CY('→')}  pm2 logs maxproxy\n`);
  spawnSync('pm2', ['logs', 'maxproxy'], { stdio: 'inherit', shell: true });
}

function cmdOpen() {
  const cfg = loadCfg();
  const url = `http://127.0.0.1:${cfg.chatPort || 3457}`;
  console.log(`  ${CY('→')}  Opening ${url}`);
  sh(`start "" "${url}"`);
}

function cmdStop() {
  console.log(`  Stopping services...`);
  sh('pm2 stop maxproxy flock-chat');
  sh('openclaw gateway stop');
  console.log(`  ${G('✓')}  All services stopped`);
}

function cmdRestart() {
  console.log(`  Restarting services...`);
  sh('pm2 restart maxproxy flock-chat');
  sh('openclaw gateway stop');
  sh('openclaw gateway start');
  console.log(`  ${G('✓')}  All services restarted`);
}

function cmdUpdate() {
  const installJs = path.join(__dirname, '..', 'install.js');
  const fs = require('fs');
  if (!fs.existsSync(installJs)) {
    console.log(`  ${R('✗')}  install.js 未找到。请重新下载最新安装包：`);
    console.log(`  ${CY('→')}  https://github.com/Kitjesen/flock/releases/latest\n`);
    process.exit(1);
  }
  console.log(`  ${CY('→')}  运行 install.js 更新...\n`);
  spawnSync('node', [installJs], { stdio: 'inherit', cwd: path.dirname(installJs) });
}

function printHelp() {
  console.log(`
  ${B(CY('FLOCK CLI'))} — Claude Max × OpenClaw

  ${B('用法：')}  flock <命令>

  ${B('命令：')}
    status    查看所有服务运行状态
    doctor    诊断组件是否就绪
    update    重新运行 install.js 更新
    logs      实时查看 MaxProxy 日志
    open      浏览器打开 Chat UI
    stop      停止所有服务
    restart   重启所有服务
    help      显示此帮助
`);
}

// ── Entry ────────────────────────────────────────────────────────
const cmd = process.argv[2] || 'help';
const dispatch = { status: cmdStatus, doctor: cmdDoctor, logs: cmdLogs, open: cmdOpen, stop: cmdStop, restart: cmdRestart, update: cmdUpdate, help: () => printHelp() };
const fn = dispatch[cmd];
if (!fn) { console.log(`  ${R('✗')}  未知命令: ${cmd}`); printHelp(); process.exit(1); }
Promise.resolve(fn()).catch(e => { console.error(R(e.message)); process.exit(1); });
