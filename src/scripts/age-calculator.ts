import {
  addMonths,
  calculateAge,
  formatCivilDate,
  localToday,
  parseCivilDate,
} from "../lib/civil-date";
import { interpolate } from "../lib/daily-tool-i18n";
import { byId, hideStatus, showStatus } from "./toolkit";
import {
  bindLiveForm,
  copyControl,
  getDailyData,
  markInvalid,
  text,
} from "./daily-ui";

const { copy: t, locale } = getDailyData();
const today = localToday();
byId<HTMLInputElement>("ageAt").value = formatCivilDate(today);
byId<HTMLInputElement>("ageBirth").value = formatCivilDate(
  addMonths(today, -240),
);
let copied = "";
const enableCopy = copyControl("ageCopy", () => copied);

function update() {
  const birth = parseCivilDate(byId<HTMLInputElement>("ageBirth").value);
  const at = parseCivilDate(byId<HTMLInputElement>("ageAt").value);
  markInvalid("ageBirth", !birth);
  markInvalid("ageAt", !at);
  try {
    if (!birth || !at) throw new RangeError("date");
    const result = calculateAge(birth, at);
    text("ageYears", result.years);
    text(
      "ageSpan",
      interpolate(t.span, {
        years: result.years,
        months: result.months,
        days: result.days,
      }),
    );
    text("ageLived", result.livedDays.toLocaleString(locale));
    text(
      "ageBirthdayDays",
      result.daysUntilBirthday === null ? "—" : result.daysUntilBirthday,
    );
    text("ageNominal", result.nominalYears);
    text(
      "ageBirthdayLabel",
      result.birthdayToday
        ? t.birthdayToday
        : result.daysUntilBirthday === null
          ? "—"
          : `${result.daysUntilBirthday} ${t.days}`,
    );
    byId<HTMLProgressElement>("ageBirthdayProgress").value =
      result.birthdayProgress;
    const next = result.nextBirthday
      ? formatCivilDate(result.nextBirthday)
      : "—";
    text("ageBirthdayDate", next);
    byId<HTMLTimeElement>("ageBirthdayDate").dateTime = result.nextBirthday
      ? next
      : "";
    copied = `${formatCivilDate(birth)} → ${formatCivilDate(at)}\n${t.ageYears}: ${interpolate(t.span, { years: result.years, months: result.months, days: result.days })}\n${t.livedDays}: ${result.livedDays} ${t.days}\n${t.nextBirthday}: ${next}`;
    enableCopy(true);
    hideStatus("ageStatus");
  } catch {
    for (const id of [
      "ageYears",
      "ageLived",
      "ageBirthdayDays",
      "ageNominal",
      "ageBirthdayLabel",
      "ageBirthdayDate",
    ])
      text(id, "—");
    text("ageSpan", "");
    byId<HTMLProgressElement>("ageBirthdayProgress").value = 0;
    byId<HTMLTimeElement>("ageBirthdayDate").dateTime = "";
    if (birth && at) markInvalid("ageBirth", true);
    copied = "";
    enableCopy(false);
    showStatus("ageStatus", "error", t.ageInvalid);
  }
}
bindLiveForm("ageForm", update);
update();
