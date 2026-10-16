import assert from "node:assert/strict";
import { localizedPath, LOCALES } from "../../config/routes.mjs";

export async function runReviewChecks({ run, base }) {
  for (const lang of Object.keys(LOCALES)) {
    await run(
      `${lang} workday fallback and rest-day counts`,
      { timezoneId: "America/New_York" },
      async (page) => {
        await page.goto(base + localizedPath("/tools/daily/workday/", lang));
        await page.fill("#wdStart", "2027-03-08");
        await page.fill("#wdEnd", "2027-03-14");
        await page.click("#wdBtn");
        assert.match(await page.locator("#wdResult").innerText(), /\b5\b/);
        assert.match(await page.locator("#wdResult").innerText(), /\b2\b/);
        assert.match(await page.locator("#wdResult").innerText(), /\b7\b/);
        assert.match(await page.locator("#wdStatus").innerText(), /2027/);
      },
    );
    await run(`${lang} fuel volume and cost formulas`, {}, async (page) => {
      await page.goto(base + localizedPath("/tools/daily/fuel/", lang));
      await page.fill("#fuelKm", "500");
      await page.fill("#fuelAmount", "40");
      await page.fill("#fuelPrice", "7.5");
      await page.click("#fuelBtn");
      const result = await page.locator("#fuelResult").innerText();
      assert(
        result.includes("8.00") &&
          result.includes("300.00") &&
          result.includes("0.600"),
      );
    });
    await run(
      `${lang} JSON export validation and nested data`,
      {},
      async (page) => {
        await page.goto(base + localizedPath("/tools/dev/json-convert/", lang));
        await page.fill(
          "#jsonInput",
          '[{"id":1,"profile":{"city":"Hangzhou"}}]',
        );
        await page.click("#convertBtn");
        assert.equal(
          await page.inputValue("#csvOutput"),
          'id,profile\n1,"{""city"":""Hangzhou""}"',
        );
        await page.fill("#jsonInput", '[{"id":1},null]');
        await page.click("#convertBtn");
        assert.equal(await page.inputValue("#csvOutput"), "");
        assert(
          await page
            .locator("#statusMsg")
            .evaluate((el) => el.classList.contains("error")),
        );
      },
    );
    await run(`${lang} bounded unique random generation`, {}, async (page) => {
      await page.goto(base + localizedPath("/tools/fun/random-number/", lang));
      await page.fill("#rnMin", "1");
      await page.fill("#rnMax", "5");
      await page.fill("#rnCount", "5");
      await page.click("#rnBtn");
      assert.equal(await page.inputValue("#rnOutput"), "1\n2\n3\n4\n5");
      await page.fill("#rnMax", "4294967297");
      await page.click("#rnBtn");
      assert.equal(await page.inputValue("#rnOutput"), "");
      assert(
        await page
          .locator("#rnStatus")
          .evaluate((el) => el.classList.contains("error")),
      );
    });
    await run(
      `${lang} JSONPath supported and rejected filters`,
      {},
      async (page) => {
        await page.goto(base + localizedPath("/tools/dev/jsonpath/", lang));
        await page.fill("#jpJson", '{"items":[{"price":5},{"price":15}]}');
        await page.fill("#jpExpr", "$.items[?(@.price < 10)].price");
        await page.click("#jpBtn");
        assert.equal(await page.inputValue("#jpOutput"), "5");
        await page.fill("#jpJson", "[]");
        await page.fill("#jpExpr", "$[?(@.price && @.ok)]");
        await page.click("#jpBtn");
        assert.equal(await page.inputValue("#jpOutput"), "");
        assert(
          await page
            .locator("#jpStatus")
            .evaluate((el) => el.classList.contains("error")),
        );
      },
    );
  }
}
