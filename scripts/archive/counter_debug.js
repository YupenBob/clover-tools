#!/usr/bin/env node
const puppeteer = require('puppeteer-core');

async function scrape() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  // Login page
  await page.goto('https://counter.dev/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Get page content
  const html = await page.content();
  console.log('HTML snippet:', html.substring(0, 3000));
  
  // Find form inputs
  const inputs = await page.$$eval('input', els => els.map(e => ({name: e.name, type: e.type, id: e.id})));
  console.log('\nInputs:', JSON.stringify(inputs));
  
  await browser.close();
}

scrape().catch(console.error);
