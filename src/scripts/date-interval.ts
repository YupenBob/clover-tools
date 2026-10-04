import {
  addDays,
  calendarSpan,
  civilToDate,
  daysBetween,
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
  numberInput,
  text,
} from "./daily-ui";

const { copy: t, locale } = getDailyData();
const today = formatCivilDate(localToday());
for (const id of ["ddStart", "ddEnd", "ddBase"])
  byId<HTMLInputElement>(id).value = today;
let intervalCopy = "",
  offsetCopy = "";
const enableIntervalCopy = copyControl("ddCopy", () => intervalCopy);
const enableOffsetCopy = copyControl("ddOffsetCopy", () => offsetCopy);

function interval() {
  const from = parseCivilDate(byId<HTMLInputElement>("ddStart").value);
  const to = parseCivilDate(byId<HTMLInputElement>("ddEnd").value);
  markInvalid("ddStart", !from);
  markInvalid("ddEnd", !to);
  if (!from || !to) {
    for (const id of ["ddNumber", "ddWeeks", "ddCalendar"]) text(id, "—");
    text("ddFromLabel", "");
    text("ddToLabel", "");
    intervalCopy = "";
    enableIntervalCopy(false);
    showStatus("ddStatus", "error", t.invalid);
    return;
  }
  const signed = daysBetween(from, to);
  const elapsed = Math.abs(signed);
  const inclusive = byId<HTMLInputElement>("ddInclusive").checked;
  const count = elapsed + (inclusive ? 1 : 0);
  const span = calendarSpan(signed < 0 ? to : from, signed < 0 ? from : to);
  text("ddResultLabel", inclusive ? t.intervalDays : t.elapsedDays);
  text("ddNumber", count.toLocaleString(locale));
  text("ddWeeks", Math.floor(elapsed / 7).toLocaleString(locale));
  text("ddCalendar", interpolate(t.span, { ...span }));
  for (const [id, date] of [
    ["ddFromLabel", from],
    ["ddToLabel", to],
  ] as const) {
    const time = byId<HTMLTimeElement>(id);
    time.dateTime = formatCivilDate(date);
    time.textContent = time.dateTime;
  }
  intervalCopy = `${formatCivilDate(from)} → ${formatCivilDate(to)}\n${inclusive ? t.intervalDays : t.elapsedDays}: ${count} ${t.days}\n${t.calendarSpan}: ${interpolate(t.span, { ...span })}`;
  enableIntervalCopy(true);
  if (signed < 0) showStatus("ddStatus", "info", t.dateReversed);
  else hideStatus("ddStatus");
}
function offset() {
  const base = parseCivilDate(byId<HTMLInputElement>("ddBase").value);
  const days = numberInput("ddDays");
  const result = base && days !== null ? addDays(base, days) : null;
  markInvalid("ddBase", !base);
  markInvalid(
    "ddDays",
    days === null || !Number.isSafeInteger(days) || Boolean(base && !result),
  );
  if (!result) {
    text("ddOffsetDate", "—");
    text("ddOffsetWeekday", "");
    offsetCopy = "";
    enableOffsetCopy(false);
    showStatus("ddOffsetStatus", "error", t.offsetInvalid);
    return;
  }
  const value = formatCivilDate(result);
  text("ddOffsetDate", value);
  text(
    "ddOffsetWeekday",
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      timeZone: "UTC",
    }).format(civilToDate(result)),
  );
  offsetCopy = value;
  enableOffsetCopy(true);
  hideStatus("ddOffsetStatus");
}
bindLiveForm("ddForm", interval);
bindLiveForm("ddOffsetForm", offset);
interval();
offset();
