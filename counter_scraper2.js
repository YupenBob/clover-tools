#!/usr/bin/env node
/**
 * Counter.dev scraper - uses curl for login + puppeteer for dashboard
 */
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const COOKIE_FILE = '/tmp/counter_cookies.json';

function curlLogin() {
  console.log('🔐 Logging in via curl...');
  
  // POST login
  const loginCmd = `curl -s -c /tmp/counter_login.txt -X POST "https://counter.dev/login" -d "user=yupenbob&password=bob100125" -D /tmp/counter_headers.txt -L`;
  const loginOutput = execSync(loginCmd).toString();
  
  // Get session cookie
  const headers = fs.readFileSync('/tmp/counter_headers.txt', 'utf8');
  const cookieMatch = headers.match(/set-cookie:\s*([^;]+)/gi);
  console.log('Login response:', loginOutput.substring(0, 100));
  console.log('Headers:', headers.substring(0, 500));
  
  // Check if login succeeded - swa cookie should be set
  const checkCmd = `cat /tmp/counter_login.txt | grep swa`;
  try {
    execSync(checkCmd);
    console.log('✅ Login cookie saved');
    return true;
  } catch {
    console.log('❌ Login failed');
    return false;
  }
}

async function scrapeDashboard() {
  console.log('🌐 Opening dashboard with cookie...');
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  // Load cookies from curl's cookie jar
  const jar = await page.cookieStore.getCookieJar ? null : null;
  
  // Use curl's cookie file
  await page.setCookie(
    { name: 'swa', value: 'dummy', domain: 'counter.dev', path: '/' }
  );
  
  // Try to use the raw curl approach instead
  await browser.close();
  
  // Use curl with cookie to fetch dashboard
  console.log('Fetching dashboard via curl with cookies...');
  try {
    const dashboardCmd = `curl -s -b /tmp/counter_login.txt "https://counter.dev/dashboard"`;
    const result = execSync(dashboardCmd).toString();
    console.log('Dashboard response:', result.substring(0, 2000));
  } catch(e) {
    console.log('Dashboard error:', e.message);
  }
}

async function main() {
  if (curlLogin()) {
    await scrapeDashboard();
  }
}

main().catch(console.error);
