#!/usr/bin/env node
/**
 * Counter.dev analytics scraper
 */
const { spawn } = require('child_process');
const fs = require('fs');

const COOKIE_FILE = '/tmp/counter_cookies.txt';
const EMAIL = 'yupenbob';
const PASSWORD = 'bob100125';

function execCmd(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { timeout: 20000 });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => resolve({ code, stdout, stderr }));
    proc.on('error', reject);
  });
}

async function login() {
  console.log('🔐 Logging in...');
  try { fs.unlinkSync(COOKIE_FILE); } catch {}
  
  const result = await execCmd('curl', [
    '-s', '-c', COOKIE_FILE,
    '-X', 'POST',
    '-d', `user=${EMAIL}&password=${PASSWORD}`,
    '-D', '/tmp/h.txt',
    '-o', '/dev/null',
    'https://counter.dev/login'
  ]);
  
  if (!fs.existsSync(COOKIE_FILE)) {
    console.log('❌ No cookie file'); return false;
  }
  const content = fs.readFileSync(COOKIE_FILE, 'utf8');
  if (!content.includes('swa')) {
    console.log('❌ No swa cookie'); return false;
  }
  console.log('✅ Logged in');
  return true;
}

async function fetchData() {
  const cookieContent = fs.readFileSync(COOKIE_FILE, 'utf8');
  const swaMatch = cookieContent.match(/swa\t([^\t\n]+)/);
  if (!swaMatch) { console.log('❌ Cannot extract cookie'); return null; }
  const swa = swaMatch[1].trim();
  
  console.log('📊 Fetching data...');
  const result = await execCmd('curl', [
    '-s', '-m', '20',
    '-H', `Cookie: swa=${swa}`,
    'https://counter.dev/dump'
  ]);
  
  return result.stdout;
}

function parseData(raw) {
  const lines = raw.trim().split('\n');
  const data = {};
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    try {
      const json = JSON.parse(line.slice(5));
      data[json.type] = json.payload;
    } catch {}
  }
  return data;
}

function printReport(data) {
  console.log('\n======== 🍀 CloverTools 统计报告 ========\n');
  
  const site = data.dump?.sites?.['tools.xsanye.cn'];
  if (!site || !site.visits) {
    console.log('暂无访问数据');
    return;
  }
  
  const v = site.visits;
  const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + b, 0);
  
  console.log('📅 今日浏览量:', sum(v.day?.page || {}));
  console.log('📅 昨日浏览量:', sum(v.yesterday?.page || {}));
  console.log('📅 本月浏览量:', sum(v.month?.page || {}));
  console.log('📅 总浏览量:', sum(v.all?.page || {}));
  console.log('');
  console.log('🌍 设备:', JSON.stringify(v.all?.device || {}));
  console.log('🌍 浏览器:', JSON.stringify(v.all?.browser || {}));
  console.log('🌍 国家:', JSON.stringify(v.all?.country || {}));
  console.log('🌍 语言:', JSON.stringify(v.all?.lang || {}));
  console.log('🌍 页面:', JSON.stringify(v.all?.page || {}));
  
  const logs = site.logs || {};
  if (Object.keys(logs).length > 0) {
    console.log('\n📝 原始访问日志:');
    for (const [time, info] of Object.entries(logs)) {
      console.log(`   ${time}: ${info}`);
    }
  }
}

async function main() {
  const ok = await login();
  if (!ok) return;
  
  const raw = await fetchData();
  if (!raw) return;
  
  const data = parseData(raw);
  printReport(data);
}

main().catch(console.error);
