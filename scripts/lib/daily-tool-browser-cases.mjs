import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { localizedPath } from "../../config/routes.mjs";

async function fits(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "daily workspace must fit the viewport",
  );
}
async function invalid(page, status, result, copy) {
  assert.match(await page.locator(status).getAttribute("class"), /show error/);
  assert.equal((await page.textContent(result)).trim(), "—");
  assert.equal(await page.locator(copy).isDisabled(), true);
}
async function capture(page, artifacts, lang, name) {
  if (lang === "zh")
    await page.screenshot({
      path: join(artifacts, `daily-${name}.png`),
      animations: "disabled",
    });
}
export async function runDailyToolChecks({ run, remember, base, artifacts }) {
  const headers = await readFile(
    new URL("../../public/_headers", import.meta.url),
    "utf8",
  );
  const csp = headers.match(/Content-Security-Policy:\s*(.+)/)[1].trim();
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    await run(
      `calculator under production CSP ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.route("**/tools/daily/calculator/", async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            headers: { ...response.headers(), "content-security-policy": csp },
          });
        });
        const response = await page.goto(
          base + localizedPath("/tools/daily/calculator/", lang),
        );
        assert.equal(response.headers()["content-security-policy"], csp);
        await page.fill("#calcExpr", "(2+3)*4");
        await page.locator("#calcExpr").press("Enter");
        assert.equal(await page.textContent("#calcResult"), "20");
        assert.equal(await page.locator("#calcHistory li").count(), 1);
        await page.click("#calcCopy");
        assert.equal(
          await page.evaluate(() => navigator.clipboard.readText()),
          "20",
        );
        for (const [source, expected] of [
          ["2^3^2", "512"],
          ["√(16)+5!", "124"],
          ["1/1000000000000", "1e-12"],
        ]) {
          await page.fill("#calcExpr", source);
          await page.locator("#calcExpr").press("Enter");
          assert.equal(await page.textContent("#calcResult"), expected);
        }
        await page.locator("#calcHistory button").last().click();
        assert.equal(await page.inputValue("#calcExpr"), "(2+3)*4");
        await page.fill("#calcExpr", "8");
        await page.click('[data-key="sign"]');
        assert.equal(await page.textContent("#calcResult"), "-8");
        await page.click('[data-key="sign"]');
        assert.equal(await page.textContent("#calcResult"), "8");
        await page.fill("#calcExpr", "1/0");
        await page.locator("#calcExpr").press("Enter");
        await invalid(page, "#calcStatus", "#calcResult", "#calcCopy");
        await page.click('[data-key="C"]');
        await page.locator('[data-key="7"]').focus();
        await page.locator('[data-key="7"]').press("Enter");
        assert.equal(
          await page.inputValue("#calcExpr"),
          "7",
          "Enter on a native key must activate that key",
        );
        await page.click('[data-key="back"]');
        assert.equal(await page.inputValue("#calcExpr"), "");
        assert.equal(await page.textContent("#calcResult"), "0");
        const machine = await page.locator(".calc-machine").boundingBox();
        assert.ok(machine.width <= 450, "desktop keypad must remain compact");
        await page.setViewportSize({ width: 360, height: 1000 });
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
        await fits(page);
        await capture(page, artifacts, lang, "calculator");
      },
    );

    await run(
      `deadline countdown and exact stopwatch ${lang}`,
      { viewport: { width: 390, height: 1100 } },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath("/tools/daily/timer/", lang));
        assert.equal(await page.textContent("#cdDisplay"), "05:00");
        assert.equal(await page.locator("#cdPause").isDisabled(), true);
        await page.fill("#tmMin", "0");
        await page.fill("#tmSec", "2");
        assert.equal(await page.textContent("#cdDisplay"), "00:02");
        if (lang === "zh") await page.check("#cdSound");
        await page.click("#cdStart");
        assert.equal(await page.locator("#tmSec").isDisabled(), true);
        await page.evaluate(() => {
          const end = performance.now() + 2400;
          while (performance.now() < end) {}
        });
        await page.waitForFunction(
          () => document.getElementById("cdState").dataset.state === "finished",
        );
        assert.equal(await page.textContent("#cdDisplay"), "00:00");
        assert.match(
          await page.locator("#cdStatus").getAttribute("class"),
          /show success/,
        );
        await page.click("#cdReset");
        assert.equal(
          await page.textContent("#cdDisplay"),
          "00:02",
          "reset should restore the configured duration",
        );
        await page.click('[data-minutes="5"]');
        assert.equal(await page.textContent("#cdDisplay"), "05:00");
        await page.click("#swStart");
        await page.waitForFunction(
          () => document.getElementById("swDisplay").textContent !== "00:00.0",
        );
        await page.click("#swLap");
        assert.equal(await page.locator("#swLaps li").count(), 1);
        await page.click("#swPause");
        const paused = await page.textContent("#swDisplay");
        await page.evaluate(() => {
          const end = performance.now() + 225;
          while (performance.now() < end) {}
        });
        assert.equal(await page.textContent("#swDisplay"), paused);
        await page.click("#swStart");
        const resumed = await page.textContent("#swDisplay");
        await page.fill("#tmSec", "1.5");
        await page.waitForFunction(
          (previous) =>
            document.getElementById("swDisplay").textContent !== previous,
          resumed,
        );
        assert.equal(await page.textContent("#cdDisplay"), "—");
        assert.equal(await page.locator("#cdStart").isDisabled(), true);
        await page.click("#cdReset");
        assert.equal(await page.textContent("#cdDisplay"), "05:00");
        await page.click("#swReset");
        assert.equal(await page.textContent("#swDisplay"), "00:00.0");
        assert.equal(await page.locator("#swLaps li").count(), 0);
        await page.fill("#tmSec", "0");
        await fits(page);
        await capture(page, artifacts, lang, "timer");
      },
    );

    await run(
      `BMI units and continuous reference scale ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath("/tools/daily/bmi/", lang));
        assert.equal(await page.textContent("#bmiNumber"), "22.9");
        await page.fill("#bmiHeight", "200");
        await page.fill("#bmiWeight", "96");
        await page.selectOption("#bmiStandard", "cn");
        assert.equal(
          await page.locator("#bmiResult").getAttribute("data-category"),
          "2",
        );
        await page.selectOption("#bmiStandard", "who");
        assert.equal(
          await page.locator("#bmiResult").getAttribute("data-category"),
          "1",
        );
        await page.fill("#bmiWeight", "97");
        const first = await page
          .locator("#bmiMarker")
          .evaluate((node) => node.style.left);
        await page.fill("#bmiWeight", "98");
        const second = await page
          .locator("#bmiMarker")
          .evaluate((node) => node.style.left);
        assert.notEqual(
          first,
          second,
          "the marker must move within the same reference category",
        );
        await page.fill("#bmiHeight", "175");
        await page.fill("#bmiWeight", "70");
        await page.selectOption("#bmiUnits", "imperial");
        assert.equal(await page.textContent("#bmiNumber"), "22.9");
        assert.equal(await page.textContent("#bmiHeightUnit"), "in");
        assert.equal(await page.textContent("#bmiWeightUnit"), "lb");
        await page.click("#bmiCopy");
        assert.match(
          await page.evaluate(() => navigator.clipboard.readText()),
          /in \/ .+ lb/,
        );
        await page.fill("#bmiWeight", "");
        await invalid(page, "#bmiStatus", "#bmiNumber", "#bmiCopy");
        await page.fill("#bmiWeight", "154.32");
        await page.selectOption("#bmiUnits", "metric");
        await page.locator("#bmiHeightRange").focus();
        const previous = await page.inputValue("#bmiHeight");
        await page.locator("#bmiHeightRange").press("ArrowRight");
        assert.notEqual(await page.inputValue("#bmiHeight"), previous);
        await page.setViewportSize({ width: 360, height: 1100 });
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
        await fits(page);
        await capture(page, artifacts, lang, "bmi");
      },
    );

    await run(
      `financial scenarios and invalid-result handling ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath("/tools/daily/finance/", lang));
        assert.equal(
          Number((await page.textContent("#finMonthly")).replace(/,/g, "")),
          4546.45,
        );
        await page.fill("#finLoan", "12");
        await page.fill("#finYears", "10");
        await page.fill("#finRate", "0");
        assert.equal(
          Number((await page.textContent("#finMonthly")).replace(/,/g, "")),
          1000,
        );
        await page.fill("#finRate", "");
        await invalid(page, "#finLoanStatus", "#finMonthly", "#finLoanCopy");
        await page.fill("#finRate", "0");
        await page.locator("#finTab-loan").focus();
        await page.locator("#finTab-loan").press("ArrowRight");
        assert.equal(
          await page.locator("#finTab-compound").getAttribute("aria-selected"),
          "true",
        );
        assert.equal(await page.locator("#finPanel-loan").isVisible(), false);
        assert.equal(
          Number((await page.textContent("#finFinal")).replace(/,/g, "")),
          16288.95,
        );
        await page.fill("#finRp", "-50");
        await page.fill("#finN", "1");
        assert.equal(
          Number((await page.textContent("#finFinal")).replace(/,/g, "")),
          5000,
        );
        await page.fill("#finP", "0");
        await invalid(
          page,
          "#finCompoundStatus",
          "#finFinal",
          "#finCompoundCopy",
        );
        await page.locator("#finTab-compound").press("End");
        assert.equal(
          await page
            .locator("#finTab-percentage")
            .getAttribute("aria-selected"),
          "true",
        );
        await page.fill("#finB", "-200");
        assert.equal(await page.textContent("#finRatio"), "-100");
        assert.equal(await page.textContent("#finShare"), "—");
        assert.equal(await page.textContent("#finChange"), "-200%");
        await page.click("#finPctCopy");
        assert.match(
          await page.evaluate(() => navigator.clipboard.readText()),
          /-200%/,
        );
        await page.fill("#finA", "0");
        await invalid(page, "#finPctStatus", "#finRatio", "#finPctCopy");
        await page.setViewportSize({ width: 360, height: 1000 });
        await page.fill("#finA", "200");
        await page.fill("#finB", "150");
        await fits(page);
        await capture(page, artifacts, lang, "finance");
      },
    );

    await run(
      `calendar interval and strict date offsets ${lang}`,
      {
        viewport: { width: 390, height: 1100 },
        timezoneId: "America/New_York",
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(base + localizedPath("/tools/daily/date-diff/", lang));
        await page.fill("#ddStart", "2026-01-31");
        await page.fill("#ddEnd", "2026-03-01");
        assert.equal(await page.textContent("#ddNumber"), "29");
        assert.match(await page.textContent("#ddCalendar"), /0\D+1\D+1/);
        await page.check("#ddInclusive");
        assert.equal(await page.textContent("#ddNumber"), "30");
        await page.fill("#ddStart", "2026-03-01");
        await page.fill("#ddEnd", "2026-01-31");
        assert.match(
          await page.locator("#ddStatus").getAttribute("class"),
          /show info/,
        );
        assert.equal(await page.textContent("#ddNumber"), "30");
        await page.fill("#ddBase", "2026-08-01");
        await page.fill("#ddDays", "30");
        assert.equal(await page.textContent("#ddOffsetDate"), "2026-08-31");
        await page.click("#ddOffsetCopy");
        assert.equal(
          await page.evaluate(() => navigator.clipboard.readText()),
          "2026-08-31",
        );
        await page.fill("#ddDays", "1.5");
        await invalid(
          page,
          "#ddOffsetStatus",
          "#ddOffsetDate",
          "#ddOffsetCopy",
        );
        await page.fill("#ddDays", "");
        await invalid(
          page,
          "#ddOffsetStatus",
          "#ddOffsetDate",
          "#ddOffsetCopy",
        );
        await page.fill("#ddBase", "0001-01-01");
        await page.fill("#ddDays", "-1");
        await invalid(
          page,
          "#ddOffsetStatus",
          "#ddOffsetDate",
          "#ddOffsetCopy",
        );
        await page.fill("#ddBase", "2026-08-01");
        await page.fill("#ddDays", "-1");
        assert.equal(await page.textContent("#ddOffsetDate"), "2026-07-31");
        await fits(page);
        await capture(page, artifacts, lang, "date-diff");
      },
    );

    await run(
      `age, month ends and birthday today ${lang}`,
      {
        viewport: { width: 1440, height: 1000 },
        timezoneId: "America/New_York",
        permissions: ["clipboard-read", "clipboard-write"],
      },
      async (page, context) => {
        await remember(context, lang);
        await page.goto(
          base + localizedPath("/tools/daily/age-calculator/", lang),
        );
        await page.fill("#ageBirth", "2000-10-04");
        await page.fill("#ageAt", "2026-10-04");
        assert.equal(await page.textContent("#ageYears"), "26");
        assert.equal(await page.textContent("#ageBirthdayDays"), "0");
        assert.equal(await page.textContent("#ageBirthdayDate"), "2026-10-04");
        await page.fill("#ageBirth", "2000-02-29");
        await page.fill("#ageAt", "2026-02-28");
        assert.equal(await page.textContent("#ageYears"), "26");
        assert.equal(await page.textContent("#ageBirthdayDays"), "0");
        await page.fill("#ageBirth", "2026-01-31");
        await page.fill("#ageAt", "2026-03-01");
        assert.match(await page.textContent("#ageSpan"), /0\D+1\D+1/);
        assert.equal(await page.textContent("#ageLived"), "29");
        await page.click("#ageCopy");
        assert.match(
          await page.evaluate(() => navigator.clipboard.readText()),
          /2026-01-31 → 2026-03-01/,
        );
        await page.fill("#ageBirth", "2026-03-02");
        await invalid(page, "#ageStatus", "#ageYears", "#ageCopy");
        await page.fill("#ageBirth", "2026-03-01");
        assert.equal(await page.textContent("#ageLived"), "0");
        assert.equal(await page.textContent("#ageBirthdayDays"), "0");
        await page.setViewportSize({ width: 360, height: 1100 });
        await page.evaluate(() => {
          document.documentElement.dataset.theme = "dark";
        });
        await fits(page);
        await capture(page, artifacts, lang, "age");
      },
    );
  }
}
