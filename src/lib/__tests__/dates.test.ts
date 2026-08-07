import { formatDateTime, formatLongDate, formatReceiptDay } from "../dates";

// Period is defined as local-calendar, never UTC (see src/lib/period.ts), and
// all three date helpers below follow the same local-time convention (they
// read `date.getDate()`/`getMonth()`/`getHours()` etc., not the UTC
// variants). A naive test would parse a fixed UTC ISO string and assert a
// fixed local-time rendering of it — but that only holds for one specific
// timezone, and would render differently (or fail) on a CI runner using a
// different TZ than the developer's machine.
//
// Setting `process.env.TZ` inside the test file was tried and does NOT
// reliably override the local timezone under this Jest setup (verified: the
// process's local offset used by `Date#getHours()` etc. is already fixed by
// the time this file's module code runs, in this jest-expo/worker setup) —
// so that approach is out.
//
// Instead, build the fixed instant FROM local components
// (`new Date(2026, 7, 12, 14, 30)`) and derive the ISO string from that via
// `toISOString()`, rather than hardcoding a UTC ISO literal. Because the
// encode (`toISOString`) and the decode (inside `formatReceiptDay` /
// `formatLongDate` / `formatDateTime`, via `new Date(iso)` +
// local-time getters) both use the SAME process's timezone offset, the
// round trip always reproduces the exact local date/time components fed in
// — 12 Ağustos 2026, 14:30 — regardless of what timezone the runner (or CI)
// happens to be in. This makes the assertion timezone-stable without
// needing to control the environment's TZ at all.
const LOCAL_INSTANT = new Date(2026, 7, 12, 14, 30, 0); // 12 Ağustos 2026, 14:30 (local)
const ISO = LOCAL_INSTANT.toISOString();

test("formats a short Turkish day label for receipt tiles", () => {
  expect(formatReceiptDay(ISO)).toBe("12 Ağustos");
});

test("formats a full Turkish date label", () => {
  expect(formatLongDate(ISO)).toBe("12 Ağustos 2026");
});

test("formats a full Turkish date and time label", () => {
  expect(formatDateTime(ISO)).toBe("12 Ağustos 2026, 14:30");
});
