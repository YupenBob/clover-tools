const PINNED = new Date('2026-11-20T22:18:00Z');
const SOURCE = '/tools/dev/symmetric-encrypt/';
const PLAINTEXT = 'AES demo';

const CAPTION_ENCRYPT = '配置面板选中 AES、CBC 和 Hex，状态显示「加密完成」，输出框显示十六进制密文。';
const ALT_ENCRYPT = '加解密配置面板的明文框显示 AES demo，按钮下方显示加密完成，输出结果面板内有一行十六进制密文。';
const CAPTION_DECRYPT = '配置面板的输入框显示十六进制密文，状态显示「解密完成」，输出框显示 AES demo。';
const ALT_DECRYPT = '加解密配置面板的输入框显示一行十六进制密文，按钮下方显示解密完成，输出结果面板内写着 AES demo。';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.clock.install({ time: PINNED });
  await page.clock.pauseAt(PINNED);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.goto(new URL(SOURCE, base).href, { waitUntil: 'load' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.tool-workspace');
  await page.selectOption('#encAlgo', 'AES');
  await page.selectOption('#encMode', 'CBC');
  await page.selectOption('#encOut', 'hex');
  await page.fill('#encKey', 'clover-secret');
  await page.fill('#encIv', 'a'.repeat(32));
  await page.fill('#encInput', PLAINTEXT);
  await page.click('#encBtn');
  await page.waitForFunction(() =>
    document.querySelector('#encStatus')?.textContent === '加密完成' &&
    /^[0-9a-f]+$/.test(document.querySelector('#encOutput')?.value ?? ''),
  );
  const ciphertext = await page.inputValue('#encOutput');
  await shot(workspace, 'cbc-encrypt.jpg', { alt: ALT_ENCRYPT, caption: CAPTION_ENCRYPT, source: SOURCE, purpose: '展示 CBC 加密的输入、状态与输出' });

  await page.fill('#encInput', ciphertext);
  await page.click('#decBtn');
  await page.waitForFunction((plaintext) =>
    document.querySelector('#encStatus')?.textContent === '解密完成' &&
    document.querySelector('#encOutput')?.value === plaintext, PLAINTEXT,
  );
  await shot(workspace, 'cbc-decrypt.jpg', { alt: ALT_DECRYPT, caption: CAPTION_DECRYPT, source: SOURCE, purpose: '展示同一参数下的明文还原' });
}
