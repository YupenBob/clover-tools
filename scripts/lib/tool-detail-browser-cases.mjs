import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { localizedPath } from '../../config/routes.mjs';

const workbenches = [
  ['base64', 'b64Input', 'b64Output', 'encodeBtn', 'b64Copy', 'b64Clear', '中文 Clover'],
  [
    'url-encode',
    'urlInput',
    'urlOutput',
    'urlBtn',
    'urlCopy',
    'urlClear',
    'https://example.com/搜索?q=中文 内容',
  ],
  ['unicode-converter', 'uc2Input', 'uc2Output', 'uc2Enc', 'uc2Copy', 'uc2Clear', '中𐐷'],
  [
    'json-xml-yaml',
    'srcInput',
    'outOutput',
    'fmtBtn',
    'fmtCopy',
    'fmtClear',
    '{"user":"Clover","items":[1,2],"active":true}',
  ],
  ['js-formatter', 'jsInput', 'jsOutput', 'jsFmt', 'jsCopy', 'jsClear', 'const answer={x:1};'],
  [
    'css-formatter',
    'cssInput',
    'cssOutput',
    'cssFmt',
    'cssCopy',
    'cssClear',
    '.card{z-index:2;color:red;padding:0}',
  ],
  [
    'html-formatter',
    'htmlInput',
    'htmlOutput',
    'htmlFmt',
    'htmlCopy',
    'htmlClear',
    '<section><p>Clover &amp; Tools</p></section>',
  ],
  [
    'xml-formatter',
    'xmlInput',
    'xmlOutput',
    'xmlFmt',
    'xmlCopy',
    'xmlClear',
    '<root><item id="1">Clover</item></root>',
  ],
  [
    'sql-formatter',
    'sqfInput',
    'sqfOutput',
    'sqfBtn',
    'sqfCopy',
    'sqfClear',
    'select id,name from users where id=7 order by name;',
  ],
];

async function fits(page) {
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'tool must fit the viewport',
  );
}

async function panels(page, layout, selector = '.tool-workspace > .tool-card-panel') {
  const boxes = await Promise.all([0, 1].map((i) => page.locator(selector).nth(i).boundingBox()));
  assert.ok(boxes.every(Boolean));
  if (layout === 'columns')
    assert.ok(
      boxes[1].x >= boxes[0].x + boxes[0].width - 1,
      'desktop panels should sit side by side',
    );
  else
    assert.ok(
      boxes[1].y >= boxes[0].y + boxes[0].height - 1,
      'mobile panels should follow document order',
    );
  await fits(page);
}

async function capture(page, artifacts, lang, name) {
  if (lang === 'zh')
    await page.screenshot({ path: join(artifacts, `detail-${name}.png`), animations: 'disabled' });
}

async function pairedControls(page, first, second) {
  const [left, right] = await Promise.all([
    page.locator(first).boundingBox(),
    page.locator(second).boundingBox(),
  ]);
  assert.ok(left && right && right.x >= left.x + left.width - 1);
  assert.ok(Math.abs(left.y - right.y) < 1, 'related controls should share a mobile row');
}

async function pngDownload(page, path) {
  const downloaded = page.waitForEvent('download');
  await page.click('#qrDownload');
  const file = await downloaded;
  assert.equal(file.suggestedFilename(), 'clover-code.png');
  assert.equal(await file.failure(), null);
  await file.saveAs(path);
  const png = await readFile(path);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length > 100, 'download should contain an image');
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

