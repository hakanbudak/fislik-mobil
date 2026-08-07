import { currentPeriod, formatPeriodLabel, shiftPeriod } from "../period";

test("formats a period as a Turkish month and year", () => {
  expect(formatPeriodLabel("2026-08")).toBe("Ağustos 2026");
  expect(formatPeriodLabel("2026-01")).toBe("Ocak 2026");
});

test("shifts across year boundaries", () => {
  expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
  expect(shiftPeriod("2025-12", 1)).toBe("2026-01");
});

test("current period matches the YYYY-MM shape the API validates", () => {
  expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
});
