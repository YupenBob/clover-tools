const source = '/tools/dev/rsa-encrypt/';

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto(`${base}${source}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const keyPanel = page.locator('.tool-card-panel').filter({ has: page.locator('#rsaGen') });
  const resultPanel = page.locator('.tool-card-panel').filter({ has: page.locator('#rsaOutput') });

  await keyPanel.getByRole('button', { name: '生成密钥对（2048）', exact: true }).click();
  await page.getByText('密钥对已生成', { exact: true }).waitFor();
  await page.waitForFunction(() =>
    document.querySelector('#rsaPub').value.startsWith('-----BEGIN PUBLIC KEY-----') &&
    document.querySelector('#rsaPriv').value.startsWith('-----BEGIN PRIVATE KEY-----')
  );
  await shot(keyPanel, 'rsa-encrypt-keypair.jpg', {
    source,
    purpose: '展示生成按钮、PEM 字段和密钥生成状态',
    alt: '「密钥与操作」面板顶部有「生成密钥对（2048）」按钮，下方公钥和私钥框各有 PEM 文本，操作按钮下方显示「密钥对已生成」。',
    caption: '「密钥与操作」面板显示生成按钮、公钥与私钥文本框，以及「密钥对已生成」状态。',
  });

  await page.locator('#rsaInput').fill('RSA 加密测试');
  await page.locator('#rsaEnc').click();
  await page.getByText('加密完成', { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const output = document.querySelector('#rsaOutput').value;
    return output.length > 0 && btoa(atob(output)) === output;
  });
  await resultPanel.getByRole('button', { name: '复制', exact: true }).waitFor();
  await shot(resultPanel, 'rsa-encrypt-result.jpg', {
    source,
    purpose: '展示 Base64 密文输出及复制按钮',
    alt: '「结果」面板左上角是标题，右上角是「复制」按钮，下方的文本框显示一串 Base64 字符。',
    caption: '「结果」面板的文本框显示 Base64 密文，面板右上角有「复制」按钮。',
  });
}