export async function runToolDetailChecks({ run, remember, base, artifacts }) {
  for (const lang of ['zh', 'tw', 'en', 'ko', 'ja']) {
    for (const [slug, inputId, outputId, action, copy, clear, source] of workbenches) {
      await run(
        `text workbench ${slug} ${lang}`,
        {
          viewport: { width: 1440, height: 1000 },
          permissions: ['clipboard-read', 'clipboard-write'],
        },
        async (page, context) => {
          await remember(context, lang);
          await page.goto(base + localizedPath(`/tools/dev/${slug}/`, lang));
          assert.equal(await page.locator('.tool-page').getAttribute('data-workspace'), 'split');
          for (const id of [inputId, outputId]) {
            assert.ok(
              await page
                .locator(`#${id}`)
                .evaluate((input) =>
                  document
                    .getElementById(input.getAttribute('aria-labelledby'))
                    ?.textContent.trim(),
                ),
              'editors need a visible accessible name',
            );
          }
          if (slug === 'css-formatter') {
            await page.selectOption('#cssIndent', '4');
            await page.check('#cssSort');
          }
          if (slug === 'json-xml-yaml') await page.selectOption('#modeSelect', 'json2yaml');
          await page.fill(`#${inputId}`, source);
          await page.locator(`#${inputId}`).press('Control+Enter');
          await page.waitForFunction(
            (id) => document.getElementById(id).value.length > 0,
            outputId,
          );
          const output = await page.inputValue(`#${outputId}`);
          if (slug === 'base64') assert.equal(output, Buffer.from(source).toString('base64'));
          else if (slug === 'url-encode') assert.equal(output, encodeURIComponent(source));
          else if (slug === 'unicode-converter') assert.equal(output, '\\u4E2D\\u{10437}');
          else if (slug === 'json-xml-yaml')
            assert.deepEqual(parseYaml(output), JSON.parse(source));
          else if (slug === 'js-formatter')
            assert.equal(new Function(`${output};return answer.x;`)(), 1);
          else if (slug === 'css-formatter')
            assert.equal(output, '.card {\n    color: red;\n    padding: 0;\n    z-index: 2;\n}');
          else if (slug === 'html-formatter') {
            assert.equal(
              await page.evaluate(
                (text) =>
                  new DOMParser()
                    .parseFromString(text, 'text/html')
                    .querySelector('p')
                    .textContent.trim(),
                output,
              ),
              'Clover & Tools',
            );
          } else if (slug === 'xml-formatter') {
            assert.equal(
              await page.evaluate((text) => {
                const doc = new DOMParser().parseFromString(text, 'application/xml');
                return doc.querySelector('parsererror')
                  ? null
                  : doc.querySelector('item').textContent.trim();
              }, output),
              'Clover',
            );
          } else if (slug === 'sql-formatter') {
            assert.match(output, /SELECT/);
            assert.match(output, /\n.*FROM/);
          }
          await page.click(`#${copy}`);
          // inputValue() returns a textarea value with line endings normalised, while the
          // clipboard keeps the bytes the tool copied; a CRLF checkout must not fail the compare.
          assert.equal(
            (await page.evaluate(() => navigator.clipboard.readText())).replace(
              /\r\n/g,
              '\n',
            ),
            output,
          );
          await panels(page, 'columns');
          await capture(page, artifacts, lang, `${slug}-desktop`);
          // Clear the read-only result to observe a second shortcut execution.
          await page.locator(`#${outputId}`).evaluate((element) => {
            element.value = '';
          });
          await page.locator(`#${inputId}`).press('Meta+Enter');
          await page.waitForFunction(
            ({ id, expected }) => document.getElementById(id).value === expected,
            { id: outputId, expected: output },
          );

          if (slug === 'base64') {
            await page.fill(`#${inputId}`, output);
            await page.click('#decodeBtn');
            assert.equal(await page.inputValue(`#${outputId}`), source);
          } else if (slug === 'url-encode') {
            await page.selectOption('#urlMode', 'decodeComponent');
            await page.fill(`#${inputId}`, output);
            await page.click(`#${action}`);
            assert.equal(await page.inputValue(`#${outputId}`), source);
          } else if (slug === 'unicode-converter') {
            await page.fill(`#${inputId}`, output);
            await page.click('#uc2Dec');
            assert.equal(await page.inputValue(`#${outputId}`), source);
            await page.fill(`#${inputId}`, '\\u{110000}');
            await page.click('#uc2Dec');
            assert.equal(await page.inputValue(`#${outputId}`), '');
            assert.ok(
              await page
                .locator('#uc2Status')
                .evaluate((element) => element.classList.contains('error')),
            );
          } else if (slug === 'json-xml-yaml') {
            await page.selectOption('#modeSelect', 'yaml2json');
            await page.fill(`#${inputId}`, output);
            await page.click(`#${action}`);
            await page.waitForFunction(
              (id) => document.getElementById(id).value.startsWith('{'),
              outputId,
            );
            assert.deepEqual(JSON.parse(await page.inputValue(`#${outputId}`)), JSON.parse(source));
          } else if (slug === 'css-formatter') {
            const css = '.x :hover{content:"a  b;}";width:calc(100% - 2px)}';
            await page.fill(`#${inputId}`, css);
            await page.click('#cssMin');
            const compressed = await page.inputValue(`#${outputId}`);
            assert.ok(compressed.includes('"a  b;}"'), 'compression must preserve quoted content');
            assert.ok(compressed.includes('calc(100% - 2px)'), 'calc operators require spaces');
            const cssom = await page.evaluate((text) => {
              const sheet = new CSSStyleSheet();
              sheet.replaceSync(text);
              return {
                selector: sheet.cssRules[0].selectorText,
                content: sheet.cssRules[0].style.content,
              };
            }, compressed);
            assert.equal(cssom.selector, '.x :hover');
            assert.equal(cssom.content, '"a  b;}"');
            await page.fill(
              `#${inputId}`,
              '@media(min-width:600px){.x:hover{z-index:2;color:red;color:blue;padding:0}}',
            );
            await page.click('#cssFmt');
            const nested = await page.inputValue(`#${outputId}`);
            assert.ok(
              nested.indexOf('color: red;') < nested.indexOf('color: blue;'),
              'sorting should preserve repeated property order',
            );
            assert.ok(
              nested.includes('        padding: 0;'),
              'nested rules should honor the chosen indentation',
            );
            assert.equal(
              await page.evaluate((text) => {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(text);
                return sheet.cssRules[0].cssRules[0].selectorText;
              }, nested),
              '.x:hover',
            );
          }
          await page.setViewportSize({ width: 360, height: 800 });
          await panels(page, 'stack');
          await capture(page, artifacts, lang, `${slug}-mobile`);
          await page.click(`#${clear}`);
          assert.equal(await page.inputValue(`#${inputId}`), '');
          assert.equal(await page.inputValue(`#${outputId}`), '');
        },
      );
    }

    await run(
      `diff composition and comparison ${lang}`,
      { viewport: { width: 1440, height: 1000 } },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath('/tools/dev/diff/', lang));
        await page.fill('#diffA', 'same\nold');
        await page.fill('#diffB', 'same\nnew');
        await page.locator('#diffA').press('Control+Enter');
        const report = await page.inputValue('#diffOut');
        assert.ok(
          report.includes('  same') && report.includes('- old') && report.includes('+ new'),
        );
        assert.match(await page.locator('#diffStats').textContent(), /\+1 \/ -1/);
        await panels(page, 'columns', '.diff-inputs > .tool-card-panel');
        const inputs = await page.locator('.diff-inputs').boundingBox();
        const result = await page.locator('#diffOut').boundingBox();
        assert.ok(result.y > inputs.y + inputs.height);
        await capture(page, artifacts, lang, 'diff-desktop');
        await page.click('#diffSwap');
        await page.locator('#diffB').press('Meta+Enter');
        assert.ok((await page.inputValue('#diffOut')).includes('+ old'));
        await page.setViewportSize({ width: 360, height: 800 });
        await panels(page, 'stack', '.diff-inputs > .tool-card-panel');
        await capture(page, artifacts, lang, 'diff-mobile');
        await page.fill('#diffA', '');
        await page.fill('#diffB', '');
        await page.click('#diffBtn');
        assert.equal(await page.inputValue('#diffOut'), '');
      },
    );

    await run(
      `regex live inspector ${lang}`,
      { viewport: { width: 1440, height: 1000 } },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath('/tools/dev/regex-tester/', lang));
        assert.ok(
          (await page.locator('#rePattern').getAttribute('placeholder')).includes('\\b\\w+'),
          'regex examples should preserve literal escapes',
        );
        await page.fill('#rePattern', '(foo)');
        await page.fill('#reText', '<b>foo</b> foo');
        assert.equal(await page.locator('#reView mark').count(), 2);
        assert.equal(
          await page.locator('#reView b').count(),
          0,
          'highlighting should render HTML input as text',
        );
        assert.equal(await page.locator('#reView').textContent(), '<b>foo</b> foo');
        const panelsAll = page.locator('.tool-workspace > .tool-card-panel');
        const [source, highlight, report] = await Promise.all(
          [0, 1, 2].map((i) => panelsAll.nth(i).boundingBox()),
        );
        assert.ok(highlight.x >= source.x + source.width - 1);
        assert.ok(report.x === highlight.x && report.y >= highlight.y + highlight.height);
        await capture(page, artifacts, lang, 'regex-desktop');
        await page.check('#flagU');
        await page.fill('#reText', '𐐷a');
        await page.fill('#rePattern', '(?=.)');
        assert.equal(
          await page.locator('#reView mark').count(),
          2,
          'zero-width Unicode matches must advance by a full code point',
        );
        const output = await page.inputValue('#reOutput');
        assert.deepEqual(
          output.split('\n').map((line) => Number(line.match(/\d+/g)[1])),
          [0, 2],
        );
        await page.fill('#rePattern', '[');
        assert.equal(await page.inputValue('#reOutput'), '');
        assert.ok(
          await page
            .locator('#reStatus')
            .evaluate((element) => element.classList.contains('error')),
        );
        await page.fill('#rePattern', '');
        assert.equal(await page.locator('#reView').textContent(), '𐐷a');
        await page.setViewportSize({ width: 360, height: 800 });
        await panels(page, 'stack');
        await fits(page);
        await capture(page, artifacts, lang, 'regex-mobile');
      },
    );

    await run(
      `QR and barcode preview exports ${lang}`,
      { viewport: { width: 1440, height: 1000 } },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath('/tools/dev/qrcode/', lang));
        assert.ok(await page.locator('#qrDownload').isDisabled());
        assert.ok(await page.locator('#qrEmpty').isVisible());
        await page.click('#qrBtn');
        assert.ok(await page.locator('#qrDownload').isDisabled());
        await capture(page, artifacts, lang, 'qrcode-empty-desktop');
        await page.click('#qrSample');
        await page.locator('#qrText').press('Meta+Enter');
        await page.waitForFunction(() => !document.getElementById('qrDownload').disabled);
        assert.ok(await page.locator('#qrCanvas').isVisible());
        assert.ok(await page.locator('#qrEmpty').isHidden());
        const pixels = await page.locator('#qrCanvas').evaluate((canvas) => {
          const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
          let opaque = true,
            dark = false;
          for (let i = 0; i < data.length; i += 4) {
            opaque &&= data[i + 3] === 255;
            dark ||= data[i] < 100;
          }
          return { corner: [...data.slice(0, 4)], opaque, dark };
        });
        assert.deepEqual(pixels, { corner: [255, 255, 255, 255], opaque: true, dark: true });
        assert.deepEqual(
          await pngDownload(page, join(artifacts, `qr-export-${lang}.png`)),
          [384, 384],
        );
        await panels(page, 'columns');
        await capture(page, artifacts, lang, 'qrcode-desktop');
        await page.fill('#qrText', 'changed');
        assert.ok(await page.locator('#qrDownload').isDisabled());
        assert.ok(await page.locator('#qrCanvas').isHidden());
        await page.selectOption('#qrSize', '512');
        await page.click('#qrBtn');
        await page.waitForFunction(() => !document.getElementById('qrDownload').disabled);
        await page.setViewportSize({ width: 360, height: 800 });
        await panels(page, 'stack');
        await pairedControls(page, '#qrSize', '#qrLevel');
        const canvas = await page.locator('#qrCanvas').boundingBox();
        assert.ok(
          canvas.width <= 360 && Math.abs(canvas.width - canvas.height) < 1,
          'QR preview must scale square on mobile',
        );
        await page.click('#themeToggle');
        await fits(page);
        await capture(page, artifacts, lang, 'qrcode-mobile-dark');
        await page.selectOption('#qrType', 'barcode');
        assert.ok(await page.locator('#qrSize').isDisabled());
        assert.ok(await page.locator('#qrLevelField').isHidden());
        assert.ok(await page.locator('#qrDownload').isDisabled());
        await page.fill('#qrText', 'CLOVER-2026');
        await page.click('#qrBtn');
        await page.waitForFunction(() => !document.getElementById('qrDownload').disabled);
        assert.ok(await page.locator('#barcodeSvg').isVisible());
        const [width, height] = await pngDownload(
          page,
          join(artifacts, `barcode-export-${lang}.png`),
        );
        assert.ok(width > 100 && height >= 80);
        await capture(page, artifacts, lang, 'barcode-mobile-dark');
        await page.fill('#qrText', '中文');
        await page.click('#qrBtn');
        await page.waitForFunction(() =>
          document.getElementById('qrStatus').classList.contains('error'),
        );
        assert.ok(
          await page.locator('#qrDownload').isDisabled(),
          'failed generation cannot export a previous image',
        );
        assert.ok(await page.locator('#barcodeSvg').isHidden());
      },
    );

    await run(
      `color preview validation and copy ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath('/tools/dev/color-convert/', lang));
        await page.fill('#ccHex', '#0f0');
        await page.locator('#ccHex').press('Enter');
        assert.equal(await page.inputValue('#ccHex'), '#00ff00');
        assert.equal(await page.inputValue('#ccRgb'), '0, 255, 0');
        for (const invalid of ['256, 0, 0', 'rgb(0, 255, 0) trailing', '-1, 0, 0']) {
          await page.fill('#ccRgb', invalid);
          await page.locator('#ccRgb').press('Enter');
          assert.equal(await page.locator('#ccRgb').getAttribute('aria-invalid'), 'true');
          assert.equal(await page.locator('#ccPreviewValue').textContent(), '#00ff00');
        }
        await page.fill('#ccHsl', '240, 100%, 50%');
        await page.locator('#ccHsl').press('Enter');
        assert.equal(await page.inputValue('#ccHex'), '#0000ff');
        assert.equal(await page.locator('#ccRgb').getAttribute('aria-invalid'), null);
        await page.fill('#ccHsl', '240, 101%, 50%');
        await page.locator('#ccHsl').press('Enter');
        assert.equal(await page.locator('#ccHsl').getAttribute('aria-invalid'), 'true');
        assert.equal(await page.locator('#ccPreviewValue').textContent(), '#0000ff');
        await page.fill('#ccHex', '#12345');
        await page.locator('#ccHex').press('Enter');
        assert.equal(await page.locator('#ccHex').getAttribute('aria-invalid'), 'true');
        await page.fill('#ccHex', '#c9a96e');
        await page.locator('#ccHex').press('Enter');
        const rgb = page.locator('#ccDetail [data-format="RGB"]');
        await rgb.focus();
        await page.keyboard.press('Enter');
        assert.equal(
          await page.evaluate(() => navigator.clipboard.readText()),
          'rgb(201, 169, 110)',
        );
        await panels(page, 'columns');
        await capture(page, artifacts, lang, 'color-convert-desktop');
        for (const [hex, ink] of [
          ['#ffffff', 'rgb(0, 0, 0)'],
          ['#000000', 'rgb(255, 255, 255)'],
        ]) {
          await page.fill('#ccHex', hex);
          await page.locator('#ccHex').press('Enter');
          assert.equal(
            await page.locator('#ccPreview').evaluate((element) => getComputedStyle(element).color),
            ink,
          );
        }
        await page.fill('#ccHex', '#ff0000');
        await page.locator('#ccHex').press('Enter');
        await page.locator('#ccVariants button').first().click();
        assert.equal(await page.inputValue('#ccHex'), '#00ffff');
        await page.setViewportSize({ width: 360, height: 800 });
        await panels(page, 'stack');
        await page.click('#themeToggle');
        await fits(page);
        await capture(page, artifacts, lang, 'color-convert-mobile-dark');
      },
    );

    await run(
      `unit result precision and controls ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ['clipboard-read', 'clipboard-write'],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath('/tools/daily/unit-converter/', lang));
        await page.selectOption('#ucCat', 'temperature');
        await page.fill('#ucValue', '0');
        assert.equal(await page.locator('#ucNumber').textContent(), '32');
        await page.fill('#ucValue', '-40');
        assert.equal(await page.locator('#ucNumber').textContent(), '-40');
        await page.fill('#ucValue', '0');
        await page.selectOption('#ucTo', 'k');
        assert.equal(await page.locator('#ucNumber').textContent(), '273.15');
        await page.selectOption('#ucCat', 'length');
        await page.selectOption('#ucFrom', 'm');
        await page.selectOption('#ucTo', 'km');
        await page.fill('#ucValue', '0.000001');
        assert.equal(
          await page.locator('#ucNumber').textContent(),
          '1e-9',
          'small nonzero results must retain their precision',
        );
        await page.click('#ucSwap');
        assert.equal(await page.inputValue('#ucFrom'), 'km');
        assert.equal(await page.inputValue('#ucTo'), 'm');
        assert.equal(await page.locator('#ucNumber').textContent(), '0.001');
        await page.click('#ucCopy');
        const equation = `${await page.locator('#ucSource').textContent()} ${await page.locator('#ucNumber').textContent()} ${await page.locator('#ucUnit').textContent()}`;
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), equation);
        await panels(page, 'columns');
        await capture(page, artifacts, lang, 'unit-converter-desktop');
        await page.fill('#ucValue', '');
        assert.equal(await page.locator('#ucValue').getAttribute('aria-invalid'), 'true');
        assert.equal(await page.locator('#ucNumber').textContent(), '—');
        assert.ok(await page.locator('#ucCopy').isDisabled());
        await page.fill('#ucValue', '1');
        assert.ok(await page.locator('#ucCopy').isEnabled());
        for (const cat of ['weight', 'storage', 'time', 'area']) {
          await page.selectOption('#ucCat', cat);
          assert.ok(Number.isFinite(Number(await page.locator('#ucNumber').textContent())));
          assert.ok(await page.locator('#ucUnit').textContent());
        }
        await page.fill('#ucValue', '123456789012345');
        await page.setViewportSize({ width: 360, height: 800 });
        await panels(page, 'stack');
        await page.click('#themeToggle');
        await fits(page);
        await pairedControls(page, '#ucFrom', '#ucTo');
        await capture(page, artifacts, lang, 'unit-converter-mobile-dark');
      },
    );
  }
}
